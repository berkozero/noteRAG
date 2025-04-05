# noteRAG HTTPS Implementation

This document describes the HTTPS implementation for the noteRAG Chrome extension and its Python backend server.

## Overview

The noteRAG extension now supports secure HTTPS communication with its backend server. This implementation ensures that all data exchanged between the extension and the server is encrypted in transit, providing better security for users' notes and queries.

## Key Components

1. **API Client (`src/services/notes/api-client.js`)**: 
   - Uses HTTPS by default (port 3443)
   - Includes an HTTP fallback mechanism (port 3000) for development and legacy support
   - Handles certificate validation issues gracefully

2. **Manifest Configuration (`src/manifest.json`)**:
   - Updated with necessary host permissions for HTTPS
   - Content Security Policy (CSP) configured to allow HTTPS connections
   - Ensures the extension can securely connect to the backend

3. **Server Management (`server_manager.py`)**:
   - Supports starting the server in both HTTP and HTTPS modes
   - Manages SSL certificates for secure connections
   - Handles port conflicts and process management

4. **Testing Tools**:
   - Browser-based HTTPS connection test (`tests/https-browser-test.js`)
   - Implementation verification script (`verify-https-implementation.js`)
   - Node.js command-line HTTPS tests

## SSL Certificate Setup

For local development, we use self-signed certificates. In production, a proper certificate from a Certificate Authority (CA) should be used.

### Local Certificate Generation

```bash
# Generate local self-signed certificates
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
```

Store the generated certificates in the `certs/` directory.

### Port Configuration

The HTTPS server runs on port 3444 by default. If you need to change this:

1. Update `SERVER_CONFIG.port` in `src/services/notes/api-client.js`
2. Update the host permissions and CSP in `src/manifest.json`
3. Restart the server with the new port: `python server_manager.py start --https --port <new_port>`

## How It Works

### Connection Flow

1. The extension attempts to connect to the server via HTTPS (port 3444)
2. If the HTTPS connection fails, it automatically falls back to HTTP (port 3000)
3. The connection state is logged and maintained across requests
4. All API calls use the current connection configuration

### Server Startup

```bash
# Start the server in HTTPS mode
python server_manager.py start --https

# Start the server in HTTP mode (legacy)
python server_manager.py start
```

## Testing HTTPS Connections

### Browser Test

1. Start the HTTPS server: `python server_manager.py start --https`
2. Open `tests/https-browser-test.html` in a browser
3. Click "Run Tests" to verify all endpoints are accessible via HTTPS

### Verification Script

Run the verification script to ensure all necessary HTTPS components are in place:

```bash
node verify-https-implementation.js
```

## Troubleshooting

### Certificate Issues

If you encounter certificate validation issues in Chrome:
1. Enter `chrome://flags/#allow-insecure-localhost` in the address bar
2. Enable "Allow invalid certificates for resources loaded from localhost"
3. Restart Chrome

### Connection Failures

If the extension cannot connect to the HTTPS server:
1. Verify the server is running in HTTPS mode
2. Check that port 3443 is not blocked by a firewall
3. Ensure the certificates are correctly installed
4. Review the console logs for more detailed error information

## Future Improvements

1. **Certificate Management**: Implement proper certificate rotation and management
2. **HSTS Support**: Add HTTP Strict Transport Security for enhanced security
3. **Production Deployment**: Guidelines for setting up with a valid CA-signed certificate
4. **Performance Optimization**: Tuning SSL settings for optimal performance 