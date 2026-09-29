# setup_windows.ps1 - MarineVision AI ml/ pipeline setup for Windows PowerShell.
# Run this from inside the ml/ directory:
#   cd ml
#   .\setup_windows.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== MarineVision AI - ml pipeline setup ===" -ForegroundColor Cyan

# 1. Verify Python
try {
    $pyVersion = (python --version) 2>&1
    Write-Host "Found: $pyVersion"
} catch {
    Write-Host "ERROR: Python was not found on PATH. Install Python 3.10-3.12 from python.org first." -ForegroundColor Red
    exit 1
}

# 2. Create virtual environment (only if it doesn't already exist)
if (-Not (Test-Path ".venv")) {
    Write-Host "Creating virtual environment in .venv ..."
    python -m venv .venv
} else {
    Write-Host "Virtual environment .venv already exists, reusing it."
}

# 3. Activate it
Write-Host "Activating .venv ..."
& .\.venv\Scripts\Activate.ps1

# 4. Install requirements
Write-Host "Installing requirements.txt (this downloads torch/ultralytics - can take several minutes and needs internet access) ..." -ForegroundColor Yellow
pip install --upgrade pip
pip install -r requirements.txt

# 5. Check ultralytics
Write-Host "`nVerifying ultralytics ..."
python -c "import ultralytics; print('ultralytics', ultralytics.__version__)"
if ($LASTEXITCODE -ne 0) {
    Write-Host "ultralytics did NOT import correctly." -ForegroundColor Red
    exit 1
}

# 6. Check onnxruntime
Write-Host "Verifying onnxruntime ..."
python -c "import onnxruntime; print('onnxruntime', onnxruntime.__version__); print('providers:', onnxruntime.get_available_providers())"
if ($LASTEXITCODE -ne 0) {
    Write-Host "onnxruntime did NOT import correctly." -ForegroundColor Red
    exit 1
}

Write-Host "`n=== Setup complete. Next steps: ===" -ForegroundColor Green
Write-Host "  python scripts/prepare_dataset.py"
Write-Host "  python scripts/draft_annotate.py       # optional: propose candidate boxes for review"
Write-Host "  (annotate/correct labels in your tool of choice)"
Write-Host "  python scripts/split_dataset.py"
Write-Host "  python scripts/validate_dataset.py"
Write-Host "  python scripts/train.py --data dataset/dataset.yaml --model yolo11n.pt --epochs 100"
Write-Host "See README.md for the full walkthrough."
