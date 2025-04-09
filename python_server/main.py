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
from pydantic import BaseModel, EmailStr
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
    """
    text: str
    title: Optional[str] = None
    url: Optional[str] = None
    timestamp: Optional[int] = None
    isHtml: Optional[bool] = False
    id: Optional[str] = None

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

@app.get("/")
async def root():
    """
    Root endpoint for server availability check.
    
    Returns:
        Dict with status message indicating the server is running
    """
    return {"status": "ok", "message": "noteRAG API is running"}

@app.get("/admin", response_class=HTMLResponse)
async def admin(request: Request):
    """
    Serve the admin panel HTML page.
    
    Args:
        request: The FastAPI request object
        
    Returns:
        HTMLResponse: Rendered admin.html template with all notes
    """
    # Get default NoteRAG instance
    index = get_note_rag()
    
    # Get all notes
    notes = index.get_all_notes()
    
    # Render template with notes
    return templates.TemplateResponse("admin.html", {"request": request, "notes": notes})

@app.get("/api/notes")
async def get_notes(user_email: Optional[str] = Depends(get_optional_user)) -> List[Note]:
    """
    Get all notes stored in the system.
    
    This endpoint:
    - Gets the NoteRAG instance for the authenticated user or default
    - Retrieves all notes from the NoteRAG core
    - Formats them as Note objects
    
    Args:
        user_email: Optional email of the authenticated user
    
    Returns:
        List[Note]: All notes for the user
        
    Raises:
        HTTPException: 500 if retrieval fails
    """
    logger.info(f"Fetching notes for user: {user_email or 'anonymous'}")
    try:
        # Get NoteRAG instance for the user
        index = get_note_rag(user_email)
            
        # Use the get_all_notes method from NoteRAG
        notes_data = index.get_all_notes()
        
        # Convert to list of Note objects
        notes = []
        for note_data in notes_data:
            note = Note(
                id=note_data.get("id"),
                text=note_data.get("text", ""),
                title=note_data.get("title", ""),
                timestamp=note_data.get("timestamp", 0),
                url=note_data.get("url", ""),
                isHtml=note_data.get("isHtml", False)
            )
            notes.append(note)
        
        logger.info(f"Returning {len(notes)} notes")
        return notes
            
    except Exception as e:
        logger.error(f"Error fetching notes: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching notes: {str(e)}")

@app.post("/api/notes")
async def add_note(note: Note, user_email: Optional[str] = Depends(get_optional_user)) -> Dict:
    """
    Add a new note to the system.
    
    This endpoint:
    - Gets the NoteRAG instance for the authenticated user or default
    - Adds the note to the index
    - Returns the created note
    
    Args:
        note: The note to add
        user_email: Optional email of the authenticated user
        
    Returns:
        Dict: The created note details
        
    Raises:
        HTTPException: 500 if creation fails
    """
    logger.info(f"Adding note for user: {user_email or 'anonymous'}")
    try:
        # Get NoteRAG instance for the user
        index = get_note_rag(user_email)
        
        # Use the user's NoteRAG instance to add the note
        if not note.timestamp:
            note.timestamp = int(time.time() * 1000)
            
        # Add the note
        created_note = index.add_note(
            text=note.text,
            title=note.title or "Untitled Note",
            timestamp=note.timestamp
        )
        
        logger.info(f"Added note with ID: {created_note['id']} for user: {user_email or 'anonymous'}")
        return created_note
    
    except Exception as e:
        logger.error(f"Error adding note: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error adding note: {str(e)}")

@app.delete("/api/notes/{note_id}")
async def delete_note(note_id: str, user_email: Optional[str] = Depends(get_optional_user)):
    """
    Delete a note by ID.
    
    This endpoint:
    - Gets the NoteRAG instance for the authenticated user or default
    - Attempts to find and delete the specified note
    - Returns success status if deleted
    
    Args:
        note_id: Unique identifier of the note to delete
        user_email: Optional email of the authenticated user
        
    Returns:
        Dict with status message
        
    Raises:
        HTTPException: 404 if note not found, 500 if deletion fails
    """
    logger.info(f"Deleting note {note_id} for user: {user_email or 'anonymous'}")
    try:
        # Get NoteRAG instance for the user
        index = get_note_rag(user_email)
            
        # Directly use the delete_note method from NoteRAG
        success = index.delete_note(note_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="Note not found")
            
        logger.info(f"Successfully deleted note {note_id} for user: {user_email or 'anonymous'}")
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete note: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    """
    Health check endpoint for monitoring.
    
    Returns:
        Dict with status indicating if the service is operational
    """
    return {"status": "ok"}

@app.get("/api/search")
async def search_user_notes(q: str, limit: int = 10, user_email: str = Depends(get_current_user)):
    """Search notes for the authenticated user using semantic search."""
    try:
        logger.info(f"Searching notes for user {user_email} with query: {q}, limit: {limit}")
        note_rag_instance = get_note_rag(user_email)
        results = note_rag_instance.search_notes(q, limit)
        logger.info(f"Found {len(results)} matching notes for user {user_email}")
        # Ensure the response format is a list of notes, similar to /api/notes
        return results 
    except Exception as e:
        logger.error(f"Error searching notes for user {user_email}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error searching notes: {str(e)}")

@app.get("/api/query")
async def query_user_notes(q: str, top_k: int = 3, user_email: str = Depends(get_current_user)):
    """
    Answer questions about the authenticated user's notes using LLM-powered query engine.
    """
    try:
        logger.info(f"Querying notes for user {user_email} with question: {q}, top_k: {top_k}")
        note_rag_instance = get_note_rag(user_email)
        response = note_rag_instance.query_notes(q, top_k)
        logger.info(f"Generated answer for user {user_email} using {len(response.get('sources', []))} source notes")
        return response
    except Exception as e:
        logger.error(f"Query failed for user {user_email}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)}")

@app.get("/api/stats")
async def get_stats():
    """Get system diagnostic information and stats."""
    try:
        # Get notes count
        all_notes = index.get_all_notes()
        # Create a simple count of notes
        note_count = len(all_notes)
        # Count notes by creation day
        from collections import defaultdict
        
        # Group notes by day
        notes_by_day = defaultdict(int)
        
        for note in all_notes:
            timestamp = note.get("timestamp", 0)
            if timestamp:
                # Convert millisecond timestamp to date string
                date_str = datetime.fromtimestamp(timestamp / 1000).strftime('%Y-%m-%d')
                notes_by_day[date_str] += 1
        
        # Check for duplicate content
        unique_content = set()
        duplicate_count = 0
        duplicate_pairs = []
        
        for note in all_notes:
            # Use first 100 chars as content fingerprint
            content = note.get("text", "")[:100]
            if content in unique_content:
                duplicate_count += 1
                # Find the other note with this content
                for other_note in all_notes:
                    if other_note["id"] != note["id"] and other_note.get("text", "")[:100] == content:
                        duplicate_pairs.append({
                            "note1_id": note["id"],
                            "note2_id": other_note["id"],
                            "timestamp1": note.get("timestamp"),
                            "timestamp2": other_note.get("timestamp")
                        })
                        break
            else:
                unique_content.add(content)
        
        # Get system information
        try:
            memory = psutil.virtual_memory()
            memory_info = {
                "total": memory.total,
                "available": memory.available,
                "percent": memory.percent
            }
        except:
            memory_info = {"error": "psutil not available"}
        
        return {
            "status": "ok",
            "version": "1.0.0",
            "note_stats": {
                "total_notes": note_count,
                "notes_by_day": dict(notes_by_day),
                "duplicate_content_count": duplicate_count,
                "duplicate_examples": duplicate_pairs[:5]  # Return up to 5 examples
            },
            "system": {
                "memory": memory_info,
                "server_time": int(time.time() * 1000)
            }
        }
    except Exception as e:
        logger.error(f"Error getting stats: {str(e)}")
        return {
            "status": "error",
            "message": str(e)
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