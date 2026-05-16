"""
ZivaBI API — database engine and session factory.

Provides:
  - `engine`            async SQLAlchemy engine (asyncpg dialect)
  - `AsyncSessionLocal` session factory used by all DB operations
  - `Base`              declarative base that all ORM models inherit from
  - `get_db()`          FastAPI dependency that yields a session per request

Connection URL handling: Render issues URLs beginning with "postgres://" or
"postgresql://"; both are normalised to "postgresql+asyncpg://" here so that
asyncpg (the async driver) is always used regardless of which prefix Render sends.

Pool settings are conservative for Render's Starter tier (limited connections).
Increase pool_size and max_overflow once we upgrade to a larger DB plan.
"""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings


def _build_async_url(url: str) -> str:
    """Normalise any postgres:// variant to the asyncpg dialect URL."""
    url = url.replace("postgres://", "postgresql+asyncpg://")
    url = url.replace("postgresql://", "postgresql+asyncpg://")
    return url


engine = create_async_engine(
    _build_async_url(settings.database_url),
    echo=settings.debug,      # logs SQL in debug mode; never enable in production
    pool_pre_ping=True,        # drop stale connections before handing them to app code
    pool_size=5,               # keep 5 connections warm
    max_overflow=10,           # allow up to 10 extra connections under burst load
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    expire_on_commit=False,   # avoid lazy-load errors after commit in async context
    class_=AsyncSession,
)


class Base(DeclarativeBase):
    """
    Declarative base for all ZivaBI ORM models.

    Import this in every models/*.py file and subclass it:

        from app.database import Base

        class MyModel(Base):
            __tablename__ = "my_table"
            ...

    Alembic's env.py imports Base.metadata to auto-detect schema changes.
    """


async def get_db():
    """
    FastAPI dependency — yields an async DB session for the lifetime of one request.

    Usage in a router:
        from fastapi import Depends
        from app.database import get_db
        from sqlalchemy.ext.asyncio import AsyncSession

        @router.get("/example")
        async def example(db: AsyncSession = Depends(get_db)):
            ...

    The session is committed on success and rolled back on any exception,
    then closed regardless of outcome.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
