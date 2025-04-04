# noteRAG Chrome Extension

A Chrome extension that allows users to save and search through web notes using RAG technology.

## Features

- Google Authentication
- Save selected text from any webpage
- Search through saved notes
- Ask questions about your saved notes
- User profile display
- Persistent storage
- Intelligent deduplication system
- Backend as Source of Truth implementation
- Server-side ID generation

## Installation

1. Clone the repository:

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable "Developer mode" in the top right

4. Click "Load unpacked" and select the extension directory

## Running the Extension

1. Start the Python server:
   ```
   cd python_server
   python run.py
   ```

2. Build the Chrome extension:
   ```
   npm run build
   ```

3. Load the extension in Chrome from the `dist` directory

4. Sign in with your Google account

5. Select any text on a webpage, right-click and choose "Save to noteRAG"

## Project Structure

The project is organized as follows:

- `/src`: Frontend Chrome extension code
  - `/pages`: Different UI pages (popup, background)
  - `/services`: Core services (notes, authentication)
  - `/utils`: Utility functions
- `/python_server`: Backend RAG server
  - `core.py`: Main NoteRAG implementation
  - `main.py`: FastAPI server
  - `server.py`: Alternative implementation
- `/tests`: Test scripts and manual testing utilities

## Implementation Details

### Backend as Source of Truth (Step 1)

We've implemented a robust Backend as Source of Truth architecture where:
- The Python server is the authoritative source for all notes
- Server generates unique IDs for notes (not the client)
- Local storage is used as a cache, not the primary data store
- API client handles server communication with proper error handling
- Tests verify the functionality works as expected

### Testing

The extension includes automated tests:
- Unit tests for the API client
- Unit tests for the notes service
- Manual test script for end-to-end verification

Run the tests with:
```
npm test
npm run test:manual
```

## Next Steps

### Frontend Cache with TTL (Step 2)

Our next step is implementing a frontend cache with TTL (Time-To-Live):
- Add cache expiration to avoid stale data
- Implement cache invalidation strategy
- Add background sync to refresh cache periodically
- Handle network failures gracefully

### Potential Future Improvements

#### Step 3: Offline-First Architecture
- Implement full offline support with:
  - IndexedDB for persistent storage
  - Background sync when reconnecting
  - Conflict resolution strategies
  - Optimistic UI updates

#### Step 4: Real-time Updates
- Add WebSocket or Server-Sent Events for real-time sync
- Implement collaborative features
- Push notifications for important changes

#### Step 5: Performance Optimization
- Lazy loading of notes
- Virtualized lists for large datasets
- Incremental cache updates
- Bundle size optimization

#### Step 6: Advanced Search Features
- Faceted search interface
- Filter by date, source, topic
- Saved searches
- Advanced query syntax

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License

[MIT](https://choosealicense.com/licenses/mit/)

## Semantic Notes Module

This project includes a Semantic Notes module that allows you to create, manage, and search notes using AI-powered semantic search.

### Features

- Create and manage notes from the command line
- Search notes using keyword, semantic, or hybrid search
- Advanced semantic search capabilities using OpenAI embeddings and ChromaDB
- Efficient storage and retrieval of vector embeddings

### Prerequisites

For full semantic search capabilities:
- An OpenAI API key for generating embeddings
- A running ChromaDB server (for vector similarity search)

If ChromaDB is not available, the system will fall back to simpler search methods.

### Using the Notes CLI

The following commands are available:

```bash
# Add a new note
npm run notes:add

# List all notes
npm run notes:list

# Search notes
npm run notes:search "your search query"

# Get a note by ID
npm run notes:get <id>

# Test search capabilities
npm run notes:test-search
```

For complete details and setup instructions, see the [Semantic Notes README](src/semantic-notes/README.md).

## Recent Updates

### Enhanced Search Interface
The latest update improves the search experience with:
- Relevance scores shown for search results (displays match percentage)
- Results sorted by relevance during search operations
- Better visual distinction between search results and regular notes

### Improved Q&A Interface
The Q&A interface has been redesigned for better usability:
- "Ask" button relocated next to the noteRAG heading for better visibility
- Full-page mode that maintains app context (user profile and logout remain visible)
- Improved styling for buttons and interface elements
- Clearer navigation between search and ask modes

### Backend as Source of Truth
The latest update implements a robust Backend as Source of Truth pattern:
- Python server generates and manages all note IDs
- Client sends only necessary data (text, title, timestamp) when creating notes
- Server-side validation ensures data integrity
- Proper error handling for network issues
- Extension works offline with local cache when server is unavailable

### Question-Answering Capability
The extension features an AI-powered question-answering system that allows you to ask natural language questions about your saved notes. Unlike basic search, this system:

- Understands the semantic meaning of your questions
- Retrieves the most relevant notes as context
- Generates comprehensive answers based on the content of your notes
- Shows source notes used to generate the answer

Example queries:
- "Who raised $400 million?"
- "What investments has Lightspeed made?"
- "What are the latest AI developments?"

### Intelligent Deduplication
The system includes robust deduplication to prevent duplicate notes:

- Content-based detection prevents the same text from being saved multiple times
- Time-window filtering prevents rapid successive saves of the same content
- Client-side request caching reduces unnecessary API calls
- Standardized note ID formatting across components