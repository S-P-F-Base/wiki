import json

from fastapi import APIRouter, Request, Response
from fastapi.responses import JSONResponse

from .utils.search_index import INDEX_FILE, META_FILE

router = APIRouter()


@router.get("/wiki/search/index")
def get_search_index(request: Request):
    client_hash = request.headers.get("If-None-Match")

    meta = json.loads(META_FILE.read_text(encoding="utf-8"))
    etag = meta["hash"]

    if client_hash == etag:
        return Response(status_code=304)

    return JSONResponse(
        content=json.loads(INDEX_FILE.read_text(encoding="utf-8")),
        headers={
            "ETag": etag,
            "Cache-Control": "public, max-age=3600",
        },
    )
