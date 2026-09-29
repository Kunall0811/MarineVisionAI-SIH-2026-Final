"""
Shared helpers for the MarineVision AI ml/ pipeline scripts.

Deliberately dependency-light (only stdlib + Pillow) so that
validate_dataset.py / prepare_dataset.py / split_dataset.py can run even
before `ultralytics`/`torch` are installed - only train.py, evaluate.py,
predict.py, batch_predict.py and export_onnx.py need the heavier deps.
"""
from __future__ import annotations

import hashlib
import json
import random
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

SEED = 1337  # fixed, documented seed -> deterministic, reproducible splits

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".tif", ".tiff"}


def set_seed(seed: int = SEED) -> None:
    random.seed(seed)
    try:
        import numpy as np

        np.random.seed(seed)
    except ImportError:
        pass


def sha256_of_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def is_readable_image(path: Path) -> bool:
    """Best-effort check that a file is a decodable raster image."""
    try:
        from PIL import Image

        with Image.open(path) as im:
            im.verify()
        return True
    except Exception:
        return False


def list_images(directory: Path) -> list[Path]:
    if not directory.exists():
        return []
    return sorted(
        p for p in directory.rglob("*") if p.suffix.lower() in IMAGE_EXTENSIONS and p.is_file()
    )


@dataclass
class YoloBox:
    class_id: int
    cx: float
    cy: float
    w: float
    h: float


@dataclass
class LabelValidationResult:
    path: Path
    boxes: list[YoloBox] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)

    @property
    def is_valid(self) -> bool:
        return len(self.errors) == 0


def load_class_names(dataset_yaml: Path) -> dict[int, str]:
    import yaml

    with open(dataset_yaml, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    names = data.get("names", {})
    # Ultralytics allows names as a list or a {id: name} mapping - normalize.
    if isinstance(names, list):
        return {i: n for i, n in enumerate(names)}
    return {int(k): v for k, v in names.items()}


def parse_yolo_label_file(path: Path, num_classes: int) -> LabelValidationResult:
    result = LabelValidationResult(path=path)
    if not path.exists():
        result.errors.append("MISSING_LABEL_FILE")
        return result

    text = path.read_text(encoding="utf-8").strip()
    if not text:
        # An empty label file is valid YOLO for "no objects in this image" -
        # not an error, just zero boxes.
        return result

    for line_no, line in enumerate(text.splitlines(), start=1):
        line = line.strip()
        if not line:
            continue
        parts = line.split()
        if len(parts) != 5:
            result.errors.append(f"line {line_no}: malformed (expected 5 fields, got {len(parts)})")
            continue
        try:
            class_id = int(parts[0])
            cx, cy, w, h = (float(x) for x in parts[1:])
        except ValueError:
            result.errors.append(f"line {line_no}: non-numeric field(s)")
            continue

        if not (0 <= class_id < num_classes):
            result.errors.append(f"line {line_no}: unknown class_id {class_id} (dataset has {num_classes} classes)")
        for name, v in (("center_x", cx), ("center_y", cy), ("width", w), ("height", h)):
            if v < 0 or v > 1:
                result.errors.append(f"line {line_no}: {name}={v} out of [0,1] range")
        if w <= 0 or h <= 0:
            result.errors.append(f"line {line_no}: non-positive width/height")

        result.boxes.append(YoloBox(class_id, cx, cy, w, h))

    return result


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, default=str)


def detect_device() -> str:
    """Detect CUDA / Apple MPS / CPU without assuming any are available."""
    try:
        import torch

        if torch.cuda.is_available():
            return "cuda"
        if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
            return "mps"
        return "cpu"
    except ImportError:
        return "cpu"
