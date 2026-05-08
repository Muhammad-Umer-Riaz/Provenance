from fastapi import APIRouter

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/")
async def list_reports():
    return {"reports": []}
