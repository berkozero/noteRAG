import pytest
from fastapi.testclient import TestClient
import sys
import os
import shutil
import json
from pathlib import Path

# Add project root to path to allow importing app and test fixtures
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

# Define base directory relative to this test file
BASE_TEST_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_TEST_DIR.parent.parent
DATA_DIR = PROJECT_ROOT / "data"
USERS_DATA_DIR = DATA_DIR / "users"
USERS_JSON_FILE = DATA_DIR / "users.json"

# Import the client fixture from test_auth in the same directory
try:
    from .test_auth import client
except ImportError: # Fallback if run differently
    from test_auth import client

@pytest.fixture(autouse=True)
def clean_user_data_before_test():
    """Fixture to automatically clean specific user data before each E2E test."""
    print("\n[Fixture] Cleaning user data before test...")
    users_to_clean = ["berkozer+3@gmail.com", "berkozer+5@gmail.com"]
    emails_cleaned_from_json = []

    # Clean user-specific directories
    for email in users_to_clean:
        safe_email_dir_name = email.replace("@", "_at_")
        user_dir = USERS_DATA_DIR / safe_email_dir_name
        if user_dir.exists() and user_dir.is_dir():
            try:
                shutil.rmtree(user_dir)
                print(f"[Fixture] Removed directory: {user_dir}")
            except OSError as e:
                print(f"[Fixture] Error removing directory {user_dir}: {e}")

    # Clean entries from users.json
    if USERS_JSON_FILE.exists():
        try:
            with open(USERS_JSON_FILE, 'r+') as f:
                try:
                    data = json.load(f)
                except json.JSONDecodeError:
                    data = {} # Handle empty or invalid JSON
                
                original_count = len(data)
                updated_data = {email: user_data for email, user_data in data.items() 
                                if email not in users_to_clean}
                
                if len(updated_data) < original_count:
                    # File needs updating
                    f.seek(0)
                    f.truncate()
                    json.dump(updated_data, f, indent=4)
                    emails_cleaned_from_json = [email for email in users_to_clean if email in data]
                    print(f"[Fixture] Removed users {emails_cleaned_from_json} from {USERS_JSON_FILE}")
                else:
                    print(f"[Fixture] No relevant users found in {USERS_JSON_FILE}")

        except (IOError, json.JSONDecodeError) as e:
            print(f"[Fixture] Error processing {USERS_JSON_FILE}: {e}")
            # If file is corrupted, maybe try deleting it? Careful!
            # os.remove(USERS_JSON_FILE)

    # Re-initialize UserManager in user.py to reflect cleared data (if possible/needed)
    # This is tricky as it involves reloading modules or directly manipulating the instance.
    # A potentially simpler approach is relying on the application context or restarting 
    # the TestClient if state persists unexpectedly across tests within a session.
    # For now, we assume clearing the files is sufficient for TestClient isolation.
    
    print("[Fixture] User data cleanup finished.")
    yield # Test runs here
    print("[Fixture] Post-test cleanup (optional step)." )

# Helper functions to mimic frontend actions

def register_user(client: TestClient, email: str, password: str):
    response = client.post("/api/register", json={"email": email, "password": password})
    assert response.status_code == 200
    return response.json() # Contains token

def login_user(client: TestClient, email: str, password: str):
    params = {"username": email, "password": password}
    response = client.post("/token", data=params)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    return data["access_token"]

def get_auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}

def add_note(client: TestClient, token: str, title: str, text: str):
    headers = get_auth_header(token)
    payload = {"title": title, "text": text}
    response = client.post("/api/notes", headers=headers, json=payload)
    assert response.status_code == 200
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
    assert response.status_code == 200
    return response.json()

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
    assert "answer" in data
    return data # Returns { "answer": "...", "sources": [...] }

# Test Scenario 1: User berkozer+5
def test_user_flow_berkozer_plus_5(client: TestClient):
    email = "berkozer+5@gmail.com"
    password = "testing 1245"

    # 1. Register
    print(f"Registering user {email}...")
    register_response = register_user(client, email, password)
    token = register_response.get("access_token")
    assert token is not None
    print("Registration successful.")

    # 2. Add 3 notes
    print("Adding 3 notes...")
    note1 = add_note(client, token, "Note 5-1", "Content for note 1")
    note2 = add_note(client, token, "Note 5-2", "Content for note 2")
    note3 = add_note(client, token, "Note 5-3", "Content for note 3")
    print(f"Added notes: {note1['id']}, {note2['id']}, {note3['id']}")

    # Verify 3 notes exist
    notes = get_notes(client, token)
    assert len(notes) == 3
    print("Verified 3 notes exist.")

    # 3. Delete 1 note (let's delete note2)
    print(f"Deleting note {note2['id']}...")
    delete_note(client, token, note2["id"])
    print("Deletion successful.")

    # Verify 2 notes remain
    notes = get_notes(client, token)
    assert len(notes) == 2
    remaining_ids = {n["id"] for n in notes}
    assert note1["id"] in remaining_ids
    assert note3["id"] in remaining_ids
    print("Verified 2 notes remain.")

    # 4. Logout (simulated by forgetting the token)
    print("Simulating logout.")
    token = None

    # 5. Log back in
    print("Logging back in...")
    token = login_user(client, email, password)
    print("Login successful.")

    # 6. Verify 2 notes are still there
    print("Verifying notes after login...")
    notes = get_notes(client, token)
    assert len(notes) == 2
    remaining_ids_after_login = {n["id"] for n in notes}
    assert note1["id"] in remaining_ids_after_login
    assert note3["id"] in remaining_ids_after_login
    print(f"Verified 2 notes ({note1['id']}, {note3['id']}) exist after re-login. Scenario 1 complete.")


# Test Scenario 2: User berkozer+3 (with Search and Query)
def test_user_flow_berkozer_plus_3(client: TestClient):
    email = "berkozer+3@gmail.com"
    password = "testing 1245"

    # 1. Register
    print(f"\nRegistering user {email}...")
    register_response = register_user(client, email, password)
    token = register_response.get("access_token")
    assert token is not None
    print("Registration successful.")

    # 2. Add 5 notes (including the specific one)
    print("Adding 5 notes...")
    added_notes = []
    special_note_text = "AI is cool"
    special_note_title = "Special Note Title"
    note_texts = [
        "The weather is nice today",
        special_note_text,
        "LlamaIndex helps build RAG apps",
        "FastAPI is a web framework",
        "Another random thought"
    ]
    for i, text in enumerate(note_texts):
        title = special_note_title if text == special_note_text else f"Note 3-{i+1}"
        note = add_note(client, token, title, text)
        added_notes.append(note)
        print(f"Added note {note['id']} ({title})")

    special_note_id = next((n["id"] for n in added_notes if n["text"] == special_note_text), None)
    assert special_note_id is not None

    # Verify 5 notes exist
    notes = get_notes(client, token)
    assert len(notes) == 5
    print("Verified 5 notes exist.")

    # 3. Search for the note
    search_query = "artificial intelligence"
    print(f"Searching for notes matching '{search_query}'...")
    search_results = search_notes(client, token, search_query, limit=3)
    print(f"Search results: {search_results}")
    # Check if the specific note is in the top results (exact match isn't guaranteed, but likely)
    found_in_search = any(result.get("id") == special_note_id for result in search_results)
    assert found_in_search, f"Note '{special_note_text}' not found in top search results for '{search_query}'"
    print(f"Verified that the note '{special_note_text}' was found in search results.")

    # 4. Ask a question
    question = "what is cool?"
    print(f"Asking question: '{question}'...")
    query_response = query_notes(client, token, question, top_k=3)
    print(f"Query response: {query_response}")
    answer = query_response.get("answer", "").strip().lower()
    # Check if the answer contains the key phrase (LLM output can vary slightly)
    assert "ai is cool" in answer, f"Expected answer containing 'AI is cool', but got '{answer}'"
    # Optionally, check if the special note was used as a source
    source_ids = {source.get("id") for source in query_response.get("sources", [])}
    assert special_note_id in source_ids, f"Special note {special_note_id} not found in query sources"
    print(f"Verified answer contains 'AI is cool' and used the correct source note.")

    # 5. Logout (simulated)
    print("Simulating logout.")
    token = None

    # 6. Log back in
    print("Logging back in...")
    token = login_user(client, email, password)
    print("Login successful.")

    # 7. Verify all 5 notes are still there (redundant check from previous test, but good for sanity)
    print("Verifying note count after login...")
    notes = get_notes(client, token)
    assert len(notes) == 5
    print(f"Verified 5 notes exist after re-login. Scenario 2 complete.") 