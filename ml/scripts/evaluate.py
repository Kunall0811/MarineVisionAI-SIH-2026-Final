#!/usr/bin/env python3
"""
evaluate.py - evaluate a trained YOLO checkpoint against the TEST split
(never train/val) and write evaluation.json with the ACTUAL metrics
Ultralytics reports. If evaluation cannot run (missing weights, missing
test data), fields are `null` - never a fabricated number.

Usage:
    python scripts/evaluate.py --model results/marine_sonar_v1/weights/best.pt \
        --data dataset/dataset.yaml --name marine_sonar_v1
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from common import list_images, load_class_names


def null_result(model_path: str, dataset_name: str, reason: str) -> dict:
    return {
        "model": model_path,
        "dataset": dataset_name,
        "imagesTested": 0,
        "metrics": {"precision": None, "recall": None, "map50": None, "map50_95": None},
        "perClass": None,
        "evaluated": False,
        "reason": reason,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--data", default="dataset/dataset.yaml")
    ap.add_argument("--name", default="marine_sonar_v1")
    ap.add_argument("--out", default=None, help="Defaults to results/<name>/evaluation.json")
    args = ap.parse_args()

    model_path = Path(args.model)
    data_path = Path(args.data)
    out_path = Path(args.out) if args.out else Path("results") / args.name / "evaluation.json"

    if not model_path.exists():
        result = null_result(str(model_path), args.name, f"Model checkpoint not found at {model_path}.")
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(result, indent=2), encoding="utf-8")
        print(json.dumps(result, indent=2))
        print(f"\nEVALUATION NOT RUN - {result['reason']}")
        return

    class_names = load_class_names(data_path)
    test_images_dir = data_path.parent / "images" / "test"
    n_test_images = len(list_images(test_images_dir))
    if n_test_images == 0:
        result = null_result(str(model_path), args.name, f"No images found in TEST split ({test_images_dir}).")
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(result, indent=2), encoding="utf-8")
        print(json.dumps(result, indent=2))
        print(f"\nEVALUATION NOT RUN - {result['reason']}")
        return

    try:
        from ultralytics import YOLO
    except ImportError:
        result = null_result(str(model_path), args.name, "ultralytics not installed.")
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(result, indent=2), encoding="utf-8")
        print(json.dumps(result, indent=2))
        return

    model = YOLO(str(model_path))
    metrics = model.val(data=str(data_path), split="test")

    # Ultralytics DetMetrics exposes aggregate box metrics via .box
    box = metrics.box
    per_class = {}
    try:
        for i, name in class_names.items():
            if i < len(box.ap50):
                per_class[name] = {
                    "ap50": float(box.ap50[i]),
                    "ap": float(box.ap[i]) if hasattr(box, "ap") else None,
                }
    except Exception:
        per_class = None

    result = {
        "model": str(model_path),
        "dataset": args.name,
        "imagesTested": n_test_images,
        "metrics": {
            "precision": float(box.mp) if hasattr(box, "mp") else None,
            "recall": float(box.mr) if hasattr(box, "mr") else None,
            "map50": float(box.map50) if hasattr(box, "map50") else None,
            "map50_95": float(box.map) if hasattr(box, "map") else None,
        },
        "perClass": per_class,
        "evaluated": True,
        "reason": None,
    }

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result, indent=2))
    print(f"\nWritten to {out_path}")


if __name__ == "__main__":
    main()
