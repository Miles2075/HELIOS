from backend.core.database import get_connection

def get_document_text(document_id: int) -> str:
    connection = get_connection()
    rows = connection.execute(
        "SELECT text FROM document_pages WHERE document_id = ? ORDER BY page_number",
        (document_id,)
    ).fetchall()
    connection.close()
    return " ".join(row["text"] for row in rows)