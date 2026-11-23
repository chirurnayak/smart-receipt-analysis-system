import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine
from .routes import analytics, auth, exports, ocr, receipts, transactions, users


Base.metadata.create_all(bind=engine)

app = FastAPI(title="Receipt Scanning and Payment Analytics API", version="1.0.0")

origins = [item.strip() for item in os.getenv("CORS_ORIGINS", "*").split(",") if item.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(receipts.router, prefix="/api/v1")
app.include_router(transactions.router, prefix="/api/v1")
app.include_router(ocr.router, prefix="/api/v1")
app.include_router(analytics.router, prefix="/api/v1")
app.include_router(exports.router, prefix="/api/v1")


@app.get("/health")
def health():
    return {"status": "ok"}
