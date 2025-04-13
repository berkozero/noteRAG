from fastapi.testclient import TestClient

# --- Helper functions to mimic frontend actions ---

def register_user(client: TestClient, email: str, password: str):
    response = client.post("/api/register", json={"email": email, "password": password})
    assert response.status_code == 200
    return response.json() # Contains token

def login_user(client: TestClient, email: str, password: str):
    params = {"username": email, "password": password}
    response = client.post("/token", data=params)
    # Expect 401 for bad login, 200 for good
    # Assertions specific to test case should happen in the test function
    # assert response.status_code == 200 
    # data = response.json()
    # assert "access_token" in data
    return response # Return full response for detailed checks
    # return data["access_token"]

def get_auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}

def add_note(client: TestClient, token: str, title: str, text: str):
    headers = get_auth_header(token)
    payload = {"title": title, "text": text}
    response = client.post("/api/notes", headers=headers, json=payload)
    # --- Debugging --- 
    print(f"\nDEBUG [add_note helper] Status Code: {response.status_code}")
    try:
        print(f"DEBUG [add_note helper] Response JSON: {response.json()}\n")
    except Exception:
        print(f"DEBUG [add_note helper] Response Text: {response.text}\n")
    # --- End Debugging ---
    assert response.status_code == 200 # Keep assertion for now, will fail
    data = response.json()
    assert "id" in data
    return data # Return the created note including its ID

def get_notes(client: TestClient, token: str):
    headers = get_auth_header(token)
    response = client.get("/api/notes", headers=headers)
    assert response.status_code == 200
    return response.json() # Returns list of notes

def delete_note(client: TestClient, token: str, note_id: str):
    headers = get_auth_header(token)
    response = client.delete(f"/api/notes/{note_id}", headers=headers)
    # Assert specific status code (204 or 404) in the calling test
    # assert response.status_code == 204 
    return response # Return full response

def search_notes(client: TestClient, token: str, query: str, limit: int = 5):
    headers = get_auth_header(token)
    response = client.get(f"/api/search?q={query}&limit={limit}", headers=headers)
    assert response.status_code == 200
    return response.json() # Returns list of matching notes

def query_notes(client: TestClient, token: str, question: str, top_k: int = 3):
    headers = get_auth_header(token)
    response = client.get(f"/api/query?q={question}&top_k={top_k}", headers=headers)
    assert response.status_code == 200
    data = response.json()
    # assert "response" in data # Check for 'response' key, not 'answer'
    return data # Returns { "response": "...", "source_nodes": [...] } 