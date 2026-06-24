"""Application configuration via Pydantic BaseSettings."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import yaml
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_ROOT = Path(__file__).parent.parent.parent
_YAML_PATH = _ROOT / "configs" / "settings.yaml"


def _load_yaml_defaults() -> dict:
    if _YAML_PATH.exists():
        with open(_YAML_PATH) as f:
            return yaml.safe_load(f) or {}
    return {}


_YAML = _load_yaml_defaults()


class Settings(BaseSettings):
    duckdb_path: str = _YAML.get("duckdb_path", "data/retailpulse.duckdb")
    log_level: str = _YAML.get("log_level", "INFO")
    api_host: str = _YAML.get("api_host", "0.0.0.0")
    api_port: int = _YAML.get("api_port", 8000)
    sample_data_path: str = _YAML.get("sample_data_path", "data/sample/sample_transactions.csv")
    rfm_n_clusters: int = _YAML.get("rfm_n_clusters", 4)
    mba_min_support: float = _YAML.get("mba_min_support", 0.02)
    mba_min_confidence: float = _YAML.get("mba_min_confidence", 0.1)
    top_n_default: int = _YAML.get("top_n_default", 10)

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @field_validator("duckdb_path", "sample_data_path", mode="before")
    @classmethod
    def resolve_path(cls, v: str) -> str:
        """Resolve relative paths from project root."""
        p = Path(v)
        if not p.is_absolute():
            return str(_ROOT / p)
        return v


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
