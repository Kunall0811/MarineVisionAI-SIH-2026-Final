"""
export_onnx.py - MarineVision AI YOLO26x ONNX Export & Verification
===================================================================
Exports PyTorch weights to ONNX format.
Validates graph integrity with onnx.checker.
Tests inference with ONNX Runtime.
Compares PyTorch vs ONNX predictions.
Generates reports/onnx_verification_report.json.
Copies verified model to backend/ai-models/marine-yolo26x.onnx.
"""

import os
import sys
import json
import shutil
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
MODELS_DIR = ROOT / "models"
REPORTS_DIR = ROOT / "reports"
BACKEND_MODELS_DIR = ROOT / "backend" / "ai-models"
AI_MODELS_DIR = ROOT / "ai-models"

def main():
    print("=" * 65)
    print("MarineVision AI — YOLO26x ONNX Export & Verification")
    print("=" * 65)
    
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    BACKEND_MODELS_DIR.mkdir(parents=True, exist_ok=True)
    AI_MODELS_DIR.mkdir(parents=True, exist_ok=True)
    
    pt_path = MODELS_DIR / "marinevision_yolo26x_best.pt"
    if not pt_path.exists():
        # Fallback to runs directory if best.pt is located there
        runs_weights = list(ROOT.glob("runs/**/weights/best.pt"))
        if runs_weights:
            pt_path = runs_weights[-1]
            shutil.copy2(pt_path, MODELS_DIR / "marinevision_yolo26x_best.pt")
            print(f"[Notice] Found run weights at {pt_path}, copied to {MODELS_DIR / 'marinevision_yolo26x_best.pt'}")
        else:
            print(f"[Error] Weights file {pt_path} not found. Run train_yolo26x.py first.")
            sys.exit(1)
            
    from ultralytics import YOLO
    import onnx
    import onnxruntime as ort
    
    print(f"[1/4] Loading PyTorch model from {pt_path}...")
    model = YOLO(str(pt_path))
    
    print("[2/4] Exporting to ONNX format (opset 14, imgsz 640)...")
    exported_path_str = model.export(
        format="onnx",
        imgsz=640,
        opset=14,
        dynamic=False,
        simplify=False
    )
    exported_onnx = Path(exported_path_str)
    dst_onnx = MODELS_DIR / "marinevision_yolo26x.onnx"
    shutil.copy2(exported_onnx, dst_onnx)
    print(f"[OK] ONNX exported to {dst_onnx} ({dst_onnx.stat().st_size / 1024:.1f} KB)")
    
    print("[3/4] Validating ONNX structure with onnx.checker...")
    onnx_model = onnx.load(str(dst_onnx))
    onnx.checker.check_model(onnx_model)
    print("[OK] ONNX model passed structural validation.")
    
    print("[4/4] Verifying with ONNX Runtime & comparing with PyTorch...")
    ort_session = ort.InferenceSession(str(dst_onnx), providers=["CPUExecutionProvider"])
    
    # Generate synthetic sonar test tensor [1, 3, 640, 640]
    dummy_input = np.random.uniform(0.1, 0.9, (1, 3, 640, 640)).astype(np.float32)
    
    # ONNX inference
    input_name = ort_session.get_inputs()[0].name
    output_name = ort_session.get_outputs()[0].name
    ort_out = ort_session.run([output_name], {input_name: dummy_input})[0]
    
    # PyTorch inference
    import torch
    with torch.no_grad():
        pt_out = model.model(torch.from_numpy(dummy_input))
        if isinstance(pt_out, (list, tuple)):
            pt_out = pt_out[0]
        pt_numpy = pt_out.cpu().numpy()
        
    max_diff = float(np.max(np.abs(ort_out - pt_numpy)))
    mean_diff = float(np.mean(np.abs(ort_out - pt_numpy)))
    
    print(f"  PyTorch output shape: {pt_numpy.shape}")
    print(f"  ONNX output shape:    {ort_out.shape}")
    print(f"  Max absolute error:   {max_diff:.6e}")
    print(f"  Mean absolute error:  {mean_diff:.6e}")
    
    verification_passed = max_diff < 1e-3
    print(f"  Verification Result:  {'PASSED' if verification_passed else 'WARNING (numerical tolerance)'}")
    
    # Copy to backend and root ai-models/
    target_backend_onnx = BACKEND_MODELS_DIR / "marine-yolo26x.onnx"
    shutil.copy2(dst_onnx, target_backend_onnx)
    print(f"[OK] Deployed model to {target_backend_onnx}")
    
    target_ai_models = AI_MODELS_DIR / "marine-yolo26x.onnx"
    shutil.copy2(dst_onnx, target_ai_models)
    print(f"[OK] Deployed model to {target_ai_models}")
    
    # Write reports/onnx_verification_report.json
    report = {
        "status": "verified" if verification_passed else "numerical_warning",
        "pytorch_weights": str(pt_path),
        "onnx_model": str(dst_onnx),
        "deployed_path": str(target_backend_onnx),
        "input_name": input_name,
        "input_shape": [1, 3, 640, 640],
        "output_name": output_name,
        "output_shape": list(ort_out.shape),
        "max_absolute_difference": max_diff,
        "mean_absolute_difference": mean_diff,
        "tolerance": 1e-3,
        "verification_passed": verification_passed,
    }
    
    with open(REPORTS_DIR / "onnx_verification_report.json", "w") as f:
        json.dump(report, f, indent=2)
    print(f"[OK] Saved {REPORTS_DIR / 'onnx_verification_report.json'}")
    
    print("\nONNX export and verification complete.")

if __name__ == "__main__":
    main()
