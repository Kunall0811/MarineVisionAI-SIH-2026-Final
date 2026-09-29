# SIH PS 26057 compliance snapshot

This repository is a research/engineering prototype. It intentionally distinguishes implemented architecture from capabilities that require a real labelled side-scan-sonar dataset and trained weights.

## Implemented / integrated
- React + TypeScript dashboard and Cesium 3D globe.
- NestJS backend with MongoDB persistence.
- Historical reference layer stored in MongoDB, with provenance and source URLs.
- Real ONNX Runtime inference path when a trained YOLO-family model is supplied.
- Explicit placeholder status when no trained model is available; no fabricated AI accuracy.
- Sonar preprocessing, dropout/quality handling, geolocation status, detection review, reporting and training/model management modules already present in the source tree.
- Historical globe navigation for shipwrecks, lost containers and marine debris.
- Historical reference filtering by type and MongoDB-backed retrieval.

## Requires external real data/model
- A validated labelled side-scan-sonar dataset.
- A trained YOLO-family sonar model exported to ONNX.
- Survey navigation/sensor metadata for survey-grade geolocation.
- Calibration data for calibrated probabilities and survey-grade dimensions.
- Validated raw XTF/JSF datasets if full parser coverage is required.

## Transparency rule
Historical reference points are displayed as `HISTORICAL_REFERENCE`; they must never be presented as current AI detections.
