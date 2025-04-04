"""
Run script for noteRAG server

This script launches the FastAPI server correctly with uvicorn.
It ensures proper path handling for templates and static files.
"""
import os
import uvicorn

if __name__ == "__main__":
    # Change to the correct directory
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    # Run the server
    uvicorn.run("main:app", host="0.0.0.0", port=3000, reload=True, log_level="info") 