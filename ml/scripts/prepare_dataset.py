#!/usr/bin/env python3
"""
prepare_dataset.py - scan ml/dataset/raw/, validate every file, dedup by
content hash, and copy the survivors into ml/dataset/processed/ with a
normalized filename. Does NOT invent labels and does NOT move anything into
images/{train,val,test} - that only happens in split_dataset.py, and only
for images that already have a corresponding YOLO label file (see
draft_annotate.py / your annotation tool for how labels get created).

Usage:
    python scripts/prepare_dataset.py --raw dataset/raw --out dataset/processed
"""
from __future__ import annotations

import argparse
import shutil
from pathlib import Path

from common import IMAGE_EXTENSIONS, is_readable_image, list_images, sha256_of_file, write_json


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", default="dataset/raw")
    ap.add_argument("--out", default="dataset/processed")
    ap.add_argument("--report", default="dataset_report.json")
    args = ap.parse_args()

    raw_dir = Path(args.raw)
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    candidates = list_images(raw_dir)
    seen_hashes: dict[str, Path] = {}
    kept: list[dict] = []
    corrupted: list[str] = []
    duplicates: list[dict] = []

    if not candidates:
        print(f"No images found under {raw_dir}. Nothing to do.")
        write_json(
            Path(args.report),
            {"rawDir": str(raw_dir), "totalFound": 0, "kept": 0, "corrupted": 0, "duplicates": 0, "files": []},
        )
        return

    for path in candidates:
        if path.suffix.lower() not in IMAGE_EXTENSIONS:
            continue
        if not is_readable_image(path):
            corrupted.append(str(path))
            print(f"[CORRUPTED] {path} - could not be decoded, skipping.")
            continue

        digest = sha256_of_file(path)
        if digest in seen_hashes:
            duplicates.append({"file": str(path), "duplicateOf": str(seen_hashes[digest])})
            print(f"[DUPLICATE] {path} is byte-identical to {seen_hashes[digest]}, skipping.")
            continue
        seen_hashes[digest] = path

        normalized_name = f"{digest[:16]}{path.suffix.lower()}"
        dest = out_dir / normalized_name
        if not dest.exists():
            shutil.copy2(path, dest)
        kept.append({"source": str(path), "processed": str(dest), "sha256": digest})

    report = {
        "rawDir": str(raw_dir),
        "processedDir": str(out_dir),
        "totalFound": len(candidates),
        "kept": len(kept),
        "corrupted": len(corrupted),
        "duplicates": len(duplicates),
        "corruptedFiles": corrupted,
        "duplicateFiles": duplicates,
        "files": kept,
    }
    write_json(Path(args.report), report)

    print("\n--- prepare_dataset summary ---")
    print(f"Found:      {len(candidates)}")
    print(f"Kept:       {len(kept)}")
    print(f"Corrupted:  {len(corrupted)}")
    print(f"Duplicates: {len(duplicates)}")
    print(f"Report:     {args.report}")
    print("\nNOTE: prepared images have NO labels yet. Annotate them (see")
    print("ml/README.md) before running split_dataset.py, or run")
    print("scripts/draft_annotate.py to generate UNVERIFIED candidate boxes")
    print("for human review in an annotation tool.")


if __name__ == "__main__":
    main()
