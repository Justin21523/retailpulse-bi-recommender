"""Tests for the FastAPI health endpoint."""
from __future__ import annotations

from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)


def test_health_returns_200() -> None:
    response = client.get("/health")
    assert response.status_code == 200


def test_health_status_ok() -> None:
    response = client.get("/health")
    assert response.json()["status"] == "ok"


def test_health_has_timestamp() -> None:
    response = client.get("/health")
    assert "timestamp" in response.json()


def test_health_has_version() -> None:
    response = client.get("/health")
    assert "version" in response.json()


def test_docs_endpoint_reachable() -> None:
    response = client.get("/docs")
    assert response.status_code == 200
