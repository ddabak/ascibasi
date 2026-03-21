import os
from datetime import datetime

from dotenv import load_dotenv
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey, Boolean, text as sa_text
from sqlalchemy import inspect as sa_inspect
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/turkrecipes"
)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()


class Recipe(Base):
    __tablename__ = "recipes"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    category = Column(String(100))
    ingredients = Column(Text, nullable=False)
    instructions = Column(Text, nullable=False)
    region = Column(String(100))


class ChatHistory(Base):
    __tablename__ = "chat_history"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(100), index=True)
    user_id = Column(String(100), index=True, nullable=True)
    role = Column(String(20))
    content = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)


class RecipeBook(Base):
    __tablename__ = "recipe_books"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(100), index=True, nullable=False)
    name = Column(String(200), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    folders = relationship("BookFolder", back_populates="book", cascade="all, delete-orphan")


class BookFolder(Base):
    __tablename__ = "book_folders"
    id = Column(Integer, primary_key=True, index=True)
    book_id = Column(Integer, ForeignKey("recipe_books.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(200), nullable=False)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    book = relationship("RecipeBook", back_populates="folders")
    recipes = relationship("SavedRecipe", back_populates="folder", cascade="all, delete-orphan")


class SavedRecipe(Base):
    __tablename__ = "saved_recipes"
    id = Column(Integer, primary_key=True, index=True)
    folder_id = Column(Integer, ForeignKey("book_folders.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(300), nullable=False)
    content = Column(Text, nullable=False)
    source_session = Column(String(100), nullable=True)
    saved_at = Column(DateTime, default=datetime.utcnow)
    share_token = Column(String(100), nullable=True, unique=True, index=True)
    rating = Column(Integer, nullable=True)  # 1-5
    folder = relationship("BookFolder", back_populates="recipes")


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    user_id = Column(String(100), unique=True, index=True)
    username = Column(String(100), nullable=False)
    first_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    birth_date = Column(String(20), nullable=True)
    email = Column(String(200), nullable=True, index=True)
    password_hash = Column(String(256), nullable=False)
    email_verified = Column(Boolean, default=False)
    verification_code = Column(String(10), nullable=True)
    verification_code_expires = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class SessionMeta(Base):
    __tablename__ = "session_meta"
    id = Column(Integer, primary_key=True)
    session_id = Column(String(100), unique=True, index=True)
    custom_title = Column(String(200), nullable=True)
    folder_id = Column(Integer, nullable=True)


class ChatFolder(Base):
    __tablename__ = "chat_folders"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(100), index=True, nullable=False)
    name = Column(String(200), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class RecipeCache(Base):
    __tablename__ = "recipe_cache"
    id = Column(Integer, primary_key=True)
    query_key = Column(String(200), unique=True, index=True)
    response = Column(Text)
    references_json = Column(Text, nullable=True)  # JSON string of reference URLs
    created_at = Column(DateTime, default=datetime.utcnow)


class SharedMessage(Base):
    __tablename__ = "shared_messages"
    id = Column(Integer, primary_key=True)
    share_token = Column(String(100), unique=True, index=True)
    title = Column(String(300), nullable=True)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class ShoppingList(Base):
    __tablename__ = "shopping_lists"
    id = Column(Integer, primary_key=True)
    user_id = Column(String(100), index=True)
    title = Column(String(200))
    items = Column(Text)  # JSON string of items
    created_at = Column(DateTime, default=datetime.utcnow)


def init_db():
    # NOTE: In production, use Alembic for proper database migrations.
    # SQLAlchemy's create_all is idempotent - it will not recreate tables that already exist.
    # However, it will NOT add new columns to existing tables.
    # For adding new columns to existing tables in production, use Alembic migrations.
    inspector = sa_inspect(engine)
    existing = inspector.get_table_names()

    # Create all tables that don't exist yet
    Base.metadata.create_all(bind=engine)

    # Attempt to add missing columns for existing tables gracefully
    # This handles the case where saved_recipes exists but share_token column is missing
    if "saved_recipes" in existing:
        columns = [col["name"] for col in inspector.get_columns("saved_recipes")]
        if "share_token" not in columns:
            try:
                with engine.connect() as conn:
                    conn.execute(
                        sa_text(
                            "ALTER TABLE saved_recipes ADD COLUMN share_token VARCHAR(100) UNIQUE"
                        )
                    )
                    conn.commit()
            except Exception:
                pass

    # Add rating to saved_recipes if missing (Feature: Recipe Rating)
    if "saved_recipes" in existing:
        columns = [col["name"] for col in inspector.get_columns("saved_recipes")]
        if "rating" not in columns:
            try:
                with engine.connect() as conn:
                    conn.execute(sa_text("ALTER TABLE saved_recipes ADD COLUMN rating INTEGER"))
                    conn.commit()
            except Exception:
                pass

    # Add user_id to chat_history if missing
    if "chat_history" in existing:
        columns = [col["name"] for col in inspector.get_columns("chat_history")]
        if "user_id" not in columns:
            try:
                with engine.connect() as conn:
                    conn.execute(sa_text("ALTER TABLE chat_history ADD COLUMN user_id VARCHAR(100)"))
                    conn.execute(sa_text("CREATE INDEX IF NOT EXISTS ix_chat_history_user_id ON chat_history (user_id)"))
                    conn.commit()
            except Exception:
                pass

        # Add deleted_at to chat_history if missing (Feature 3: Trash / Soft Delete)
        if "deleted_at" not in columns:
            try:
                with engine.connect() as conn:
                    conn.execute(sa_text("ALTER TABLE chat_history ADD COLUMN deleted_at TIMESTAMP"))
                    conn.commit()
            except Exception:
                pass

    # Add references_json to recipe_cache if missing
    if "recipe_cache" in existing:
        columns = [col["name"] for col in inspector.get_columns("recipe_cache")]
        if "references_json" not in columns:
            try:
                with engine.connect() as conn:
                    conn.execute(sa_text("ALTER TABLE recipe_cache ADD COLUMN references_json TEXT"))
                    conn.commit()
            except Exception:
                pass

    # Add rating to saved_recipes if missing
    if "saved_recipes" in existing:
        columns = [col["name"] for col in inspector.get_columns("saved_recipes")]
        if "rating" not in columns:
            try:
                with engine.connect() as conn:
                    conn.execute(sa_text("ALTER TABLE saved_recipes ADD COLUMN rating INTEGER"))
                    conn.commit()
            except Exception:
                pass

    # Add new columns to users if missing
    if "users" in existing:
        columns = [col["name"] for col in inspector.get_columns("users")]
        for col_name, col_def in [
            ("first_name", "VARCHAR(100)"),
            ("last_name", "VARCHAR(100)"),
            ("birth_date", "VARCHAR(20)"),
            ("email", "VARCHAR(200)"),
            ("email_verified", "BOOLEAN DEFAULT FALSE"),
            ("verification_code", "VARCHAR(10)"),
            ("verification_code_expires", "TIMESTAMP"),
        ]:
            if col_name not in columns:
                try:
                    with engine.connect() as conn:
                        conn.execute(sa_text(f"ALTER TABLE users ADD COLUMN {col_name} {col_def}"))
                        conn.commit()
                except Exception:
                    pass

    # Add folder_id to session_meta if missing (Feature: Chat Folders)
    if "session_meta" in existing:
        columns = [col["name"] for col in inspector.get_columns("session_meta")]
        if "folder_id" not in columns:
            try:
                with engine.connect() as conn:
                    conn.execute(sa_text("ALTER TABLE session_meta ADD COLUMN folder_id INTEGER"))
                    conn.commit()
            except Exception:
                pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
