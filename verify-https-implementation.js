/**
 * HTTPS Implementation Verification Script
 * 
 * This script verifies that all necessary changes for HTTPS support
 * have been implemented correctly across the codebase.
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Files to check
const filesToCheck = [
  {
    path: 'src/manifest.json',
    checks: [
      { description: 'Has HTTPS host permissions for port 3443', test: content => content.includes('https://localhost:3443/') },
      { description: 'Has HTTPS host permissions for port 3444', test: content => content.includes('https://localhost:3444/') },
      { description: 'Has CSP for HTTPS', test: content => content.includes('connect-src') && 
                                                          content.includes('https://localhost:3443') &&
                                                          content.includes('https://localhost:3444') }
    ]
  },
  {
    path: 'src/services/notes/api-client.js',
    checks: [
      { description: 'Uses HTTPS protocol by default', test: content => content.includes('protocol: \'https\'') },
      { description: 'Configured for port 3444', test: content => content.includes('port: 3444') },
      { description: 'Has fallback mechanism', test: content => content.includes('FALLBACK_CONFIG') && content.includes('http://') }
    ]
  },
  {
    path: 'server_manager.py',
    checks: [
      { description: 'Supports HTTPS server', test: content => content.includes('use_https') && content.includes('--ssl') }
    ]
  },
  {
    path: 'tests/https-browser-test.js',
    checks: [
      { description: 'Browser test exists', test: content => content.includes('HTTPS Connection Test') }
    ]
  },
  {
    path: 'tests/https-browser-test.html',
    checks: [
      { description: 'Browser test HTML exists', test: content => content.includes('<script src="https-browser-test.js"></script>') }
    ]
  }
];

// Run verification
verifyHttpsImplementation();

/**
 * Run verification on all files
 */
function verifyHttpsImplementation() {
  console.log(`${colors.blue}=== HTTPS Implementation Verification ===\n${colors.reset}`);
  
  let totalChecks = 0;
  let passedChecks = 0;
  
  for (const file of filesToCheck) {
    const filePath = path.resolve(__dirname, file.path);
    
    console.log(`${colors.cyan}Checking ${file.path}${colors.reset}`);
    
    try {
      // Read file content
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Run all checks for the file
      for (const check of file.checks) {
        totalChecks++;
        const passed = check.test(content);
        passedChecks += passed ? 1 : 0;
        
        const status = passed 
          ? `${colors.green}✓ PASS${colors.reset}` 
          : `${colors.red}✗ FAIL${colors.reset}`;
        
        console.log(`  ${status} ${check.description}`);
      }
    } catch (error) {
      console.log(`  ${colors.red}✗ FAIL${colors.reset} File not found or cannot be read`);
      console.log(`  Error: ${error.message}`);
    }
    
    console.log(''); // Empty line between files
  }
  
  // Print summary
  const percentage = Math.round((passedChecks / totalChecks) * 100);
  
  let summaryColor = colors.red;
  if (percentage === 100) {
    summaryColor = colors.green;
  } else if (percentage >= 80) {
    summaryColor = colors.yellow;
  }
  
  console.log(`${colors.blue}=== Verification Summary ===\n${colors.reset}`);
  console.log(`${summaryColor}Passed ${passedChecks}/${totalChecks} checks (${percentage}%)${colors.reset}`);
  
  if (percentage === 100) {
    console.log(`\n${colors.green}✅ HTTPS implementation is complete!${colors.reset}`);
  } else {
    console.log(`\n${colors.yellow}⚠️ Some checks failed. Review the output above for details.${colors.reset}`);
  }
} 