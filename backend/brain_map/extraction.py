import spacy
from itertools import combinations

nlp = spacy.load("en_core_web_sm")

def extract_concepts(text: str) -> list[str]:
    doc = nlp(text)
    concepts = set()
    for chunk in doc.noun_chunks:
        cleaned = chunk.text.strip().lower()
        if len(cleaned) > 2:
            concepts.add(cleaned)
    return list(concepts)

def detect_relationships(concepts: list[str]) -> list[tuple[str, str, str]]:
    relationships = []
    for concept_a, concept_b in combinations(concepts, 2):
        relationships.append((concept_a, concept_b, "related_to"))
    return relationships