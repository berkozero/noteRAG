# noteRAG Extension Testing Guide

This guide explains how to test the noteRAG Chrome extension before loading it into Chrome.

## Testing Options

There are several ways to test the extension:

### 1. Browser Test Harness

A simple HTML test harness is provided to test the core functionality directly in a browser:

1. Build the extension:
   ```
   npm run build
   ```

2. Start the test server:
   ```
   node test-browser.js
   ```

3. Open your browser and navigate to:
   ```
   http://localhost:3000/extension-test.html
   ```

4. Use the test harness to:
   - Save notes from sample pages
   - Search for notes using semantic search
   - View and manage your saved notes

### 2. Node.js Test Script

A Node.js test script is provided to verify the integration between the extension and the semantic notes module:

1. Run the test script:
   ```
   node test-extension.js
   ```

2. The script will:
   - Create a test note
   - Save it using the semantic bridge
   - Search for the note
   - Output the results

### 3. Loading in Chrome for Development

You can load the extension in Chrome for development:

1. Build the extension:
   ```
   npm run build
   ```

2. Open Chrome and navigate to:
   ```
   chrome://extensions/
   ```

3. Enable "Developer mode" (toggle in the top-right)

4. Click "Load unpacked" and select the `build` directory

5. The extension should now be loaded and you can test it on live websites

### 4. Packaging the Extension

To package the extension for distribution:

1. Build the extension:
   ```
   npm run build
   ```

2. Package the extension:
   ```
   node package-extension.js
   ```

3. The packaged extension will be available at:
   ```
   dist/noteRAG-extension.zip
   ```

## Troubleshooting

If you encounter issues during testing:

1. **Browser Console**: Check the browser console for error messages.

2. **Storage Issues**: If notes aren't being saved or retrieved correctly, check:
   - The browser's local storage (in Dev Tools > Application > Local Storage)
   - The console for any error messages related to storage operations

3. **Building Issues**: If the build process fails:
   - Make sure all dependencies are installed
   - Check webpack configuration for any issues

4. **Testing in Isolated Environment**:
   The test harness provides an isolated environment for testing core functionality without Chrome APIs. Some features may work differently than in the actual extension.

## Manual Testing Checklist

- [ ] Saving a new note from the current page works
- [ ] Retrieving saved notes works
- [ ] Searching notes using the search functionality works
- [ ] Deleting notes works
- [ ] Notes persist after restarting the browser
- [ ] Semantic search returns relevant results 