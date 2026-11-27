import json
import re
from typing import Any, Optional

from backend.core.config import GEMINI_API_KEY

DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"


def is_gemini_configured() -> bool:
    return bool(GEMINI_API_KEY and GEMINI_API_KEY.strip() and GEMINI_API_KEY != "your_gemini_api_key_here")


def generate_text(prompt: str, model: str = DEFAULT_GEMINI_MODEL) -> Optional[str]:
    """
    Calls the Gemini API via official `google-genai` SDK using `gemini-2.5-flash`
    (or caller-specified model).
    Returns None gracefully if GEMINI_API_KEY is not configured or on API error,
    allowing callers to fall back to local deterministic/extractive pipelines.
    """
    if not is_gemini_configured():
        return None

    try:
        from google import genai

        client = genai.Client(api_key=GEMINI_API_KEY)
        
        # Primary path: official models.generate_content
        for m in [model, "gemini-2.5-flash", "gemini-1.5-flash", "gemini-2.0-flash"]:
            try:
                response = client.models.generate_content(
                    model=m,
                    contents=prompt,
                )
                text = getattr(response, "text", None)
                if text and text.strip():
                    return text.strip()
            except Exception:
                continue

        # Secondary fallback: interactions API if enabled
        try:
            interaction = client.interactions.create(
                model=model,
                input=prompt,
            )
            text = getattr(interaction, "output_text", None)
            if text and text.strip():
                return text.strip()
        except Exception:
            pass

        return None
    except Exception:
        return None


def generate_json(prompt: str, model: str = DEFAULT_GEMINI_MODEL) -> Optional[Any]:
    """
    Calls Gemini and extracts a parsed JSON object/array from its response text.
    """
    raw = generate_text(prompt, model=model)
    if not raw:
        return None

    cleaned = re.sub(
        r"^```(?:json)?\s*|\s*```$",
        "",
        raw.strip(),
        flags=re.IGNORECASE | re.DOTALL,
    )
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"(\{.*\}|\[.*\])", cleaned, flags=re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                return None
    return None
