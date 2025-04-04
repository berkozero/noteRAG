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
from typing import Optional, List
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
        id: Unique identifier for the note
        text: The main content of the note
        title: Optional title for the note
        url: Optional source URL for the note
        timestamp: Optional creation timestamp (milliseconds since epoch)
        isHtml: Optional flag indicating if the text contains HTML
    """
    id: str
    text: str
    title: Optional[str] = None
    url: Optional[str] = None
    timestamp: Optional[int] = None
    isHtml: Optional[bool] = False

# Initialize FastAPI app with metadata
app = FastAPI(
    title="noteRAG API",
    description="API for managing and searching notes using LlamaIndex",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create templates directory
templates_dir = Path("templates")
templates_dir.mkdir(exist_ok=True)

# Initialize templates
templates = Jinja2Templates(directory="templates")

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

@app.on_event("startup")
async def startup_event():
    """
    FastAPI startup event handler to initialize resources.
    
    This function:
    - Runs when the FastAPI server starts
    - Initializes the NoteRAG index
    - Logs errors if initialization fails
    """
    if not init_index():
        logger.error("Failed to initialize index")
        # Don't raise an exception, just log the error

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
        HTMLResponse: Rendered admin.html template
    """
    return templates.TemplateResponse("admin.html", {"request": request})

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
    Add a new note to the system.
    
    This endpoint:
    - Validates the incoming note data
    - Ensures the index is initialized
    - Adds the note to the NoteRAG core
    
    Args:
        note: Validated Note object from request body
        
    Returns:
        Dict with status and ID of the added note
        
    Raises:
        HTTPException: 500 if note creation fails
    """
    logger.info(f"Adding note {note.id}")
    try:
        global index
        if index is None:
            logger.warning("Index is None, reinitializing...")
            init_index()
            
        if index is None:
            raise Exception("Failed to initialize index")
        
        # Use the add_note method from NoteRAG
        result = index.add_note(note.text, note.title, note.timestamp)
        logger.info(f"Successfully added note {result['id']}")
        
        return {"status": "success", "id": result['id']}
    except Exception as e:
        logger.error(f"Failed to add note: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
            
        # Create document using LlamaIndex's Document class
        doc = Document(
            text=note.text,
            metadata={
                "id": note.id,
                "title": note.title,
                "url": note.url,
                "timestamp": note.timestamp or int(datetime.now().timestamp() * 1000),
                "isHtml": note.isHtml
            }
        )
        
        # Insert using LlamaIndex's native insert
        index.insert(doc)
        index.storage_context.persist()
        logger.info(f"Successfully added note {note.id}")
        
        return {"status": "success", "id": note.id}
    except Exception as e:
        logger.error(f"Failed to add note: {str(e)}")
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

@app.get("/api/search")
async def search_notes(query: str, limit: int = 5):
    """
    Search notes by semantic similarity.
    
    This endpoint:
    - Takes a search query and optional result limit
    - Uses LlamaIndex's retriever for semantic search
    - Returns matching notes with their similarity scores
    
    Args:
        query: Search string
        limit: Maximum number of results (default: 5)
        
    Returns:
        List of matching notes ordered by relevance
        
    Raises:
        HTTPException: 500 if search fails
    """
    try:
        global index
        if index is None:
            logger.warning("Index is None, reinitializing...")
            init_index()
            
        if index is None:
            raise Exception("Failed to initialize index")
            
        # Directly use the search_notes method from NoteRAG
        results = index.search_notes(query, limit)
        logger.info(f"Search results: {results}")
        return results
    except Exception as e:
        logger.error(f"Search failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/embeddings")
async def create_embeddings(request: Request):
    """Create embeddings for a note."""
    try:
        body = await request.json()
        note_data = body.get("note", {})
        
        # Add ID if not present
        if "id" not in note_data:
            timestamp = note_data.get("timestamp", int(datetime.now().timestamp() * 1000))
            note_data["id"] = f"note_{timestamp}"
        
        # Convert to our Note model
        note = Note(
            id=note_data.get("id"),
            text=note_data.get("text"),
            title=note_data.get("title"),
            url=note_data.get("url"),
            timestamp=note_data.get("timestamp"),
            isHtml=note_data.get("isHtml", False)
        )
        
        global index
        if index is None:
            logger.warning("Index is None, reinitializing...")
            init_index()
            
        if index is None:
            raise Exception("Failed to initialize index")
        
        # Use the add_note method directly
        index.add_note(note.text, note.title, note.timestamp)
        logger.info(f"Successfully added note {note.id}")
        
        return note.dict()
    except Exception as e:
        logger.error(f"Failed to create embeddings: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3000, reload=True) 