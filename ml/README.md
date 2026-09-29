# MarineVision AI — `ml/` training pipeline

A real, runnable Ultralytics-YOLO training pipeline for the side-scan sonar
detector, kept separate from (and complementary to) the existing in-app
TypeScript training pipeline under `backend/src/modules/ai-training/` (a
lightweight whole-image classifier that needs no Python/GPU and already
powers the Admin → AI Training screens). Use **this** pipeline when you have
real labelled sonar images and want an actual bounding-box object detector.

**Current status of this repository: the pipeline is fully built and
scaffolded, but has NOT been trained here.** This container has no GPU and
no outbound network access, so `pip install`, `python scripts/train.py`,
etc. could not be executed as part of this delivery. Everything below is
copy-paste ready for you to run on your own machine.

## 0. What's actually in `ml/dataset/raw/` right now

15 real side-scan sonar frames (`DM_Wilson_01.png` … `DM_Wilson_15.png`,
1728×~2500–5800px each) you supplied. **They are unlabeled.** No bounding
boxes have been added on your behalf — annotating an object as a specific
class without a verified ground truth would be fabricating training data,
which this project explicitly must never do. Two things you can do with
them:

1. Run `scripts/draft_annotate.py` to get **unverified, heuristic**
   candidate boxes (see step 4 below) to speed up manual annotation.
2. Annotate them yourself (or via CVAT/Roboflow/LabelImg) using the class
   list in `dataset/dataset.yaml`.

15 images is nowhere near enough to train a real detector — see §6.

## 1. Requirements

- Python 3.10–3.12
- ~5 GB free disk (Ultralytics/torch install), more for a real dataset
- A GPU is **not required** but training is much faster with one (CUDA or
  Apple MPS auto-detected; falls back to CPU with a warning)

## 2. Setup

**Windows (PowerShell):**
```powershell
cd ml
.\setup_windows.ps1
```
This creates `.venv`, activates it, installs `requirements.txt`, and
verifies `ultralytics` + `onnxruntime` import correctly.

**macOS / Linux:**
```bash
cd ml
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -c "import ultralytics, onnxruntime; print('ok')"
```

## 3. Dataset structure

```
ml/dataset/
├── raw/             # your original images, untouched, as supplied
├── processed/        # deduped/validated copies with normalized names +
│                      # <name>.txt YOLO label files you create/correct here
├── images/{train,val,test}/   # populated ONLY by split_dataset.py
├── labels/{train,val,test}/   # populated ONLY by split_dataset.py
└── dataset.yaml      # class list + split paths (Ultralytics format)
```

Class names in `dataset.yaml` are matched **1:1, in order**, to
`DETECTION_CLASSES` in
`backend/src/modules/ai-inference/ai-inference.service.ts`. If you add,
remove, or reorder classes, update that array to match — this is what
makes an ONNX model trained here a drop-in replacement for the backend's
placeholder detector, no backend code changes required.

## 4. Building the dataset

```powershell
# 1. Scan raw/, drop corrupted/duplicate files, normalize into processed/
python scripts/prepare_dataset.py --raw dataset/raw --out dataset/processed

# 2. (optional) Propose UNVERIFIED candidate boxes to speed up annotation.
#    Writes dataset/raw_annotations_draft/<image>.txt + .draft.json.
#    These are heuristic proposals (bright-return + local-contrast scoring),
#    NOT ground truth. Review/correct them in an annotation tool, then save
#    the corrected YOLO .txt into dataset/processed/ under the same
#    filename stem as the image.
python scripts/draft_annotate.py --images dataset/processed --data dataset/dataset.yaml

# 3. Annotate (or correct the draft proposals) - one <image-stem>.txt per
#    image in dataset/processed/, YOLO format:
#      <class_id> <center_x> <center_y> <width> <height>   (all 0..1)
#    An image with no objects gets an EMPTY .txt file (not a missing one -
#    missing means "not yet annotated" and is excluded from training).

# 4. Deterministic 70/20/10 train/val/test split (only labeled images are
#    included; unlabeled/invalid ones are reported and skipped, never
#    silently treated as background).
python scripts/split_dataset.py --processed dataset/processed --labels dataset/processed --data dataset/dataset.yaml

# 5. Validate the split dataset (also runs automatically before training).
python scripts/validate_dataset.py --data dataset/dataset.yaml
```

`split_dataset.py` prints and writes a real dataset summary, e.g.:

```
## Dataset Summary

Images processed: 15
Labeled (used):   0
Unlabeled (skipped): 15
Invalid labels (skipped): 0

Training:   0
Validation: 0
Testing:    0
```

(That's the honest, actual output right now — no images have verified
labels yet.) Once you've annotated images, re-run and the counts will
reflect the real dataset.

## 5. Training

```powershell
python scripts/train.py --data dataset/dataset.yaml --model yolo11n.pt --epochs 100 --imgsz 640 --name marine_sonar_v1
```

- Auto-detects CUDA / Apple MPS / CPU and prints which it used.
- **Small-dataset guard:** if the training split has fewer than 200 labeled
  images (configurable via `--min-images-for-full-training`), the script
  automatically forces a 3-epoch **smoke test** and labels the output
  `SMOKE_TEST_EXPERIMENTAL` in `training_metadata.json` — it will not let
  you accidentally present a 15-image run as a trained production model.
- Output: `ml/results/<name>/weights/{best.pt,last.pt}`,
  `results.csv`, `confusion_matrix.png`, `results.png`,
  `training_metadata.json` (real values only — see §9 of the spec this
  pipeline implements).

## 6. Evaluation

```powershell
python scripts/evaluate.py --model results/marine_sonar_v1/weights/best.pt --data dataset/dataset.yaml --name marine_sonar_v1
```

Evaluates on the **TEST** split only. Writes
`results/marine_sonar_v1/evaluation.json` with real precision/recall/
mAP50/mAP50-95, or `null` values with a `reason` if evaluation couldn't
run (missing weights, empty test split, etc.) — never a fabricated number.

## 7. Export to ONNX

```powershell
python scripts/export_onnx.py --model results/marine_sonar_v1/weights/best.pt --out ../ai-models/marine-sonar.onnx
```

Exports, then **verifies** the file loads with ONNX Runtime and passes
`onnx.checker.check_model` before reporting success. Writes directly into
the existing backend's `ai-models/` directory by default.

## 8. Smoke-test the exported model

```powershell
python scripts/predict.py --model ../ai-models/marine-sonar.onnx --image dataset/images/test/<some_image>.jpg --data dataset/dataset.yaml
python scripts/batch_predict.py --model ../ai-models/marine-sonar.onnx --source dataset/images/test --data dataset/dataset.yaml
```

`batch_predict.py` writes `predictions.json` / `predictions.csv` covering
**every** image in the source directory, including ones with zero
confident detections — nothing is silently dropped.

## 9. Backend integration

The backend already loads an ONNX model from `ONNX_MODEL_PATH` (see
`backend/src/modules/ai-inference/ai-inference.service.ts` and
`.env.example`) and already parses standard YOLO tensor output
(`parseYoloOutput()`), specifically so a model trained by this pipeline is
a **drop-in replacement** — no backend code changes needed:

```
# backend/.env
ONNX_MODEL_PATH=./ai-models/marine-sonar.onnx
AI_CONFIDENCE_THRESHOLD=0.35
```

Restart the backend. Startup logs and `GET /api/ai/status` will report
`REAL ONNX MODEL` once the file is present and loads successfully, and
`FALLBACK / MODEL NOT AVAILABLE` otherwise — it never silently pretends
the placeholder is a trained model.

## 6. Small-dataset warning (repeated, because it matters)

You currently have **15 unlabeled images**. That is enough to:
- exercise the entire pipeline end-to-end (prepare → annotate a few → split
  → smoke-test train → evaluate → export → predict),
- confirm every script works on your machine,

but **not** enough to produce a real detector. Real side-scan-sonar
detectors in the literature are typically trained on many hundreds to
thousands of annotated contacts per class. Until you supply (or the
Operator/Admin dataset-review workflow accumulates) a dataset of that
size, any model trained here must stay labeled `EXPERIMENTAL` /
`SMOKE_TEST`, must never be marked `ACTIVE` in the Model Versions screen,
and the application will keep using the existing, honestly-labelled
placeholder/lightweight-classifier fallback for live inference.
