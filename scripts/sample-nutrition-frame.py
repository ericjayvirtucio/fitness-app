#!/usr/bin/env python3
"""
scripts/sample-nutrition-frame.py

Extracts reproducible, stratified evaluation samples from independent nutrition frames:
1. CDC/USDA NHANES WWEIA food frequency distribution (Ordinary foods).
2. Open Food Facts US snapshot (Branded names & Exact retail barcodes).

Follows ADR 0037 and docs/nutrition-sampling-frame-evaluation.md.
Uses standard library only. Compatible with Python 3.9+.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import io
import json
import math
import os
import random
import re
import sys
import zipfile
from collections import Counter, defaultdict
from typing import Dict, List, Optional, Set, Tuple


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


def wilson_score_interval(successes: int, total: int, confidence: float = 0.95) -> Tuple[float, float, float]:
    """Computes the point estimate and Wilson score 95% confidence interval."""
    if total == 0:
        return 0.0, 0.0, 0.0
    p_hat = successes / total
    z = 1.95996  # 95% two-sided z-score
    denominator = 1 + (z ** 2) / total
    center = (p_hat + (z ** 2) / (2 * total)) / denominator
    spread = (z * math.sqrt((p_hat * (1 - p_hat) + (z ** 2) / (4 * total)) / total)) / denominator
    lower = max(0.0, center - spread)
    upper = min(1.0, center + spread)
    return p_hat, lower, upper


def categorize_product(categories_tags: str, product_name: str) -> str:
    """Assigns an item to one of the 8 standard retail categories based on taxonomy tags and keywords."""
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
    return "canned_preserved"


def sample_wweia_ordinary(csv_path: str, sample_size: int, seed: int) -> List[Dict]:
    """
    Samples unique food concepts from a WWEIA / NHANES frequency CSV.
    Expected columns: food_code, food_description, reporting_frequency, wweia_category_description
    """
    rng = random.Random(seed)
    items = []
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
                    "reporting_frequency": frequency,
                })

    if not items:
        raise ValueError(f"No valid ordinary food rows found in {csv_path}")

    # Sort deterministically
    items.sort(key=lambda x: x["food_code"])
    
    selected_indices: Set[int] = set()
    sampled = []
    
    # Stratified selection across categories
    by_category = defaultdict(list)
    for idx, item in enumerate(items):
        by_category[item["category"]].append((idx, item))
    
    # Draw proportionally across categories
    per_cat = max(1, sample_size // len(by_category))
    for cat, cat_items in sorted(by_category.items()):
        cat_items_sorted = sorted(cat_items, key=lambda x: x[1]["reporting_frequency"], reverse=True)
        take = min(len(cat_items_sorted), per_cat)
        for idx, item in cat_items_sorted[:take]:
            if idx not in selected_indices:
                selected_indices.add(idx)
                sampled.append(item)
            if len(sampled) >= sample_size:
                break
        if len(sampled) >= sample_size:
            break

    # If still below target, fill by overall frequency
    if len(sampled) < sample_size:
        remaining = [idx for idx in range(len(items)) if idx not in selected_indices]
        remaining_sorted = sorted(remaining, key=lambda idx: items[idx]["reporting_frequency"], reverse=True)
        for idx in remaining_sorted:
            selected_indices.add(idx)
            sampled.append(items[idx])
            if len(sampled) >= sample_size:
                break

    return sampled[:sample_size]


def sample_openfoodfacts_us(
    input_path: str,
    branded_sample_size: int,
    barcode_sample_size: int,
    seed: int,
) -> Tuple[List[Dict], List[Dict]]:
    """
    Parses Open Food Facts US export and draws stratified samples for branded names and barcodes.
    Input can be .jsonl, .jsonl.gz, .csv, or .csv.gz.
    """
    rng = random.Random(seed)
    
    open_func = gzip.open if input_path.endswith(".gz") else open
    is_json = ".json" in input_path
    
    valid_by_category = defaultdict(list)
    gtin_seen: Set[str] = set()

    def process_record(record: dict):
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
        cat = categorize_product(categories, product_name)
        
        query = f"{brand} {product_name}".strip() if brand and not product_name.lower().startswith(brand.lower()) else product_name
        
        entry = {
            "raw_gtin": raw_code,
            "canonical_gtin": norm_gtin,
            "brand": brand,
            "product_name": product_name,
            "query": query,
            "category": cat,
        }
        valid_by_category[cat].append(entry)

    with open_func(input_path, "rt", encoding="utf-8", errors="replace") as stream:
        if is_json:
            for line in stream:
                line = line.strip()
                if line:
                    try:
                        data = json.loads(line)
                        process_record(data)
                    except json.JSONDecodeError:
                        continue
        else:
            reader = csv.DictReader(stream, delimiter="\t" if "\t" in input_path else ",")
            for row in reader:
                process_record(row)

    # Draw stratified samples for branded names
    branded_samples = []
    target_per_cat_branded = max(1, branded_sample_size // len(STANDARD_RETAIL_CATEGORIES))
    for cat in STANDARD_RETAIL_CATEGORIES:
        pool = sorted(valid_by_category[cat], key=lambda x: x["canonical_gtin"])
        rng.shuffle(pool)
        branded_samples.extend(pool[:target_per_cat_branded])
    
    # Draw stratified samples for barcodes (different slice)
    barcode_samples = []
    target_per_cat_barcode = max(1, barcode_sample_size // len(STANDARD_RETAIL_CATEGORIES))
    for cat in STANDARD_RETAIL_CATEGORIES:
        pool = sorted(valid_by_category[cat], key=lambda x: x["canonical_gtin"])
        offset_pool = pool[target_per_cat_branded:] + pool[:target_per_cat_branded]
        rng.shuffle(offset_pool)
        barcode_samples.extend(offset_pool[:target_per_cat_barcode])

    return branded_samples[:branded_sample_size], barcode_samples[:barcode_sample_size]


def main():
    parser = argparse.ArgumentParser(description="Sample independent nutrition evaluation frames.")
    parser.add_argument("--wweia-csv", help="Path to WWEIA / NHANES frequency CSV")
    parser.add_argument("--off-dump", help="Path to Open Food Facts US JSONL/CSV (.gz supported)")
    parser.add_argument("--seed", type=int, default=20260827, help="Random seed for reproducibility")
    parser.add_argument("--sample-size", type=int, default=385, help="Target sample size per stratum (default: 385)")
    parser.add_argument("--output", required=True, help="Path to output JSON summary")
    args = parser.parse_args()

    result = {
        "generator": "scripts/sample-nutrition-frame.py",
        "market": "United States (US)",
        "seed": args.seed,
        "target_sample_size_per_stratum": args.sample_size,
        "strata": {},
    }

    if args.wweia_csv and os.path.exists(args.wweia_csv):
        print(f"Sampling ordinary foods from {args.wweia_csv}...")
        ordinary = sample_wweia_ordinary(args.wweia_csv, args.sample_size, args.seed)
        result["strata"]["ordinary_foods"] = {
            "source": "CDC/USDA NHANES WWEIA Dietary Recall Frequency",
            "source_file_sha256": sha256(args.wweia_csv),
            "sample_count": len(ordinary),
            "category_distribution": dict(sorted(Counter(x["category"] for x in ordinary).items())),
            "samples": ordinary,
        }

    if args.off_dump and os.path.exists(args.off_dump):
        print(f"Sampling branded names and barcodes from {args.off_dump}...")
        branded, barcodes = sample_openfoodfacts_us(
            args.off_dump,
            args.sample_size,
            args.sample_size,
            args.seed,
        )
        result["strata"]["branded_names"] = {
            "source": "Open Food Facts US Snapshot (Unweighted Retail Assortment Frame)",
            "source_file_sha256": sha256(args.off_dump),
            "sample_count": len(branded),
            "category_distribution": dict(sorted(Counter(x["category"] for x in branded).items())),
            "samples": branded,
        }
        result["strata"]["exact_barcodes"] = {
            "source": "Open Food Facts US Snapshot (Unweighted Retail Assortment Frame)",
            "source_file_sha256": sha256(args.off_dump),
            "sample_count": len(barcodes),
            "category_distribution": dict(sorted(Counter(x["category"] for x in barcodes).items())),
            "samples": barcodes,
        }

    with open(args.output, "w", encoding="utf-8") as dest:
        json.dump(result, dest, indent=2, sort_keys=True)
        dest.write("\n")

    print(f"Sampling metadata written to {args.output}")


if __name__ == "__main__":
    main()
