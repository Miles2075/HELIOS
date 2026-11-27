from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.brain_map.router import router as brainmap_router
from backend.core.database import get_connection, initialize_database
from backend.core.gemini_client import is_gemini_configured
from backend.data_storyteller.router import router as data_router
from backend.lecture_sync.router import router as lecture_router
from backend.quiz_master.router import router as quiz_router
from backend.smart_search.routes import (
    qa_router,
    router as search_router,
    sync_sqlite_docs_to_chroma,
)

# Initialize shared SQLite database (backend/helios.db) on startup
initialize_database()


# Sync SQLite docs to ChromaDB on startup if needed
sync_sqlite_docs_to_chroma()

app = FastAPI(
    title="HELIOS API",
    description="AI-Powered Intelligence Suite for Students and Researchers (All 5 Modules Live).",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all 5 HELIOS modules + QA Endpoints
app.include_router(search_router)
app.include_router(qa_router)
app.include_router(quiz_router)
app.include_router(lecture_router)
app.include_router(data_router)
app.include_router(brainmap_router)

FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if (FRONTEND_DIST / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets")


@app.get("/")
def root(request: Request):
    accept = request.headers.get("accept", "")
    index_html = FRONTEND_DIST / "index.html"
    if "text/html" in accept and index_html.exists():
        return FileResponse(str(index_html))
    return {
        "message": "HELIOS API is running!",
        "modules": [
            "smart_search",
            "quiz_master",
            "lecture_sync",
            "data_storyteller",
            "brain_map",
        ],
        "gemini_configured": is_gemini_configured(),
    }


@app.get("/favicon.svg")
def favicon():
    icon_path = FRONTEND_DIST / "favicon.svg"
    if icon_path.exists():
        return FileResponse(str(icon_path), media_type="image/svg+xml")
    return {"detail": "Not found"}


@app.get("/icons.svg")
def icons_svg():
    icon_path = FRONTEND_DIST / "icons.svg"
    if icon_path.exists():
        return FileResponse(str(icon_path), media_type="image/svg+xml")
    return {"detail": "Not found"}


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "HELIOS API",
        "message": "HELIOS API is running!",
        "modules_loaded": 5,
        "gemini_configured": is_gemini_configured(),
    }
