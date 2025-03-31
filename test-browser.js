/**
 * Simple HTTP server to serve our test HTML page
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

// Mime types for different file extensions
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// Create a server
const server = http.createServer((req, res) => {
  console.log(`Request: ${req.method} ${req.url}`);
  
  // Parse URL
  let filePath = req.url;
  if (filePath === '/') {
    filePath = '/extension-test.html';
  }
  
  // Resolve the file path
  const resolvedPath = path.resolve(process.cwd(), filePath.substr(1));
  
  // Get file extension
  const extname = path.extname(resolvedPath);
  const contentType = mimeTypes[extname] || 'application/octet-stream';
  
  // Read file
  fs.readFile(resolvedPath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        console.error(`File not found: ${resolvedPath}`);
        res.writeHead(404);
        res.end('File not found');
      } else {
        console.error(`Server error: ${error.code}`);
        res.writeHead(500);
        res.end(`Server Error: ${error.code}`);
      }
    } else {
      console.log(`Serving: ${resolvedPath} (${contentType})`);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

// Start server
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
  console.log(`Test harness available at http://localhost:${PORT}/extension-test.html`);
}); 