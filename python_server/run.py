"""
Run script for noteRAG server

This script launches the FastAPI server correctly with uvicorn.
It ensures proper path handling for templates and static files.
Supports both HTTP and HTTPS (SSL) modes.
"""
import os
import uvicorn
from pathlib import Path
import argparse

def parse_arguments():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description='Run noteRAG server with HTTP or HTTPS')
    parser.add_argument('--ssl', action='store_true', help='Enable HTTPS with SSL')
    parser.add_argument('--port', type=int, default=3000, help='Port to run the server on (default: 3000)')
    return parser.parse_args()

if __name__ == "__main__":
    # Parse arguments
    args = parse_arguments()
    
    # Change to the correct directory
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    # Default configuration
    config = {
        "app": "main:app",
        "host": "0.0.0.0",
        "port": args.port,
        "reload": True,
        "log_level": "info"
    }
    
    # If SSL is enabled, add SSL configuration
    if args.ssl:
        # Get paths relative to project root (one directory up from this script)
        project_root = Path(os.path.abspath(__file__)).parent.parent
        # Use the certificates generated by mkcert
        cert_path = project_root / "certs" / "localhost+2.pem"
        key_path = project_root / "certs" / "localhost+2-key.pem"
        
        # Verify certificate files exist
        if not cert_path.exists() or not key_path.exists():
            print(f"❌ Certificate files not found at {cert_path} or {key_path}")
            print("Run 'cd certs && mkcert localhost 127.0.0.1 ::1' to generate them")
            exit(1)
        
        # Add SSL configuration
        config["ssl_certfile"] = str(cert_path)
        config["ssl_keyfile"] = str(key_path)
        print(f"🔒 Running with HTTPS on port {args.port}")
    else:
        print(f"⚠️ Running with HTTP (insecure) on port {args.port}")
    
    # Run the server
    uvicorn.run(**config) 