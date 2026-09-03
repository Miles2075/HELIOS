from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile

from backend.core.database import get_connection
from backend.smart_search.pdf_utils import extract_text_by_page


router = APIRouter(
    prefix="/api/search",
    tags=["Smart Search"],
)


UPLOAD_DIR = Path("uploads/documents")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


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

    with open(file_path, "wb") as output_file:
        output_file.write(contents)

    extracted_pages = []

    if extension == ".pdf":
        extracted_pages = extract_text_by_page(file_path)

        connection = get_connection()

    cursor = connection.execute(
        """
        INSERT INTO documents (filename, file_path)
        VALUES (?, ?)
        """,
        (file.filename, str(file_path)),
    )

    document_id = cursor.lastrowid

    for page in extracted_pages:
        connection.execute(
            """
            INSERT INTO document_pages (document_id, page_number, text)
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

    return {
    "success": True,
    "document_id": document_id,
    "filename": file.filename,
    "pages_extracted": len(extracted_pages),
    "message": "Document uploaded successfully",
}