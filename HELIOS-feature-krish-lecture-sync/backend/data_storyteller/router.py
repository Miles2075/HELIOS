import io
from pathlib import Path
from typing import Any, Dict, List
from uuid import uuid4

import pandas as pd
import plotly.express as px
from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

from backend.core.database import get_connection, initialize_database
from backend.core.gemini_client import generate_text

router = APIRouter(prefix="/api/data", tags=["Data Storyteller"])

initialize_database()

UPLOAD_DIR = Path("uploads") / "datasets"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


class AnalyzeRequest(BaseModel):
    dataset_id: int


def _read_dataframe(file_path: Path) -> pd.DataFrame:
    ext = file_path.suffix.lower()
    if ext == ".csv":
        return pd.read_csv(file_path)
    if ext == ".xlsx":
        return pd.read_excel(file_path)
    raise ValueError("Unsupported dataset format. Only CSV and XLSX files are accepted.")


def _safe_float(value: Any) -> float:
    try:
        if pd.isna(value):
            return 0.0
        return round(float(value), 4)
    except Exception:
        return 0.0


def _clean_dataframe(df: pd.DataFrame) -> tuple[pd.DataFrame, Dict[str, int]]:
    """Automatically cleans column names, empty rows/columns, string whitespace, and exact duplicates."""
    cleaned = df.copy()
    cleaned.columns = [str(c).strip() for c in cleaned.columns]
    rows_before = len(cleaned)
    cleaned = cleaned.dropna(how="all")
    empty_rows_dropped = rows_before - len(cleaned)
    cleaned = cleaned.dropna(axis=1, how="all")

    for col in cleaned.select_dtypes(include=["object", "string"]).columns:
        cleaned[col] = cleaned[col].map(lambda v: v.strip() if isinstance(v, str) else v)

    before_dedup = len(cleaned)
    cleaned = cleaned.drop_duplicates()
    duplicates_removed = before_dedup - len(cleaned)

    missing_values_count = int(cleaned.isna().sum().sum())
    return cleaned.reset_index(drop=True), {
        "empty_rows_dropped": int(empty_rows_dropped),
        "duplicates_removed": int(duplicates_removed),
        "missing_values_detected": missing_values_count,
    }


def _build_plotly_charts(df: pd.DataFrame, numeric_cols: List[str], all_cols: List[str]) -> List[Dict[str, Any]]:
    charts: List[Dict[str, Any]] = []
    if len(numeric_cols) >= 2:
        x_col, y_col = numeric_cols[0], numeric_cols[1]
        fig_scatter = px.scatter(df, x=x_col, y=y_col, title=f"{x_col} vs {y_col}")
        charts.append(
            {
                "type": "scatter",
                "x": x_col,
                "y": y_col,
                "title": f"{x_col} vs {y_col}",
                "plotly_json": fig_scatter.to_dict(),
            }
        )
        target_y = numeric_cols[-1]
        fig_bar = px.bar(df, x=x_col, y=target_y, title=f"{target_y} across {x_col}")
        charts.append(
            {
                "type": "bar",
                "x": x_col,
                "y": target_y,
                "title": f"{target_y} across {x_col}",
                "plotly_json": fig_bar.to_dict(),
            }
        )
        fig_pie = px.pie(df, names=x_col, values=target_y, title=f"{target_y} distribution by {x_col}")
        charts.append(
            {
                "type": "pie",
                "x": x_col,
                "y": target_y,
                "title": f"{target_y} share by {x_col}",
                "plotly_json": fig_pie.to_dict(),
            }
        )
    elif len(numeric_cols) == 1 and len(all_cols) >= 1:
        x_col = all_cols[0]
        y_col = numeric_cols[0]
        fig_bar = px.bar(df, x=x_col, y=y_col, title=f"{y_col} by {x_col}")
        charts.append(
            {
                "type": "bar",
                "x": x_col,
                "y": y_col,
                "title": f"{y_col} by {x_col}",
                "plotly_json": fig_bar.to_dict(),
            }
        )
        fig_pie = px.pie(df, names=x_col, values=y_col, title=f"{y_col} share by {x_col}")
        charts.append(
            {
                "type": "pie",
                "x": x_col,
                "y": y_col,
                "title": f"{y_col} share by {x_col}",
                "plotly_json": fig_pie.to_dict(),
            }
        )
    return charts


@router.get("/list")
def list_datasets():
    connection = get_connection()
    try:
        rows = connection.execute(
            "SELECT id AS dataset_id, filename, uploaded_at FROM datasets ORDER BY id DESC"
        ).fetchall()
        return {
            "success": True,
            "datasets": [dict(r) for r in rows],
        }
    finally:
        connection.close()


@router.post("/upload")
async def upload_dataset(file: UploadFile = File(...)):
    original_filename = Path(file.filename or "").name
    ext = Path(original_filename).suffix.lower()
    if not original_filename or ext not in {".csv", ".xlsx"}:
        raise HTTPException(
            status_code=400,
            detail="Only CSV and XLSX files are supported.",
        )

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    try:
        df = pd.read_csv(io.BytesIO(contents)) if ext == ".csv" else pd.read_excel(io.BytesIO(contents))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Unable to read uploaded dataset: {exc}")

    if df.empty:
        raise HTTPException(status_code=400, detail="The uploaded dataset contains no rows.")

    stored_name = f"{uuid4().hex[:10]}_{original_filename}"
    file_path = UPLOAD_DIR / stored_name
    file_path.write_bytes(contents)

    connection = get_connection()
    try:
        cursor = connection.execute(
            "INSERT INTO datasets (filename, file_path) VALUES (?, ?)",
            (original_filename, str(file_path)),
        )
        dataset_id = cursor.lastrowid
        connection.commit()
    finally:
        connection.close()

    return {
        "success": True,
        "dataset_id": dataset_id,
        "filename": original_filename,
        "message": "Dataset uploaded successfully",
    }


@router.post("/analyze")
async def analyze_dataset(request: AnalyzeRequest):
    connection = get_connection()
    try:
        row = connection.execute(
            "SELECT id, filename, file_path FROM datasets WHERE id = ?",
            (request.dataset_id,),
        ).fetchone()
    finally:
        connection.close()

    if not row:
        raise HTTPException(status_code=404, detail=f"Dataset with ID {request.dataset_id} not found.")

    try:
        raw_df = _read_dataframe(Path(row["file_path"]))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Unable to load dataset: {exc}")

    if raw_df.empty:
        raise HTTPException(status_code=400, detail="Dataset is empty.")

    df, cleaning_report = _clean_dataframe(raw_df)
    if df.empty:
        raise HTTPException(status_code=400, detail="Dataset contains no valid rows after cleaning.")

    summary = {"rows": int(df.shape[0]), "columns": int(df.shape[1])}

    columns_info: Dict[str, Dict[str, Any]] = {}
    for col in df.columns:
        columns_info[str(col)] = {
            "data_type": str(df[col].dtype),
            "missing_values": int(df[col].isna().sum()),
            "unique_values": int(df[col].nunique(dropna=True)),
        }

    numeric_cols = [str(c) for c in df.select_dtypes(include="number").columns]
    by_column_stats: Dict[str, Dict[str, float]] = {}
    for col in numeric_cols:
        series = df[col].dropna()
        by_column_stats[col] = {
            "mean": _safe_float(series.mean()),
            "median": _safe_float(series.median()),
            "min": _safe_float(series.min()),
            "max": _safe_float(series.max()),
            "std": _safe_float(series.std(ddof=0)),
        }

    primary_col = numeric_cols[-1] if numeric_cols else None
    primary_stats = (
        by_column_stats[primary_col]
        if primary_col
        else {"mean": 0.0, "median": 0.0, "min": 0.0, "max": 0.0, "std": 0.0}
    )

    # Clean numeric preview rows (convert NaN to None for valid JSON)
    preview_df = df.head(50).where(pd.notnull(df.head(50)), None)
    preview_rows = preview_df.to_dict(orient="records")

    charts = _build_plotly_charts(df, numeric_cols, [str(c) for c in df.columns])

    # Generate AI summary via Gemini 3.8 Flash (with grounded local fallback)
    stats_prompt = (
        f"You are HELIOS Data Storyteller. Write a concise, insightful 3-sentence analytical summary "
        f"of the dataset '{row['filename']}' using ONLY these computed statistics:\n"
        f"Rows: {summary['rows']}, Columns: {summary['columns']}\n"
        f"Column profiles: {columns_info}\n"
        f"Numerical stats: {by_column_stats}"
    )
    ai_summary = generate_text(stats_prompt)
    if not ai_summary:
        missing_total = sum(v["missing_values"] for v in columns_info.values())
        if primary_col:
            ai_summary = (
                f"Analyzed {summary['rows']} rows across {summary['columns']} columns in {row['filename']} "
                f"({missing_total} missing values detected). "
                f"For '{primary_col}', the mean is {primary_stats['mean']}, median is {primary_stats['median']}, "
                f"ranging from {primary_stats['min']} to {primary_stats['max']} (std dev {primary_stats['std']})."
            )
        else:
            ai_summary = (
                f"Analyzed {summary['rows']} rows across {summary['columns']} categorical columns in {row['filename']} "
                f"with {missing_total} missing values."
            )

    return {
        "success": True,
        "dataset_id": row["id"],
        "filename": row["filename"],
        "summary": summary,
        "cleaning_report": cleaning_report,
        "columns": columns_info,
        "statistics": {
            "mean": primary_stats["mean"],
            "median": primary_stats["median"],
            "min": primary_stats["min"],
            "max": primary_stats["max"],
            "std": primary_stats["std"],
            "primary_column": primary_col,
            "by_column": by_column_stats,
        },
        "charts": charts,
        "ai_summary": ai_summary,
        "parsed": {
            "headers": [str(c) for c in df.columns],
            "rows": preview_rows,
        },
    }
