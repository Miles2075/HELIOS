import sqlite3
from pathlib import Path

DATABASE_PATH = Path("backend/helios.db")


def get_connection() -> sqlite3.Connection:
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def initialize_database() -> None:
    connection = get_connection()

    # Shared Smart Search, Quiz Master & Brain Map tables
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            file_path TEXT NOT NULL,
            uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )

    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS document_pages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            document_id INTEGER NOT NULL,
            page_number INTEGER NOT NULL,
            text TEXT NOT NULL,
            FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
        )
        """
    )

    # Lecture Sync persistent tables
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS lectures (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            file_path TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'uploaded',
            duration REAL NOT NULL DEFAULT 0.0,
            engine TEXT NOT NULL DEFAULT 'pending',
            uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )

    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS lecture_segments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lecture_id INTEGER NOT NULL,
            segment_index INTEGER NOT NULL,
            start_time REAL NOT NULL,
            end_time REAL NOT NULL,
            text TEXT NOT NULL,
            FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE
        )
        """
    )

    # Lecture Sync extracted visual frames (diagrams, equations, graphs, slides, whiteboard)
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS lecture_visuals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lecture_id INTEGER NOT NULL,
            timestamp REAL NOT NULL,
            visual_type TEXT NOT NULL DEFAULT 'slide',
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            ocr_text TEXT DEFAULT '',
            latex TEXT DEFAULT '',
            image_path TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE
        )
        """
    )

    # Data Storyteller persistent table
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS datasets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            file_path TEXT NOT NULL,
            uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )

    connection.commit()
    connection.close()
