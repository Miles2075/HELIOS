import io
import wave
from pathlib import Path

from fastapi.testclient import TestClient

from backend.core import database
from backend.lecture_sync import router as lecture_router_module
from backend.main import app


def _make_wav_bytes(duration_sec: float = 4.0, sample_rate: int = 8000) -> bytes:
    buf = io.BytesIO()
    num_frames = int(duration_sec * sample_rate)
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(b"\x00\x00" * num_frames)
    return buf.getvalue()


def test_health_and_root():
    client = TestClient(app)
    res_root = client.get("/")
    assert res_root.status_code == 200
    assert "HELIOS" in res_root.json()["message"]

    res_health = client.get("/health")
    assert res_health.status_code == 200
    assert res_health.json()["status"] == "ok"


def test_lecture_sync_full_pipeline_and_persistence(tmp_path, monkeypatch):
    # Skip model download in unit tests; live server uses faster-whisper automatically
    monkeypatch.setenv("HELIOS_SKIP_WHISPER", "1")
    # Isolate database and upload directory for tests
    test_db = tmp_path / "test_helios.db"
    test_uploads = tmp_path / "lectures"
    test_uploads.mkdir(parents=True, exist_ok=True)

    monkeypatch.setattr(database, "DATABASE_PATH", test_db)
    monkeypatch.setattr(lecture_router_module, "UPLOAD_DIR", test_uploads)
    database.initialize_database()

    client = TestClient(app)

    # 1. Reject unsupported file formats
    bad_res = client.post(
        "/api/lecture/upload",
        files={"file": ("notes.txt", b"not audio", "text/plain")},
    )
    assert bad_res.status_code == 400

    # 2. Reject empty audio file
    empty_res = client.post(
        "/api/lecture/upload",
        files={"file": ("empty.wav", b"", "audio/wav")},
    )
    assert empty_res.status_code == 400

    # 3. Upload valid WAV audio (4.0 seconds)
    wav_bytes = _make_wav_bytes(duration_sec=4.0)
    up_res = client.post(
        "/api/lecture/upload",
        files={"file": ("physics_lecture.wav", wav_bytes, "audio/wav")},
    )
    assert up_res.status_code == 201
    up_data = up_res.json()
    assert up_data["success"] is True
    assert up_data["filename"] == "physics_lecture.wav"
    lecture_id = up_data["lecture_id"]

    # Confirm original audio bytes are stored unmodified
    stored_files = list(test_uploads.glob("*_physics_lecture.wav"))
    assert len(stored_files) == 1
    assert stored_files[0].read_bytes() == wav_bytes

    # 4. Transcribe lecture (checks real WAV duration ~4.0s and float timestamps)
    tr_res = client.post("/api/lecture/transcribe", json={"lecture_id": lecture_id})
    assert tr_res.status_code == 200
    tr_data = tr_res.json()
    assert tr_data["success"] is True
    assert tr_data["status"] == "completed"
    assert tr_data["duration"] == 4.0
    assert len(tr_data["segments"]) >= 2
    for seg in tr_data["segments"]:
        assert isinstance(seg["start_time"], float)
        assert isinstance(seg["end_time"], float)
        assert seg["end_time"] >= seg["start_time"]

    # Original file remains untouched after transcription
    assert stored_files[0].read_bytes() == wav_bytes

    # 5. Search transcript (case-insensitive)
    search_res = client.post(
        "/api/lecture/search",
        json={"lecture_id": lecture_id, "query": "INERTIA"},
    )
    assert search_res.status_code == 200
    search_data = search_res.json()
    assert search_data["success"] is True
    assert len(search_data["results"]) == 1
    assert "inertia" in search_data["results"][0]["text"].lower()

    # 6. Empty results for non-matching query
    miss_res = client.post(
        "/api/lecture/search",
        json={"lecture_id": lecture_id, "query": "quantum_nonexistent_xyz"},
    )
    assert miss_res.status_code == 200
    assert miss_res.json()["results"] == []

    # 7. List lectures & stream audio endpoint
    list_res = client.get("/api/lecture/list")
    assert list_res.status_code == 200
    assert len(list_res.json()["lectures"]) == 1

    audio_res = client.get(f"/api/lecture/{lecture_id}/audio")
    assert audio_res.status_code == 200
    assert audio_res.content == wav_bytes

    # 8. Missing lecture ID returns 404
    assert client.post("/api/lecture/transcribe", json={"lecture_id": 99999}).status_code == 404
    assert (
        client.post("/api/lecture/search", json={"lecture_id": 99999, "query": "test"}).status_code
        == 404
    )
