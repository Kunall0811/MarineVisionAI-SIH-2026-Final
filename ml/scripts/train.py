#!/usr/bin/env python3
"""
train.py - train a YOLO object detector on the prepared dataset using
Ultralytics.

Honesty guards (per project requirements - do not remove):
  - Refuses to start if dataset/images/train has zero labeled images.
  - If the training set has fewer than --min-images-for-full-training
    images (default 200 - a floor for "might produce something
    directionally useful", still far below a real production dataset),
    the run is FORCED into --smoke-test mode: few epochs, and the output
    metadata + console output are explicitly labelled EXPERIMENTAL /
    SMOKE TEST, never "production model".
  - Never fabricates a device: probes torch for CUDA/MPS, else CPU, and
    prints which one it actually used.

Usage (PowerShell-friendly, same on bash):
    python scripts/train.py --data dataset/dataset.yaml --model yolo11n.pt \
        --epochs 100 --imgsz 640 --name marine_sonar_v1
"""
from __future__ import annotations

import argparse
import json
import platform
import sys
from datetime import datetime, timezone
from pathlib import Path

from common import detect_device, list_images, load_class_names, set_seed


def count_labeled_images(images_dir: Path, labels_dir: Path) -> int:
    n = 0
    for img in list_images(images_dir):
        if (labels_dir / f"{img.stem}.txt").exists():
            n += 1
    return n


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="dataset/dataset.yaml")
    ap.add_argument("--model", default="yolo11n.pt", help="Base weights: yolo11n.pt (nano) recommended for CPU")
    ap.add_argument("--epochs", type=int, default=100)
    ap.add_argument("--imgsz", type=int, default=640)
    ap.add_argument("--batch", type=int, default=8)
    ap.add_argument("--device", default=None, help="Override auto-detected device, e.g. 'cpu', '0'")
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--project", default="results")
    ap.add_argument("--name", default="marine_sonar_v1")
    ap.add_argument("--min-images-for-full-training", type=int, default=200)
    ap.add_argument("--force-full", action="store_true", help="Skip the smoke-test guard (not recommended)")
    args = ap.parse_args()

    set_seed()

    data_path = Path(args.data)
    dataset_root = data_path.parent
    class_names = load_class_names(data_path)
    train_images = dataset_root / "images" / "train"
    train_labels = dataset_root / "labels" / "train"
    n_labeled = count_labeled_images(train_images, train_labels)

    if n_labeled == 0:
        print("ERROR: no labeled training images found under", train_images)
        print("Run prepare_dataset.py, annotate, then split_dataset.py before training.")
        sys.exit(1)

    smoke_test = (not args.force_full) and (n_labeled < args.min_images_for_full_training)
    if smoke_test:
        print(f"⚠ Only {n_labeled} labeled training images found "
              f"(< {args.min_images_for_full_training} floor for a meaningful run).")
        print("⚠ Forcing SMOKE-TEST mode: this validates the pipeline end-to-end")
        print("⚠ (data loading -> train -> val -> checkpoint -> export) but the")
        print("⚠ resulting weights are EXPERIMENTAL and must not be treated as")
        print("⚠ production-ready or reported with a real accuracy figure.")
        args.epochs = min(args.epochs, 3)

    try:
        import torch
        from ultralytics import YOLO
    except ImportError:
        print("ERROR: ultralytics/torch not installed. Run: pip install -r requirements.txt")
        sys.exit(1)

    device = args.device or detect_device()
    print(f"Device: {device}  (auto-detected: {detect_device()})")
    if device == "cpu":
        print("⚠ Training on CPU - this will be slow. No GPU was detected/requested.")

    model = YOLO(args.model)
    start = datetime.now(timezone.utc)

    results = model.train(
        data=str(data_path),
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        device=device,
        workers=args.workers,
        project=args.project,
        name=args.name,
        seed=1337,
        exist_ok=True,
        # Sonar-appropriate augmentation only (see ml/README.md #7):
        # no vertical flip (would invert acoustic-shadow direction /
        # nadir geometry, changing physical meaning), mild rotation only.
        fliplr=0.5,
        flipud=0.0,
        degrees=5.0,
        translate=0.05,
        scale=0.2,
        shear=0.0,
        hsv_h=0.0,   # grayscale sonar - hue augmentation is meaningless
        hsv_s=0.0,
        hsv_v=0.3,   # ~ brightness/intensity variation, physically realistic
    )
    end = datetime.now(timezone.utc)

    run_dir = Path(args.project) / args.name
    weights_dir = run_dir / "weights"
    best_exists = (weights_dir / "best.pt").exists()

    metadata = {
        "status": "SMOKE_TEST_EXPERIMENTAL" if smoke_test else "TRAINED",
        "trainingTimestampUtc": start.isoformat(),
        "trainingCompletedUtc": end.isoformat(),
        "durationSeconds": (end - start).total_seconds(),
        "datasetYaml": str(data_path),
        "numTrainingImages": n_labeled,
        "classNames": [class_names[i] for i in sorted(class_names)],
        "baseModel": args.model,
        "epochsRequested": args.epochs,
        "imgsz": args.imgsz,
        "batch": args.batch,
        "device": device,
        "seed": 1337,
        "pythonVersion": platform.python_version(),
        "torchVersion": torch.__version__,
        "ultralyticsResultsDir": str(run_dir),
        "bestWeightsExist": best_exists,
        "smokeTestGuardTriggered": smoke_test,
        "minImagesForFullTraining": args.min_images_for_full_training,
        "note": (
            "SMOKE TEST ONLY - validates the pipeline runs end-to-end on a "
            "tiny dataset. Not evaluated for real accuracy, not production-"
            "ready. Add more labeled images and re-run without this guard "
            "(or above the floor) for a meaningful model."
            if smoke_test
            else "Full training run. Run evaluate.py against the TEST split "
            "before treating this as production-ready - epochs/dataset size "
            "alone do not guarantee good metrics."
        ),
    }
    (run_dir / "training_metadata.json").parent.mkdir(parents=True, exist_ok=True)
    with open(run_dir / "training_metadata.json", "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    print("\n--- train.py summary ---")
    print(json.dumps(metadata, indent=2))
    if not best_exists:
        print("\n⚠ best.pt was not found after training - check the Ultralytics log above for errors.")


if __name__ == "__main__":
    main()
