import logging
import os
import re

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database import get_db
from rag import pipeline as rag_pipeline  # harus sama dengan cara chat.py meng-import pipeline
from app.routers import (
    chat,
    dashboard,
    formasi,
    insight,
    kualitas,
    opd,
    optimasi,
    pensiun_bup,
    insight_opd,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

# ============================================================
# FASTAPI APP
# ============================================================

app = FastAPI(
    title="BKD Jatim API",
    description="API Dashboard Manajemen ASN BKD Jawa Timur",
    version="1.0.0",
)


# ============================================================
# CORS
# ============================================================

# Tambahkan domain frontend produksi di variabel environment FRONTEND_ORIGINS
# (dipisah koma), misalnya: FRONTEND_ORIGINS=https://dashboard-bkd.jatimprov.go.id
_extra_origins = [
    o.strip() for o in os.getenv("FRONTEND_ORIGINS", "").split(",") if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        *_extra_origins,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# ID SESI ANONIM (untuk log chat)
# ============================================================
# Frontend mengirim UUID acak per browser lewat header X-Session-Id.
# Bukan identitas pengguna; hanya agar log pertanyaan bisa dikelompokkan.

_SESSION_RE = re.compile(r"[A-Za-z0-9-]{4,64}")


@app.middleware("http")
async def attach_session_id(request: Request, call_next):
    sid = request.headers.get("x-session-id", "")
    token = rag_pipeline.session_id_var.set(sid if _SESSION_RE.fullmatch(sid) else "-")
    try:
        return await call_next(request)
    finally:
        rag_pipeline.session_id_var.reset(token)


# ============================================================
# ERROR HANDLING
# ============================================================
# Endpoint yang belum membungkus query dengan try/except masing-masing
# tetap tertangkap handler global ini, supaya frontend dapat JSON error
# yang rapi, bukan HTML 500.


@app.exception_handler(SQLAlchemyError)
def sqlalchemy_error_handler(request: Request, exc: SQLAlchemyError):
    return JSONResponse(
        status_code=500,
        content={"detail": f"Database error: {str(exc)}"},
    )


# ============================================================
# HEALTH CHECK
# ============================================================


@app.get("/")
def root():
    return {
        "message": "BKD Jatim API berjalan",
        "status": "ok",
    }


@app.get("/api/health")
def health_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {
            "status": "ok",
            "database": "connected",
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Database error: {str(e)}",
        )


# ============================================================
# ROUTERS PER FITUR
# ============================================================

app.include_router(dashboard.router)
app.include_router(pensiun_bup.router)
app.include_router(kualitas.router)
app.include_router(opd.router)
app.include_router(optimasi.router)
app.include_router(formasi.router)
app.include_router(insight.router)
app.include_router(chat.router)
app.include_router(insight_opd.router)
