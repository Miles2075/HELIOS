from fastapi import FastAPI

from backend.smart_search.routes import router as smart_search_router


app = FastAPI(title="HELIOS API")

app.include_router(smart_search_router)


@app.get("/")
def root():
    return {"message": "HELIOS API is running!"}