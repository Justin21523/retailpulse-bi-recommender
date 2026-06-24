"""Thompson Sampling Bandit — Reinforcement Learning for Recommendation.

學習方式：強化學習（Reinforcement Learning）— Multi-Armed Bandit
策略：Thompson Sampling（Beta 分佈先驗，用 Bayesian 更新）
5 個 Arm：FBT / Segment-RFM / Popularity / CF-ALS / SBERT-semantic
原理：根據歷史回饋（購買=1, 未購=0）動態調整各策略的選擇機率
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Literal

import numpy as np

from utils.logger import get_logger

log = get_logger(__name__)

_STATE_PATH = Path(__file__).parent.parent.parent.parent / "data" / "models" / "bandit_state.json"

# Arm 名稱對應推薦策略
ARM_NAMES = ["fbt", "segment", "popularity", "cf_als", "sbert_semantic"]

ArmName = Literal["fbt", "segment", "popularity", "cf_als", "sbert_semantic"]


class ThompsonSamplingBandit:
    """Thompson Sampling multi-armed bandit for recommendation strategy selection.

    Each arm corresponds to a recommendation strategy. At each request,
    Thompson Sampling draws θ_i ~ Beta(α_i, β_i) per arm and selects the arm
    with the highest sampled value. Rewards (1=purchase, 0=no-purchase)
    update the Beta distribution parameters.

    State is persisted as a lightweight JSON file for crash recovery.
    """

    def __init__(self) -> None:
        # Beta(α, β) parameters — start with uniform prior Beta(1,1)
        self._alpha = {arm: 1.0 for arm in ARM_NAMES}
        self._beta  = {arm: 1.0 for arm in ARM_NAMES}
        self._total_pulls = {arm: 0 for arm in ARM_NAMES}
        self._total_rewards = {arm: 0.0 for arm in ARM_NAMES}

    # ── Core Bandit API ───────────────────────────────────────────────────────

    def select_arm(self, rng_seed: int | None = None) -> str:
        """Sample θ_i ~ Beta(α_i, β_i) and return the arm with max θ.

        Args:
            rng_seed: Optional seed for reproducibility (e.g. in tests).

        Returns:
            Arm name (one of ARM_NAMES).
        """
        rng = np.random.default_rng(rng_seed)
        samples = {
            arm: rng.beta(self._alpha[arm], self._beta[arm])
            for arm in ARM_NAMES
        }
        chosen = max(samples, key=samples.get)
        log.debug(f"Bandit selected: {chosen} (samples={samples})")
        return chosen

    def update(self, arm: str, reward: float) -> None:
        """Update Beta parameters after observing a reward.

        Args:
            arm: The arm that was pulled.
            reward: 1.0 = converted (purchased), 0.0 = not converted.
        """
        if arm not in ARM_NAMES:
            log.warning(f"Unknown arm: {arm}")
            return
        reward = float(np.clip(reward, 0.0, 1.0))
        self._alpha[arm] += reward
        self._beta[arm]  += 1.0 - reward
        self._total_pulls[arm] += 1
        self._total_rewards[arm] += reward

    # ── Statistics ────────────────────────────────────────────────────────────

    def arm_stats(self) -> dict[str, dict]:
        """Return estimated conversion rate and confidence for each arm."""
        stats = {}
        for arm in ARM_NAMES:
            a, b = self._alpha[arm], self._beta[arm]
            mean = a / (a + b)
            variance = (a * b) / ((a + b) ** 2 * (a + b + 1))
            stats[arm] = {
                "estimated_ctr": round(mean, 4),
                "std": round(variance ** 0.5, 4),
                "alpha": a,
                "beta": b,
                "total_pulls": self._total_pulls[arm],
                "total_rewards": self._total_rewards[arm],
            }
        return stats

    def best_arm(self) -> str:
        """Return the arm with the highest current estimated CTR."""
        return max(ARM_NAMES, key=lambda a: self._alpha[a] / (self._alpha[a] + self._beta[a]))

    # ── Persistence ───────────────────────────────────────────────────────────

    def save(self, path: Path | None = None) -> None:
        p = path or _STATE_PATH
        p.parent.mkdir(parents=True, exist_ok=True)
        state = {
            "alpha": self._alpha,
            "beta": self._beta,
            "total_pulls": self._total_pulls,
            "total_rewards": self._total_rewards,
        }
        with open(p, "w") as f:
            json.dump(state, f, indent=2)
        log.info(f"Bandit state saved to {p}")

    @classmethod
    def load(cls, path: Path | None = None) -> "ThompsonSamplingBandit":
        p = path or _STATE_PATH
        obj = cls()
        if not p.exists():
            log.info("No bandit state found, starting with uniform prior.")
            return obj
        with open(p) as f:
            state = json.load(f)
        obj._alpha = state.get("alpha", obj._alpha)
        obj._beta  = state.get("beta", obj._beta)
        obj._total_pulls   = state.get("total_pulls", obj._total_pulls)
        obj._total_rewards = state.get("total_rewards", obj._total_rewards)
        log.info(f"Bandit state loaded from {p}, best_arm={obj.best_arm()}")
        return obj
