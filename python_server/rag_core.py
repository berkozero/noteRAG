"""
NoteRAG Core - LlamaIndex Wrapper

This module provides the core functionality for managing notes using LlamaIndex.
It handles storage, retrieval, and semantic search of notes.
"""
from typing import Dict, List, Optional, Any
from datetime import datetime, timezone
from pathlib import Path
from llama_index.core import (
    Document,
    ServiceContext,
    StorageContext,
    load_index_from_storage,
    VectorStoreIndex,
    Settings
)
from llama_index.core.node_parser import SimpleNodeParser
from llama_index.llms.openai import OpenAI
from llama_index.embeddings.openai import OpenAIEmbedding
import logging
import os
from dotenv import load_dotenv
import json
import uuid
from llama_index.core.storage.docstore import SimpleDocumentStore
from llama_index.core.storage.index_store import SimpleIndexStore
from llama_index.core.vector_stores import SimpleVectorStore

# Import user manager
from .auth import user_manager

# Load environment variables from the root .env file
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
load_dotenv(env_path)
logging.basicConfig(level=logging.DEBUG)  # Set to DEBUG for more verbose output
logger = logging.getLogger(__name__)

# --- DB Imports ---
from sqlalchemy.orm import Session
from . import models
# --- End DB Imports ---

class NoteRAG:
    """
    Core wrapper around LlamaIndex functionality for note management.
    
    This class handles:
    - Initialization of vector index for note storage and retrieval
    - Adding, retrieving, updating, and deleting notes
    - Semantic search across stored notes
    - Persistence of notes and embeddings to disk
    
    The class uses OpenAI's embeddings and language models for semantic functionality.
    """
    
    def __init__(self, user_email: Optional[str] = None):
        """
        Initialize the NoteRAG system with LlamaIndex components.
        
        This constructor:
        - Sets up OpenAI LLM and embedding models
        - Configures global LlamaIndex settings
        - Initializes or loads existing vector index from disk for the specified user
        - Creates necessary directories for persistence
        
        Args:
            user_email: Optional email of the user. If provided, storage will be user-specific.
                        If None, will use the default storage location.
        
        Raises:
            Various exceptions if initialization fails (particularly API key issues)
        """
        logger.debug(f"Initializing NoteRAG with env file from: {env_path}")
        logger.debug(f"OPENAI_API_KEY exists: {bool(os.getenv('OPENAI_API_KEY'))}")
        
        # Set the user email
        self.user_email = user_email
        
        # Set the storage directory based on user email
        if user_email:
            # Get user-specific storage path
            self.persist_dir = str(user_manager.get_user_storage_path(user_email))
            logger.debug(f"Using user-specific storage directory at: {self.persist_dir}")
        else:
            # Use default storage path
            self.persist_dir = "python_server/storage"
            logger.debug(f"Using default storage directory at: {self.persist_dir}")
        
        # Ensure storage directory exists
        Path(self.persist_dir).mkdir(parents=True, exist_ok=True)
        logger.debug(f"Storage directory created/exists at: {self.persist_dir}")
        
        try:
            # Configure global settings for LlamaIndex
            logger.debug("Configuring OpenAI LLM...")
            llm = OpenAI(
                model="gpt-4-turbo-preview",  # Using the latest GPT-4 Turbo
                api_key=os.getenv("OPENAI_API_KEY"),
                temperature=0.1,
                max_tokens=512
            )
            logger.debug("LLM configured successfully")
            
            logger.debug("Configuring OpenAI Embedding model...")
            embed_model = OpenAIEmbedding(
                model="text-embedding-3-small",  # Using the latest embedding model
                api_key=os.getenv("OPENAI_API_KEY")
            )
            logger.debug("Embedding model configured successfully")
            
            Settings.llm = llm
            Settings.embed_model = embed_model
            Settings.node_parser = SimpleNodeParser.from_defaults(
                chunk_size=512,
                chunk_overlap=64
            )
            logger.debug("Global settings configured successfully")
            
        except Exception as e:
            logger.error(f"Error during LlamaIndex configuration: {str(e)}")
            logger.error(f"Error type: {type(e)}")
            raise
        
        try:
            vector_store_path = os.path.join(self.persist_dir, "vector_store.json")
            if os.path.exists(vector_store_path):
                logger.debug(f"Found existing vector store for {self.user_email or 'default user'}, loading...")
                # Load existing vector/index stores, use empty in-memory docstore
                storage_context = StorageContext.from_defaults(
                    persist_dir=self.persist_dir,
                    docstore=SimpleDocumentStore() # Use an empty one
                )
                self.index = load_index_from_storage(storage_context)
                logger.info(f"Successfully loaded existing index components for {self.user_email or 'default user'}")
            else:
                logger.debug(f"No existing vector store found for {self.user_email or 'default user'}, creating new empty index structure")
                # Create new context with specific stores (docstore is in-memory only)
                storage_context = StorageContext.from_defaults(
                     vector_store=SimpleVectorStore(),
                     index_store=SimpleIndexStore(),
                     docstore=SimpleDocumentStore() # Use an empty one
                )
                # Create new empty index (no documents initially)
                self.index = VectorStoreIndex([], storage_context=storage_context)
                # Persist only vector/index stores immediately
                self.index.storage_context.persist(
                    persist_dir=self.persist_dir
                )
                logger.info(f"Successfully created and persisted new index components for {self.user_email or 'default user'}")
                
        except Exception as e:
            logger.error(f"Error initializing index components: {str(e)}")
            logger.error(f"Error type: {type(e)}")
            raise

    def add_note_vector(self, note_id: str, text: str, metadata: Dict):
        """
        Adds the text and metadata of a note to the vector store index.
        Assumes the primary note data is already saved elsewhere (e.g., PostgreSQL).
        
        Args:
            note_id: The unique ID of the note (from the primary DB).
            text: The text content of the note to be indexed.
            metadata: Dictionary containing metadata (e.g., user_id, title, created_at).
        """
        try:
            logger.debug(f"[add_note_vector] Adding vector for note ID: {note_id}")
            logger.debug(f"[add_note_vector] Metadata received: {json.dumps(metadata)}")
            
            # Create a LlamaIndex Document
            logger.debug("[add_note_vector] Creating LlamaIndex Document...")
            document = Document(
                text=text,
                metadata=metadata,
                id_=note_id
            )
            logger.debug("[add_note_vector] Document object created.")
            
            # Insert the document into the index
            logger.debug("[add_note_vector] Calling self.index.insert(document)... (This may call OpenAI)")
            self.index.insert(document)
            logger.debug("[add_note_vector] self.index.insert(document) completed.")
            
            # Persist changes
            logger.debug("[add_note_vector] Calling self.index.storage_context.persist(...)")
            self.index.storage_context.persist(
                persist_dir=self.persist_dir
            )
            logger.debug("[add_note_vector] self.index.storage_context.persist(...) completed.")
            
            logger.info(f"[add_note_vector] Successfully processed vector for note ID: {note_id}")
            
        except Exception as e:
            logger.error(f"[add_note_vector] FAILED for note ID {note_id}: {e}", exc_info=True)
            raise

    def delete_note_vector(self, note_id: str) -> bool:
        """
        Deletes a note's vectors from the LlamaIndex vector store.
        
        Args:
            note_id: The unique identifier of the note to delete.
            
        Returns:
            True if deletion seemed successful, False otherwise (Note: LlamaIndex
            delete methods might not always reliably indicate success/failure).
        """
        try:
            logger.debug(f"Attempting to delete vector for note ID: {note_id}")
            
            # Delete the document reference and associated vectors
            # Set delete_from_docstore=False as the document isn't stored here
            self.index.delete_ref_doc(note_id, delete_from_docstore=False)
            
            # Persist changes to vector store and index store
            logger.debug("Persisting vector store and index store after deletion...")
            self.index.storage_context.persist(
                persist_dir=self.persist_dir,
                docstore_fname=None # Do not write docstore
            )
            
            logger.info(f"Successfully triggered vector deletion for note ID: {note_id}")
            # Note: LlamaIndex delete doesn't always confirm success reliably
            return True
        except Exception as e:
            # Log error but don't necessarily fail the whole operation in main.py
            logger.error(f"Failed to delete note vector for ID {note_id}: {e}", exc_info=True)
            return False

    def search_notes(self, db: Session, query: str, limit: int = 5) -> List[Dict]:
        """
        Performs semantic vector search using the index and retrieves full note 
        details from PostgreSQL for the current user.
        
        Args:
            db: The SQLAlchemy database session.
            query: The search query string.
            limit: The maximum number of results to return.
            
        Returns:
            List of dictionaries, each representing a note with its content and score.
        """
        if not self.user_email:
            logger.warning("Search attempted without a user context.")
            # Depending on desired behavior for default/shared index, adjust this
            return []
            
        logger.debug(f"Performing semantic search for user '{self.user_email}' with query: '{query}', limit: {limit}")
        try:
            retriever = self.index.as_retriever(similarity_top_k=limit)
            retrieved_nodes = retriever.retrieve(query)
            logger.debug(f"Retrieved {len(retrieved_nodes)} nodes from vector store.")

            if not retrieved_nodes:
                return []
                
            # Extract note IDs from retrieved nodes
            note_ids = [node.node_id for node in retrieved_nodes]
            # Create a map of note_id to score for later merging
            scores_map = {node.node_id: node.score for node in retrieved_nodes}

            # Fetch corresponding notes from PostgreSQL
            notes_from_db = db.query(models.Note)\
                              .filter(models.Note.id.in_(note_ids), models.Note.user_id == self.user_email)\
                              .all()
            
            # Create a map of note_id to DB note object for efficient lookup
            db_notes_map = {note.id: note for note in notes_from_db}

            # Combine results: Use order from retriever, enrich with DB data
            results = []
            for node_id in note_ids:
                db_note = db_notes_map.get(node_id)
                if db_note:
                    results.append({
                        "id": db_note.id,
                        "text": db_note.text,
                        "title": db_note.title,
                        "created_at": db_note.created_at.isoformat(),
                        "updated_at": db_note.updated_at.isoformat(),
                        "score": scores_map.get(node_id)
                    })
                else:
                    # This case should ideally not happen if vectors map correctly to DB
                    logger.warning(f"Retrieved node ID {node_id} not found in DB for user {self.user_email}")

            logger.info(f"Returning {len(results)} combined search results for query: '{query}'")
            return results
                
        except Exception as e:
            logger.error(f"Error during search notes for user {self.user_email}: {e}", exc_info=True)
            return [] # Return empty list on error

    def query_notes(self, db: Session, query: str, top_k: int = 3) -> Dict:
        """
        Performs Retrieval-Augmented Generation (RAG) using the index.
        Retrieves relevant notes, fetches their text from PostgreSQL, 
        constructs context, and queries the LLM.
        
        Args:
            db: The SQLAlchemy database session.
            query: The question to ask.
            top_k: The number of top similar notes to retrieve for context.
            
        Returns:
            Dictionary containing the LLM's response and source node IDs.
        """
        if not self.user_email:
            logger.warning("Query attempted without a user context.")
            return {"response": "Error: User context is required for querying.", "source_nodes": []}

        logger.debug(f"Performing RAG query for user '{self.user_email}' with query: '{query}', top_k: {top_k}")
        try:
            # 1. Retrieve relevant node IDs from vector store
            retriever = self.index.as_retriever(similarity_top_k=top_k)
            retrieved_nodes = retriever.retrieve(query)
            logger.debug(f"Retrieved {len(retrieved_nodes)} nodes from vector store for RAG.")

            if not retrieved_nodes:
                return {"response": "Could not find relevant notes to answer the question.", "source_nodes": []}

            # 2. Fetch note content from PostgreSQL using retrieved IDs
            note_ids = [node.node_id for node in retrieved_nodes]
            source_nodes_metadata = [
                {"id": node.node_id, "score": node.score} for node in retrieved_nodes
            ]
            
            notes_from_db = db.query(models.Note.id, models.Note.text, models.Note.title)\
                              .filter(models.Note.id.in_(note_ids), models.Note.user_id == self.user_email)\
                              .all()
                              
            if not notes_from_db:
                logger.warning(f"Retrieved node IDs {note_ids} but found no matching notes in DB for user {self.user_email}")
                return {"response": "Found potentially relevant note references, but could not retrieve their content.", "source_nodes": source_nodes_metadata}

            # 3. Construct context for the LLM
            context_str = "\n".join([f"---\nNote Title: {note.title}\nNote Content: {note.text}\n---" for note in notes_from_db])
            logger.debug(f"Constructed context for LLM: {context_str[:200]}...")
            
            # 4. Prepare prompt and query the LLM
            #    Using a simple completion prompt here. Chat prompt might be better.
            prompt = (
                f"Based ONLY on the following context extracted from user notes, please answer the question.\n"
                f"If the context does not contain the answer, say so.\n\n"
                f"Context:\n{context_str}\n\n"
                f"Question: {query}\n\n"
                f"Answer:\""
            )
            
            logger.debug("Sending request to LLM...")
            llm_response = Settings.llm.complete(prompt)
            answer = llm_response.text.strip()
            logger.info(f"Received LLM response for query: '{query}'")
            
            # 5. Return results
            return {
                "response": answer,
                # Enrich source nodes metadata with titles from DB
                "source_nodes": [
                    {**meta, "title": next((n.title for n in notes_from_db if n.id == meta["id"]), None)}
                    for meta in source_nodes_metadata
                 ]
            }
            
        except Exception as e:
            logger.error(f"Error during query notes for user {self.user_email}: {e}", exc_info=True)
            return {"response": "An error occurred while processing the query.", "source_nodes": []}


# End of NoteRAG class definition 