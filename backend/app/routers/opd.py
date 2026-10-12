from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.opd_service import compute_perbandingan_opd

router = APIRouter(tags=["Perbandingan Antar OPD"])


@router.get("/api/perbandingan-opd")
def perbandingan_opd(db: Session = Depends(get_db)):
    return compute_perbandingan_opd(db)