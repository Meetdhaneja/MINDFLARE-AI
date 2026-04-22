from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import List


class Settings(BaseSettings):
    APP_NAME: str = "MindfulAI"
    DEBUG: bool = False
    SECRET_KEY: str = "change-me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days

    # Primary: PostgreSQL. Falls back to SQLite if not available.
    # For local dev: Set to postgresql+asyncpg://mindful:mindful123@localhost:5432/mindfulai
    DATABASE_URL: str = "postgresql+asyncpg://mindful:mindful123@localhost:5432/mindfulai"

    GROQ_API_KEY: str = ""
    GROQ_BASE_URL: str = "https://api.groq.com/openai/v1"
    GROQ_MODEL: str = "llama-3.1-8b-instant"
    GROQ_MAX_TOKENS: int = 220
    GROQ_TEMPERATURE: float = 0.85
    GROQ_TIMEOUT: int = 25
    GROQ_MAX_RETRIES: int = 3

    DATASET_PATH: str = "data/mental_health_conversations.jsonl"
    FAISS_INDEX_PATH: str = "data/faiss_index"
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"
    RAG_TOP_K: int = 2

    HISTORY_WINDOW: int = 10
    MIN_TURNS_BEFORE_SUGGESTION: int = 2
    MAX_REGEN_ATTEMPTS: int = 2

    CRISIS_HOTLINE: str = "iCall: 9152987821 | Vandrevala: 1860-2662-345"
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000"]

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings():
    return Settings()


settings = get_settings()
