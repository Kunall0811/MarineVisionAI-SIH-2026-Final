# MarineVision AI — SIH26057 workflow

```text
SSS / AUV / ROV imagery
        |
        v
[Ingestion]
PNG/JPG/TIFF + navigation CSV
XTF/JSF registration (validated raw parser required before claiming production parsing)
        |
        v
[Sonar preprocessing]
rotate -> grayscale -> median 3x3 -> normalize -> 640x640
large frames -> overlapping tiles -> NMS
        |
        +----------------------+
        |                      |
        v                      v
[AI detector]             [Image quality]
YOLO-family ONNX           dropout / saturation /
bounding boxes             quality score
        |                      |
        +----------+-----------+
                   v
[Confidence + noise/shadow fusion]
artificial probability + acoustic shadow + noise score
                   |
                   v
[Geotagging]
navigation CSV / ping metadata
-> REAL / ESTIMATED / UNAVAILABLE
                   |
                   v
[MongoDB]
surveys
sonar_frames
detections
historical_references
datasets / dataset_images
training_jobs / model_versions
FRIDAY interactions / audit logs
                   |
          +--------+--------+
          |                 |
          v                 v
[Cesium 3D globe]       [Reports]
live AI detections      CSV / JSON / GeoJSON / PDF
historical references
Titanic heritage point
5-year 2021–2025 layer
ghost-net / fishing-gear regional evidence
containers / wrecks / debris
                   |
                   v
             [FRIDAY]
typed command
voice recording
    -> ElevenLabs Scribe v2 STT
    -> intent + permissions
    -> command execution
    -> ElevenLabs female TTS
    -> spoken response
```

## 1000+ image benchmark workflow

1. Admin creates a labelled dataset in MongoDB.
2. Select 1,000+ images in one browser action.
3. For a single-class batch, choose the label.
4. For multi-class bulk upload, select a directory whose first-level folder names exactly match the dataset classes.
5. Frontend uploads in bounded chunks to prevent browser/server RAM exhaustion.
6. Dataset is split 70/15/15 (train/validation/test).
7. Training job extracts features from real uploaded pixels and trains on TRAIN.
8. Accuracy, precision, recall, macro-F1, per-class support, confusion matrix and latency are computed on held-out VAL/TEST images.
9. Metrics are stored in MongoDB and shown in Training Job Detail.
10. mAP is intentionally `N/A` for the built-in whole-image classifier. For actual object-detection mAP, provide a trained YOLO ONNX model plus bounding-box annotations.

## Data integrity rules

- Historical references are never presented as current AI detections.
- Historical records contain source URL, source organization, year and coordinate accuracy.
- Demo accounts are MongoDB users.
- FRIDAY destructive operations require confirmation.
- ElevenLabs API credentials remain server-side.
- No live secrets are included in this package.
