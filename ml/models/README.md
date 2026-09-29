# ml/models/

Exported ONNX weights land here by default (or wherever `--out` points,
e.g. directly into `backend/ai-models/` — see `ml/README.md` §7).

Nothing is committed here except this file and `.gitkeep`: exported `.onnx`
files are ignored by `ml/.gitignore` since they're regenerable build
artifacts, not source. Re-run `scripts/export_onnx.py` after training to
recreate them.
