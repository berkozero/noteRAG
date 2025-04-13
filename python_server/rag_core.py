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
import re
from llama_index.core.storage.docstore import SimpleDocumentStore
from llama_index.core.storage.index_store import SimpleIndexStore
from llama_index.core.vector_stores import SimpleVectorStore
# --- ChromaDB Imports ---
from llama_index.vector_stores.chroma import ChromaVectorStore
import chromadb
# --- End ChromaDB Imports ---

# Import user manager
from .auth import user_manager

# Load environment variables from the root .env file
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
load_dotenv(env_path)

# Get the specific logger for this module
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
        
        # --- Start Refactored Index/Storage Initialization ---
        
        # --- ChromaDB Setup ---
        logger.debug("Configuring ChromaDB connection...")
        chroma_host = os.getenv("CHROMA_HOST", "localhost")
        chroma_port = os.getenv("CHROMA_PORT", "8000")
        try:
            # Increase timeout for ChromaDB client
            # Try connecting without explicit settings first
            logger.debug(f"Attempting to connect to ChromaDB at {chroma_host}:{chroma_port} without explicit settings...")
            chroma_client = chromadb.HttpClient(
                host=chroma_host, 
                port=chroma_port
                # settings=chromadb.Settings(chroma_client_auth_provider="noop") # Temporarily removed
            )
            # Simple check to see if connection is alive
            logger.debug("Checking ChromaDB heartbeat...")
            chroma_client.heartbeat() 
            logger.debug(f"Successfully connected to ChromaDB at {chroma_host}:{chroma_port}")
        except Exception as e:
            logger.error(f"Failed to connect to ChromaDB at {chroma_host}:{chroma_port}: {e}")
            # Consider specific error handling or re-raising depending on application needs
            raise # Re-raise the exception to halt initialization

        # Define a user-specific collection name
        collection_name_prefix = "noterag_collection_v2"
        if self.user_email:
            # Sanitize email for collection name (replace non-alphanumeric chars with _)
            sanitized_email = re.sub(r'[^a-zA-Z0-9_-]', '_', self.user_email)
            # Ensure name doesn't start/end with _ or contain consecutive __
            sanitized_email = re.sub(r'_+', '_', sanitized_email).strip('_')
            if not sanitized_email: # Handle cases where email consists only of invalid chars
                sanitized_email = "invalid_user"
            collection_name = f"{collection_name_prefix}_{sanitized_email}"
            # Chroma collection names have length constraints (3-63 chars)
            collection_name = collection_name[:63] 
        else:
            collection_name = f"{collection_name_prefix}_default"
        logger.debug(f"Using ChromaDB collection name: {collection_name}")

        try:
            # --- REMOVED EXPLICIT DELETE --- 
            # try:
            #      logger.warning(f"Attempting to DELETE existing Chroma collection (if any): {collection_name}")
            #      chroma_client.delete_collection(collection_name)
            #      logger.info(f"Successfully deleted Chroma collection: {collection_name}")
            # except Exception as delete_e:
            #      logger.warning(f"Could not delete collection '{collection_name}' (may not exist): {type(delete_e).__name__} - {delete_e}")
            # --- END EXPLICIT DELETE --- 

            # Get or create the collection
            logger.debug(f"Attempting to get or create Chroma collection: {collection_name}")
            chroma_collection = chroma_client.get_or_create_collection(collection_name)
            vector_store = ChromaVectorStore(chroma_collection=chroma_collection)
            self.vector_store = vector_store
            logger.debug("ChromaVectorStore initialized and assigned to self.vector_store.")
        except Exception as e:
            # Catch potential ChromaDB operational errors during collection access
            logger.error(f"Failed to initialize ChromaVectorStore or access collection '{collection_name}': {e}")
            raise # Re-raise to indicate critical failure
        # --- End ChromaDB Setup ---


        # --- Storage Context Setup (with Chroma) ---
        logger.debug("Setting up StorageContext with ChromaVectorStore...")
        # docstore_path = os.path.join(self.persist_dir, "docstore.json") # No longer persisting
        # index_store_path = os.path.join(self.persist_dir, "index_store.json") # No longer persisting

        # Initialize stores in-memory only
        try:
            # Always create new stores, do not load from disk
            logger.debug("Creating new in-memory SimpleDocumentStore.")
            docstore = SimpleDocumentStore()

            logger.debug("Creating new in-memory SimpleIndexStore.")
            index_store = SimpleIndexStore()

            # Create storage context using Chroma for vectors and simple stores for others
            storage_context = StorageContext.from_defaults(
                vector_store=self.vector_store, # Use ChromaDB
                docstore=docstore,
                index_store=index_store
            )
            logger.debug("StorageContext created successfully.")

        except Exception as e:
            logger.error(f"Error initializing/loading simple stores or creating StorageContext: {e}")
            raise # Critical error during storage setup
        # --- End Storage Context Setup ---


        # --- Index Initialization ---
        try:
            # Initialize an empty index explicitly linked to the storage context
            logger.debug("Initializing EMPTY VectorStoreIndex using the StorageContext...")
            self.index = VectorStoreIndex(
                nodes=[], # Start with no nodes
                storage_context=storage_context
            )
            
            logger.info(f"NoteRAG initialized successfully for user: {self.user_email or 'default'} using ChromaDB. (In-memory stores)")
                
        except Exception as e:
            logger.error(f"Error during VectorStoreIndex initialization: {str(e)}") # Removed persistence mention
            logger.error(f"Error type: {type(e)}")
            raise # Critical error during index initialization

        # --- End Refactored Index/Storage Initialization ---

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

            # --- Explicitly add note_id to metadata --- 
            metadata['doc_id'] = note_id 
            logger.debug(f"[add_note_vector] Metadata modified with doc_id: {json.dumps(metadata)}")
            # --- End metadata modification ---
            
            # Create a LlamaIndex Document
            logger.debug("[add_note_vector] Creating LlamaIndex Document...")
            document = Document(
                text=text,
                metadata=metadata,
                # Ensure doc id is set, though node id is more critical below
                id_=note_id # Set document ID to note_id for potential reference
            )
            logger.debug("[add_note_vector] Document object created.")

            # --- MODIFIED PART: Explicit Node Creation ---
            logger.debug("[add_note_vector] Parsing document into nodes...")
            node_parser = Settings.node_parser
            nodes = node_parser.get_nodes_from_documents([document])

            if not nodes:
                logger.warning(f"[add_note_vector] No nodes parsed from document for note ID {note_id}. Skipping vector add.")
                return # Or raise error?

            logger.debug(f"[add_note_vector] Parsed {len(nodes)} node(s).")
            # Node IDs are handled internally by LlamaIndex/Chroma now

            if len(nodes) == 1:
                # Use index.insert_nodes() to handle embedding generation
                logger.debug(f"[add_note_vector] Calling self.index.insert_nodes(nodes) for single node case...")
                self.index.insert_nodes(nodes)
                logger.debug(f"[add_note_vector] self.index.insert_nodes(nodes) completed for single node case.")
            else:
                # Handle multiple nodes if necessary
                logger.error(f"[add_note_vector] WARNING: Expected 1 node, got {len(nodes)} for note {note_id}. Attempting to add all.")
                # Add all parsed nodes using index.insert_nodes()
                logger.warning(f"[add_note_vector] Attempting to add all {len(nodes)} nodes via index.insert_nodes()...")
                self.index.insert_nodes(nodes)
                logger.warning(f"[add_note_vector] self.index.insert_nodes(nodes) completed for multiple node case.")

            # --- Persistence logic removed --- 
            
            logger.info(f"[add_note_vector] Successfully processed vector for note ID: {note_id}")
            
        except Exception as e:
            logger.error(f"[add_note_vector] FAILED for note ID {note_id}: {e}", exc_info=True)
            raise

    def delete_note_vector(self, note_id: str) -> bool:
        """
        Deletes a note's vectors from the LlamaIndex vector store using metadata.
        
        Args:
            note_id: The unique identifier of the note to delete (PostgreSQL ID).
            
        Returns:
            True if deletion seemed successful, False otherwise.
        """
        try:
            logger.debug(f"Attempting to delete vector for note ID (via doc_id metadata): {note_id}")
            
            # Use delete_nodes with metadata filter (requires ChromaVectorStore support)
            # Note: This assumes the underlying vector store adapter supports metadata filtering on delete.
            # ChromaVectorStore might require direct interaction or a different LlamaIndex method.
            # Let's attempt direct Chroma deletion first as it's more reliable.
            
            # Direct Chroma Deletion
            try:
                collection = self.vector_store.collection # Get the underlying chromadb collection
                collection.delete(where={"doc_id": note_id})
                logger.info(f"Successfully triggered Chroma deletion for doc_id: {note_id}")
                return True
            except Exception as chroma_e:
                 logger.error(f"Direct Chroma deletion failed for doc_id {note_id}: {chroma_e}", exc_info=True)
                 # Fallback or raise depending on desired behavior
                 # Maybe try LlamaIndex method if direct fails?
                 # For now, let's report failure
                 return False

            # --- LlamaIndex delete_ref_doc is likely NOT suitable anymore ---
            # self.index.delete_ref_doc(note_id, delete_from_docstore=False) 
            # logger.info(f"Successfully triggered vector deletion for note ID: {note_id}")
            # return True

        except Exception as e:
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
            # --- ADD DETAILED LOGGING ---
            for i, node in enumerate(retrieved_nodes):
                logger.debug(f"Retrieved Node {i}:")
                logger.debug(f"  node.id_: {node.id_}")
                logger.debug(f"  node.ref_doc_id: {getattr(node, 'ref_doc_id', 'N/A')}") # Use getattr for safety
                logger.debug(f"  node.metadata: {node.metadata}")
            # --- END DETAILED LOGGING ---

            if not retrieved_nodes:
                return {"response": "Could not find relevant notes to answer the question.", "source_nodes": []}

            # 2. Fetch note content from PostgreSQL using retrieved IDs
            # --- MODIFIED: Extract ID from metadata --- 
            # note_ids = [node.node_id for node in retrieved_nodes] # OLD WAY
            note_ids = []
            source_nodes_metadata = []
            for node in retrieved_nodes:
                pg_id = node.metadata.get('doc_id')
                if pg_id:
                    note_ids.append(pg_id)
                    source_nodes_metadata.append({
                        "id": pg_id, # Use the extracted PG ID
                        "score": node.score,
                        # Add other metadata if needed, be careful not to overwrite
                    })
                else:
                    logger.warning(f"Retrieved node {node.id_} is missing 'doc_id' in metadata: {node.metadata}")
            # --- END MODIFIED --- 
            
            # source_nodes_metadata = [
            #     {"id": node.node_id, "score": node.score} for node in retrieved_nodes
            # ] # OLD WAY
            
            if not note_ids:
                 logger.warning("Could not extract any valid PostgreSQL Note IDs from retrieved nodes.")
                 return {"response": "Found potentially relevant information, but could not link it back to specific notes.", "source_nodes": []} # Return empty sources

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
            
            # --- ADD FINAL LOGGING --- 
            logger.debug(f"Final note_ids before return: {note_ids}")
            logger.debug(f"Final source_nodes_metadata before return: {source_nodes_metadata}")
            # --- END FINAL LOGGING --- 
            
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