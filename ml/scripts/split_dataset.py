#!/usr/bin/env python3
"""
split_dataset.py - deterministic train/val/test split.

Only images in --processed that have a matching YOLO label file
(<stem>.txt, same rules as ultralytics: an empty file means "no objects",
a missing file means "not annotated yet") are eligible. Unlabeled images
are reported and skipped - they are never silently included as
background/negative examples, because that would be an assumption we
cannot verify.

Split is deterministic (fixed seed, see common.SEED) and by whole image
(no image's content appears in more than one split), matching the 70/10/20
style default below (overridable). NOT randomized per-run - reruns with an
unchanged input set reproduce the same split.

Usage:
    python scripts/split_dataset.py --processed dataset/processed \
        --labels dataset/processed --data dataset/dataset.yaml \
        --train 0.7 --val 0.2 --test 0.1
"""
from __future__ import annotations

import argparse
import random
import shutil
from pathlib import Path

from common import SEED, list_images, load_class_names, parse_yolo_label_file, write_json


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--processed", default="dataset/processed", help="Directory with normalized images")
    ap.add_argument("--labels", default="dataset/processed", help="Directory with <stem>.txt YOLO labels")
    ap.add_argument("--data", default="dataset/dataset.yaml")
    ap.add_argument("--images-out", default="dataset/images")
    ap.add_argument("--labels-out", default="dataset/labels")
    ap.add_argument("--train", type=float, default=0.7)
    ap.add_argument("--val", type=float, default=0.2)
    ap.add_argument("--test", type=float, default=0.1)
    ap.add_argument("--report", default="dataset_report.md")
    args = ap.parse_args()

    total = args.train + args.val + args.test
    if abs(total - 1.0) > 1e-6:
        raise SystemExit(f"--train/--val/--test must sum to 1.0, got {total}")

    class_names = load_class_names(Path(args.data))
    images = list_images(Path(args.processed))

    labeled, unlabeled = [], []
    class_counts = {name: 0 for name in class_names.values()}
    invalid_labels = []

    for img in images:
        label_path = Path(args.labels) / f"{img.stem}.txt"
        if not label_path.exists():
            unlabeled.append(str(img))
            continue
        result = parse_yolo_label_file(label_path, num_classes=len(class_names))
        if not result.is_valid:
            invalid_labels.append({"image": str(img), "label": str(label_path), "errors": result.errors})
            continue
        labeled.append((img, label_path, result.boxes))
        for box in result.boxes:
            class_counts[class_names[box.class_id]] += 1

    if unlabeled:
        print(f"[SKIPPED - UNLABELED] {len(unlabeled)} image(s) have no label file, excluded from split:")
        for u in unlabeled[:20]:
            print(f"  - {u}")
        if len(unlabeled) > 20:
            print(f"  ... and {len(unlabeled) - 20} more")

    if invalid_labels:
        print(f"\n[SKIPPED - INVALID LABELS] {len(invalid_labels)} image(s) have malformed labels:")
        for item in invalid_labels:
            print(f"  - {item['image']}: {item['errors']}")

    if not labeled:
        print("\nNo validly-labeled images available. Nothing to split.")
        print("Annotate images (see ml/README.md) before running this script again.")
        write_json(
            Path(args.report).with_suffix(".json"),
            {
                "totalProcessed": len(images),
                "labeled": 0,
                "unlabeled": len(unlabeled),
                "invalidLabels": len(invalid_labels),
                "splits": {},
            },
        )
        return

    rng = random.Random(SEED)
    shuffled = labeled[:]
    rng.shuffle(shuffled)

    n = len(shuffled)
    n_train = round(n * args.train)
    n_val = round(n * args.val)
    # remainder goes to test so counts always sum to n exactly
    splits = {
        "train": shuffled[:n_train],
        "val": shuffled[n_train : n_train + n_val],
        "test": shuffled[n_train + n_val :],
    }

    for split_name, items in splits.items():
        img_out = Path(args.images_out) / split_name
        lbl_out = Path(args.labels_out) / split_name
        img_out.mkdir(parents=True, exist_ok=True)
        lbl_out.mkdir(parents=True, exist_ok=True)
        # Clear any stale prior split output for this split only.
        for stale in list(img_out.glob("*")) + list(lbl_out.glob("*")):
            stale.unlink()
        for img, label_path, _boxes in items:
            shutil.copy2(img, img_out / img.name)
            shutil.copy2(label_path, lbl_out / f"{img.stem}.txt")

    per_split_class_counts = {}
    for split_name, items in splits.items():
        counts = {name: 0 for name in class_names.values()}
        for _img, _label, boxes in items:
            for box in boxes:
                counts[class_names[box.class_id]] += 1
        per_split_class_counts[split_name] = counts

    report_json = {
        "seed": SEED,
        "totalProcessed": len(images),
        "labeled": len(labeled),
        "unlabeled": len(unlabeled),
        "invalidLabels": len(invalid_labels),
        "splitRatios": {"train": args.train, "val": args.val, "test": args.test},
        "splitCounts": {k: len(v) for k, v in splits.items()},
        "classCountsOverall": class_counts,
        "classCountsPerSplit": per_split_class_counts,
    }
    write_json(Path(args.report).with_suffix(".json"), report_json)

    md_lines = [
        "## Dataset Summary",
        "",
        f"Images processed: {len(images)}",
        f"Labeled (used):   {len(labeled)}",
        f"Unlabeled (skipped): {len(unlabeled)}",
        f"Invalid labels (skipped): {len(invalid_labels)}",
        "",
        f"Training:   {len(splits['train'])}",
        f"Validation: {len(splits['val'])}",
        f"Testing:    {len(splits['test'])}",
        "",
        "Classes (object instances, all splits):",
    ]
    for name, count in class_counts.items():
        md_lines.append(f"{name}: {count}")
    Path(args.report).write_text("\n".join(md_lines) + "\n", encoding="utf-8")

    print("\n" + "\n".join(md_lines))
    print(f"\nReport written to {args.report} and {Path(args.report).with_suffix('.json')}")


if __name__ == "__main__":
    main()
