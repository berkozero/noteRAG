/**
 * Manifest Permission Test
 * 
 * This script tests the Chrome extension's manifest permissions
 * to verify it can connect to HTTPS endpoints.
 */

const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

console.log(`${colors.cyan}===========================================${colors.reset}`);
console.log(`${colors.cyan}  Chrome Extension Manifest Permission Test ${colors.reset}`);
console.log(`${colors.cyan}===========================================${colors.reset}`);

// Read the manifest file
const manifestPath = path.resolve(__dirname, '../src/manifest.json');
let manifest;

try {
  const manifestContent = fs.readFileSync(manifestPath, 'utf8');
  manifest = JSON.parse(manifestContent);
  console.log(`${colors.green}✓ Successfully loaded manifest from ${manifestPath}${colors.reset}`);
} catch (error) {
  console.error(`${colors.red}✗ Failed to load manifest: ${error.message}${colors.reset}`);
  process.exit(1);
}

// Check manifest version
console.log(`\n${colors.yellow}Checking manifest version...${colors.reset}`);
if (manifest.manifest_version === 3) {
  console.log(`${colors.green}✓ Using Manifest V3${colors.reset}`);
} else {
  console.log(`${colors.red}✗ Not using Manifest V3 (found version ${manifest.manifest_version})${colors.reset}`);
}

// Check host permissions
console.log(`\n${colors.yellow}Checking host permissions...${colors.reset}`);
const hostPermissions = manifest.host_permissions || [];
const requiredHosts = [
  'https://localhost:3443/',
  'http://localhost:3000/'
];

let hostPermissionsValid = true;
for (const host of requiredHosts) {
  if (hostPermissions.includes(host)) {
    console.log(`${colors.green}✓ Found required host permission: ${host}${colors.reset}`);
  } else {
    console.log(`${colors.red}✗ Missing required host permission: ${host}${colors.reset}`);
    hostPermissionsValid = false;
  }
}

if (hostPermissionsValid) {
  console.log(`${colors.green}✓ All required host permissions found${colors.reset}`);
} else {
  console.log(`${colors.red}✗ Some required host permissions are missing${colors.reset}`);
}

// Check content security policy
console.log(`\n${colors.yellow}Checking content security policy...${colors.reset}`);
const csp = manifest.content_security_policy || {};
const extensionPagesCsp = csp.extension_pages || '';

// Check if CSP allows HTTPS connections
if (extensionPagesCsp.includes('https://localhost:3443')) {
  console.log(`${colors.green}✓ CSP allows HTTPS connections to localhost:3443${colors.reset}`);
} else {
  console.log(`${colors.red}✗ CSP does not allow HTTPS connections to localhost:3443${colors.reset}`);
}

if (extensionPagesCsp.includes('https://*.googleapis.com')) {
  console.log(`${colors.green}✓ CSP allows HTTPS connections to Google APIs${colors.reset}`);
} else {
  console.log(`${colors.red}✗ CSP does not allow HTTPS connections to Google APIs${colors.reset}`);
}

// Check overall CSP security practices
if (extensionPagesCsp.includes("script-src 'self'")) {
  console.log(`${colors.green}✓ CSP restricts scripts to extension's origin${colors.reset}`);
} else {
  console.log(`${colors.red}✗ CSP does not properly restrict script sources${colors.reset}`);
}

if (extensionPagesCsp.includes("object-src 'self'")) {
  console.log(`${colors.green}✓ CSP restricts object sources${colors.reset}`);
} else {
  console.log(`${colors.red}✗ CSP does not properly restrict object sources${colors.reset}`);
}

// Final summary
console.log(`\n${colors.yellow}Test Summary:${colors.reset}`);
if (
  hostPermissionsValid && 
  extensionPagesCsp.includes('https://localhost:3443') &&
  extensionPagesCsp.includes('https://*.googleapis.com')
) {
  console.log(`${colors.green}✓ Manifest permissions are configured correctly for HTTPS${colors.reset}`);
  console.log(`${colors.green}✓ The extension should be able to connect to HTTPS endpoints${colors.reset}`);
} else {
  console.log(`${colors.red}✗ Manifest permissions need adjustment for proper HTTPS support${colors.reset}`);
  console.log(`${colors.red}✗ Please check the issues above and fix the manifest.json file${colors.reset}`);
}

console.log(`${colors.cyan}===========================================${colors.reset}`); 