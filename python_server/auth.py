"""
User Management for NoteRAG (Database Backend)

This module handles user authentication using a PostgreSQL database via SQLAlchemy.
"""
import os
# import json # No longer needed
# import uuid # No longer needed for basic auth
from pathlib import Path # Keep for potential future use, but not for user storage
from datetime import datetime, timedelta, timezone
from typing import Optional # Removed Dict, List, uuid
import logging
import asyncio
import pwnedpasswords

from pydantic import BaseModel, EmailStr, Field
from passlib.context import CryptContext
from jose import jwt, JWTError
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from sqlalchemy import select, update # Import select and update
from . import models # Import models
from .database import SessionLocal # Import SessionLocal for direct use if needed

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Security settings
load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    logger.error("FATAL: SECRET_KEY environment variable not set!")
    # Handle error appropriately
else:
    logger.info(f"Loaded SECRET_KEY starting with: {SECRET_KEY[:4]}... ending with ...{SECRET_KEY[-4:]}")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 1 week

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Data directory (No longer used for users.json)
# DATA_DIR = Path("data")
# USERS_DIR = DATA_DIR / "users"
# USERS_FILE = DATA_DIR / "users.json"

# HIBP Check Function (keep as is)
async def check_if_password_pwned(password: str) -> bool:
    """Checks if a password has been exposed in a data breach using HIBP.

    Args:
        password: The password string to check.

    Returns:
        True if the password was found in breaches, False otherwise.
    """
    try:
        # Use run_in_executor to avoid blocking the event loop with synchronous network call
        loop = asyncio.get_running_loop()
        count = await loop.run_in_executor(None, pwnedpasswords.check, password)
        if count > 0:
            logger.warning(f"Password check: Password found {count} times in breaches.")
            return True
        else:
            logger.debug("Password check: Password not found in breaches.")
            return False
    except Exception as e:
        # Log the error but don't prevent registration/change if HIBP service is down
        logger.error(f"Could not check password against HIBP: {e}")
        return False # Fail open (allow password) if check fails

# --- Pydantic Models (keep as is) --- 
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=12)

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=12)

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_email: str

# User model for response (optional, might use models.User directly or tailor this)
class UserResponse(BaseModel):
    email: EmailStr
    is_active: bool
    created_at: datetime
    last_login: Optional[datetime] = None
    model_config = {"from_attributes": True}

# --- Database Interaction Functions (Replacing UserManager) --- 

def get_user(db: Session, email: str) -> Optional[models.User]:
    """Retrieve a user from the database by email."""
    return db.query(models.User).filter(models.User.email == email).first()

def create_user(db: Session, user_data: UserCreate) -> models.User:
    """Create a new user in the database."""
    logger.info(f"Attempting to create user: {user_data.email}")
    # Check if user already exists (optional, DB constraint handles it too)
    db_user = get_user(db, user_data.email)
    if db_user:
        logger.warning(f"User {user_data.email} already exists. Returning existing user.")
        # Decide policy: Raise error or return existing? Returning existing for now.
        return db_user 
        # raise HTTPException(status_code=400, detail="Email already registered")

    hashed_password = pwd_context.hash(user_data.password)
    new_user = models.User(email=user_data.email, hashed_password=hashed_password)
    try:
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        logger.info(f"Successfully created user: {new_user.email}")
        return new_user
    except Exception as e:
        db.rollback()
        logger.error(f"Database error creating user {user_data.email}: {e}", exc_info=True)
        # Re-raise a more specific exception or handle as needed
        raise

def authenticate_user(db: Session, email: str, password: Optional[str]) -> Optional[models.User]:
    """Authenticate a user by email and password against the database."""
    user = get_user(db, email)
    if not user:
        logger.warning(f"Authentication failed: User {email} not found")
        return None
    if not user.is_active:
        logger.warning(f"Authentication failed: User {email} is inactive")
        return None

    # If password provided, verify it
    if password and user.hashed_password:
        if not pwd_context.verify(password, user.hashed_password):
            logger.warning(f"Authentication failed: Invalid password for {email}")
            return None
    elif password and not user.hashed_password:
        # Handle case: trying password auth for user with no password set (e.g., OAuth only)
        logger.warning(f"Authentication failed: Password provided for user {email} with no password set.")
        return None
    elif not password and user.hashed_password:
        # Handle case: password required but not provided (shouldn't happen with OAuth2PasswordRequestForm)
        logger.warning(f"Authentication failed: Password required but not provided for {email}")
        return None

    # Update last login time
    try:
        user.last_login = datetime.now(timezone.utc)
        db.commit()
        db.refresh(user) # Refresh to get updated timestamp if needed elsewhere
        logger.info(f"User {email} authenticated successfully.")
    except Exception as e:
        db.rollback()
        logger.error(f"Database error updating last_login for {email}: {e}", exc_info=True)
        # Authentication succeeded, but logging failed. Still return user.

    return user

def update_user_password(db: Session, email: str, new_hashed_password: str) -> bool:
    """Update the hashed password for a given user in the database."""
    user = get_user(db, email)
    if not user:
        logger.error(f"Cannot update password: User {email} not found.")
        return False
    
    try:
        user.hashed_password = new_hashed_password
        # Optionally update an 'updated_at' field if it exists on the User model
        db.commit()
        logger.info(f"Successfully updated password hash for user {email}")
        return True
    except Exception as e:
        db.rollback()
        logger.error(f"Database error updating password for user {email}: {e}", exc_info=True)
        return False

def create_access_token(email: str) -> str:
    """Create a JWT access token for a user (no DB interaction needed)."""
    expires = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    claims = {"sub": email, "exp": expires}
    token = jwt.encode(claims, SECRET_KEY, algorithm=ALGORITHM)
    logger.info(f"Created access token for user: {email}")
    return token

def verify_token(token: str) -> Optional[str]:
    """Verify a JWT token and check if the user exists in the database."""
    logger.debug(f"Verifying token starting with: {token[:15]}...")
    if not SECRET_KEY:
        logger.error("Cannot verify token: SECRET_KEY is not configured.")
        return None
             
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if email is None:
            logger.warning("Token verification failed: No email (sub) in token payload.")
            # raise credentials_exception # Be consistent with original logic/error type
            return None # Return None based on original logic if email is missing
            
        # *** Check if user exists in DB ***
        # Need a DB session. This function might need refactoring 
        # if called outside a request scope, or use SessionLocal directly.
        with SessionLocal() as db: # Create a temporary session
            user = get_user(db, email)
            if user is None:
                logger.warning(f"Token verification failed: User {email} from token not found in database.")
                # raise credentials_exception # Be consistent
                return None # Return None based on original logic if user not found
            if not user.is_active:
                logger.warning(f"Token verification failed: User {email} from token is inactive.")
                # raise credentials_exception # Be consistent
                return None # Return None based on original logic if user inactive
                
        logger.info(f"Token successfully verified for user: {email}")
        return email
    except jwt.ExpiredSignatureError:
        logger.warning(f"Token verification failed: Expired token received.")
        return None 
    except JWTError as e:
        logger.warning(f"Token verification failed: {e}")
        return None 
    except Exception as e:
        logger.error(f"Unexpected error during token verification: {e}", exc_info=True)
        return None

# Note: get_user_storage_path is removed as it's no longer relevant

# Global user manager instance (No longer needed)
# user_manager = UserManager()

# Need to import status from FastAPI for HTTPException
from fastapi import HTTPException, status 