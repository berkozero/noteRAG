# tests/backend/conftest.py
import pytest
import os
import sys
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool # Use StaticPool for SQLite test DB if needed
from alembic.config import Config
from alembic import command
from sqlalchemy import text

# --- Path Setup --- 
# Add project root to sys.path to allow importing app, models, etc.
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, PROJECT_ROOT)

# --- Import Application and Test DB Setup ---
from python_server.main import app
from python_server.database import Base, get_db # Need get_db to override
from tests.backend.test_database import test_engine, TestSessionLocal, TEST_DATABASE_URL

# --- Alembic Configuration for Tests ---
# Assuming alembic.ini is in the project root
ALEMBIC_CONFIG_PATH = os.path.join(PROJECT_ROOT, "alembic.ini")
# Create Alembic Config object pointing to the test database URL
alembic_cfg = Config(ALEMBIC_CONFIG_PATH)
# Override the sqlalchemy.url read from alembic.ini
alembic_cfg.set_main_option("sqlalchemy.url", TEST_DATABASE_URL)

print(f"[Alembic Config] Using sqlalchemy.url: {alembic_cfg.get_main_option('sqlalchemy.url')}") # Add logging

# --- Test Database Schema Management Fixture ---
@pytest.fixture(scope="session", autouse=True) # Run once per session automatically
def apply_migrations():
    """Applies Alembic migrations to the test database before tests run."""
    print("\n[Fixture apply_migrations] START")
    print(f"[Fixture apply_migrations] Applying migrations using URL: {alembic_cfg.get_main_option('sqlalchemy.url')}")
    migration_applied = False
    try:
        command.upgrade(alembic_cfg, "head")
        migration_applied = True
        print("[Fixture apply_migrations] Alembic upgrade command executed.")
        # Add a check after upgrade
        try:
            with test_engine.connect() as connection:
                # Simple query to check if the table exists
                connection.execute(text("SELECT 1 FROM notes LIMIT 1;"))
                print("[Fixture apply_migrations] Verified 'notes' table exists after upgrade.")
        except Exception as check_e:
             print(f"[Fixture apply_migrations] FAILED TO VERIFY 'notes' table existence after upgrade: {check_e}")
             # Optionally re-raise if verification failure should stop tests
             # raise check_e 
        
        yield
        print("\n[Fixture apply_migrations] Teardown phase starting.")
        print("\nOptional Teardown: Test database schema remains.")
    except Exception as e:
        print(f"[Fixture apply_migrations] ERROR during migration setup/teardown: {e}")
        if not migration_applied:
             print("[Fixture apply_migrations] Alembic upgrade command likely failed.")
        raise # Re-raise the exception to fail the test session
    finally:
        print("[Fixture apply_migrations] END")

# --- Test Client Fixture with DB Override ---
@pytest.fixture(scope="module")
def client():
    """Pytest fixture to create a TestClient with overridden DB dependency."""
    print("\nSetting up TestClient with DB override...")
    
    def override_get_db():
        """Dependency override function yielding a test DB session."""
        db = None
        try:
            db = TestSessionLocal() # Session using test_engine
            yield db
        finally:
            if db:
                db.close()

    # Apply the override to the FastAPI app instance
    app.dependency_overrides[get_db] = override_get_db
    
    # Yield the TestClient
    with TestClient(app) as c:
        yield c
        
    # Clean up the override after the test module finishes
    print("\nCleaning up DB override...")
    app.dependency_overrides.clear()

# --- Test Database Session Fixture (for direct DB access in tests) ---
@pytest.fixture(scope="function") # New session for each test function
def db_session():
    """Pytest fixture providing direct access to a test DB session."""
    session = TestSessionLocal()
    try:
        yield session
    finally:
        session.close()

# --- Auto-Cleanup Fixture (Refactored) ---
@pytest.fixture(autouse=True) # Runs before each test function
def clean_tables_before_test(db_session): # Depends on the test DB session
    """Fixture to automatically clean specific tables before each test."""
    # Use the passed db_session fixture which connects to the test DB
    print("\n[Fixture] Cleaning tables before test...")
    try:
        # Clear data from tables modified by tests
        # Order matters if using foreign keys
        # Use execute with text for broader compatibility
        db_session.execute(text("TRUNCATE TABLE notes RESTART IDENTITY CASCADE;")) 
        # db_session.execute(text("TRUNCATE TABLE users RESTART IDENTITY CASCADE;")) # Example if users table exists
        db_session.commit()
        print("[Fixture] Tables truncated successfully.")
    except Exception as e:
        db_session.rollback()
        print(f"[Fixture] Error truncating tables: {e}")
        raise # Fail the test if cleanup fails

    yield # Test runs here
    # No specific post-test action needed here as next test will clean again
    print("[Fixture] Post-test action (tables will be cleaned before next test)." ) 