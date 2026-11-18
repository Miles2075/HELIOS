import io
import math
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
from uuid import uuid4

import numpy as np
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


def _safe_float(value: Any) -> float:
    try:
        if value is None or pd.isna(value):
            return 0.0
        val = float(value)
        if math.isnan(val) or math.isinf(val):
            return 0.0
        return round(val, 4)
    except Exception:
        return 0.0


def sanitize_for_json(data: Any) -> Any:
    """Recursively replaces NaN, Inf, NaT, and numpy arrays with JSON-compliant primitives."""
    if data is None or data is pd.NaT:
        return None
    if isinstance(data, np.ndarray):
        return [sanitize_for_json(x) for x in data.tolist()]
    if isinstance(data, dict):
        return {str(k): sanitize_for_json(v) for k, v in data.items()}
    if isinstance(data, (list, tuple, set)):
        return [sanitize_for_json(v) for v in data]
    if isinstance(data, (float, np.floating)):
        val = float(data)
        if math.isnan(val) or math.isinf(val):
            return None
        return val
    if isinstance(data, (int, np.integer)):
        return int(data)
    if isinstance(data, (bool, np.bool_)):
        return bool(data)
    if isinstance(data, (pd.Timestamp, datetime)):
        try:
            if pd.isna(data):
                return None
            return data.isoformat()
        except Exception:
            return str(data)
    try:
        if pd.isna(data):
            return None
    except Exception:
        pass
    return data


def _smart_read_dataframe(file_path: Path) -> pd.DataFrame:
    ext = file_path.suffix.lower()
    if ext == ".csv":
        try:
            df = pd.read_csv(file_path)
        except UnicodeDecodeError:
            df = pd.read_csv(file_path, encoding="latin-1")
        # Check if first row is metadata or preamble
        unnamed_cols = [c for c in df.columns if str(c).startswith("Unnamed:")]
        if len(unnamed_cols) > len(df.columns) / 2 and len(df) > 1:
            try:
                raw = pd.read_csv(file_path, header=None)
                best_idx, best_cnt = 0, 0
                for i in range(min(8, len(raw))):
                    vals = [str(v).strip() for v in raw.iloc[i].dropna().tolist() if str(v).strip()]
                    if len(vals) > best_cnt and len(vals) >= 2:
                        best_cnt, best_idx = len(vals), i
                if best_idx > 0:
                    df = pd.read_csv(file_path, skiprows=best_idx)
            except Exception:
                pass
        return df

    if ext == ".xlsx":
        try:
            raw = pd.read_excel(file_path, header=None)
            best_idx, best_cnt = 0, 0
            for i in range(min(8, len(raw))):
                vals = [
                    str(v).strip()
                    for v in raw.iloc[i].dropna().tolist()
                    if str(v).strip() and not str(v).startswith("Unnamed:")
                ]
                if len(vals) > best_cnt and len(vals) >= 2:
                    best_cnt, best_idx = len(vals), i
            if best_idx > 0:
                return pd.read_excel(file_path, skiprows=best_idx)
            return pd.read_excel(file_path)
        except Exception:
            return pd.read_excel(file_path)

    raise ValueError("Unsupported dataset format. Only CSV and XLSX files are accepted.")


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


def _select_primary_metric(numeric_cols: List[str], df: pd.DataFrame) -> Optional[str]:
    if not numeric_cols:
        return None
    # Look for common performance/metric column keywords
    keywords = ["score", "rate", "pct", "percent", "hours", "value", "growth", "yield", "velocity", "loss", "accuracy"]
    for kw in keywords:
        for c in numeric_cols:
            if kw in c.lower() and "id" not in c.lower():
                return c
    # Fallback to non-ID numeric column
    non_id_cols = [c for c in numeric_cols if not c.lower().endswith("id") and not c.lower().startswith("id")]
    if non_id_cols:
        return non_id_cols[-1]
    return numeric_cols[-1]


def _build_plotly_charts(df: pd.DataFrame, numeric_cols: List[str], all_cols: List[str]) -> List[Dict[str, Any]]:
    charts: List[Dict[str, Any]] = []
    chart_df = df.copy()

    if len(numeric_cols) >= 2:
        x_col = numeric_cols[0]
        cat_cols = [c for c in all_cols if c not in numeric_cols and "id" not in c.lower()]
        target_y = _select_primary_metric(numeric_cols, df) or numeric_cols[-1]
        feature_x = cat_cols[0] if cat_cols else numeric_cols[0]

        try:
            fig_scatter = px.scatter(chart_df, x=x_col, y=target_y, title=f"{x_col} vs {target_y}")
            charts.append({
                "type": "scatter",
                "x": x_col,
                "y": target_y,
                "title": f"{x_col} vs {target_y}",
                "plotly_json": json.loads(fig_scatter.to_json()),
            })
        except Exception:
            pass

        try:
            fig_bar = px.bar(chart_df, x=feature_x, y=target_y, title=f"{target_y} across {feature_x}")
            charts.append({
                "type": "bar",
                "x": feature_x,
                "y": target_y,
                "title": f"{target_y} across {feature_x}",
                "plotly_json": json.loads(fig_bar.to_json()),
            })
        except Exception:
            pass

        try:
            fig_pie = px.pie(chart_df.head(15), names=feature_x, values=target_y, title=f"{target_y} distribution by {feature_x}")
            charts.append({
                "type": "pie",
                "x": feature_x,
                "y": target_y,
                "title": f"{target_y} share by {feature_x}",
                "plotly_json": json.loads(fig_pie.to_json()),
            })
        except Exception:
            pass

    elif len(numeric_cols) == 1 and len(all_cols) >= 1:
        x_col = all_cols[0]
        y_col = numeric_cols[0]
        try:
            fig_bar = px.bar(chart_df, x=x_col, y=y_col, title=f"{y_col} by {x_col}")
            charts.append({
                "type": "bar",
                "x": x_col,
                "y": y_col,
                "title": f"{y_col} by {x_col}",
                "plotly_json": json.loads(fig_bar.to_json()),
            })
        except Exception:
            pass

    return charts


def _analyze_df(raw_df: pd.DataFrame, dataset_id: int, filename: str) -> Dict[str, Any]:
    if raw_df.empty:
        raise HTTPException(status_code=400, detail="Dataset is empty.")

    df, cleaning_report = _clean_dataframe(raw_df)
    if df.empty:
        raise HTTPException(status_code=400, detail="Dataset contains no valid rows after cleaning.")

    summary = {
        "rows": int(df.shape[0]),
        "columns": int(df.shape[1]),
        "raw_rows": int(raw_df.shape[0]),
    }

    columns_info: Dict[str, Dict[str, Any]] = {}
    for col in df.columns:
        series = df[col]
        non_null = series.dropna()
        sample_vals = [str(v) for v in non_null.unique()[:3]]
        columns_info[str(col)] = {
            "data_type": str(series.dtype),
            "missing_values": int(series.isna().sum()),
            "unique_values": int(series.nunique(dropna=True)),
            "sample_values": sample_vals,
        }

    numeric_cols = [str(c) for c in df.select_dtypes(include="number").columns]
    by_column_stats: Dict[str, Dict[str, float]] = {}
    for col in numeric_cols:
        series = df[col].dropna()
        if len(series) > 0:
            by_column_stats[col] = {
                "mean": _safe_float(series.mean()),
                "median": _safe_float(series.median()),
                "min": _safe_float(series.min()),
                "max": _safe_float(series.max()),
                "std": _safe_float(series.std(ddof=0)),
            }
        else:
            by_column_stats[col] = {"mean": 0.0, "median": 0.0, "min": 0.0, "max": 0.0, "std": 0.0}

    primary_col = _select_primary_metric(numeric_cols, df)
    primary_stats = (
        by_column_stats[primary_col]
        if primary_col
        else {"mean": 0.0, "median": 0.0, "min": 0.0, "max": 0.0, "std": 0.0}
    )

    # Clean rows for preview (convert all types safely)
    preview_rows = []
    headers = [str(c) for c in df.columns]
    for _, row in df.head(100).iterrows():
        row_dict = {}
        for h in headers:
            val = row[h]
            if pd.isna(val) or val is None or val is pd.NaT:
                row_dict[h] = None
            elif isinstance(val, (np.floating, float)):
                row_dict[h] = None if (math.isnan(val) or math.isinf(val)) else round(float(val), 4)
            elif isinstance(val, (np.integer, int)):
                row_dict[h] = int(val)
            elif isinstance(val, (pd.Timestamp, datetime)):
                row_dict[h] = val.isoformat()
            else:
                row_dict[h] = str(val)
        preview_rows.append(row_dict)

    charts = _build_plotly_charts(df, numeric_cols, headers)

    # Categorical breakdown
    cat_cols = [c for c in headers if c not in numeric_cols]
    cat_summary_str = ""
    if cat_cols:
        top_cat = cat_cols[0]
        top_counts = df[top_cat].dropna().value_counts()
        if not top_counts.empty:
            cat_summary_str = f"Categorical breakdown for '{top_cat}' is led by '{top_counts.index[0]}' ({int(top_counts.iloc[0])} records, {len(top_counts)} categories)."

    # Grounded AI Analytical Summary
    stats_prompt = (
        f"You are HELIOS Data Storyteller. Write a concise, insightful 3-sentence analytical summary "
        f"of the dataset '{filename}' using ONLY these computed statistics:\n"
        f"Rows: {summary['rows']}, Columns: {summary['columns']}\n"
        f"Column profiles: {columns_info}\n"
        f"Numerical stats: {by_column_stats}\n"
        f"Categorical info: {cat_summary_str}"
    )
    ai_summary = generate_text(stats_prompt)
    if not ai_summary:
        missing_total = sum(v["missing_values"] for v in columns_info.values())
        if primary_col:
            ai_summary = (
                f"Analyzed {summary['rows']} observations across {summary['columns']} attributes in '{filename}' "
                f"({missing_total} missing values handled). For '{primary_col}', values average {primary_stats['mean']} "
                f"(median {primary_stats['median']}), ranging from {primary_stats['min']} to {primary_stats['max']} "
                f"(std dev {primary_stats['std']}). {cat_summary_str}"
            ).strip()
        else:
            ai_summary = (
                f"Analyzed {summary['rows']} observations across {summary['columns']} categorical attributes in '{filename}' "
                f"with {missing_total} missing values. {cat_summary_str}"
            ).strip()

    result = {
        "success": True,
        "dataset_id": dataset_id,
        "filename": filename,
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
            "headers": headers,
            "rows": preview_rows,
        },
    }
    return sanitize_for_json(result)


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

    stored_name = f"{uuid4().hex[:10]}_{original_filename}"
    file_path = UPLOAD_DIR / stored_name
    file_path.write_bytes(contents)

    try:
        raw_df = _smart_read_dataframe(file_path)
    except Exception as exc:
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(status_code=400, detail=f"Unable to read uploaded dataset: {exc}")

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

    # Pre-analyze immediately on upload so caller gets instant accurate data!
    analysis = _analyze_df(raw_df, dataset_id, original_filename)
    return {
        **analysis,
        "dataset_id": dataset_id,
        "filename": original_filename,
        "message": "Dataset uploaded and analyzed successfully",
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

    file_path = Path(row["file_path"])
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"Dataset file '{row['file_path']}' not found on server disk.")

    try:
        raw_df = _smart_read_dataframe(file_path)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Unable to load dataset: {exc}")

    return _analyze_df(raw_df, row["id"], row["filename"])
