@echo off
echo [STUDIO ENGINE] Initialized Native Sidecar Setup...
echo [STUDIO ENGINE] Detected Python 3.10.11
echo.

:: Check for NVIDIA GPU
echo [STUDIO ENGINE] Verifying GPU acceleration...
nvidia-smi >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] No NVIDIA GPU detected. Engine will run on CPU ^(Slower^).
) else (
    echo [SUCCESS] NVIDIA GPU Detected ^(GTX 1650^).
)

echo.
echo [STUDIO ENGINE] Installing processing dependencies...
python -m pip install --upgrade pip

:: Install specific Torch with CUDA 12.1 support (Modern Stable)
echo [STUDIO ENGINE] Installing PyTorch (CUDA 12.1)...
python -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121

:: Install Studio Logic
echo [STUDIO ENGINE] Installing AI Separation and Audio Libraries...
python -m pip install audio-separator[gpu] pedalboard onnxruntime-gpu soundfile librosa

echo.
echo [SUCCESS] Studio Engine Backend is ready.
pause
