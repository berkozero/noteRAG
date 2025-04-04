"""
NoteRAG Core - LlamaIndex Wrapper

This module provides the core functionality for managing notes using LlamaIndex.
It handles storage, retrieval, and semantic search of notes.
"""
from typing import Dict, List, Optional, Any
from datetime import datetime
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

# Load environment variables from the root .env file
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
load_dotenv(env_path)
logging.basicConfig(level=logging.DEBUG)  # Set to DEBUG for more verbose output
logger = logging.getLogger(__name__)

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
    
    def __init__(self):
        """
        Initialize the NoteRAG system with LlamaIndex components.
        
        This constructor:
        - Sets up OpenAI LLM and embedding models
        - Configures global LlamaIndex settings
        - Initializes or loads existing vector index from disk
        - Creates necessary directories for persistence
        
        Raises:
            Various exceptions if initialization fails (particularly API key issues)
        """
        logger.debug(f"Initializing NoteRAG with env file from: {env_path}")
        logger.debug(f"OPENAI_API_KEY exists: {bool(os.getenv('OPENAI_API_KEY'))}")
        
        self.persist_dir = "data/index"
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
        
        self._init_index()

    def _init_index(self):
        """
        Initialize or load the vector index from disk.
        
        This function:
        - Checks if an existing index is stored on disk
        - Loads the existing index if found
        - Creates a new empty index if none exists
        - Ensures the persistence directory exists
        
        Raises:
            Various exceptions related to file I/O or index creation failures
        """
        try:
            # Ensure the directory exists
            os.makedirs(self.persist_dir, exist_ok=True)
            logger.debug(f"Ensured directory exists: {self.persist_dir}")
            
            if os.path.exists(os.path.join(self.persist_dir, "docstore.json")):
                logger.debug("Found existing index, loading...")
                # Load existing index
                storage_context = StorageContext.from_defaults(persist_dir=self.persist_dir)
                self.index = load_index_from_storage(storage_context)
                logger.info("Successfully loaded existing index")
            else:
                logger.debug("No existing index found, creating new one")
                # Create new storage context
                storage_context = StorageContext.from_defaults()
                # Create new empty index
                self.index = VectorStoreIndex([], storage_context=storage_context)
                # Persist immediately
                self.index.storage_context.persist(persist_dir=self.persist_dir)
                logger.info("Successfully created and persisted new index")
                
        except Exception as e:
            logger.error(f"Error initializing index: {str(e)}")
            logger.error(f"Error type: {type(e)}")
            raise

    def add_note(self, text: str, title: str, timestamp: int) -> Dict:
        """
        Add a note to the index using LlamaIndex's document and node structure.
        
        Args:
            text: The main content of the note
            title: The title of the note
            timestamp: Unix timestamp for the note creation time
            
        Returns:
            Dictionary with note details (id, title, text, timestamp)
            
        Raises:
            Various exceptions related to document creation or index insertion errors
        """
        try:
            logger.debug(f"Adding note - Title: {title}, Timestamp: {timestamp}")
            logger.debug(f"Text length: {len(text)} characters")
            
            # DEDUPLICATION: Check for existing notes with similar content in the last 10 seconds
            # This prevents duplicate notes that might be created by multiple API calls
            try:
                all_notes = self.get_all_notes()
                for note in all_notes:
                    # Compare text content and check if creation time is close (within 10 seconds)
                    content_match = note.get("text") == text
                    time_close = abs(note.get("timestamp", 0) - timestamp) < 10000  # 10 seconds
                    
                    if content_match and time_close:
                        logger.info(f"Found duplicate note with similar content created within 10s window: {note['id']}")
                        return note  # Return existing note instead of creating duplicate
            except Exception as dedup_err:
                # Don't fail if deduplication check has an error
                logger.warning(f"Deduplication check failed: {str(dedup_err)}")
            
            # Create metadata for the note
            metadata = {
                "title": title,
                "timestamp": timestamp,
                "created_at": datetime.utcnow().isoformat()
            }
            logger.debug(f"Created metadata: {json.dumps(metadata)}")
            
            # Generate a unique ID for the note using timestamp and random suffix
            note_id = f"note_{timestamp}_{str(uuid.uuid4())[:8]}"
            logger.debug(f"Generated unique ID: {note_id}")
            
            # Create a Document with metadata
            document = Document(
                text=text,
                metadata=metadata,
                id_=note_id
            )
            logger.debug(f"Created Document with ID: {document.id_}")
            
            # Insert the document into the index
            logger.debug("Inserting document into index...")
            self.index.insert(document)
            
            logger.debug("Persisting storage context...")
            self.index.storage_context.persist(persist_dir=self.persist_dir)
            
            logger.info(f"Successfully added note with ID: {document.id_}")
            return {
                "id": document.id_,
                "title": title,
                "text": text,
                "timestamp": timestamp
            }
        except Exception as e:
            logger.error(f"Error adding note: {str(e)}")
            logger.error(f"Error type: {type(e)}")
            raise

    def get_note(self, note_id: str) -> Optional[Dict]:
        """
        Retrieve a specific note using LlamaIndex's docstore.
        
        Args:
            note_id: The unique identifier of the note to retrieve
            
        Returns:
            Dictionary with note details if found, None otherwise
        """
        try:
            logger.debug(f"Retrieving note with ID: {note_id}")
            node = self.index.docstore.get_node(note_id)
            if node:
                logger.debug(f"Found note: {node.id_}")
                return {
                    "id": node.id_,
                    "title": node.metadata.get("title"),
                    "text": node.text,
                    "timestamp": node.metadata.get("timestamp")
                }
            logger.debug(f"Note not found with ID: {note_id}")
            return None
        except Exception as e:
            logger.error(f"Error retrieving note: {str(e)}")
            logger.error(f"Error type: {type(e)}")
            return None

    def get_all_notes(self) -> List[Dict[str, Any]]:
        """
        Get all notes from the index.
        
        Returns:
            List of dictionaries containing note details, sorted by timestamp (newest first)
            
        Note:
            This function extracts notes from the docstore's ref_doc_info
            It handles cases where the docstore might not be available
        """
        try:
            logger.debug("Getting all notes from the index")
            notes = []
            
            # Check if docstore exists in the index
            if hasattr(self.index, 'docstore') and self.index.docstore:
                # Debug the structure of the docstore
                logger.debug(f"Docstore type: {type(self.index.docstore)}")
                logger.debug(f"Docstore attributes: {dir(self.index.docstore)}")
                
                # For extensive debugging
                if hasattr(self.index.docstore, '_kvstore'):
                    kvstore = self.index.docstore._kvstore
                    logger.debug(f"KVStore type: {type(kvstore)}")
                    logger.debug(f"KVStore attributes: {dir(kvstore)}")
                    
                    # Dump the entire _data of kvstore
                    if hasattr(kvstore, '_data'):
                        logger.debug("KVStore _data keys: " + str(list(kvstore._data.keys())))
                        
                        # Check all keys in _data
                        for key in kvstore._data.keys():
                            logger.debug(f"Key: {key}")
                            if key == "docstore/ref_doc_info":
                                ref_doc_info = kvstore._data[key]
                                logger.debug(f"ref_doc_info keys: {list(ref_doc_info.keys())}")
                                
                                # Process each note document
                                for doc_id, doc_info in ref_doc_info.items():
                                    if doc_id.startswith("note_"):
                                        logger.debug(f"Processing note: {doc_id}")
                                        logger.debug(f"Doc info: {doc_info}")
                                        
                                        # Get metadata
                                        metadata = {}
                                        if hasattr(doc_info, 'metadata'):
                                            metadata = doc_info.metadata or {}
                                        elif isinstance(doc_info, dict) and 'metadata' in doc_info:
                                            metadata = doc_info['metadata'] or {}
                                        logger.debug(f"Extracted metadata: {metadata}")
                                        
                                        # Get node ids
                                        node_ids = []
                                        if hasattr(doc_info, 'node_ids'):
                                            node_ids = doc_info.node_ids or []
                                        elif isinstance(doc_info, dict) and 'node_ids' in doc_info:
                                            node_ids = doc_info['node_ids'] or []
                                        logger.debug(f"Node IDs: {node_ids}")
                                        
                                        # Try to get text content
                                        text = ""
                                        if node_ids and len(node_ids) > 0:
                                            node_id = node_ids[0]
                                            logger.debug(f"Looking for node with ID: {node_id}")
                                            
                                            # Try to find node in docstore/data
                                            if "docstore/data" in kvstore._data:
                                                node_data = kvstore._data["docstore/data"].get(node_id)
                                                if node_data:
                                                    logger.debug(f"Found node data: {node_data}")
                                                    if hasattr(node_data, '__data__'):
                                                        node_data = node_data.__data__
                                                    elif isinstance(node_data, dict) and '__data__' in node_data:
                                                        node_data = node_data['__data__']
                                                    
                                                    if isinstance(node_data, dict) and 'text' in node_data:
                                                        text = node_data['text']
                                                    elif hasattr(node_data, 'text'):
                                                        text = node_data.text
                                                    logger.debug(f"Extracted text: {text}")
                                        
                                        # Create note entry
                                        notes.append({
                                            "id": doc_id,
                                            "text": text,
                                            "title": metadata.get("title", ""),
                                            "url": metadata.get("url", ""),
                                            "timestamp": metadata.get("timestamp", 0),
                                            "isHtml": metadata.get("isHtml", False)
                                        })
                                
                                logger.debug(f"Processed {len(notes)} notes")
                            
                            # Check docstore/data for direct document access
                            elif key == "docstore/data":
                                data = kvstore._data[key]
                                logger.debug(f"docstore/data has {len(data)} entries")
                                
                # Try one more approach: direct access to docstore.docs
                if hasattr(self.index.docstore, 'docs'):
                    docs = self.index.docstore.docs
                    logger.debug(f"Direct docstore.docs access: {len(docs)} documents")
                    if not notes:  # Only use this approach if we haven't found notes yet
                        for doc_id, doc in docs.items():
                            if doc_id.startswith("note_"):
                                logger.debug(f"Processing doc from docs: {doc_id}")
                                metadata = getattr(doc, "metadata", {}) or {}
                                notes.append({
                                    "id": doc_id,
                                    "text": getattr(doc, "text", ""),
                                    "title": metadata.get("title", ""),
                                    "url": metadata.get("url", ""),
                                    "timestamp": metadata.get("timestamp", 0),
                                    "isHtml": metadata.get("isHtml", False)
                                })
                
                return sorted(notes, key=lambda x: x["timestamp"], reverse=True)
            else:
                logger.warning("No docstore available in the index")
                return []
        except Exception as e:
            logger.error(f"Error getting all notes: {e}")
            logger.exception(e)
            return []

    def delete_note(self, note_id: str) -> bool:
        """
        Delete a note from all LlamaIndex storage components.
        
        Args:
            note_id: The unique identifier of the note to delete
            
        Returns:
            Boolean indicating success (True) or failure (False)
            
        Note:
            This function removes the note from both docstore and vector store
            Changes are persisted to disk after deletion
        """
        try:
            logger.debug(f"Attempting to delete note with ID: {note_id}")
            
            # Check if docstore exists and has the kvstore
            if not hasattr(self.index, 'docstore') or not self.index.docstore:
                logger.warning("No docstore available")
                return False
                
            # First check if the note exists in ref_doc_info
            if hasattr(self.index.docstore, '_kvstore') and hasattr(self.index.docstore._kvstore, '_data'):
                kvstore = self.index.docstore._kvstore
                
                # Check in docstore/ref_doc_info
                if 'docstore/ref_doc_info' in kvstore._data:
                    ref_doc_info = kvstore._data['docstore/ref_doc_info']
                    if note_id not in ref_doc_info:
                        logger.debug(f"Note with ID {note_id} not found in ref_doc_info")
                        return False
                    
                    # Get the node IDs associated with this note
                    doc_info = ref_doc_info[note_id]
                    node_ids = []
                    if hasattr(doc_info, 'node_ids'):
                        node_ids = doc_info.node_ids
                    elif isinstance(doc_info, dict) and 'node_ids' in doc_info:
                        node_ids = doc_info['node_ids']
                    
                    logger.debug(f"Found note with node IDs: {node_ids}")
                    
                    # Delete all nodes from docstore/data
                    if 'docstore/data' in kvstore._data:
                        for node_id in node_ids:
                            if node_id in kvstore._data['docstore/data']:
                                del kvstore._data['docstore/data'][node_id]
                                logger.debug(f"Deleted node {node_id} from docstore/data")
                    
                    # Delete the ref doc info
                    del kvstore._data['docstore/ref_doc_info'][note_id]
                    logger.debug(f"Deleted {note_id} from ref_doc_info")
                    
                    # Delete metadata
                    if 'docstore/metadata' in kvstore._data and note_id in kvstore._data['docstore/metadata']:
                        del kvstore._data['docstore/metadata'][note_id]
                        logger.debug(f"Deleted {note_id} from metadata")
                    
                    # Persist changes to disk
                    self.index.storage_context.persist(persist_dir=self.persist_dir)
                    logger.info(f"Successfully deleted note: {note_id}")
                    return True
            
            logger.warning(f"Could not delete note {note_id}: DocStore structure not as expected")
            return False
            
        except Exception as e:
            logger.error(f"Failed to delete note: {str(e)}")
            logger.error(f"Error type: {type(e)}")
            return False

    def search_notes(self, query: str, limit: int = 5) -> List[Dict]:
        """
        Search notes using LlamaIndex's hybrid search.
        
        Args:
            query: The search query string
            limit: Maximum number of results to return (default: 5)
            
        Returns:
            List of dictionaries containing note details, sorted by relevance
            
        Note:
            This function uses semantic search to find notes based on meaning, not just keywords
            It leverages the underlying vector embeddings for retrieval
        """
        try:
            logger.debug(f"Searching notes with query: {query}, limit: {limit}")
            
            # Get all notes first
            all_notes = self.get_all_notes()
            logger.debug(f"Found {len(all_notes)} total notes to search through")
            
            if not all_notes:
                logger.debug("No notes to search through")
                return []
                
            # For each note, compute similarity with the query
            # Here we use a simpler approach that doesn't require as_retriever
            # If there are only a few notes, we'll just compare them all
            results = []
            
            # Create embeddings for the query
            from llama_index.embeddings.openai import OpenAIEmbedding
            embed_model = OpenAIEmbedding(model="text-embedding-3-small")
            
            try:
                # Get query embedding
                query_embedding = embed_model.get_text_embedding(query)
                logger.debug(f"Generated query embedding (dim: {len(query_embedding)})")
                
                # For each note, compute similarity if it has an embedding
                for note in all_notes:
                    note_id = note["id"]
                    note_text = note["text"]
                    
                    # Get embedding for the note text
                    note_embedding = embed_model.get_text_embedding(note_text)
                    logger.debug(f"Generated embedding for note {note_id}")
                    
                    # Compute cosine similarity
                    import numpy as np
                    from numpy.linalg import norm
                    
                    # Convert to numpy arrays
                    query_embedding_np = np.array(query_embedding)
                    note_embedding_np = np.array(note_embedding)
                    
                    # Compute cosine similarity
                    similarity = np.dot(query_embedding_np, note_embedding_np) / (norm(query_embedding_np) * norm(note_embedding_np))
                    
                    # Add to results
                    note_with_score = note.copy()
                    note_with_score["score"] = float(similarity)
                    results.append(note_with_score)
                    
                # Sort by similarity score (highest first)
                results = sorted(results, key=lambda x: x["score"], reverse=True)
                
                # Return top k results
                return results[:limit]
                
            except Exception as e:
                logger.error(f"Error computing embeddings: {e}")
                logger.exception(e)
                # Fall back to simple keyword matching
                logger.debug("Falling back to keyword matching")
                for note in all_notes:
                    if query.lower() in note["text"].lower() or query.lower() in note.get("title", "").lower():
                        results.append(note)
                return results[:limit]
                
        except Exception as e:
            logger.error(f"Error searching notes: {e}")
            logger.exception(e)
            return []

    def query_notes(self, query: str, top_k: int = 3) -> Dict:
        """
        Answer questions about notes using LlamaIndex's query engine.
        
        Args:
            query: The question to answer
            top_k: Maximum number of documents to retrieve for context (default: 3)
            
        Returns:
            Dictionary containing the answer and relevant context
            
        Note:
            This function uses LlamaIndex's query engine to answer questions about the content
            It retrieves the most relevant documents first, then uses them as context for the LLM
        """
        try:
            logger.debug(f"Querying notes with question: {query}, top_k: {top_k}")
            
            # First check if there are any notes
            all_notes = self.get_all_notes()
            if not all_notes:
                logger.debug("No notes to query")
                return {
                    "answer": "I don't have any notes to answer questions about.",
                    "sources": []
                }
            
            # Create a list of documents from the notes
            from llama_index.core import Document
            documents = []
            for note in all_notes:
                doc = Document(
                    text=note["text"],
                    metadata={
                        "id": note["id"],
                        "title": note.get("title", ""),
                        "timestamp": note.get("timestamp", 0)
                    }
                )
                documents.append(doc)
            
            # Create a new index for querying
            from llama_index.core import VectorStoreIndex
            query_index = VectorStoreIndex.from_documents(documents)
            
            # Create a query engine with citation support
            query_engine = query_index.as_query_engine(
                similarity_top_k=top_k,
                response_mode="compact"
            )
            
            # Query the index
            response = query_engine.query(query)
            
            # Extract source nodes
            source_nodes = response.source_nodes
            sources = []
            
            for node in source_nodes:
                source = {
                    "id": node.node.metadata.get("id"),
                    "title": node.node.metadata.get("title", ""),
                    "text": node.node.text,
                    "timestamp": node.node.metadata.get("timestamp", 0),
                    "score": float(node.score) if hasattr(node, "score") and node.score is not None else 0.0
                }
                sources.append(source)
            
            # Return formatted response
            return {
                "answer": str(response),
                "sources": sources
            }
            
        except Exception as e:
            logger.error(f"Error querying notes: {e}")
            logger.exception(e)
            return {
                "answer": f"An error occurred while trying to answer your question: {str(e)}",
                "sources": []
            }

    def update_embeddings(self, note) -> bool:
        """
        Update embeddings for an existing note without creating a duplicate.
        
        Args:
            note: Note object containing id, text, title and timestamp
            
        Returns:
            Boolean indicating success (True) or failure (False)
            
        Note:
            This function only updates the embeddings for an existing note
            without creating a new note entry
        """
        try:
            logger.debug(f"Updating embeddings for note ID: {note.id}")
            
            # First check if the note exists
            existing_note = self.get_note(note.id)
            if not existing_note:
                logger.warning(f"Note with ID {note.id} not found, cannot update embeddings")
                return False
            
            # Create metadata for the note
            metadata = {
                "title": note.title,
                "timestamp": note.timestamp,
                "updated_at": datetime.utcnow().isoformat()
            }
            
            # Create a Document with the same ID as the existing note
            document = Document(
                text=note.text,
                metadata=metadata,
                id_=note.id
            )
            
            # Update the document in the index
            # We remove and then re-insert to ensure embeddings are regenerated
            if hasattr(self.index, 'delete') and callable(self.index.delete):
                logger.debug(f"Removing document with ID: {note.id}")
                self.index.delete(note.id)
            
            logger.debug("Inserting updated document into index...")
            self.index.insert(document)
            
            logger.debug("Persisting storage context...")
            self.index.storage_context.persist(persist_dir=self.persist_dir)
            
            logger.info(f"Successfully updated embeddings for note with ID: {note.id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to update embeddings: {str(e)}")
            logger.error(f"Error type: {type(e)}")
            return False 