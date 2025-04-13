const API_BASE_URL = 'https://localhost:3443'; // Make sure this matches your backend URL

/**
 * Logs in the user.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<string>} The authentication token.
 * @throws {Error} If login fails.
 */
async function login(email, password) {
    const response = await fetch(`${API_BASE_URL}/token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        // FastAPI expects form data for token endpoint
        body: new URLSearchParams({
            username: email, // FastAPI uses 'username' by default
            password: password,
        }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Login failed' }));
        console.error("Login API Error:", response.status, errorData);
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    if (!data.access_token) {
        throw new Error('Access token not found in response');
    }
    return data.access_token;
}

// --- Added API functions ---

/**
 * Fetches all notes for the logged-in user.
 * @param {string} token The authentication token.
 * @returns {Promise<Array>} An array of note objects.
 * @throws {Error} If fetching fails.
 */
async function getNotes(token) {
    const response = await fetch(`${API_BASE_URL}/api/notes`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
        }
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Failed to fetch notes' }));
        console.error("Get Notes API Error:", response.status, errorData);
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }
    return await response.json();
}

/**
 * Adds a new note.
 * @param {string} token The authentication token.
 * @param {string} title The title of the note.
 * @param {string} text The content of the note.
 * @returns {Promise<Object>} The newly created note object.
 * @throws {Error} If adding the note fails.
 */
async function addNote(token, title, text) {
    const noteData = { title, text };
    const response = await fetch(`${API_BASE_URL}/api/notes`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify(noteData)
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Failed to add note' }));
        console.error("Add Note API Error:", response.status, errorData);
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }
    return await response.json();
}

/**
 * Queries notes using the RAG backend.
 * @param {string} token The authentication token.
 * @param {string} query The query string.
 * @param {number} [top_k=3] The number of results to retrieve.
 * @returns {Promise<Object>} The query response object (containing response and source_nodes).
 * @throws {Error} If the query fails.
 */
async function queryNotes(token, query, top_k = 3) {
    const params = new URLSearchParams({
        q: query,
        top_k: top_k.toString()
    });
    const response = await fetch(`${API_BASE_URL}/api/query?${params.toString()}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
        }
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Failed to query notes' }));
        console.error("Query Notes API Error:", response.status, errorData);
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }
    return await response.json();
}


export const notesService = {
    login,
    getNotes,
    addNote,
    queryNotes,
}; 