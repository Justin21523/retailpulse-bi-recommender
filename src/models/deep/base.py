"""Base class for all PyTorch deep learning models.

統一介面：fit / predict / evaluate / save / load
所有 DL 模型繼承此類，確保一致的使用方式。
"""
from __future__ import annotations

import pickle
from abc import ABC, abstractmethod
from pathlib import Path

import numpy as np

_MODELS_DIR = Path(__file__).parent.parent.parent.parent / "data" / "models"


class BaseDeepModel(ABC):
    """Abstract base class for PyTorch deep models.

    Subclasses must implement:
    - _build_net(): construct the torch.nn.Module
    - fit(): train the model
    - predict(): run inference
    - evaluate(): compute evaluation metrics
    """

    def __init__(self) -> None:
        self._net = None      # torch.nn.Module (set in subclass)
        self._scaler = None   # StandardScaler (set in subclass)

    @abstractmethod
    def fit(self, X: np.ndarray, y: np.ndarray | None = None, **kwargs) -> "BaseDeepModel":
        ...

    @abstractmethod
    def predict(self, X: np.ndarray) -> np.ndarray:
        ...

    @abstractmethod
    def evaluate(self, X: np.ndarray, y: np.ndarray) -> dict[str, float]:
        ...

    def save(self, path: Path) -> None:
        """Save model state_dict and scaler to disk."""
        try:
            import torch
        except ImportError:
            raise ImportError("PyTorch not installed. Run: make install-dl")
        path.parent.mkdir(parents=True, exist_ok=True)
        torch.save(self._net.state_dict(), path)
        scaler_path = path.with_suffix(".scaler.pkl")
        with open(scaler_path, "wb") as f:
            pickle.dump(self._scaler, f)

    @classmethod
    def load(cls, path: Path) -> "BaseDeepModel":
        """Restore model from saved state_dict (CPU-only)."""
        try:
            import torch
        except ImportError:
            raise ImportError("PyTorch not installed. Run: make install-dl")
        obj = cls.__new__(cls)
        obj.__init__()
        obj._build_net()
        obj._net.load_state_dict(torch.load(path, map_location="cpu"))
        obj._net.eval()
        scaler_path = path.with_suffix(".scaler.pkl")
        if scaler_path.exists():
            with open(scaler_path, "rb") as f:
                obj._scaler = pickle.load(f)
        return obj

    @abstractmethod
    def _build_net(self) -> None:
        """Instantiate self._net (torch.nn.Module)."""
        ...

    # Convenience path helpers
    @classmethod
    def default_path(cls) -> Path:
        return _MODELS_DIR / f"{cls.__name__.lower()}.pt"
