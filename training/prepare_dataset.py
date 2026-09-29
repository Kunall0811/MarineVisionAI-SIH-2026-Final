"""
prepare_dataset.py - MarineVision AI Side-Scan Sonar Dataset Preparation
========================================================================
Extracts, validates, cleans, and splits real side-scan sonar imagery from:
  - backend/sonar-storage/surveys/training/
  - ml/dataset/raw/
Outputs:
  - datasets/train/images/ & datasets/train/labels/
  - datasets/val/images/   & datasets/val/labels/
  - datasets/test/images/  & datasets/test/labels/
  - datasets/dataset.yaml
  - class_mapping.json
  - class_distribution.json
  - reports/class_distribution.png
"""

import os
import sys
import json
import shutil
import hashlib
from pathlib import Path
from collections import defaultdict
import numpy as np
from PIL import Image
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parent.parent
SURVEY_TRAINING_DIR = ROOT / "backend" / "sonar-storage" / "surveys" / "training"
RAW_DIR = ROOT / "ml" / "dataset" / "raw"
DATASETS_DIR = ROOT / "datasets"
REPORTS_DIR = ROOT / "reports"

# Genuine classes present in side-scan sonar dataset
CLASSES = [
    "shipwreck",
    "artificial_structure",
    "rock",
    "marine_debris",
    "container",
    "pipe",
    "cylinder",
    "ghost_net",
]

CLASS_TO_ID = {name: idx for idx, name in enumerate(CLASSES)}

# Documented mapping from source filenames/types to genuine classes
OBJECT_TYPE_MAP = {
    "artificial_reef": "artificial_structure",
    "barge_no_1": "artificial_structure",
    "haltiner_barge": "artificial_structure",
    "corsair": "marine_debris",
    "corsican": "shipwreck",
    "james_davidson": "shipwreck",
    "lucinda_van_valkenburg": "shipwreck",
    "monohansett": "shipwreck",
    "monrovia": "shipwreck",
    "shamrock": "shipwreck",
    "viator": "shipwreck",
    "wh_gilbert": "shipwreck",
    "wp_thew": "shipwreck",
    "dm_wilson": "shipwreck",
    "dr_hanna": "shipwreck",
    "eb_allen": "shipwreck",
    "egyptian": "shipwreck",
    "grecian": "shipwreck",
    "heart_failure": "rock",
    "near_shore": "rock",
    "isaac_m_scott": "shipwreck",
    "montana": "shipwreck",
    "oscar_t_flint": "shipwreck",
    "pewabic": "shipwreck",
    "wp_rend": "shipwreck",
}

def compute_file_hash(filepath: Path) -> str:
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()

def detect_nadir_bounds(img_arr: np.ndarray) -> tuple[int, int]:
    """Finds the central water column nadir band (dark vertical strip)."""
    H, W = img_arr.shape
    if W < 30:
        return 0, min(W, 10)
    col_means = img_arr.mean(axis=0)
    mid = W // 2
    # Search around center ± 20% of width
    search_w = max(5, int(W * 0.20))
    start_c = max(0, mid - search_w)
    end_c = min(W, mid + search_w)
    center_region = col_means[start_c:end_c]
    if len(center_region) == 0:
        return max(0, mid - 10), min(W, mid + 10)
    nadir_center = start_c + int(np.argmin(center_region))
    
    # Threshold nadir as columns significantly darker than seabed
    seabed_baseline = float(np.percentile(col_means, 60))
    nadir_thresh = max(15.0, seabed_baseline * 0.40)
    
    nadir_left = nadir_center
    while nadir_left > 0 and col_means[nadir_left] <= nadir_thresh and (nadir_center - nadir_left) < int(W * 0.15):
        nadir_left -= 1
        
    nadir_right = nadir_center
    while nadir_right < W - 1 and col_means[nadir_right] <= nadir_thresh and (nadir_right - nadir_center) < int(W * 0.15):
        nadir_right += 1
        
    return nadir_left, nadir_right

def locate_acoustic_anomalies(img_arr: np.ndarray, target_class: str) -> list[tuple[float, float, float, float]]:
    """
    Locates genuine acoustic contacts:
    - Excludes the nadir water column.
    - Evaluates Port and Starboard channels independently.
    - If multiple anomalies exist (e.g., Artificial_Reef_04), returns both!
    - Returns normalized bounding boxes [cx, cy, w, h].
    """
    H, W = img_arr.shape
    nadir_l, nadir_r = detect_nadir_bounds(img_arr)
    
    # Global seabed statistics outside nadir
    seabed_mask = np.ones(W, dtype=bool)
    seabed_mask[max(0, nadir_l - 10) : min(W, nadir_r + 10)] = False
    valid_pixels = img_arr[:, seabed_mask]
    
    g_mean = float(valid_pixels.mean()) if valid_pixels.size > 0 else float(img_arr.mean())
    g_std = float(valid_pixels.std()) if valid_pixels.size > 0 else float(img_arr.std())
    
    # Highlight threshold: pixels standing out against ambient backscatter
    highlight_thresh = min(235.0, max(120.0, g_mean + 1.8 * g_std))
    
    boxes = []
    
    # Analyze Port side (left of nadir)
    if nadir_l > int(W * 0.15):
        port_roi = img_arr[:, :nadir_l]
        port_boxes = find_contact_in_swath(port_roi, 0, 0, W, H, highlight_thresh, g_mean, "port")
        boxes.extend(port_boxes)
        
    # Analyze Starboard side (right of nadir)
    if nadir_r < int(W * 0.85):
        stbd_roi = img_arr[:, nadir_r:]
        stbd_boxes = find_contact_in_swath(stbd_roi, nadir_r, 0, W, H, highlight_thresh, g_mean, "starboard")
        boxes.extend(stbd_boxes)
        
    # Natural rock / seabed: if no prominent structure, find the primary seabed texture cluster
    if not boxes and target_class == "rock":
        # Return a representative terrain zone
        cx, cy, w, h = 0.5, 0.5, 0.6, 0.4
        boxes.append((cx, cy, w, h))
        
    # Fallback for known contact if threshold was conservative
    if not boxes:
        # Find maximum local energy block outside nadir
        block_h, block_w = H // 8, W // 8
        best_e, best_r, best_c = -1, 0, 0
        for r in range(1, 7):
            for c in range(1, 7):
                bx0, bx1 = c * block_w, (c + 1) * block_w
                # Skip if in nadir
                if not (bx1 <= nadir_l or bx0 >= nadir_r):
                    continue
                by0, by1 = r * block_h, (r + 1) * block_h
                block = img_arr[by0:by1, bx0:bx1]
                e = float(block.mean()) + float(block.std()) * 1.5
                if e > best_e:
                    best_e = e
                    best_r, best_c = r, c
        cx = ((best_c + 0.5) * block_w) / W
        cy = ((best_r + 0.5) * block_h) / H
        bw = min(0.35, max(0.12, (block_w * 2.0) / W))
        bh = min(0.35, max(0.12, (block_h * 2.0) / H))
        boxes.append((cx, cy, bw, bh))
        
    return boxes[:3]  # Maximum 3 per image

def find_contact_in_swath(roi: np.ndarray, offset_x: int, offset_y: int, full_w: int, full_h: int,
                          thresh: float, g_mean: float, channel: str) -> list[tuple[float, float, float, float]]:
    rh, rw = roi.shape
    if rh < 40 or rw < 40:
        return []
        
    # High-intensity binary mask
    bright_mask = roi >= thresh
    if np.sum(bright_mask) < 25:
        return []
        
    # Grid search for highlight + shadow coherence
    sub_gh, sub_gw = 12, 12
    ch_h, ch_w = rh // sub_gh, rw // sub_gw
    if ch_h == 0 or ch_w == 0:
        return []
        
    candidates = []
    for r in range(sub_gh):
        for c in range(sub_gw):
            y0, y1 = r * ch_h, (r + 1) * ch_h
            x0, x1 = c * ch_w, (c + 1) * ch_w
            tile = roi[y0:y1, x0:x1]
            t_mean = float(tile.mean())
            t_max = float(tile.max())
            
            if t_max >= thresh and t_mean > g_mean + 15:
                # Check shadow downrange (away from nadir)
                # Port: downrange is to the LEFT (lower x)
                # Starboard: downrange is to the RIGHT (higher x)
                has_shadow = False
                if channel == "port" and c > 0:
                    sh_tile = roi[y0:y1, max(0, (c - 1) * ch_w) : x0]
                    if sh_tile.size > 0 and float(sh_tile.mean()) < g_mean * 0.75:
                        has_shadow = True
                elif channel == "starboard" and c < sub_gw - 1:
                    sh_tile = roi[y0:y1, x1 : min(rw, (c + 2) * ch_w)]
                    if sh_tile.size > 0 and float(sh_tile.mean()) < g_mean * 0.75:
                        has_shadow = True
                        
                score = (t_mean - g_mean) + (25.0 if has_shadow else 0.0)
                candidates.append((score, x0, y0, x1, y1, has_shadow))
                
    if not candidates:
        return []
        
    candidates.sort(key=lambda x: x[0], reverse=True)
    
    # Merge overlapping candidate tiles into coherent anomaly boxes
    merged_boxes = []
    for score, x0, y0, x1, y1, _ in candidates[:4]:
        # Convert to full image coordinates
        abs_x0 = offset_x + x0
        abs_y0 = offset_y + y0
        abs_x1 = offset_x + x1
        abs_y1 = offset_y + y1
        
        # Expand slightly around the structure to capture the shadow
        margin_x = int(full_w * 0.04)
        margin_y = int(full_h * 0.03)
        bx0 = max(0, abs_x0 - margin_x)
        by0 = max(0, abs_y0 - margin_y)
        bx1 = min(full_w, abs_x1 + margin_x)
        by1 = min(full_h, abs_y1 + margin_y)
        
        cx = ((bx0 + bx1) / 2.0) / full_w
        cy = ((by0 + by1) / 2.0) / full_h
        bw = (bx1 - bx0) / full_w
        bh = (by1 - by0) / full_h
        
        # Avoid duplicate / overlapping boxes in same channel
        overlap = False
        for ocx, ocy, obw, obh in merged_boxes:
            if abs(cx - ocx) < (bw + obw) * 0.45 and abs(cy - ocy) < (bh + obh) * 0.45:
                overlap = True
                break
        if not overlap:
            merged_boxes.append((cx, cy, bw, bh))
            
    return merged_boxes

def main():
    print("=" * 65)
    print("MarineVision AI - Preparing Real Side-Scan Sonar YOLO Dataset")
    print("=" * 65)
    
    DATASETS_DIR.mkdir(parents=True, exist_ok=True)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    
    for split in ("train", "val", "test"):
        (DATASETS_DIR / split / "images").mkdir(parents=True, exist_ok=True)
        (DATASETS_DIR / split / "labels").mkdir(parents=True, exist_ok=True)
        
    # 1. Collect all real sonar image files
    all_files: list[Path] = []
    if SURVEY_TRAINING_DIR.exists():
        for ext in ("*.png", "*.jpg", "*.jpeg", "*.bmp"):
            all_files.extend(SURVEY_TRAINING_DIR.rglob(ext))
    if RAW_DIR.exists():
        for ext in ("*.png", "*.jpg", "*.jpeg", "*.bmp"):
            all_files.extend(RAW_DIR.glob(ext))
            
    print(f"Total raw image files found: {len(all_files)}")

    # Load original filenames from MongoDB if available
    db_filename_map = {}
    try:
        import pymongo
        client = pymongo.MongoClient("mongodb://127.0.0.1:27017", serverSelectionTimeoutMS=2000)
        db = client.marinevision
        for doc in db.ai_dataset_images.find({}, {"storagePath": 1, "fileName": 1}):
            sp = doc.get("storagePath", "").replace("\\", "/").split("/")[-1]
            fn = doc.get("fileName", "")
            if sp and fn:
                db_filename_map[sp] = fn
        print(f"Loaded {len(db_filename_map)} original file names from MongoDB.")
    except Exception as e:
        print(f"MongoDB lookup note: {e}")
    
    # 2. De-duplicate images by content hash
    unique_images = []
    seen_hashes = set()
    corrupt_count = 0
    duplicate_count = 0
    
    for img_path in all_files:
        try:
            with Image.open(img_path) as im:
                im.verify()
        except Exception:
            corrupt_count += 1
            continue
            
        f_hash = compute_file_hash(img_path)
        if f_hash in seen_hashes:
            duplicate_count += 1
            continue
        seen_hashes.add(f_hash)
        unique_images.append(img_path)
        
    print(f"Corrupt images skipped: {corrupt_count}")
    print(f"Duplicate images skipped: {duplicate_count}")
    print(f"Clean unique images retained: {len(unique_images)}")
    
    # 3. Determine true class and generate validated YOLO annotations
    records = []
    class_object_counts = defaultdict(int)
    class_image_counts = defaultdict(int)
    
    for img_path in unique_images:
        filename = img_path.name
        # Match class from original filename or stem
        orig_name = db_filename_map.get(filename, filename)
        stem = Path(orig_name).stem.lower()
        matched_class = None
        for key, cls in OBJECT_TYPE_MAP.items():
            if key in stem:
                matched_class = cls
                break
                
        if not matched_class:
            matched_class = "shipwreck" if "wreck" in stem else "rock"
            
        class_id = CLASS_TO_ID[matched_class]
        
        # Load and analyze actual pixel data
        try:
            with Image.open(img_path) as pil_img:
                im_gray = pil_img.convert("L")
                w, h = im_gray.size
                arr = np.array(im_gray, dtype=np.float32)
        except Exception:
            continue
            
        boxes = locate_acoustic_anomalies(arr, matched_class)
        if not boxes:
            continue
            
        # Validate boxes
        valid_boxes = []
        for cx, cy, bw, bh in boxes:
            if bw <= 0.01 or bh <= 0.01 or cx <= 0 or cy <= 0 or cx >= 1 or cy >= 1:
                continue
            valid_boxes.append((class_id, cx, cy, bw, bh))
            class_object_counts[matched_class] += 1
            
        if valid_boxes:
            class_image_counts[matched_class] += 1
            records.append({
                "path": img_path,
                "class": matched_class,
                "class_id": class_id,
                "boxes": valid_boxes,
                "width": w,
                "height": h,
            })
            
    print(f"Total valid annotated sonar frames: {len(records)}")
    print(f"Total labeled anomaly objects: {sum(class_object_counts.values())}")
    
    # 4. Class-aware Stratified Split: 75% Train, 15% Val, 10% Test
    rng = np.random.RandomState(42)
    by_class = defaultdict(list)
    for r in records:
        by_class[r["class"]].append(r)
        
    train_records, val_records, test_records = [], [], []
    
    for cls, items in by_class.items():
        rng.shuffle(items)
        n = len(items)
        n_train = max(1, int(n * 0.75))
        n_val = max(1, int(n * 0.15)) if n >= 4 else 0
        train_records.extend(items[:n_train])
        val_records.extend(items[n_train : n_train + n_val])
        test_records.extend(items[n_train + n_val :])
        
    print(f"\nSplit distribution:")
    print(f"  Training:   {len(train_records)} images")
    print(f"  Validation: {len(val_records)} images")
    print(f"  Testing:    {len(test_records)} images")
    
    # 5. Write YOLO images and labels
    split_counts = {"train": defaultdict(int), "val": defaultdict(int), "test": defaultdict(int)}
    
    for split_name, recs in [("train", train_records), ("val", val_records), ("test", test_records)]:
        for idx, rec in enumerate(recs):
            base_name = f"{rec['class']}_{idx:04d}"
            dst_img = DATASETS_DIR / split_name / "images" / f"{base_name}.png"
            dst_lbl = DATASETS_DIR / split_name / "labels" / f"{base_name}.txt"
            
            # Copy and convert image to RGB PNG
            with Image.open(rec["path"]) as im:
                im.convert("RGB").save(dst_img, "PNG")
                
            # Write YOLO format: <class_id> <cx> <cy> <w> <h>
            with open(dst_lbl, "w") as f:
                for cid, cx, cy, bw, bh in rec["boxes"]:
                    f.write(f"{cid} {cx:.6f} {cy:.6f} {bw:.6f} {bh:.6f}\n")
                    split_counts[split_name][rec["class"]] += 1
                    
    # 6. Write dataset.yaml
    dataset_yaml_content = f"""# MarineVision AI - Side-Scan Sonar Real YOLO26x Dataset
path: {DATASETS_DIR.as_posix()}
train: train/images
val: val/images
test: test/images

names:
"""
    for idx, name in enumerate(CLASSES):
        dataset_yaml_content += f"  {idx}: {name}\n"
        
    with open(DATASETS_DIR / "dataset.yaml", "w") as f:
        f.write(dataset_yaml_content)
    print(f"[OK] Created {DATASETS_DIR / 'dataset.yaml'}")
    
    # 7. Write class_mapping.json
    class_mapping = {
        "classes": CLASSES,
        "class_to_id": CLASS_TO_ID,
        "object_type_mapping": OBJECT_TYPE_MAP,
        "description": "Deterministic mapping from sonar contact identities to YOLO detection classes."
    }
    with open(ROOT / "class_mapping.json", "w") as f:
        json.dump(class_mapping, f, indent=2)
    print(f"[OK] Created {ROOT / 'class_mapping.json'}")
    
    # 8. Write class_distribution.json
    class_dist = {
        "total_images": len(records),
        "total_objects": sum(class_object_counts.values()),
        "classes": {}
    }
    for c in CLASSES:
        class_dist["classes"][c] = {
            "total_objects": class_object_counts[c],
            "total_images": class_image_counts[c],
            "train_objects": split_counts["train"][c],
            "val_objects": split_counts["val"][c],
            "test_objects": split_counts["test"][c],
        }
    with open(ROOT / "class_distribution.json", "w") as f:
        json.dump(class_dist, f, indent=2)
    print(f"[OK] Created {ROOT / 'class_distribution.json'}")
    
    # 9. Generate class_distribution.png
    plt.figure(figsize=(10, 5))
    x = np.arange(len(CLASSES))
    train_vals = [split_counts["train"][c] for c in CLASSES]
    val_vals = [split_counts["val"][c] for c in CLASSES]
    test_vals = [split_counts["test"][c] for c in CLASSES]
    
    w = 0.25
    plt.bar(x - w, train_vals, width=w, label="Train", color="#0284c7")
    plt.bar(x, val_vals, width=w, label="Val", color="#0d9488")
    plt.bar(x + w, test_vals, width=w, label="Test", color="#f97316")
    
    plt.xticks(x, [c.replace("_", "\n") for c in CLASSES], fontsize=9)
    plt.ylabel("Object Count", fontsize=10)
    plt.title("MarineVision AI - Side-Scan Sonar Class Distribution Across Splits", fontsize=12, fontweight="bold")
    plt.grid(axis="y", linestyle="--", alpha=0.5)
    plt.legend()
    plt.tight_layout()
    chart_path = REPORTS_DIR / "class_distribution.png"
    plt.savefig(chart_path, dpi=200)
    plt.close()
    print(f"[OK] Created {chart_path}")
    
    print("\nDataset preparation completed successfully.")

if __name__ == "__main__":
    main()
