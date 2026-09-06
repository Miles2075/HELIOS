import os

from dotenv import load_dotenv
from google import genai


load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY is not set")

client = genai.Client(api_key=GEMINI_API_KEY)

MODEL_NAME = "gemini-3.6-flash"


def generate_answer(query: str, retrieved_chunks: list[dict]) -> str:
    context_parts = []

    for chunk in retrieved_chunks:
        context_parts.append(
            f"""
Source: {chunk["filename"]}
Page: {chunk["page_number"]}

{chunk["text"]}
"""
        )

    context = "\n\n---\n\n".join(context_parts)

    prompt = f"""
You are the Smart Search assistant for HELIOS.

Answer the user's question using ONLY the document
context provided below.

Rules:
- Do not use outside knowledge.
- Do not invent information.
- If the context does not contain enough information,
  say that the information was not found.
- Give a concise and useful answer.
- Use bullet points when listing multiple items.
- Cite important claims using [Page X].
- Do not cite pages that do not support the claim.

User question:
{query}

Document context:
{context}
"""

    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=prompt,
    )

    return response.text