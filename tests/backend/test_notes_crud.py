# tests/backend/test_notes_crud.py
import pytest
from fastapi.testclient import TestClient
import uuid

# Import the client fixture from conftest.py (it will be automatically discovered)
# from .conftest import client 

# Import helper functions from the new helpers module
from .helpers import (
    register_user, 
    login_user, 
    get_auth_header,
    add_note, 
    get_notes, 
    delete_note,
    search_notes, # Keep for potential future tests
    query_notes   # Keep for potential future tests
)

# --- Fixtures --- 

@pytest.fixture(scope="function") # Function scope for potentially unique emails per test
def create_user(client: TestClient):
    """Factory fixture to create a new user and return their details + token."""
    user_cache = {}
    def _create_user(user_index: int = 0):
        # Create unique email based on index/call count if desired, or use UUID
        email = f"test.iso.{uuid.uuid4()}@{user_index}.example.com"
        password = "isotestpassword"
        
        if email in user_cache:
            return user_cache[email]
            
        print(f"\n[Fixture] Creating user {email} for isolation test..." )
        response = register_user(client, email, password)
        token = response.get("access_token")
        assert token is not None
        user_data = {"email": email, "password": password, "token": token}
        user_cache[email] = user_data # Cache if needed within same test func call
        return user_data
        
    return _create_user # Return the inner function

@pytest.fixture(scope="module")
def test_user_data():
    """Provides data for a test user, ensuring unique email per module run."""
    base_email = f"test.note.crud.{uuid.uuid4()}@example.com"
    return {
        "email": base_email,
        "password": "crudpassword"
    }

@pytest.fixture(scope="module")
def registered_test_user(client: TestClient, test_user_data: dict):
    """Registers a user for the module and returns email, password, token."""
    email = test_user_data["email"]
    password = test_user_data["password"]
    print(f"\nRegistering user {email} for notes CRUD tests...")
    response = register_user(client, email, password)
    token = response.get("access_token")
    assert token is not None
    print(f"Registration successful for {email}.")
    return {"email": email, "password": password, "token": token}

# --- Test Cases --- 

def test_list_notes_empty(client: TestClient, registered_test_user: dict):
    """Verify that listing notes for a new user returns an empty list."""
    token = registered_test_user["token"]
    
    print(f"\nTesting GET /api/notes for empty list (User: {registered_test_user['email']})...")
    notes = get_notes(client, token)
    
    assert isinstance(notes, list)
    assert len(notes) == 0
    print("Verified empty list returned successfully.")

def test_add_note_success(client: TestClient, registered_test_user: dict, db_session): # Add db_session fixture
    """Verify that adding a note is successful and data is correct."""
    token = registered_test_user["token"]
    user_email = registered_test_user["email"]
    note_title = "My First Test Note"
    note_text = "This is the content of the first test note."
    
    print(f"\nTesting POST /api/notes (User: {user_email})...")
    created_note_response = add_note(client, token, note_title, note_text)
    
    # Verify API response
    assert "id" in created_note_response
    assert created_note_response.get("title") == note_title
    # The Pydantic model used in the endpoint returns 'text', our DB model uses 'content'
    # Let's adjust the assertion based on the API response model `Note`
    assert created_note_response.get("text") == note_text 
    assert "created_at" in created_note_response # Should be added by DB/model
    note_id = created_note_response["id"]
    print(f"Note added via API, received ID: {note_id}")
    
    # Verify note exists in the TEST database
    from python_server.models import Note # Import model for DB check
    db_note = db_session.query(Note).filter(Note.id == note_id).first()
    
    assert db_note is not None
    assert db_note.id == note_id
    assert db_note.user_id == user_email
    assert db_note.title == note_title
    assert db_note.text == note_text # Updated assertion to use db_note.text
    assert db_note.created_at is not None
    assert db_note.updated_at is not None
    print(f"Verified note {note_id} exists in test database with correct data.")

def test_list_multiple_notes(client: TestClient, registered_test_user: dict):
    """Verify listing notes returns multiple added notes correctly."""
    token = registered_test_user["token"]
    user_email = registered_test_user["email"]
    
    print(f"\nTesting GET /api/notes with multiple notes (User: {user_email})...")
    
    # Add a couple of notes first
    note1_data = add_note(client, token, "Note Title 1", "Content 1")
    note2_data = add_note(client, token, "Note Title 2", "Content 2")
    print(f"Added notes {note1_data['id']} and {note2_data['id']}")
    
    # Get the list of notes
    notes = get_notes(client, token)
    
    assert isinstance(notes, list)
    assert len(notes) >= 2 # Use >= in case previous tests left data (though cleanup should prevent)
    
    # Check if the added notes are in the list (order might vary)
    notes_dict = {note["id"]: note for note in notes}
    assert note1_data["id"] in notes_dict
    assert note2_data["id"] in notes_dict
    
    # Verify content of one note from the list
    retrieved_note1 = notes_dict[note1_data["id"]]
    assert retrieved_note1["title"] == "Note Title 1"
    assert retrieved_note1["text"] == "Content 1"
    print("Verified multiple notes listed successfully.")

def test_delete_note_success(client: TestClient, registered_test_user: dict, db_session):
    """Verify deleting an existing note works and removes it from DB and list."""
    token = registered_test_user["token"]
    user_email = registered_test_user["email"]
    
    print(f"\nTesting DELETE /api/notes (User: {user_email})...")
    
    # Add a note to delete
    note_to_delete = add_note(client, token, "Delete Me", "This note will be deleted.")
    note_id = note_to_delete["id"]
    print(f"Added note {note_id} to be deleted.")
    
    # Verify it exists initially using the API
    notes_before = get_notes(client, token)
    assert any(n["id"] == note_id for n in notes_before)
    print(f"Verified note {note_id} exists before deletion via API.")

    # Delete the note
    delete_response = delete_note(client, token, note_id)
    assert delete_response.status_code == 204 # Expect 204 No Content
    print(f"DELETE request for note {note_id} returned 204.")

    # Verify it's gone using the API
    notes_after = get_notes(client, token)
    assert not any(n["id"] == note_id for n in notes_after)
    print(f"Verified note {note_id} is gone after deletion via API.")

    # Verify it's gone from the database
    from python_server.models import Note 
    db_note = db_session.query(Note).filter(Note.id == note_id).first()
    assert db_note is None
    print(f"Verified note {note_id} is gone from test database.")

def test_delete_note_not_found(client: TestClient, registered_test_user: dict):
    """Verify attempting to delete a non-existent note ID returns 404."""
    token = registered_test_user["token"]
    non_existent_id = f"note_not_real_{uuid.uuid4()}"
    
    print(f"\nTesting DELETE /api/notes with non-existent ID: {non_existent_id}...")
    delete_response = delete_note(client, token, non_existent_id)
    assert delete_response.status_code == 404
    print("Verified 404 returned for non-existent note ID.")

def test_user_isolation_list(client: TestClient, create_user):
    """Verify User A cannot list User B's notes."""
    # Create two separate users
    user_a = create_user(1)
    user_b = create_user(2)
    
    print(f"\nTesting List Isolation: User A ({user_a['email']}), User B ({user_b['email']})" )
    
    # User A adds a note
    note_a = add_note(client, user_a["token"], "Note A Title", "Content A")
    print(f"User A added note {note_a['id']}")
    
    # User B adds a note
    note_b = add_note(client, user_b["token"], "Note B Title", "Content B")
    print(f"User B added note {note_b['id']}")
    
    # List notes for User A
    print("Listing notes for User A...")
    notes_a = get_notes(client, user_a["token"])
    assert isinstance(notes_a, list)
    assert len(notes_a) >= 1
    assert any(n["id"] == note_a["id"] for n in notes_a)
    assert not any(n["id"] == note_b["id"] for n in notes_a)
    print("Verified User A sees only their notes.")

    # List notes for User B
    print("Listing notes for User B...")
    notes_b = get_notes(client, user_b["token"])
    assert isinstance(notes_b, list)
    assert len(notes_b) >= 1
    assert not any(n["id"] == note_a["id"] for n in notes_b)
    assert any(n["id"] == note_b["id"] for n in notes_b)
    print("Verified User B sees only their notes.")

def test_user_isolation_delete(client: TestClient, create_user, db_session):
    """Verify User B cannot delete User A's note."""
    # Create two separate users
    user_a = create_user(1)
    user_b = create_user(2)

    print(f"\nTesting Delete Isolation: User A ({user_a['email']}), User B ({user_b['email']})" )

    # User A adds a note
    note_a = add_note(client, user_a["token"], "Note A Title", "Content A - Delete Test")
    note_a_id = note_a["id"]
    print(f"User A added note {note_a_id}")

    # User B attempts to delete User A's note
    print(f"User B attempting to delete User A's note {note_a_id}...")
    delete_response = delete_note(client, user_b["token"], note_a_id)
    # Expect 404 because the endpoint checks ownership before deleting
    assert delete_response.status_code == 404 
    print(f"Verified User B received 404 when trying to delete User A's note.")

    # Verify User A's note still exists in the database
    from python_server.models import Note
    db_note = db_session.query(Note).filter(Note.id == note_a_id).first()
    assert db_note is not None
    assert db_note.user_id == user_a["email"]
    print(f"Verified User A's note {note_a_id} still exists in the database.")

    # Verify User A can still list their note
    notes_a = get_notes(client, user_a["token"])
    assert any(n["id"] == note_a_id for n in notes_a)
    print(f"Verified User A can still list their note {note_a_id}." )

# Add more tests here: delete non-existent, isolation tests... 