import math
import re
from collections import Counter
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from pydantic import BaseModel

from backend.core.database import get_connection, initialize_database
from backend.core.gemini_client import generate_text

router = APIRouter(prefix="/api/search", tags=["Smart Search"])

initialize_database()

UPLOAD_DIR = Path("uploads") / "documents"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {".pdf", ".txt"}
MAX_DISTANCE_THRESHOLD = 0.72

QUERY_STOP_WORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "can", "define", "describe",
    "did", "do", "does", "explain", "for", "from", "give", "how", "in", "into",
    "is", "it", "its", "me", "of", "on", "or", "tell", "that", "the", "their",
    "there", "these", "this", "to", "was", "were", "what", "when", "where",
    "which", "who", "why", "with", "about",
}

_chroma_collection = None


def _get_chroma_collection():
    """
    Lazily initializes local ChromaDB with its built-in all-MiniLM-L6-v2 ONNX
    embedding function (100% free & local).
    """
    global _chroma_collection
    if _chroma_collection is not None:
        return _chroma_collection
    try:
        import chromadb
        from chromadb.utils import embedding_functions

        client = chromadb.PersistentClient(path="backend/chroma_db")
        ef = embedding_functions.DefaultEmbeddingFunction()
        _chroma_collection = client.get_or_create_collection(
            name="helios_documents",
            embedding_function=ef,
            metadata={"hnsw:space": "cosine"},
        )
        return _chroma_collection
    except Exception:
        return None


def index_document_in_chroma(document_id: int, filename: str, pages: List[Dict[str, Any]]) -> int:
    """Embeds and upserts a document's pages into local ChromaDB."""
    collection = _get_chroma_collection()
    if collection is None:
        return 0
    ids, docs, metas = [], [], []
    for page in pages:
        text = (page.get("text") or "").strip()
        if text:
            ids.append(f"{document_id}-{page['page']}")
            docs.append(text)
            metas.append(
                {
                    "document_id": int(document_id),
                    "page_number": int(page["page"]),
                    "filename": filename,
                }
            )
    if not ids:
        return 0
    try:
        collection.upsert(ids=ids, documents=docs, metadatas=metas)
        return len(ids)
    except Exception:
        return 0


def sync_sqlite_docs_to_chroma() -> None:
    """Ensures any SQLite documents (including initial seeded docs) are indexed in ChromaDB."""
    collection = _get_chroma_collection()
    if collection is None:
        return
    connection = get_connection()
    try:
        docs = connection.execute("SELECT id, filename FROM documents").fetchall()
        for doc in docs:
            existing = collection.get(where={"document_id": int(doc["id"])})
            if existing.get("ids"):
                continue
            pages = connection.execute(
                "SELECT page_number AS page, text FROM document_pages WHERE document_id = ? ORDER BY page_number ASC",
                (doc["id"],),
            ).fetchall()
            index_document_in_chroma(
                doc["id"],
                doc["filename"],
                [{"page": p["page"], "text": p["text"]} for p in pages],
            )
    except Exception:
        pass
    finally:
        connection.close()


def _extract_pages(file_path: Path, extension: str, raw_bytes: bytes) -> List[Dict[str, Any]]:
    if extension == ".pdf":
        from pypdf import PdfReader

        reader = PdfReader(str(file_path))
        pages = []
        for idx, page in enumerate(reader.pages, start=1):
            text = (page.extract_text() or "").strip()
            pages.append({"page": idx, "text": text})
        return pages

    decoded = raw_bytes.decode("utf-8", errors="ignore").strip()
    if not decoded:
        return []
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", decoded) if p.strip()]
    pages = []
    current_chunk: List[str] = []
    current_len = 0
    for para in paragraphs:
        if current_len + len(para) > 1500 and current_chunk:
            pages.append({"page": len(pages) + 1, "text": "\n\n".join(current_chunk)})
            current_chunk = [para]
            current_len = len(para)
        else:
            current_chunk.append(para)
            current_len += len(para)
    if current_chunk:
        pages.append({"page": len(pages) + 1, "text": "\n\n".join(current_chunk)})
    return pages


def _tokenize_keywords(text: str) -> List[str]:
    return [
        w for w in re.findall(r"[a-z0-9]{2,}", text.lower())
        if w not in QUERY_STOP_WORDS
    ]


def _local_cosine_search(
    query: str,
    top_k: int,
    document_id: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """Stop-word-filtered keyword & coverage similarity fallback over SQLite pages."""
    connection = get_connection()
    try:
        if document_id is not None:
            rows = connection.execute(
                """
                SELECT dp.document_id, dp.page_number, dp.text, d.filename
                FROM document_pages dp
                JOIN documents d ON d.id = dp.document_id
                WHERE dp.document_id = ?
                """,
                (document_id,),
            ).fetchall()
        else:
            rows = connection.execute(
                """
                SELECT dp.document_id, dp.page_number, dp.text, d.filename
                FROM document_pages dp
                JOIN documents d ON d.id = dp.document_id
                """
            ).fetchall()
    finally:
        connection.close()

    q_words = _tokenize_keywords(query)
    if not q_words or not rows:
        return []
    q_unique = set(q_words)
    q_counts = Counter(q_words)
    q_norm = math.sqrt(sum(v * v for v in q_counts.values()))

    scored = []
    for r in rows:
        d_words = _tokenize_keywords(r["text"])
        if not d_words:
            continue
        d_counts = Counter(d_words)
        matched = [t for t in q_unique if t in d_counts or any(t in dw or dw in t for dw in d_counts if len(t) >= 4)]
        if not matched:
            continue
        coverage = len(matched) / len(q_unique)
        dot = sum(q_counts[t] * d_counts.get(t, 0) for t in q_counts)
        d_norm = math.sqrt(sum(v * v for v in d_counts.values()))
        cosine = dot / (q_norm * d_norm) if d_norm > 0 else 0.0
        blended_sim = min(0.96, 0.72 * coverage + 0.28 * min(1.0, cosine * 2.0))
        distance = round(max(0.05, 1.0 - blended_sim), 3)
        if distance <= MAX_DISTANCE_THRESHOLD:
            scored.append(
                {
                    "text": r["text"],
                    "document_id": r["document_id"],
                    "page_number": r["page_number"],
                    "filename": r["filename"],
                    "distance": distance,
                }
            )
    scored.sort(key=lambda x: x["distance"])
    return scored[:top_k]


def _synthesize_answer(query: str, matches: List[Dict[str, Any]]) -> str:
    context = "\n\n".join(
        f"[{m['filename']} - Page {m['page_number']}]\n{m['text']}" for m in matches[:4]
    )
    prompt = (
        "You are HELIOS Smart Search, an academic research assistant. "
        "Answer the user's question strictly using ONLY the provided document excerpts. "
        "Cite exact page numbers in brackets like [Page 2]. "
        "If the context does not answer the question, state that clearly.\n\n"
        f"Context:\n{context}\n\nQuestion: {query}\nAnswer:"
    )
    gemini_answer = generate_text(prompt)
    if gemini_answer:
        return gemini_answer

    snippets = []
    for m in matches[:2]:
        excerpt = m["text"].strip().replace("\n", " ")
        if len(excerpt) > 340:
            excerpt = excerpt[:337].rsplit(" ", 1)[0] + "..."
        snippets.append(f"{excerpt} [{m['filename']}, Page {m['page_number']}]")
    return " ".join(snippets)


def _perform_search(query: str, top_k: int = 5, document_id: Optional[int] = None):
    matches: List[Dict[str, Any]] = []
    collection = _get_chroma_collection()

    if collection is not None and collection.count() > 0:
        try:
            where_filter = {"document_id": int(document_id)} if document_id is not None else None
            # Count matching records safely to avoid ChromaDB n_results > count warnings
            if where_filter:
                available = len(collection.get(where=where_filter).get("ids", []))
            else:
                available = collection.count()
            if available > 0:
                res = collection.query(
                    query_texts=[query],
                    n_results=min(top_k, available),
                    where=where_filter,
                    include=["documents", "metadatas", "distances"],
                )
                docs = (res.get("documents") or [[]])[0]
                metas = (res.get("metadatas") or [[]])[0]
                dists = (res.get("distances") or [[]])[0]

                for doc_text, meta, dist in zip(docs, metas, dists):
                    if float(dist) <= MAX_DISTANCE_THRESHOLD:
                        matches.append(
                            {
                                "text": doc_text,
                                "document_id": int(meta["document_id"]),
                                "page_number": int(meta["page_number"]),
                                "filename": str(meta["filename"]),
                                "distance": round(float(dist), 3),
                            }
                        )
        except Exception:
            matches = []

    if not matches:
        matches = _local_cosine_search(query, top_k=top_k, document_id=document_id)

    if not matches:
        return {
            "success": True,
            "query": query,
            "answer": "No sufficiently relevant information was found in the uploaded documents.",
            "results": [],
        }

    answer = _synthesize_answer(query, matches)
    return {
        "success": True,
        "query": query,
        "answer": answer,
        "results": matches,
    }


class AskRequest(BaseModel):
    document_id: int
    question: str


@router.get("/documents")
def list_documents():
    connection = get_connection()
    try:
        rows = connection.execute(
            """
            SELECT d.id AS document_id, d.filename, d.uploaded_at, COUNT(dp.id) AS pages
            FROM documents d
            LEFT JOIN document_pages dp ON dp.document_id = d.id
            GROUP BY d.id
            ORDER BY d.id DESC
            """
        ).fetchall()
        return {
            "success": True,
            "documents": [
                {
                    "document_id": r["document_id"],
                    "filename": r["filename"],
                    "pages": r["pages"],
                    "ingested": True,
                    "uploaded_at": r["uploaded_at"],
                }
                for r in rows
            ],
        }
    finally:
        connection.close()


@router.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    original_filename = Path(file.filename or "").name
    extension = Path(original_filename).suffix.lower()

    if not original_filename or extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Only PDF and TXT files are supported.",
        )

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded document is empty.")

    file_path = UPLOAD_DIR / original_filename
    file_path.write_bytes(contents)

    try:
        extracted_pages = _extract_pages(file_path, extension, contents)
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Unable to extract text from document: {exc}",
        )

    if not extracted_pages:
        raise HTTPException(
            status_code=400,
            detail="No readable text content found in the uploaded document.",
        )

    connection = get_connection()
    collection = _get_chroma_collection()
    try:
        existing = connection.execute(
            "SELECT id FROM documents WHERE filename = ?",
            (original_filename,),
        ).fetchone()
        if existing:
            old_id = existing["id"]
            if collection is not None:
                try:
                    old_vecs = collection.get(where={"document_id": int(old_id)})
                    if old_vecs.get("ids"):
                        collection.delete(ids=old_vecs["ids"])
                except Exception:
                    pass
            connection.execute("DELETE FROM document_pages WHERE document_id = ?", (old_id,))
            connection.execute("DELETE FROM documents WHERE id = ?", (old_id,))

        cursor = connection.execute(
            "INSERT INTO documents (filename, file_path) VALUES (?, ?)",
            (original_filename, str(file_path)),
        )
        document_id = cursor.lastrowid

        for page in extracted_pages:
            connection.execute(
                "INSERT INTO document_pages (document_id, page_number, text) VALUES (?, ?, ?)",
                (document_id, page["page"], page["text"]),
            )
        connection.commit()
    finally:
        connection.close()

    embedded_pages = index_document_in_chroma(document_id, original_filename, extracted_pages)

    return {
        "success": True,
        "document_id": document_id,
        "filename": original_filename,
        "pages_extracted": len(extracted_pages),
        "pages_embedded": embedded_pages or len(extracted_pages),
        "message": "Document uploaded successfully",
    }


@router.get("/search")
def search_documents(
    query: str = Query(..., min_length=1),
    top_k: int = Query(5, ge=1, le=20),
    document_id: Optional[int] = Query(None),
):
    return _perform_search(query=query.strip(), top_k=top_k, document_id=document_id)


@router.post("/ask")
def ask_document(payload: AskRequest):
    result = _perform_search(
        query=payload.question.strip(),
        top_k=5,
        document_id=payload.document_id,
    )
    return {
        "success": result["success"],
        "answer": result["answer"],
        "sources": [
            {
                "document": r["filename"],
                "page": r["page_number"],
                "text": r["text"],
                "distance": r["distance"],
            }
            for r in result["results"]
        ],
    }
