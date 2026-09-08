from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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
    dummy_nodes = [
        Node(id="n1", label="Photosynthesis", type="concept"),
        Node(id="n2", label="Chlorophyll", type="concept"),
        Node(id="n3", label="Sunlight", type="concept"),
    ]
    dummy_edges = [
        Edge(source="n1", target="n2", relationship="related_to"),
        Edge(source="n1", target="n3", relationship="related_to"),
    ]
    return BrainMapResponse(
        success=True,
        map_id="dummy-map-001",
        nodes=dummy_nodes,
        edges=dummy_edges,
    )