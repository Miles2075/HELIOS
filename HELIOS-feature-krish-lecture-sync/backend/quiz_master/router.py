import random
import re
from typing import Dict, List, Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, model_validator

from backend.core.database import get_connection, initialize_database
from backend.core.gemini_client import generate_json

router = APIRouter(prefix="/api/quiz", tags=["Quiz Master"])

initialize_database()

_quiz_counter = 100


class QuizRequest(BaseModel):
    document_id: int = Field(..., ge=1)
    question_count: int = Field(5, ge=1, le=20)
    difficulty: Literal["easy", "medium", "hard"] = "medium"
    type: Literal["mcq", "true_false", "flashcard"] = "mcq"


class QuizQuestion(BaseModel):
    question: str = Field(..., min_length=3)
    options: Optional[Dict[str, str]] = None
    correct_answer: str = Field(..., min_length=1)
    explanation: str = Field(..., min_length=3)


class QuizResponse(BaseModel):
    success: bool
    quiz_id: int
    difficulty: str
    type: str
    questions: List[QuizQuestion]

    @model_validator(mode="after")
    def validate_questions_by_type(self):
        for q in self.questions:
            if self.type == "mcq":
                if not q.options or set(q.options.keys()) != {"A", "B", "C", "D"}:
                    raise ValueError("MCQs must contain exactly four options: A, B, C, D.")
                if q.correct_answer not in {"A", "B", "C", "D"}:
                    raise ValueError("MCQ correct_answer must be one of A, B, C, D.")
            elif self.type == "true_false":
                if not q.options or set(q.options.keys()) != {"A", "B"}:
                    raise ValueError("True/False questions must have options A and B.")
                if q.correct_answer not in {"A", "B"}:
                    raise ValueError("True/False correct_answer must be A or B.")
        return self


def _load_document_text(document_id: int):
    connection = get_connection()
    try:
        doc = connection.execute(
            "SELECT id, filename FROM documents WHERE id = ?",
            (document_id,),
        ).fetchone()
        if not doc:
            return None, None
        pages = connection.execute(
            """
            SELECT page_number, text
            FROM document_pages
            WHERE document_id = ?
            ORDER BY page_number ASC
            """,
            (document_id,),
        ).fetchall()
        combined = "\n\n".join(f"[Page {p['page_number']}]\n{p['text']}" for p in pages)
        return doc["filename"], combined
    finally:
        connection.close()


def _generate_with_gemini(
    filename: str,
    text: str,
    count: int,
    difficulty: str,
    q_type: str,
) -> Optional[List[QuizQuestion]]:
    snippet = text[:8000]
    if q_type == "mcq":
        schema_hint = (
            '[{"question": "...", "options": {"A": "...", "B": "...", "C": "...", "D": "..."}, '
            '"correct_answer": "B", "explanation": "..."}]'
        )
    elif q_type == "true_false":
        schema_hint = (
            '[{"question": "...", "options": {"A": "True", "B": "False"}, '
            '"correct_answer": "A", "explanation": "..."}]'
        )
    else:
        schema_hint = '[{"question": "Key Term", "correct_answer": "Clear definition", "explanation": "Source context"}]'

    prompt = (
        f"Generate exactly {count} {difficulty}-difficulty {q_type} study items strictly based on "
        f"the following study document ({filename}). Return ONLY valid JSON matching:\n{schema_hint}\n\n"
        f"Study Material:\n{snippet}"
    )

    for _ in range(3):
        raw = generate_json(prompt)
        if not isinstance(raw, list) or not raw:
            continue
        try:
            validated = QuizResponse(
                success=True,
                quiz_id=1,
                difficulty=difficulty,
                type=q_type,
                questions=[QuizQuestion(**item) for item in raw[:count]],
            )
            return validated.questions
        except Exception:
            continue
    return None


def _generate_local_questions(
    filename: str,
    text: str,
    count: int,
    q_type: str,
) -> List[QuizQuestion]:
    """Deterministic document-grounded generator when GEMINI_API_KEY is not configured."""
    clean = re.sub(r"\[Page \d+\]", "", text)
    raw_sentences = [
        s.strip()
        for s in re.split(r"(?<=[.!?])\s+", clean)
        if 35 <= len(s.strip()) <= 260
    ]
    if not raw_sentences:
        raw_sentences = [clean.strip()[:220] or f"Core concepts covered in {filename}."]

    # Prefer clean domain phrases (e.g. "Mutex Lock", "Round Robin Scheduling", "Calvin Cycle")
    stop_words = {
        "about", "above", "after", "again", "against", "because", "before", "being",
        "between", "could", "during", "every", "first", "found", "great", "however",
        "including", "known", "large", "never", "often", "other", "place", "process",
        "several", "should", "since", "small", "state", "still", "study", "system",
        "their", "there", "these", "thing", "think", "those", "three", "through",
        "under", "using", "where", "which", "while", "within", "without", "would",
        "fixed", "shared", "single", "double", "green", "simultaneously",
    }
    raw_phrases = re.findall(
        r"\b(?:[A-Z]{2,}|[A-Z][a-zA-Z0-9-]{2,})(?:\s+(?:[A-Z]{2,}|[A-Z][a-zA-Z0-9-]{2,})){0,2}\b",
        clean,
    )
    raw_words = re.findall(r"\b[A-Za-z][A-Za-z0-9_-]{5,}\b", clean)
    unique_terms: List[str] = []
    seen_lower = set()
    for term in raw_phrases + raw_words:
        cleaned_term = " ".join(p for p in term.split() if p.lower() not in {"the", "a", "an"})
        lw = cleaned_term.lower()
        if len(lw) >= 3 and lw not in stop_words and lw not in seen_lower:
            seen_lower.add(lw)
            unique_terms.append(cleaned_term)

    if len(unique_terms) < 4:
        unique_terms.extend(["Concurrency", "Abstraction", "Algorithm", "Optimization"])

    questions: List[QuizQuestion] = []
    rng = random.Random(len(text) + count)

    for idx in range(count):
        sentence = raw_sentences[idx % len(raw_sentences)]
        sent_phrases = [t for t in unique_terms if re.search(rf"\b{re.escape(t)}\b", sentence)]
        sent_phrases.sort(key=len, reverse=True)
        target_term = sent_phrases[0] if sent_phrases else unique_terms[idx % len(unique_terms)]

        if q_type == "flashcard":
            questions.append(
                QuizQuestion(
                    question=f"{target_term} ({filename})",
                    correct_answer=sentence,
                    explanation=f"Extracted directly from {filename} study notes.",
                )
            )
        elif q_type == "true_false":
            is_true = idx % 2 == 0
            if is_true:
                stmt = sentence
                ans = "A"
                exp = f"True — directly supported by {filename}: \"{sentence}\""
            else:
                alt = unique_terms[(idx + 3) % len(unique_terms)]
                stmt = re.sub(
                    re.escape(target_term),
                    alt,
                    sentence,
                    count=1,
                    flags=re.IGNORECASE,
                )
                if stmt == sentence:
                    stmt = f"According to {filename}, {target_term} is never used in this topic."
                ans = "B"
                exp = f"False — the actual statement in {filename} refers to '{target_term}': \"{sentence}\""
            questions.append(
                QuizQuestion(
                    question=stmt,
                    options={"A": "True", "B": "False"},
                    correct_answer=ans,
                    explanation=exp,
                )
            )
        else:
            # MCQ with exactly 4 distinct options (A, B, C, D)
            masked = re.sub(
                re.escape(target_term),
                "________",
                sentence,
                count=1,
                flags=re.IGNORECASE,
            )
            if masked == sentence:
                q_text = f"Which concept from {filename} best matches: \"{sentence}\"?"
            else:
                q_text = f"Complete the statement from {filename}: \"{masked}\""

            distractors = [t for t in unique_terms if t.lower() != target_term.lower()]
            rng.shuffle(distractors)
            choices = [target_term] + distractors[:3]
            while len(choices) < 4:
                choices.append(f"Concept {len(choices) + 1}")
            rng.shuffle(choices)
            letters = ["A", "B", "C", "D"]
            options_map = dict(zip(letters, choices))
            correct_letter = letters[choices.index(target_term)]

            questions.append(
                QuizQuestion(
                    question=q_text,
                    options=options_map,
                    correct_answer=correct_letter,
                    explanation=f"From {filename}: \"{sentence}\"",
                )
            )

    return questions


@router.post("/generate", response_model=QuizResponse)
def generate_quiz(payload: QuizRequest):
    global _quiz_counter
    filename, text = _load_document_text(payload.document_id)
    if not filename or not text:
        raise HTTPException(
            status_code=404,
            detail=f"Document with ID {payload.document_id} not found. Upload a PDF or TXT in Smart Search first.",
        )

    questions = _generate_with_gemini(
        filename=filename,
        text=text,
        count=payload.question_count,
        difficulty=payload.difficulty,
        q_type=payload.type,
    )
    if not questions:
        questions = _generate_local_questions(
            filename=filename,
            text=text,
            count=payload.question_count,
            q_type=payload.type,
        )

    _quiz_counter += 1
    return QuizResponse(
        success=True,
        quiz_id=_quiz_counter,
        difficulty=payload.difficulty,
        type=payload.type,
        questions=questions,
    )
