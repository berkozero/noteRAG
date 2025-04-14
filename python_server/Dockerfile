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

# Copy the rest of the application code into the container
# Source path relative to the repository root (build context)
COPY python_server/ .

# Make sure the __init__.py exists (it should from previous steps)
# RUN touch __init__.py

# Expose the port the app runs on
# Uvicorn will run on the port specified by the PORT env var provided by Render,
# or default to 8000 if not set and not specified in CMD.
# We don't strictly need to EXPOSE here, but it's good practice.
EXPOSE 8000

# Define the command to run the application
# Render will likely override this or use a start command setting.
# This command runs Uvicorn directly, listening on all interfaces on the specified port.
# It does NOT use --reload or specific --ssl flags as Render handles TLS termination.
# It assumes the main FastAPI app instance is named 'app' in 'python_server.main'
CMD ["uvicorn", "python_server.main:app", "--host", "0.0.0.0", "--port", "8000"] 