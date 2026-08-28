#!/usr/bin/env python3
"""
scripts/evaluate-fooddata-central-discovery.py

Sprint 52's focused sampled-coverage evaluator. Measures ordinary-food,
branded-name, and exact-barcode discovery of USDA FoodData Central's April
2026 bulk release against the independent samples produced by
scripts/sample-nutrition-frame.py, plus nutrition usability/completeness
and ambiguity, per the match definitions fixed in
docs/fooddata-central-coverage-evaluation.md before any release was
inspected.

Separate from scripts/evaluate-fooddata-central.py (which stays untouched
and performs internal archive profiling only) so that script's recorded
evaluated-evidence SHA-256 remains meaningful.

Matching constants below are frozen before this script is run against real
data (Sprint 52 threshold-integrity rule): they may be defect-corrected
before first use, but must not be tuned after inspecting FoodData Central
results.

Uses standard library only. Compatible with Python 3.9+.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import zipfile
from collections import defaultdict
from typing import Dict, FrozenSet, List, Optional, Tuple

from nutrition_eval_lib import normalize_food_name, normalize_gtin, sha256, wilson_score_interval

METHOD_VERSION = 2

# Frozen before evaluating real data; changing this after seeing results
# would be exactly the "tune queries, matching rules, exclusions, or
# thresholds after observing provider results" Sprint 52 forbids.
AMBIGUITY_NEAR_TIE_MARGIN = 0.05

# method_version 1 also gated eligibility on a Jaccard score >= 0.6 on top of
# full token-subset containment. Real-run diagnosis (independent GTIN
# cross-check against the exact-barcode index, not a re-scoring of the
# rejected candidates) found this double-penalized correct matches whenever
# FDC's brand_owner field carries a verbose legal entity name (e.g.
# "Cooperative Region of Organic Producer Pool" for a store-brand steak) --
# the extra tokens inflate the Jaccard denominator even though every query
# token is genuinely present. Full subset containment already provides the
# false-positive guard the floor was meant to add (a semantically wrong food
# cannot satisfy "every query token appears in the candidate"), so the floor
# is removed as an eligibility gate in method_version 2; Jaccard is retained
# below purely to rank among eligible candidates and to detect near-ties for
# ambiguity classification, not to exclude otherwise-eligible candidates.
# This is a disclosed defect correction to the scoring implementation, not a
# change to the ADR 0037 / eval-doc match definitions themselves, which never
# specified a token-similarity formula. Both method_version 1 and 2 results
# are reported side by side in docs/fooddata-central-coverage-evaluation.md.

# Mirrors scripts/evaluate-fooddata-central.py's NUTRIENT_BITS exactly;
# duplicated rather than imported so that script's evaluated-evidence hash
# stays untouched and this evaluator has no dependency on it.
NUTRIENT_BITS = {
    1003: 1 << 0,  # protein
    1004: 1 << 1,  # total fat
    1005: 1 << 2,  # carbohydrate by difference
    1050: 1 << 2,  # carbohydrate by summation
    2039: 1 << 2,  # carbohydrates
    1008: 1 << 3,  # energy kcal
    1062: 1 << 3,  # energy kJ
    2047: 1 << 3,  # energy, general factors
    2048: 1 << 3,  # energy, specific factors
    1079: 1 << 4,  # total dietary fiber
    1063: 1 << 5,  # sugars, total (older identifier)
    2000: 1 << 5,  # total sugars
    1093: 1 << 6,  # sodium
}
USABLE_MASK = sum(1 << bit for bit in range(4))
COMPLETE_MASK = sum(1 << bit for bit in range(7))


def archive_member(archive: zipfile.ZipFile, suffix: str) -> str:
    matches = [name for name in archive.namelist() if name.endswith("/" + suffix)]
    if len(matches) != 1:
        raise RuntimeError(f"Expected one {suffix}, found {len(matches)}")
    return matches[0]


def rows(archive: zipfile.ZipFile, suffix: str):
    with archive.open(archive_member(archive, suffix)) as raw:
        with io.TextIOWrapper(raw, encoding="utf-8-sig", newline="") as text:
            yield from csv.DictReader(text)


def read_food_table(archive: zipfile.ZipFile) -> Dict[int, Dict]:
    table = {}
    for row in rows(archive, "food.csv"):
        fdc_id = int(row["fdc_id"])
        table[fdc_id] = {
            "description": row.get("description", "").strip(),
            "data_type": row.get("data_type", ""),
            "publication_date": row.get("publication_date", ""),
        }
    return table


def read_nutrient_presence(archive: zipfile.ZipFile) -> Dict[int, int]:
    key_bits = {}
    for row in rows(archive, "nutrient.csv"):
        bit = NUTRIENT_BITS.get(int(row["id"]))
        if bit is None:
            continue
        key_bits[row["id"]] = bit
        if row["nutrient_nbr"]:
            key_bits[row["nutrient_nbr"]] = bit

    presence: Dict[int, int] = defaultdict(int)
    for row in rows(archive, "food_nutrient.csv"):
        bit = key_bits.get(row["nutrient_id"])
        if bit is not None and row["amount"].strip() != "":
            presence[int(row["fdc_id"])] |= bit
    return presence


def _tokens(normalized: str) -> FrozenSet[str]:
    return frozenset(normalized.split(" ")) if normalized else frozenset()


def build_ordinary_index(foundation_path: str, fndds_path: str) -> List[Dict]:
    entries: List[Dict] = []
    for path, searchable_type in ((foundation_path, "foundation_food"), (fndds_path, "survey_fndds_food")):
        with zipfile.ZipFile(path) as archive:
            food_table = read_food_table(archive)
            presence = read_nutrient_presence(archive)
        for fdc_id, info in food_table.items():
            if info["data_type"] != searchable_type:
                continue
            normalized = normalize_food_name(info["description"])
            entries.append({
                "fdc_id": fdc_id,
                "normalized": normalized,
                "tokens": _tokens(normalized),
                "nutrient_mask": presence.get(fdc_id, 0),
            })
    return entries


def build_branded_index(branded_path: str) -> Tuple[Dict[str, Dict], set]:
    with zipfile.ZipFile(branded_path) as archive:
        food_table = read_food_table(archive)
        presence = read_nutrient_presence(archive)
        live_by_gtin: Dict[str, List[Dict]] = defaultdict(list)
        for row in rows(archive, "branded_food.csv"):
            if row["discontinued_date"].strip():
                continue
            norm_gtin = normalize_gtin(row["gtin_upc"].strip())
            if norm_gtin is None:
                continue
            fdc_id = int(row["fdc_id"])
            live_by_gtin[norm_gtin].append({
                "fdc_id": fdc_id,
                "publication_date": food_table.get(fdc_id, {}).get("publication_date", ""),
                "brand_owner": row.get("brand_owner", "").strip(),
                "brand_name": row.get("brand_name", "").strip(),
                "market_country": row.get("market_country", "").strip(),
            })

    index: Dict[str, Dict] = {}
    ambiguous_gtins: set = set()
    for gtin, candidates in live_by_gtin.items():
        latest_date = max(candidate["publication_date"] for candidate in candidates)
        latest = [candidate for candidate in candidates if candidate["publication_date"] == latest_date]
        if len(latest) > 1:
            ambiguous_gtins.add(gtin)
        selected = max(latest, key=lambda candidate: candidate["fdc_id"])
        description = food_table.get(selected["fdc_id"], {}).get("description", "")
        brand_text = selected["brand_owner"] or selected["brand_name"]
        normalized = normalize_food_name(f"{brand_text} {description}")
        index[gtin] = {
            "fdc_id": selected["fdc_id"],
            "normalized": normalized,
            "tokens": _tokens(normalized),
            "market_country": selected["market_country"],
            "nutrient_mask": presence.get(selected["fdc_id"], 0),
        }
    return index, ambiguous_gtins


def _jaccard(a: FrozenSet[str], b: FrozenSet[str]) -> float:
    union = a | b
    if not union:
        return 0.0
    return len(a & b) / len(union)


def _rank_top_five(query_normalized: str, query_tokens: FrozenSet[str], candidates: List[Dict]) -> List[Tuple[float, Dict]]:
    if not query_tokens:
        return []
    eligible = []
    for candidate in candidates:
        if not query_tokens.issubset(candidate["tokens"]):
            continue
        score = 1.0 if candidate["normalized"] == query_normalized else _jaccard(query_tokens, candidate["tokens"])
        eligible.append((score, candidate))
    eligible.sort(key=lambda pair: (-pair[0], pair[1]["fdc_id"]))
    return eligible[:5]


def _classify(query_normalized: str, query_tokens: FrozenSet[str], candidates: List[Dict]) -> Tuple[str, Optional[Dict]]:
    top_five = _rank_top_five(query_normalized, query_tokens, candidates)
    if not top_five:
        return "no_match", None
    top_score, top_candidate = top_five[0]
    near_ties = [
        candidate
        for score, candidate in top_five[1:]
        if (top_score - score) <= AMBIGUITY_NEAR_TIE_MARGIN and candidate["normalized"] != top_candidate["normalized"]
    ]
    if near_ties:
        return "ambiguous", None
    return "acceptable", top_candidate


def evaluate_ordinary_sample(sample: Dict, ordinary_index: List[Dict]) -> Tuple[str, Optional[Dict]]:
    query = str(sample.get("query", "")).strip()
    if not query:
        return "malformed", None
    normalized = normalize_food_name(query)
    return _classify(normalized, _tokens(normalized), ordinary_index)


def evaluate_branded_sample(sample: Dict, branded_candidates: List[Dict]) -> Tuple[str, Optional[Dict]]:
    brand = str(sample.get("brand", "")).strip()
    product_name = str(sample.get("product_name", "")).strip()
    if not product_name:
        return "malformed", None
    normalized = normalize_food_name(f"{brand} {product_name}")
    query_tokens = _tokens(normalized)
    candidates = branded_candidates
    if brand:
        brand_tokens = _tokens(normalize_food_name(brand))
        candidates = [c for c in candidates if brand_tokens.issubset(c["tokens"])]
    return _classify(normalized, query_tokens, candidates)


def evaluate_barcode_sample(sample: Dict, branded_index: Dict[str, Dict], ambiguous_gtins: set) -> Tuple[str, Optional[Dict]]:
    gtin = str(sample.get("canonical_gtin", "")).strip()
    if not gtin:
        return "malformed", None
    if gtin in ambiguous_gtins:
        return "ambiguous", None
    entry = branded_index.get(gtin)
    if entry is None:
        return "no_match", None
    return "exact_match", entry


def _aggregate(results: List[Tuple[str, Optional[Dict]]], match_status: str) -> Dict:
    denominator = len(results)
    matched = [entry for status, entry in results if status == match_status]
    ambiguous_count = sum(1 for status, _ in results if status == "ambiguous")
    no_match_count = sum(1 for status, _ in results if status == "no_match")
    point, lower, upper = wilson_score_interval(len(matched), denominator) if denominator else (0.0, 0.0, 0.0)

    usable = sum(1 for entry in matched if entry["nutrient_mask"] & USABLE_MASK == USABLE_MASK)
    complete = sum(1 for entry in matched if entry["nutrient_mask"] & COMPLETE_MASK == COMPLETE_MASK)
    matched_n = len(matched)

    return {
        "denominator": denominator,
        "match_count": matched_n,
        "ambiguous_count": ambiguous_count,
        "no_match_count": no_match_count,
        "discovery_rate": point,
        "discovery_rate_wilson_95_lower": lower,
        "discovery_rate_wilson_95_upper": upper,
        "nutrition_usable_rate": (usable / matched_n) if matched_n else None,
        "nutrition_complete_rate": (complete / matched_n) if matched_n else None,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Measure sampled FoodData Central discovery coverage (Sprint 52).")
    parser.add_argument("--samples", required=True, help="Raw samples JSON from sample-nutrition-frame.py --samples-output")
    parser.add_argument("--foundation", required=True)
    parser.add_argument("--fndds", required=True)
    parser.add_argument("--branded", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    with open(args.samples, "r", encoding="utf-8") as source:
        samples = json.load(source)

    ordinary_index = build_ordinary_index(args.foundation, args.fndds)
    branded_index, ambiguous_gtins = build_branded_index(args.branded)
    branded_candidates = list(branded_index.values())

    strata = samples.get("strata", {})

    ordinary_results = []
    ordinary_malformed = 0
    for sample in strata.get("ordinary_foods", {}).get("samples", []):
        status, entry = evaluate_ordinary_sample(sample, ordinary_index)
        if status == "malformed":
            ordinary_malformed += 1
            continue
        ordinary_results.append((status, entry))

    branded_results = []
    branded_malformed = 0
    for sample in strata.get("branded_names", {}).get("samples", []):
        status, entry = evaluate_branded_sample(sample, branded_candidates)
        if status == "malformed":
            branded_malformed += 1
            continue
        branded_results.append((status, entry))

    barcode_results = []
    barcode_malformed = 0
    for sample in strata.get("exact_barcodes", {}).get("samples", []):
        status, entry = evaluate_barcode_sample(sample, branded_index, ambiguous_gtins)
        if status == "malformed":
            barcode_malformed += 1
            continue
        barcode_results.append((status, entry))

    output = {
        "generator": "scripts/evaluate-fooddata-central-discovery.py",
        "method_version": METHOD_VERSION,
        "name_match_eligibility": "full query-token subset containment in candidate tokens (no additional score floor as of method_version 2)",
        "ambiguity_near_tie_margin": AMBIGUITY_NEAR_TIE_MARGIN,
        "source_archives": {
            "foundation_sha256": sha256(args.foundation),
            "fndds_sha256": sha256(args.fndds),
            "branded_sha256": sha256(args.branded),
        },
        "strata": {
            "ordinary_foods": {
                "malformed_sample_count": ordinary_malformed,
                **_aggregate(ordinary_results, "acceptable"),
            },
            "branded_names": {
                "malformed_sample_count": branded_malformed,
                **_aggregate(branded_results, "acceptable"),
            },
            "exact_barcodes": {
                "malformed_sample_count": barcode_malformed,
                **_aggregate(barcode_results, "exact_match"),
            },
        },
    }

    with open(args.output, "w", encoding="utf-8") as dest:
        json.dump(output, dest, indent=2, sort_keys=True)
        dest.write("\n")

    print(f"Discovery evaluation written to {args.output}")


if __name__ == "__main__":
    main()
