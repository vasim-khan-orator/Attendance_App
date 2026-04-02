"""
Automatic download of OpenCV DNN face models (YuNet + SFace).
Called once at startup; skips download if files already exist.
"""

import os
import urllib.request
from pathlib import Path

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
            print(f"  ✓ {filename} already present ({size_mb:.1f} MB)")
            continue

        print(f"  ⬇ Downloading {filename} ...")
        try:
            urllib.request.urlretrieve(url, str(dest))
            size_mb = dest.stat().st_size / (1024 * 1024)
            print(f"  ✓ {filename} downloaded ({size_mb:.1f} MB)")
        except Exception as exc:
            print(f"  ✗ Failed to download {filename}: {exc}")
            # Remove partial download
            if dest.exists():
                dest.unlink()
            raise RuntimeError(
                f"Could not download required model {filename}. "
                f"Please download it manually from {url} and place in {MODELS_DIR}"
            ) from exc


if __name__ == "__main__":
    ensure_models()
