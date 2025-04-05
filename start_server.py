#!/usr/bin/env python
"""
Start script for noteRAG server

A convenience script to start the server in either HTTP or HTTPS mode.
"""
import argparse
import subprocess
import os
import signal
import sys
import time

# Global process reference
server_process = None

def parse_arguments():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description='Start noteRAG server in HTTP or HTTPS mode')
    parser.add_argument('--https', action='store_true', help='Start server in HTTPS mode')
    parser.add_argument('--port', type=int, default=3000, help='Port to run server on (default: 3000)')
    return parser.parse_args()

def start_server(use_https, port):
    """Start the server with the specified configuration"""
    global server_process
    
    # Build command
    cmd = ["python", "python_server/run.py"]
    
    if use_https:
        cmd.append("--ssl")
    
    cmd.extend(["--port", str(port)])
    
    # Print startup message
    protocol = "HTTPS" if use_https else "HTTP"
    print(f"🚀 Starting {protocol} server on port {port}...")
    
    # Start the server
    server_process = subprocess.Popen(cmd)
    
    return server_process

def handle_shutdown(signum, frame):
    """Handle shutdown signals gracefully"""
    if server_process:
        print("\n🛑 Stopping server...")
        server_process.terminate()
        server_process.wait()
        print("✅ Server stopped")
    sys.exit(0)

if __name__ == "__main__":
    # Register signal handlers
    signal.signal(signal.SIGINT, handle_shutdown)
    signal.signal(signal.SIGTERM, handle_shutdown)
    
    # Parse arguments
    args = parse_arguments()
    
    try:
        # Start server
        process = start_server(args.https, args.port)
        
        # Message for user
        protocol = "HTTPS" if args.https else "HTTP"
        print(f"✅ Server running with {protocol} on http{'s' if args.https else ''}://localhost:{args.port}")
        print("Press Ctrl+C to stop")
        
        # Wait for the process to end
        process.wait()
        
    except KeyboardInterrupt:
        handle_shutdown(None, None)
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        if server_process:
            server_process.terminate()
            server_process.wait() 