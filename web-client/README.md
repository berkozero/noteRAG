# NoteRAG Web Client

This directory contains the React/Next.js frontend application for NoteRAG.
It provides the user interface for interacting with the NoteRAG backend API.

## Features

*   **Authentication:** Login and Sign-up forms with validation (email format, password length).
*   **Dashboard:** (Basic landing page after login)
*   **Notes Management:** View, create, and delete notes.
*   **Ask AI:** Interface to ask questions based on your notes using the backend RAG capabilities.
*   **Settings:** Page to change the user's password.
*   **Theming:** Supports light and dark modes using `shadcn/ui` and `next-themes`.
*   **Responsive Design:** Uses `shadcn/ui` components and Tailwind CSS for adaptability.

## Tech Stack

*   **Framework:** Next.js (App Router)
*   **Language:** TypeScript
*   **UI:** React
*   **Component Library:** `shadcn/ui`
*   **Styling:** Tailwind CSS
*   **State Management:** React Context API (`AuthContext`)
*   **API Communication:** `fetch` API (via `lib/api.ts` service)

## Setup

(Refer to the main project README.md for backend setup and environment requirements.)

1.  Ensure Node.js (version 18+) and npm are installed.
2.  Navigate to the `web-client` directory:
    ```bash
    cd web-client
    ```
3.  Install dependencies:
    ```bash
    npm install
    ```
4.  **(Optional) Configure Google Sign-in:**
    *   Create a `.env.local` file in the `web-client` directory.
    *   Follow `docs/WEB_CLIENT_OAUTH_SETUP.md` in the root directory to get a Client ID.
    *   Add `NEXT_PUBLIC_GOOGLE_CLIENT_ID="YourWebClientId..."` to `.env.local`.

## Running the Development Server

1.  Ensure the backend server is running (typically on `https://localhost:3443`).
2.  From the `web-client` directory, run:
    ```bash
    npm start
    ```
3.  Open your browser to `http://localhost:3000`.

    *Note: The development server proxies API requests from `/api/...` to the backend server specified by the `proxy` setting in `package.json` (or Next.js config), handling the HTTPS target.* 

## Testing

(Basic setup might exist, needs further development)

*   Configuration: `jest.config.js`, `jest.setup.js`
*   Run tests from the `web-client` directory:
    ```bash
    npm test
    ```

## Folder Structure (Key Directories)

*   `app/`: Contains page routes (App Router conventions).
*   `components/`: Reusable UI components, including `shadcn/ui` components.
*   `lib/`: Utility functions, API service (`api.ts`).
*   `contexts/`: React context providers (e.g., `AuthContext.tsx`).
*   `public/`: Static assets.
*   `styles/`: Global styles (if any beyond `globals.css`). 