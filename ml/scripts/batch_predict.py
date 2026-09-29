#!/usr/bin/env python3
"""
batch_predict.py - run ONNX inference over every image in --source, writing
predictions.json and predictions.csv. Every image gets an entry, including
images with zero confident detections - none are silently dropped.

Usage:
    python scripts/batch_predict.py --model ../ai-models/marine-sonar.onnx \
        --source dataset/images/test --data dataset/dataset.yaml
"""
from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

from common import list_images, load_class_names
from predict import run_inference


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--source", required=True)
    ap.add_argument("--data", default="dataset/dataset.yaml")
    ap.add_argument("--conf", type=float, default=0.35)
    ap.add_argument("--out-json", default="predictions.json")
    ap.add_argument("--out-csv", default="predictions.csv")
    args = ap.parse_args()

    model_path = Path(args.model)
    source_dir = Path(args.source)
    images = list_images(source_dir)

    if not model_path.exists():
        print(f"MODEL NOT FOUND at {model_path}. Nothing to run.")
        payload = {"model": str(model_path), "status": "model_unavailable", "results": []}
        Path(args.out_json).write_text(json.dumps(payload, indent=2), encoding="utf-8")
        return

    if not images:
        print(f"No images found under {source_dir}.")
        return

    class_names = load_class_names(Path(args.data))
    results = []

    for img_path in images:
        try:
            detections, elapsed_ms = run_inference(model_path, img_path, class_names, args.conf)
            if detections:
                best = max(detections, key=lambda d: d["confidence"])
                status = "detected"
                classification = best["className"]
                confidence = best["confidence"]
            else:
                status = "no_confident_detection"
                classification = "unknown"
                confidence = 0.0
            entry = {
                "filename": img_path.name,
                "status": status,
                "classification": classification,
                "confidence": confidence,
                "detections": detections,
                "processingTimeMs": elapsed_ms,
            }
            summary = f"{classification} {confidence:.2f}" if detections else "no confident detection"
        except Exception as e:
            entry = {
                "filename": img_path.name,
                "status": "inference_error",
                "classification": None,
                "confidence": None,
                "detections": [],
                "processingTimeMs": None,
                "error": str(e),
            }
            summary = f"ERROR: {e}"

        results.append(entry)
        print(f"{img_path.name} -> {summary}")

    Path(args.out_json).write_text(
        json.dumps({"model": str(model_path), "source": str(source_dir), "count": len(results), "results": results}, indent=2),
        encoding="utf-8",
    )

    with open(args.out_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["filename", "status", "classification", "confidence", "numDetections", "processingTimeMs"])
        for r in results:
            writer.writerow(
                [r["filename"], r["status"], r["classification"], r["confidence"], len(r["detections"]), r["processingTimeMs"]]
            )

    n_detected = sum(1 for r in results if r["status"] == "detected")
    n_none = sum(1 for r in results if r["status"] == "no_confident_detection")
    n_err = sum(1 for r in results if r["status"] == "inference_error")
    print(f"\n{len(results)} images processed: {n_detected} detected, {n_none} no confident detection, {n_err} errors.")
    print(f"Written: {args.out_json}, {args.out_csv}")


if __name__ == "__main__":
    main()
