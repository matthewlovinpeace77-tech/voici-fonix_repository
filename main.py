from __future__ import annotations

import os
from pathlib import Path
from urllib.parse import quote

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

ROOT = Path(__file__).resolve().parent
STATIC = ROOT / "static"
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip()
SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "").strip()

app = FastAPI(title="NoteWise Music Tutor", version="1.0.0")
app.mount("/static", StaticFiles(directory=STATIC), name="static")


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("Permissions-Policy", "camera=(), geolocation=(), microphone=(self)")
        response.headers.setdefault("Content-Security-Policy", "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'self'; frame-ancestors 'none'")
        return response


app.add_middleware(SecurityHeadersMiddleware)

LESSONS = [
    {"id": "scales", "title": "Build a major scale", "category": "Theory", "content": "A major scale follows whole, whole, half, whole, whole, whole, half steps. Try C major: C–D–E–F–G–A–B–C."},
    {"id": "triads", "title": "Make a major triad", "category": "Harmony", "content": "A major triad uses scale degrees 1, 3, and 5. In C major, play C–E–G. Lower the middle note by a semitone to hear C minor."},
    {"id": "pulse", "title": "Find a steady pulse", "category": "Rhythm", "content": "In 4/4, count 1, 2, 3, 4 evenly. Tap beats 1 and 3, then try beats 2 and 4 without losing the pulse."},
    {"id": "treble", "title": "Read treble clef", "category": "Reading", "content": "Treble-clef lines from bottom to top are E–G–B–D–F. The spaces are F–A–C–E."},
]


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


def demo_reply(message: str) -> str:
    q = message.lower()
    if any(w in q for w in ("scale", "scales")): return LESSONS[0]["content"]
    if any(w in q for w in ("chord", "triad", "harmony")): return LESSONS[1]["content"]
    if any(w in q for w in ("rhythm", "beat", "meter")): return LESSONS[2]["content"]
    if any(w in q for w in ("note", "staff", "clef", "treble", "bass")): return LESSONS[3]["content"]
    return "Ask me about notes, scales, chords, rhythm, or reading notation. Configure GEMINI_API_KEY to enable the AI tutor."


@app.get("/", include_in_schema=False)
async def home() -> FileResponse:
    return FileResponse(STATIC / "index.html")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/lessons")
async def get_lessons() -> dict[str, object]:
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        return {"lessons": LESSONS, "source": "built-in"}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(
                f"{SUPABASE_URL}/rest/v1/lessons?select=id,title,category,content&order=created_at.asc",
                headers={"apikey": SUPABASE_ANON_KEY, "Authorization": f"Bearer {SUPABASE_ANON_KEY}"},
            )
            response.raise_for_status()
            rows = response.json()
        if not isinstance(rows, list):
            raise ValueError("Invalid lessons response")
        rows = [r for r in rows if isinstance(r, dict) and all(k in r for k in ("id", "title", "category", "content"))]
        return {"lessons": rows or LESSONS, "source": "supabase" if rows else "built-in"}
    except (httpx.HTTPError, ValueError, TypeError):
        return {"lessons": LESSONS, "source": "built-in"}


@app.post("/api/chat")
async def chat(body: ChatRequest) -> dict[str, str]:
    message = body.message.strip()
    if not message:
        raise HTTPException(status_code=422, detail="Please enter a question.")
    if not GEMINI_API_KEY:
        return {"reply": demo_reply(message), "mode": "demo"}
    model = quote(GEMINI_MODEL, safe="-")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    payload = {
        "systemInstruction": {"parts": [{"text": "You are NoteWise, a patient, encouraging music teacher. Teach music theory, ear training, rhythm, and practice technique clearly. Be concise, include one small exercise, assume a beginner unless told otherwise, and never claim to hear audio that was not provided."}]},
        "contents": [{"role": "user", "parts": [{"text": message}]}],
        "generationConfig": {"temperature": 0.6, "maxOutputTokens": 450},
    }
    try:
        async with httpx.AsyncClient(timeout=35) as client:
            response = await client.post(url, params={"key": GEMINI_API_KEY}, json=payload)
            response.raise_for_status()
            data = response.json()
        parts = data["candidates"][0]["content"]["parts"]
        reply = "\n".join(p["text"] for p in parts if isinstance(p, dict) and isinstance(p.get("text"), str)).strip()
        if not reply:
            raise ValueError("Empty Gemini response")
        return {"reply": reply, "mode": "gemini"}
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=502, detail="The Gemini tutor is temporarily unavailable. Please try again shortly.") from exc
