# Tests for authentication endpoints and logic

import pytest
from fastapi.testclient import TestClient
import uuid # For generating unique emails

# --- Test Data --- 

# Use a known pwned password for testing the HIBP check
PWNED_PASSWORD = "password"
# Use a password that meets the length requirement but isn't pwned
VALID_PASSWORD = "a_very_long_and_secure_password_123"
# Use a password shorter than the requirement
SHORT_PASSWORD = "short"

# --- Helper Function/Fixture (Optional but recommended for reuse) ---

def register_and_login(client: TestClient, email: str, password: str) -> str:
    """Helper to register and login a user, returning the auth token."""
    # Register
    response_reg = client.post("/api/register", json={"email": email, "password": password})
    assert response_reg.status_code == 200, f"Registration failed: {response_reg.text}"
    
    # Login
    response_login = client.post("/token", data={"username": email, "password": password})
    assert response_login.status_code == 200, f"Login failed: {response_login.text}"
    token = response_login.json().get("access_token")
    assert token is not None
    return token

# --- Registration Tests --- 

def test_register_success(client: TestClient):
    """Test successful user registration with a valid password."""
    email = f"test_success_{uuid.uuid4()}@example.com"
    response = client.post("/api/register", json={"email": email, "password": VALID_PASSWORD})
    assert response.status_code == 200
    data = response.json()
    assert data["token_type"] == "bearer"
    assert "access_token" in data
    assert data["user_email"] == email

def test_register_duplicate_email(client: TestClient):
    """Test registering the same email twice (should succeed and return token)."""
    email = f"test_duplicate_{uuid.uuid4()}@example.com"
    # First registration
    response1 = client.post("/api/register", json={"email": email, "password": VALID_PASSWORD})
    assert response1.status_code == 200
    token1 = response1.json().get("access_token")
    
    # Second registration attempt
    response2 = client.post("/api/register", json={"email": email, "password": VALID_PASSWORD})
    assert response2.status_code == 200 # Current logic returns existing user
    token2 = response2.json().get("access_token")
    assert token2 is not None
    # assert token1 == token2 # Tokens might be different if generated newly each time

def test_register_short_password(client: TestClient):
    """Test registration attempt with a password shorter than 12 characters."""
    email = f"test_short_pw_{uuid.uuid4()}@example.com"
    response = client.post("/api/register", json={"email": email, "password": SHORT_PASSWORD})
    # Pydantic validation should return 422
    assert response.status_code == 422 
    assert "detail" in response.json()
    # Check if detail mentions password length (may vary based on FastAPI/Pydantic version)
    # Example check: assert "at least 12 characters" in str(response.json()["detail"]).lower()
    print(f"Short password response: {response.json()}") # Log for debugging

def test_register_pwned_password(client: TestClient):
    """Test registration attempt with a known pwned password."""
    email = f"test_pwned_pw_{uuid.uuid4()}@example.com"
    response = client.post("/api/register", json={"email": email, "password": PWNED_PASSWORD})
    # Our custom check should return 400
    assert response.status_code == 400
    data = response.json()
    assert "detail" in data
    assert "password has been found in data breaches" in data["detail"].lower()

# --- Login Tests --- 

def test_login_success(client: TestClient):
    """Test successful login after registration."""
    email = f"test_login_success_{uuid.uuid4()}@example.com"
    # Register user first
    reg_response = client.post("/api/register", json={"email": email, "password": VALID_PASSWORD})
    assert reg_response.status_code == 200
    
    # Attempt login
    login_response = client.post("/token", data={"username": email, "password": VALID_PASSWORD})
    assert login_response.status_code == 200
    data = login_response.json()
    assert data["token_type"] == "bearer"
    assert "access_token" in data
    assert data["user_email"] == email

def test_login_incorrect_password(client: TestClient):
    """Test login attempt with incorrect password."""
    email = f"test_login_fail_{uuid.uuid4()}@example.com"
    client.post("/api/register", json={"email": email, "password": VALID_PASSWORD})
    
    login_response = client.post("/token", data={"username": email, "password": "wrong_password"})
    assert login_response.status_code == 401 # Unauthorized
    assert "incorrect email or password" in login_response.json()["detail"].lower()

def test_login_user_not_found(client: TestClient):
    """Test login attempt for a non-existent user."""
    email = f"non_existent_{uuid.uuid4()}@example.com"
    login_response = client.post("/token", data={"username": email, "password": VALID_PASSWORD})
    assert login_response.status_code == 401
    assert "incorrect email or password" in login_response.json()["detail"].lower()

# --- Password Change Tests --- 

def test_change_password_success(client: TestClient):
    """Test successfully changing a password."""
    email = f"test_pw_change_ok_{uuid.uuid4()}@example.com"
    initial_password = VALID_PASSWORD
    new_password = f"new_{VALID_PASSWORD}_extra"
    
    # Register and login to get token
    token = register_and_login(client, email, initial_password)
    headers = {"Authorization": f"Bearer {token}"}
    
    # Change password
    change_response = client.put(
        "/api/users/me/password", 
        headers=headers, 
        json={"current_password": initial_password, "new_password": new_password}
    )
    assert change_response.status_code == 200
    assert "password updated successfully" in change_response.json()["message"].lower()
    
    # Verify login with NEW password
    login_response_new = client.post("/token", data={"username": email, "password": new_password})
    assert login_response_new.status_code == 200
    assert "access_token" in login_response_new.json()
    
    # Verify login with OLD password fails
    login_response_old = client.post("/token", data={"username": email, "password": initial_password})
    assert login_response_old.status_code == 401

def test_change_password_wrong_current(client: TestClient):
    """Test password change attempt with incorrect current password."""
    email = f"test_pw_change_wrong_{uuid.uuid4()}@example.com"
    token = register_and_login(client, email, VALID_PASSWORD)
    headers = {"Authorization": f"Bearer {token}"}
    
    change_response = client.put(
        "/api/users/me/password", 
        headers=headers, 
        json={"current_password": "incorrect_current_pw", "new_password": "new_valid_password_123"}
    )
    assert change_response.status_code == 400 # Bad Request
    assert "incorrect current password" in change_response.json()["detail"].lower()

def test_change_password_new_too_short(client: TestClient):
    """Test password change attempt with a new password that is too short."""
    email = f"test_pw_change_short_{uuid.uuid4()}@example.com"
    token = register_and_login(client, email, VALID_PASSWORD)
    headers = {"Authorization": f"Bearer {token}"}
    
    change_response = client.put(
        "/api/users/me/password", 
        headers=headers, 
        json={"current_password": VALID_PASSWORD, "new_password": SHORT_PASSWORD}
    )
    assert change_response.status_code == 422 # Unprocessable Entity (Pydantic validation)
    print(f"Short new password response: {change_response.json()}") # Log for debugging

def test_change_password_new_pwned(client: TestClient):
    """Test password change attempt with a new password that is pwned."""
    email = f"test_pw_change_pwned_{uuid.uuid4()}@example.com"
    token = register_and_login(client, email, VALID_PASSWORD)
    headers = {"Authorization": f"Bearer {token}"}
    
    change_response = client.put(
        "/api/users/me/password", 
        headers=headers, 
        json={"current_password": VALID_PASSWORD, "new_password": PWNED_PASSWORD}
    )
    assert change_response.status_code == 400 # Bad Request (HIBP check)
    assert "new password has been found in data breaches" in change_response.json()["detail"].lower()

def test_change_password_unauthenticated(client: TestClient):
    """Test password change attempt without authentication."""
    change_response = client.put(
        "/api/users/me/password", 
        # No Authorization header
        json={"current_password": "any", "new_password": VALID_PASSWORD}
    )
    assert change_response.status_code == 401 # Unauthorized

# TODO: Add tests for token verification (valid, invalid, expired)

# Remove the original placeholder
# def test_placeholder_auth():
#     assert True 