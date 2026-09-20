from fastapi import FastAPI

from data_storyteller.router import router as data_storyteller_router


app = FastAPI(title="HELIOS API")


app.include_router(data_storyteller_router)


@app.get("/")
def root():
    return {"message": "HELIOS API is running!"}