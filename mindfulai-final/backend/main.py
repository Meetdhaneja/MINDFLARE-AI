from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from app.core.config import settings
from app.core.database import create_tables
from app.services import rag_service
from app.routers import auth, chat

logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info(f"Starting {settings.APP_NAME}")
    await create_tables()
    log.info("Database tables ready")
    provider = "Groq (cloud)" if settings.GROQ_API_KEY else "LM Studio (local — make sure it's running)"
    log.info(f"LLM provider: {provider}")
    
    # Initialize RAG service in background to prevent blocking startup
    # import asyncio
    # rag = rag_service.get_rag_service()
    # asyncio.create_task(asyncio.to_thread(rag.initialize))
    # log.info("RAG service initialization started in background")
    
    yield
    log.info("Shutting down")


app = FastAPI(
    title="MindfulAI API",
    description="Human-like AI mental health companion",
    version="3.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_origin_regex=settings.ALLOWED_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(chat.router)


@app.get("/")
async def root():
    return {"name": settings.APP_NAME, "status": "running", "docs": "/docs"}


@app.get("/health")
async def health():
    return {"status": "ok", "provider": "groq"}
