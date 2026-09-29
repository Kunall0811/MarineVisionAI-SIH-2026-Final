# AI-Powered Automated Underwater Marine Debris & Anomaly Detection System

> **SIH 2026 — Problem Statement 26057**

> **Theme:** Disaster Management

> **Category:** Software

An AI-powered **Side-Scan Sonar (SSS) image analysis platform** for detecting underwater marine debris and other man-made anomalies, distinguishing them from natural seabed formations, estimating confidence, geolocating detections, and generating actionable reports.

---

## 📌 Problem Statement

Underwater marine debris such as **ghost nets, pipes, cylinders, containers, shipwrecks and other man-made structures** can pose serious risks to marine biodiversity, coral reefs and vessel operations.

Side-Scan Sonar (SSS) is widely used to map the seafloor, but manually inspecting large volumes of sonar imagery is:

* Time-consuming
* Labor-intensive
* Prone to human error
* Difficult in noisy acoustic environments
* Challenging when artificial objects resemble natural seabed formations

The objective is to build an end-to-end AI system that can automatically analyze SSS imagery and convert detections into **geo-localized, confidence-scored and actionable anomaly information**.

---

# 💡 Our Solution

We developed a **Sonar-Aware AI pipeline** that combines computer vision with sonar-specific analysis.

```text
Side-Scan Sonar Image
          │
          ▼
   Image Ingestion
          │
          ▼
 Sonar Preprocessing
 ┌──────────────────────┐
 │ Grayscale            │
 │ Denoising            │
 │ Normalization        │
 │ Contrast Enhancement │
 │ Quality Assessment   │
 │ Dropout Analysis     │
 └──────────────────────┘
          │
          ▼
     AI Detection
          │
          ▼
 Acoustic Shadow Analysis
          │
          ▼
 Artificial vs Natural
      Assessment
          │
          ▼
 Confidence Fusion
          │
          ▼
 Sonar-Based Geolocation
          │
          ▼
 Human Verification
          │
          ▼
 GIS Dashboard
          │
          ▼
 PDF / CSV / JSON / GeoJSON
```

The key idea is to avoid relying only on raw object-detection confidence. The system also considers **acoustic-shadow evidence, sonar image quality and contextual information** before producing an actionable anomaly.

---

# 🚀 Key Features

### 🔍 AI-Based Object Detection

The system uses a YOLO-based object detection pipeline for identifying underwater objects and anomalies in Side-Scan Sonar imagery.

The deployment pipeline supports:

* PyTorch model
* ONNX model
* CPU inference
* Non-Maximum Suppression
* Confidence scoring
* Tiled inference

---

### 🌊 Sonar-Aware Preprocessing

The pipeline is designed specifically for acoustic imagery and includes:

* Grayscale conversion
* Median denoising
* Intensity normalization
* Contrast enhancement
* Sonar image quality assessment
* Dropout analysis
* Nadir-related processing
* Tiled image inference

---

### 🌑 Acoustic Shadow Analysis

Acoustic shadows are an important characteristic of sonar imagery.

The system analyzes relationships between:

```text
Bright Acoustic Highlight
          +
Dark Acoustic Shadow
          ↓
Potential Artificial Structure
```

Shadow-related evidence is combined with AI detection results to help distinguish artificial objects from natural seabed formations.

---

### 🧠 Artificial vs Natural Assessment

The system estimates:

* Artificial probability
* Natural probability
* Shadow score
* Noise score
* Model confidence
* Final confidence

This provides additional context beyond a conventional object detector.

---

### 📍 Sonar-Based Geolocation

When navigation metadata is available, detections can be localized using:

* Latitude
* Longitude
* Heading
* Sonar range
* Port/starboard information
* Depth
* Navigation source
* Detection position relative to the sonar nadir

The system distinguishes between:

```text
REAL
ESTIMATED
UNAVAILABLE
```

coordinates instead of fabricating a location when sufficient navigation information is unavailable.

---

### 📏 Object Dimension Estimation

The system estimates physical dimensions from sonar geometry and image coordinates.

These measurements are intended as **estimates for anomaly analysis**, rather than survey-grade measurements.

---

### 🗺️ GIS & Visualization

The web application provides visualization of detected anomalies using:

* Interactive maps
* GeoJSON
* GIS layers
* Sonar image overlays
* Cesium-based 3D visualization
* Detection details
* Survey information

---

### 👨‍🔬 Human-in-the-Loop Verification

Detected anomalies can be reviewed by a human operator.

Supported review states include:

```text
PENDING_REVIEW
VERIFIED
REJECTED
NEEDS_REVIEW
```

Review information can include:

* Reviewer
* Review timestamp
* Comments
* Verification status

This allows AI results to be validated before operational use.

---

### 📊 Automated Reporting

The system supports generation of:

* PDF reports
* CSV reports
* JSON reports
* GeoJSON reports

Reports can contain information such as:

```text
Detection
Class
Confidence
Artificial Probability
Natural Probability
Latitude
Longitude
Dimensions
Risk / Review Status
```

---

## 🏗️ System Architecture

```text
                    ┌──────────────────────┐
                    │ Side-Scan Sonar Data │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │ Image / Data Ingest  │
                    └──────────┬───────────┘
                               │
                               ▼
                 ┌──────────────────────────┐
                 │ Sonar Preprocessing      │
                 │ • Denoising              │
                 │ • Normalization          │
                 │ • Quality Assessment     │
                 │ • Dropout Detection      │
                 └────────────┬─────────────┘
                              │
                              ▼
                 ┌──────────────────────────┐
                 │ YOLO Object Detection    │
                 └────────────┬─────────────┘
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
          ┌─────────────────┐  ┌──────────────────┐
          │ Acoustic Shadow │  │ Sonar Context /  │
          │ Analysis        │  │ Quality Analysis │
          └────────┬────────┘  └────────┬─────────┘
                   │                    │
                   └─────────┬──────────┘
                             ▼
                 ┌──────────────────────────┐
                 │ Confidence Fusion        │
                 │ Artificial / Natural     │
                 │ Assessment               │
                 └────────────┬─────────────┘
                              │
                              ▼
                 ┌──────────────────────────┐
                 │ Geolocation & Dimensions │
                 └────────────┬─────────────┘
                              │
                              ▼
                 ┌──────────────────────────┐
                 │ Human Verification       │
                 └────────────┬─────────────┘
                              │
                              ▼
                 ┌──────────────────────────┐
                 │ GIS / Dashboard          │
                 └────────────┬─────────────┘
                              │
                              ▼
                 ┌──────────────────────────┐
                 │ Reports                  │
                 │ PDF / CSV / JSON / GeoJSON│
                 └──────────────────────────┘
```

---

## 🧠 AI Pipeline

```text
Input SSS Image
      ↓
Preprocessing
      ↓
Image Quality Check
      ↓
YOLO Detection
      ↓
NMS / Post-processing
      ↓
Acoustic Shadow Analysis
      ↓
Noise & Context Analysis
      ↓
Artificial / Natural Probability
      ↓
Confidence Fusion
      ↓
Geolocation
      ↓
Final Detection Record
```

---

## 🏷️ Detection Classes

The project architecture supports multiple marine-anomaly categories, including:

* Shipwreck
* Artificial Structure
* Rock
* Marine Debris
* Container
* Pipe
* Cylinder
* Ghost Net

### Dataset note

The final trained model's validated performance should be interpreted according to the **genuine labeled samples available for each class**. Classes without sufficient representative labeled sonar data should not be presented as fully validated detection classes.

---

## 📚 Dataset

The project uses labeled Side-Scan Sonar imagery for training and evaluation.

The dataset preparation pipeline supports:

* Image validation
* Annotation validation
* Duplicate detection
* Dataset splitting
* Class distribution analysis
* YOLO-format annotations
* Train/validation/test separation

The reduced submission version uses a **balanced representative subset** to satisfy deployment/submission size constraints while maintaining genuine labeled samples and preventing train/test leakage.

---

## 🏋️ Model Training

The project includes an existing YOLO training pipeline.

Training workflow:

```text
Dataset
   ↓
Dataset Validation
   ↓
Class Distribution Analysis
   ↓
Train / Validation / Test Split
   ↓
YOLO Training
   ↓
Validation
   ↓
Test Evaluation
   ↓
Best Model Selection
   ↓
ONNX Export
   ↓
ONNX Verification
   ↓
Deployment
```

Training can evaluate:

* Precision
* Recall
* F1 Score
* mAP@50
* mAP@50–95
* Per-class metrics

---

## ⚡ Edge / CPU Inference

The trained model can be exported to **ONNX** and executed through CPU inference.

This supports the project's goal of reducing dependency on heavy cloud infrastructure and provides a pathway toward resource-constrained marine platforms.

> Current CPU benchmarking should be interpreted as a software inference benchmark, not as proof of deployment on a specific AUV or marine drone hardware platform.

---

## 🖥️ Technology Stack

### AI / Machine Learning

* Python
* YOLO
* PyTorch
* ONNX
* ONNX Runtime
* OpenCV
* NumPy

### Backend

* NestJS & TypeScript
* In-Memory Store Architecture (Zero external database required)
* In-Process Async Queue (Zero Redis/BullMQ required)
* ONNX Runtime YOLO26x Inference
* WebSocket / Socket.IO Real-time Pipeline
* Local / Volume File Storage

### Frontend

* React
* TypeScript
* Interactive GIS maps
* Cesium 3D visualization

### Data & Geospatial

* GeoJSON
* Sonar navigation metadata
* Latitude / Longitude
* Heading
* Sonar range
* Depth information

### Deployment

* Docker
* ONNX Runtime
* CPU inference

---

## 📂 Project Structure

```text
MarineVision-AI/
│
├── ai-models/
│   └── Deployment AI models
│
├── backend/
│   ├── src/
│   │   └── modules/
│   │       ├── ai-inference/
│   │       ├── ai-training/
│   │       ├── sonar/
│   │       ├── geolocation/
│   │       ├── detections/
│   │       └── reports/
│   │
│   └── ai-models/
│
├── frontend/
│   └── React dashboard
│
├── models/
│   └── Trained model artifacts
│
├── datasets/
│   ├── train/
│   ├── val/
│   └── test/
│
├── training/
│   ├── train_yolo26x.py
│   ├── evaluate.py
│   ├── prepare_dataset.py
│   └── export_onnx.py
│
├── reports/
│   ├── metrics.json
│   ├── metrics.csv
│   ├── per_class_metrics.json
│   └── training reports
│
├── docs/
│
├── docker-compose.yml
├── MODEL_CARD.md
├── PS_COMPLIANCE.md
└── README.md
```

---

## 🔄 End-to-End Workflow

### 1. Upload

Operator uploads Side-Scan Sonar imagery/data.

### 2. Preprocessing

The system improves the sonar image and checks its quality.

### 3. Detection

The YOLO model identifies potential objects/anomalies.

### 4. Sonar-Aware Verification

Acoustic shadows, noise and contextual information are analyzed.

### 5. Confidence Fusion

The system combines AI and sonar evidence into a final confidence assessment.

### 6. Geolocation

Navigation metadata and sonar geometry are used to estimate the anomaly's geographic position.

### 7. Human Review

An operator can verify or reject the detection.

### 8. Visualization

The anomaly is displayed on the GIS dashboard.

### 9. Reporting

The operator can export structured anomaly reports.

---

## 🎯 Key Innovation

The project's primary innovation is not simply applying a generic object detector to sonar images.

It combines:

```text
AI Detection
      +
Sonar-Aware Preprocessing
      +
Acoustic Shadow Analysis
      +
Artificial vs Natural Assessment
      +
Confidence Fusion
      +
Geolocation
      +
Human Verification
      +
Actionable Reporting
```

### USP

> **From noisy Side-Scan Sonar imagery to actionable, geo-localized marine anomaly intelligence.**

---

## 🌊 Potential Applications

The system can support:

* Marine debris surveys
* Ghost-net identification workflows
* Underwater infrastructure inspection
* Shipwreck detection
* Seafloor anomaly surveys
* Marine environmental monitoring
* AUV-assisted surveys
* Research vessel surveys
* Coastal and marine management
* Disaster and emergency response

---

## 📈 Expected Benefits

### 🌊 Environmental Protection

Helps identify potential marine debris and underwater hazards more efficiently.

### ⚓ Safer Marine Operations

Can assist in identifying objects that may pose risks to vessels or underwater operations.

### ⏱️ Faster Survey Analysis

Automates parts of the manual sonar-image inspection process.

### 📍 Actionable Localization

Converts detections into geographically referenced anomaly information.

### 📊 Structured Decision Support

Provides confidence, classification and reporting information for human review.

### 🤖 Edge-Ready Architecture

ONNX-based inference provides a pathway toward resource-constrained deployment.

---

## ⚠️ Current Limitations

The project is designed as an AI-assisted sonar analysis system, and several limitations should be considered:

* Detection quality depends on the availability and diversity of labeled Side-Scan Sonar data.
* Rare marine-debris classes require representative labeled samples for reliable supervised training.
* Estimated object dimensions are not a substitute for survey-grade measurements.
* Geolocation quality depends on available navigation metadata.
* Full physical image-level compensation for all heave/pitch/roll effects is an area for further development.
* Production-grade parsing of every proprietary raw sonar-log format requires dedicated format-specific integration.
* AI predictions should be reviewed by qualified operators before operational decisions.

---

## 🔬 Future Scope

Future improvements can include:

* Larger multi-survey sonar datasets
* More representative ghost-net and marine-debris samples
* Cross-sensor/domain validation
* Improved rare-class detection
* Semantic segmentation
* Advanced motion compensation
* Native XTF/JSF processing
* Multi-sensor fusion
* Improved sonar geolocation
* AUV/edge-device deployment
* Continuous human-in-the-loop learning
* Active-learning based dataset expansion

---

## 🧪 Evaluation

The project includes an evaluation pipeline for measuring:

```text
Precision
Recall
F1 Score
mAP@50
mAP@50–95
Per-class performance
ONNX verification
Inference performance
```

Use the **latest generated metrics from the final reduced submission** here rather than hard-coding older model results.

Example:

| Metric        | Final Model |
| ------------- | ----------: |
| Precision     |       `XX%` |
| Recall        |       `XX%` |
| F1 Score      |       `XX%` |
| mAP@50        |       `XX%` |
| mAP@50–95     |       `XX%` |
| CPU Inference |     `XX ms` |

---

## 🏛️ System Architecture

MarineVision AI runs as a **lean, zero-external-database 2-service deployment**:

```text
                  Internet
                     │
                     ▼
          ┌────────────────────┐
          │      FRONTEND      │
          │    React + Vite    │
          │      Static        │
          └─────────┬──────────┘
                    │ HTTPS / WSS
                    ▼
          ┌────────────────────┐
          │      BACKEND       │
          │      NestJS        │
          │                    │
          │  REST API          │
          │  WebSockets        │
          │  Memory Store      │
          │  File Storage      │
          │  ONNX Inference    │
          │  AI Processing     │
          │  Training          │
          └────────────────────┘
```

### External Services Required
**None**. The application does NOT require MongoDB, MongoDB Atlas, Redis, BullMQ, Upstash, Supabase, or Firebase. All persistent entities run on a high-performance in-process memory store, and all background jobs (sonar frame processing, training) run via an in-process asynchronous queue.

### Data Persistence Model
* **Application State & Metadata:** Stored in-memory in the central `MemoryStore`. On server restart, demo data (users, surveys, NOAA historical references, verified anomalies) is automatically seeded cleanly.
* **Uploaded Files & AI Models:** Sonar frames, uploads, reports, and trained ONNX models are stored directly on the local filesystem under `STORAGE_LOCAL_PATH` (`backend/data`). On persistent platforms (e.g. Railway with volume or Docker with volume), mounting this folder preserves all media across restarts.

---

## 🔑 Pre-Seeded Demo Credentials

When the backend starts, demo accounts are automatically initialized:

| Role | Email | Password |
|---|---|---|
| **Admin** | `admin@marinevision.ai` | `Admin@12345` |
| **Operator** | `operator@marinevision.ai` | `Operator@12345` |
| **Demo User** | `demo@marinevision.ai` | `Demo@12345` |

---

## 🛠️ Local Development

### 1. Backend

```bash
cd backend
npm install
npm run start:dev
```

The backend starts at `http://localhost:4000` with Swagger docs at `http://localhost:4000/api/docs`.
No MongoDB or Redis instance is required!

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend starts at `http://localhost:5173`.

---

## 🌐 Production Deployment (2-Service Target)

Deploy the entire stack without database add-ons:

### 1. Frontend → Vercel / Netlify / Cloudflare Pages
* **Root Directory:** `frontend`
* **Build Command:** `npm run build`
* **Output Directory:** `dist`
* **Environment Variables:**
  * `VITE_API_URL`: `https://your-backend.railway.app/api`
  * `VITE_WS_HOST`: `your-backend.railway.app`

### 2. Backend → Railway / Render / DigitalOcean
* **Root Directory:** `backend`
* **Build Command:** `npm run build`
* **Start Command:** `npm run start:prod` (or `node dist/main.js`)
* **Environment Variables:**
  * `PORT`: `4000` (or assigned by host)
  * `NODE_ENV`: `production`
  * `CORS_ORIGIN`: `https://your-frontend.vercel.app`
  * `JWT_SECRET`: `your-strong-jwt-secret`
  * `JWT_REFRESH_SECRET`: `your-strong-refresh-secret`
  * `STORAGE_LOCAL_PATH`: `./data` (or mounted volume path `/data`)
  * `AUTO_SEED_DEMO`: `true`

---

## 🩺 Health Check

A dedicated health endpoint is provided for hosting platform health checks:

```http
GET /health
```

**Example Response:**
```json
{
  "status": "ok",
  "database": "not-required",
  "storage": "ready",
  "ai": "ready (onnx yolo26x)",
  "mode": "IN_MEMORY_STORE",
  "timestamp": "2026-09-29T00:30:00.000Z"
}
```

---

## 🐳 Docker Deployment

The project can be run locally using the 2-container Docker Compose setup:

```bash
docker compose up --build
```

This launches the static frontend on port 80 and the backend on port 4000 with persistent volume storage for media files, with zero database containers.

---

## 📊 Example Output

A detected anomaly can contain information such as:

```json
{
  "class": "marine_debris",
  "confidence": 87.4,
  "artificialProbability": 91.2,
  "naturalProbability": 8.8,
  "shadowScore": 84.6,
  "latitude": 16.XXXX,
  "longitude": 73.XXXX,
  "status": "PENDING_REVIEW"
}
```

> Example structure only; actual values are generated by the running system.

---

## 🏆 SIH 2026 Alignment: HIGH (~85%)

**Problem Statement:** SIH26057

**Title:** AI-Powered Automated Underwater Marine Debris and Anomaly Detection System using Side-Scan Sonar Imagery

| Requirement                      | Implementation |
| -------------------------------- | -------------- |
| SSS imagery processing           | ✅              |
| AI object detection              | ✅              |
| Sonar-aware preprocessing        | ✅              |
| Acoustic-shadow analysis         | ✅              |
| Artificial vs natural assessment | ✅              |
| Confidence scoring               | ✅              |
| Geolocation                      | ✅              |
| Dimension estimation             | ✅              |
| GIS visualization                | ✅              |
| Human verification               | ✅              |
| Realtime updates                 | ✅              |
| PDF/CSV/JSON/GeoJSON reports     | ✅              |
| ONNX inference                   | ✅              |
| Model evaluation                 | ✅              |
| Edge/CPU inference capability    | ✅              |

---

## 👥 Team

### TEAM HUSTLERS

**Smart India Hackathon 2026**

**Problem Statement:** 26057

**Theme:** Disaster Management

**Category:** Software

**Organization:** Ministry of Earth Sciences (MoES) 

---

## 📜 Disclaimer

This project is an AI-assisted marine sonar analysis system. AI-generated detections are intended to support human operators and should be validated before being used for safety-critical, environmental or operational decisions.

---

## ⭐ Project Vision

> **Making underwater sonar analysis faster, smarter and more actionable — from acoustic imagery to geo-localized marine intelligence.**

---

## 📄 License

This project is licensed under the MIT License.

