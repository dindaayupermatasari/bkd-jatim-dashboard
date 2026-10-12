"""Pembungkus tipis untuk Groq chat completions, dengan retry untuk kuota/gangguan."""
import os
import time

from groq import APIConnectionError, APIStatusError, Groq, RateLimitError

from .config import GROQ_MODEL

_client = None


def _get_client() -> Groq:
    global _client
    if _client is None:
        key = os.getenv("GROQ_API_KEY")
        if not key:
            raise RuntimeError("GROQ_API_KEY belum diisi di backend/.env")
        _client = Groq(api_key=key, timeout=60)
    return _client


def chat(messages: list[dict], *, json_mode: bool = False, max_tokens: int = 1500,
         temperature: float = 0.1, retries: int = 4) -> str:
    kwargs = dict(model=GROQ_MODEL, messages=messages, temperature=temperature)
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}
    if GROQ_MODEL.startswith("openai/gpt-oss"):
        kwargs["extra_body"] = {"reasoning_effort": "low"}  # jawaban lebih cepat, hemat token

    client = _get_client()
    for attempt in range(retries):
        last = attempt == retries - 1
        try:
            res = client.chat.completions.create(max_completion_tokens=max_tokens, **kwargs)
            text = (res.choices[0].message.content or "").strip()
            if text:
                return text
            # Kosong biasanya berarti token habis untuk "berpikir": naikkan batasnya
            max_tokens *= 2
            if last:
                raise RuntimeError("Model mengembalikan jawaban kosong")
        except RateLimitError as e:
            if last:
                raise
            wait = float(e.response.headers.get("retry-after", 0) or 0) or 5 * 2 ** attempt
            print(f"  Groq 429, coba lagi dalam {wait:.0f} detik...")
            time.sleep(min(wait, 60))
        except (APIConnectionError, APIStatusError) as e:
            code = getattr(e, "status_code", None)
            if last or (code is not None and code < 500):
                raise
            time.sleep(3 * (attempt + 1))
    raise RuntimeError("tidak seharusnya sampai sini")
