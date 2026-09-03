from pathlib import Path

from backend.smart_search.pdf_utils import extract_text_by_page


pdf_path = Path(__file__).parent.parent / "test_sample.pdf"

pages = extract_text_by_page(pdf_path)

for page in pages:
    print(f"Page {page['page']}:")
    print(page["text"])
    print("-" * 50)