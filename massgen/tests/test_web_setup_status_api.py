"""Tests for Web UI setup status API."""

from types import SimpleNamespace
from unittest.mock import patch

from fastapi.testclient import TestClient

from massgen.frontend.web.server import create_app


def test_setup_status_prefers_project_config(monkeypatch, tmp_path) -> None:
    """Project-local quickstart config should satisfy setup checks."""
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("HOME", str(tmp_path / "home"))

    project_config = tmp_path / ".massgen" / "config.yaml"
    project_config.parent.mkdir(parents=True, exist_ok=True)
    project_config.write_text("agents: []\n", encoding="utf-8")

    app = create_app()
    client = TestClient(app)

    with patch("massgen.utils.docker_diagnostics.diagnose_docker") as mock_diag:
        mock_diag.return_value = SimpleNamespace(
            is_available=False,
            status=SimpleNamespace(value="unavailable"),
            error_message="docker not running",
            resolution_steps=["start docker"],
        )
        response = client.get("/api/setup/status")

    assert response.status_code == 200
    payload = response.json()
    assert payload["needs_setup"] is False
    assert payload["has_config"] is True
    assert payload["config_path"] == str(project_config)


def test_setup_status_falls_back_to_global_config(monkeypatch, tmp_path) -> None:
    """Global config should be used when project config is absent."""
    monkeypatch.chdir(tmp_path)
    home_dir = tmp_path / "home"
    monkeypatch.setenv("HOME", str(home_dir))

    global_config = home_dir / ".config" / "massgen" / "config.yaml"
    global_config.parent.mkdir(parents=True, exist_ok=True)
    global_config.write_text("agents: []\n", encoding="utf-8")

    app = create_app()
    client = TestClient(app)

    with patch("massgen.utils.docker_diagnostics.diagnose_docker") as mock_diag:
        mock_diag.return_value = SimpleNamespace(
            is_available=True,
            status=SimpleNamespace(value="available"),
            error_message=None,
            resolution_steps=[],
        )
        response = client.get("/api/setup/status")

    assert response.status_code == 200
    payload = response.json()
    assert payload["needs_setup"] is False
    assert payload["has_config"] is True
    assert payload["config_path"] == str(global_config)
