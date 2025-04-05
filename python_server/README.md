# NoteRAG Server

A simplified and efficient note-taking server with semantic search capabilities using LlamaIndex.

## Architecture

The server is built with a clean, modular architecture:

1. `core.py` - Core LlamaIndex wrapper that handles all note operations and vector storage
2. `server.py` - Minimal FastAPI server that exposes the core functionality via HTTP endpoints
3. `main.py` - Entry point with all API route implementations

## How Notes Are Stored

Notes in NoteRAG are stored using LlamaIndex's document and vector storage system:

1. **In-Memory Structure**:
   - Each note is represented as a `Document` object with text content and metadata
   - Notes are assigned a unique ID in the format `note_{timestamp}`
   - The core index maintains references between documents and their vector embeddings

2. **On-Disk Persistence**:
   - All data is persisted in the `data/index/` directory
   - `docstore.json` - Contains all note text content and metadata
   - `default__vector_store.json` - Stores vector embeddings for semantic search
   - `index_store.json` - Maintains index structure information

3. **Storage Format**:
   - Notes are stored in a nested JSON structure
   - Each note has both a document reference and node references
   - Metadata (title, timestamp, URL) is preserved alongside the content
   - Vector embeddings are generated using OpenAI's embedding models

## Setup

1. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Create a `.env` file with your OpenAI API key:
```
OPENAI_API_KEY=your_key_here
```

4. Run the server (HTTP mode):
```bash
python -m uvicorn main:app --host 0.0.0.0 --port 3000
```

5. Run the server with HTTPS (secure mode):
```bash
# First, generate SSL certificates if you don't have them
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes

# Then run the server with SSL enabled
python -m uvicorn main:app --host 0.0.0.0 --port 3443 --ssl-keyfile key.pem --ssl-certfile cert.pem
```

Alternatively, use the server manager script:
```bash
# Start in HTTP mode
python server_manager.py start

# Start in HTTPS mode
python server_manager.py start --https
```

## API Endpoints

- `POST /api/notes` - Add a new note
  - Body: `{"id": "auto", "text": "Note content", "title": "Note Title", "timestamp": 1234567890000}`
  - Returns: `{"status": "success", "id": "note_1234567890000"}`

- `GET /api/notes` - Get all notes
  - Returns an array of all notes, sorted by timestamp (newest first)

- `GET /api/notes/{note_id}` - Get a specific note by ID
  - Returns a single note object matching the ID

- `DELETE /api/notes/{note_id}` - Delete a note by ID
  - Returns `{"status": "success"}`

- `GET /api/search?query=text&limit=5` - Search notes by semantic similarity
  - Query parameters:
    - `query`: Text to search for
    - `limit`: Maximum number of results (default: 5)
  - Returns an array of matching notes ordered by relevance

- `GET /api/query?q=question&top_k=3` - Answer questions about your notes (NEW)
  - Query parameters:
    - `q`: The question to answer
    - `top_k`: Number of notes to use as context (default: 3)
  - Returns `{"answer": "Generated answer text", "sources": [array of source notes]}`

- `POST /api/embeddings` - Legacy endpoint for Chrome extension compatibility
  - Alternative note creation endpoint that handles a different request format

- `GET /health` - Server health check endpoint
  - Returns `{"status": "ok"}`

## Semantic Search Implementation

NoteRAG uses a custom semantic search implementation:

1. **Embedding Generation**:
   - Uses OpenAI's text-embedding-3-small model to generate embeddings
   - Both query text and note content are converted to the same vector space
   
2. **Similarity Computation**:
   - Cosine similarity is calculated between the query embedding and each note's embedding
   - This measures the semantic similarity between concepts, not just keyword matching
   
3. **Results Ranking**:
   - Notes are ranked by similarity score (highest first)
   - Each result includes a score indicating relevance to the query
   
4. **Fallback Mechanism**:
   - If embedding generation fails, the system falls back to keyword matching
   - This ensures search keeps working even if the OpenAI API is unavailable

This approach allows finding conceptually related notes even when they don't contain the exact search terms (e.g., searching "crypto" will find notes about "blockchain").

## Admin Panel Features

The NoteRAG server includes an admin panel accessible at `/admin` that provides:

1. **Note Management**:
   - View all stored notes in a clean, organized interface
   - Delete notes directly from the admin panel
   - See note metadata including timestamps and IDs

2. **Search Capabilities**:
   - Perform semantic searches from the admin interface
   - See relevance scores for search results

3. **Question Answering** (NEW):
   - Ask natural language questions about your notes
   - View AI-generated answers based on note content
   - See the source notes used to generate each answer
   - Control how many notes to use as context for answers

## Deduplication System (NEW)

NoteRAG now implements a sophisticated deduplication system to prevent duplicate notes:

1. **Content Matching**:
   - When a new note is added, its content is compared with existing notes
   - Notes with identical content are detected and prevented from being duplicated

2. **Time Window Filtering**:
   - The system detects multiple saves of the same content within a 10-second window
   - This prevents duplicate notes from being created by multiple API calls

3. **Consistent ID Formatting**:
   - The system normalizes note IDs across different components
   - Handles both hyphenated and underscore formats for consistent operations

This deduplication happens transparently to the user and significantly improves the quality of the note collection by eliminating redundancy.

## Troubleshooting

### Common Issues:

1. **Import Errors with LlamaIndex**:
   - Ensure you've installed the exact versions in requirements.txt
   - The project uses modular packages (llama-index-core, llama-index-embeddings-openai, etc.)

2. **Notes Not Showing in Admin Panel**:
   - Check that notes were properly saved in the docstore.json file
   - Verify the get_all_notes method is correctly accessing the document structure

3. **Search Not Working**:
   - Confirm your OpenAI API key is valid and has sufficient quota
   - Check logs for any embedding generation errors
   - The search implementation uses direct embedding comparison and doesn't rely on index.as_retriever()

4. **Delete Issues**:
   - The delete operation directly manipulates the underlying key-value store
   - If deletions fail, check docstore.json structure for any changes in the LlamaIndex format

## Chrome Extension Integration

The server is designed to work with a companion Chrome extension that allows for:

1. Saving web page content as notes
2. Adding custom notes while browsing
3. Searching your knowledge base from the browser

## Performance Considerations

- For large collections of notes (>1000), consider implementing pagination
- The current search implementation re-computes embeddings on each request rather than caching them
- When using in production, consider setting up proper authentication and HTTPS

## HTTPS Support

The server now includes full HTTPS support:

1. **SSL Configuration**:
   - Run the server with SSL certificates for secure communication
   - All data between client and server is encrypted in transit
   - Default HTTPS port is 3443

2. **Certificate Management**:
   - For development, use self-signed certificates (instructions above)
   - For production, use certificates from a trusted Certificate Authority

3. **Starting with HTTPS**:
   - Use the `--ssl` flag with the server script
   - OR use `server_manager.py start --https` for automatic certificate handling

4. **Client Support**:
   - The Chrome extension is configured to connect via HTTPS by default
   - Automatic fallback to HTTP if HTTPS is unavailable
   - Proper error handling for certificate issues

When using self-signed certificates with the Chrome extension, you may need to:
1. Visit `https://localhost:3443` directly in Chrome and accept the certificate
2. Enable `chrome://flags/#allow-insecure-localhost` for local development

## Features

- Direct integration with LlamaIndex for efficient vector storage and retrieval
- Persistent storage of notes and embeddings
- Semantic search capabilities
- Clean and maintainable codebase
- Backward compatibility with existing Chrome extension 