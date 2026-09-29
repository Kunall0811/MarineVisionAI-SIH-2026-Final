@echo off
echo ========================================================
echo MarineVision AI - Side-Scan Sonar ML Training Pipeline
echo ========================================================
set PYTHON_CMD=python
if exist "%LOCALAPPDATA%\Python\bin\python.exe" (
    set PYTHON_CMD="%LOCALAPPDATA%\Python\bin\python.exe"
)

echo [1/4] Preparing and validating side-scan sonar dataset...
%PYTHON_CMD% training\prepare_dataset.py
if %ERRORLEVEL% NEQ 0 (
    echo Error during dataset preparation!
    exit /b %ERRORLEVEL%
)

echo.
echo [2/4] Profiling dataset statistics and class distribution...
%PYTHON_CMD% training\analyze_dataset.py

echo.
echo [3/4] Fine-tuning YOLO26x model on sonar dataset...
%PYTHON_CMD% training\train_yolo26x.py --epochs 10 --imgsz 640
if %ERRORLEVEL% NEQ 0 (
    echo Error during model fine-tuning!
    exit /b %ERRORLEVEL%
)

echo.
echo [4/4] Exporting to ONNX and verifying runtime output...
%PYTHON_CMD% training\export_onnx.py
if %ERRORLEVEL% NEQ 0 (
    echo Error during ONNX export!
    exit /b %ERRORLEVEL%
)

echo.
echo ========================================================
echo Training and deployment complete! Model is active.
echo ========================================================
