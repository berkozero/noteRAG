# tests/backend/test_database.py
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Load .env file, potentially prioritizing a .env.test if it exists
dotenv_path = os.path.join(os.path.dirname(__file__), '../../.env')
dotenv_test_path = os.path.join(os.path.dirname(__file__), '../../.env.test')

if os.path.exists(dotenv_test_path):
    print("Loading test environment variables from .env.test")
    load_dotenv(dotenv_path=dotenv_test_path, override=True)
elif os.path.exists(dotenv_path):
     print("Loading base environment variables from .env for test setup")
     load_dotenv(dotenv_path=dotenv_path)

# Use a specific environment variable for the test database URL
# Fallback to the main DB URL ONLY if TEST_DATABASE_URL is not set (use with caution)
TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", os.getenv("DATABASE_URL"))

if not TEST_DATABASE_URL:
    raise ValueError("TEST_DATABASE_URL environment variable is not set. "
                     "Please configure it (e.g., in .env.test) pointing to a test database.")

# Ensure the test URL is different from the main DB URL if both are set
MAIN_DATABASE_URL = os.getenv("DATABASE_URL")
if MAIN_DATABASE_URL and TEST_DATABASE_URL == MAIN_DATABASE_URL:
    print("WARNING: TEST_DATABASE_URL is the same as DATABASE_URL. Tests will run on the main database!")
    # You might want to raise an error here instead:
    # raise ValueError("TEST_DATABASE_URL must be different from DATABASE_URL for isolated testing.")

# Create the SQLAlchemy engine for the test database
test_engine = create_engine(TEST_DATABASE_URL)

# Create a session factory for the test database
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

print(f"Test database engine created for URL: {TEST_DATABASE_URL}") 