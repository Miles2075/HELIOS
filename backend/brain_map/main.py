from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from extraction import extract_concepts, detect_relationships
from graph_builder import build_graph, filter_graph
from serialization import serialize_graph   
from pydantic import BaseModel
from typing import List

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class GenerateRequest(BaseModel):
    document_id: str

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

@app.post("/api/brainmap/generate", response_model=BrainMapResponse)
def generate_brain_map(request: GenerateRequest):
    sample_text = "Mitochondria are the powerhouse of the cell. Chlorophyll absorbs sunlight during photosynthesis."
    concepts = extract_concepts(sample_text)
    relationships = detect_relationships(concepts)
    graph = build_graph(concepts, relationships)
    filtered = filter_graph(graph)
    result = serialize_graph(filtered)
    return result