import pytest
from fastapi.testclient import TestClient
import os
import sys
from dotenv import load_dotenv

# Add project root to the Python path to allow imports from python_server
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, project_root)

# Load environment variables from the main .env file
load_dotenv(dotenv_path=os.path.join(project_root, '.env'))

# Load potentially specific test environment variables
load_dotenv(dotenv_path=os.path.join(project_root, '.env.test'), override=True)

# Now import the FastAPI app
# Ensure python_server is importable after adjusting sys.path
try:
    from python_server.main import app
except ImportError as e:
    print(f"Error importing FastAPI app: {e}")
    print(f"Ensure python_server is in sys.path: {sys.path}")
    # It might be necessary to run pytest from the project root directory
    raise

@pytest.fixture(scope="module")
def client():
    """Provides a FastAPI TestClient for making requests to the app."""
    # Ensure required environment variables for testing are set
    # Example: Override database URL for tests if needed
    # os.environ['DATABASE_URL'] = os.getenv('TEST_DATABASE_URL', os.getenv('DATABASE_URL'))
    # print(f"[conftest] Using DATABASE_URL: {os.environ['DATABASE_URL']}")
    
    with TestClient(app) as c:
        yield c 