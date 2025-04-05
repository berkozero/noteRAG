"""
Test script for HTTPS server connection

This script attempts to connect to the HTTPS server and verify it's working correctly.
"""
import requests
import subprocess
import time
import sys
import os
import signal
from pathlib import Path

# Server process
server_process = None

def start_server():
    """Start the HTTPS server in a subprocess"""
    global server_process
    
    # Start the server with SSL enabled
    print("🚀 Starting HTTPS server...")
    server_process = subprocess.Popen(
        ["python", "python_server/run.py", "--ssl", "--port", "3443"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    
    # Give the server time to start
    time.sleep(2)
    
    return server_process.poll() is None  # None means it's still running

def stop_server():
    """Stop the server subprocess"""
    global server_process
    
    if server_process:
        print("🛑 Stopping server...")
        os.kill(server_process.pid, signal.SIGTERM)
        server_process.wait()
        print("✅ Server stopped")

def test_https_connection():
    """Test HTTPS connection to the server"""
    try:
        # Disable SSL verification warnings for self-signed certs
        requests.packages.urllib3.disable_warnings()
        
        # Send a request to the HTTPS server
        response = requests.get("https://localhost:3443/health", verify=False, timeout=5)
        
        if response.status_code == 200:
            print(f"✅ HTTPS connection successful! (Status: {response.status_code})")
            print(f"Response: {response.json()}")
            return True
        else:
            print(f"❌ HTTPS connection failed with status code: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ HTTPS connection failed with error: {str(e)}")
        return False

if __name__ == "__main__":
    try:
        # Check if certificates exist
        cert_path = Path("certs/localhost+2.pem")
        key_path = Path("certs/localhost+2-key.pem")
        
        if not cert_path.exists() or not key_path.exists():
            print(f"❌ Certificate files not found at {cert_path} or {key_path}")
            sys.exit(1)
        
        # Start the server
        if not start_server():
            print("❌ Failed to start server")
            sys.exit(1)
        
        print("⏳ Waiting for server to initialize...")
        time.sleep(3)
        
        # Test HTTPS connection
        success = test_https_connection()
        
        if success:
            print("✅ HTTPS Server Test: PASSED")
            print("🔒 Python backend is now configured for HTTPS!")
        else:
            print("❌ HTTPS Server Test: FAILED")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n🛑 Test interrupted")
    finally:
        # Stop the server
        stop_server() 