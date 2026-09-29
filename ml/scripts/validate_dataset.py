#!/usr/bin/env python3
"""
validate_dataset.py - validates the already-split dataset under
dataset/images/{train,val,test} + dataset/labels/{train,val,test} against
the class list in dataset.yaml. Run this before training; train.py also
runs a lighter version of this check automatically and will refuse to
start if it fails.

Reports, per split:
  - images with a missing label file
  - images with an empty label file (0 objects - valid, but worth knowing)
  - malformed label files (bad field count, non-numeric)
  - out-of-range coordinates (negative, > 1)
  - non-positive width/height
  - unknown class ids
  - label files with no matching image

Exits non-zero if any hard error (malformed/out-of-range/unknown-class) is
found, so it can be used as a CI gate.

Usage:
    python scripts/validate_dataset.py --data dataset/dataset.yaml
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from common import list_images, load_class_names, parse_yolo_label_file, write_json


def validate_split(images_dir: Path, labels_dir: Path, num_classes: int) -> dict:
    images = list_images(images_dir)
    label_files = sorted(labels_dir.glob("*.txt")) if labels_dir.exists() else []
    image_stems = {p.stem for p in images}
    label_stems = {p.stem for p in label_files}

    missing_labels = sorted(image_stems - label_stems)
    orphan_labels = sorted(label_stems - image_stems)

    empty_label_images = []
    error_entries = []
    total_boxes = 0

    for img in images:
        label_path = labels_dir / f"{img.stem}.txt"
        if not label_path.exists():
            continue
        result = parse_yolo_label_file(label_path, num_classes)
        if result.errors:
            error_entries.append({"label": str(label_path), "errors": result.errors})
        elif not result.boxes:
            empty_label_images.append(str(img))
        else:
            total_boxes += len(result.boxes)

    return {
        "imagesDir": str(images_dir),
        "labelsDir": str(labels_dir),
        "imageCount": len(images),
        "labelFileCount": len(label_files),
        "missingLabels": missing_labels,
        "orphanLabels": orphan_labels,
        "emptyLabelImages": empty_label_images,
        "malformedOrInvalid": error_entries,
        "totalBoxes": total_boxes,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="dataset/dataset.yaml")
    ap.add_argument("--images-root", default="dataset/images")
    ap.add_argument("--labels-root", default="dataset/labels")
    ap.add_argument("--report", default="dataset_report.json")
    args = ap.parse_args()

    class_names = load_class_names(Path(args.data))
    results = {}
    hard_error = False

    for split in ("train", "val", "test"):
        r = validate_split(Path(args.images_root) / split, Path(args.labels_root) / split, len(class_names))
        results[split] = r
        print(f"\n=== {split.upper()} ===")
        print(f"Images: {r['imageCount']}  Label files: {r['labelFileCount']}  Object instances: {r['totalBoxes']}")
        if r["missingLabels"]:
            print(f"  MISSING annotation files: {len(r['missingLabels'])}")
            hard_error = True
        if r["orphanLabels"]:
            print(f"  ORPHAN labels (no matching image): {len(r['orphanLabels'])}")
        if r["emptyLabelImages"]:
            print(f"  Empty label files (0 objects, valid background images): {len(r['emptyLabelImages'])}")
        if r["malformedOrInvalid"]:
            print(f"  INVALID label files: {len(r['malformedOrInvalid'])}")
            for item in r["malformedOrInvalid"]:
                print(f"    - {item['label']}: {item['errors']}")
            hard_error = True

    write_json(Path(args.report), {"classes": class_names, "splits": results})
    print(f"\nFull report: {args.report}")

    if hard_error:
        print("\nVALIDATION FAILED - fix the errors above before training.")
        sys.exit(1)
    print("\nVALIDATION PASSED.")


if __name__ == "__main__":
    main()
