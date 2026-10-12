import logging
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from rag.pipeline import answer

log = logging.getLogger(__name__)
router = APIRouter(tags=["chat"])


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=4000)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
    history: list[Message] = Field(default_factory=list, max_length=10)


class ChatResponse(BaseModel):
    answer: str
    sources: list[str]


@router.post("/api/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    try:
        result = answer(req.message, [m.model_dump() for m in req.history])
    except Exception:
        log.exception("chat gagal")
        raise HTTPException(
            status_code=502, detail="Layanan AI sedang bermasalah, coba lagi sebentar."
        )
    return ChatResponse(answer=result["answer"], sources=result["sources"])
