#!/usr/bin/env python3

import argparse
import csv
import hashlib
import io
import json
import os
import zipfile
from collections import Counter, defaultdict


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


def archive_member(archive, suffix):
    matches = [name for name in archive.namelist() if name.endswith("/" + suffix)]
    if len(matches) != 1:
        raise RuntimeError(f"Expected one {suffix}, found {len(matches)}")
    return matches[0]


def rows(archive, suffix):
    with archive.open(archive_member(archive, suffix)) as raw:
        with io.TextIOWrapper(raw, encoding="utf-8-sig", newline="") as text:
            yield from csv.DictReader(text)


def sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as source:
        while chunk := source.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def gtin_check_digit_is_valid(value):
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


def normalize_gtin(value):
    stripped = value.strip()
    if not gtin_check_digit_is_valid(stripped):
        return None
    return stripped.zfill(14)


def read_food_metadata(archive):
    metadata = {}
    data_types = Counter()
    for row in rows(archive, "food.csv"):
        fdc_id = int(row["fdc_id"])
        data_type = row.get("data_type", "")
        metadata[fdc_id] = (row.get("publication_date", ""), data_type)
        data_types[data_type] += 1
    return metadata, data_types


def read_nutrient_presence(archive):
    key_bits = {}
    for row in rows(archive, "nutrient.csv"):
        bit = NUTRIENT_BITS.get(int(row["id"]))
        if bit is None:
            continue
        key_bits[row["id"]] = bit
        if row["nutrient_nbr"]:
            key_bits[row["nutrient_nbr"]] = bit

    presence = defaultdict(int)
    relevant_rows = 0
    for row in rows(archive, "food_nutrient.csv"):
        bit = key_bits.get(row["nutrient_id"])
        if bit is not None and row["amount"].strip() != "":
            presence[int(row["fdc_id"])] |= bit
            relevant_rows += 1
    return presence, relevant_rows


def presence_summary(ids, presence):
    ids = list(ids)
    counts = Counter()
    for fdc_id in ids:
        mask = presence.get(fdc_id, 0)
        if mask & (1 << 3):
            counts["energy"] += 1
        if mask & (1 << 0):
            counts["protein"] += 1
        if mask & (1 << 2):
            counts["carbohydrate"] += 1
        if mask & (1 << 1):
            counts["fat"] += 1
        if mask & (1 << 4):
            counts["fiber"] += 1
        if mask & (1 << 5):
            counts["sugars"] += 1
        if mask & (1 << 6):
            counts["sodium"] += 1
        if mask & USABLE_MASK == USABLE_MASK:
            counts["usable"] += 1
        if mask & COMPLETE_MASK == COMPLETE_MASK:
            counts["complete"] += 1
    return {"denominator": len(ids), **dict(sorted(counts.items()))}


def profile_ordinary(path, label, searchable_data_type):
    with zipfile.ZipFile(path) as archive:
        metadata, data_types = read_food_metadata(archive)
        presence, relevant_rows = read_nutrient_presence(archive)
        uncompressed_bytes = sum(item.file_size for item in archive.infolist())
    searchable_ids = [
        fdc_id
        for fdc_id, (_, data_type) in metadata.items()
        if data_type == searchable_data_type
    ]
    return {
        "archive": {
            "bytes": os.path.getsize(path),
            "sha256": sha256(path),
            "uncompressed_bytes": uncompressed_bytes,
        },
        "data_type": label,
        "archive_food_rows": len(metadata),
        "food_rows_by_type": dict(sorted(data_types.items())),
        "searchable_food_rows": len(searchable_ids),
        "relevant_food_nutrient_rows": relevant_rows,
        "nutrition_presence": presence_summary(searchable_ids, presence),
    }


def profile_branded(path):
    with zipfile.ZipFile(path) as archive:
        metadata, data_types = read_food_metadata(archive)
        gtin_lengths = Counter()
        market_rows = Counter()
        valid_market_rows = Counter()
        live_by_gtin = defaultdict(list)
        total_rows = 0
        nonblank_gtin_rows = 0
        valid_gtin_rows = 0
        discontinued_rows = 0

        for row in rows(archive, "branded_food.csv"):
            total_rows += 1
            raw_gtin = row["gtin_upc"].strip()
            market = row["market_country"].strip() or "(blank)"
            market_rows[market] += 1
            if row["discontinued_date"].strip():
                discontinued_rows += 1
            if raw_gtin:
                nonblank_gtin_rows += 1
                gtin_lengths[str(len(raw_gtin))] += 1
            normalized_gtin = normalize_gtin(raw_gtin)
            if normalized_gtin is None:
                continue
            valid_gtin_rows += 1
            valid_market_rows[market] += 1
            if not row["discontinued_date"].strip():
                fdc_id = int(row["fdc_id"])
                live_by_gtin[normalized_gtin].append(
                    (metadata.get(fdc_id, ("", ""))[0], fdc_id, market)
                )

        current = {}
        latest_tie_gtins = 0
        duplicate_live_gtins = 0
        for gtin, candidates in live_by_gtin.items():
            if len(candidates) > 1:
                duplicate_live_gtins += 1
            latest_date = max(candidate[0] for candidate in candidates)
            latest = [candidate for candidate in candidates if candidate[0] == latest_date]
            if len(latest) > 1:
                latest_tie_gtins += 1
            current[gtin] = max(latest, key=lambda candidate: candidate[1])

        presence, relevant_rows = read_nutrient_presence(archive)
        current_ids = [candidate[1] for candidate in current.values()]
        current_markets = Counter(candidate[2] for candidate in current.values())
        uncompressed_bytes = sum(item.file_size for item in archive.infolist())

    return {
        "archive": {
            "bytes": os.path.getsize(path),
            "sha256": sha256(path),
            "uncompressed_bytes": uncompressed_bytes,
        },
        "archive_food_rows": len(metadata),
        "food_rows_by_type": dict(sorted(data_types.items())),
        "branded_rows": total_rows,
        "nonblank_gtin_rows": nonblank_gtin_rows,
        "valid_gtin_rows": valid_gtin_rows,
        "gtin_length_rows": dict(
            sorted(gtin_lengths.items(), key=lambda item: int(item[0]))
        ),
        "discontinued_rows": discontinued_rows,
        "distinct_live_valid_gtins": len(current),
        "distinct_gtins_with_multiple_live_rows": duplicate_live_gtins,
        "distinct_gtins_tied_on_latest_publication_date": latest_tie_gtins,
        "market_rows": dict(sorted(market_rows.items())),
        "valid_gtin_market_rows": dict(sorted(valid_market_rows.items())),
        "current_distinct_gtins_by_selected_record_market": dict(
            sorted(current_markets.items())
        ),
        "relevant_food_nutrient_rows": relevant_rows,
        "current_distinct_gtin_nutrition_presence": presence_summary(
            current_ids, presence
        ),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--foundation", required=True)
    parser.add_argument("--fndds", required=True)
    parser.add_argument("--branded", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    result = {
        "method_version": 1,
        "foundation": profile_ordinary(
            args.foundation, "Foundation", "foundation_food"
        ),
        "fndds": profile_ordinary(
            args.fndds, "Survey (FNDDS)", "survey_fndds_food"
        ),
        "branded": profile_branded(args.branded),
    }
    with open(args.output, "w", encoding="utf-8") as destination:
        json.dump(result, destination, indent=2, sort_keys=True)
        destination.write("\n")


if __name__ == "__main__":
    main()
