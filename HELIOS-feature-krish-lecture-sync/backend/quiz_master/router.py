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


# ============================================================================
# FOG OF WAR: LECTURE-SYNCED STORY CAMPAIGN & PROGRESSIVE UNLOCK ENGINE
# ============================================================================

class CampaignVisual(BaseModel):
    id: int
    timestamp: float
    visual_type: str
    title: str
    description: str
    ocr_text: Optional[str] = None
    latex: Optional[str] = None
    image_url: str


class CampaignStage(BaseModel):
    stage_id: int
    stage_number: int
    title: str
    timestamp_start: float
    timestamp_end: float
    timestamp_label: str
    summary: str
    concept_keyword: str
    visual: Optional[CampaignVisual] = None
    question: QuizQuestion


class CampaignRequest(BaseModel):
    source_type: Literal["lecture", "document"] = "lecture"
    source_id: int = Field(..., ge=1)
    difficulty: Literal["easy", "medium", "hard"] = "medium"
    stage_count: Optional[int] = Field(None, ge=3, le=20)


class CampaignResponse(BaseModel):
    success: bool
    source_type: str
    source_id: int
    source_title: str
    total_stages: int
    duration: float
    stages: List[CampaignStage]


def _build_lecture_campaign(
    lecture_id: int, difficulty: str = "medium", stage_count: Optional[int] = None
) -> CampaignResponse:
    connection = get_connection()
    try:
        lec = connection.execute("SELECT * FROM lectures WHERE id = ?", (lecture_id,)).fetchone()
        if not lec:
            raise HTTPException(status_code=404, detail=f"Lecture #{lecture_id} not found.")

        visuals = connection.execute(
            "SELECT * FROM lecture_visuals WHERE lecture_id = ? ORDER BY timestamp ASC",
            (lecture_id,),
        ).fetchall()
        segments = connection.execute(
            "SELECT * FROM lecture_segments WHERE lecture_id = ? ORDER BY segment_index ASC",
            (lecture_id,),
        ).fetchall()

        duration = float(lec["duration"] or (segments[-1]["end_time"] if segments else 60.0))
        filename_lower = lec["filename"].lower()
        is_python = any(k in filename_lower for k in ["python", "cs50", "code", "programming", "software", "script"])
        is_physics = any(k in filename_lower for k in ["physics", "mechanic", "newton", "gravity", "kinemat", "motion"])

        if is_python:
            distractor_pool = [
                "Recursive Depth-First Call Stack Resolution",
                "Mutable Default Argument Side Effects",
                "Lexical Scope and Variable Shadowing Protocol",
                "Dynamic Duck Typing and Implicit Type Coercion",
                "Exception Propagation Across Stack Frames",
                "Generator State Retention and Lazy Evaluation",
                "Polymorphic Class Inheritance and Method Resolution",
                "Context Management Entry and Exit Protocols",
                "Positional vs Keyword Parameter Unpacking",
                "Regular Expression Greedy Pattern Matching",
                "String Immutability and Memory Interning",
                "List Comprehension vs Generator Expression Evaluation",
            ]
        elif is_physics:
            distractor_pool = [
                "Conservation of Relativistic Angular Momentum",
                "Rotational Inertia and Torque Equilibrium State",
                "Coulomb Electrostatic Potential Dissipation",
                "Thermodynamic Entropy Increase in Open Isolated Systems",
                "Doppler Frequency Shift in Non-Inertial Frames",
                "Wave Packet Phase Velocity Dispersion",
            ]
        else:
            distractor_pool = [
                "Hierarchical Concept Dependency Mapping",
                "Empirical Observation Validation Protocol",
                "Systematic Hypothesis Falsification Process",
                "Inductive Logical Reasoning Framework",
                "Categorical Classification Abstraction Boundary",
                "Multivariate Factor Correlation Threshold",
            ]

        stages: List[CampaignStage] = []

        if visuals:
            if stage_count:
                target_count = min(stage_count, len(visuals))
            elif duration > 36000:  # > 10 hours (mega-lectures)
                target_count = min(20, len(visuals))
            elif duration > 14400:  # > 4 hours
                target_count = min(15, len(visuals))
            elif duration > 7200:  # > 2 hours
                target_count = min(12, len(visuals))
            elif duration > 3600:
                target_count = min(8, len(visuals))
            else:
                target_count = min(5, len(visuals))

            step = max(1, len(visuals) // target_count)
            chosen_visuals = visuals[::step][:target_count]

            for idx, v in enumerate(chosen_visuals):
                t_start = 0.0 if idx == 0 else float(chosen_visuals[idx - 1]["timestamp"])
                t_end = float(v["timestamp"]) if idx < len(chosen_visuals) - 1 else duration
                if t_end <= t_start:
                    t_end = t_start + max(10.0, (duration - t_start) / max(1, target_count - idx))

                window_segs = [
                    s["text"] for s in segments
                    if t_start <= s["start_time"] <= t_end
                ]
                window_text = " ".join(window_segs[:25]) if window_segs else (v["ocr_text"] or v["description"] or "Lecture milestone")

                m_start, s_start = int(t_start // 60), int(t_start % 60)
                m_end, s_end = int(t_end // 60), int(t_end % 60)
                time_label = f"{m_start:02d}:{s_start:02d} → {m_end:02d}:{s_end:02d}"

                raw_title = v["title"]
                if "Lecture Slide Presentation" in raw_title or "Mathematical Equation Formulation" in raw_title:
                    ctx_sample = ((v["ocr_text"] or "") + " " + (v["description"] or "")).lower()
                    # CS50/programming-specific topic inference from slide OCR
                    if any(k in ctx_sample for k in ["this course", "harvard", "welcome", "intro", "cs50"]):
                        clean_title = "Introduction to Programming & Python Syntax"
                    elif any(k in ctx_sample for k in ["hello", "breath", "person's name", "print("]):
                        clean_title = "Functions, String Arguments & Return Values"
                    elif any(k in ctx_sample for k in ["step back", "assertions", "more code", "logic", "boolean"]):
                        clean_title = "Conditional Logic & Unit Assertions"
                    elif any(k in ctx_sample for k in ["assertion", "value error", "exception", "try:", "except"]):
                        clean_title = "Assertions, Error Handling & Exceptions"
                    elif any(k in ctx_sample for k in ["class", "student", "object", "oop", "__init__"]):
                        clean_title = "Object-Oriented Programming & Classes"
                    elif any(k in ctx_sample for k in ["self", "hats", "method", "instance", "@property"]):
                        clean_title = "Class Methods, Attributes & The 'self' Keyword"
                    elif any(k in ctx_sample for k in ["pdf", "publish", "share", "library", "file", "csv"]):
                        clean_title = "Libraries, Modules & File I/O Operations"
                    elif any(k in ctx_sample for k in ["loop", "while", "for", "meow", "escape", "range("]):
                        clean_title = "Iteration, Loops & String Formatting"
                    elif any(k in ctx_sample for k in ["list", "dict", "tuple", "set", "append", "sort"]):
                        clean_title = "Data Structures: Lists, Dicts & Tuples"
                    elif any(k in ctx_sample for k in ["recursion", "recursive", "fibonacci", "factorial"]):
                        clean_title = "Recursion & Recursive Problem Solving"
                    elif any(k in ctx_sample for k in ["regex", "regular expression", "re.", "pattern"]):
                        clean_title = "Regular Expressions & Pattern Matching"
                    elif any(k in ctx_sample for k in ["test", "unit test", "pytest", "assert"]):
                        clean_title = "Unit Testing & Test-Driven Development"
                    elif any(k in ctx_sample for k in ["api", "request", "json", "http", "url"]):
                        clean_title = "APIs, HTTP Requests & JSON Data"
                    elif any(k in ctx_sample for k in ["sql", "database", "table", "query", "sqlite"]):
                        clean_title = "Databases, SQL & Data Persistence"
                    elif any(k in ctx_sample for k in ["decorator", "@", "closure", "lambda", "generator"]):
                        clean_title = "Decorators, Closures & Generators"
                    elif any(k in ctx_sample for k in ["inherit", "super()", "polymorphi", "abstract"]):
                        clean_title = "Inheritance, Polymorphism & Abstract Classes"
                    elif any(k in ctx_sample for k in ["global", "constant", "scope", "namespace"]):
                        clean_title = "Variable Scope, Constants & Namespaces"
                    elif any(k in ctx_sample for k in ["def ", "return", "parameter", "argument"]):
                        clean_title = "Function Definitions & Parameters"
                    elif any(k in ctx_sample for k in ["int", "float", "str", "type", "cast"]):
                        clean_title = "Data Types, Casting & Type Checking"
                    else:
                        clean_title = f"Lecture Module #{idx + 1}"
                else:
                    clean_title = raw_title.split("(")[0].strip() or f"Module #{idx + 1}"

                chapter_title = f"Chapter {idx + 1}: {clean_title}"

                target_term = clean_title
                correct_opt = f"{clean_title} — {v['description'][:55]}" if v["description"] else clean_title

                random.seed(int(v["timestamp"]) + idx)
                valid_distractors = [d for d in distractor_pool if d.lower() not in clean_title.lower()]
                distractors = random.sample(valid_distractors, min(3, len(valid_distractors)))
                choices = [correct_opt] + distractors
                random.shuffle(choices)
                letters = ["A", "B", "C", "D"]
                opt_map = dict(zip(letters, choices))
                correct_letter = letters[choices.index(correct_opt)]

                has_real_math = (
                    bool(v["latex"])
                    and any(op in v["latex"] for op in ["=", "\\frac", "\\int", "\\sum", "^", "\\vec", "\\cdot"])
                    and not any(kw in v["latex"].lower() for kw in [
                        "def ", "solve", "print", "class", "import", "return",
                        "\\alpha x", "\\beta x", "\\gamma", "\\epsilon",
                        "alpha x", "beta x",
                    ])
                    and not any(kw in (v["ocr_text"] or "").lower() for kw in [
                        "def ", "print(", "class ", "import ", "for ", "while ",
                        "if ", "elif", "return", "input(", "try:", "except",
                    ])
                )

                if has_real_math:
                    q_text = (
                        f"In Chapter {idx + 1} ({time_label}), the professor formulates equation $${v['latex']}$$. "
                        f"What scientific or mathematical concept does this expression represent?"
                    )
                elif is_python:
                    q_text = (
                        f"According to the lecture instruction in Chapter {idx + 1} ({time_label}), "
                        f"which core programming concept or Python mechanism is demonstrated on the lecture slide?"
                    )
                else:
                    q_text = (
                        f"According to the lecture instruction in Chapter {idx + 1} ({time_label}), "
                        f"which core academic principle is primarily analyzed on the slide?"
                    )

                explanation = (
                    f"Covered at timestamp {time_label} and on Slide #{idx + 1} ({v['title']}): "
                    f"\"{v['description'][:140]}\""
                )

                stages.append(
                    CampaignStage(
                        stage_id=idx + 1,
                        stage_number=idx + 1,
                        title=chapter_title,
                        timestamp_start=round(t_start, 2),
                        timestamp_end=round(t_end, 2),
                        timestamp_label=time_label,
                        summary=v["description"][:160] if v["description"] else "Key concepts covered by the professor in this lecture section.",
                        concept_keyword=target_term,
                        visual=CampaignVisual(
                            id=v["id"],
                            timestamp=float(v["timestamp"]),
                            visual_type=v["visual_type"],
                            title=v["title"],
                            description=v["description"],
                            ocr_text=v["ocr_text"],
                            latex=v["latex"],
                            image_url=f"/api/lecture/visuals/{v['id']}/image",
                        ),
                        question=QuizQuestion(
                            question=q_text,
                            options=opt_map,
                            correct_answer=correct_letter,
                            explanation=explanation,
                        ),
                    )
                )
        else:
            if stage_count:
                total_chapters = stage_count
            elif duration > 36000:
                total_chapters = 20
            elif duration > 14400:
                total_chapters = 15
            elif duration > 7200:
                total_chapters = 12
            elif duration > 3600:
                total_chapters = 8
            else:
                total_chapters = 4

            seg_chunk_size = max(1, len(segments) // total_chapters)
            for idx in range(total_chapters):
                chunk = segments[idx * seg_chunk_size : (idx + 1) * seg_chunk_size]
                if not chunk:
                    continue
                t_start = chunk[0]["start_time"]
                t_end = chunk[-1]["end_time"]
                m_start, s_start = int(t_start // 60), int(t_start % 60)
                m_end, s_end = int(t_end // 60), int(t_end % 60)
                time_label = f"{m_start:02d}:{s_start:02d} → {m_end:02d}:{s_end:02d}"

                chunk_text = " ".join(s["text"] for s in chunk[:15])
                q_list = _generate_local_questions(lec["filename"], chunk_text, 1, "mcq")
                q = q_list[0] if q_list else QuizQuestion(
                    question=f"What principle is discussed in Chapter {idx + 1} ({time_label})?",
                    options={"A": "Core Topic", "B": "Alternate 1", "C": "Alternate 2", "D": "Alternate 3"},
                    correct_answer="A",
                    explanation=f"Discussed in lecture interval {time_label}."
                )

                stages.append(
                    CampaignStage(
                        stage_id=idx + 1,
                        stage_number=idx + 1,
                        title=f"Chapter {idx + 1}: Speech Timeline ({time_label})",
                        timestamp_start=round(t_start, 2),
                        timestamp_end=round(t_end, 2),
                        timestamp_label=time_label,
                        summary=chunk_text[:140] if chunk_text else "Transcript dialogue from this time window.",
                        concept_keyword=f"Chapter {idx + 1}",
                        visual=None,
                        question=q,
                    )
                )

        return CampaignResponse(
            success=True,
            source_type="lecture",
            source_id=lecture_id,
            source_title=lec["filename"],
            total_stages=len(stages),
            duration=duration,
            stages=stages,
        )
    finally:
        connection.close()


def _build_document_campaign(
    document_id: int, difficulty: str = "medium", stage_count: Optional[int] = None
) -> CampaignResponse:
    connection = get_connection()
    try:
        doc = connection.execute("SELECT id, filename FROM documents WHERE id = ?", (document_id,)).fetchone()
        if not doc:
            raise HTTPException(status_code=404, detail=f"Document #{document_id} not found.")
        pages = connection.execute(
            "SELECT page_number, text FROM document_pages WHERE document_id = ? ORDER BY page_number ASC",
            (document_id,),
        ).fetchall()
        if not pages:
            raise HTTPException(status_code=400, detail="Document has no ingested pages.")

        if stage_count:
            total_chapters = min(stage_count, len(pages))
        elif len(pages) > 20:
            total_chapters = min(10, len(pages))
        elif len(pages) > 8:
            total_chapters = min(6, len(pages))
        else:
            total_chapters = min(4, len(pages))

        page_chunk = max(1, len(pages) // total_chapters)
        stages: List[CampaignStage] = []

        for idx in range(total_chapters):
            p_slice = pages[idx * page_chunk : (idx + 1) * page_chunk]
            if not p_slice:
                continue
            p_start = p_slice[0]["page_number"]
            p_end = p_slice[-1]["page_number"]
            page_label = f"Page {p_start}" if p_start == p_end else f"Pages {p_start}–{p_end}"
            chunk_text = "\n".join(p["text"] for p in p_slice)

            q_list = _generate_local_questions(doc["filename"], chunk_text, 1, "mcq")
            q = q_list[0] if q_list else QuizQuestion(
                question=f"Which concept is established in Chapter {idx + 1} ({page_label})?",
                options={"A": "Primary Principle", "B": "Distractor B", "C": "Distractor C", "D": "Distractor D"},
                correct_answer="A",
                explanation=f"Found on {page_label} of {doc['filename']}."
            )

            stages.append(
                CampaignStage(
                    stage_id=idx + 1,
                    stage_number=idx + 1,
                    title=f"Chapter {idx + 1}: {page_label}",
                    timestamp_start=float(p_start),
                    timestamp_end=float(p_end),
                    timestamp_label=page_label,
                    summary=chunk_text[:140] if chunk_text else "Document excerpt from this chapter.",
                    concept_keyword=f"Chapter {idx + 1}",
                    visual=None,
                    question=q,
                )
            )

        return CampaignResponse(
            success=True,
            source_type="document",
            source_id=document_id,
            source_title=doc["filename"],
            total_stages=len(stages),
            duration=float(len(pages)),
            stages=stages,
        )
    finally:
        connection.close()


@router.post("/campaign", response_model=CampaignResponse)
def get_quiz_campaign(payload: CampaignRequest):
    if payload.source_type == "lecture":
        return _build_lecture_campaign(payload.source_id, payload.difficulty, payload.stage_count)
    return _build_document_campaign(payload.source_id, payload.difficulty, payload.stage_count)


@router.get("/campaign", response_model=CampaignResponse)
def get_quiz_campaign_get(
    source_type: Literal["lecture", "document"] = "lecture",
    source_id: int = 1,
    difficulty: Literal["easy", "medium", "hard"] = "medium",
    stage_count: Optional[int] = None,
):
    if source_type == "lecture":
        return _build_lecture_campaign(source_id, difficulty, stage_count)
    return _build_document_campaign(source_id, difficulty, stage_count)

