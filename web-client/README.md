# NoteRAG Web Client

This is the web version of the NoteRAG Chrome extension, providing the same functionality in a browser-accessible web application.

## Features

- Google authentication
- Create, view, and delete notes
- Integrates with the same server backend as the Chrome extension
- Future features: note search and Q&A functionality

## Setup

### Prerequisites

- Node.js (v14+)
- NPM or Yarn
- A valid Google OAuth client ID configured for web applications

### Installation

1. Clone the repository
2. Navigate to the web-client directory:
   ```
   cd web-client
   ```
3. Install dependencies:
   ```
   npm install
   ```
4. Copy `.env` file and update with your Google client ID:
   ```
   cp .env.example .env
   ```
   Then edit the `.env` file to add your Google OAuth client ID.

### Development

To start the development server:

```
npm start
```

This will start the app at http://localhost:3000.

### Building for Production

To create a production build:

```
npm run build
```

This will generate optimized files in the `dist` directory.

## Server Configuration

The web client connects to the same NoteRAG server as the Chrome extension. By default, it connects to `https://localhost:3443`. To change this:

1. Edit the `.env` file and update the `API_URL` variable:
   ```
   API_URL=https://your-server-url
   ```

## Contributing

Feel free to submit issues and pull requests.

## License

See the LICENSE file in the root directory. 