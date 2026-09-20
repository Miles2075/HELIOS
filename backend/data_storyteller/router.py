from pathlib import Path
from uuid import uuid4
import io

import pandas as pd
from fastapi import APIRouter, UploadFile, File, HTTPException

from .database import initialize_database, create_dataset
from .database import initialize_database, create_dataset, get_dataset
from .schemas import AnalyzeRequest


router = APIRouter(
    prefix="/api/data",
    tags=["Data Storyteller"]
)


# Create the database/table when this module loads
initialize_database()


# Folder where uploaded files will be stored
BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "storage" / "uploads"

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

def load_dataset(file_path: str):
    path = Path(file_path)

    if path.suffix.lower() == ".csv":
        return pd.read_csv(path)

    if path.suffix.lower() == ".xlsx":
        return pd.read_excel(path)

    raise ValueError("Unsupported file format")


@router.post("/upload")
async def upload_dataset(file: UploadFile = File(...)):

    # Check filename
    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="No file provided"
        )

    # Get only the filename, without any possible path
    original_filename = Path(file.filename).name
    filename = original_filename.lower()

    # Validate file type
    if not (
        filename.endswith(".csv")
        or filename.endswith(".xlsx")
    ):
        raise HTTPException(
            status_code=400,
            detail="Only CSV and XLSX files are supported"
        )

    # Read uploaded file
    contents = await file.read()

    # Make sure file is not empty
    if not contents:
        raise HTTPException(
            status_code=400,
            detail="The uploaded file is empty"
        )

    # Validate that Pandas can actually read the dataset
    try:
        if filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(contents))
        else:
            df = pd.read_excel(io.BytesIO(contents))

    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Unable to read the uploaded dataset"
        )

    # Check whether the dataset contains rows
    if df.empty:
        raise HTTPException(
            status_code=400,
            detail="The uploaded dataset is empty"
        )

    # Create a unique stored filename
    stored_filename = f"{uuid4()}_{original_filename}"

    file_path = UPLOAD_DIR / stored_filename

    # Save the original uploaded file
    file_path.write_bytes(contents)

    # Store dataset information in SQLite
    dataset_id = create_dataset(
        original_filename,
        str(file_path)
    )

    return {
        "success": True,
        "dataset_id": dataset_id,
        "filename": original_filename,
        "message": "Dataset uploaded successfully"
    }

@router.post("/analyze")
async def analyze_dataset(request: AnalyzeRequest):

    # Find dataset in SQLite
    dataset = get_dataset(request.dataset_id)

    if dataset is None:
        raise HTTPException(
            status_code=404,
            detail="Dataset not found"
        )

    dataset_id, filename, file_path = dataset

    # Load dataset
    try:
        df = load_dataset(file_path)

    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Unable to load dataset"
        )

    if df.empty:
        raise HTTPException(
            status_code=400,
            detail="Dataset is empty"
        )

    # Basic summary
    summary = {
        "rows": int(df.shape[0]),
        "columns": int(df.shape[1])
    }

    # Column information
    column_info = {}

    for column in df.columns:

        column_info[column] = {
            "data_type": str(df[column].dtype),
            "missing_values": int(df[column].isna().sum()),
            "unique_values": int(df[column].nunique())
        }

    # Numerical statistics
    numerical_columns = df.select_dtypes(
        include="number"
    ).columns

    statistics = {}

    for column in numerical_columns:

        statistics[column] = {
            "mean": float(df[column].mean()),
            "median": float(df[column].median()),
            "minimum": float(df[column].min()),
            "maximum": float(df[column].max()),
            "standard_deviation": float(df[column].std())
        }

    return {
        "success": True,
        "dataset_id": dataset_id,
        "filename": filename,
        "summary": summary,
        "columns": column_info,
        "statistics": statistics
    }