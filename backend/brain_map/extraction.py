import spacy

nlp = spacy.load("en_core_web_sm")

def extract_concepts(text: str) -> list[str]:
    doc = nlp(text)
    concepts = set()
    for chunk in doc.noun_chunks:
        cleaned = chunk.text.strip().lower()
        if len(cleaned) > 2:
            concepts.add(cleaned)
    return list(concepts)