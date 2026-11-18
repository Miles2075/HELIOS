# HELIOS

HELIOS is an AI-powered study workspace for turning learning materials into searchable, useful study support. The project combines a React dashboard with a FastAPI backend and a local document-search pipeline.

## Current Status

The project has a working Smart Search foundation and completed module implementations in separate feature branches. Smart Search currently provides:

- Upload PDF and TXT study materials.
- Extract text while preserving PDF page numbers.
- Store document metadata and extracted pages in SQLite.
- Generate local semantic embeddings with `all-MiniLM-L6-v2`.
- Search uploaded material with ChromaDB.
- Generate grounded answers with Google Gemini, including page references.

The frontend currently provides the HELIOS dashboard experience and theme controls. The module updates below describe work completed by the team; a module is production-ready only after its branch is merged, registered in the shared application, connected to the frontend, and covered by integration tests.

## Team Module Progress

### Smart Search

**Status: Core implementation complete**

- Accepts PDF and TXT uploads.
- Extracts text while preserving PDF page numbers.
- Stores document metadata and page text in SQLite.
- Generates `all-MiniLM-L6-v2` embeddings and stores them in ChromaDB.
- Performs semantic search with a relevance threshold.
- Generates grounded Gemini answers with page references.

### Lecture Sync

**Status: Backend module reported complete; merge and end-to-end integration pending**

Completed on `feature/krish-lecture-sync`:

- Created `backend/lecture_sync/` with package initialization and router code.
- Integrated the lecture router into the FastAPI application.
- Implemented `POST /api/lecture/upload` for `.mp3` and `.wav` files.
- Saves original audio files without modifying them and returns a lecture ID.
- Implemented `POST /api/lecture/transcribe` with structured segments and floating-point timestamps.
- Implemented `POST /api/lecture/search` with case-insensitive transcript matching and preserved timestamp bounds.
- Verified the endpoints and schemas through Swagger UI.
- Committed and pushed as `feat: implement lecture sync`.

The remaining delivery step reported for this module is opening and completing the pull request into `main`, followed by shared-branch integration testing.

### Quiz Master

**Status: Backend and Gemini generation flow reported complete; integration pending**

Completed work includes:

- FastAPI application setup with CORS, environment loading, API metadata, `/`, and `/health` endpoints.
- Quiz package and Pydantic request/response schemas.
- Validation for document IDs, question counts, difficulty, question types, MCQs, true/false questions, and flashcards.
- Gemini integration with document-grounded prompts and JSON response handling.
- AI output validation before responses reach the frontend.
- Temporary document retrieval and quiz ID generation.
- Up to three generation/validation retries before returning an error.
- `POST /api/quiz/generate` with request and internal error handling.

The module still needs to be merged into the shared backend, connected to the real document store rather than temporary sample material, connected to the frontend, and tested against the deployed Gemini configuration.

### Brain Map

**Status: Backend pipeline reported complete and stable; frontend rebuild and integration pending**

Completed work includes:

- Concept extraction using spaCy noun chunks.
- Deterministic relationship detection and NetworkX graph construction.
- Readability limits of 50 nodes and 150 edges.
- Serialization matching the confirmed API response schema.
- `react-force-graph-3d` integration with rotation, zoom, and pan.
- CORS setup and router integration using the shared `APIRouter` pattern.
- Real `document_id`-based lookup through `document_pages`.
- Fixes for newline handling and accidental removal of isolated nodes.
- Verification with messy, large, and sparse inputs.
- Confirmation that internal edge weights are not exposed in the API response.

The reported next step is rebuilding `BrainMap.jsx` as a standalone page with document ID input, loading and error states, and basic graph interaction. It should then be merged and tested with the shared database and application.

### Data Storyteller

**Status: Upload and profiling backend complete; analysis features and frontend pending**

Completed work includes:

- Created and connected the Data Storyteller backend module.
- Implemented `POST /api/data/upload` for CSV and XLSX files.
- Added file-type and dataset validation.
- Added SQLite dataset metadata storage and unique dataset IDs.
- Implemented `POST /api/data/analyze`.
- Added Pandas profiling for rows, columns, data types, missing values, unique values, and numerical statistics including mean, median, minimum, maximum, and standard deviation.
- Tested upload and analysis through FastAPI Swagger.

Remaining module work includes automatic chart selection, Plotly visualization generation, Gemini-generated summaries, the React interface, and dashboard integration.

## Deployment Readiness

Based on the team updates, the project is in **late integration / pre-deployment**, not yet production-ready. The main feature work is substantially underway, but the modules are at different maturity levels:

| Area | Reported progress | Remaining work |
| --- | --- | --- |
| Smart Search | Core pipeline complete | Shared integration hardening and production deployment checks |
| Lecture Sync | Backend endpoints complete | Pull request, merge, real transcription implementation verification, frontend, integration tests |
| Quiz Master | Backend, Gemini, validation, and retry flow complete | Real document integration, merge, frontend, secrets/configuration testing |
| Brain Map | Backend pipeline and 3D dependency verified | Finish `BrainMap.jsx`, merge, frontend/API integration, deployment testing |
| Data Storyteller | Upload and profiling complete | Charts, Plotly, Gemini summaries, frontend, merge, integration tests |
| Shared frontend | Dashboard shell and themes available | Route/module screens, API clients, loading/error states, upload and result workflows |
| Deployment | Local Swagger verification reported | Production hosting, environment variables, CORS, persistent storage, CI/CD, monitoring, security, and final acceptance testing |

### Work required before a complete deployment

1. Merge each feature branch into a shared integration branch and resolve duplicate changes in `main.py`, database setup, CORS, and dependencies.
2. Replace temporary or sample document data with the shared SQLite/ChromaDB document flow wherever modules still use placeholders.
3. Register every live router and confirm the final OpenAPI schema matches `docs/API_CONTRACT.md`.
4. Finish frontend pages and connect all workflows to the backend APIs.
5. Add automated unit, API, and end-to-end tests for successful requests, invalid files, missing documents, empty results, AI failures, and malformed AI output.
6. Configure production secrets and service settings, including `GEMINI_API_KEY`, allowed CORS origins, upload limits, persistent database/vector storage, and file cleanup policies.
7. Deploy backend and frontend, then run smoke tests through the deployed URL and verify Swagger, uploads, AI calls, and persistence.
8. Add production safeguards such as authentication/authorization, rate limiting, request logging, error monitoring, backups, and HTTPS before exposing the application publicly.

The exact remaining percentage cannot be measured from feature descriptions alone, because branch state, implementation quality, deployment target, and acceptance criteria are not included. A reasonable planning estimate is that the team has completed roughly **60-75% of the application feature development**, while only **35-50% of production deployment readiness** is complete. The largest remaining effort is integration and production hardening rather than creating the individual module prototypes.

## Architecture

```text
HELIOS/
├── backend/
│   ├── main.py                 FastAPI application entry point
│   ├── core/                   SQLite configuration and database setup
│   ├── smart_search/           Upload, extraction, embeddings, search, and Gemini answer generation
│   ├── chroma_db/              Local ChromaDB data
│   └── helios.db               Created automatically on first backend start
├── frontend/
│   ├── src/                    React application and styles
│   └── package.json            Vite scripts and frontend dependencies
├── docs/
│   └── API_CONTRACT.md         Planned and implemented API contracts
├── tests/                      Backend tests and test fixtures
└── uploads/documents/          Uploaded PDF and TXT files
```

## Requirements

- Python 3.10 or newer
- Node.js 18 or newer and npm
- A Google Gemini API key
- Enough disk space for the embedding model and local ChromaDB index

## Setup

### 1. Clone and enter the project

```powershell
git clone <repository-url>
cd HELIOS
```

### 2. Create the Python environment

Windows PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r backend\requirements.txt
```

If PowerShell blocks script activation for the current session, run:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
```

### 3. Configure Gemini

Create a `.env` file in the repository root:

```env
GEMINI_API_KEY=your-gemini-api-key
```

The key is required when the backend imports the Gemini integration. Do not commit `.env` or expose the key in frontend code.

### 4. Install frontend dependencies

```powershell
cd frontend
npm install
cd ..
```

## Run Locally

Start the backend from the repository root with the virtual environment activated:

```powershell
uvicorn backend.main:app --reload
```

The API is available at `http://127.0.0.1:8000`.

- Health check: `GET /`
- Swagger UI: `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redoc`

In a second terminal, start the frontend:

```powershell
cd frontend
npm run dev
```

Vite prints the local frontend URL, normally `http://localhost:5173`.

## Smart Search API

### Upload a document

Supported file types are `.pdf` and `.txt`. Uploading a file with the same filename replaces the existing indexed copy.

```powershell
curl.exe -X POST http://127.0.0.1:8000/api/search/upload `
	-F "file=@C:\path\to\notes.pdf"
```

Example response:

```json
{
	"success": true,
	"document_id": 1,
	"filename": "notes.pdf",
	"pages_extracted": 12,
	"pages_embedded": 12,
	"message": "Document uploaded successfully"
}
```

### Search documents

`query` is required. `top_k` defaults to `5`.

```text
GET http://127.0.0.1:8000/api/search/search?query=What%20is%20photosynthesis%3F&top_k=5
```

Example response shape:

```json
{
	"success": true,
	"query": "What is photosynthesis?",
	"answer": "... [Page 2]",
	"results": [
		{
			"text": "Relevant document text...",
			"document_id": 1,
			"page_number": 2,
			"filename": "biology.pdf",
			"distance": 0.31
		}
	]
}
```

Search only keeps results with a vector distance of `0.6` or less. If no sufficiently relevant content is found, the API returns an empty `results` list and a corresponding message instead of generating an answer from outside knowledge.

## Development Commands

Run backend tests from the repository root:

```powershell
pytest
```

Run frontend linting and a production build:

```powershell
cd frontend
npm run lint
npm run build
```

## Data and Generated Files

The following local files and directories are generated during development and are ignored by Git:

- `.env` for secrets
- `backend/helios.db` for document metadata and extracted pages
- `backend/chroma_db/` for vector embeddings
- `uploads/` for uploaded source files
- `frontend/node_modules/` and `frontend/dist/` for frontend dependencies and builds

Deleting the SQLite database, ChromaDB directory, and uploads removes the local document index and uploaded source files. The embedding model may be downloaded the first time `sentence-transformers` is used.

## API Documentation

See [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md) for the wider module contracts and planned endpoints. The live FastAPI routes and generated OpenAPI documentation are the source of truth for currently implemented behavior.
