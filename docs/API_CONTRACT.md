# HELIOS API Contracts

This document defines the input and output contracts
between the HELIOS frontend, backend, and individual modules.

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

Allows users to ask natural-language questions about their uploaded
documents and receive AI-generated answers with page-level citations.

### Endpoint 1 — Upload Document

**Method:** `POST`

**Endpoint:**

`/api/search/upload`

**Input:**

Multipart file upload.

**Supported files:**

- PDF
- TXT

**Output:**

```json
{
  "success": true,
  "document_id": 1,
  "filename": "biology.pdf",
  "message": "Document uploaded successfully"
}

### Endpoint 2 — Ask Question

**Method:** POST

**Endpoint:**

/api/search/ask

**Input:**

Plain textANTLR4BashCC#CSSCoffeeScriptCMakeDartDjangoDockerEJSErlangGitGoGraphQLGroovyHTMLJavaJavaScriptJSONJSXKotlinLaTeXLessLuaMakefileMarkdownMATLABMarkupObjective-CPerlPHPPowerShell.propertiesProtocol BuffersPythonRRubySass (Sass)Sass (Scss)SchemeSQLShellSwiftSVGTSXTypeScriptWebAssemblyYAMLXML`   {    "document_id": 1,    "question": "What is photosynthesis?"  }   `

**Output:**

Plain textANTLR4BashCC#CSSCoffeeScriptCMakeDartDjangoDockerEJSErlangGitGoGraphQLGroovyHTMLJavaJavaScriptJSONJSXKotlinLaTeXLessLuaMakefileMarkdownMATLABMarkupObjective-CPerlPHPPowerShell.propertiesProtocol BuffersPythonRRubySass (Sass)Sass (Scss)SchemeSQLShellSwiftSVGTSXTypeScriptWebAssemblyYAMLXML`   {    "success": true,    "answer": "Photosynthesis is the process...",    "sources": [      {        "document": "biology.pdf",        "page": 42,        "text": "Photosynthesis is..."      }    ]  }   `

### Important Requirements

*   Answers must be based on the uploaded documents.
    
*   Relevant sources must be returned with the answer.
    
*   Page numbers must be preserved during PDF processing.
    
*   The system should avoid presenting unsupported information as fact.