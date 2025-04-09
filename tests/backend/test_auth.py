import pytest
import sys
import os
from fastapi.testclient import TestClient

# Adjust path to import from python_server directory
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from python_server.main import app # Import app from its location

@pytest.fixture(scope="module")
def client():
    """Pytest fixture to create a TestClient for the FastAPI app."""
    # Ensure paths within the app are relative to python_server, not tests
    # (This was handled by edits to main.py previously)
    with TestClient(app) as c:
        yield c

def test_initial():
    """Placeholder test to ensure the setup works."""
    assert True

def test_register_user_success(client):
    """Test successful user registration with email and password."""
    email = "test.register.success@example.com"
    password = "testpassword123"
    response = client.post("/api/register", json={"email": email, "password": password})
    assert response.status_code == 200
    data = response.json()
    assert data["user_email"] == email
    assert "access_token" in data
    assert data["token_type"] == "bearer"

def test_register_existing_user(client):
    """Test attempting to register an existing user (should succeed and return token)."""
    email = "test.register.existing@example.com"
    password = "testpassword456"
    # First registration
    client.post("/api/register", json={"email": email, "password": password})
    # Second attempt
    response = client.post("/api/register", json={"email": email, "password": password})
    assert response.status_code == 200 # Expecting success as current logic returns existing user
    data = response.json()
    assert data["user_email"] == email
    assert "access_token" in data

def test_login_success(client):
    """Test successful login with correct email and password."""
    email = "test.login.success@example.com"
    password = "testpassword789"
    # Register user first
    client.post("/api/register", json={"email": email, "password": password})
    
    # Login attempt
    response = client.post("/token", data={"username": email, "password": password})
    assert response.status_code == 200
    data = response.json()
    assert data["user_email"] == email
    assert "access_token" in data
    assert data["token_type"] == "bearer"

def test_login_incorrect_password(client):
    """Test login attempt with incorrect password."""
    email = "test.login.fail.pw@example.com"
    password = "correctpassword"
    # Register user
    client.post("/api/register", json={"email": email, "password": password})
    
    # Login attempt with wrong password
    response = client.post("/token", data={"username": email, "password": "wrongpassword"})
    assert response.status_code == 401
    data = response.json()
    assert data["detail"] == "Incorrect email or password"

def test_login_nonexistent_user(client):
    """Test login attempt with an email that hasn't been registered."""
    email = "nonexistent.user@example.com"
    password = "anypassword"
    
    response = client.post("/token", data={"username": email, "password": password})
    assert response.status_code == 401
    data = response.json()
    assert data["detail"] == "Incorrect email or password"
