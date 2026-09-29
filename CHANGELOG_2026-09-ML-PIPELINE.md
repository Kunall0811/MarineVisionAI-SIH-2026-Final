# MarineVision AI — Real YOLO/ONNX pipeline pass (this session)

Builds on `CHANGELOG_2026-09.md`. This pass adds the requested real,
reproducible YOLO training pipeline and integrates model status/quality
gating end-to-end. Nothing here fabricates accuracy, coordinates,
detections, or training data.

## 1. `ml/` — full Ultralytics YOLO pipeline (new)
See `ml/README.md` for the complete walkthrough. Summary:
- `dataset.yaml` — class list matched 1:1, in order, to `DETECTION_CLASSES`
  in `backend/src/modules/ai-inference/ai-inference.service.ts`, so an
  exported ONNX model is a drop-in replacement (the backend's existing
  `parseYoloOutput()`-equivalent already expects this tensor layout).
- `scripts/prepare_dataset.py` — dedup by content hash, corrupted-file
  detection, normalization. Does not touch labels.
- `scripts/draft_annotate.py` — a **heuristic, explicitly-unverified**
  bounding-box proposer (contrast/z-score tiling), meant only to speed up
  human annotation. Every output box is tagged `"verified": false` and
  written to a location `split_dataset.py` never reads from, so it can
  never silently become training ground truth.
- `scripts/split_dataset.py` — deterministic (fixed seed) 70/20/10
  train/val/test split. Images without a real label file are **excluded
  and reported**, never treated as background.
- `scripts/validate_dataset.py` — rejects malformed YOLO labels,
  out-of-range coordinates, unknown class ids; usable as a CI gate.
- `scripts/train.py` — Ultralytics YOLO wrapper. Auto-detects CUDA/MPS/CPU.
  **Hard guard:** fewer than 200 labeled training images forces a 3-epoch
  smoke test and labels `training_metadata.json` status
  `SMOKE_TEST_EXPERIMENTAL` — it is not possible to accidentally present a
  tiny run as a production model. Sonar-appropriate augmentation only (no
  vertical flip - would invert acoustic-shadow/nadir geometry; no hue
  augmentation - sonar is grayscale).
- `scripts/evaluate.py` — evaluates on the TEST split only; writes real
  precision/recall/mAP50/mAP50-95 or `null` with a `reason` if it can't run.
- `scripts/export_onnx.py` — exports, then **verifies** the file loads via
  `onnx.checker.check_model` + an ONNX Runtime session before reporting
  success.
- `scripts/predict.py` / `scripts/batch_predict.py` — single-image and
  whole-directory ONNX smoke tests; every image gets an entry (including
  zero-detection ones), matching the exact decode → preprocess → NMS →
  confidence-threshold flow the backend uses.
- `setup_windows.ps1` — PowerShell setup (venv, deps, sanity imports).
- Your 15 `DM_Wilson_*.png` images are copied into `ml/dataset/raw/`,
  **unlabeled**. I did not hand-annotate them: an AI-guessed bounding box
  presented as ground truth would itself be exactly the kind of
  fabrication this project must avoid. Use `draft_annotate.py` + a real
  annotation tool to turn them (and more images you add) into a trained
  dataset.

## 2. Backend — model status & single-image analysis API (new)
- `AiInferenceService.getModelInfo()` — single source of truth for
  "REAL ONNX MODEL" vs "DEMO FALLBACK", used by both the new endpoint and
  (already, from before) the dashboard summary.
- `AiInferenceService.analyzeSingleImage()` — implements the exact status
  taxonomy from the spec: `detected` / `no_confident_detection` /
  `invalid_image` / `inference_error` (never a bare failure, never an
  invented object).
- New module `ai-status`:
  - `GET /api/ai/status` → `{ available, type, model, classes,
    confidenceThreshold, reason }`.
  - `POST /api/ai/analyze-sonar` (multipart, field `image`) → structured
    result matching the spec's example shape exactly, including
    `summary.objectDetected`/`classification`/`confidence`.
  This is a synchronous, non-persisted **test** endpoint, deliberately
  separate from the existing survey/queue-based upload pipeline in
  `SonarController` (which stores frames, runs the domain-validity + queue
  pipeline, and is what Operator survey uploads actually use).

## 3. Backend — model quality gate (new)
`ModelVersion` schema gained `qualityState`:
`EXPERIMENTAL → VALIDATED → PRODUCTION_CANDIDATE → ACTIVE`.
- `ModelVersionsService.create()` auto-derives the initial state from
  whether real numeric metrics are present (never trusts a caller-supplied
  "VALIDATED" without evidence).
- `activate()` now refuses (`400 MODEL_NOT_READY`) to activate an
  `EXPERIMENTAL` model — only `VALIDATED`/`PRODUCTION_CANDIDATE` models
  (i.e., ones with real test-split metrics on file) can go live.
- New `POST /model-versions/:id/promote` (`VALIDATED` → `PRODUCTION_CANDIDATE`).
- This is non-breaking for the existing in-app lightweight-classifier
  training pipeline: it always computes real metrics synchronously after
  training, so those versions land as `VALIDATED` immediately, same
  activation flow as before.

## 4. Frontend
- `AiDetectorBadge` — polls `/api/ai/status` every 30s, renders an
  unambiguous "REAL ONNX MODEL" (green) vs "DEMO FALLBACK — NOT A TRAINED
  MODEL" (amber) badge. Placed in the sidebar footer, so it's visible on
  every page for both roles.
- New page `/ai-test` ("AI Model Test", in both Admin and Operator nav) —
  upload one image, see the actual annotated bounding boxes (drawn from
  real returned pixel coordinates, not fake), model name/type, status,
  confidence, object count, processing time, and an explicit uncertainty
  warning when nothing confident was found or when the fallback heuristic
  (not a trained model) produced the result.
- `AIModelsPage` — now shows each model's `qualityState` badge and a
  "Mark candidate" action; activation errors (e.g. attempting to activate
  an experimental/unevaluated model) are surfaced instead of failing
  silently.

## What this does NOT include, and why
- **No training was run.** No labelled dataset exists yet (see §1 above -
  the 15 supplied images are real but unlabeled). `ml/README.md` documents
  exactly what running `train.py` on them right now would report: 0
  labeled training images, so the pipeline would correctly refuse to train
  at all until annotation happens.
- **No `pip install` / Python execution was performed in this container.**
  No outbound network access here (confirmed via `npm`'s 403 in the prior
  session; the same restriction applies to `pip`). Every script was
  written and manually reviewed line-by-line but not executed.
- **No `npm ci` / `npm run build` was run**, same network restriction as
  the previous pass. See the Final Verification Report below.

---

## FINAL VERIFICATION REPORT

### PROJECT BUILD
Backend build: **NOT RUN** — outbound network access is disabled in this
container (`npm install` returns `403 Forbidden` against the registry, as
already observed in the prior session), so `npm ci` cannot fetch
dependencies and `npm run build` cannot be attempted. All edited/added
TypeScript files were manually reviewed (brace/paren balance checked
programmatically for every touched file; method signatures, imports, and
call sites cross-checked by hand against the existing codebase).
Frontend build: **NOT RUN** — same reason.

### MODEL
YOLO training: **NOT RUN** — no GPU and no Python execution available in
this container; also, no labelled dataset exists yet (0 annotated images),
so even if it were run it would correctly refuse to train (see `train.py`'s
guard).
Dataset images: **15** real side-scan sonar frames supplied by you
(`ml/dataset/raw/DM_Wilson_01.png` … `_15.png`), **0** currently labeled.
Classes: 9 configured in `ml/dataset/dataset.yaml` (`ghost_net,
fishing_gear, container, pipe, cylinder, shipwreck, marine_debris,
artificial_structure, unknown_anomaly`) — matched to the backend's
existing `DETECTION_CLASSES`. No class has any verified labelled example
yet.
Evaluation: **NOT RUN** — no trained checkpoint exists.
ONNX export: **NOT RUN** — no trained checkpoint exists.
ONNX loading: **NOT TESTED** — no exported file exists yet.
Inference test: **NOT TESTED** — same reason. (The existing
`placeholder-heuristic-v0` fallback in `ai-inference.service.ts` — unrelated
to this pipeline — is unchanged and continues to serve inference, clearly
labelled as a fallback via `GET /api/ai/status`.)

### APPLICATION
MongoDB: **NOT TESTED** — no running MongoDB instance in this container.
AI API (`GET /api/ai/status`, `POST /api/ai/analyze-sonar`): **NOT TESTED
end-to-end** (no running server) — code manually reviewed against
`AiInferenceService`'s actual method signatures and existing
`SonarController` multer/guard patterns for consistency.
Operator upload: **UNCHANGED / NOT RE-TESTED** this session (see prior
changelog for what was verified there).
Admin review: **UNCHANGED / NOT RE-TESTED** this session.
Batch prediction (`ml/scripts/batch_predict.py`): **NOT RUN** — no
exported ONNX model or Python environment available.

**Explicit statement per the spec's requirement:** every item above that
says NOT RUN / NOT TESTED is exactly that because this container has no
GPU, no outbound network access (so no `pip`/`npm install`), no running
MongoDB, and no labelled sonar dataset beyond the 15 unlabeled images
supplied. Nothing was marked PASS without actually being executed.

