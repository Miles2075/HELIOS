from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile

from backend.core.database import get_connection
from backend.smart_search.pdf_utils import extract_text_by_page
from backend.smart_search.embedding_utils import generate_embedding
from backend.smart_search.vector_store import collection
from backend.smart_search.gemini_utils import generate_answer


router = APIRouter(
    prefix="/api/search",
    tags=["Smart Search"],
)


UPLOAD_DIR = Path("uploads/documents")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_DISTANCE_THRESHOLD = 0.8


@router.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="No file provided",
        )

    allowed_extensions = {".pdf", ".txt"}
    extension = Path(file.filename).suffix.lower()

    if extension not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail="Only PDF and TXT files are supported",
        )

    file_path = UPLOAD_DIR / file.filename

    contents = await file.read()

    # ---------------------------------------------------------
    # 1. Check whether this document already exists
    # ---------------------------------------------------------

    connection = get_connection()

    existing_document = connection.execute(
        """
        SELECT id
        FROM documents
        WHERE filename = ?
        """,
        (file.filename,),
    ).fetchone()

    if existing_document:
        old_document_id = existing_document["id"]

        # Remove old vectors from ChromaDB
        old_vectors = collection.get(
            where={
                "document_id": old_document_id
            }
        )

        old_ids = old_vectors.get("ids", [])

        if old_ids:
            collection.delete(ids=old_ids)

        # Remove old pages from SQLite
        connection.execute(
            """
            DELETE FROM document_pages
            WHERE document_id = ?
            """,
            (old_document_id,),
        )

        # Remove old document record
        connection.execute(
            """
            DELETE FROM documents
            WHERE id = ?
            """,
            (old_document_id,),
        )

        connection.commit()

    connection.close()

    # ---------------------------------------------------------
    # 2. Save the uploaded file
    # ---------------------------------------------------------

    with open(file_path, "wb") as output_file:
        output_file.write(contents)

    # ---------------------------------------------------------
    # 3. Extract text
    # ---------------------------------------------------------

    extracted_pages = []

    if extension == ".pdf":
        extracted_pages = extract_text_by_page(file_path)

    elif extension == ".txt":
        text = contents.decode("utf-8", errors="ignore")

        extracted_pages = [
            {
                "page": 1,
                "text": text,
            }
        ]

    print("DEBUG extracted_pages:", len(extracted_pages))

    # ---------------------------------------------------------
    # 4. Save document to SQLite
    # ---------------------------------------------------------

    connection = get_connection()

    cursor = connection.execute(
        """
        INSERT INTO documents (filename, file_path)
        VALUES (?, ?)
        """,
        (
            file.filename,
            str(file_path),
        ),
    )

    document_id = cursor.lastrowid

    # ---------------------------------------------------------
    # 5. Save pages to SQLite
    # ---------------------------------------------------------

    for page in extracted_pages:

        connection.execute(
            """
            INSERT INTO document_pages (
                document_id,
                page_number,
                text
            )
            VALUES (?, ?, ?)
            """,
            (
                document_id,
                page["page"],
                page["text"],
            ),
        )

    connection.commit()
    connection.close()

    # ---------------------------------------------------------
    # 6. Generate embeddings and store in ChromaDB
    # ---------------------------------------------------------

    embedded_pages = 0

    for page in extracted_pages:

        print(
            "DEBUG page:",
            page["page"],
            "text length:",
            len(page["text"]),
        )

        # Ignore empty pages
        if not page["text"].strip():
            continue

        embedding = generate_embedding(page["text"])

        collection.add(
            ids=[
                f"{document_id}-{page['page']}"
            ],
            embeddings=[
                embedding
            ],
            documents=[
                page["text"]
            ],
            metadatas=[
                {
                    "document_id": document_id,
                    "page_number": page["page"],
                    "filename": file.filename,
                }
            ],
        )

        embedded_pages += 1

    # ---------------------------------------------------------
    # 7. Return upload result
    # ---------------------------------------------------------

    return {
        "success": True,
        "document_id": document_id,
        "filename": file.filename,
        "pages_extracted": len(extracted_pages),
        "pages_embedded": embedded_pages,
        "message": "Document uploaded successfully",
    }


@router.get("/search")
def search_documents(
    query: str,
    top_k: int = 5,
):

    # ---------------------------------------------------------
    # 1. Convert query into embedding
    # ---------------------------------------------------------

    query_embedding = generate_embedding(query)

    # ---------------------------------------------------------
    # 2. Search ChromaDB
    # ---------------------------------------------------------

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=top_k,
        include=[
            "documents",
            "metadatas",
            "distances",
        ],
    )

    matches = []

    documents = results["documents"][0]
    metadatas = results["metadatas"][0]
    distances = results["distances"][0]

    # ---------------------------------------------------------
    # 3. Apply distance threshold
    # ---------------------------------------------------------

    for i, document in enumerate(documents):

        distance = distances[i]

        # Lower distance = more similar
        if distance > MAX_DISTANCE_THRESHOLD:
            continue

        metadata = metadatas[i]

        matches.append(
            {
                "text": document,
                "document_id": metadata["document_id"],
                "page_number": metadata["page_number"],
                "filename": metadata["filename"],
                "distance": distance,
            }
        )

    # ---------------------------------------------------------
    # 4. No relevant results
    # ---------------------------------------------------------

    if not matches:

        return {
            "success": True,
            "query": query,
            "answer": (
                "No sufficiently relevant information "
                "was found in the uploaded documents."
            ),
            "results": [],
        }

    # ---------------------------------------------------------
    # 5. Generate final answer with Gemini
    # ---------------------------------------------------------

    answer = generate_answer(
        query=query,
        retrieved_chunks=matches,
    )

    # ---------------------------------------------------------
    # 6. Return answer + source chunks
    # ---------------------------------------------------------

    return {
        "success": True,
        "query": query,
        "answer": answer,
        "results": matches,
    }