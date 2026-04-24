"""Database connection and session management.

Provides:
- SQLAlchemy engine initialization with connection pooling
- Session factory for dependency injection
- Declarative base for ORM models
- Database session dependency for FastAPI endpoints
"""
import os
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is required")

engine = create_engine(DATABASE_URL, pool_pre_ping=True, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """Get a database session. Yields a session and ensures it closes."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()