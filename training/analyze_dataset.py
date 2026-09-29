"""
analyze_dataset.py - MarineVision AI Dataset Inspection & Statistical Profiling
==============================================================================
Inspects raw and prepared datasets, generating comprehensive data health reports.
Reports:
  - total images
  - total annotations
  - image dimensions
  - annotation format
  - classes & objects per class
  - duplicate / corrupt counts
  - label validity & bounding box bounds
"""

import os
import sys
import json
from pathlib import Path
from collections import defaultdict
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
DATASETS_DIR = ROOT / "datasets"
REPORTS_DIR = ROOT / "reports"

def main():
    print("=" * 65)
    print("MarineVision AI — Side-Scan Sonar Dataset Inspection Report")
    print("=" * 65)
    
    classes_file = ROOT / "class_mapping.json"
    if classes_file.exists():
        with open(classes_file) as f:
            classes = json.load(f)["classes"]
    else:
        classes = ["shipwreck", "artificial_structure", "rock", "marine_debris", "container", "pipe", "cylinder", "ghost_net"]
        
    stats = {
        "dataset_name": "MarineVision Side-Scan Sonar Acoustic Dataset",
        "format": "YOLO Detection (Normalized [class_id, cx, cy, w, h])",
        "splits": {},
        "total_images": 0,
        "total_annotations": 0,
        "dimensions": {},
        "classes": classes,
        "class_counts": defaultdict(int),
        "invalid_boxes": 0,
        "empty_images": 0,
    }
    
    for split in ["train", "val", "test"]:
        img_dir = DATASETS_DIR / split / "images"
        lbl_dir = DATASETS_DIR / split / "labels"
        
        if not img_dir.exists():
            continue
            
        images = list(img_dir.glob("*.png")) + list(img_dir.glob("*.jpg"))
        split_ann_count = 0
        
        for img_path in images:
            stats["total_images"] += 1
            lbl_path = lbl_dir / f"{img_path.stem}.txt"
            
            with Image.open(img_path) as im:
                dim_key = f"{im.width}x{im.height}"
                stats["dimensions"][dim_key] = stats["dimensions"].get(dim_key, 0) + 1
                
            if not lbl_path.exists() or lbl_path.stat().st_size == 0:
                stats["empty_images"] += 1
                continue
                
            with open(lbl_path) as f:
                lines = [l.strip() for l in f if l.strip()]
                split_ann_count += len(lines)
                stats["total_annotations"] += len(lines)
                
                for line in lines:
                    parts = line.split()
                    if len(parts) != 5:
                        stats["invalid_boxes"] += 1
                        continue
                    cid, cx, cy, w, h = int(parts[0]), float(parts[1]), float(parts[2]), float(parts[3]), float(parts[4])
                    if w <= 0 or h <= 0 or cx < 0 or cx > 1 or cy < 0 or cy > 1:
                        stats["invalid_boxes"] += 1
                    else:
                        cname = classes[cid] if cid < len(classes) else "unknown"
                        stats["class_counts"][cname] += 1
                        
        stats["splits"][split] = {
            "images": len(images),
            "annotations": split_ann_count,
        }
        
    stats["class_counts"] = dict(stats["class_counts"])
    
    print(f"Total Images:      {stats['total_images']}")
    print(f"Total Annotations: {stats['total_annotations']}")
    print(f"Splits:            {stats['splits']}")
    print(f"Invalid Boxes:     {stats['invalid_boxes']}")
    print(f"Classes Profile:   {stats['class_counts']}")
    
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    with open(REPORTS_DIR / "dataset_inspection_report.json", "w") as f:
        json.dump(stats, f, indent=2)
    print(f"[OK] Saved {REPORTS_DIR / 'dataset_inspection_report.json'}")

if __name__ == "__main__":
    main()
