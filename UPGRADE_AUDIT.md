# UPGRADE_AUDIT.md

## Repository audit performed
The uploaded repository already contained React/Cesium, NestJS/MongoDB, authentication/RBAC, sonar upload/queueing, ONNX inference hooks, geolocation, detections, reports, training/model pages, realtime updates and a globe.

## Added in this upgrade
1. MongoDB-backed `historical_references` collection.
2. Idempotent historical-data seed command.
3. Cesium historical reference layer with type filtering.
4. Searchable/clickable historical evidence panel with source provenance.
5. Documented real historical coordinates from NOAA public records.
6. Explicit `HISTORICAL_REFERENCE` status so historical records cannot be confused with AI detections.
7. Sonar image quality/dropout assessment persisted per frame.
8. Heave/pitch/roll/altitude navigation fields and CSV ingestion.
9. Motion-correction status (`FULL`, `PARTIAL`, `UNAVAILABLE`) based on available metadata.
10. Large-image tiled inference path with coordinate restoration and NMS.
11. Explicit refusal to process XTF/JSF as raster data without a validated raw-log parser.
12. Documentation for PS compliance, demo flow and historical-data provenance.

## Important limitation
The repository does not contain a validated labelled side-scan-sonar dataset or a trained sonar YOLO ONNX model. Therefore the project does not claim real YOLO performance, mAP, precision, recall or scientific detection capability until such a model/dataset is supplied.

The existing placeholder heuristic remains clearly labelled. It is not presented as a trained neural network.

## Build validation
Dependency installation/build could not be completed in this execution environment because `npm ci` exceeded the available tool transport timeout. Source changes were written and the repository structure was preserved. Run `npm ci && npm run build` in `backend` and `npm ci && npm run build` in `frontend` on the development machine.
