# Semantic Notes Module

A module for managing notes with semantic search capabilities. This module is integrated into the main noteRAG application.

## Features

- Create and manage notes from the command line
- Search notes using keyword, semantic, or hybrid search
- Advanced semantic search powered by OpenAI embeddings and ChromaDB vector store
- Efficient storage and retrieval of vector embeddings

## Prerequisites

For full semantic search capabilities:
- An OpenAI API key for generating embeddings
- A running ChromaDB server (for vector similarity search)

If ChromaDB is not available, the system will fall back to simpler search methods.

## Usage

The module is integrated into the main noteRAG application. You can use it via:

```bash
npm run notes:add    # Add a new note
npm run notes:list   # List all notes
npm run notes:search # Search notes
npm run notes:get    # Get a note by ID
```

To test the advanced search capabilities:

```bash
npm run notes:test-search  # Run search tests with various queries
```

## Architecture

This module consists of several key components:

1. **Notes Service**: The main interface for managing notes (`/services/notes/index.js`)
2. **Storage Service**: Handles note persistence (`/services/notes/simple-storage.js`)
3. **Search Service**: Provides semantic search capabilities (`/services/notes/advanced-search.js`)
4. **Embeddings Service**: Generates high-quality vector embeddings (`/services/embeddings/openai-embeddings.js`)
5. **Vector Store**: ChromaDB-based vector database for efficient similarity search (`/services/vectordb/chroma-store.js`)
6. **CLI Interface**: Command-line interface for interacting with notes (`/cli.js`)

## Implementation Details

- The module uses OpenAI embeddings for high-quality semantic representations
- Notes are stored in a JSON file with embeddings in ChromaDB for efficient vector search
- ChromaDB requires a running server instance for vector operations
- The search implementations include keyword search, semantic search, and a hybrid approach that combines both
- Advanced ranking algorithms in the hybrid search ensure the most relevant results appear first
- Fallback mechanisms ensure basic functionality when components like ChromaDB are unavailable

## Configuration

The module uses configuration from the root `.env` file, with the following settings:

- `OPENAI_API_KEY`: Your OpenAI API key (required for semantic search)
- `NOTES_FILE_PATH`: Path to the JSON file storing notes
- `EMBEDDING_MODEL`: OpenAI embedding model (default: `text-embedding-3-small`)
- `MAX_RESULTS_PER_PAGE`: Maximum number of results per search query 

## Setting Up ChromaDB

To use the full semantic search capabilities:

1. Install ChromaDB:
```bash
pip install chromadb
```

2. Run the ChromaDB server:
```bash
chroma run --path ./src/semantic-notes/data/chromadb
```

This will start a local ChromaDB server that the notes module can connect to 