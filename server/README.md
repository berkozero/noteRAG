# NoteRAG Server

Semantic search server for NoteRAG that uses LangChain vector store and ChromaDB.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file with your API keys (see `.env.example`).

## ChromaDB Integration

NoteRAG uses ChromaDB for persistent vector storage. Here's how to use it:

### Prerequisites
- Docker installed and running on your machine

### Start ChromaDB

Start ChromaDB using Docker:
```bash
npm run chromadb
```

This will start ChromaDB in a Docker container, listening on port 8000.

### Stop ChromaDB

Stop the running ChromaDB container:
```bash
npm run chromadb:stop
```

### Start Server with ChromaDB

To start both ChromaDB and the NoteRAG server together:
```bash
npm run start:with-chromadb
```

For development with hot reload:
```bash
npm run dev:with-chromadb
```

### Fallback Mode

If ChromaDB is not available, the server will automatically fall back to an in-memory vector store with file persistence.

## Running the Server

Without ChromaDB (using in-memory store):
```bash
npm start
```

For development with hot reload:
```bash
npm run dev
```

## API Endpoints

- `GET /api/search?q=query` - Search for notes with semantic similarity
- `POST /api/embeddings` - Generate embeddings for a note
- `GET /admin` - Admin dashboard for testing search

## Architecture

The server is built with a modular architecture:

- `src/index.js` - Main server entry point
- `src/routes/` - API route handlers
- `src/utils/vector-store/` - Modular vector store implementation
  - `store-init.js` - Store initialization
  - `document-operations.js` - Document operations
  - `search-operations.js` - Search functionality
  - `llm-utils.js` - LLM-related utilities 