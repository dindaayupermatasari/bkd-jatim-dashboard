from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.services import optimasi_service

router = APIRouter(tags=["Simulator Optimasi Bobot Kriteria"])


@router.post("/api/optimasi/ga")
def optimasi_ga(pop_size: int = 100, generations: int = 200,
                 mutation_rate: float = 0.1, db: Session = Depends(get_db)):
    return optimasi_service.jalankan_ga(db, pop_size, generations, mutation_rate)