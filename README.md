# noteRAG: Web App, Chrome Extension & Backend

A web application, Chrome extension, and backend server allowing users to save notes and perform semantic search and question-answering on them using RAG technology.

## Features

**Core Backend & RAG:**
*   User Authentication (Email/Password, JWT)
*   Secure, user-specific note storage **(using PostgreSQL for primary data)**
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
├── data/                # OBSOLETE? (User data now in DB, LlamaIndex in python_server/storage)
├── docs/                # Additional documentation (OAuth Setup)
├── python_server/       # Backend FastAPI Application
│   ├── alembic/         # Alembic database migration scripts
│   ├── auth.py          # User auth, JWT, models
│   ├── database.py      # SQLAlchemy database setup
│   ├── main.py          # FastAPI app, API endpoints
│   ├── models.py        # SQLAlchemy database models (e.g., Note)
│   ├── rag_core.py      # LlamaIndex/RAG logic
│   ├── requirements.txt # Python dependencies
│   ├── run.py           # Server run script (optional helper)
│   ├── storage/         # LlamaIndex vector/index storage - Ignored by Git
│   ├── static/          # Static files for backend
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
├── .env                 # Backend environment variables (for dev)
├── .env.example         # Example backend environment variables
├── .env.test            # Test environment variables (for pytest)
├── .gitignore
├── alembic.ini          # Alembic configuration file
├── README.md            # This file
└── LICENSE
```

## Architecture Overview (Simplified)

*   **Frontend (Web Client / Chrome Extension):** React applications providing the user interface.
*   **Backend (FastAPI):** Handles API requests, user authentication, and orchestrates operations.
*   **Database (PostgreSQL):** Stores primary user and note data (text, titles, metadata).
*   **Vector Index (LlamaIndex):** Manages vector embeddings (derived from note text) for semantic search and RAG. Uses `python_server/storage/` for persistence (soon to be replaced by ChromaDB).
*   **AI Models (OpenAI):** Used by LlamaIndex to generate embeddings and answer questions.

## Prerequisites

*   **Python:** 3.10+ (with `pip` and `venv`)
*   **Node.js:** 18+ (with `npm`)
*   **PostgreSQL:** A running PostgreSQL server (version 12+ recommended). Docker setup included below.
*   **OpenAI API Key:** For LlamaIndex search/query features.
*   **(Optional) Google Client ID:** For Google OAuth Sign-in on the web client.
*   **(Optional) Docker & Docker Compose:** Recommended for running PostgreSQL easily.

## Setup & Configuration

1.  **Clone Repository:**
    ```bash
    git clone <repository_url>
    cd noteRAG
    ```

2.  **Backend Setup:**
    *   **(Option A - Recommended) Setup PostgreSQL via Docker:**
        *   Ensure Docker is installed and running.
        *   Run the PostgreSQL container (creates dev DB `noterag_db` and test DB `noterag_test_db`):
            ```bash
            # Choose a secure password and update .env and .env.test files accordingly!
            export POSTGRES_PASSWORD=\"mysecretpassword\" 
            docker run --name noterag-postgres -e POSTGRES_PASSWORD=$POSTGRES_PASSWORD -e POSTGRES_DB=noterag_db -p 5432:5432 -d postgres:15
            # Wait a few seconds for the DB to initialize...
            sleep 5 
            docker exec -it noterag-postgres psql -U postgres -c \"CREATE DATABASE noterag_test_db;\"
            ```
    *   **(Option B) Setup PostgreSQL Manually:** Install PostgreSQL, ensure it's running, and create the databases `noterag_db` and `noterag_test_db`.
    *   **Create Environment Files:**
        *   Copy `.env.example` to `.env`.
        *   Create an empty `.env.test` file.
    *   **Configure `.env`:** Edit `.env` and set:
        *   `OPENAI_API_KEY`: Your key.
        *   `SECRET_KEY`: A strong random string (e.g., `openssl rand -hex 32`).
        *   `DATABASE_URL`: Your connection string for the **development** database (e.g., `postgresql://postgres:mysecretpassword@localhost:5432/noterag_db`). **Replace `mysecretpassword`!**
    *   **Configure `.env.test`:** Edit `.env.test` and set:
        *   `TEST_DATABASE_URL`: Your connection string for the **test** database (e.g., `postgresql://postgres:mysecretpassword@localhost:5432/noterag_test_db`). **Replace `mysecretpassword`!**
    *   **Create Python Virtual Environment:**
        ```bash
        python -m venv .venv 
        source .venv/bin/activate 
        ```
    *   **Install Python Dependencies:** (Includes SQLAlchemy, psycopg2, Alembic)
        ```bash
        pip install -r python_server/requirements.txt
        ```
    *   **Apply Database Migrations:** (Applies schema to the development DB specified in `.env`)
        ```bash
        alembic upgrade head
        ```

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

1.  **Ensure PostgreSQL is Running:** If using Docker, check with `docker ps` that `noterag-postgres` is running.
2.  **Run Backend Server:**
    *   Activate virtual environment: `source .venv/bin/activate`
    *   Navigate to project root: `cd /path/to/noteRAG`
    *   Run Uvicorn (loads config from `.env`):
        ```bash
        uvicorn python_server.main:app --host 0.0.0.0 --port 3443 --ssl-keyfile ./certs/localhost+2-key.pem --ssl-certfile ./certs/localhost+2.pem --reload
        ```

3.  **Run Web Client Development Server:**
    *   Navigate to the `web-client` directory (`noteRAG/web-client/`).
    *   Start the React development server:
        ```bash
        npm start
        ```
    *   Open your browser and navigate to the URL provided (usually `http://localhost:3000`).

4.  **Load and Use the Chrome Extension:**
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
    *   Ensure PostgreSQL is running and the **test database** (`noterag_test_db`) exists.
    *   Make sure `.env.test` is configured with `TEST_DATABASE_URL`.
    *   Activate virtual environment: `source .venv/bin/activate`
    *   Navigate to project root: `cd /path/to/noteRAG`
    *   Run pytest (uses `.env.test` and `conftest.py` for setup):
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

### Backend Storage Refactor (PostgreSQL)
*   Note metadata and text content are now stored reliably in a PostgreSQL database.
*   LlamaIndex filesystem storage (`python_server/storage/`) is only used for vector/index data pending ChromaDB integration.
*   Uses SQLAlchemy ORM and Alembic for database migrations.

# ... Other Updates ...