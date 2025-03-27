# noteRAG Chrome Extension

A Chrome extension that allows users to save and search through web notes using RAG technology.

## Features

- Google Authentication
- Save selected text from any webpage
- Search through saved notes
- User profile display
- Persistent storage

## Installation

1. Clone the repository:

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable "Developer mode" in the top right

4. Click "Load unpacked" and select the extension directory

## Usage

1. Sign in with your Google account
2. Select any text on a webpage
3. Right-click and choose "Save to noteRAG"
4. Access your notes by clicking the extension icon

## Project Structure

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