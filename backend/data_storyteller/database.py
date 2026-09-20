import sqlite3
from pathlib import Path


# Location of the SQLite database
BASE_DIR = Path(__file__).resolve().parent
STORAGE_DIR = BASE_DIR / "storage"
DATABASE_PATH = STORAGE_DIR / "helios.db"


def get_connection():
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)

    connection = sqlite3.connect(DATABASE_PATH)

    return connection


def initialize_database():
    connection = get_connection()

    connection.execute("""
        CREATE TABLE IF NOT EXISTS datasets (
            dataset_id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            file_path TEXT NOT NULL
        )
    """)

    connection.commit()
    connection.close()


def create_dataset(filename, file_path):
    connection = get_connection()

    cursor = connection.execute(
        """
        INSERT INTO datasets (filename, file_path)
        VALUES (?, ?)
        """,
        (filename, file_path)
    )

    dataset_id = cursor.lastrowid

    connection.commit()
    connection.close()

    return dataset_id


def get_dataset(dataset_id):
    connection = get_connection()

    cursor = connection.execute(
        """
        SELECT dataset_id, filename, file_path
        FROM datasets
        WHERE dataset_id = ?
        """,
        (dataset_id,)
    )

    dataset = cursor.fetchone()

    connection.close()

    return dataset