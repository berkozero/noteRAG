# OAuth Setup Guide for noteRAG Web App

This guide explains how to obtain a Google OAuth 2.0 Client ID necessary for the Google Sign-in functionality in the noteRAG web application.

## 1. Create a Google Cloud Project (if you don't have one)

1.  Go to the [Google Cloud Console](https://console.cloud.google.com/).
2.  Click the project drop-down menu at the top and select "New Project".
3.  Give your project a name (e.g., "noteRAG App") and click "Create".

## 2. Configure OAuth Consent Screen

Before creating credentials, you need to configure the consent screen users will see:

1.  In the Google Cloud Console, navigate to "APIs & Services" > "OAuth consent screen".
2.  Choose "External" user type (unless you are using Google Workspace and only want internal users) and click "Create".
3.  Fill in the required fields:
    *   **App name:** noteRAG (or your preferred name)
    *   **User support email:** Your email address.
    *   **App logo:** (Optional)
    *   **Authorized domains:** Add the domain where your app will be hosted (e.g., `localhost` for development).
    *   **Developer contact information:** Your email address.
4.  Click "Save and Continue".
5.  **Scopes:** Click "Add or Remove Scopes". Search for and add:
    *   `.../auth/userinfo.email` (View your email address)
    *   `.../auth/userinfo.profile` (See your personal info, including any personal info you've made publicly available)
    Click "Update", then "Save and Continue".
6.  **Test users:** Add your Google account email address here during development. Otherwise, your app will require verification by Google before external users can sign in. Click "Save and Continue".
7.  Review the summary and click "Back to Dashboard". *You may need to click "Publish App" later if using "External" mode, but keep it in testing for now.* 

## 3. Create OAuth 2.0 Client ID Credentials

1.  Navigate back to "APIs & Services" > "Credentials".
2.  Click "+ Create Credentials" > "OAuth client ID".
3.  Select "Web application" as the Application type.
4.  Enter a name (e.g., "noteRAG Web Client").
5.  **Authorized JavaScript origins:** Add the origins where your frontend runs. For local development, add:
    *   `http://localhost:3000` (or your frontend dev server port)
6.  **Authorized redirect URIs:** This is crucial for the Google SDK. Add the origin from which the Google Sign-In library is loaded. For local development with the standard setup, you often don't need a specific redirect URI if using Google's JavaScript library popup/redirect flows correctly, but sometimes adding your app's base origin helps:
    *   `http://localhost:3000`
    *(Note: If using different OAuth flows, specific redirect URIs like `http://localhost:3000/auth/google/callback` might be needed)*.
7.  Click "Create".

## 4. Get Your Client ID

*   A dialog box will appear showing your **Client ID** and Client Secret.
*   **Copy the Client ID.** It will look something like `xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com`.
*   You do *not* need the Client Secret for this frontend implementation.

## 5. Update `web-client/.env`

Paste your Client ID into the `.env` file located in the `noteRAG/web-client/` directory:

```env
REACT_APP_GOOGLE_CLIENT_ID="YOUR_COPIED_CLIENT_ID_HERE.apps.googleusercontent.com"
REACT_APP_API_URL="https://localhost:3443"
```

## 6. Restart Frontend

If your frontend development server (`npm start`) was running, restart it to load the new environment variable.

Authentication via Google Sign-in should now be configured. 