from fastapi import FastAPI

app = FastAPI(title="HELIOS API")


@app.get("/")
def root():
    return {"message": "HELIOS API is running!"}