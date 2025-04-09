"""
User Management for NoteRAG

This module handles user authentication, storage, and management
for the NoteRAG system. It provides a lean implementation focused
on email-based user identification.
"""
import os
import json
import uuid
from pathlib import Path
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional, List
import logging

from pydantic import BaseModel, EmailStr, Field
from passlib.context import CryptContext
from jose import jwt, JWTError

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Security settings
SECRET_KEY = os.getenv("SECRET_KEY", str(uuid.uuid4()))  # Use env variable or generate random key
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 1 week

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Data directory
DATA_DIR = Path("data")
USERS_DIR = DATA_DIR / "users"
USERS_FILE = DATA_DIR / "users.json"


class UserCreate(BaseModel):
    """Model for user registration"""
    email: EmailStr
    password: Optional[str] = None

class Token(BaseModel):
    """Model for JWT token response"""
    access_token: str
    token_type: str = "bearer"
    user_email: str

class User(BaseModel):
    """User model for authentication and identification"""
    email: EmailStr
    hashed_password: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_login: Optional[datetime] = None


class UserManager:
    """Handles user operations including registration, authentication, and token management"""
    
    def __init__(self):
        """Initialize the user manager and ensure storage directories exist"""
        # Ensure data directories exist
        USERS_DIR.mkdir(parents=True, exist_ok=True)
        self._load_users()
    
    def _load_users(self):
        """Load users from storage"""
        try:
            if USERS_FILE.exists():
                with open(USERS_FILE, "r") as f:
                    user_dict = json.load(f)
                    self.users = {email: User(**data) for email, data in user_dict.items()}
            else:
                self.users = {}
                self._save_users()  # Create empty users file
            logger.info(f"Loaded {len(self.users)} users from storage")
        except Exception as e:
            logger.error(f"Error loading users: {e}")
            self.users = {}
    
    def _save_users(self):
        """Save users to storage"""
        try:
            user_dict = {email: user.model_dump() for email, user in self.users.items()}
            with open(USERS_FILE, "w") as f:
                json.dump(user_dict, f, default=str)
            logger.info(f"Saved {len(self.users)} users to storage")
        except Exception as e:
            logger.error(f"Error saving users: {e}")
    
    def create_user(self, email: str, password: Optional[str] = None) -> User:
        """
        Create a new user with the given email
        
        Args:
            email: User's email address
            password: Optional password (for password-based auth)
            
        Returns:
            The created User object
        """
        if email in self.users:
            logger.info(f"User {email} already exists")
            return self.users[email]
        
        # Create user object
        user = User(
            email=email,
            hashed_password=pwd_context.hash(password) if password else None
        )
        
        # Create user directory
        user_dir = USERS_DIR / email.replace("@", "_at_")
        user_dir.mkdir(exist_ok=True)
        index_dir = user_dir / "index"
        index_dir.mkdir(exist_ok=True)
        
        # Save user to storage
        self.users[email] = user
        self._save_users()
        logger.info(f"Created new user: {email}")
        
        return user
    
    def authenticate_user(self, email: str, password: Optional[str] = None) -> Optional[User]:
        """
        Authenticate a user by email and optional password
        
        Args:
            email: User's email
            password: Optional password (for password-based auth)
            
        Returns:
            User object if authenticated, None otherwise
        """
        if email not in self.users:
            logger.warning(f"Authentication failed: User {email} not found")
            return None
        
        user = self.users[email]
        
        # If password is provided and user has a password, verify it
        if password and user.hashed_password:
            if not pwd_context.verify(password, user.hashed_password):
                logger.warning(f"Authentication failed: Invalid password for {email}")
                return None
        
        # Update last login
        user.last_login = datetime.now(timezone.utc)
        self._save_users()
        
        return user
    
    def create_access_token(self, email: str) -> str:
        """
        Create a JWT access token for a user
        
        Args:
            email: User's email
            
        Returns:
            JWT token string
        """
        # Payload with claims
        expires = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        claims = {
            "sub": email,
            "exp": expires
        }
        
        # Create JWT token
        token = jwt.encode(claims, SECRET_KEY, algorithm=ALGORITHM)
        logger.info(f"Created access token for user: {email}")
        
        return token
    
    def verify_token(self, token: str) -> Optional[str]:
        """
        Verify a JWT token and extract the user email
        
        Args:
            token: JWT token string
            
        Returns:
            User email if valid, None otherwise
        """
        try:
            # Decode and verify token
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            email = payload.get("sub")
            
            if email is None or email not in self.users:
                logger.warning(f"Token verification failed: User not found")
                return None
                
            return email
        except JWTError as e:
            logger.warning(f"Token verification failed: {e}")
            return None
    
    def get_user_storage_path(self, email: str) -> Path:
        """
        Get the storage path for a user's data
        
        Args:
            email: User's email
            
        Returns:
            Path object pointing to user's storage directory
        """
        # Convert email to filesystem-safe format
        safe_email = email.replace("@", "_at_")
        return USERS_DIR / safe_email / "index"


# Global user manager instance
user_manager = UserManager() 