"""
NoteRAG API Server

This is the main entry point for the noteRAG API server.
It provides all API endpoints for managing notes, handling search, and serving the admin panel.
The server uses FastAPI with LlamaIndex for vector storage and retrieval.
"""
from fastapi import FastAPI, HTTPException, Request, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional, List, Dict, Annotated
from datetime import datetime
from pathlib import Path
from llama_index.core import (
    VectorStoreIndex,
    Document,
    Settings,
    StorageContext,
    load_index_from_storage
)
from llama_index.core.storage.docstore import SimpleDocumentStore
from llama_index.core.storage.index_store import SimpleIndexStore
from llama_index.core.vector_stores import SimpleVectorStore
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.llms.openai import OpenAI
import os
from dotenv import load_dotenv
import logging
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from .rag_core import NoteRAG
from .auth import user_manager, User, UserCreate, Token
from contextlib import asynccontextmanager
import time
import psutil
from sqlalchemy.orm import Session
from sqlalchemy import func
from . import models
from .database import get_db
from collections import defaultdict

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configure LlamaIndex
Settings.llm = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
Settings.embed_model = OpenAIEmbedding(api_key=os.getenv("OPENAI_API_KEY"))

# OAuth2 Bearer token scheme for authentication
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

class Note(BaseModel):
    """
    Pydantic model for validating and parsing note data from requests.
    
    Fields:
        text: The main content of the note
        title: Optional title for the note
        url: Optional source URL for the note
        timestamp: Optional creation timestamp (milliseconds since epoch)
        isHtml: Optional flag indicating if the text contains HTML
        id: Optional unique identifier for the note (generated server-side if not provided)
        created_at: Optional creation timestamp (milliseconds since epoch)
        updated_at: Optional update timestamp (milliseconds since epoch)
    """
    text: str
    title: Optional[str] = None
    url: Optional[str] = None
    timestamp: Optional[int] = None
    isHtml: Optional[bool] = False
    id: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    # Configure Pydantic to allow creating model from object attributes
    model_config = ConfigDict(from_attributes=True)

# User-specific NoteRAG instances
note_rag_instances = {}

def get_note_rag(user_email: Optional[str] = None) -> NoteRAG:
    """
    Get or create a NoteRAG instance for the given user.
    
    Args:
        user_email: The email of the user, or None for anonymous access
        
    Returns:
        A NoteRAG instance for the user
    """
    # For anonymous access or if user management is disabled, use default instance
    if user_email is None:
        if None not in note_rag_instances:
            logger.info("Creating default NoteRAG instance")
            note_rag_instances[None] = NoteRAG()
        return note_rag_instances[None]
    
    # For authenticated users, get or create a user-specific instance
    if user_email not in note_rag_instances:
        logger.info(f"Creating NoteRAG instance for user: {user_email}")
        note_rag_instances[user_email] = NoteRAG(user_email=user_email)
    
    return note_rag_instances[user_email]

async def get_current_user(token: Annotated[str, Depends(oauth2_scheme)]) -> str:
    """
    Get the current user from the JWT token.
    
    Args:
        token: The JWT token from the Authorization header
        
    Returns:
        The email of the authenticated user
        
    Raises:
        HTTPException: If token is invalid or user not found
    """
    user_email = user_manager.verify_token(token)
    if user_email is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user_email

# Optional user authentication - allows endpoints to work with or without auth
async def get_optional_user(authorization: Optional[str] = Header(None)) -> Optional[str]:
    """
    Get the current user from the Authorization header, if available.
    
    Args:
        authorization: The Authorization header value
        
    Returns:
        The email of the authenticated user, or None if not authenticated
    """
    if authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "")
        return user_manager.verify_token(token)
    return None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for FastAPI app.
    
    This function:
    - Runs when the FastAPI server starts
    - Initializes the default NoteRAG index
    - Logs errors if initialization fails
    - Cleans up resources when the server shuts down
    
    Args:
        app: FastAPI application instance
    """
    # Startup: Initialize the default index
    logger.info("Starting the application...")
    try:
        # Initialize default NoteRAG instance
        get_note_rag()
        logger.info("Default NoteRAG instance initialized")
    except Exception as e:
        logger.error(f"Failed to initialize index: {str(e)}")
    
    yield  # Server is running
    
    # Shutdown: Clean up resources
    logger.info("Shutting down the application...")

# Initialize FastAPI app with metadata
app = FastAPI(
    title="noteRAG API",
    description="API for managing and searching notes using LlamaIndex",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://localhost:3443",  # Backend itself (if needed for admin panel, etc)
        "https://localhost:3000",  # Older client dev server port?
        "http://127.0.0.1:3000",  # Alternative localhost for client
        "https://127.0.0.1:3000", # Alternative localhost for client (HTTPS)
        "http://localhost:3000",   # Add the current frontend dev origin (HTTP)
        "chrome-extension://acpbbjceallindmgffmapnmcboiokncj" # Specific origin for your extension
    ],
    allow_credentials=True,
    allow_methods=["*"], # Allow all methods (GET, POST, OPTIONS, etc.)
    allow_headers=["*"], # Allow all headers
)

# Define base directory for path calculations
BASE_DIR = Path(__file__).resolve().parent

# Mount static files
static_dir = BASE_DIR / "static"
static_dir.mkdir(exist_ok=True) # Ensure the directory exists
app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Create templates directory relative to base directory
templates_dir = BASE_DIR / "templates"
templates_dir.mkdir(exist_ok=True)

# Initialize templates
templates = Jinja2Templates(directory=templates_dir)

@app.middleware("http")
async def log_requests(request, call_next):
    """
    Middleware to log all HTTP requests and responses.
    
    This function:
    - Logs details of incoming requests (method, URL, body)
    - Forwards the request to the appropriate handler
    - Logs the response status code
    
    Args:
        request: The incoming FastAPI request
        call_next: Function to call the next handler in the middleware chain
        
    Returns:
        The response from the handler
    """
    # Log the request details
    logger.info(f"\n--- Incoming Request ---")
    logger.info(f"Method: {request.method}")
    logger.info(f"URL: {request.url}")
    
    # Try to log the request body for POST/PUT requests
    if request.method in ["POST", "PUT"]:
        try:
            body = await request.body()
            if body:
                logger.info(f"Request Body: {body.decode()}")
        except Exception as e:
            logger.error(f"Could not log request body: {e}")
    
    response = await call_next(request)
    
    # Log the response status
    logger.info(f"Response Status: {response.status_code}")
    logger.info("--- End Request ---\n")
    
    return response

# Authentication endpoints
@app.post("/api/register", response_model=Token)
async def register_user(user_data: UserCreate):
    """
    Register a new user or get an existing user.
    
    Args:
        user_data: User registration data
        
    Returns:
        JWT token for the user
    """
    # Create user or get existing
    user = user_manager.create_user(user_data.email, user_data.password)
    
    # Generate token
    token = user_manager.create_access_token(user_data.email)
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user_email": user_data.email
    }

@app.post("/token", response_model=Token)
async def login_for_access_token(form_data: Annotated[OAuth2PasswordRequestForm, Depends()]):
    """
    Login endpoint to get a JWT token.
    
    Args:
        form_data: Form data with username (email) and password
        
    Returns:
        JWT token for the user
        
    Raises:
        HTTPException: If authentication fails
    """
    # Authenticate user (username field contains email)
    user = user_manager.authenticate_user(form_data.username, form_data.password)
    if user is None:
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Generate token
    token = user_manager.create_access_token(user.email)
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user_email": user.email
    }

@app.get("/api/user/me")
async def get_user_info(current_user: Annotated[str, Depends(get_current_user)]):
    """
    Get information about the current authenticated user.
    
    Args:
        current_user: Email of the current user (from token)
        
    Returns:
        User information
    """
    return {"email": current_user}

@app.get("/", include_in_schema=False)
async def root():
    # Redirect to admin or a specific frontend route if desired
    # For now, just a simple message or redirect to docs
    # return RedirectResponse(url="/docs")
    return {"message": "NoteRAG API Running"}

@app.get("/admin", response_class=HTMLResponse, include_in_schema=False)
async def admin(
    request: Request,
    db: Annotated[Session, Depends(get_db)]
):
    """
    Admin panel to view all notes (requires DB access).
    """
    try:
        # Fetch all notes directly from PostgreSQL
        # WARNING: Fetching ALL notes might be slow for large datasets. Consider pagination.
        notes = db.query(models.Note).order_by(models.Note.created_at.desc()).all()
        logger.info(f"Admin panel fetched {len(notes)} notes from DB.")
    except Exception as e:
        logger.error(f"Database error fetching notes for admin panel: {e}", exc_info=True)
        # Render error page or return error response
        notes = [] # Render empty list on error for now
        # Consider returning an error response instead of empty page
        # return templates.TemplateResponse("error.html", {"request": request, "error": str(e)})
    
    return templates.TemplateResponse("admin.html", {"request": request, "notes": notes})

@app.get("/api/notes", response_model=List[Note])
async def get_notes(
    db: Annotated[Session, Depends(get_db)],
    user_email: Optional[str] = Depends(get_optional_user)
) -> List[Note]:
    """Fetches notes for the authenticated user directly from PostgreSQL."""
    logger.info(f"Fetching notes for user: {user_email}")
    
    if not user_email:
        # Handle case where authentication is optional but notes require a user
        # Or adjust logic if anonymous notes are allowed (currently seems not)
        logger.warning("Attempted to fetch notes without authentication.")
        # Returning empty list for now, consider 401/403 if auth is strictly required
        return [] 
        # raise HTTPException(status_code=401, detail="Authentication required to view notes")

    # Query PostgreSQL using SQLAlchemy
    try:
        notes_from_db = db.query(models.Note)\
                          .filter(models.Note.user_id == user_email)\
                          .order_by(models.Note.created_at.desc())\
                          .all()
        logger.info(f"Found {len(notes_from_db)} notes in DB for user {user_email}")

        # Convert SQLAlchemy models to Pydantic models for the response
        # This assumes field names mostly match or we adjust Pydantic model
        response_notes = [Note.model_validate(note) for note in notes_from_db]
        # --- DEBUG: Print one converted note ---
        if response_notes:
             logger.info(f"First converted note for response: {response_notes[0]}")
        # --- END DEBUG ---
        
        return response_notes

    except Exception as e:
        logger.error(f"Database error fetching notes for {user_email}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error fetching notes from database.")

@app.post("/api/notes", response_model=Note)
async def add_note(
    note: Note,
    db: Annotated[Session, Depends(get_db)],
    user_email: Optional[str] = Depends(get_optional_user)
) -> Note:
    """
    Add a new note to the system, saving metadata to PostgreSQL and indexing vectors.
    """
    if not user_email:
        # Or adjust logic if anonymous notes are allowed
        logger.error("Attempted to add note without authentication.")
        raise HTTPException(status_code=401, detail="Authentication required to add notes")
        
    logger.info(f"Adding note for user: {user_email}")
    
    # 1. Generate unique note ID (same logic as before)
    note_id = f"note_{int(time.time() * 1000)}_{os.urandom(4).hex()}"
    
    # 2. Create SQLAlchemy model instance
    db_note = models.Note(
        id=note_id,
        user_id=user_email,
        title=note.title or "Untitled Note",
        text=note.text, # Use text field here
        # created_at and updated_at have database defaults
    )
    
    # 3. Save note metadata/content to PostgreSQL
    try:
        db.add(db_note)
        db.commit()
        db.refresh(db_note) # Refresh to get default values like created_at
        logger.info(f"Saved note metadata to DB with ID: {note_id} for user: {user_email}")
    except Exception as e:
        db.rollback() # Rollback DB transaction on error
        logger.error(f"Database error saving note {note_id} for {user_email}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error saving note to database.")

    # 4. Add note content to LlamaIndex vector store (via NoteRAG)
    try:
        note_rag_instance = get_note_rag(user_email)
        note_rag_instance.add_note_vector( 
            note_id=db_note.id,
            text=db_note.text, # Pass text field here
            metadata={'user_id': db_note.user_id, 'title': db_note.title, 'created_at': db_note.created_at.isoformat()}
        )
        logger.info(f"Triggered vector indexing for note ID: {note_id} for user: {user_email}")

    except Exception as e:
        logger.error(f"Error adding note vector {note_id} for {user_email}: {e}", exc_info=True)
        # Decide on error handling: should we delete the DB entry if vector fails?
        # For now, raise an error indicating partial failure.
        raise HTTPException(status_code=500, detail="Note saved to DB, but failed during vector indexing.")

    # 5. Return the created note data (convert SQLAlchemy model back to Pydantic)
    # Use the refreshed db_note which includes timestamps
    return Note.model_validate(db_note)

@app.delete("/api/notes/{note_id}", status_code=204) # Use 204 No Content for successful deletion
async def delete_note(
    note_id: str,
    db: Annotated[Session, Depends(get_db)], # Add db dependency (comes before default arg)
    user_email: Optional[str] = Depends(get_optional_user)
): # No response body for 204
    """
    Deletes a note by ID from PostgreSQL and the vector store.
    Ensures the user owns the note.
    """
    if not user_email:
        logger.error("Attempted to delete note without authentication.")
        raise HTTPException(status_code=401, detail="Authentication required to delete notes")

    logger.info(f"Attempting to delete note {note_id} for user: {user_email}")

    # 1. Find the note in PostgreSQL
    try:
        note_to_delete = db.query(models.Note)\
                           .filter(models.Note.id == note_id, models.Note.user_id == user_email)\
                           .first()
    except Exception as e:
        logger.error(f"Database error finding note {note_id} for deletion: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error accessing database.")

    # 2. Check if note exists and belongs to the user
    if note_to_delete is None:
        logger.warning(f"Note not found or not owned by user: ID {note_id}, User {user_email}")
        raise HTTPException(status_code=404, detail=f"Note with id {note_id} not found or not owned by user.")

    # 3. Delete from PostgreSQL
    try:
        db.delete(note_to_delete)
        db.commit()
        logger.info(f"Deleted note {note_id} from DB for user: {user_email}")
    except Exception as e:
        db.rollback()
        logger.error(f"Database error deleting note {note_id} from DB: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error deleting note from database.")

    # 4. Delete from LlamaIndex vector store (via NoteRAG)
    #    NOTE: Requires NoteRAG.delete_note to be refactored later.
    try:
        note_rag_instance = get_note_rag(user_email)
        # Assuming NoteRAG.delete_note will be adapted to only handle vector deletion
        success = note_rag_instance.delete_note_vector(note_id=note_id) # Hypothetical new method name
        if success:
             logger.info(f"Triggered vector deletion for note ID: {note_id} for user: {user_email}")
        else:
             # Log a warning if vector deletion wasn't successful according to NoteRAG
             # This might happen if the vector wasn't found, which could be okay if DB is source of truth
             logger.warning(f"Vector deletion for note ID {note_id} returned false (vector might not have existed). User: {user_email}")
             
    except Exception as e:
        logger.error(f"Error deleting note vector {note_id} for {user_email}: {e}", exc_info=True)
        # Don't necessarily raise HTTPException here, as DB deletion succeeded.
        # Log the error; persistent cleanup might be needed if vector deletion fails repeatedly.
        pass # Or raise a specific internal error if critical

    # No response body needed for HTTP 204
    return None

@app.get("/health")
async def health_check():
    """
    Health check endpoint for monitoring.
    
    Returns:
        Dict with status indicating if the service is operational
    """
    return {"status": "ok"}

@app.get("/api/search")
async def search_user_notes(
    q: str,
    db: Annotated[Session, Depends(get_db)],
    limit: int = 10,
    user_email: str = Depends(get_current_user)
):
    """Search notes for the authenticated user using semantic search."""
    try:
        logger.info(f"Searching notes for user {user_email} with query: {q}, limit: {limit}")
        note_rag_instance = get_note_rag(user_email)
        results = note_rag_instance.search_notes(db=db, query=q, limit=limit)
        logger.info(f"Found {len(results)} matching notes for user {user_email}")
        return results
    except Exception as e:
        logger.error(f"Error searching notes for user {user_email}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error searching notes: {str(e)}")

@app.get("/api/query")
async def query_user_notes(
    q: str,
    db: Annotated[Session, Depends(get_db)],
    top_k: int = 3,
    user_email: str = Depends(get_current_user)
):
    """
    Answer questions about the authenticated user's notes using LLM-powered query engine.
    """
    try:
        logger.info(f"Querying notes for user {user_email} with question: {q}, top_k: {top_k}")
        note_rag_instance = get_note_rag(user_email)
        results = note_rag_instance.query_notes(db=db, query=q, top_k=top_k)
        logger.info(f"Generated answer for user {user_email} using {len(results.get('sources', []))} source notes")
        return results
    except Exception as e:
        logger.error(f"Query failed for user {user_email}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)}")

@app.get("/api/stats")
async def get_stats(db: Annotated[Session, Depends(get_db)]):
    """
    Get system diagnostic information and stats based on data in PostgreSQL.
    """
    try:
        # Get notes count directly from DB
        note_count = db.query(func.count(models.Note.id)).scalar()

        # Fetch notes for date grouping and duplication check
        # WARNING: Fetching all notes can be slow. Consider optimized queries.
        all_notes = db.query(models.Note.id, models.Note.text, models.Note.created_at).all()

        # Count notes by creation day
        notes_by_day = defaultdict(int)
        for note in all_notes:
            if note.created_at:
                date_str = note.created_at.strftime('%Y-%m-%d')
                notes_by_day[date_str] += 1
        
        # Check for duplicate content (simplified check on first 100 chars)
        # Note: This is inefficient. A better approach might use hashes or DB constraints.
        unique_content = set()
        duplicate_count = 0
        duplicate_pairs = []
        note_content_map = {note.id: note.text[:100] for note in all_notes}
        processed_ids = set()

        for note_id, content_fingerprint in note_content_map.items():
            if note_id in processed_ids:
                continue
            if content_fingerprint in unique_content:
                duplicate_count += 1
                # Find other notes with the same fingerprint
                matches = [other_id for other_id, other_fp in note_content_map.items() 
                           if other_id != note_id and other_fp == content_fingerprint and other_id not in processed_ids]
                if matches:
                    match_id = matches[0] # Just show one pair example
                    duplicate_pairs.append({"note1_id": note_id, "note2_id": match_id})
                    processed_ids.add(note_id)
                    processed_ids.add(match_id)
                    for mid in matches[1:]:
                        processed_ids.add(mid) # Mark other duplicates as processed
            else:
                unique_content.add(content_fingerprint)
                processed_ids.add(note_id)

        # Get system information (remains the same)
        try:
            memory = psutil.virtual_memory()
            memory_info = {
                "total": memory.total,
                "available": memory.available,
                "percent": memory.percent
            }
        except ImportError:
            memory_info = {"error": "psutil not installed or available"}
        except Exception as mem_e:
             memory_info = {"error": f"Could not get memory info: {mem_e}"}
        
        return {
            "status": "ok",
            "version": "1.0.0", # Consider making this dynamic
            "note_stats": {
                "total_notes": note_count,
                "notes_by_day": dict(notes_by_day),
                "duplicate_content_count": duplicate_count,
                "duplicate_examples": duplicate_pairs[:5]  # Limit examples
            },
            "system": {
                "memory": memory_info,
                "server_time": int(time.time() * 1000)
            }
        }
    except Exception as e:
        logger.error(f"Error getting stats: {e}", exc_info=True)
        # Return error status instead of raising HTTPException for stats endpoint
        return {
            "status": "error",
            "message": f"An error occurred while calculating stats: {str(e)}"
        }

@app.get("/api/health")
async def api_health_check():
    """
    API health check endpoint specifically for the Chrome extension.
    
    Returns:
        JSONResponse with status information
    """
    try:
        return JSONResponse({
            "status": "ok",
            "version": "1.0.0",
            "timestamp": time.time() * 1000  # Current timestamp in ms
        })
    except Exception as e:
        logger.error(f"Error in API health check: {str(e)}")
        return JSONResponse({
            "status": "error",
            "message": str(e)
        }, status_code=500)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3000, reload=True) 