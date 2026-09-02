from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile


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

    return {
        "success": True,
        "document_id": 1,
        "filename": file.filename,
        "message": "Document uploaded successfully",
    }