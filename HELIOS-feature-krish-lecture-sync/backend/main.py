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
from backend.smart_search.routes import router as search_router, sync_sqlite_docs_to_chroma

# Initialize shared SQLite database (backend/helios.db) on startup
initialize_database()


def _seed_initial_data_if_empty() -> None:
    """
    Seeds two compact academic study documents and one lab experiment dataset
    on first run so all 5 modules work live immediately out of the box.
    """
    connection = get_connection()
    try:
        doc_count = connection.execute("SELECT COUNT(*) AS cnt FROM documents").fetchone()["cnt"]
        if doc_count == 0:
            samples = [
                (
                    "Operating_Systems.pdf",
                    "uploads/documents/Operating_Systems.pdf",
                    [
                        (
                            1,
                            "A Process is a program in execution managed by the OS Kernel with its own address space and Process Control Block. Round Robin Scheduling allocates fixed time quanta to guarantee responsiveness across concurrent processes.",
                        ),
                        (
                            2,
                            "A Mutex Lock enforces mutual exclusion so only the owning thread enters a critical section and prevents race conditions. Counting Semaphores coordinate access to shared resource pools in Concurrency.",
                        ),
                        (
                            3,
                            "Deadlock occurs when four Coffman conditions hold simultaneously: mutual exclusion, hold and wait, no preemption, and circular wait. Breaking circular wait prevents Deadlock.",
                        ),
                        (
                            4,
                            "Virtual Memory decouples logical addresses from physical RAM frames using Page Tables and the Translation Lookaside Buffer (TLB). Demand Paging loads pages into RAM on a page fault.",
                        ),
                    ],
                ),
                (
                    "biology.pdf",
                    "uploads/documents/biology.pdf",
                    [
                        (
                            1,
                            "Chloroplasts are double-membrane plant organelles that contain thylakoid stacks and stroma where photosynthetic reactions occur.",
                        ),
                        (
                            2,
                            "Photosynthesis is the process by which green plants convert light energy into chemical energy stored in Glucose using Chlorophyll, water, and carbon dioxide.",
                        ),
                        (
                            3,
                            "The Calvin Cycle operates in the chloroplast stroma and uses ATP and NADPH from Light Reactions to fix carbon dioxide into sugars via the enzyme RuBisCO.",
                        ),
                    ],
                ),
            ]

            for filename, file_path, pages in samples:
                cur = connection.execute(
                    "INSERT INTO documents (filename, file_path) VALUES (?, ?)",
                    (filename, file_path),
                )
                doc_id = cur.lastrowid
                for page_num, text in pages:
                    connection.execute(
                        "INSERT INTO document_pages (document_id, page_number, text) VALUES (?, ?, ?)",
                        (doc_id, page_num, text),
                    )

        ds_count = connection.execute("SELECT COUNT(*) AS cnt FROM datasets").fetchone()["cnt"]
        if ds_count == 0:
            ds_dir = Path("uploads") / "datasets"
            ds_dir.mkdir(parents=True, exist_ok=True)
            sample_csv_path = ds_dir / "experiment_results.csv"
            if not sample_csv_path.exists():
                sample_csv_path.write_text(
                    "temperature,humidity,light_hours,growth,yield_score\n"
                    "18,62,6,14.2,54\n"
                    "20,60,7,18.6,61\n"
                    "22,58,8,24.1,69\n"
                    "24,55,9,31.4,77\n"
                    "26,53,10,38.9,84\n"
                    "28,50,11,44.2,90\n"
                    "30,48,12,47.8,93\n"
                    "32,46,12,45.1,88\n"
                    "34,44,11,39.5,81\n"
                    "36,42,10,33.0,72\n",
                    encoding="utf-8",
                )
            connection.execute(
                "INSERT INTO datasets (filename, file_path) VALUES (?, ?)",
                ("experiment_results.csv", str(sample_csv_path)),
            )

        connection.commit()
    finally:
        connection.close()

    sync_sqlite_docs_to_chroma()


_seed_initial_data_if_empty()

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

# Register all 5 HELIOS modules
app.include_router(search_router)
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
