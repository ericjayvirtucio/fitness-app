#!/usr/bin/env python3
"""
scripts/prepare-wweia-frequency-table.py

Derives the ordinary-food query frequency table ADR 0037 approves
(food_code, food_description, wweia_category_description, reporting_frequency)
from two official CDC/USDA sources for the NHANES 2021-2023 cycle:

  --dr1iff       DR1IFF_L.xpt  (Dietary Interview - Individual Foods, Day 1;
                                 one row per food a respondent reported eating)
  --food-code-crosswalk   the FNDDS "Foods and Beverages" XLSX for the same
                           cycle (food code -> description and WWEIA category;
                           the NHANES public-use DRXFCD_L.xpt file carries no
                           WWEIA category column, so this XLSX, published
                           separately by USDA ARS FSRG, is the actual source
                           of that field)

Scoping, disclosed rather than silent:

- Uses only the 2021-2023 cycle. ADR 0037 names "2017-March 2020 / 2021-2023"
  as acceptable frames; pooling both cycles would require NHANES's own
  combined-cycle sample-weight methodology, out of this sprint's scope.
- reporting_frequency is the UNWEIGHTED count of DR1IFF_L rows carrying a
  given food code -- i.e. how many respondent-day entries used that code.
  This is a simplification of true population-weighted prevalence, which
  would require merging demographic sample-weight files (e.g. WTDRD1). It is
  not presented as a population-weighted estimate anywhere in this tool's
  output.

Standard library only.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from collections import Counter
from typing import Dict, Iterable, List, Optional, Tuple

from sas_xport import iter_xport_rows
from xlsx_reader import iter_sheet_rows

SURVEY_CYCLE = "2021-2023"


def sha256(path: str) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as source:
        while chunk := source.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def count_reporting_frequency(dr1iff_rows: Iterable[Dict]) -> Counter:
    frequency: Counter = Counter()
    for row in dr1iff_rows:
        code = row.get("DR1IFDCD")
        if code is None:
            continue
        frequency[int(round(code))] += 1
    return frequency


def read_food_code_crosswalk(
    crosswalk_rows: Iterable[List[Optional[str]]],
) -> Dict[int, Tuple[str, str]]:
    """Skips the workbook's title row and header row, keyed by integer food code."""
    crosswalk: Dict[int, Tuple[str, str]] = {}
    for row in crosswalk_rows:
        if not row or not row[0]:
            continue
        try:
            code = int(row[0])
        except (ValueError, TypeError):
            continue
        description = row[1] if len(row) > 1 and row[1] else ""
        category = row[4] if len(row) > 4 and row[4] else ""
        if description:
            crosswalk[code] = (description, category)
    return crosswalk


def build_frequency_table(
    frequency: Counter, crosswalk: Dict[int, Tuple[str, str]]
) -> Tuple[List[Dict[str, object]], int]:
    """Returns (rows, unjoined_code_count). A code absent from the crosswalk is excluded, not guessed."""
    rows: List[Dict[str, object]] = []
    unjoined = 0
    for code, count in sorted(frequency.items()):
        entry = crosswalk.get(code)
        if entry is None:
            unjoined += 1
            continue
        description, category = entry
        rows.append(
            {
                "food_code": str(code),
                "food_description": description,
                "wweia_category_description": category or "General",
                "reporting_frequency": count,
            }
        )
    return rows, unjoined


def write_csv(rows: List[Dict[str, object]], path: str) -> None:
    with open(path, "w", encoding="utf-8", newline="") as destination:
        writer = csv.DictWriter(
            destination,
            fieldnames=[
                "food_code",
                "food_description",
                "wweia_category_description",
                "reporting_frequency",
            ],
        )
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dr1iff", required=True, help="Path to DR1IFF_L.xpt")
    parser.add_argument(
        "--food-code-crosswalk",
        required=True,
        help="Path to the FNDDS 'Foods and Beverages' XLSX for the same cycle",
    )
    parser.add_argument("--output", required=True, help="Path to output frequency-table CSV")
    parser.add_argument(
        "--summary-output",
        required=True,
        help="Path to git-safe aggregate JSON (source hashes, counts -- no row-level data)",
    )
    args = parser.parse_args()

    frequency = count_reporting_frequency(iter_xport_rows(args.dr1iff))
    crosswalk = read_food_code_crosswalk(iter_sheet_rows(args.food_code_crosswalk))
    rows, unjoined = build_frequency_table(frequency, crosswalk)

    if not rows:
        raise SystemExit("no food codes joined between DR1IFF and the crosswalk; refusing to write an empty frame")

    write_csv(rows, args.output)

    summary = {
        "generator": "scripts/prepare-wweia-frequency-table.py",
        "survey_cycle": SURVEY_CYCLE,
        "scoping_note": (
            "Single NHANES cycle (2021-2023) only; not pooled with 2017-March 2020, "
            "which would require NHANES combined-cycle sample-weight methodology."
        ),
        "frequency_definition_note": (
            "reporting_frequency is the unweighted count of DR1IFF_L respondent-day "
            "entries per food code; not a population-weighted prevalence estimate."
        ),
        "sources": {
            "dr1iff": {"path_basename": args.dr1iff.split("/")[-1], "sha256": sha256(args.dr1iff)},
            "food_code_crosswalk": {
                "path_basename": args.food_code_crosswalk.split("/")[-1],
                "sha256": sha256(args.food_code_crosswalk),
            },
        },
        "total_dr1iff_rows": sum(frequency.values()),
        "distinct_food_codes_reported": len(frequency),
        "distinct_food_codes_joined": len(rows),
        "distinct_food_codes_unjoined": unjoined,
        "distinct_wweia_categories": len({row["wweia_category_description"] for row in rows}),
    }
    with open(args.summary_output, "w", encoding="utf-8") as destination:
        json.dump(summary, destination, indent=2, sort_keys=True)
        destination.write("\n")

    print(f"Wrote {len(rows)} food codes to {args.output}")
    print(f"Wrote summary to {args.summary_output}")


if __name__ == "__main__":
    main()
