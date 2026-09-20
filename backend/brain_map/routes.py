"""
Brain Map API routes — ties together document fetching, concept extraction,
graph building/filtering, and serialization into the /generate endpoint.

Follows the same APIRouter pattern as Smart Search's routes.py so this
module can be registered into the shared backend/main.py.
"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import List

from backend.brain_map.extraction import extract_concepts, detect_relationships
from backend.brain_map.graph_builder import build_graph, filter_graph
from backend.brain_map.serialization import serialize_graph
from backend.brain_map.document_fetch import get_document_text

router = APIRouter(
    prefix="/api/brainmap",
    tags=["Brain Map"],
)


class GenerateRequest(BaseModel):
    # Matches the integer primary key in the shared "documents" table.
    document_id: int


class Node(BaseModel):
    id: str
    label: str
    type: str


class Edge(BaseModel):
    source: str
    target: str
    relationship: str


class BrainMapResponse(BaseModel):
    success: bool
    map_id: str
    nodes: List[Node]
    edges: List[Edge]


@router.post("/generate", response_model=BrainMapResponse)
def generate_brain_map(request: GenerateRequest):
    """
    Generates a concept graph for the given document_id, reading its
    already-extracted text from the shared database.
    """
    text = get_document_text(request.document_id)
    concepts = extract_concepts(text)
    relationships = detect_relationships(concepts)
    graph = build_graph(concepts, relationships)
    filtered = filter_graph(graph)
    result = serialize_graph(filtered)
    return result