import os
from pathlib import Path


def _load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


_load_dotenv(Path(__file__).resolve().parent / ".env")

SERVER_IP = os.getenv("SERVER_IP", "127.0.0.1")
PORT = int(os.getenv("PORT", 8000))

DEFAULT_CORS_ORIGINS = [
    f"http://{SERVER_IP}:5173",
]

DEFAULT_CORS_ORIGIN_REGEX = (
    rf"^http://({SERVER_IP}|localhost|127\.0\.0\.1):5173$"
)


def _parse_csv(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


CORS_ORIGINS = ["*"]
CORS_ORIGIN_REGEX = os.getenv("CORS_ORIGIN_REGEX") or DEFAULT_CORS_ORIGIN_REGEX