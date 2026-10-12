from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.kualitas_service import compute_kualitas_data

router = APIRouter(tags=["Kualitas Data"])


@router.get("/api/kualitas-data")
def kualitas_data(db: Session = Depends(get_db)):
    return compute_kualitas_data(db)
