"""
test_diversity.py - Evaluates class diversity of predictions on test set
and generates reports/prediction_distribution.json
"""
import os
import sys
import json
from pathlib import Path
from collections import Counter
from ultralytics import YOLO

ROOT = Path(__file__).resolve().parent.parent
MODEL_PATH = ROOT / "models" / "marinevision_yolo26x_best.pt"
TEST_IMAGES_DIR = ROOT / "datasets" / "test" / "images"
REPORTS_DIR = ROOT / "reports"

def main():
    print(f"Loading model from {MODEL_PATH}...")
    model = YOLO(str(MODEL_PATH))
    
    test_images = list(TEST_IMAGES_DIR.glob("*.png")) + list(TEST_IMAGES_DIR.glob("*.jpg"))
    print(f"Running inference on {len(test_images)} test images...")
    
    class_counts = Counter()
    total_detections = 0
    images_with_detections = 0
    
    for img_path in test_images:
        results = model.predict(source=str(img_path), imgsz=640, conf=0.25, verbose=False)
        r = results[0]
        if len(r.boxes) > 0:
            images_with_detections += 1
            for box in r.boxes:
                cls_id = int(box.cls[0])
                cls_name = model.names[cls_id].upper()
                class_counts[cls_name] += 1
                total_detections += 1
        else:
            class_counts["NO_ANOMALY_ROCK"] += 1
            
    print("\nPrediction Distribution across test images:")
    for cls_name, count in class_counts.most_common():
        print(f"  {cls_name}: {count}")
        
    out_file = REPORTS_DIR / "prediction_distribution.json"
    with open(out_file, "w") as f:
        json.dump(dict(class_counts), f, indent=2)
    print(f"\n[OK] Saved {out_file}")

if __name__ == "__main__":
    main()
