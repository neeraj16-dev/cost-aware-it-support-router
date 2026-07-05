from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from sentence_transformers import SentenceTransformer
from ml_pipeline.config import MODELS_DIR, ARTIFACTS_DIR
from backend.app.model_manager import manager
from backend.app.api.routes import router
from langchain_google_genai import ChatGoogleGenerativeAI
from dotenv import load_dotenv
from backend.app.db.database import init_db
from backend.app.api import auth_routes
import os
import joblib
import logging
import asyncio
import json

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def load_models():
    logger.info("Loading Setence Transformer...")

    embedder = SentenceTransformer(
        "paraphrase-multilingual-MiniLM-L12-v2"
    )

    logger.info("Loading ML router...")

    router_model = joblib.load(
        MODELS_DIR / "fast_router_model.joblib"
    )

    with open(
        ARTIFACTS_DIR / "category_map.json",
        "r",
        encoding="utf-8"
    ) as f:
        category_map = {
            int(k): v for k,v in json.load(f).items()
        }

    logger.info("Initializing Langchain LLM fallback...")
    llm = ChatGoogleGenerativeAI(
        model="gemini-3.1-flash-lite",
        temperature=0
    )
    
    return embedder, router_model, category_map, llm

@asynccontextmanager
async def lifespan(app: FastAPI):

    logger.info("Initializing Database...")
    init_db()

    (manager.embedder, manager.router_model, manager.category_map, manager.llm) = await asyncio.to_thread(load_models)

    logger.info("Backend is ready!")

    yield

    logger.info("Shutting down backend...")

app = FastAPI(
    title = "Cost-Aware IT Support Router",
    lifespan=lifespan,
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)
app.include_router(router)
app.include_router(auth_routes.router)





