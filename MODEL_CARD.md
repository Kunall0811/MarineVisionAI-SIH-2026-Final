# Model Card: MarineVision AI YOLO26x Sonar Detector

## Model Details
- **Model Name**: MarineVision AI YOLO26x Extra-Large Sonar Detector
- **Model Version**: `marinevision-sss-v1`
- **Architecture**: Ultralytics YOLO26x deep convolutional object detector fine-tuned for dual-channel side-scan sonar acoustic waterfall imagery
- **Model Type**: Supervised Object Detector (Bounding Box Detection & Anomaly Classification)
- **Framework**: PyTorch 2.14 / Ultralytics 8.4 / ONNX Runtime 1.30
- **Model Artifacts**:
  - PyTorch Checkpoint: `models/marinevision_yolo26x_best.pt`
  - ONNX Model: `models/marinevision_yolo26x.onnx`
  - Production Deployment: `backend/ai-models/marine-yolo26x.onnx`

---

## Intended Use
- **Primary Use Case**: Automated detection, spatial bounding-box localization, and classification of anthropogenic debris, shipwrecks, artificial reefs, subsea conduits, and geological bedrock anomalies in marine side-scan sonar surveys.
- **Input Format**: Side-scan sonar waterfall imagery (single-channel acoustic backscatter intensity), normalized to 640×640 px or native survey swath resolution.
- **Outputs**:
  - Bounding box coordinates $[x_1, y_1, x_2, y_2]$ mapped to image pixels
  - Detected class label (e.g. `SHIPWRECK`, `ARTIFICIAL_STRUCTURE`, `ROCK`, `CONTAINER`, `DEBRIS`, `PIPE`)
  - Genuine detection confidence score $[0.00, 1.00]$ (reflecting acoustic contrast and shadow coherence)
  - Salient acoustic shadow analysis & downrange cast vector

---

## Target Classes
The model detects and distinguishes 8 genuine acoustic classes verified from sonar survey ground truth:
1. `shipwreck`: Submerged maritime hull structures, keel lines, rib frameworks, and coherent debris fields.
2. `artificial_structure`: Anthropogenic seabed installations, modular artificial reef modules, foundation jackets, and industrial barges.
3. `rock`: Natural geological bedrock outcrops, granite boulder fields, and seafloor sediment ripples.
4. `marine_debris`: Compact angular anthropogenic scrap, detached superstructure components, and aircraft wreckage.
5. `container`: Standard ISO rectangular freight containers with crisp 90° planar echo profiles.
6. `pipe`: Subsea pipelines and linear conduits with continuous parallel acoustic shadow traces.
7. `cylinder`: Cylindrical tanks, torpedoes, or industrial canisters.
8. `ghost_net`: Abandoned derelict fishing gear with diffuse, filamentous acoustic diffraction patterns.

---

## Training Data & Methodology
- **Dataset**: 430 verified de-duplicated side-scan sonar survey swaths from NOAA National Marine Sanctuaries collections.
- **Split**: 75% Training (321 frames), 15% Validation (64 frames), 10% Testing (44 frames) with strictly zero frame leakage.
- **Augmentation**: Sonar-physics-preserving conservative augmentations:
  - Horizontal flip (Port/Starboard towfish symmetry)
  - Small yaw rotation ($\pm 8^\circ$)
  - Scale variation ($\pm 15\%$)
  - Linear contrast/brightness stretch (HSV Value $\pm 25\%$)
  - Explicit prohibition of vertical flip (prevents inverting the physical nadir-to-shadow acoustic ray vector).
- **Optimization**: AdamW optimizer, cosine annealing learning rate schedule, early stopping based on validation mAP50.

---

## Evaluation Metrics (Held-Out Test Set: 45 Images, 100 Objects)
Evaluation is performed strictly on the unseen `datasets/test/` split:
- **Precision (P)**: 0.0676 (6.76%)
- **Recall (R)**: 0.1268 (12.68%)
- **F1-Score**: 0.0882
- **mAP@0.50**: 0.0425 (4.25%)
- **mAP@0.50:0.95**: 0.0169 (1.69%)
- **Inference Speed**: 34.1 ms inference / 41.3 ms total per frame on CPU (~24 FPS throughput).

*(Detailed per-class metrics and confusion matrix are saved in `reports/per_class_metrics.json` and `reports/confusion_matrix.png`.)*

---

## Limitations & Known Failure Cases
1. **Nadir Blind Zone**: Close to the center track (water column nadir), acoustic grazing angles are near $90^\circ$, causing acoustic washout and reduced shadow formation.
2. **Partial Sediment Burial**: Objects buried under $>0.5$ m of silt or sand produce weakened specular returns and faint acoustic shadows.
3. **Rough Bathymetric Clutter**: Highly rugged granite seafloors can cast irregular natural shadows that mimic fragmented debris fields.
4. **Confidence Distinction**: Detection confidence reflects acoustic contrast against local seabed ambient backscatter; it is not a statistical guarantee of object identity. Ground verification via ROV or diver inspection is recommended before maritime intervention.
