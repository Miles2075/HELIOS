# HELIOS API Contracts

This document defines the input and output contracts between the HELIOS frontend, backend, and individual modules.

## Modules

- Smart Search
- Quiz Master
- Lecture Sync
- Brain Map
- Data Storyteller

---

## 1. Smart Search

**Owner:** Krishi

### Purpose

Allows users to ask natural-language questions about their uploaded documents and receive AI-generated answers with page-level citations.

### Endpoint 1 — Upload Document

**Method:** `POST`
**Endpoint:** `/api/search/upload`

**Input:** Multipart file upload.

**Supported files:** PDF, TXT

**Output:**

```json
{
  "success": true,
  "document_id": 1,
  "filename": "biology.pdf",
  "message": "Document uploaded successfully"
}
```

### Endpoint 2 — Ask Question

**Method:** `POST`
**Endpoint:** `/api/search/ask`

**Input:**

```json
{
  "document_id": 1,
  "question": "What is photosynthesis?"
}
```

**Output:**

```json
{
  "success": true,
  "answer": "Photosynthesis is the process...",
  "sources": [
    {
      "document": "biology.pdf",
      "page": 42,
      "text": "Photosynthesis is..."
    }
  ]
}
```

### Important Requirements

- Answers must be based on the uploaded documents.
- Relevant sources must be returned with the answer.
- Page numbers must be preserved during PDF processing.
- The system should avoid presenting unsupported information as fact.

---

## 2. Quiz Master

**Owner:** Vinit

### Purpose

Generates practice questions and flashcards from the user's study materials.

### Endpoint — Generate Quiz

**Method:** `POST`
**Endpoint:** `/api/quiz/generate`

**Input:**

```json
{
  "document_id": 1,
  "question_count": 10,
  "difficulty": "medium",
  "type": "mcq"
}
```

**Allowed types:** `mcq`, `true_false`, `flashcard`
**Difficulty:** `easy`, `medium`, `hard`

**Output:**

```json
{
  "success": true,
  "quiz_id": 101,
  "questions": [
    {
      "question": "What is photosynthesis?",
      "options": {
        "A": "Process of respiration",
        "B": "Process of producing food using light",
        "C": "Process of digestion",
        "D": "Process of reproduction"
      },
      "correct_answer": "B",
      "explanation": "Plants use light energy to produce food."
    }
  ]
}
```

### Important Requirements

- Questions must be generated from the selected study material.
- MCQs must contain exactly four options.
- Every question must have a correct answer and an explanation.
- AI output must be validated before being returned to the frontend.
- Invalid AI responses must not be sent to the frontend.

---

## 3. Lecture Sync

**Owner:** Krish

### Purpose

Processes recorded lectures into searchable, timestamped transcripts.

### Endpoint 1 — Upload Lecture

**Method:** `POST`
**Endpoint:** `/api/lecture/upload`

**Input:** Multipart file upload.

**Supported files:** MP3, WAV

**Output:**

```json
{
  "success": true,
  "lecture_id": 201,
  "filename": "physics_lecture.mp3",
  "message": "Lecture uploaded successfully"
}
```

### Endpoint 2 — Transcribe Lecture

**Method:** `POST`
**Endpoint:** `/api/lecture/transcribe`

**Input:**

```json
{
  "lecture_id": 201
}
```

**Output:**

```json
{
  "success": true,
  "lecture_id": 201,
  "status": "completed",
  "duration": 3600,
  "segments": [
    {
      "start_time": 0.0,
      "end_time": 8.5,
      "text": "Today we will discuss Newton's laws."
    },
    {
      "start_time": 8.5,
      "end_time": 17.2,
      "text": "The first law is also known as the law of inertia."
    }
  ]
}
```

### Endpoint 3 — Search Transcript

**Method:** `POST`
**Endpoint:** `/api/lecture/search`

**Input:**

```json
{
  "lecture_id": 201,
  "query": "Newton's first law"
}
```

**Output:**

```json
{
  "success": true,
  "results": [
    {
      "start_time": 8.5,
      "end_time": 17.2,
      "text": "The first law is also known as the law of inertia."
    }
  ]
}
```

### Important Requirements

- Only supported audio formats should be accepted.
- Transcription and search results must preserve timestamps.
- Audio processing errors must be handled gracefully.
- The original audio file must not be modified or deleted during processing.

---

## 4. Brain Map

**Owner:** Vipsa

### Purpose

Analyzes study material, identifies important concepts, and creates an interactive graph showing relationships between concepts.

### Endpoint — Generate Brain Map

**Method:** `POST`
**Endpoint:** `/api/brainmap/generate`

**Input:**

```json
{
  "document_id": 1
}
```

**Output:**

```json
{
  "success": true,
  "map_id": 301,
  "nodes": [
    {
      "id": "photosynthesis",
      "label": "Photosynthesis",
      "type": "concept"
    },
    {
      "id": "chlorophyll",
      "label": "Chlorophyll",
      "type": "concept"
    }
  ],
  "edges": [
    {
      "source": "photosynthesis",
      "target": "chlorophyll",
      "relationship": "uses"
    }
  ]
}
```

### Important Requirements

- Concepts should be extracted from the selected study material.
- Duplicate concepts should be avoided where possible.
- Relationships should represent meaningful connections.
- Every edge must reference valid node IDs.
- The output must be valid JSON.
- The frontend should be able to use the returned nodes and edges to render an interactive graph.

---

## 5. Data Storyteller

**Owner:** Nidhi

### Purpose

Accepts CSV or Excel datasets, analyzes the data, generates suitable visualizations, and produces a human-readable summary of the results.

### Endpoint 1 — Upload Dataset

**Method:** `POST`
**Endpoint:** `/api/data/upload`

**Input:** Multipart file upload.

**Supported files:** CSV, XLSX

**Output:**

```json
{
  "success": true,
  "dataset_id": 401,
  "filename": "experiment_results.xlsx",
  "message": "Dataset uploaded successfully"
}
```

### Endpoint 2 — Analyze Dataset

**Method:** `POST`
**Endpoint:** `/api/data/analyze`

**Input:**

```json
{
  "dataset_id": 401
}
```

**Output:**

```json
{
  "success": true,
  "dataset_id": 401,
  "summary": {
    "rows": 100,
    "columns": 5
  },
  "statistics": {
    "mean": 42.5,
    "median": 41.0
  },
  "charts": [
    {
      "type": "scatter",
      "x": "temperature",
      "y": "growth",
      "title": "Temperature vs Growth"
    }
  ],
  "ai_summary": "The results indicate that..."
}
```

### Important Requirements

- Only CSV and XLSX files should be accepted.
- The uploaded data should be validated before analysis.
- Missing or invalid values should be handled appropriately.
- Statistical calculations must be performed using the actual dataset.
- Charts must be generated from the analyzed data.
- AI summaries must be based on the calculated results.
- The API must return structured data that the frontend can use to render charts.
