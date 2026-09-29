# AI Models

This folder is where the backend looks for a trained ONNX model
(`ONNX_MODEL_PATH`, default `./ai-models/marine-yolo-placeholder.onnx`).

## Current status

**No trained model ships with this project.** No labelled side-scan-sonar
dataset was available while building this repository, so there is nothing
honest to train on. The backend (`AiInferenceService`) checks this path at
startup:

- If a `.onnx` file exists here, it is loaded via `onnxruntime-node` and used
  for real inference (standard YOLO output layout: `[1, num_boxes, 5 +
  num_classes]`, decoded in `parseYoloOutput()`).
- If not, the service automatically falls back to a **placeholder heuristic
  detector** - a deterministic grid-contrast/acoustic-shadow analysis over
  the actual pixel data (via Sharp), NOT a trained neural network. Every API
  response and UI element built from it is labelled `modelVersion:
  "placeholder-heuristic-v0"` so it is never mistaken for a real AI result.

## How to add a real model

1. Assemble and label a side-scan-sonar dataset (bounding boxes per class:
   `ghost_net`, `fishing_gear`, `container`, `pipe`, `cylinder`, `shipwreck`,
   `marine_debris`, `artificial_structure`, `unknown_anomaly`).
2. Train a YOLO-family detector (YOLOv8n/s are good starting points for
   edge-deployable inference) using any framework you like - this can be
   done in Python completely outside the production application, per the
   project's "no Python in the backend" requirement.
3. Export the trained weights to ONNX (e.g. `model.export(format="onnx")`
   for Ultralytics YOLO).
4. Drop the resulting `.onnx` file into this folder (or point
   `ONNX_MODEL_PATH` at wherever you keep it) and set `AI_MODEL_VERSION` to
   a real version string, e.g. `marine-yolo-v1`.
5. Restart the backend. No other code changes are required unless your
   export uses a non-standard output tensor layout, in which case adjust
   `parseYoloOutput()` in `backend/src/modules/ai-inference/ai-inference.service.ts`.

## Why this matters

The project's own requirements explicitly forbid presenting fabricated
detections as real AI output. Rather than hard-code fake "AI confidence"
numbers to look impressive in a demo, this build keeps the full pipeline
(preprocessing -> inference -> shadow analysis -> geolocation -> risk
scoring -> MongoDB -> real-time UI) wired end-to-end and honestly labels the
one piece - a trained model - that requires real data this environment
didn't have access to.


## Large-image inference
The backend now supports overlapping tiled inference for large rasters. Tiles are restored to original-image coordinates and merged with NMS. This does not create a model: a real ONNX YOLO-family model is still required for genuine neural detections.
