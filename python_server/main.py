"""
NoteRAG API Server

This is the main entry point for the noteRAG API server.
It provides all API endpoints for managing notes, handling search, and serving the admin panel.
The server uses FastAPI with LlamaIndex for vector storage and retrieval.
"""
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, HTMLResponse
from pydantic import BaseModel
from typing import Optional, List, Dict
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
from core import NoteRAG
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

# Initialize storage
DATA_DIR = Path("data")
INDEX_DIR = DATA_DIR / "index"
storage_context = None
index = None

def init_index():
    """
    Initialize or load the LlamaIndex vector index.
    
    This function:
    - Creates a new NoteRAG instance if one doesn't exist
    - Handles any initialization errors and logs them
    
    Returns:
        bool: True if initialization succeeded, False otherwise
    """
    try:
        global index
        if index is None:
            logger.info("Initializing index...")
            index = NoteRAG()
            logger.info("Index initialized")
        return True
    except Exception as e:
        logger.error(f"Failed to initialize index: {str(e)}")
        logger.error(f"Error type: {type(e)}")
        return False

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for FastAPI app.
    
    This function:
    - Runs when the FastAPI server starts
    - Initializes the NoteRAG index
    - Logs errors if initialization fails
    - Cleans up resources when the server shuts down
    
    Args:
        app: FastAPI application instance
    """
    # Startup: Initialize the index
    logger.info("Starting the application...")
    if not init_index():
        logger.error("Failed to initialize index")
    
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
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Create templates directory
templates_dir = Path("templates")
templates_dir.mkdir(exist_ok=True)

# Initialize templates
templates = Jinja2Templates(directory="templates")

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
    # Initialize index if needed
    init_index()
    
    # Get all notes
    notes = index.get_all_notes()
    
    # Render template with notes
    return templates.TemplateResponse("admin.html", {"request": request, "notes": notes})

@app.get("/api/notes")
async def get_notes() -> List[Note]:
    """
    Get all notes stored in the system.
    
    This endpoint:
    - Ensures the index is initialized
    - Retrieves all notes from the NoteRAG core
    - Formats them as Note objects
    
    Returns:
        List[Note]: All notes in the system
        
    Raises:
        HTTPException: 500 if retrieval fails
    """
    logger.info("Fetching all notes")
    try:
        global index
        if index is None:
            logger.warning("Index is None, reinitializing...")
            init_index()
            
        if index is None:
            raise Exception("Failed to initialize index")
        
        # Use the get_all_notes method from NoteRAG
        notes_data = index.get_all_notes()
        
        notes = []
        for note_data in notes_data:
            notes.append(Note(
                id=note_data.get('id'),
                text=note_data.get('text'),
                title=note_data.get('title'),
                url=note_data.get('url', None),
                timestamp=note_data.get('timestamp'),
                isHtml=note_data.get('isHtml', False)
            ))
        return notes
    except Exception as e:
        logger.error(f"Failed to get notes: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/notes")
async def add_note(note: Note):
    """
    Add a new note to the index.
    
    This endpoint:
    - Receives note data in the request body
    - Generates a unique ID for the note if not provided
    - Adds the note to the NoteRAG index
    - Returns the created note with its ID
    
    Args:
        note: Note data from request body
        
    Returns:
        The created note with its ID
        
    Raises:
        HTTPException: 500 if the note creation fails
    """
    try:
        if not init_index():
            raise HTTPException(status_code=500, detail="Failed to initialize index")
            
        # Now the ID can be generated on the server side
        # If ID is provided, use it, otherwise let NoteRAG generate one
        result = index.add_note(
            text=note.text,
            title=note.title or "",
            timestamp=note.timestamp or int(time.time() * 1000)
        )
        
        return result
    except Exception as e:
        logger.error(f"Error adding note: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/notes/{note_id}")
async def delete_note(note_id: str):
    """
    Delete a note by ID.
    
    This endpoint:
    - Ensures the index is initialized
    - Attempts to find and delete the specified note
    - Returns success status if deleted
    
    Args:
        note_id: Unique identifier of the note to delete
        
    Returns:
        Dict with status message
        
    Raises:
        HTTPException: 404 if note not found, 500 if deletion fails
    """
    logger.info(f"Deleting note {note_id}")
    try:
        global index
        if index is None:
            logger.warning("Index is None, reinitializing...")
            init_index()
            
        if index is None:
            raise Exception("Failed to initialize index")
            
        # Directly use the delete_note method from NoteRAG
        success = index.delete_note(note_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="Note not found")
            
        logger.info(f"Successfully deleted note {note_id}")
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

@app.get("/api/notes/search")
async def search_notes(query: str, limit: int = 5):
    """
    Search notes by semantic similarity.
    
    This endpoint:
    - Takes a search query and optional result limit
    - Performs semantic search on notes using NoteRAG
    - Returns matching notes sorted by relevance
    
    Args:
        query: Search string
        limit: Maximum number of results to return (default: 5)
        
    Returns:
        List of matching notes ordered by relevance
        
    Raises:
        HTTPException: 404 if no matching notes found, 500 if search fails
    """
    logger.info(f"Searching notes with query: {query}")
    try:
        global index
        if index is None:
            logger.warning("Index is None, reinitializing...")
            init_index()
            
        if index is None:
            raise Exception("Failed to initialize index")
        
        # Use the search_notes method from NoteRAG
        results = index.search_notes(query, limit)
        
        if not results:
            logger.info("No matching notes found")
            return []
            
        logger.info(f"Found {len(results)} matching notes")
        return results
    except Exception as e:
        logger.error(f"Search failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

def convert_request_to_note(body: Dict) -> Note:
    """
    Convert request body dictionary to a Note object.
    
    Args:
        body: Dictionary containing note data with a "note" key
        
    Returns:
        Note object initialized with data from the request
        
    Raises:
        Exception: If required note data is missing
    """
    note_data = body.get("note", {})
    
    # Add ID if not present
    if "id" not in note_data:
        timestamp = note_data.get("timestamp", int(datetime.now().timestamp() * 1000))
        note_data["id"] = f"note_{timestamp}"
    
    # Convert to Note model
    return Note(
        id=note_data.get("id"),
        text=note_data.get("text"),
        title=note_data.get("title"),
        url=note_data.get("url"),
        timestamp=note_data.get("timestamp"),
        isHtml=note_data.get("isHtml", False)
    )

@app.post("/api/embeddings")
async def add_note_with_embedding(body: Dict):
    """Add a new note with its embeddings"""
    try:
        logger.debug(f"Adding note with embedding: {body}")
        
        note = convert_request_to_note(body)
        logger.debug(f"Converted note: {note.__dict__}")
        
        # Add the note to the index
        result = index.add_note(
            text=note.text,
            title=note.title,
            timestamp=note.timestamp
        )
        
        return {
            "status": "success",
            "message": "Note added with embedding",
            "note": result
        }
    except Exception as e:
        logger.error(f"Error adding note with embedding: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/embeddings/update")
async def update_embeddings_only(body: Dict):
    """
    Update embeddings for an existing note without creating a duplicate.
    
    This endpoint:
    - Takes a note in the request body
    - Updates only its embeddings without creating a new note
    - Returns success status
    """
    try:
        logger.debug(f"Updating embeddings only: {body}")
        
        note = convert_request_to_note(body)
        logger.debug(f"Converted note: {note.__dict__}")
        
        # Check if note exists - try both formats of ID (with hyphen and with underscore)
        original_id = note.id
        
        # Try original ID format first
        existing_note = index.get_note(note.id)
        
        # If not found and ID contains hyphen, try with underscore instead
        if not existing_note and '-' in note.id:
            underscore_id = note.id.replace('-', '_')
            logger.debug(f"Note with ID {note.id} not found, trying {underscore_id}")
            existing_note = index.get_note(underscore_id)
            
            # If found with underscore format, update the note ID to match
            if existing_note:
                note.id = underscore_id
                logger.debug(f"Found note with ID {underscore_id}, updating ID")
        
        # If still not found, try the opposite conversion (underscore to hyphen)
        if not existing_note and '_' in note.id:
            hyphen_id = note.id.replace('_', '-')
            logger.debug(f"Note with ID {note.id} not found, trying {hyphen_id}")
            existing_note = index.get_note(hyphen_id)
            
            # If found with hyphen format, update the note ID to match
            if existing_note:
                note.id = hyphen_id
                logger.debug(f"Found note with ID {hyphen_id}, updating ID")
        
        # If still not found, create a new note instead of updating
        if not existing_note:
            logger.debug(f"Note not found with any ID format, creating new note")
            note.id = f"note_{note.timestamp}"  # Ensure consistent ID format for new notes
            result = index.add_note(note.text, note.title, note.timestamp)
            return {
                "status": "success", 
                "message": "Note not found, created new note instead",
                "note": result
            }
            
        # Update embeddings for the note
        success = index.update_embeddings(note)
        
        if success:
            return {"status": "success", "message": "Embeddings updated"}
        else:
            raise HTTPException(status_code=500, detail="Failed to update embeddings")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating embeddings: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/search")
async def search_notes(q: str, limit: int = 10):
    """Search notes using semantic search."""
    try:
        logger.debug(f"Searching notes with query: {q}, limit: {limit}")
        results = index.search_notes(q, limit)
        return {"results": results}
    except Exception as e:
        logger.error(f"Error searching notes: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/query")
async def query_notes(q: str, top_k: int = 3):
    """
    Answer questions about notes using LLM-powered query engine.
    
    This endpoint:
    - Takes a question about your notes and optional top_k parameter
    - Retrieves relevant notes as context
    - Uses LlamaIndex query engine to generate a comprehensive answer
    - Returns the answer and source notes used for context
    
    Args:
        q: The question to answer about your notes
        top_k: Number of most relevant notes to use as context (default: 3)
        
    Returns:
        Dictionary with answer text and source notes used
        
    Raises:
        HTTPException: 500 if query fails
    """
    try:
        logger.info(f"Querying notes with question: {q}, top_k: {top_k}")
        
        global index
        if index is None:
            logger.warning("Index is None, reinitializing...")
            init_index()
            
        if index is None:
            raise Exception("Failed to initialize index")
        
        # Use the query_notes method from NoteRAG
        response = index.query_notes(q, top_k)
        
        logger.info(f"Generated answer with {len(response.get('sources', []))} source notes")
        return response
        
    except Exception as e:
        logger.error(f"Query failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3000, reload=True) 