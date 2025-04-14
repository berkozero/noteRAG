# Use an official Python runtime as a parent image
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
# Render typically provides the PORT environment variable
# ENV PORT=3443 # We might not need to set it here

# Set the working directory in the container
WORKDIR /app

# Install system dependencies if needed (e.g., for psycopg2)
# RUN apt-get update && apt-get install -y --no-install-recommends gcc libpq-dev && rm -rf /var/lib/apt/lists/*

# Install Poetry (Optional, if you switch from requirements.txt)
# RUN pip install poetry

# Copy only requirements to leverage Docker cache
# Path relative to the repository root (build context)
COPY python_server/requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application code AS a subdirectory
# Source path relative to the repository root (build context)
COPY python_server /app/python_server

# Explicitly set PYTHONPATH to include /app so python_server package can be found
ENV PYTHONPATH=/app

# Make sure the __init__.py exists (it should from previous steps)
# RUN touch __init__.py

# Expose the port the app runs on
# Uvicorn will run on the port specified by the PORT env var provided by Render,
# or default to 8000 if not set and not specified in CMD.
# We don't strictly need to EXPOSE here, but it's good practice.
EXPOSE 8000

# Define the command to run the application using the package structure
# It assumes the main FastAPI app instance is named 'app' in '/app/python_server/main.py'
CMD ["uvicorn", "python_server.main:app", "--host", "0.0.0.0", "--port", "8000"] 