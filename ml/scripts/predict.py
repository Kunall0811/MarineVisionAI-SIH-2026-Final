#!/usr/bin/env python3
"""
predict.py - ONNX smoke test on a single real image: load model, load
image, preprocess, run inference, decode boxes, apply confidence threshold
+ NMS, print structured JSON. Mirrors exactly what the Node backend's
ai-inference.service.ts does with an ONNX model, so you can sanity-check a
freshly exported model before wiring it into the app.

Usage:
    python scripts/predict.py --model ../ai-models/marine-sonar.onnx \
        --image dataset/images/test/<some_image>.jpg --data dataset/dataset.yaml
"""
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

from common import load_class_names


def nms(boxes, scores, iou_threshold=0.45):
    import numpy as np

    if len(boxes) == 0:
        return []
    boxes = np.array(boxes, dtype=np.float64)
    scores = np.array(scores, dtype=np.float64)
    x1, y1, x2, y2 = boxes[:, 0], boxes[:, 1], boxes[:, 2], boxes[:, 3]
    areas = (x2 - x1) * (y2 - y1)
    order = scores.argsort()[::-1]
    keep = []
    while order.size > 0:
        i = order[0]
        keep.append(int(i))
        xx1 = np.maximum(x1[i], x1[order[1:]])
        yy1 = np.maximum(y1[i], y1[order[1:]])
        xx2 = np.minimum(x2[i], x2[order[1:]])
        yy2 = np.minimum(y2[i], y2[order[1:]])
        w = np.maximum(0.0, xx2 - xx1)
        h = np.maximum(0.0, yy2 - yy1)
        inter = w * h
        iou = inter / (areas[i] + areas[order[1:]] - inter + 1e-9)
        remaining = np.where(iou <= iou_threshold)[0]
        order = order[remaining + 1]
    return keep


def run_inference(model_path: Path, image_path: Path, class_names: dict, conf_threshold: float, imgsz: int = 640):
    import numpy as np
    import onnxruntime as ort
    from PIL import Image

    t0 = time.time()
    session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
    input_name = session.get_inputs()[0].name

    im = Image.open(image_path).convert("RGB")
    orig_w, orig_h = im.size
    resized = im.resize((imgsz, imgsz))
    arr = np.asarray(resized, dtype=np.float32) / 255.0
    arr = arr.transpose(2, 0, 1)[None, ...]  # NCHW

    outputs = session.run(None, {input_name: arr})
    raw = outputs[0]
    # Ultralytics ONNX export shape: (1, 4+num_classes, num_boxes) - transpose to (num_boxes, 4+num_classes)
    if raw.ndim == 3 and raw.shape[1] < raw.shape[2]:
        raw = raw[0].transpose(1, 0)
    else:
        raw = raw[0]

    boxes_xyxy, scores, class_ids = [], [], []
    for row in raw:
        cx, cy, w, h = row[:4]
        class_scores = row[4:]
        class_id = int(np.argmax(class_scores))
        conf = float(class_scores[class_id])
        if conf < conf_threshold:
            continue
        x1 = (cx - w / 2) / imgsz * orig_w
        y1 = (cy - h / 2) / imgsz * orig_h
        x2 = (cx + w / 2) / imgsz * orig_w
        y2 = (cy + h / 2) / imgsz * orig_h
        boxes_xyxy.append([x1, y1, x2, y2])
        scores.append(conf)
        class_ids.append(class_id)

    keep = nms(boxes_xyxy, scores)
    detections = []
    for i in keep:
        x1, y1, x2, y2 = boxes_xyxy[i]
        detections.append(
            {
                "classId": class_ids[i],
                "className": class_names.get(class_ids[i], "unknown_anomaly"),
                "confidence": round(scores[i], 4),
                "bbox": {
                    "x": round(x1),
                    "y": round(y1),
                    "width": round(x2 - x1),
                    "height": round(y2 - y1),
                },
            }
        )

    elapsed_ms = round((time.time() - t0) * 1000, 1)
    return detections, elapsed_ms


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--image", required=True)
    ap.add_argument("--data", default="dataset/dataset.yaml")
    ap.add_argument("--conf", type=float, default=0.35)
    args = ap.parse_args()

    model_path = Path(args.model)
    image_path = Path(args.image)

    if not model_path.exists():
        print(json.dumps({"status": "model_unavailable", "message": f"No ONNX model at {model_path}"}, indent=2))
        return
    if not image_path.exists():
        print(json.dumps({"status": "invalid_image", "message": f"No file at {image_path}"}, indent=2))
        return

    try:
        import onnxruntime  # noqa: F401
        import PIL  # noqa: F401
    except ImportError:
        print(json.dumps({"status": "inference_error", "message": "onnxruntime/Pillow not installed",
                           "errorCode": "DEPENDENCY_MISSING"}, indent=2))
        return

    class_names = load_class_names(Path(args.data))

    try:
        detections, elapsed_ms = run_inference(model_path, image_path, class_names, args.conf)
    except Exception as e:
        print(json.dumps({"status": "inference_error", "message": str(e), "errorCode": "INFERENCE_ERROR"}, indent=2))
        return

    result = {
        "image": image_path.name,
        "model": str(model_path),
        "processingTimeMs": elapsed_ms,
        "status": "detected" if detections else "no_confident_detection",
        "detections": detections,
    }
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
