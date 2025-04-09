# noteRAG: Web App, Chrome Extension & Backend

A web application, Chrome extension, and backend server allowing users to save notes and perform semantic search and question-answering on them using RAG technology.

## Features

**Core Backend & RAG:**
*   User Authentication (Email/Password, JWT)
*   Secure, user-specific note storage
*   Semantic search through notes (via LlamaIndex & OpenAI)
*   Question Answering based on note content (via LlamaIndex & OpenAI)
*   HTTPS support

**Web Client:**
*   Full-featured interface for managing notes (Add, View, Delete)
*   Dedicated Search and Ask AI interfaces
*   Google OAuth 2.0 Sign-in option

**Chrome Extension:**
*   Popup UI for quick access:
    *   Login/Logout
    *   View notes list
    *   Add new notes
    *   Search notes
    *   Ask AI questions
*   Context Menu integration:
    *   Right-click selected text on any webpage to add as a note (only appears when logged in)
    *   Notifications for success/failure

## Project Structure

```
noteRAG/
├── certs/               # SSL certificates for local HTTPS dev
├── chrome-extension/    # Chrome Extension Application
│   ├── dist/            # Bundled extension files (output)
│   ├── icons/           # Extension icons
│   ├── node_modules/    # Extension Node.js dependencies
│   ├── public/          # (Potentially, if needed for HTML pages)
│   ├── src/             # Extension source code (React, background script)
│   ├── manifest.json    # Extension manifest
│   ├── package.json     # Extension dependencies & scripts
│   └── webpack.config.js # Extension build configuration
├── data/                # Backend data storage (user indices, etc.) - Ignored by Git
├── docs/                # Additional documentation (OAuth Setup)
├── python_server/       # Backend FastAPI Application
│   ├── auth.py          # User auth, JWT, models
│   ├── main.py          # FastAPI app, API endpoints
│   ├── rag_core.py      # LlamaIndex/RAG logic
│   ├── requirements.txt # Python dependencies
│   ├── run.py           # Server run script (optional helper)
│   ├── static/          # Static files for backend
│   ├── storage/         # LlamaIndex storage - Ignored by Git
│   ├── templates/       # HTML templates for backend
│   └── venv/            # Python virtual environment - Ignored by Git
├── tests/
│   └── backend/         # Pytest tests for the backend
├── web-client/          # Frontend React Web Application
│   ├── build/           # Build output for web client - Ignored by Git
│   ├── node_modules/    # Web client Node.js dependencies
│   ├── public/          # Static assets (index.html, etc.)
│   ├── src/             # Web client source code (React)
│   ├── .env             # Web client environment variables
│   ├── package.json     # Web client dependencies & scripts
│   └── webpack.config.js # Web client build configuration
├── .env                 # Backend environment variables
├── .gitignore
├── README.md            # This file
└── LICENSE
```

## Prerequisites

*   **Python:** 3.10+ (with `pip` and `venv`)
*   **Node.js:** 18+ (with `npm`)
*   **OpenAI API Key:** For LlamaIndex search/query features.
*   **Google Client ID (Optional):** For Google OAuth Sign-in on the web client.

## Setup & Configuration

1.  **Clone Repository:**
    ```bash
    git clone <repository_url>
    cd noteRAG
    ```

2.  **Backend Setup:**
    *   Create and activate a Python virtual environment:
        ```bash
        python -m venv .venv # Or python3 -m venv .venv
        source .venv/bin/activate  # On Windows use `.venv\Scripts\activate`
        ```
    *   Install Python dependencies:
        ```bash
        pip install -r python_server/requirements.txt
        ```
    *   Create a `.env` file in the project root (`noteRAG/.env`) for the backend:
        ```env
        OPENAI_API_KEY="sk-YourOpenAiApiKey"
        SECRET_KEY="YourSecureRandomSecretKeyForJwt" # Generate a strong random key
        ```
        *(Replace placeholders with your actual keys. `SECRET_KEY` is crucial for security.)*

3.  **Web Client Setup:**
    *   Navigate to the web client directory:
        ```bash
        cd web-client
        ```
    *   Install Node.js dependencies:
        ```bash
        npm install
        ```
    *   Create a `.env` file in the `web-client` directory (`noteRAG/web-client/.env`):
        ```env
        REACT_APP_GOOGLE_CLIENT_ID="YourGoogleClientId.apps.googleusercontent.com" # Optional
        REACT_APP_API_URL="https://localhost:3443" # Adjust if backend runs elsewhere
        ```
        *(Replace placeholder with your actual Google Client ID if using Google Sign-in. See `docs/OAUTH_SETUP_GUIDE.md` if needed.)*

4.  **Chrome Extension Setup:**
    *   Navigate to the Chrome extension directory:
        ```bash
        cd chrome-extension
        ```
    *   Install Node.js dependencies:
        ```bash
        npm install
        ```
    *   Build the extension files:
        ```bash
        npm run build
        ```

5.  **HTTPS Setup (Local Development):**
    *   The backend server (`python_server/main.py` and helper `run.py`) expects SSL certificates for HTTPS.
    *   If you don't have `key.pem` and `cert.pem` in the root `certs/` directory, you can generate self-signed certificates:
        ```bash
        mkdir certs
        openssl req -x509 -newkey rsa:4096 -keyout certs/key.pem -out certs/cert.pem -sha256 -days 365 -nodes -subj "/CN=localhost"
        ```
    *   Your browser will likely show a warning for self-signed certificates; you'll need to manually accept the risk for `https://localhost:3443` when accessing the web client or when the extension communicates with the backend.

## Running the Application

1.  **Run Backend Server:**
    *   Make sure your Python virtual environment is active (`source .venv/bin/activate`).
    *   Navigate to the project root (`noteRAG/`).
    *   Run the server using Uvicorn:
        ```bash
        uvicorn python_server.main:app --reload --host 0.0.0.0 --port 3443 --ssl-keyfile ./certs/key.pem --ssl-certfile ./certs/cert.pem
        ```
        *(Alternatively, use `python python_server/run.py --ssl --port 3443` if preferred)*

2.  **Run Web Client Development Server:**
    *   Navigate to the `web-client` directory (`noteRAG/web-client/`).
    *   Start the React development server:
        ```bash
        npm start
        ```
    *   Open your browser and navigate to the URL provided (usually `http://localhost:3000`).

3.  **Load and Use the Chrome Extension:**
    *   Ensure you have built the extension (`cd chrome-extension && npm run build`).
    *   Open Chrome and go to `chrome://extensions/`.
    *   Enable "Developer mode" (usually a toggle in the top right).
    *   Click "Load unpacked".
    *   Navigate to and select the `noteRAG/chrome-extension` directory.
    *   The extension icon should appear in your toolbar (you might need to pin it).
    *   Click the icon to open the popup.
    *   Select text on any webpage and right-click to add notes (if logged in).

## Running Tests

1.  **Backend Tests:**
    *   Make sure your Python virtual environment is active.
    *   Navigate to the project root (`noteRAG/`).
    *   Run pytest:
        ```bash
        pytest tests/backend
        ```

2.  **Web Client Tests:**
    *   Navigate to the `web-client` directory.
    *   Run the test script:
        ```bash
        npm test
        ```
    *(Note: Chrome Extension tests are not currently implemented)*

## License

[MIT](LICENSE)

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

### HTTPS Support
The latest update adds secure HTTPS communication:
- End-to-end encryption for all data exchanged between extension and server
- Automatic fallback to HTTP for development environments
- Content Security Policy configured for secure connections
- Browser-based HTTPS connection testing tools
- For more details, see the [HTTPS documentation](docs/HTTPS.md)

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