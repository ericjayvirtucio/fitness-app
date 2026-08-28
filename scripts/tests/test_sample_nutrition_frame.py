import csv
import json
import os
import subprocess
import sys
import tempfile
import unittest

from _load_module import SCRIPTS_DIR, load_module

sampler = load_module("sample-nutrition-frame.py", "sample_nutrition_frame")
from nutrition_eval_lib import InsufficientSampleFrameError, derive_seed  # noqa: E402


def gtin13(payload12: str) -> str:
    digits = [int(character) for character in payload12]
    total = sum(digit * (3 if (len(digits) - index) % 2 == 1 else 1) for index, digit in enumerate(digits))
    check = (10 - total % 10) % 10
    return payload12 + str(check)


CATEGORY_KEYWORDS = {
    "dairy": "milk",
    "grains_bakery": "bread",
    "snacks_sweets": "chips",
    "beverages": "juice",
    "meats_seafood": "chicken",
    "prepared_frozen": "frozen meal",
    "condiments_sauces": "sauce",
    "canned_preserved": "canned soup",
}


def write_wweia_csv(path: str, rows_per_category: int = 60, categories: int = 8) -> None:
    with open(path, "w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["food_code", "food_description", "reporting_frequency", "wweia_category_description"])
        code = 1000
        for category_index in range(categories):
            for row_index in range(rows_per_category):
                writer.writerow([
                    str(code),
                    f"Food {category_index}-{row_index}",
                    str(1 + row_index % 50),
                    f"Category {category_index}",
                ])
                code += 1


def write_off_jsonl(path: str, rows_per_category: int = 60, duplicate_first: bool = False) -> None:
    counter = 0
    with open(path, "w", encoding="utf-8") as handle:
        for category, keyword in CATEGORY_KEYWORDS.items():
            for row_index in range(rows_per_category):
                payload = f"{counter:012d}"
                code = gtin13(payload)
                record = {
                    "code": code,
                    "countries_tags": "en:united-states",
                    "brands": f"Brand{category}{row_index}",
                    "product_name": f"{keyword.title()} Product {row_index}",
                    "categories_tags": category,
                }
                handle.write(json.dumps(record) + "\n")
                counter += 1
        if duplicate_first:
            handle.write(json.dumps({
                "code": gtin13("000000000000"),
                "countries_tags": "en:united-states",
                "brands": "Branddairy0",
                "product_name": "Milk Product 0 Duplicate",
                "categories_tags": "dairy",
            }) + "\n")


def write_off_tsv(path: str, rows: int = 10) -> None:
    with open(path, "w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle, delimiter="\t")
        writer.writerow(["code", "countries_tags", "brands", "product_name", "categories_tags"])
        for row_index in range(rows):
            code = gtin13(f"{row_index:012d}")
            writer.writerow([code, "en:united-states", f"BrandTsv{row_index}", f"Milk Product {row_index}", "dairy"])


class DetectDelimiterAndFormatTests(unittest.TestCase):
    def test_csv(self):
        self.assertEqual(sampler.detect_delimiter_and_format("data.csv"), ("csv", ","))

    def test_csv_gz(self):
        self.assertEqual(sampler.detect_delimiter_and_format("data.csv.gz"), ("csv", ","))

    def test_tsv(self):
        self.assertEqual(sampler.detect_delimiter_and_format("data.tsv"), ("csv", "\t"))

    def test_tsv_gz(self):
        self.assertEqual(sampler.detect_delimiter_and_format("data.tsv.gz"), ("csv", "\t"))

    def test_jsonl(self):
        self.assertEqual(sampler.detect_delimiter_and_format("data.jsonl"), ("json", ""))

    def test_jsonl_gz(self):
        self.assertEqual(sampler.detect_delimiter_and_format("data.jsonl.gz"), ("json", ""))

    def test_unrecognized_extension_raises(self):
        with self.assertRaises(ValueError):
            sampler.detect_delimiter_and_format("data.txt")


class CategorizeProductTests(unittest.TestCase):
    def test_known_keywords_map_to_expected_category(self):
        self.assertEqual(sampler.categorize_product("", "Whole Milk"), "dairy")
        self.assertEqual(sampler.categorize_product("", "Canned Soup"), "canned_preserved")

    def test_unmatched_product_returns_none(self):
        self.assertIsNone(sampler.categorize_product("", "Unclassifiable Widget Xyz"))


class SampleWweiaOrdinaryTests(unittest.TestCase):
    def test_exact_sample_size(self):
        with tempfile.TemporaryDirectory() as tmp:
            csv_path = os.path.join(tmp, "wweia.csv")
            write_wweia_csv(csv_path, rows_per_category=60, categories=8)
            import random
            sampled = sampler.sample_wweia_ordinary(csv_path, 385, random.Random(derive_seed(1, "ordinary")))
            self.assertEqual(len(sampled), 385)

    def test_insufficient_source_raises(self):
        with tempfile.TemporaryDirectory() as tmp:
            csv_path = os.path.join(tmp, "wweia.csv")
            write_wweia_csv(csv_path, rows_per_category=5, categories=8)
            import random
            with self.assertRaises(InsufficientSampleFrameError):
                sampler.sample_wweia_ordinary(csv_path, 385, random.Random(derive_seed(1, "ordinary")))

    def test_reproducible_given_same_seed(self):
        with tempfile.TemporaryDirectory() as tmp:
            csv_path = os.path.join(tmp, "wweia.csv")
            write_wweia_csv(csv_path, rows_per_category=60, categories=8)
            import random
            first = sampler.sample_wweia_ordinary(csv_path, 385, random.Random(derive_seed(20260827, "ordinary")))
            second = sampler.sample_wweia_ordinary(csv_path, 385, random.Random(derive_seed(20260827, "ordinary")))
            self.assertEqual(first, second)


class SampleOpenFoodFactsUsTests(unittest.TestCase):
    def test_exact_sample_sizes_and_category_totals(self):
        with tempfile.TemporaryDirectory() as tmp:
            off_path = os.path.join(tmp, "off.jsonl")
            write_off_jsonl(off_path, rows_per_category=60)
            import random
            branded, barcodes, excluded = sampler.sample_openfoodfacts_us(
                off_path, 385, 385,
                random.Random(derive_seed(1, "branded")), random.Random(derive_seed(1, "barcode")),
            )
            self.assertEqual(len(branded), 385)
            self.assertEqual(len(barcodes), 385)
            self.assertEqual(excluded, 0)

    def test_insufficient_source_raises(self):
        with tempfile.TemporaryDirectory() as tmp:
            off_path = os.path.join(tmp, "off.jsonl")
            write_off_jsonl(off_path, rows_per_category=5)
            import random
            with self.assertRaises(InsufficientSampleFrameError):
                sampler.sample_openfoodfacts_us(
                    off_path, 385, 385,
                    random.Random(derive_seed(1, "branded")), random.Random(derive_seed(1, "barcode")),
                )

    def test_duplicate_gtin_collapses_to_first_seen(self):
        with tempfile.TemporaryDirectory() as tmp:
            off_path = os.path.join(tmp, "off.jsonl")
            write_off_jsonl(off_path, rows_per_category=60, duplicate_first=True)
            import random
            branded, barcodes, _ = sampler.sample_openfoodfacts_us(
                off_path, 385, 385,
                random.Random(derive_seed(1, "branded")), random.Random(derive_seed(1, "barcode")),
            )
            gtins = [entry["canonical_gtin"] for entry in branded + barcodes]
            first_gtin = gtin13("000000000000")
            from nutrition_eval_lib import normalize_gtin
            canonical_first = normalize_gtin(first_gtin)
            product_names_for_first = {
                entry["product_name"] for entry in branded + barcodes
                if entry["canonical_gtin"] == canonical_first
            }
            if product_names_for_first:
                self.assertEqual(product_names_for_first, {"Milk Product 0"})

    def test_tsv_input_round_trips(self):
        with tempfile.TemporaryDirectory() as tmp:
            off_path = os.path.join(tmp, "off.tsv")
            write_off_tsv(off_path, rows=10)
            import random
            branded, barcodes, excluded = sampler.sample_openfoodfacts_us(
                off_path, 5, 5,
                random.Random(derive_seed(1, "branded")), random.Random(derive_seed(1, "barcode")),
            )
            self.assertEqual(len(branded), 5)
            self.assertEqual(len(barcodes), 5)
            self.assertTrue(all(entry["category"] == "dairy" for entry in branded))

    def test_oversized_free_text_field_does_not_break_parsing(self):
        # Regression: real Open Food Facts exports carry free-text fields
        # (e.g. ingredients_text) past Python's 128 KiB csv default, which
        # raised _csv.Error: field larger than field limit during Sprint 52's
        # real run against the full OFF snapshot.
        with tempfile.TemporaryDirectory() as tmp:
            off_path = os.path.join(tmp, "off.tsv")
            with open(off_path, "w", newline="", encoding="utf-8") as handle:
                writer = csv.writer(handle, delimiter="\t")
                writer.writerow(["code", "countries_tags", "brands", "product_name", "categories_tags", "ingredients_text"])
                oversized = "x" * 200_000
                for row_index in range(10):
                    payload = f"{row_index:012d}"
                    writer.writerow([gtin13(payload), "en:united-states", "Brand", f"Milk Product {row_index}", "dairy", oversized])
            import random
            branded, barcodes, excluded = sampler.sample_openfoodfacts_us(
                off_path, 5, 5,
                random.Random(derive_seed(1, "branded")), random.Random(derive_seed(1, "barcode")),
            )
            self.assertEqual(len(branded), 5)
            self.assertEqual(len(barcodes), 5)

    def test_uncategorized_items_are_excluded_and_counted(self):
        with tempfile.TemporaryDirectory() as tmp:
            off_path = os.path.join(tmp, "off.jsonl")
            with open(off_path, "w", encoding="utf-8") as handle:
                for row_index in range(3):
                    code = gtin13(f"{row_index:012d}")
                    handle.write(json.dumps({
                        "code": code,
                        "countries_tags": "en:united-states",
                        "brands": "Mystery",
                        "product_name": f"Unclassifiable Widget {row_index}",
                        "categories_tags": "",
                    }) + "\n")
            import random
            with self.assertRaises(InsufficientSampleFrameError):
                sampler.sample_openfoodfacts_us(
                    off_path, 385, 385,
                    random.Random(derive_seed(1, "branded")), random.Random(derive_seed(1, "barcode")),
                )


class EndToEndCliTests(unittest.TestCase):
    def test_reproducible_summary_and_missing_input_fails_loudly(self):
        with tempfile.TemporaryDirectory() as tmp:
            wweia_path = os.path.join(tmp, "wweia.csv")
            off_path = os.path.join(tmp, "off.jsonl")
            write_wweia_csv(wweia_path, rows_per_category=60, categories=8)
            write_off_jsonl(off_path, rows_per_category=60)

            def run(samples_out, summary_out):
                return subprocess.run(
                    [
                        sys.executable,
                        os.path.join(SCRIPTS_DIR, "sample-nutrition-frame.py"),
                        "--wweia-csv", wweia_path,
                        "--off-dump", off_path,
                        "--seed", "20260827",
                        "--samples-output", samples_out,
                        "--summary-output", summary_out,
                    ],
                    capture_output=True, text=True, check=False,
                )

            summary_a = os.path.join(tmp, "summary_a.json")
            samples_a = os.path.join(tmp, "samples_a.json")
            result_a = run(samples_a, summary_a)
            self.assertEqual(result_a.returncode, 0, result_a.stderr)

            summary_b = os.path.join(tmp, "summary_b.json")
            samples_b = os.path.join(tmp, "samples_b.json")
            result_b = run(samples_b, summary_b)
            self.assertEqual(result_b.returncode, 0, result_b.stderr)

            with open(summary_a, "rb") as handle_a, open(summary_b, "rb") as handle_b:
                self.assertEqual(handle_a.read(), handle_b.read())
            with open(samples_a, "rb") as handle_a, open(samples_b, "rb") as handle_b:
                self.assertEqual(handle_a.read(), handle_b.read())

            with open(summary_a, "r", encoding="utf-8") as handle:
                summary = json.load(handle)
            self.assertNotIn("samples", json.dumps(summary))
            for stratum in summary["strata"].values():
                self.assertNotIn("samples", stratum)

            missing_result = subprocess.run(
                [
                    sys.executable,
                    os.path.join(SCRIPTS_DIR, "sample-nutrition-frame.py"),
                    "--wweia-csv", os.path.join(tmp, "does-not-exist.csv"),
                    "--off-dump", off_path,
                    "--samples-output", os.path.join(tmp, "unused-samples.json"),
                    "--summary-output", os.path.join(tmp, "unused-summary.json"),
                ],
                capture_output=True, text=True, check=False,
            )
            self.assertNotEqual(missing_result.returncode, 0)


if __name__ == "__main__":
    unittest.main()
