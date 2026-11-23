import os
import tempfile

os.environ["JWT_SECRET_KEY"] = "test-secret-key-for-pytest-only"
os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.gettempdir()}/receipt-backend-tests.db"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db, engine as app_engine
from app.main import app


@pytest.fixture(scope="session", autouse=True)
def reset_database():
    Base.metadata.drop_all(bind=app_engine)
    Base.metadata.create_all(bind=app_engine)
    yield
    Base.metadata.drop_all(bind=app_engine)


@pytest.fixture
def client(reset_database):
    def override_db():
        db = sessionmaker(bind=app_engine, autocommit=False, autoflush=False)()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def auth_headers(client):
    registered = client.post("/api/v1/auth/register", json={
        "name": "Test User",
        "email": "test@example.com",
        "password": "password123",
    })
    login = client.post("/api/v1/auth/login", json={
        "email": "test@example.com",
        "password": "password123",
    })
    assert registered.status_code in (201, 409)
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['access_token']}"}
