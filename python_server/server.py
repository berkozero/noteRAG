"""
NoteRAG HTTP Server

This module provides a FastAPI web server that exposes the NoteRAG core functionality via HTTP endpoints.
It handles all API routes, request validation, and response formatting.
"""
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from typing import Dict, List, Optional
from core import NoteRAG
import logging
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files directory
app.mount("/static", StaticFiles(directory="static"), name="static")

# Set up Jinja2 templates
templates = Jinja2Templates(directory="templates")

# Initialize NoteRAG
note_rag = NoteRAG()

class Note(BaseModel):
    """
    Pydantic model for validating note input data.
    
    Fields:
        text: The content of the note
        title: The title of the note
        timestamp: Unix timestamp (milliseconds) of when the note was created
    """
    text: str
    title: str
    timestamp: int

class NoteResponse(BaseModel):
    """
    Pydantic model for formatting note response data.
    
    Fields:
        id: Unique identifier for the note
        text: The content of the note
        title: The title of the note
        timestamp: Unix timestamp (milliseconds) of when the note was created
    """
    id: str
    text: str
    title: str
    timestamp: int

@app.post("/api/notes", response_model=NoteResponse)
async def add_note(note: Note):
    """
    Add a new note to the system.
    
    This endpoint:
    - Validates the incoming note data
    - Passes the data to the NoteRAG core
    - Returns the created note with its assigned ID
    
    Args:
        note: Validated Note object from request body
        
    Returns:
        NoteResponse: The created note with assigned ID
        
    Raises:
        HTTPException: 500 if note creation fails
    """
    try:
        result = note_rag.add_note(
            text=note.text,
            title=note.title,
            timestamp=note.timestamp
        )
        return result
    except Exception as e:
        logger.error(f"Error adding note: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

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
    try:
        results = note_rag.search_notes(query, limit)
        if not results:
            raise HTTPException(status_code=404, detail="No matching notes found")
        return results
    except Exception as e:
        logger.error(f"Error searching notes: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/notes/{note_id}", response_model=Optional[NoteResponse])
async def get_note(note_id: str):
    """
    Get a specific note by ID.
    
    This endpoint:
    - Takes a note ID as a path parameter
    - Retrieves the note from the NoteRAG core
    - Returns the note if found
    
    Args:
        note_id: Unique identifier of the note to retrieve
        
    Returns:
        NoteResponse: The requested note
        
    Raises:
        HTTPException: 404 if note not found, 500 if retrieval fails
    """
    try:
        note = note_rag.get_note(note_id)
        if note is None:
            raise HTTPException(status_code=404, detail="Note not found")
        return note
    except Exception as e:
        logger.error(f"Error getting note: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/notes", response_model=List[NoteResponse])
async def get_all_notes():
    """
    Get all notes in the system.
    
    This endpoint:
    - Retrieves all notes from the NoteRAG core
    - Returns them as a list, typically sorted by timestamp (newest first)
    
    Returns:
        List[NoteResponse]: All notes in the system
        
    Raises:
        HTTPException: 500 if retrieval fails
    """
    try:
        return note_rag.get_all_notes()
    except Exception as e:
        logger.error(f"Error getting all notes: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/notes/{note_id}")
async def delete_note(note_id: str):
    """
    Delete a note by ID.
    
    This endpoint:
    - Takes a note ID as a path parameter
    - Attempts to delete the note using the NoteRAG core
    - Returns success status on completion
    
    Args:
        note_id: Unique identifier of the note to delete
        
    Returns:
        Dict with status message
        
    Raises:
        HTTPException: 404 if note not found, 500 if deletion fails
    """
    try:
        success = note_rag.delete_note(note_id)
        if not success:
            raise HTTPException(status_code=404, detail="Note not found")
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Error deleting note: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/embeddings")
async def add_note_with_embedding(body: Dict):
    """
    Legacy endpoint for adding a note with embedding.
    
    This endpoint:
    - Takes a note in the request body
    - Adds it to the NoteRAG core
    - Returns the added note details
    
    Args:
        body: Request body containing note data
        
    Returns:
        Dict with status and note details
        
    Raises:
        HTTPException: 500 if conversion or note addition fails
    """
    try:
        note = Note(**body["note"])
        return await add_note(note)
    except Exception as e:
        logger.error(f"Error in legacy endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/embeddings/update")
async def update_embeddings_only(body: Dict):
    """
    Update embeddings for an existing note without creating a duplicate.
    
    This endpoint:
    - Takes a note in the request body
    - Updates only its embeddings without creating a new note
    - Returns success status
    
    Args:
        body: Request body containing note data
        
    Returns:
        Dict with success status
        
    Raises:
        HTTPException: 404 if note not found, 500 if update fails
    """
    try:
        note = Note(**body["note"])
        
        # Check if note exists
        existing_note = note_rag.get_note(note.id)
        if not existing_note:
            raise HTTPException(status_code=404, detail="Note not found")
            
        # Update embeddings for the note (reimplements embedding generation)
        success = note_rag.update_embeddings(note)
        
        if success:
            return {"status": "success", "message": "Embeddings updated"}
        else:
            raise HTTPException(status_code=500, detail="Failed to update embeddings")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating embeddings: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/admin", response_class=HTMLResponse)
async def admin_panel(request: Request):
    """
    Render the admin panel HTML page.
    
    This endpoint:
    - Gets all notes from the NoteRAG core
    - Renders the admin.html template with the notes data
    - Returns the HTML response
    
    Args:
        request: The FastAPI Request object
        
    Returns:
        HTMLResponse: The rendered admin panel page
    """
    notes = note_rag.get_all_notes()
    return templates.TemplateResponse("admin.html", {"request": request, "notes": notes}) 