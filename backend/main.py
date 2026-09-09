from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.core.database import initialize_database
from backend.brain_map.routes import router as brain_map_router


app = FastAPI(title="HELIOS API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

initialize_database()

app.include_router(brain_map_router)

@app.get("/")
def root():
    return {"message": "HELIOS API is running!"}