# OAuth Setup Guide for noteRAG Chrome Extension

This guide explains how to obtain a Google OAuth 2.0 Client ID necessary for the Google Sign-in functionality in the noteRAG Chrome Extension.

**Important:** The process for Chrome Extensions is different from web applications.

## 1. Google Cloud Project & Consent Screen

1.  Ensure you have a Google Cloud Project and have configured the **OAuth Consent Screen** as described in steps 1 and 2 of the Web Client OAuth Setup Guide (`docs/WEB_CLIENT_OAUTH_SETUP.md`). Pay attention to adding the required scopes (`userinfo.email`, `userinfo.profile`) and adding test users during development.

## 2. Create OAuth 2.0 Client ID Credentials for Chrome App

1.  Navigate to "APIs & Services" > "Credentials" in the [Google Cloud Console](https://console.cloud.google.com/).
2.  Click "+ Create Credentials" > "OAuth client ID".
3.  Select **"Chrome App"** as the Application type.
4.  Enter a name (e.g., "noteRAG Chrome Extension").
5.  **Application ID:** Enter your Chrome Extension's ID.
    *   **How to find your Extension ID:**
        *   Load your unpacked extension into Chrome (`chrome://extensions/` > "Load unpacked" > select the `chrome-extension` folder).
        *   Find your extension in the list.
        *   The **ID** is the long string of characters (e.g., `acpbbjceallindmgffmapnmcboiokncj`).
    *   Paste this ID into the Application ID field.
6.  Click "Create".

## 3. Get Your Client ID

*   A dialog box will appear showing your **Client ID**.
*   **Copy this Client ID.** It will look similar to the web client ID but is specifically for your Chrome Extension.
*   You do *not* need the Client Secret.

## 4. Update `chrome-extension/manifest.json` (or Build Process)

How you provide the Client ID to the extension can vary:

**Method A: Directly in `manifest.json` (Simpler for Development)**

*   Open `chrome-extension/manifest.json`.
*   Find the `oauth2` section.
*   Replace `"${GOOGLE_CLIENT_ID}"` with your actual copied Client ID:

```json
  "oauth2": {
    "client_id": "YOUR_COPIED_CHROME_APP_CLIENT_ID_HERE.apps.googleusercontent.com",
    "scopes": [
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile"
    ]
  },
```

**Method B: Using Environment Variables during Build (Better for Production)**

*   Keep `"${GOOGLE_CLIENT_ID}"` in `manifest.json`.
*   Create a `.env` file in the `chrome-extension` directory (if it doesn't exist).
*   Add your Client ID to the `.env` file:
    ```env
    GOOGLE_CLIENT_ID="YOUR_COPIED_CHROME_APP_CLIENT_ID_HERE.apps.googleusercontent.com"
    ```
*   Ensure your Webpack configuration (`webpack.config.js`) uses `dotenv-webpack` or a similar plugin to replace `"${GOOGLE_CLIENT_ID}"` in `manifest.json` during the build process (`npm run build`). This often requires specific webpack plugin setup.

*Choose the method that best suits your development/build workflow.* Method A is easier for quick testing.

## 5. Rebuild & Reload Extension

1.  **Build:** If you modified `manifest.json` directly (Method A) or rely on environment variables (Method B), you **must rebuild** the extension:
    ```bash
    cd chrome-extension
    npm run build
    cd ..
    ```
2.  **Reload:** Go to `chrome://extensions/` and click the reload button for the NoteRAG extension.

Authentication via Google Sign-in within the Chrome Extension popup should now be configured using the correct Client ID. 