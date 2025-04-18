from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# --- Import necessary modules from our application --- 
import os
import sys
from dotenv import load_dotenv

# Load .env file from the project root
# Adjust path if alembic env.py is located differently relative to .env
DOTENV_PATH = os.path.join(os.path.dirname(__file__), '..', '..', '.env')
if os.path.exists(DOTENV_PATH):
    print(f"[env.py] Loading variables from {DOTENV_PATH}")
    load_dotenv(dotenv_path=DOTENV_PATH)
else:
    print(f"[env.py] Warning: .env file not found at {DOTENV_PATH}")

# --- Path Setup --- 
# Add project root to sys.path to allow imports like python_server.database
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../'))
sys.path.insert(0, PROJECT_ROOT)

# --- Load .env file ---
# Load environment variables (needed potentially if running alembic CLI directly)
dotenv_path = os.path.join(PROJECT_ROOT, '.env')
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path=dotenv_path)
    print("[env.py] Loaded variables from .env")
else:
    print("[env.py] .env file not found, relying on environment variables.")
# --- End Load .env file ---

# Now import Base from our application's database module
from python_server.database import Base 
# Import models to ensure they are registered with Base metadata
from python_server import models 

# --- End application imports ---

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line potentially overrides logging config set elsewhere.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# --- Set target metadata --- 
# add your model's MetaData object here
# for 'autogenerate' support
# from myapp import mymodel
# target_metadata = mymodel.Base.metadata
target_metadata = Base.metadata # Use Base from our database module
# --- End target metadata ---

# other values from the config, defined by the needs of env.py,
# can be acquired:-
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    # Get the database URL from environment AFTER loading .env
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        raise ValueError("DATABASE_URL environment variable not set or .env file not loaded.")

    # Create engine configuration dictionary, explicitly setting the URL
    engine_config = config.get_section(config.config_ini_section, {})
    engine_config['sqlalchemy.url'] = db_url # Override URL from .ini with env var
    
    print(f"[env.py] Using DB URL from environment: {db_url[:db_url.find(':')+1]}...@{db_url[db_url.rfind('@')+1:]}") # Log sanitized URL

    connectable = engine_from_config(
        # engine_config, # Pass the modified config dictionary
        # Use the explicitly set db_url instead of relying on engine_from_config to read it again
        # This seems more robust
        {'sqlalchemy.url': db_url}, # Provide URL directly
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
