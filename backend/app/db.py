import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# Override to keep a second dataset (e.g. the unseen seed-43 eval) out of the demo DB.
DATABASE_URL = os.environ.get("SAMANVAY_DB", "sqlite:///./samanvay.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
