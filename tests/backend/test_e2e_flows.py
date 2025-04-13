import pytest
from fastapi.testclient import TestClient
import sys
import os
# Removed shutil, json, pathlib as cleanup fixture is moved/refactored
# import shutil
# import json
# from pathlib import Path

# Add project root to path to allow importing app and test fixtures
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

# Define base directory relative to this test file
# BASE_TEST_DIR = Path(__file__).resolve().parent
# PROJECT_ROOT = BASE_TEST_DIR.parent.parent
# DATA_DIR = PROJECT_ROOT / "data"
# USERS_DATA_DIR = DATA_DIR / "users"
# USERS_JSON_FILE = DATA_DIR / "users.json"

# Client fixture is now loaded from conftest.py
# try:
#     from .test_auth import client
# except ImportError: # Fallback if run differently
#     from test_auth import client

# Cleanup fixture is now in conftest.py and refactored
# @pytest.fixture(autouse=True)
# def clean_user_data_before_test():
#    ...

# Import helper functions from the new helpers module
from .helpers import (
    register_user, 
    login_user, 
    get_auth_header,
    add_note, 
    get_notes, 
    delete_note,
    search_notes,
    query_notes
)


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
    # Update assertion for delete status code
    delete_response = delete_note(client, token, note2["id"])
    assert delete_response.status_code == 204 # Expect 204 No Content
    print("Deletion request successful (204)." )

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
    login_response = login_user(client, email, password)
    assert login_response.status_code == 200
    token = login_response.json().get("access_token")
    assert token is not None
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
    answer = query_response.get("response", "").strip().lower() # Use 'response' key
    # Check if the answer contains the key phrase (LLM output can vary slightly)
    assert "ai is cool" in answer, f"Expected answer containing 'AI is cool', but got '{answer}'"
    # Optionally, check if the special note was used as a source
    source_ids = {source.get("id") for source in query_response.get("source_nodes", [])}
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