"""
HTTPS Server Test Module

This module contains tests for validating the HTTPS server configuration.
Run this test with an HTTPS server already running on port 3443.
"""
import unittest
import requests
import sys
import time
from pathlib import Path
import urllib3

# Disable SSL verification warnings for self-signed certs
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

class HTTPSServerTest(unittest.TestCase):
    """Tests for the HTTPS server configuration"""
    
    def setUp(self):
        """Check if server is running before each test"""
        # Check if server is accessible
        try:
            requests.get("https://localhost:3443/health", verify=False, timeout=2)
        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout):
            self.skipTest("HTTPS Server not running - start with: python start_server.py --https --port 3443")
    
    def test_https_health_endpoint(self):
        """Test the /health endpoint over HTTPS"""
        # Send a request to the health endpoint
        response = requests.get("https://localhost:3443/health", verify=False)
        
        # Check that the response is successful
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})
    
    def test_https_root_endpoint(self):
        """Test the root endpoint over HTTPS"""
        # Send a request to the root endpoint
        response = requests.get("https://localhost:3443/", verify=False)
        
        # Check that the response is successful
        self.assertEqual(response.status_code, 200)
        self.assertIn("status", response.json())
        self.assertEqual(response.json()["status"], "ok")

    def test_cors_headers(self):
        """Test that CORS headers are properly set for HTTPS"""
        # Send OPTIONS request to test CORS
        response = requests.options(
            "https://localhost:3443/health", 
            verify=False,
            headers={
                "Origin": "https://localhost:3000",
                "Access-Control-Request-Method": "GET"
            }
        )
        
        # Check CORS headers
        self.assertEqual(response.status_code, 200)
        self.assertIn("Access-Control-Allow-Origin", response.headers)
        self.assertIn("Access-Control-Allow-Methods", response.headers)

if __name__ == "__main__":
    print("Testing HTTPS server at https://localhost:3443")
    print("Make sure the server is running with: python start_server.py --https --port 3443")
    unittest.main() 