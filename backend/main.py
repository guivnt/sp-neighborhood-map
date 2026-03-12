import os

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

app = FastAPI()
static_dir = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
