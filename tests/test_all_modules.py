import os
from fastapi.testclient import TestClient

from backend.core import database
from backend.data_storyteller import router as data_router_module
from backend.main import app
from backend.smart_search import routes as search_routes_module


def test_all_five_modules_end_to_end(tmp_path, monkeypatch):
    monkeypatch.setenv("HELIOS_SKIP_WHISPER", "1")
    test_db = tmp_path / "helios_all.db"
    monkeypatch.setattr(database, "DATABASE_PATH", test_db)
    monkeypatch.setattr(search_routes_module, "UPLOAD_DIR", tmp_path / "docs")
    monkeypatch.setattr(search_routes_module, "_chroma_collection", None)
    monkeypatch.setattr(data_router_module, "UPLOAD_DIR", tmp_path / "datasets")
    (tmp_path / "docs").mkdir(parents=True, exist_ok=True)
    (tmp_path / "datasets").mkdir(parents=True, exist_ok=True)
    database.initialize_database()

    client = TestClient(app)

    # 1. Smart Search: upload TXT -> list -> search (GET) -> ask (POST)
    notes_content = (
        b"Photosynthesis is the process by which plants convert sunlight into glucose using Chlorophyll.\n\n"
        b"The Calvin Cycle uses ATP and NADPH inside the chloroplast stroma to fix carbon dioxide via RuBisCO.\n\n"
        b"Chloroplasts contain stacked thylakoid membranes where light-dependent reactions produce oxygen."
    )
    up_doc = client.post(
        "/api/search/upload",
        files={"file": ("plant_bio.txt", notes_content, "text/plain")},
    )
    assert up_doc.status_code == 200
    doc_data = up_doc.json()
    assert doc_data["success"] is True
    doc_id = doc_data["document_id"]

    docs_list = client.get("/api/search/documents")
    assert docs_list.status_code == 200
    assert any(d["document_id"] == doc_id for d in docs_list.json()["documents"])

    search_res = client.get(
        "/api/search/search",
        params={"query": "What is photosynthesis and chlorophyll?", "document_id": doc_id},
    )
    assert search_res.status_code == 200
    assert search_res.json()["success"] is True
    assert len(search_res.json()["results"]) >= 1

    ask_res = client.post(
        "/api/search/ask",
        json={"document_id": doc_id, "question": "Where does the Calvin Cycle occur?"},
    )
    assert ask_res.status_code == 200
    assert len(ask_res.json()["sources"]) >= 1

    # Smart Search QA endpoints (/api/qa/ask and /api/qa/search-all)
    qa_ask_res = client.post(
        "/api/qa/ask",
        json={
            "documentTitle": "plant_bio.txt",
            "question": "Where does the Calvin Cycle occur?",
            "pages": [
                {"pageNumber": 1, "title": "Photosynthesis", "content": "The Calvin Cycle uses ATP and NADPH inside the chloroplast stroma to fix carbon dioxide."}
            ]
        },
    )
    assert qa_ask_res.status_code == 200
    qa_body = qa_ask_res.json()
    assert qa_body["foundInDocument"] is True
    assert len(qa_body["citations"]) >= 1

    qa_all_res = client.post(
        "/api/qa/search-all",
        json={
            "question": "What is RuBisCO and carbon dioxide fixation?",
            "documents": [
                {
                    "id": str(doc_id),
                    "title": "plant_bio.txt",
                    "fileName": "plant_bio.txt",
                    "pages": [
                        {"pageNumber": 1, "title": "Photosynthesis", "content": "The Calvin Cycle uses ATP and NADPH inside the chloroplast stroma to fix carbon dioxide via RuBisCO."}
                    ]
                }
            ]
        },
    )
    assert qa_all_res.status_code == 200
    assert qa_all_res.json()["foundInDocument"] is True
    assert len(qa_all_res.json()["citations"]) >= 1

    # 2. Quiz Master: MCQ, True/False, Flashcards from uploaded document
    for q_type in ("mcq", "true_false", "flashcard"):
        q_res = client.post(
            "/api/quiz/generate",
            json={
                "document_id": doc_id,
                "question_count": 3,
                "difficulty": "medium",
                "type": q_type,
            },
        )
        assert q_res.status_code == 200
        q_body = q_res.json()
        assert q_body["success"] is True
        assert len(q_body["questions"]) == 3
        if q_type == "mcq":
            assert set(q_body["questions"][0]["options"].keys()) == {"A", "B", "C", "D"}

    # 3. Brain Map: generate NetworkX graph + PyVis HTML export
    bm_res = client.post("/api/brainmap/generate", json={"document_id": doc_id})
    assert bm_res.status_code == 200
    bm_body = bm_res.json()
    assert bm_body["success"] is True
    assert len(bm_body["nodes"]) >= 2
    valid_ids = {n["id"] for n in bm_body["nodes"]}
    for edge in bm_body["edges"]:
        assert edge["source"] in valid_ids
        assert edge["target"] in valid_ids

    pyvis_res = client.get(f"/api/brainmap/{doc_id}/pyvis")
    assert pyvis_res.status_code == 200
    assert "<html" in pyvis_res.text.lower()

    # 4. Data Storyteller: upload CSV -> analyze with Pandas & Plotly
    csv_bytes = b"temperature,growth,yield_score\n20,18.5,62\n25,32.0,80\n30,45.2,92\n35,38.1,78\n"
    ds_up = client.post(
        "/api/data/upload",
        files={"file": ("lab_exp.csv", csv_bytes, "text/csv")},
    )
    assert ds_up.status_code == 200
    dataset_id = ds_up.json()["dataset_id"]

    ds_an = client.post("/api/data/analyze", json={"dataset_id": dataset_id})
    assert ds_an.status_code == 200
    an_body = ds_an.json()
    assert bool(an_body["success"]) is True
    assert an_body["summary"]["rows"] == 4
    assert an_body["summary"]["columns"] == 3
    assert "temperature" in an_body["columns"]
    assert len(an_body["charts"]) >= 1
    assert an_body["ai_summary"]
