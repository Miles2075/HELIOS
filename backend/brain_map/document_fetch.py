"""
Fetches a document's already-extracted text from the shared SQLite database,
so Brain Map never duplicates Smart Search's extraction pipeline.
"""

from backend.core.database import get_connection


def get_document_text(document_id: int) -> str:
    """
    Returns all extracted page text for a given document_id, concatenated
    in page order.

    There is no separate "extraction complete" flag — a document's rows
    simply existing in document_pages means its text was already extracted
    by Smart Search's upload flow.
    """
    connection = get_connection()
    rows = connection.execute(
        "SELECT text FROM document_pages WHERE document_id = ? ORDER BY page_number",
        (document_id,)
    ).fetchall()
    connection.close()

    return " ".join(row["text"] for row in rows)