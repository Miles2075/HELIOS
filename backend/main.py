from fastapi import FastAPI
from backend.lecture_sync.router import router as lecture_router

app = FastAPI(title="HELIOS API")

#Register Lecturee Sync endpoints
app.include_router(lecture_router)

@app.get("/")
def root():
    return{"message": "HELIOS API is running!"}