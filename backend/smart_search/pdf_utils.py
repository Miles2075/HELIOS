from pathlib import Path

from pypdf import PdfReader


def extract_text_by_page(file_path: str | Path) -> list[dict]:
    """
    Extract text from a PDF page by page.

    Returns a list containing the page number and extracted text.
    """

    reader = PdfReader(file_path)

    pages = []

    for page_number, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""

        pages.append(
            {
                "page": page_number,
                "text": text.strip(),
            }
        )

    return pages