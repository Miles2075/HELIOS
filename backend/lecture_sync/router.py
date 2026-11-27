import asyncio
import shutil
from pathlib import Path
from typing import List, Tuple, Dict, Any
from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel

from backend.core.database import get_connection, initialize_database
from backend.lecture_sync.transcriber import transcribe_audio_file
from backend.lecture_sync.visual_extractor import (
    extract_and_save_lecture_visuals,
    get_persisted_visuals,
    is_video_file,
)

router = APIRouter(prefix="/api/lecture", tags=["Lecture Sync"])

# Ensure tables exist when router loads
initialize_database()

# Upload directory setup (matches README uploads/ structure)
UPLOAD_DIR = Path("uploads") / "lectures"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {
    ".mp3",
    ".wav",
    ".mp4",
    ".m4a",
    ".webm",
    ".mov",
    ".mkv",
    ".aac",
    ".ogg",
    ".flac",
}

MEDIA_TYPES = {
    ".wav": "audio/wav",
    ".mp3": "audio/mpeg",
    ".mp4": "video/mp4",
    ".m4a": "audio/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".mkv": "video/x-matroska",
    ".aac": "audio/aac",
    ".ogg": "audio/ogg",
    ".flac": "audio/flac",
}


# --- Pydantic Schemas (Strictly aligned with docs/API_CONTRACT.md) ---


class UploadResponse(BaseModel):
    success: bool
    lecture_id: int
    filename: str
    message: str


class TranscribeRequest(BaseModel):
    lecture_id: int
    force: bool = False


class YouTubeImportRequest(BaseModel):
    url: str


class Segment(BaseModel):
    start_time: float
    end_time: float
    text: str


class TranscribeResponse(BaseModel):
    success: bool
    lecture_id: int
    status: str
    duration: float
    segments: List[Segment]


class SearchRequest(BaseModel):
    lecture_id: int
    query: str


class SearchResponse(BaseModel):
    success: bool
    results: List[Segment]


class VisualItem(BaseModel):
    id: int
    lecture_id: int
    timestamp: float
    visual_type: str
    title: str
    description: str
    latex: str = ""
    ocr_text: str = ""
    image_url: str


class VisualsResponse(BaseModel):
    success: bool
    lecture_id: int
    count: int
    visuals: List[VisualItem]


class LectureSummary(BaseModel):
    lecture_id: int
    filename: str
    status: str
    duration: float
    engine: str
    size_kb: int = 0
    is_video: bool = False
    segments: List[Segment]


class LectureListResponse(BaseModel):
    success: bool
    lectures: List[LectureSummary]


# --- Helpers ---


def _fetch_segments(connection, lecture_id: int) -> List[Segment]:
    rows = connection.execute(
        """
        SELECT start_time, end_time, text
        FROM lecture_segments
        WHERE lecture_id = ?
        ORDER BY segment_index ASC
        """,
        (lecture_id,),
    ).fetchall()
    return [
        Segment(
            start_time=float(r["start_time"]),
            end_time=float(r["end_time"]),
            text=r["text"],
        )
        for r in rows
    ]


# --- Endpoints ---


@router.get("/list", response_model=LectureListResponse)
async def list_lectures():
    connection = get_connection()
    try:
        rows = connection.execute(
            """
            SELECT id, filename, file_path, status, duration, engine
            FROM lectures
            ORDER BY id DESC
            """
        ).fetchall()
        lectures = []
        for row in rows:
            fpath = Path(row["file_path"])
            size_kb = max(1, round(fpath.stat().st_size / 1024)) if fpath.exists() else 0
            is_video = is_video_file(fpath) or is_video_file(Path(row["filename"]))
            lectures.append(
                LectureSummary(
                    lecture_id=row["id"],
                    filename=row["filename"],
                    status=row["status"],
                    duration=float(row["duration"]),
                    engine=row["engine"],
                    size_kb=size_kb,
                    is_video=is_video,
                    segments=_fetch_segments(connection, row["id"]),
                )
            )
        return LectureListResponse(success=True, lectures=lectures)
    finally:
        connection.close()


@router.get("/{lecture_id}/audio")
async def stream_lecture_audio(lecture_id: int):
    connection = get_connection()
    try:
        row = connection.execute(
            "SELECT filename, file_path FROM lectures WHERE id = ?",
            (lecture_id,),
        ).fetchone()
    finally:
        connection.close()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lecture with ID {lecture_id} not found.",
        )

    file_path = Path(row["file_path"])
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stored audio file could not be located on disk.",
        )

    media_type = MEDIA_TYPES.get(file_path.suffix.lower(), "application/octet-stream")
    return FileResponse(path=str(file_path), media_type=media_type, filename=row["filename"])


@router.post("/upload", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_lecture(file: UploadFile = File(...)):
    # 1. Supported file validation (MP3, WAV)
    original_filename = Path(file.filename or "").name
    extension = Path(original_filename).suffix.lower()
    if not original_filename or extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported media format. Accepted formats: MP3, WAV, MP4, M4A, WEBM, MOV, MKV.",
        )

    stored_name = f"{uuid4().hex[:10]}_{original_filename}"
    file_path = UPLOAD_DIR / stored_name

    try:
        # 2. Persist original file without modification
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save audio file: {str(e)}",
        )
    finally:
        await file.close()

    if file_path.stat().st_size == 0:
        file_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded audio file is empty.",
        )

    connection = get_connection()
    try:
        cursor = connection.execute(
            """
            INSERT INTO lectures (filename, file_path, status, duration, engine)
            VALUES (?, ?, 'uploaded', 0.0, 'pending')
            """,
            (original_filename, str(file_path)),
        )
        lecture_id = cursor.lastrowid
        connection.commit()
    finally:
        connection.close()

    return UploadResponse(
        success=True,
        lecture_id=lecture_id,
        filename=original_filename,
        message="Lecture uploaded successfully",
    )


def _download_youtube_worker(url: str, output_template: str) -> Tuple[Dict[str, Any], List[Tuple[float, float, str]]]:
    import json as json_mod
    import urllib.request
    import yt_dlp

    # Try client configurations with android first to avoid bot detection
    client_configs = [
        {"player_client": ["android"]},
        {"player_client": ["android", "web"]},
        {"player_client": ["mweb"]},
    ]

    info = None
    last_err = None
    for cfg in client_configs:
        try:
            ydl_opts = {
                "format": "18/best[ext=mp4]/bestaudio/best",
                "outtmpl": output_template,
                "noplaylist": True,
                "quiet": True,
                "no_warnings": True,
                "extractor_args": {"youtube": cfg},
            }
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                if info:
                    break
        except Exception as e:
            last_err = e
            continue

    if not info:
        # Fallback to browser cookies if available
        for browser in ["chrome", "edge"]:
            try:
                ydl_opts = {
                    "format": "18/best[ext=mp4]/bestaudio/best",
                    "outtmpl": output_template,
                    "noplaylist": True,
                    "quiet": True,
                    "no_warnings": True,
                    "cookiesfrombrowser": (browser, None, None, None),
                }
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(url, download=True)
                    if info:
                        break
            except Exception:
                pass

    if not info:
        err_msg = str(last_err or "Unknown extraction failure")
        if "bot" in err_msg.lower() or "sign in" in err_msg.lower():
            raise ValueError(
                "YouTube's anti-bot verification blocked direct download. "
                "Tip: Try uploading the MP3/WAV file directly via 'Choose Audio/Video File' "
                "or use a YouTube video that allows external streaming."
            )
        raise ValueError(f"YouTube video retrieval failed: {err_msg}")

    # Check for pre-existing YouTube English captions/subtitles
    sub_segments = []
    auto_caps = info.get("automatic_captions", {}) or {}
    official_caps = info.get("subtitles", {}) or {}
    en_formats = official_caps.get("en") or auto_caps.get("en") or []
    json3_url = next((f["url"] for f in en_formats if f.get("ext") == "json3"), None)

    if json3_url:
        try:
            with urllib.request.urlopen(json3_url, timeout=10) as s_res:
                sub_data = json_mod.loads(s_res.read().decode())
            for ev in sub_data.get("events", []):
                t = ev.get("tStartMs", 0) / 1000.0
                d = ev.get("dDurationMs", 0) / 1000.0
                segs = ev.get("segs", [])
                txt = "".join(s.get("utf8", "") for s in segs).replace("\n", " ").strip()
                if txt and txt not in {"[Music]", "[Applause]"}:
                    sub_segments.append((round(t, 2), round(t + max(1.0, d), 2), txt))
        except Exception:
            pass

    return info, sub_segments


@router.post("/youtube", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
async def import_youtube_lecture(payload: YouTubeImportRequest):
    url = payload.url.strip()
    if not url or ("youtube.com" not in url and "youtu.be" not in url):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide a valid YouTube video URL (e.g., https://www.youtube.com/watch?v=...)",
        )

    video_token = uuid4().hex[:10]
    output_template = str(UPLOAD_DIR / f"{video_token}_%(title).40s.%(ext)s")

    try:
        # Run yt-dlp on worker thread pool so FastAPI asyncio event loop never freezes
        info, sub_segments = await asyncio.to_thread(_download_youtube_worker, url, output_template)
        title = info.get("title", "YouTube Lecture")
        ext = info.get("ext", "mp4")
        duration = float(info.get("duration") or 0.0)

        # Locate downloaded file
        candidates = list(UPLOAD_DIR.glob(f"{video_token}_*"))
        if not candidates or candidates[0].stat().st_size == 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Could not extract media track from this YouTube video.",
            )

        saved_file = candidates[0]
        clean_title = f"{title[:45].strip()} (YouTube).{ext}"
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    connection = get_connection()
    try:
        initial_status = "completed" if sub_segments else "uploaded"
        initial_engine = "youtube-captions" if sub_segments else "pending"
        cursor = connection.execute(
            """
            INSERT INTO lectures (filename, file_path, status, duration, engine)
            VALUES (?, ?, ?, ?, ?)
            """,
            (clean_title, str(saved_file), initial_status, duration, initial_engine),
        )
        lecture_id = cursor.lastrowid

        if sub_segments:
            for idx, (st, et, txt) in enumerate(sub_segments):
                connection.execute(
                    """
                    INSERT INTO lecture_segments (lecture_id, segment_index, start_time, end_time, text)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (lecture_id, idx, st, et, txt),
                )

        connection.commit()
    finally:
        connection.close()

    return UploadResponse(
        success=True,
        lecture_id=lecture_id,
        filename=clean_title,
        message="YouTube audio imported successfully",
    )


@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe_lecture(payload: TranscribeRequest):
    connection = get_connection()
    try:
        lecture = connection.execute(
            "SELECT id, filename, file_path, status, duration FROM lectures WHERE id = ?",
            (payload.lecture_id,),
        ).fetchone()

        if not lecture:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Lecture with ID {payload.lecture_id} not found.",
            )

        # If already transcribed, return persisted segments from SQLite unless forced or placeholder
        existing_segments = _fetch_segments(connection, payload.lecture_id)
        is_placeholder = any(
            "newton" in s.text.lower() for s in existing_segments
        ) and (
            "newton" not in lecture["filename"].lower()
            and "physics" not in lecture["filename"].lower()
        )
        if lecture["status"] == "completed" and existing_segments and not payload.force and not is_placeholder:
            return TranscribeResponse(
                success=True,
                lecture_id=lecture["id"],
                status=lecture["status"],
                duration=float(lecture["duration"]),
                segments=existing_segments,
            )

        # Mark as transcribing so concurrent requests know it is active
        connection.execute(
            "UPDATE lectures SET status = 'transcribing' WHERE id = ?",
            (payload.lecture_id,),
        )
        connection.commit()
    finally:
        connection.close()

    try:
        # Offload CPU-heavy Whisper execution to a background worker thread!
        # This keeps the FastAPI asyncio event loop 100% responsive so /health and other requests never stall!
        duration, raw_segments, engine = await asyncio.to_thread(
            transcribe_audio_file,
            Path(lecture["file_path"]),
            lecture["filename"],
        )
    except (FileNotFoundError, ValueError) as e:
        conn = get_connection()
        try:
            conn.execute("UPDATE lectures SET status = 'failed' WHERE id = ?", (payload.lecture_id,))
            conn.commit()
        finally:
            conn.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Audio processing error during transcription: {str(e)}",
        )
    except Exception as e:
        conn = get_connection()
        try:
            conn.execute("UPDATE lectures SET status = 'failed' WHERE id = ?", (payload.lecture_id,))
            conn.commit()
        finally:
            conn.close()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Audio processing error during transcription: {str(e)}",
        )

    connection = get_connection()
    try:
        connection.execute(
            "DELETE FROM lecture_segments WHERE lecture_id = ?",
            (payload.lecture_id,),
        )
        for idx, seg in enumerate(raw_segments):
            connection.execute(
                """
                INSERT INTO lecture_segments (lecture_id, segment_index, start_time, end_time, text)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    payload.lecture_id,
                    idx,
                    float(seg["start_time"]),
                    float(seg["end_time"]),
                    seg["text"],
                ),
            )

        connection.execute(
            """
            UPDATE lectures
            SET status = 'completed', duration = ?, engine = ?
            WHERE id = ?
            """,
            (float(duration), engine, payload.lecture_id),
        )
        connection.commit()

        segments = [Segment(**seg) for seg in raw_segments]
        return TranscribeResponse(
            success=True,
            lecture_id=lecture["id"],
            status="completed",
            duration=float(duration),
            segments=segments,
        )
    finally:
        connection.close()


@router.post("/search", response_model=SearchResponse)
async def search_transcript(payload: SearchRequest):
    connection = get_connection()
    try:
        lecture = connection.execute(
            "SELECT id FROM lectures WHERE id = ?",
            (payload.lecture_id,),
        ).fetchone()
        if not lecture:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Lecture with ID {payload.lecture_id} not found.",
            )

        query = payload.query.strip().lower()
        if not query:
            return SearchResponse(success=True, results=[])

        segments = _fetch_segments(connection, payload.lecture_id)
        matching_results = [seg for seg in segments if query in seg.text.lower()]

        return SearchResponse(
            success=True,
            results=matching_results,
        )
    finally:
        connection.close()


@router.get("/visuals/{visual_id}/image")
async def get_visual_image(visual_id: int):
    connection = get_connection()
    try:
        row = connection.execute(
            "SELECT image_path FROM lecture_visuals WHERE id = ?",
            (visual_id,),
        ).fetchone()
    finally:
        connection.close()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Visual item not found in database.",
        )

    path = Path(row["image_path"])
    if not path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Visual frame image file does not exist on disk.",
        )

    return FileResponse(path=str(path), media_type="image/jpeg")


@router.get("/{lecture_id}/visuals", response_model=VisualsResponse)
async def get_lecture_visuals(lecture_id: int):
    # Check if visuals exist in database
    visuals = get_persisted_visuals(lecture_id)
    if not visuals:
        # Auto-extract on first request so user sees them right away
        visuals = await asyncio.to_thread(extract_and_save_lecture_visuals, lecture_id)

    return VisualsResponse(
        success=True,
        lecture_id=lecture_id,
        count=len(visuals),
        visuals=[VisualItem(**v) for v in visuals],
    )


@router.post("/{lecture_id}/extract-visuals", response_model=VisualsResponse)
async def extract_lecture_visuals(lecture_id: int):
    visuals = await asyncio.to_thread(extract_and_save_lecture_visuals, lecture_id)
    return VisualsResponse(
        success=True,
        lecture_id=lecture_id,
        count=len(visuals),
        visuals=[VisualItem(**v) for v in visuals],
    )
