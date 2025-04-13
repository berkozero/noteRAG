import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL is None:
    raise ValueError("DATABASE_URL environment variable is not set.")

# Create the SQLAlchemy engine
# connect_args is often needed for SQLite, but usually not for PostgreSQL
# Might need adjustment based on specific PostgreSQL driver/config if issues arise
engine = create_engine(
    DATABASE_URL #, connect_args={"check_same_thread": False} # Example for SQLite
)

# Create a configured "Session" class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create a Base class for declarative models
Base = declarative_base()

# --- Dependency for FastAPI ---
def get_db():
    """
    FastAPI dependency that provides a database session per request.
    Ensures the session is always closed afterwards.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

print(f"Database engine created for URL ending with: ...{DATABASE_URL[-20:]}") 