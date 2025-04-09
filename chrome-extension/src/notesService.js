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

// --- Placeholder for other API functions ---

// async function getNotes(token) { ... }
// async function addNote(token, content) { ... }
// async function queryNotes(token, query) { ... }


export const notesService = {
    login,
    // getNotes,
    // addNote,
    // queryNotes,
}; 