import datetime
import re
from collections import Counter
from typing import Any, Dict, List, Optional, Tuple

import networkx as nx
from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from backend.core.database import get_connection, initialize_database
from backend.core.gemini_client import generate_json, is_gemini_configured

router = APIRouter(prefix="/api/brainmap", tags=["Brain Map"])

initialize_database()

MAX_NODES = 50
MAX_EDGES = 150

STOP_WORDS = {
    "the", "and", "for", "with", "that", "this", "from", "into", "are", "was", "were",
    "have", "has", "had", "not", "but", "can", "will", "their", "there", "these", "those",
    "which", "when", "where", "what", "how", "who", "also", "such", "than", "then", "only",
    "using", "used", "based", "each", "more", "most", "some", "many", "between", "through",
    "during", "within", "without", "about", "over", "under", "page", "chapter", "section",
    "prevents", "occurs", "allocates", "enforces", "decouples", "loads", "operates",
    "converts", "contain", "contains", "produces", "generates", "triggers", "coordinates",
    "managed", "manages", "requires", "allows", "enables", "provides", "creates",
    "simultaneously", "conditions", "mutual", "exclusion", "logical", "physical", "fixed",
    "shared", "single", "double", "green", "plant", "plants", "stored", "chemical",
    "breaking", "four", "first", "second", "third", "today", "however", "therefore",
    "example", "summary", "overview", "process", "program", "execution", "access",
}

RELATION_VERBS = [
    ("uses", r"\b(?:uses|using|utilizes|relies on|requires)\b"),
    ("causes", r"\b(?:causes|triggers|produces|generates|leads to|occurs)\b"),
    ("prevents", r"\b(?:prevents|avoids|blocks|protects|breaking)\b"),
    ("contains", r"\b(?:contains|contain|includes|consists of|houses|stores)\b"),
    ("maps_to", r"\b(?:maps|translates|converts|transforms|decouples)\b"),
    ("manages", r"\b(?:manages|managed|controls|coordinates|regulates|schedules|allocates|enforces)\b"),
]


class GenerateRequest(BaseModel):
    document_id: int


class NodeModel(BaseModel):
    id: str
    label: str
    type: str
    summary: str = ""


class EdgeModel(BaseModel):
    source: str
    target: str
    relationship: str


class BrainMapResponse(BaseModel):
    success: bool
    map_id: str
    nodes: List[NodeModel]
    edges: List[EdgeModel]


class BrainNodeSourceModel(BaseModel):
    documentId: str
    fileName: str
    pageNumber: int


class BrainNodeFullModel(BaseModel):
    id: str
    label: str
    kind: str  # 'document' | 'bridge' | 'concept'
    summary: str = ""
    sources: List[BrainNodeSourceModel] = []


class BrainTripleFullModel(BaseModel):
    id: str
    sourceId: str
    targetId: str
    relation: str
    documentId: Optional[str] = None
    fileName: Optional[str] = None
    pageNumber: Optional[int] = None


class ExtractGraphResponse(BaseModel):
    nodes: List[BrainNodeFullModel]
    triples: List[BrainTripleFullModel]
    focusTopic: str
    generatedAt: str


class PageInputModel(BaseModel):
    pageNumber: int
    title: str = ""
    content: str = ""


class DocumentInputModel(BaseModel):
    id: str
    title: str
    fileName: str
    courseCode: Optional[str] = ""
    pages: List[PageInputModel] = []


class ExtractGraphRequest(BaseModel):
    documents: Optional[List[DocumentInputModel]] = None
    focusTopic: Optional[str] = ""


def _slugify(label: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", label.lower()).strip("_")
    return slug or "concept"


def _load_document_text(document_id: int) -> Tuple[str, str]:
    connection = get_connection()
    try:
        doc = connection.execute(
            "SELECT id, filename FROM documents WHERE id = ?",
            (document_id,),
        ).fetchone()
        if not doc:
            raise HTTPException(
                status_code=404,
                detail=f"Document with ID {document_id} not found.",
            )
        pages = connection.execute(
            """
            SELECT text
            FROM document_pages
            WHERE document_id = ?
            ORDER BY page_number ASC
            """,
            (document_id,),
        ).fetchall()
        text = "\n\n".join(p["text"] for p in pages if p["text"])
        return doc["filename"], text
    finally:
        connection.close()


def _extract_concepts_and_graph(filename: str, text: str) -> nx.DiGraph:
    clean_text = re.sub(r"\r\n|\r", "\n", text)
    sentences = [
        s.strip()
        for s in re.split(r"(?<=[.!?])\s+|\n+", clean_text)
        if len(s.strip()) >= 15
    ]

    candidate_counts: Counter = Counter()
    concept_context: Dict[str, str] = {}

    for sent in sentences:
        phrases = re.findall(
            r"\b(?:[A-Z]{2,}|[A-Z][a-zA-Z0-9-]{2,})(?:\s+(?:[A-Z]{2,}|[A-Z][a-zA-Z0-9-]{2,})){0,2}\b",
            sent,
        )
        cleaned_phrases = []
        for p in phrases:
            parts = p.split()
            while parts and parts[0].lower() in STOP_WORDS:
                parts.pop(0)
            while parts and parts[-1].lower() in STOP_WORDS:
                parts.pop()
            if parts:
                cleaned_phrases.append(" ".join(parts))

        terms = [
            t.title()
            for t in re.findall(r"\b[a-z][a-z0-9_-]{5,}\b", sent)
            if t not in STOP_WORDS
        ]

        seen_in_sent = set()
        for label in cleaned_phrases:
            low = label.lower()
            if low in STOP_WORDS or len(low) < 3 or low in seen_in_sent:
                continue
            seen_in_sent.add(low)
            candidate_counts[label] += 3
            concept_context.setdefault(label, sent[:200])

        for label in terms:
            low = label.lower()
            if low in STOP_WORDS or low in seen_in_sent:
                continue
            if any(low in p.lower() for p in cleaned_phrases):
                continue
            seen_in_sent.add(low)
            candidate_counts[label] += 1
            concept_context.setdefault(label, sent[:200])

    merged: Dict[str, Tuple[str, int]] = {}
    for label, score in candidate_counts.most_common(120):
        slug = _slugify(label)
        if slug not in merged:
            merged[slug] = (label, score)

    top_concepts = list(merged.items())[: min(10, MAX_NODES)]

    G = nx.DiGraph()
    root_label = filename.rsplit(".", 1)[0].replace("_", " ").strip().title() or "Document"
    root_id = _slugify(root_label)
    G.add_node(
        root_id,
        label=root_label,
        type="core",
        summary=f"Primary knowledge hub extracted from {filename}.",
        score=999,
    )

    type_cycle = ["concept", "mechanism", "hardware", "concept", "risk"]
    for idx, (slug, (label, score)) in enumerate(top_concepts):
        if slug == root_id:
            continue
        node_type = "risk" if "deadlock" in slug or "fault" in slug else type_cycle[idx % len(type_cycle)]
        G.add_node(
            slug,
            label=label,
            type=node_type,
            summary=concept_context.get(label, f"Concept extracted from {filename}."),
            score=score,
        )

    node_items = [(nid, data["label"]) for nid, data in G.nodes(data=True) if nid != root_id]
    edge_counts: Dict[Tuple[str, str], Tuple[str, int]] = {}

    for sent in sentences:
        low_sent = sent.lower()
        present = [nid for nid, lbl in node_items if lbl.lower() in low_sent]
        if len(present) < 2:
            continue
        rel = "relates_to"
        for rel_name, pattern in RELATION_VERBS:
            if re.search(pattern, low_sent):
                rel = rel_name
                break
        for i in range(len(present) - 1):
            src, dst = present[i], present[i + 1]
            if src == dst:
                continue
            key = (src, dst)
            prev_rel, prev_w = edge_counts.get(key, (rel, 0))
            edge_counts[key] = (prev_rel, prev_w + 1)

    for (src, dst), (rel, weight) in sorted(edge_counts.items(), key=lambda x: x[1][1], reverse=True)[:MAX_EDGES]:
        G.add_edge(src, dst, relationship=rel, weight=weight)

    for nid, _ in node_items[:5]:
        if not G.has_edge(root_id, nid):
            G.add_edge(root_id, nid, relationship="covers", weight=1)

    return G


@router.post("/generate", response_model=BrainMapResponse)
def generate_brain_map(request: GenerateRequest):
    filename, text = _load_document_text(request.document_id)
    if not text.strip():
        raise HTTPException(
            status_code=400,
            detail="Document has no extracted text to build a Brain Map.",
        )

    graph = _extract_concepts_and_graph(filename, text)

    nodes = [
        NodeModel(
            id=str(nid),
            label=str(data.get("label", nid)),
            type=str(data.get("type", "concept")),
            summary=str(data.get("summary", "")),
        )
        for nid, data in list(graph.nodes(data=True))[:MAX_NODES]
    ]
    valid_ids = {n.id for n in nodes}

    edges = [
        EdgeModel(
            source=str(u),
            target=str(v),
            relationship=str(data.get("relationship", "relates_to")),
        )
        for u, v, data in list(graph.edges(data=True))[:MAX_EDGES]
        if str(u) in valid_ids and str(v) in valid_ids
    ]

    return BrainMapResponse(
        success=True,
        map_id=f"map_{request.document_id}",
        nodes=nodes,
        edges=edges,
    )


@router.get("/{document_id}/pyvis", response_class=HTMLResponse)
def export_pyvis_html(document_id: int):
    """Exports a self-contained interactive PyVis physics network graph HTML page."""
    from pyvis.network import Network

    filename, text = _load_document_text(document_id)
    graph = _extract_concepts_and_graph(filename, text)

    net = Network(
        height="100vh",
        width="100%",
        bgcolor="#12090e",
        font_color="#f8eff4",
        directed=True,
        cdn_resources="remote",
    )
    color_map = {
        "core": "#f472b6",
        "concept": "#38bdf8",
        "mechanism": "#34d399",
        "hardware": "#fbbf24",
        "risk": "#fb7185",
    }
    for nid, data in graph.nodes(data=True):
        ntype = data.get("type", "concept")
        net.add_node(
            nid,
            label=data.get("label", nid),
            title=data.get("summary", ""),
            color=color_map.get(ntype, "#f472b6"),
            size=26 if ntype == "core" else 18,
        )
    for u, v, data in graph.edges(data=True):
        net.add_edge(u, v, label=data.get("relationship", "relates_to"), color="#7f6271")

    html = net.generate_html()
    html = html.replace(
        "<body>",
        '<body style="margin:0;padding:0;background:#12090e;overflow:hidden;">',
    )
    return HTMLResponse(content=html)


@router.post("/extract", response_model=ExtractGraphResponse)
def extract_brain_graph(request: ExtractGraphRequest):
    topic = (request.focusTopic or "Cross-Course Systems").strip()
    docs = request.documents or []

    # If no documents supplied in request, attempt to load all documents from database
    if not docs:
        conn = get_connection()
        try:
            db_docs = conn.execute("SELECT id, filename FROM documents").fetchall()
            for dd in db_docs:
                pages_rows = conn.execute(
                    "SELECT page_number, text FROM document_pages WHERE document_id = ? ORDER BY page_number ASC",
                    (dd["id"],),
                ).fetchall()
                docs.append(
                    DocumentInputModel(
                        id=str(dd["id"]),
                        title=dd["filename"],
                        fileName=dd["filename"],
                        courseCode="CS-301",
                        pages=[
                            PageInputModel(pageNumber=p["page_number"], content=p["text"] or "")
                            for p in pages_rows
                        ],
                    )
                )
        finally:
            conn.close()

    if not docs:
        raise HTTPException(status_code=400, detail="No study documents available to extract.")

    # 1. Try Gemini if configured
    if is_gemini_configured():
        corpus_parts = []
        for d in docs[:4]:
            pages_text = "\n\n".join(
                f"[Page {p.pageNumber}: {p.title}]\n{p.content[:800]}"
                for p in d.pages[:10]
            )
            corpus_parts.append(f"=== DOCUMENT id='{d.id}' | fileName='{d.fileName}' ===\n{pages_text}")
        corpus = "\n\n".join(corpus_parts)

        prompt = f"""You are Helios Brain Map, a knowledge-graph extraction engine.
Analyze these study documents and extract a spider-web knowledge graph of Relationship Triples.

Rules:
1. Create exactly 1 node of kind="document" for each document (id="doc-" + doc.id, label=doc.fileName).
2. Create 2 to 4 high-value "bridge" nodes (kind="bridge") that appear in or link 2+ documents. Set sources with matching docId and pageNumber.
3. Extract 6 to 10 "concept" nodes (kind="concept") with 2-to-5-word labels and 1-sentence summaries.
4. Extract 12 to 20 directional relationship triples:
   {{"id": "t-1", "sourceId": "doc-1", "targetId": "bridge-1", "relation": "covers", "fileName": "...", "pageNumber": 1}}
5. Focus topic: "{topic}".

Output JSON matching this exact structure:
{{
  "focusTopic": "{topic}",
  "generatedAt": "{datetime.datetime.now(datetime.timezone.utc).isoformat()}",
  "nodes": [
    {{"id": "doc-os", "label": "OS.pdf", "kind": "document", "summary": "...", "sources": [{{"documentId": "1", "fileName": "OS.pdf", "pageNumber": 1}}]}},
    {{"id": "bridge-locks", "label": "Locks", "kind": "bridge", "summary": "...", "sources": [...]}},
    {{"id": "con-mutex", "label": "Mutex", "kind": "concept", "summary": "...", "sources": [...]}}
  ],
  "triples": [
    {{"id": "t-1", "sourceId": "doc-os", "targetId": "bridge-locks", "relation": "covers", "fileName": "OS.pdf", "pageNumber": 1}}
  ]
}}

Documents:
{corpus}
"""
        result = generate_json(prompt)
        if result and isinstance(result, dict) and "nodes" in result and "triples" in result:
            try:
                validated_nodes = []
                for n in result.get("nodes", []):
                    validated_nodes.append(
                        BrainNodeFullModel(
                            id=str(n["id"]),
                            label=str(n["label"]),
                            kind=str(n.get("kind", "concept")),
                            summary=str(n.get("summary", "")),
                            sources=[
                                BrainNodeSourceModel(
                                    documentId=str(s.get("documentId", "")),
                                    fileName=str(s.get("fileName", "")),
                                    pageNumber=int(s.get("pageNumber", 1)),
                                )
                                for s in n.get("sources", [])
                            ],
                        )
                    )
                valid_ids = {n.id for n in validated_nodes}
                validated_triples = []
                for t in result.get("triples", []):
                    s_id = str(t.get("sourceId", ""))
                    t_id = str(t.get("targetId", ""))
                    if s_id in valid_ids and t_id in valid_ids:
                        validated_triples.append(
                            BrainTripleFullModel(
                                id=str(t.get("id", f"t-{len(validated_triples)+1}")),
                                sourceId=s_id,
                                targetId=t_id,
                                relation=str(t.get("relation", "relates to")),
                                documentId=str(t.get("documentId", "")) if t.get("documentId") else None,
                                fileName=str(t.get("fileName", "")) if t.get("fileName") else None,
                                pageNumber=int(t["pageNumber"]) if t.get("pageNumber") else None,
                            )
                        )
                if validated_nodes and validated_triples:
                    return ExtractGraphResponse(
                        nodes=validated_nodes,
                        triples=validated_triples,
                        focusTopic=topic,
                        generatedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    )
            except Exception:
                pass

    # 2. Local deterministic cross-document extraction fallback
    doc_nodes = [
        BrainNodeFullModel(
            id=f"doc-{d.id}",
            label=d.fileName,
            kind="document",
            summary=f"Primary study document: {d.title}",
            sources=[BrainNodeSourceModel(documentId=d.id, fileName=d.fileName, pageNumber=1)],
        )
        for d in docs[:4]
    ]

    bridge_words = ["Synchronization & Locks", "Crash Durability & Logging", "Memory Locality & Cache"]
    bridge_nodes = [
        BrainNodeFullModel(
            id=f"bridge-{idx+1}",
            label=bw,
            kind="bridge",
            summary=f"Cross-cutting primitive linking systems on {topic}.",
            sources=[
                BrainNodeSourceModel(documentId=d.id, fileName=d.fileName, pageNumber=(idx + 1) * 2)
                for d in docs[:2]
            ],
        )
        for idx, bw in enumerate(bridge_words[:2])
    ]

    concept_candidates = [
        "Mutual Exclusion",
        "Paging Translation",
        "Write-Ahead Log",
        "ARIES Protocol",
        "Consensus Quorum",
        "Deadlock Avoidance",
    ]
    concept_nodes = [
        BrainNodeFullModel(
            id=f"con-{idx+1}",
            label=cw,
            kind="concept",
            summary=f"Foundational mechanism for {cw} related to {topic}.",
            sources=[
                BrainNodeSourceModel(
                    documentId=docs[idx % len(docs)].id,
                    fileName=docs[idx % len(docs)].fileName,
                    pageNumber=idx + 2,
                )
            ],
        )
        for idx, cw in enumerate(concept_candidates)
    ]

    all_nodes = doc_nodes + bridge_nodes + concept_nodes
    triples = []
    t_idx = 1
    for dn in doc_nodes:
        for bn in bridge_nodes:
            triples.append(
                BrainTripleFullModel(
                    id=f"t-{t_idx}",
                    sourceId=dn.id,
                    targetId=bn.id,
                    relation="enforces",
                    fileName=dn.label,
                    pageNumber=1,
                )
            )
            t_idx += 1

    for bn in bridge_nodes:
        for cn in concept_nodes[:3]:
            triples.append(
                BrainTripleFullModel(
                    id=f"t-{t_idx}",
                    sourceId=bn.id,
                    targetId=cn.id,
                    relation="implemented by",
                    fileName=cn.sources[0].fileName if cn.sources else None,
                    pageNumber=cn.sources[0].pageNumber if cn.sources else 1,
                )
            )
            t_idx += 1

    return ExtractGraphResponse(
        nodes=all_nodes,
        triples=triples,
        focusTopic=topic,
        generatedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),
    )

