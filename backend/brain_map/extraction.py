"""
Extracts candidate "concepts" from raw text using spaCy noun-chunk detection,
and generates related_to pairs between them for the MVP graph.
"""

import spacy
from itertools import combinations

# Loaded once at import time — reused across every request.
nlp = spacy.load("en_core_web_sm")


def extract_concepts(text: str) -> list[str]:
    """
    Extracts a de-duplicated list of noun-chunk concepts from the given text.

    Noun chunks are used instead of named entity recognition (NER) because
    NER is tuned for people/places/dates, not academic or conceptual terms.
    """
    # Newlines are normalized to spaces so line breaks in messy/pasted text
    # don't cause words from separate lines to merge into one noun chunk.
    text = text.replace("\n", " ")

    doc = nlp(text)
    concepts = set()

    for chunk in doc.noun_chunks:
        cleaned = chunk.text.strip().lower()
        # Filters out very short/junk chunks (e.g. "a", "it").
        if len(cleaned) > 2:
            concepts.add(cleaned)

    return list(concepts)


def detect_relationships(concepts: list[str]) -> list[tuple[str, str, str]]:
    """
    Generates every unique pair of concepts, each labeled "related_to".

    This is a deliberately simple MVP approach — smarter, verb-based
    relationship labeling is a future improvement, not required now.
    """
    relationships = []
    for concept_a, concept_b in combinations(concepts, 2):
        relationships.append((concept_a, concept_b, "related_to"))
    return relationships