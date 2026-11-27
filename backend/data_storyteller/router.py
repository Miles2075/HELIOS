import io
import json
import math
import re
from collections import Counter
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
    # Prioritize primary response/activity metrics before secondary/ratio metrics
    primary_keywords = [
        "velocity", "reaction", "rate", "activity", "yield",
        "growth", "score", "accuracy", "sales", "revenue",
        "profit", "count", "target", "value"
    ]
    for kw in primary_keywords:
        for c in numeric_cols:
            if kw in c.lower() and "id" not in c.lower() and "denaturation" not in c.lower():
                return c
    secondary_keywords = ["pct", "percent", "hours", "loss", "temperature", "temp"]
    for kw in secondary_keywords:
        for c in numeric_cols:
            if kw in c.lower() and "id" not in c.lower():
                return c
    # Fallback to non-ID numeric column
    non_id_cols = [c for c in numeric_cols if not c.lower().endswith("id") and not c.lower().startswith("id")]
    if non_id_cols:
        return non_id_cols[0] if len(non_id_cols) > 1 else non_id_cols[0]
    return numeric_cols[0]


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

    # Pairwise Correlations across numeric variables
    correlations = []
    if len(numeric_cols) >= 2:
        for i in range(len(numeric_cols)):
            for j in range(i + 1, len(numeric_cols)):
                c1, c2 = numeric_cols[i], numeric_cols[j]
                try:
                    s1 = df[c1].dropna()
                    s2 = df[c2].dropna()
                    c_idx = s1.index.intersection(s2.index)
                    if len(c_idx) >= 3:
                        r = float(df.loc[c_idx, c1].corr(df.loc[c_idx, c2]))
                        if not (math.isnan(r) or math.isinf(r)):
                            if r >= 0.7:
                                desc = "strong positive"
                            elif r >= 0.4:
                                desc = "moderate positive"
                            elif r <= -0.7:
                                desc = "strong negative"
                            elif r <= -0.4:
                                desc = "moderate negative"
                            else:
                                desc = "weak / neutral"
                            correlations.append({
                                "col1": c1,
                                "col2": c2,
                                "r": round(r, 3),
                                "description": desc,
                            })
                except Exception:
                    pass
        correlations.sort(key=lambda x: abs(x["r"]), reverse=True)

    # Key Data Findings & Story Highlights
    top_findings = []
    if primary_col and primary_col in df.columns:
        p_series = df[primary_col].dropna()
        if not p_series.empty:
            max_idx = p_series.idxmax()
            min_idx = p_series.idxmin()
            max_val = p_series.loc[max_idx]
            min_val = p_series.loc[min_idx]
            other_cols = [c for c in df.columns if c != primary_col and "id" not in c.lower()]
            max_ctx = f" (at {other_cols[0]}: {df.loc[max_idx, other_cols[0]]})" if other_cols else ""
            min_ctx = f" (at {other_cols[0]}: {df.loc[min_idx, other_cols[0]]})" if other_cols else ""

            top_findings.append({
                "type": "peak",
                "title": "Peak Observation",
                "detail": f"Highest value for '{primary_col}' is {max_val}{max_ctx}.",
            })
            top_findings.append({
                "type": "minimum",
                "title": "Baseline Minimum",
                "detail": f"Lowest value for '{primary_col}' is {min_val}{min_ctx}.",
            })
            spread = round(float(max_val - min_val), 2)
            top_findings.append({
                "type": "distribution",
                "title": "Data Spread",
                "detail": f"Spans a range of {spread} (median: {primary_stats['median']}, std dev: {primary_stats['std']}).",
            })

    if correlations:
        top_c = correlations[0]
        top_findings.append({
            "type": "correlation",
            "title": "Key Relationship",
            "detail": f"'{top_c['col1']}' and '{top_c['col2']}' show a {top_c['description']} correlation (r = {top_c['r']:+0.2f}).",
        })

    # Grounded Story Headline
    if primary_col and primary_stats["max"] != primary_stats["min"]:
        corr_note = f", strongly associated with '{correlations[0]['col2']}' (r = {correlations[0]['r']:+0.2f})" if (correlations and abs(correlations[0]['r']) >= 0.6) else ""
        story_headline = f"Across {summary['rows']} observations, '{primary_col}' averages {primary_stats['mean']} (median {primary_stats['median']}) and peaks at {primary_stats['max']}{corr_note}."
    else:
        story_headline = f"Dataset '{filename}' comprises {summary['rows']} rows across {summary['columns']} attributes."

    # Grounded AI Analytical Summary
    stats_prompt = (
        f"You are HELIOS Data Storyteller. Write a concise, insightful 3-sentence analytical summary "
        f"of the dataset '{filename}' using ONLY these computed statistics:\n"
        f"Rows: {summary['rows']}, Columns: {summary['columns']}\n"
        f"Column profiles: {columns_info}\n"
        f"Numerical stats: {by_column_stats}\n"
        f"Categorical info: {cat_summary_str}\n"
        f"Correlations: {correlations[:3] if correlations else 'None'}\n"
        f"Key findings: {top_findings}"
    )
    ai_summary = generate_text(stats_prompt)
    if not ai_summary:
        missing_total = sum(v["missing_values"] for v in columns_info.values())
        if primary_col:
            corr_summary = f" The strongest observed correlation is between '{correlations[0]['col1']}' and '{correlations[0]['col2']}' (r = {correlations[0]['r']:+0.2f}, {correlations[0]['description']})." if correlations else ""
            clean_summary = f" {cleaning_report['duplicates_removed']} duplicates and {cleaning_report['empty_rows_dropped']} empty rows were cleaned." if (cleaning_report['duplicates_removed'] > 0 or cleaning_report['empty_rows_dropped'] > 0) else ""
            ai_summary = (
                f"The dataset '{filename}' contains {summary['rows']} records across {summary['columns']} variables ({missing_total} null values). "
                f"For the primary metric '{primary_col}', values center around a mean of {primary_stats['mean']} and median of {primary_stats['median']}, "
                f"ranging from a minimum of {primary_stats['min']} up to an optimal peak of {primary_stats['max']} (spread of {round(primary_stats['max'] - primary_stats['min'], 2)})."
                f"{corr_summary}{clean_summary} {cat_summary_str}"
            ).strip()
        else:
            ai_summary = (
                f"The dataset '{filename}' contains {summary['rows']} observations across {summary['columns']} categorical attributes "
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
        "correlations": correlations,
        "top_findings": top_findings,
        "story_headline": story_headline,
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


# ============================================================================
# PDF DOCUMENT DATA STORYTELLER & NON-CONFUSING TOPIC CLUSTERING
# ============================================================================

class DocumentStoryRequest(BaseModel):
    document_id: int


def _extract_numbers_and_stats(text: str) -> List[str]:
    """Extracts prominent statistics, percentages, currency, and numerical metrics."""
    matches = re.findall(
        r"(?:[\$€£]?\b\d+(?:,\d{3})*(?:\.\d+)?%?(?:\s*(?:billion|million|thousand|GB|MB|ms|kHz|MHz|GHz|s|fps|kbps|epochs|params|layers|pages|users))?\b)",
        text,
        re.IGNORECASE,
    )
    cleaned = []
    seen = set()
    for m in matches:
        m_str = m.strip()
        if len(m_str) >= 1 and m_str not in seen and not (len(m_str) == 1 and m_str.isdigit()):
            seen.add(m_str)
            cleaned.append(m_str)
    return cleaned[:15]


def _analyze_document_data_story(document_id: int) -> Dict[str, Any]:
    connection = get_connection()
    try:
        doc = connection.execute(
            "SELECT id, filename, uploaded_at FROM documents WHERE id = ?",
            (document_id,),
        ).fetchone()
        if not doc:
            raise HTTPException(status_code=404, detail=f"Document with ID {document_id} not found.")

        pages_rows = connection.execute(
            "SELECT page_number, text FROM document_pages WHERE document_id = ? ORDER BY page_number ASC",
            (document_id,),
        ).fetchall()
        if not pages_rows:
            raise HTTPException(status_code=400, detail="Document has no ingested pages.")
    finally:
        connection.close()

    total_pages = len(pages_rows)
    all_text = " ".join(p["text"] or "" for p in pages_rows)
    all_words = re.findall(r"\b[A-Za-z0-9_-]{2,}\b", all_text)
    total_words = len(all_words)

    # Stop words for document keyword filtering
    stop_words = {
        "about", "above", "after", "again", "against", "because", "before", "being",
        "between", "could", "during", "every", "first", "found", "great", "however",
        "including", "known", "large", "never", "often", "other", "place", "process",
        "several", "should", "since", "small", "state", "still", "study", "system",
        "their", "there", "these", "thing", "think", "those", "three", "through",
        "under", "using", "where", "which", "while", "within", "without", "would",
        "page", "also", "each", "into", "many", "more", "most", "some", "such",
        "than", "that", "them", "then", "this", "with", "from", "have", "been",
    }

    # Per-page breakdown
    page_stories = []
    page_word_counts = []
    page_data_counts = []

    for p in pages_rows:
        p_num = int(p["page_number"])
        p_text = p["text"] or ""
        p_words = re.findall(r"\b[A-Za-z0-9_-]{2,}\b", p_text)
        w_count = len(p_words)
        page_word_counts.append(w_count)

        # Statistics & numbers
        data_markers = _extract_numbers_and_stats(p_text)
        page_data_counts.append(len(data_markers))

        # Top keywords on this page
        p_filtered = [w.lower() for w in p_words if len(w) >= 3 and w.lower() not in stop_words]
        top_kws = [word for word, _ in Counter(p_filtered).most_common(4)]

        # Extract first substantive sentence or heading
        sentences = [s.strip() for s in re.split(r"(?<=[.!?\n])\s+", p_text) if len(s.strip()) >= 20]
        headline = sentences[0][:90] if sentences else f"Section Overview (Page {p_num})"

        page_stories.append({
            "page_number": p_num,
            "word_count": w_count,
            "data_points_count": len(data_markers),
            "key_metrics": data_markers[:6],
            "top_keywords": top_kws,
            "headline": headline,
            "preview_snippet": p_text[:220].strip() + ("..." if len(p_text) > 220 else ""),
        })

    # Overall metrics
    unique_words = len(set(w.lower() for w in all_words))
    vocab_richness = round(unique_words / max(total_words, 1), 3)
    reading_time_mins = round(total_words / 200.0, 1)
    all_data_points = sum(page_data_counts)
    data_density = round((all_data_points / max(total_words, 1)) * 100, 2)

    # Find page with highest density of statistics
    peak_page_idx = int(np.argmax(page_data_counts)) if page_data_counts else 0
    peak_page = page_stories[peak_page_idx]

    # Global top terms
    global_filtered = [w.capitalize() for w in all_words if len(w) >= 4 and w.lower() not in stop_words]
    top_global_keywords = [{"keyword": kw, "count": cnt} for kw, cnt in Counter(global_filtered).most_common(8)]

    # Arc classification: Introduction -> Body / Data Peak -> Conclusion
    story_arc = [
        {
            "phase": "Foundational Context",
            "pages": f"Page 1",
            "desc": f"Establishes initial scope and foundational terms with {page_stories[0]['word_count']} words.",
            "highlight": page_stories[0]["headline"],
        },
        {
            "phase": "Analytical Peak & Data Density",
            "pages": f"Page {peak_page['page_number']}",
            "desc": f"Dense empirical concentration with {peak_page['data_points_count']} quantitative references ({', '.join(peak_page['key_metrics'][:3]) or 'key data'}).",
            "highlight": peak_page["headline"],
        },
        {
            "phase": "Synthesis & Synthesis Scope",
            "pages": f"Page {total_pages}",
            "desc": f"Culmination of concepts across {page_stories[-1]['word_count']} concluding words.",
            "highlight": page_stories[-1]["headline"],
        },
    ]

    # Build Plotly progression charts
    progression_df = pd.DataFrame([
        {
            "Page": f"P{ps['page_number']}",
            "Words": ps["word_count"],
            "Data Points": ps["data_points_count"],
        }
        for ps in page_stories
    ])

    charts: List[Dict[str, Any]] = []
    try:
        fig_words = px.bar(
            progression_df,
            x="Page",
            y="Words",
            title=f"Word Density Distribution Across Pages ({doc['filename']})",
            color="Words",
            color_continuous_scale="Purples",
        )
        charts.append({
            "type": "bar",
            "id": "word_density",
            "title": "Word Volume Per Page",
            "plotly_json": json.loads(fig_words.to_json()),
        })
    except Exception:
        pass

    try:
        fig_data = px.line(
            progression_df,
            x="Page",
            y="Data Points",
            title=f"Quantitative Data Density Curve ({all_data_points} Total Data Points)",
            markers=True,
        )
        charts.append({
            "type": "line",
            "id": "data_density",
            "title": "Quantitative Data Points Curve",
            "plotly_json": json.loads(fig_data.to_json()),
        })
    except Exception:
        pass

    # AI Data Story Summary
    ai_prompt = (
        f"You are HELIOS Data Storyteller analyzing academic document '{doc['filename']}'.\n"
        f"Document Profile: {total_pages} pages, {total_words} total words, {all_data_points} quantitative metrics/numbers.\n"
        f"Vocabulary richness: {vocab_richness * 100:.1f}%. Reading duration: ~{reading_time_mins} minutes.\n"
        f"Peak empirical concentration is on Page {peak_page['page_number']} with metrics: {peak_page['key_metrics']}.\n"
        f"Top recurring terms: {[k['keyword'] for k in top_global_keywords[:5]]}.\n"
        "Write a concise, engaging 3-sentence DATA STORY summarizing the numerical flow, concept density, and empirical progression of this PDF."
    )
    ai_story = generate_text(ai_prompt)
    if not ai_story:
        ai_story = (
            f"The document '{doc['filename']}' unfolds across {total_pages} pages encompassing {total_words} words "
            f"and {all_data_points} empirical data markers (~{reading_time_mins} min reading time). "
            f"The narrative reaches its empirical data peak on Page {peak_page['page_number']}, which concentrates {peak_page['data_points_count']} quantitative references "
            f"focused around {', '.join(peak_page['top_keywords'][:3]) or 'core concepts'}. "
            f"With a vocabulary diversity of {vocab_richness * 100:.1f}%, the document maintains a cohesive academic progression leading into Page {total_pages}."
        )

    return sanitize_for_json({
        "success": True,
        "document_id": document_id,
        "filename": doc["filename"],
        "total_pages": total_pages,
        "total_words": total_words,
        "total_data_points": all_data_points,
        "data_density_score": data_density,
        "vocab_richness": vocab_richness,
        "reading_time_mins": reading_time_mins,
        "peak_page": peak_page["page_number"],
        "top_keywords": top_global_keywords,
        "story_arc": story_arc,
        "page_stories": page_stories,
        "ai_story": ai_story,
        "charts": charts,
    })


def _build_document_clusters() -> Dict[str, Any]:
    """
    Groups indexed course documents by topic domain into clean, non-confusing cluster cards.
    Avoids messy hairball graphs — presents clean structured groupings with shared keywords.
    """
    connection = get_connection()
    try:
        docs = connection.execute(
            """
            SELECT d.id, d.filename, count(p.id) as page_count, group_concat(substr(p.text, 1, 300), ' ') as preview
            FROM documents d
            LEFT JOIN document_pages p ON p.document_id = d.id
            GROUP BY d.id
            ORDER BY d.id ASC
            """
        ).fetchall()
    finally:
        connection.close()

    if not docs:
        return {"success": True, "total_clusters": 0, "total_documents": 0, "clusters": []}

    # Predefined intuitive academic cluster domains
    CLUSTER_DEFINITIONS = [
        {
            "id": "systems_architecture",
            "name": "Operating Systems & Low-Level Computing",
            "badge": "🖥️ Systems Core",
            "color": "#38bdf8",
            "keywords": ["kernel", "process", "thread", "memory", "paging", "virtual", "cache", "scheduler", "deadlock", "mutex", "interrupt"],
            "description": "Foundational computing systems covering concurrency, resource allocation, and operating system kernels.",
        },
        {
            "id": "networks_databases",
            "name": "Data Storage, Databases & Network Protocols",
            "badge": "🌐 Infrastructure",
            "color": "#a78bfa",
            "keywords": ["database", "sql", "storage", "b-tree", "transaction", "acid", "network", "protocol", "tcp", "ip", "packet", "routing", "http"],
            "description": "Distributed systems, network routing protocols, and high-performance relational & indexing engines.",
        },
        {
            "id": "ai_machine_learning",
            "name": "Machine Learning, AI & Algorithms",
            "badge": "🤖 Artificial Intelligence",
            "color": "#f472b6",
            "keywords": ["learning", "neural", "model", "gradient", "loss", "regression", "classification", "training", "feature", "weights", "dataset"],
            "description": "Predictive modeling, statistical inference, deep learning architectures, and training optimization.",
        },
        {
            "id": "life_sciences",
            "name": "Life Sciences, Biology & Nature",
            "badge": "🧬 Life Sciences",
            "color": "#34d399",
            "keywords": ["cell", "dna", "gene", "protein", "organism", "mitochondria", "photosynthesis", "ecology", "enzyme", "species", "evolution"],
            "description": "Biological systems, genetics, cellular metabolism, and organic biochemical pathways.",
        },
        {
            "id": "applied_career_admin",
            "name": "Applied Credentials & Institutional Records",
            "badge": "📄 Official & Career",
            "color": "#fbbf24",
            "keywords": ["offer", "letter", "salary", "candidate", "joining", "date", "roll", "student", "department", "university", "academic", "grade"],
            "description": "Institutional records, student credentials, formal verifications, and career documentation.",
        },
    ]

    cluster_buckets: Dict[str, List[Dict[str, Any]]] = {c["id"]: [] for c in CLUSTER_DEFINITIONS}
    unassigned = []

    for d in docs:
        doc_text = (d["filename"] + " " + (d["preview"] or "")).lower()
        best_cluster_id = None
        best_score = 0

        for c_def in CLUSTER_DEFINITIONS:
            score = sum(1 for kw in c_def["keywords"] if kw in doc_text)
            if score > best_score:
                best_score = score
                best_cluster_id = c_def["id"]

        doc_summary = {
            "document_id": int(d["id"]),
            "filename": d["filename"],
            "page_count": int(d["page_count"] or 1),
            "match_score": best_score,
        }

        if best_cluster_id and best_score >= 1:
            cluster_buckets[best_cluster_id].append(doc_summary)
        else:
            unassigned.append(doc_summary)

    # Build formatted response
    final_clusters = []
    for c_def in CLUSTER_DEFINITIONS:
        members = cluster_buckets[c_def["id"]]
        if members:
            total_pages = sum(m["page_count"] for m in members)
            final_clusters.append({
                "cluster_id": c_def["id"],
                "name": c_def["name"],
                "badge": c_def["badge"],
                "color": c_def["color"],
                "description": c_def["description"],
                "keywords": c_def["keywords"][:6],
                "document_count": len(members),
                "total_pages": total_pages,
                "documents": members,
            })

    if unassigned:
        final_clusters.append({
            "cluster_id": "general_studies",
            "name": "General Electives & Uncategorized",
            "badge": "📚 General Studies",
            "color": "#94a3b8",
            "description": "Interdisciplinary resources and general reference documentation across various subjects.",
            "keywords": ["general", "reading", "notes", "topics"],
            "document_count": len(unassigned),
            "total_pages": sum(m["page_count"] for m in unassigned),
            "documents": unassigned,
        })

    return {
        "success": True,
        "total_clusters": len(final_clusters),
        "total_documents": len(docs),
        "clusters": final_clusters,
    }


@router.post("/analyze-document")
def analyze_document_endpoint(payload: DocumentStoryRequest):
    return _analyze_document_data_story(payload.document_id)


@router.get("/document-clusters")
def document_clusters_endpoint():
    return _build_document_clusters()

