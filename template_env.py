import os
from pathlib import Path

from fastapi.templating import Jinja2Templates

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))

USE_ACCEL = os.getenv("FASTAPISTATIC") != "1"


def static_url(file: str) -> str:
    static_path = STATIC_DIR / file
    v = int(static_path.stat().st_mtime) if static_path.exists() else 0

    if USE_ACCEL:
        return f"/wiki/static/{file}?v={v}"

    else:
        return f"/static/{file}?v={v}"


templates.env.filters["ver"] = static_url
