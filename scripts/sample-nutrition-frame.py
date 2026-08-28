#!/usr/bin/env python3
"""
scripts/sample-nutrition-frame.py

Extracts reproducible, stratified evaluation samples from independent nutrition frames:
1. CDC/USDA NHANES WWEIA food frequency distribution (Ordinary foods).
2. Open Food Facts US snapshot (Branded names & Exact retail barcodes).

Follows ADR 0037 and docs/nutrition-sampling-frame-evaluation.md.
Uses standard library only. Compatible with Python 3.9+.

method_version 2 corrects Sprint 52's confirmed defects in the original
sampler (deterministic top-N-by-frequency instead of weighted random
sampling, an unused RNG, an 8-category 385/8=384 shortfall with no
backfill, broken TSV detection, silent uncategorized-item bias into
canned_preserved, silent missing-input skipping, and no proof a stratum
reached its target size). The ADR-approved frame selection and thresholds
are unchanged; only the sampler's faithfulness to that approved methodology
is corrected, per Sprint 52's allowance for defect corrections.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import json
import os
import random
import sys
from collections import Counter, defaultdict
from typing import Dict, List, Optional, Tuple

from nutrition_eval_lib import (
    InsufficientSampleFrameError,
    allocate_quota,
    derive_seed,
    normalize_gtin,
    sha256,
    weighted_sample_without_replacement,
)

METHOD_VERSION = 2

# Real-world Open Food Facts exports carry free-text fields (e.g.
# ingredients_text) well past Python's 128 KiB csv default; raise the limit
# rather than truncate or drop rows. sys.maxsize can raise OverflowError on
# some platforms' C long, so fall back to a still-generous fixed value.
try:
    csv.field_size_limit(sys.maxsize)
except OverflowError:
    csv.field_size_limit(10_000_000)

STANDARD_RETAIL_CATEGORIES = (
    "dairy",
    "grains_bakery",
    "snacks_sweets",
    "beverages",
    "meats_seafood",
    "prepared_frozen",
    "condiments_sauces",
    "canned_preserved",
)


def categorize_product(categories_tags: str, product_name: str) -> Optional[str]:
    """Assigns one of the 8 fixed retail categories, or None if none match."""
    text = (categories_tags + " " + product_name).lower()
    if any(k in text for k in ("dairy", "milk", "cheese", "yogurt", "butter", "plant-based-milk")):
        return "dairy"
    if any(k in text for k in ("cereal", "bread", "bakery", "pasta", "flour", "rice", "grain", "oat", "cookie", "cake")):
        return "grains_bakery"
    if any(k in text for k in ("snack", "chip", "popcorn", "candy", "chocolate", "sweet", "cracker", "bar", "confection")):
        return "snacks_sweets"
    if any(k in text for k in ("beverage", "drink", "juice", "soda", "water", "coffee", "tea")):
        return "beverages"
    if any(k in text for k in ("meat", "beef", "chicken", "pork", "turkey", "fish", "seafood", "salmon", "tuna")):
        return "meats_seafood"
    if any(k in text for k in ("frozen", "meal", "pizza", "burrito", "entree", "prepared")):
        return "prepared_frozen"
    if any(k in text for k in ("sauce", "dressing", "condiment", "ketchup", "mustard", "mayonnaise", "dip", "salsa", "oil", "vinegar")):
        return "condiments_sauces"
    if any(k in text for k in ("can", "canned", "jar", "preserve", "pickle", "jam", "soup")):
        return "canned_preserved"
    return None


def detect_delimiter_and_format(path: str) -> Tuple[str, str]:
    """Returns (format, delimiter); format is 'json' or 'csv'. Ignores a trailing .gz."""
    name = path[:-3] if path.endswith(".gz") else path
    if name.endswith(".jsonl") or name.endswith(".json"):
        return "json", ""
    if name.endswith(".csv"):
        return "csv", ","
    if name.endswith(".tsv"):
        return "csv", "\t"
    raise ValueError(f"unrecognized nutrition frame file extension: {path}")


def sample_wweia_ordinary(csv_path: str, sample_size: int, rng: random.Random) -> List[Dict]:
    """
    Draws a stratified, frequency-weighted random sample of unique food
    concepts from a WWEIA / NHANES frequency CSV.
    Expected columns: food_code, food_description, reporting_frequency, wweia_category_description
    """
    items: List[Dict] = []
    with open(csv_path, "r", encoding="utf-8-sig") as source:
        reader = csv.DictReader(source)
        for row in reader:
            food_code = row.get("food_code", "").strip()
            description = row.get("food_description", "").strip()
            category = row.get("wweia_category_description", "").strip() or "General"
            freq_str = row.get("reporting_frequency", "1").strip()
            try:
                frequency = int(freq_str)
            except ValueError:
                frequency = 1
            if food_code and description:
                items.append({
                    "food_code": food_code,
                    "query": description,
                    "category": category,
                    "reporting_frequency": max(frequency, 1),
                })

    if not items:
        raise InsufficientSampleFrameError(f"no valid ordinary food rows found in {csv_path}")

    by_category: Dict[str, List[Dict]] = defaultdict(list)
    for item in items:
        by_category[item["category"]].append(item)

    pool_sizes = {category: len(entries) for category, entries in by_category.items()}
    quota = allocate_quota(pool_sizes, sample_size)

    sampled: List[Dict] = []
    for category in sorted(quota):
        take = quota[category]
        if take == 0:
            continue
        entries = by_category[category]
        weights = [entry["reporting_frequency"] for entry in entries]
        sampled.extend(weighted_sample_without_replacement(entries, weights, take, rng))

    if len(sampled) != sample_size:
        raise AssertionError(
            f"ordinary-food sample size {len(sampled)} does not equal requested {sample_size}"
        )
    return sampled


def sample_openfoodfacts_us(
    input_path: str,
    branded_sample_size: int,
    barcode_sample_size: int,
    branded_rng: random.Random,
    barcode_rng: random.Random,
) -> Tuple[List[Dict], List[Dict], int]:
    """
    Parses an Open Food Facts US export and draws stratified, unweighted
    random samples for branded names and barcodes (OFF is an unweighted
    retail-assortment frame; there is no consumption-frequency signal to
    weight by).
    Input can be .jsonl, .jsonl.gz, .csv, .csv.gz, .tsv, or .tsv.gz.
    """
    file_format, delimiter = detect_delimiter_and_format(input_path)
    open_func = gzip.open if input_path.endswith(".gz") else open

    valid_by_category: Dict[str, List[Dict]] = defaultdict(list)
    gtin_seen: set = set()
    excluded_uncategorized = 0

    def process_record(record: dict) -> None:
        nonlocal excluded_uncategorized
        raw_code = str(record.get("code", "")).strip()
        countries = str(record.get("countries_tags", record.get("countries", ""))).lower()
        if "united-states" not in countries and "en:us" not in countries and "usa" not in countries:
            return

        norm_gtin = normalize_gtin(raw_code)
        if norm_gtin is None or norm_gtin in gtin_seen:
            return

        brand = str(record.get("brands", "")).strip()
        product_name = str(record.get("product_name", record.get("product_name_en", ""))).strip()
        categories = str(record.get("categories_tags", record.get("categories", ""))).strip()

        if not product_name or len(product_name) < 2:
            return

        gtin_seen.add(norm_gtin)
        category = categorize_product(categories, product_name)
        if category is None:
            excluded_uncategorized += 1
            return

        query = (
            f"{brand} {product_name}".strip()
            if brand and not product_name.lower().startswith(brand.lower())
            else product_name
        )

        valid_by_category[category].append({
            "raw_gtin": raw_code,
            "canonical_gtin": norm_gtin,
            "brand": brand,
            "product_name": product_name,
            "query": query,
            "category": category,
        })

    with open_func(input_path, "rt", encoding="utf-8", errors="replace") as stream:
        if file_format == "json":
            for line in stream:
                line = line.strip()
                if line:
                    try:
                        process_record(json.loads(line))
                    except json.JSONDecodeError:
                        continue
        else:
            reader = csv.DictReader(stream, delimiter=delimiter)
            for row in reader:
                process_record(row)

    pool_sizes = {category: len(valid_by_category[category]) for category in STANDARD_RETAIL_CATEGORIES}

    branded_quota = allocate_quota(pool_sizes, branded_sample_size)
    barcode_quota = allocate_quota(pool_sizes, barcode_sample_size)

    branded_samples: List[Dict] = []
    for category in sorted(branded_quota):
        take = branded_quota[category]
        if take:
            branded_samples.extend(branded_rng.sample(valid_by_category[category], take))

    barcode_samples: List[Dict] = []
    for category in sorted(barcode_quota):
        take = barcode_quota[category]
        if take:
            barcode_samples.extend(barcode_rng.sample(valid_by_category[category], take))

    if len(branded_samples) != branded_sample_size:
        raise AssertionError(
            f"branded-name sample size {len(branded_samples)} does not equal requested {branded_sample_size}"
        )
    if len(barcode_samples) != barcode_sample_size:
        raise AssertionError(
            f"barcode sample size {len(barcode_samples)} does not equal requested {barcode_sample_size}"
        )

    return branded_samples, barcode_samples, excluded_uncategorized


def main() -> None:
    parser = argparse.ArgumentParser(description="Sample independent nutrition evaluation frames (ADR 0037).")
    parser.add_argument("--wweia-csv", required=True, help="Path to WWEIA / NHANES frequency CSV")
    parser.add_argument("--off-dump", required=True, help="Path to Open Food Facts US export (.csv/.tsv/.jsonl, optionally .gz)")
    parser.add_argument("--seed", type=int, default=20260827, help="Random seed for reproducibility")
    parser.add_argument("--sample-size", type=int, default=385, help="Target sample size per stratum (default: 385)")
    parser.add_argument("--samples-output", required=True, help="Path to write raw per-item sample rows (keep outside Git)")
    parser.add_argument("--summary-output", required=True, help="Path to write the git-safe aggregate summary")
    args = parser.parse_args()

    for label, path in (("--wweia-csv", args.wweia_csv), ("--off-dump", args.off_dump)):
        if not os.path.exists(path):
            sys.exit(f"error: {label} does not exist: {path}")

    ordinary_rng = random.Random(derive_seed(args.seed, "ordinary"))
    branded_rng = random.Random(derive_seed(args.seed, "branded"))
    barcode_rng = random.Random(derive_seed(args.seed, "barcode"))

    print(f"Sampling ordinary foods from {args.wweia_csv}...")
    ordinary = sample_wweia_ordinary(args.wweia_csv, args.sample_size, ordinary_rng)

    print(f"Sampling branded names and barcodes from {args.off_dump}...")
    branded, barcodes, excluded_uncategorized = sample_openfoodfacts_us(
        args.off_dump, args.sample_size, args.sample_size, branded_rng, barcode_rng,
    )

    wweia_hash = sha256(args.wweia_csv)
    off_hash = sha256(args.off_dump)

    raw = {
        "generator": "scripts/sample-nutrition-frame.py",
        "method_version": METHOD_VERSION,
        "market": "United States (US)",
        "seed": args.seed,
        "target_sample_size_per_stratum": args.sample_size,
        "strata": {
            "ordinary_foods": {
                "source": "CDC/USDA NHANES WWEIA Dietary Recall Frequency",
                "source_file_sha256": wweia_hash,
                "samples": ordinary,
            },
            "branded_names": {
                "source": "Open Food Facts US Snapshot (Unweighted Retail Assortment Frame)",
                "source_file_sha256": off_hash,
                "samples": branded,
            },
            "exact_barcodes": {
                "source": "Open Food Facts US Snapshot (Unweighted Retail Assortment Frame)",
                "source_file_sha256": off_hash,
                "samples": barcodes,
            },
        },
    }

    summary = {
        "generator": "scripts/sample-nutrition-frame.py",
        "method_version": METHOD_VERSION,
        "market": "United States (US)",
        "seed": args.seed,
        "target_sample_size_per_stratum": args.sample_size,
        "strata": {
            "ordinary_foods": {
                "source": "CDC/USDA NHANES WWEIA Dietary Recall Frequency",
                "source_file_sha256": wweia_hash,
                "sample_count": len(ordinary),
                "category_distribution": dict(sorted(Counter(x["category"] for x in ordinary).items())),
            },
            "branded_names": {
                "source": "Open Food Facts US Snapshot (Unweighted Retail Assortment Frame)",
                "source_file_sha256": off_hash,
                "sample_count": len(branded),
                "category_distribution": dict(sorted(Counter(x["category"] for x in branded).items())),
                "excluded_uncategorized_count": excluded_uncategorized,
            },
            "exact_barcodes": {
                "source": "Open Food Facts US Snapshot (Unweighted Retail Assortment Frame)",
                "source_file_sha256": off_hash,
                "sample_count": len(barcodes),
                "category_distribution": dict(sorted(Counter(x["category"] for x in barcodes).items())),
                "excluded_uncategorized_count": excluded_uncategorized,
            },
        },
    }

    with open(args.samples_output, "w", encoding="utf-8") as dest:
        json.dump(raw, dest, indent=2, sort_keys=True)
        dest.write("\n")

    with open(args.summary_output, "w", encoding="utf-8") as dest:
        json.dump(summary, dest, indent=2, sort_keys=True)
        dest.write("\n")

    print(f"Raw samples written to {args.samples_output}")
    print(f"Git-safe summary written to {args.summary_output}")


if __name__ == "__main__":
    main()
