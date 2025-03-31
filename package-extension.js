/**
 * Script to package the extension for Chrome
 */
const fs = require('fs-extra');
const path = require('path');
const archiver = require('archiver');

// Create output directory if it doesn't exist
const outputDir = path.join(__dirname, 'dist');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

// Output file path
const outputPath = path.join(outputDir, 'noteRAG-extension.zip');

// Create a file to stream archive data to
const output = fs.createWriteStream(outputPath);
const archive = archiver('zip', {
  zlib: { level: 9 } // Compression level
});

// Listen for all archive data to be written
output.on('close', () => {
  console.log(`Extension packaged successfully: ${outputPath}`);
  console.log(`Total size: ${archive.pointer()} bytes`);
});

// Handle archive warnings
archive.on('warning', (err) => {
  if (err.code === 'ENOENT') {
    console.warn('Warning:', err);
  } else {
    throw err;
  }
});

// Handle archive errors
archive.on('error', (err) => {
  throw err;
});

// Pipe archive data to the file
archive.pipe(output);

// Add build directory contents to the archive
const buildDir = path.join(__dirname, 'build');
archive.directory(buildDir, false);

// Finalize the archive
archive.finalize();

console.log('Packaging extension...'); 