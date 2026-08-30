"""
AttendanceServer - Entry point for PyInstaller packaging.

This script is the target for `pyinstaller attendance.spec`.
It starts the FastAPI/uvicorn server programmatically so that
PyInstaller can bundle all dependencies into a single .exe.
"""

import sys
import os
import threading
import signal


def _fix_frozen_paths():
    """
    When running as a PyInstaller frozen executable, sys._MEIPASS contains
    the path to the temporary folder where bundled files are extracted.
    We add it to sys.path so that all our local modules (main, crud, etc.)
    can be imported normally.
    """
    if getattr(sys, "frozen", False):
        bundle_dir = sys._MEIPASS  # type: ignore[attr-defined]
        # Insert at front so our bundled modules take priority
        if bundle_dir not in sys.path:
            sys.path.insert(0, bundle_dir)
        # Change CWD to the folder containing the .exe so SQLite database
        # and downloaded model files land next to the executable.
        os.chdir(os.path.dirname(sys.executable))


def _print_banner():
    print("=" * 55)
    print("  Attendance App — Server")
    print("  Running at: http://localhost:8000")
    print("  Press Ctrl+C to stop")
    print("=" * 55)
    print()


def main():
    _fix_frozen_paths()
    _print_banner()

    import uvicorn

    # Graceful shutdown on Ctrl+C / SIGTERM
    def handle_signal(sig, frame):
        print("\nShutting down server...")
        sys.exit(0)

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
        log_level="info",
    )


if __name__ == "__main__":
    main()
