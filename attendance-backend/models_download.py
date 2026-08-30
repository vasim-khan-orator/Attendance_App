"""
Automatic download of OpenCV DNN face models (YuNet + SFace).
Called once at startup; skips download if files already exist.
"""

import sys
import os
import urllib.request
from pathlib import Path

# When running as a PyInstaller frozen exe, __file__ resolves to the temp
# extraction folder (_MEI...) which is DELETED on every launch — causing
# models to re-download every time. Instead, store models next to the .exe.
if getattr(sys, "frozen", False):
    # Persistent folder: same directory as AttendanceServer.exe
    MODELS_DIR = Path(sys.executable).resolve().parent / "models"
else:
    # Normal development: next to models_download.py
    MODELS_DIR = Path(__file__).resolve().parent / "models"

MODELS = {
    "face_detection_yunet_2023mar.onnx": (
        "https://github.com/opencv/opencv_zoo/raw/main/models/"
        "face_detection_yunet/face_detection_yunet_2023mar.onnx"
    ),
    "face_recognition_sface_2021dec.onnx": (
        "https://github.com/opencv/opencv_zoo/raw/main/models/"
        "face_recognition_sface/face_recognition_sface_2021dec.onnx"
    ),
}


def model_path(name: str) -> Path:
    """Return the absolute path for a named model file."""
    return MODELS_DIR / name


def ensure_models() -> None:
    """Download any missing ONNX model files into the models/ directory."""
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    for filename, url in MODELS.items():
        dest = MODELS_DIR / filename
        if dest.exists():
            size_mb = dest.stat().st_size / (1024 * 1024)
            # Basic sanity check: YuNet is ~0.3MB, SFace is ~36MB
            if ("sface" in filename and size_mb < 30) or ("yunet" in filename and size_mb < 0.1):
                print(f"  ! {filename} is too small ({size_mb:.1f} MB). Redownloading...")
                dest.unlink()
            else:
                print(f"  OK {filename} already present ({size_mb:.1f} MB)")
                continue

        print(f"  DOWNLOADING {filename} ...")
        try:
            urllib.request.urlretrieve(url, str(dest))
            size_mb = dest.stat().st_size / (1024 * 1024)
            print(f"  OK {filename} downloaded ({size_mb:.1f} MB)")
        except Exception as exc:
            print(f"  FAILED to download {filename}: {exc}")
            # Remove partial download
            if dest.exists():
                dest.unlink()
            raise RuntimeError(
                f"Could not download required model {filename}. "
                f"Please download it manually from {url} and place in {MODELS_DIR}"
            ) from exc


if __name__ == "__main__":
    ensure_models()
