import chromadb


CHROMA_PATH = "backend/chroma_db"

client = chromadb.PersistentClient(path=CHROMA_PATH)

collection = client.get_or_create_collection(
    name="document_pages",
    metadata={"hnsw:space": "cosine"},
)