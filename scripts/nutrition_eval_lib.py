#!/usr/bin/env python3
"""
scripts/nutrition_eval_lib.py

Shared, standard-library-only primitives for the nutrition sampling and
FoodData Central discovery evaluation scripts (Sprint 52 / ADR 0037).

Deliberately not imported by scripts/evaluate-fooddata-central.py: that
script's SHA-256 is recorded as evaluated evidence in
docs/fooddata-central-coverage-evaluation.md, and importing this module
into it would change its hash without re-evaluating anything.
"""

from __future__ import annotations

import hashlib
import math
import re
from typing import Dict, List, Optional, Sequence, Tuple
import random


class InsufficientSampleFrameError(ValueError):
    """Raised when a sampling frame cannot supply the required sample size."""


def derive_seed(seed: int, label: str) -> int:
    """
    Deterministic per-stratum sub-seed, independent of any given process's
    PYTHONHASHSEED. A tuple seed (seed, label) would rely on random.Random
    falling back to Python's built-in hash() for non-str/bytes/int types,
    which is randomized per process by default and breaks reproducibility
    across separate CLI invocations with the same --seed.
    """
    digest = hashlib.sha256(f"{seed}:{label}".encode("utf-8")).digest()
    return int.from_bytes(digest[:8], "big")


def sha256(path: str) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as source:
        while chunk := source.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def gtin_check_digit_is_valid(value: str) -> bool:
    if len(value) not in (8, 12, 13, 14) or not value.isdigit():
        return False
    digits = [int(character) for character in value]
    payload = digits[:-1]
    total = sum(
        digit * (3 if (len(payload) - index) % 2 == 1 else 1)
        for index, digit in enumerate(payload)
    )
    expected = (10 - total % 10) % 10
    return expected == digits[-1]


def normalize_gtin(value: str) -> Optional[str]:
    stripped = value.strip()
    if not gtin_check_digit_is_valid(stripped):
        return None
    return stripped.zfill(14)


def wilson_score_interval(
    successes: int, total: int, confidence: float = 0.95
) -> Tuple[float, float, float]:
    """Point estimate and Wilson score 95% CI, no continuity correction (ADR 0037)."""
    if total == 0:
        return 0.0, 0.0, 0.0
    if successes < 0 or successes > total:
        raise ValueError("successes must be between 0 and total")
    if confidence != 0.95:
        raise ValueError("only the fixed 95% two-sided interval is supported")
    z = 1.95996
    p_hat = successes / total
    denominator = 1 + (z ** 2) / total
    center = (p_hat + (z ** 2) / (2 * total)) / denominator
    half_width = (z / denominator) * math.sqrt(
        (p_hat * (1 - p_hat)) / total + (z ** 2) / (4 * total ** 2)
    )
    lower = max(0.0, center - half_width)
    upper = min(1.0, center + half_width)
    return p_hat, lower, upper


def weighted_sample_without_replacement(
    items: Sequence, weights: Sequence[float], k: int, rng: random.Random
) -> List:
    """Efraimidis-Spirakis A-ES weighted sampling without replacement."""
    if k < 0:
        raise ValueError("k must not be negative")
    if k > len(items):
        raise ValueError(
            f"cannot sample {k} items without replacement from a pool of {len(items)}"
        )
    if len(items) != len(weights):
        raise ValueError("items and weights must be the same length")
    if k == len(items):
        return list(items)
    keyed = []
    for item, weight in zip(items, weights):
        w = max(float(weight), 1e-9)
        key = rng.random() ** (1.0 / w)
        keyed.append((key, item))
    keyed.sort(key=lambda pair: pair[0], reverse=True)
    return [item for _, item in keyed[:k]]


def allocate_quota(pool_sizes: Dict[str, int], sample_size: int) -> Dict[str, int]:
    """
    Deterministic per-category quota allocation summing to exactly sample_size.

    Starts from an even split, caps each category at its own pool size, then
    redistributes the shortfall one slot at a time in alphabetical round-robin
    over categories still below capacity until the target is fully allocated.
    """
    if sample_size < 0:
        raise ValueError("sample_size must not be negative")
    if not pool_sizes:
        if sample_size == 0:
            return {}
        raise InsufficientSampleFrameError(
            "no categories available in the sampling frame"
        )
    total_pool = sum(pool_sizes.values())
    if total_pool < sample_size:
        raise InsufficientSampleFrameError(
            f"sample frame has only {total_pool} eligible items across "
            f"{len(pool_sizes)} categories; {sample_size} required"
        )

    categories = sorted(pool_sizes)
    base = sample_size // len(categories)
    allocation = {category: min(base, pool_sizes[category]) for category in categories}
    remaining = sample_size - sum(allocation.values())

    while remaining > 0:
        progressed = False
        for category in categories:
            if remaining <= 0:
                break
            if allocation[category] < pool_sizes[category]:
                allocation[category] += 1
                remaining -= 1
                progressed = True
        if not progressed:
            raise InsufficientSampleFrameError(
                "unable to allocate remaining quota despite sufficient total pool"
            )

    return allocation


_PUNCTUATION_PATTERN = re.compile(r"[^a-z0-9\s-]")
_WHITESPACE_PATTERN = re.compile(r"\s+")


def normalize_food_name(name: str) -> str:
    """
    Case/whitespace/punctuation/simple-plural normalization only.

    Deliberately preserves brand, variant ("diet", "zero", "light",
    "original"), size/quantity, and preparation ("raw", "cooked", "frozen",
    "canned") tokens, since the coverage evaluation's match definitions
    require those distinctions to survive normalization.
    """
    text = name.strip().strip("\"'").lower()
    text = _PUNCTUATION_PATTERN.sub(" ", text)
    text = _WHITESPACE_PATTERN.sub(" ", text).strip()

    tokens = []
    for token in text.split(" "):
        # Naive trailing-"s" singularization: mangles some real words (e.g.
        # "tomatoes" -> "tomatoe"), but the false-positive guard below (ss,
        # us, is) prevents the worst cases ("hummus", "swiss") and this is
        # only used for fuzzy ranking, not identity.
        if len(token) > 3 and token.endswith("s") and not token.endswith(("ss", "us", "is")):
            token = token[:-1]
        tokens.append(token)
    return " ".join(tokens)
