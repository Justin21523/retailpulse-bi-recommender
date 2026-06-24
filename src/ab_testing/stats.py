"""A/B Testing Statistical Functions.

提供：z-test（比例）、Welch t-test（均值）、Cohen's d（效果量）、
多重校正（Bonferroni）、最小樣本量計算（power analysis）
"""
from __future__ import annotations

import math

import numpy as np
from scipy import stats


def two_proportion_z_test(
    n_control: int,
    n_treatment: int,
    conv_control: int,
    conv_treatment: int,
    alpha: float = 0.05,
) -> dict[str, float | bool]:
    """Two-proportion z-test for comparing conversion rates.

    Args:
        n_control: Total observations in control group.
        n_treatment: Total observations in treatment group.
        conv_control: Conversions in control group.
        conv_treatment: Conversions in treatment group.
        alpha: Significance level.

    Returns:
        Dict with z_stat, p_value, control_rate, treatment_rate, effect_size (Cohen's h), significant.
    """
    if n_control == 0 or n_treatment == 0:
        return {"z_stat": 0.0, "p_value": 1.0, "control_rate": 0.0,
                "treatment_rate": 0.0, "effect_size": 0.0, "significant": False}

    p_c = conv_control / n_control
    p_t = conv_treatment / n_treatment
    # Pooled proportion
    p_pool = (conv_control + conv_treatment) / (n_control + n_treatment)
    se = math.sqrt(p_pool * (1 - p_pool) * (1 / n_control + 1 / n_treatment))
    if se == 0:
        return {"z_stat": 0.0, "p_value": 1.0, "control_rate": p_c,
                "treatment_rate": p_t, "effect_size": 0.0, "significant": False}
    z_stat = (p_t - p_c) / se
    p_value = 2 * (1 - stats.norm.cdf(abs(z_stat)))
    h = cohens_h(p_c, p_t)
    return {
        "z_stat": float(z_stat),
        "p_value": float(p_value),
        "control_rate": float(p_c),
        "treatment_rate": float(p_t),
        "effect_size": float(h),
        "significant": bool(p_value < alpha),
    }


def welch_t_test(
    group_a: list[float] | np.ndarray,
    group_b: list[float] | np.ndarray,
    alpha: float = 0.05,
) -> dict[str, float | bool]:
    """Welch's t-test for comparing means of two independent groups.

    Assumes unequal variance (Welch = more robust than Student's).
    """
    a, b = np.asarray(group_a, dtype=float), np.asarray(group_b, dtype=float)
    if len(a) < 2 or len(b) < 2:
        return {"t_stat": 0.0, "p_value": 1.0, "mean_a": float(a.mean()),
                "mean_b": float(b.mean()), "effect_size": 0.0, "significant": False}
    t_stat, p_value = stats.ttest_ind(a, b, equal_var=False)
    d = cohens_d(a, b)
    return {
        "t_stat": float(t_stat),
        "p_value": float(p_value),
        "mean_a": float(a.mean()),
        "mean_b": float(b.mean()),
        "effect_size": float(d),
        "significant": bool(p_value < alpha),
    }


def cohens_d(
    group_a: list[float] | np.ndarray,
    group_b: list[float] | np.ndarray,
) -> float:
    """Cohen's d effect size for two independent groups."""
    a, b = np.asarray(group_a, dtype=float), np.asarray(group_b, dtype=float)
    pooled_std = math.sqrt((np.var(a, ddof=1) + np.var(b, ddof=1)) / 2)
    if pooled_std == 0:
        return 0.0
    return float((a.mean() - b.mean()) / pooled_std)


def cohens_h(p1: float, p2: float) -> float:
    """Cohen's h effect size for two proportions."""
    return float(2 * math.asin(math.sqrt(max(p1, 0))) - 2 * math.asin(math.sqrt(max(p2, 0))))


def bonferroni_correction(
    p_values: list[float],
    alpha: float = 0.05,
) -> list[bool]:
    """Bonferroni correction for multiple hypothesis testing.

    Returns list of booleans: True = significant after correction.
    """
    threshold = alpha / len(p_values) if p_values else alpha
    return [p < threshold for p in p_values]


def required_sample_size(
    baseline_rate: float,
    mde: float,
    power: float = 0.8,
    alpha: float = 0.05,
) -> int:
    """Calculate minimum sample size per group for a two-proportion test.

    Args:
        baseline_rate: Conversion rate of the control group.
        mde: Minimum detectable effect (absolute lift), e.g. 0.02 = +2%.
        power: Desired statistical power (1 - β). Default 0.8.
        alpha: Significance level. Default 0.05.

    Returns:
        Required sample size per group (integer).
    """
    p1 = baseline_rate
    p2 = baseline_rate + mde
    p_avg = (p1 + p2) / 2
    z_alpha = stats.norm.ppf(1 - alpha / 2)
    z_beta  = stats.norm.ppf(power)
    se = math.sqrt(2 * p_avg * (1 - p_avg))
    effect = abs(p2 - p1)
    if effect == 0:
        return 0
    n = ((z_alpha + z_beta) * se / effect) ** 2
    return math.ceil(n)


def confidence_interval(
    values: list[float] | np.ndarray,
    confidence: float = 0.95,
) -> tuple[float, float]:
    """Bootstrap confidence interval for a sample mean."""
    v = np.asarray(values, dtype=float)
    if len(v) == 0:
        return (0.0, 0.0)
    se = stats.sem(v)
    h = se * stats.t.ppf((1 + confidence) / 2, df=len(v) - 1)
    return (float(v.mean() - h), float(v.mean() + h))
