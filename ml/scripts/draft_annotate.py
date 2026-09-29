#!/usr/bin/env python3
"""
draft_annotate.py - proposes CANDIDATE bounding boxes on raw/processed sonar
images using a deterministic contrast/shadow heuristic (same family of
signal as the backend's placeholder detector), so a human annotator has a
starting point instead of a blank canvas.

THESE ARE NOT GROUND TRUTH LABELS. Every output box is tagged
"source": "heuristic-contact-proposal-v1" and a confidence, and is written
to dataset/raw_annotations_draft/ - a location split_dataset.py never reads
from. A human must review each proposal in an annotation tool (CVAT,
Roboflow, LabelImg, etc.), keep/fix/discard boxes, and save the corrected
result into dataset/processed/<image>.txt (YOLO format) before it is
eligible to be split into the trained dataset. This mirrors the
Operator-upload -> AI-inference -> Admin-review -> corrected-label ->
training-dataset workflow used by the rest of the application.

The heuristic: downsample to grayscale, tile into cells, flag cells whose
local contrast (max-min) and standard deviation both exceed the image's own
background statistics by a margin - i.e. "brighter/darker than the
surrounding seabed by more than noise alone would explain" - then merge
adjacent flagged cells into candidate boxes. It has no notion of object
*identity*, so every proposal is written with class_id defaulting to the
dataset's "unknown_anomaly" class (or --default-class), leaving
classification entirely to the human reviewer.

Usage:
    python scripts/draft_annotate.py --images dataset/processed \
        --out dataset/raw_annotations_draft --data dataset/dataset.yaml
"""
from __future__ import annotations

import argparse
from pathlib import Path

from common import list_images, load_class_names, write_json


def propose_boxes(gray, cell: int = 48, z_thresh: float = 2.2):
    """gray: 2D list/array of ints. Returns list of (x0,y0,x1,y1,score) in pixel coords."""
    import numpy as np

    arr = np.asarray(gray, dtype=np.float64)
    h, w = arr.shape
    global_mean = arr.mean()
    global_std = arr.std() + 1e-6

    flags = np.zeros((h // cell + 1, w // cell + 1), dtype=bool)
    scores = np.zeros_like(flags, dtype=np.float64)

    for gy, y in enumerate(range(0, h, cell)):
        for gx, x in enumerate(range(0, w, cell)):
            tile = arr[y : y + cell, x : x + cell]
            if tile.size < (cell * cell) // 3:
                continue
            tile_mean = tile.mean()
            z = abs(tile_mean - global_mean) / global_std
            contrast = tile.max() - tile.min()
            if z > z_thresh and contrast > 60:
                flags[gy, gx] = True
                scores[gy, gx] = min(1.0, z / (z_thresh * 2))

    # Merge adjacent flagged cells (simple flood fill) into boxes.
    visited = np.zeros_like(flags)
    boxes = []
    gh, gw = flags.shape
    for gy in range(gh):
        for gx in range(gw):
            if not flags[gy, gx] or visited[gy, gx]:
                continue
            stack = [(gy, gx)]
            visited[gy, gx] = True
            cells = []
            while stack:
                cy, cx = stack.pop()
                cells.append((cy, cx))
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < gh and 0 <= nx < gw and flags[ny, nx] and not visited[ny, nx]:
                        visited[ny, nx] = True
                        stack.append((ny, nx))
            ys = [c[0] for c in cells]
            xs = [c[1] for c in cells]
            x0, x1 = min(xs) * cell, min((max(xs) + 1) * cell, w)
            y0, y1 = min(ys) * cell, min((max(ys) + 1) * cell, h)
            score = float(np.mean([scores[c] for c in cells]))
            # Skip implausibly huge regions (background gradients, not contacts).
            if (x1 - x0) * (y1 - y0) > 0.35 * w * h:
                continue
            boxes.append((x0, y0, x1, y1, score))

    return boxes


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--images", default="dataset/processed")
    ap.add_argument("--out", default="dataset/raw_annotations_draft")
    ap.add_argument("--data", default="dataset/dataset.yaml")
    ap.add_argument("--default-class", default="unknown_anomaly")
    args = ap.parse_args()

    try:
        from PIL import Image
        import numpy as np  # noqa: F401
    except ImportError as e:
        raise SystemExit(
            "draft_annotate.py requires Pillow and numpy (pip install -r requirements.txt)"
        ) from e

    class_names = load_class_names(Path(args.data))
    name_to_id = {v: k for k, v in class_names.items()}
    default_class_id = name_to_id.get(args.default_class, max(class_names) if class_names else 0)

    images = list_images(Path(args.images))
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    summary = []
    for img_path in images:
        with Image.open(img_path) as im:
            im = im.convert("L")
            w, h = im.size
            # Downscale long survey strips for speed; boxes are rescaled back.
            scale = min(1.0, 1600 / max(w, h))
            small = im.resize((max(1, int(w * scale)), max(1, int(h * scale))))
            gray = list(small.getdata())
            gray2d = [gray[i * small.width : (i + 1) * small.width] for i in range(small.height)]

        boxes_px = propose_boxes(gray2d)
        lines = []
        proposals = []
        for x0, y0, x1, y1, score in boxes_px:
            # rescale back to original resolution, then normalize
            X0, Y0, X1, Y1 = x0 / scale, y0 / scale, x1 / scale, y1 / scale
            cx, cy = (X0 + X1) / 2 / w, (Y0 + Y1) / 2 / h
            bw, bh = (X1 - X0) / w, (Y1 - Y0) / h
            lines.append(f"{default_class_id} {cx:.6f} {cy:.6f} {bw:.6f} {bh:.6f}")
            proposals.append(
                {
                    "classId": default_class_id,
                    "className": args.default_class,
                    "bboxPixels": {"x0": round(X0), "y0": round(Y0), "x1": round(X1), "y1": round(Y1)},
                    "heuristicScore": round(score, 3),
                    "source": "heuristic-contact-proposal-v1",
                    "verified": False,
                }
            )

        label_path = out_dir / f"{img_path.stem}.txt"
        label_path.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")
        meta_path = out_dir / f"{img_path.stem}.draft.json"
        write_json(meta_path, {"image": str(img_path), "proposals": proposals, "verified": False})

        summary.append({"image": str(img_path), "proposalCount": len(proposals)})
        print(f"{img_path.name}: {len(proposals)} candidate region(s) proposed (UNVERIFIED)")

    write_json(out_dir / "_summary.json", {"totalImages": len(images), "results": summary})
    print(f"\nWrote {len(images)} draft annotation file(s) to {out_dir}")
    print("These are UNVERIFIED heuristic proposals, not ground truth.")
    print("Review them in an annotation tool, then save corrected YOLO labels")
    print("into dataset/processed/<image-stem>.txt before running split_dataset.py.")


if __name__ == "__main__":
    main()
