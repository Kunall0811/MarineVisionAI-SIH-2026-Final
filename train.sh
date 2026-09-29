#!/usr/bin/env bash
# ========================================================
# MarineVision AI - Side-Scan Sonar ML Training Pipeline
# ========================================================
set -e

echo "========================================================"
echo "MarineVision AI - Side-Scan Sonar ML Training Pipeline"
echo "========================================================"

PYTHON_BIN="python"
if command -v python3 &> /dev/null; then
    PYTHON_BIN="python3"
fi

echo ""
echo "[1/4] Preparing and validating side-scan sonar dataset..."
$PYTHON_BIN training/prepare_dataset.py

echo ""
echo "[2/4] Profiling dataset statistics and class distribution..."
$PYTHON_BIN training/analyze_dataset.py

echo ""
echo "[3/4] Fine-tuning YOLO26x model on sonar dataset..."
$PYTHON_BIN training/train_yolo26x.py --epochs 10 --imgsz 640

echo ""
echo "[4/4] Exporting to ONNX and verifying runtime output..."
$PYTHON_BIN training/export_onnx.py

echo ""
echo "========================================================"
echo "Training and deployment complete! Model is active."
echo "========================================================"
