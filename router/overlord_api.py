from fastapi import APIRouter

router = APIRouter()


@router.get("/ping")
async def ping_overlord():
    return {"ok": True}
