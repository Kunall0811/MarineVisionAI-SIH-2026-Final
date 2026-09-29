#!/usr/bin/env python3
"""
export_onnx.py - export a trained YOLO checkpoint to ONNX and verify the
result actually loads with ONNX Runtime before reporting success.

Usage:
    python scripts/export_onnx.py --model results/marine_sonar_v1/weights/best.pt \
        --out ../ai-models/marine-sonar.onnx
"""
from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--out", default="models/marine-sonar.onnx")
    ap.add_argument("--imgsz", type=int, default=640)
    ap.add_argument("--opset", type=int, default=12)
    ap.add_argument("--dynamic", action="store_true", default=True)
    args = ap.parse_args()

    model_path = Path(args.model)
    if not model_path.exists():
        print(f"ERROR: checkpoint not found at {model_path}. Train a model first (scripts/train.py).")
        sys.exit(1)

    try:
        from ultralytics import YOLO
    except ImportError:
        print("ERROR: ultralytics not installed. Run: pip install -r requirements.txt")
        sys.exit(1)

    model = YOLO(str(model_path))
    exported_path = model.export(format="onnx", imgsz=args.imgsz, opset=args.opset, dynamic=args.dynamic)
    exported_path = Path(exported_path)

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    if exported_path.resolve() != out_path.resolve():
        shutil.copy2(exported_path, out_path)

    if not out_path.exists():
        print(f"EXPORT FAILED - no file at {out_path} after export.")
        sys.exit(1)

    # Verify ONNX Runtime can actually load it - do not report success otherwise.
    try:
        import onnx
        import onnxruntime as ort

        onnx_model = onnx.load(str(out_path))
        onnx.checker.check_model(onnx_model)

        session = ort.InferenceSession(str(out_path), providers=["CPUExecutionProvider"])
        input_info = session.get_inputs()[0]
        output_info = session.get_outputs()[0]
        print("ONNX EXPORT: SUCCESS")
        print(f"  File:   {out_path} ({out_path.stat().st_size / 1e6:.1f} MB)")
        print(f"  Input:  {input_info.name} {input_info.shape} {input_info.type}")
        print(f"  Output: {output_info.name} {output_info.shape} {output_info.type}")
        print("\nONNX Runtime loaded the model successfully (structural check + checker.check_model passed).")
        print(f"\nCopy or point ONNX_MODEL_PATH at: {out_path}")
    except ImportError:
        print(f"Export produced {out_path}, but onnx/onnxruntime are not installed so it could NOT be")
        print("verified to load. Install them (pip install -r requirements.txt) and re-run to confirm.")
        sys.exit(1)
    except Exception as e:
        print(f"ONNX EXPORT: FILE WRITTEN BUT FAILED TO LOAD/VALIDATE: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
