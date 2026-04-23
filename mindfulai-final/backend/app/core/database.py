from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.engine.url import make_url
from sqlalchemy.exc import OperationalError
from sqlalchemy import event
import asyncio
import logging

from app.core.config import settings

log = logging.getLogger(__name__)


def _create_engine():
    """Create database engine with PostgreSQL fallback to SQLite."""
    url_str = settings.DATABASE_URL
    
    # Remove sslmode if present in string to avoid asyncpg TypeError, 
    # we will handle SSL in connect_args
    if "sslmode=" in url_str:
        url_str = url_str.split("sslmode=")[0].rstrip("?&")

    url = make_url(url_str)

    if url.drivername.startswith("sqlite"):
        log.info("Using SQLite database with WAL mode for better concurrency")
        engine = create_async_engine(
            url_str,
            echo=False,
            connect_args={"timeout": 60, "check_same_thread": False},
            pool_pre_ping=True,
            pool_recycle=3600,
        )

        @event.listens_for(engine.sync_engine, "connect")
        def set_sqlite_pragma(dbapi_connection, connection_record):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA busy_timeout=60000")
            cursor.close()

        log.warning("Using SQLite. Switch to PostgreSQL for production.")
        return engine

    log.info(f"Attempting PostgreSQL connection to host: {url.host}")
    
    # Add SSL context for PostgreSQL (required for Neon)
    connect_args = {}
    if url.host and "neon.tech" in str(url.host):
        connect_args["ssl"] = True
        log.info("SSL enabled for Neon connection")

    return create_async_engine(
        url_str,
        pool_size=20,
        max_overflow=30,
        pool_pre_ping=True,
        pool_recycle=3600,
        echo=False,
        connect_args=connect_args
    )


async def _test_and_fallback_if_needed(engine):
    """Test PostgreSQL connection and fall back to SQLite if needed."""
    try:
        async with engine.begin() as conn:
            pass
        log.info("PostgreSQL connection successful")
        return engine
    except Exception as e:
        log.warning(
            f"PostgreSQL connection failed ({type(e).__name__}): {str(e)[:100]}. Falling back to SQLite."
        )

        sqlite_url = "sqlite+aiosqlite:///mindfulai.db"
        log.info(f"Using fallback SQLite database: {sqlite_url}")

        engine = create_async_engine(
            sqlite_url,
            echo=False,
            connect_args={"timeout": 60, "check_same_thread": False},
            pool_pre_ping=True,
            pool_recycle=3600,
        )

        @event.listens_for(engine.sync_engine, "connect")
        def set_sqlite_pragma(dbapi_connection, connection_record):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA busy_timeout=60000")
            cursor.close()

        log.warning("Fallback mode: using SQLite with WAL mode.")
        log.warning("Concurrent streaming may see locking. PostgreSQL avoids this.")
        return engine


engine = _create_engine()
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def create_tables():
    """Create database tables with retry for locking issues."""
    global engine, AsyncSessionLocal

    engine = await _test_and_fallback_if_needed(engine)
    AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    max_attempts = 6
    for attempt in range(max_attempts):
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            log.info("Database tables created successfully")
            return
        except OperationalError as e:
            error_str = str(e).lower()
            if "database is locked" in error_str and attempt < max_attempts - 1:
                wait_time = 0.5 * (2 ** attempt)
                log.warning(
                    f"Database locked (attempt {attempt + 1}/{max_attempts}), retrying in {wait_time}s..."
                )
                await asyncio.sleep(wait_time)
                continue
            log.error(f"Failed to create tables after {attempt + 1} attempts: {e}")
            raise
