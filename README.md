# noteRAG: Web App, Chrome Extension & Backend

A web application, Chrome extension, and backend server allowing users to save notes and perform semantic search and question-answering on them using Retrieval-Augmented Generation (RAG) technology powered by LlamaIndex, OpenAI, PostgreSQL, and ChromaDB.

## Features

**Core Backend & RAG:**
*   User Authentication (Email/Password, JWT)
*   **Password Security:**
    *   Secure hashing using `bcrypt`.
    *   Minimum password length of 12 characters.
    *   Checks against known breached passwords (Have I Been Pwned).
    *   Password change functionality for authenticated users.
*   Secure, user-specific note storage using **PostgreSQL** for primary data.
*   Vector storage for semantic search using **ChromaDB**.
*   Semantic search through notes (via LlamaIndex & OpenAI).
*   Question Answering based on note content (via LlamaIndex & OpenAI).
*   HTTPS support for secure communication.

**Web Client:**
*   Full-featured interface for managing notes (Add, View, Delete).
*   Dedicated Search and Ask AI interfaces.
*   Login / Sign Up page (enforces password rules).
*   Settings page for password changes.
*   *(Optional)* Google OAuth 2.0 Sign-in option.

**Chrome Extension:**
*   Popup UI for quick access (Login/Logout, Ask AI).
*   Context Menu integration to add selected text from webpages as notes.
*   Notifications for success/failure.

## Project Structure

```
noteRAG/
├── certs/               # SSL certificates (localhost+2.pem, etc.) for local HTTPS dev
├── chrome-extension/    # Chrome Extension Application
│   ├── dist/            # Bundled extension files (output from build)
│   ├── icons/           # Extension icons
│   ├── node_modules/    # Extension Node.js dependencies
│   ├── src/             # Extension source code (React, background/popup scripts)
│   ├── manifest.json    # Extension manifest
│   ├── package.json     # Extension dependencies & scripts
│   └── webpack.config.js # Extension build configuration
├── data/                # Contains user authentication data (users.json)
│   ├── users.json       # Stores user emails and hashed passwords
│   └── users/           # User-specific directories (created but not essential for RAG)
├── docs/                # Additional documentation (OAuth Setup guides)
│   ├── WEB_CLIENT_OAUTH_SETUP.md
│   └── CHROME_EXTENSION_OAUTH_SETUP.md
├── python_server/       # Backend FastAPI Application
│   ├── alembic/         # Alembic database migration scripts
│   ├── auth.py          # User auth, JWT, UserManager
│   ├── database.py      # SQLAlchemy database connection setup
│   ├── main.py          # FastAPI app definition, API endpoints
│   ├── models.py        # SQLAlchemy database models (Note)
│   ├── rag_core.py      # LlamaIndex/RAG logic (NoteRAG class)
│   ├── requirements.txt # Python dependencies
│   ├── static/          # Static files for backend (if any)
│   ├── templates/       # HTML templates for backend (if any)
│   └── __init__.py
├── tests/
│   └── python_server/   # Pytest tests for the backend
│       ├── __init__.py
│       ├── conftest.py
│       ├── test_auth.py
│       └── test_notes_api.py
├── web-client/          # Frontend React Web Application
│   ├── build/           # Build output for web client - Ignored by Git
│   ├── node_modules/    # Web client Node.js dependencies
│   ├── public/          # Static assets (index.html, etc.)
│   ├── src/             # Web client source code (React)
│   ├── .env             # Web client environment variables (optional, for Google OAuth)
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
*Note: `.venv`, `node_modules`, build outputs are ignored by Git.* 

## Architecture Overview

*   **Frontend (Web Client / Chrome Extension):** React applications providing the user interface.
*   **Backend (FastAPI):** Handles API requests, user authentication, and orchestrates operations between databases and the RAG core.
*   **Database (PostgreSQL):** Stores primary user and note data (text, titles, metadata, user IDs, timestamps).
*   **Vector Store (ChromaDB):** Stores vector embeddings (derived from note text using OpenAI) and associated metadata (including the PostgreSQL note ID) for efficient semantic similarity searches.
*   **RAG Core (LlamaIndex):** Manages the interaction with ChromaDB (via `ChromaVectorStore`), orchestrates embedding generation, context retrieval, and prompting.
*   **AI Models (OpenAI):** Used by LlamaIndex to generate embeddings (`text-embedding-3-small`) and answer questions (`gpt-4-turbo-preview`).

## Security Considerations

*   **Authentication:** Uses JWT (JSON Web Tokens) via `python-jose` for securing API endpoints. Tokens have a limited expiry time (1 week).
*   **Password Storage:** Passwords are never stored in plain text. They are securely hashed using `bcrypt` with a unique salt per user via the `passlib` library.
*   **Password Policy:** 
    *   A minimum length of 12 characters is enforced.
    *   Passwords are checked against the Have I Been Pwned database to prevent the use of known compromised passwords.
*   **HTTPS:** Communication between clients and the backend server uses HTTPS (requires SSL certificates for local development).
*   **Dependencies:** Regularly review and update dependencies (Python/Node.js) to patch known vulnerabilities.
*   **Environment Variables:** API keys and secrets are loaded from `.env` files and should *never* be committed to version control.

## Prerequisites

*   **Python:** 3.10+ (with `pip` and `venv`)
*   **Node.js:** 18+ (with `npm`)
*   **Docker & Docker Compose:** Recommended for running PostgreSQL and ChromaDB easily.
*   **PostgreSQL:** A running PostgreSQL server (version 12+ recommended). Docker setup included.
*   **ChromaDB:** A running ChromaDB server. Docker setup included.
*   **OpenAI API Key:** For embedding generation and question-answering.
*   **(Optional) Google Client IDs:** One for the Web App and a separate one (Chrome App type) for the Chrome Extension if using Google Sign-in. See `docs/` for setup guides.

## Setup & Configuration

1.  **Clone Repository:**
    ```bash
    git clone <repository_url>
    cd noteRAG
    ```

2.  **Run Database Containers (Docker):**
    *   Ensure Docker is installed and running.
    *   **Run PostgreSQL:** (Creates dev DB `noterag_db` and test DB `noterag_test_db`)
        ```bash
        # Choose a secure password!
        export POSTGRES_PASSWORD="mysecretpassword"
        docker run --name noterag-postgres -e POSTGRES_PASSWORD=$POSTGRES_PASSWORD -e POSTGRES_DB=noterag_db -p 5432:5432 -d postgres:15
        sleep 5 # Wait for DB init
        docker exec -it noterag-postgres psql -U postgres -c "CREATE DATABASE noterag_test_db;"
        ```
    *   **Run ChromaDB:**
        ```bash
        docker run --name noterag-chromadb -p 8000:8000 -d chromadb/chroma
        ```

3.  **Backend Setup:**
    *   **Create Environment Files:**
        *   Copy `.env.example` to `.env`.
        *   Create `.env.test` (can be initially empty or copy from `.env.example`).
    *   **Configure `.env`:** Edit `.env` and set:
        *   `OPENAI_API_KEY`: Your key.
        *   `SECRET_KEY`: A strong random string (e.g., `openssl rand -hex 32`).
        *   `DATABASE_URL`: Connection string for the **dev** PostgreSQL DB (e.g., `postgresql://postgres:mysecretpassword@localhost:5432/noterag_db`). **Replace `mysecretpassword`!**
        *   `CHROMA_HOST`: Hostname for ChromaDB (usually `localhost` if running Docker locally).
        *   `CHROMA_PORT`: Port for ChromaDB (usually `8000`).
    *   **Configure `.env.test`:** Edit `.env.test` and set at least:
        *   `TEST_DATABASE_URL`: Connection string for the **test** PostgreSQL DB (e.g., `postgresql://postgres:mysecretpassword@localhost:5432/noterag_test_db`). **Replace `mysecretpassword`!** 
        *   *(Optional)* Other variables if needed for tests, like `SECRET_KEY`.
    *   **Create Python Virtual Environment & Install Dependencies:**
        ```bash
        python -m venv .venv
        source .venv/bin/activate
        # Ensure python_server is recognized as a package (needed for tests/imports)
        touch python_server/__init__.py 
        pip install -r python_server/requirements.txt
        # Install test dependencies (if not already included)
        pip install pytest
        ```
    *   **Apply Database Migrations:** (Applies schema to the dev PostgreSQL DB)
        ```bash
        alembic upgrade head
        ```

4.  **Web Client Setup:**
    *   Navigate to `web-client/`.
    *   Install dependencies: `npm install`.
    *   **(Optional) Configure Google Sign-in:**
        *   Create a `.env.local` file (`web-client/.env.local`).
        *   Follow `docs/WEB_CLIENT_OAUTH_SETUP.md` to get a Client ID.
        *   Add `NEXT_PUBLIC_GOOGLE_CLIENT_ID="YourWebClientId..."` to `.env.local`.

5.  **Chrome Extension Setup:**
    *   Navigate to `chrome-extension/`.
    *   Install dependencies: `npm install`.
    *   **(Optional) Configure Google Sign-in:**
        *   Follow `docs/CHROME_EXTENSION_OAUTH_SETUP.md` to get a Client ID (Chrome App type).
        *   Update `manifest.json` or configure the build process (see guide).
    *   Build the extension: `npm run build`.

6.  **HTTPS Setup (Local Development):**
    *   The backend server requires SSL certificates for HTTPS.
    *   Ensure you have `localhost+2-key.pem` and `localhost+2.pem` (or similarly named files) in the root `certs/` directory. If not, generate self-signed certificates (adjust filenames as needed):
        ```bash
        mkdir -p certs
        # Consider using mkcert for easier trusted local certs: https://github.com/FiloSottile/mkcert
        # Example with mkcert (install it first):
        # mkcert -install
        # mkcert -key-file certs/localhost-key.pem -cert-file certs/localhost-cert.pem localhost 127.0.0.1 ::1
        # Then update run command filenames.
        # Fallback using openssl:
        openssl req -x509 -newkey rsa:4096 -keyout certs/localhost+2-key.pem -out certs/localhost+2.pem -sha256 -days 365 -nodes -subj "/CN=localhost"
        ```
    *   Accept browser warnings for self-signed certificates when accessing `https://localhost:3443` or `http://localhost:3000` (which proxies API calls to the HTTPS backend).

## Running the Application

1.  **Ensure Docker Containers are Running:** Check with `docker ps` that `noterag-postgres` and `noterag-chromadb` are running.
2.  **Run Backend Server:**
    *   Activate virtual environment: `source .venv/bin/activate`
    *   Navigate to project root.
    *   Run Uvicorn (uses `.env`):
        ```bash
        uvicorn python_server.main:app --host 0.0.0.0 --port 3443 --ssl-keyfile ./certs/localhost+2-key.pem --ssl-certfile ./certs/localhost+2.pem --reload
        ```

3.  **Run Web Client Development Server:**
    *   Navigate to `web-client/`.
    *   Start the React server: `npm start`
    *   Open your browser to `http://localhost:3000`.

4.  **Load and Use the Chrome Extension:**
    *   Ensure you have built the extension (`cd chrome-extension && npm run build`).
    *   Go to `chrome://extensions/`, enable "Developer mode".
    *   Click "Load unpacked", select the `noteRAG/chrome-extension` directory.
    *   Log in via the popup, then use the context menu to add notes.

## Running Tests

1.  **Backend Tests:**
    *   Ensure PostgreSQL is running and the **test database** exists.
    *   Ensure `.env.test` is configured with `TEST_DATABASE_URL`.
    *   Activate virtual environment.
    *   Navigate to project root.
    *   Run pytest:
        ```bash
        pytest tests/python_server
        ```

2.  **Web Client Tests:**
    *   Navigate to `web-client/`.
    *   Run: `npm test`

## License

[MIT](LICENSE)