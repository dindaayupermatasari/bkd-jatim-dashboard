from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.services import formasi_service

router = APIRouter(tags=["Simulator Alokasi Formasi"])


@router.post("/api/formasi/greedy")
def formasi_greedy(kuota: int = Query(1000, ge=50, le=100000), db: Session = Depends(get_db)):
    return formasi_service.jalankan_greedy(db, kuota)


@router.post("/api/formasi/ga")
def formasi_ga(
    kuota: int = Query(1000, ge=50, le=100000),
    populasi: int = Query(100, ge=10, le=300),
    generasi: int = Query(200, ge=10, le=500),
    mutasi: float = Query(10, ge=0, le=100),
    db: Session = Depends(get_db),
):
    return formasi_service.jalankan_ga(db, kuota, populasi, generasi, mutasi)


@router.post("/api/formasi/sa")
def formasi_sa(
    kuota: int = Query(1000, ge=50, le=100000),
    suhu_awal: float = Query(1000, ge=1, le=10000),
    laju_pendinginan: float = Query(0.95, gt=0.5, lt=1),
    iterasi: int = Query(250, ge=10, le=1000),
    db: Session = Depends(get_db),
):
    return formasi_service.jalankan_sa(db, kuota, suhu_awal, laju_pendinginan, iterasi)


@router.post("/api/formasi/bandingkan")
def formasi_bandingkan(kuota: int = Query(1000, ge=50, le=100000), db: Session = Depends(get_db)):
    return formasi_service.jalankan_bandingkan(db, kuota)


class SensitivitasRequest(BaseModel):
    algoritma: str
    kuota_list: list[int] = Field(min_length=1, max_length=10)


@router.post("/api/formasi/sensitivitas")
def formasi_sensitivitas(body: SensitivitasRequest, db: Session = Depends(get_db)):
    return formasi_service.jalankan_sensitivitas(db, body.algoritma, body.kuota_list)