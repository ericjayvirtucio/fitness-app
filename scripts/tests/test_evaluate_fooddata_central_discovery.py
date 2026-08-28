import csv
import io
import json
import os
import subprocess
import sys
import tempfile
import unittest
import zipfile

from _load_module import SCRIPTS_DIR, load_module

evaluator = load_module("evaluate-fooddata-central-discovery.py", "evaluate_fooddata_central_discovery")


def gtin13(payload12: str) -> str:
    digits = [int(character) for character in payload12]
    total = sum(digit * (3 if (len(digits) - index) % 2 == 1 else 1) for index, digit in enumerate(digits))
    check = (10 - total % 10) % 10
    return payload12 + str(check)


NUTRIENT_TABLE_ROWS = [
    {"id": "1003", "nutrient_nbr": "203"},
    {"id": "1004", "nutrient_nbr": "204"},
    {"id": "1005", "nutrient_nbr": "205"},
    {"id": "1008", "nutrient_nbr": "208"},
    {"id": "1079", "nutrient_nbr": "291"},
    {"id": "2000", "nutrient_nbr": "269"},
    {"id": "1093", "nutrient_nbr": "307"},
]


def _write_csv(zf: zipfile.ZipFile, arcname: str, fieldnames, rows) -> None:
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=fieldnames)
    writer.writeheader()
    for row in rows:
        writer.writerow(row)
    zf.writestr(arcname, buffer.getvalue())


def build_foundation_zip(path: str) -> None:
    folder = "FoodData_Central_foundation_food_csv_2026-04-30"
    with zipfile.ZipFile(path, "w") as zf:
        _write_csv(zf, f"{folder}/food.csv", ["fdc_id", "description", "data_type", "publication_date"], [
            {"fdc_id": "1", "description": "Chicken Breast Raw", "data_type": "foundation_food", "publication_date": "2026-01-01"},
            {"fdc_id": "2", "description": "Ground Beef 85 Lean", "data_type": "foundation_food", "publication_date": "2026-01-01"},
            {"fdc_id": "3", "description": "Excluded Sample Row", "data_type": "sample_food", "publication_date": "2026-01-01"},
        ])
        _write_csv(zf, f"{folder}/nutrient.csv", ["id", "nutrient_nbr"], NUTRIENT_TABLE_ROWS)
        _write_csv(zf, f"{folder}/food_nutrient.csv", ["fdc_id", "nutrient_id", "amount"], [
            {"fdc_id": "1", "nutrient_id": "1003", "amount": "25"},
            {"fdc_id": "1", "nutrient_id": "1004", "amount": "3"},
            {"fdc_id": "1", "nutrient_id": "1005", "amount": "0"},
            {"fdc_id": "1", "nutrient_id": "1008", "amount": "120"},
            {"fdc_id": "1", "nutrient_id": "1079", "amount": "0"},
            {"fdc_id": "1", "nutrient_id": "2000", "amount": "0"},
            {"fdc_id": "1", "nutrient_id": "1093", "amount": "60"},
            {"fdc_id": "2", "nutrient_id": "1003", "amount": "20"},
            {"fdc_id": "2", "nutrient_id": "1004", "amount": "15"},
            {"fdc_id": "2", "nutrient_id": "1005", "amount": "0"},
            {"fdc_id": "2", "nutrient_id": "1008", "amount": "250"},
        ])


def build_fndds_zip(path: str) -> None:
    folder = "FoodData_Central_survey_food_csv_2024-10-31"
    with zipfile.ZipFile(path, "w") as zf:
        _write_csv(zf, f"{folder}/food.csv", ["fdc_id", "description", "data_type", "publication_date"], [
            {"fdc_id": "100", "description": "Rice White Cooked", "data_type": "survey_fndds_food", "publication_date": "2026-01-01"},
        ])
        _write_csv(zf, f"{folder}/nutrient.csv", ["id", "nutrient_nbr"], NUTRIENT_TABLE_ROWS)
        _write_csv(zf, f"{folder}/food_nutrient.csv", ["fdc_id", "nutrient_id", "amount"], [
            {"fdc_id": "100", "nutrient_id": "1003", "amount": "5"},
            {"fdc_id": "100", "nutrient_id": "1004", "amount": "1"},
            {"fdc_id": "100", "nutrient_id": "1005", "amount": "45"},
            {"fdc_id": "100", "nutrient_id": "1008", "amount": "200"},
        ])


TIE_GTIN = gtin13("111111111111")


def build_branded_zip(path: str) -> None:
    folder = "FoodData_Central_branded_food_csv_2026-04-30"
    with zipfile.ZipFile(path, "w") as zf:
        _write_csv(zf, f"{folder}/food.csv", ["fdc_id", "description", "data_type", "publication_date"], [
            {"fdc_id": "10", "description": "Mac And Cheese", "data_type": "branded_food", "publication_date": "2026-01-01"},
            {"fdc_id": "11", "description": "Discontinued Item", "data_type": "branded_food", "publication_date": "2025-01-01"},
            {"fdc_id": "20", "description": "Tied Product A", "data_type": "branded_food", "publication_date": "2026-02-01"},
            {"fdc_id": "21", "description": "Tied Product B", "data_type": "branded_food", "publication_date": "2026-02-01"},
        ])
        _write_csv(zf, f"{folder}/nutrient.csv", ["id", "nutrient_nbr"], NUTRIENT_TABLE_ROWS)
        _write_csv(zf, f"{folder}/food_nutrient.csv", ["fdc_id", "nutrient_id", "amount"], [
            {"fdc_id": "10", "nutrient_id": "1003", "amount": "10"},
            {"fdc_id": "10", "nutrient_id": "1004", "amount": "10"},
            {"fdc_id": "10", "nutrient_id": "1005", "amount": "10"},
            {"fdc_id": "10", "nutrient_id": "1008", "amount": "300"},
            {"fdc_id": "10", "nutrient_id": "1079", "amount": "2"},
            {"fdc_id": "10", "nutrient_id": "2000", "amount": "3"},
            {"fdc_id": "10", "nutrient_id": "1093", "amount": "400"},
        ])
        _write_csv(zf, f"{folder}/branded_food.csv", ["fdc_id", "gtin_upc", "discontinued_date", "brand_owner", "brand_name", "market_country"], [
            {"fdc_id": "10", "gtin_upc": "012345678905", "discontinued_date": "", "brand_owner": "Kraft", "brand_name": "", "market_country": "United States"},
            {"fdc_id": "11", "gtin_upc": "96385074", "discontinued_date": "2025-01-01", "brand_owner": "DiscontinuedBrand", "brand_name": "", "market_country": "United States"},
            {"fdc_id": "20", "gtin_upc": TIE_GTIN, "discontinued_date": "", "brand_owner": "", "brand_name": "TieBrand", "market_country": "United States"},
            {"fdc_id": "21", "gtin_upc": TIE_GTIN, "discontinued_date": "", "brand_owner": "", "brand_name": "TieBrand", "market_country": "United States"},
        ])


def make_candidate(fdc_id: int, normalized: str, nutrient_mask: int = 0) -> dict:
    return {"fdc_id": fdc_id, "normalized": normalized, "tokens": evaluator._tokens(normalized), "nutrient_mask": nutrient_mask}


class RankingAndClassificationTests(unittest.TestCase):
    def test_exact_match_is_acceptable(self):
        candidates = [make_candidate(1, "chicken breast raw", 127)]
        status, entry = evaluator._classify("chicken breast raw", evaluator._tokens("chicken breast raw"), candidates)
        self.assertEqual(status, "acceptable")
        self.assertEqual(entry["fdc_id"], 1)

    def test_partial_token_overlap_is_not_a_false_positive_match(self):
        candidates = [make_candidate(1, "chicken breast raw", 127)]
        query_normalized = "chicken broth"
        status, entry = evaluator._classify(query_normalized, evaluator._tokens(query_normalized), candidates)
        self.assertEqual(status, "no_match")
        self.assertIsNone(entry)

    def test_near_tied_candidates_are_ambiguous(self):
        candidates = [
            make_candidate(1, "whole wheat bread", 127),
            make_candidate(2, "multigrain wheat bread", 127),
        ]
        query_normalized = "wheat bread"
        status, entry = evaluator._classify(query_normalized, evaluator._tokens(query_normalized), candidates)
        self.assertEqual(status, "ambiguous")
        self.assertIsNone(entry)

    def test_empty_query_tokens_is_no_match(self):
        status, entry = evaluator._classify("", frozenset(), [make_candidate(1, "anything", 127)])
        self.assertEqual(status, "no_match")
        self.assertIsNone(entry)

    def test_no_eligible_candidates_is_no_match(self):
        candidates = [make_candidate(1, "completely different item", 0)]
        status, _ = evaluator._classify("chicken breast raw", evaluator._tokens("chicken breast raw"), candidates)
        self.assertEqual(status, "no_match")

    def test_verbose_legal_brand_owner_prefix_does_not_block_a_full_containment_match(self):
        # Regression: Sprint 52's real run against FoodData Central found 102
        # of 277 branded-name "no_match" results were objectively present in
        # FDC under the same GTIN -- FDC's brand_owner field is often a legal
        # entity name (e.g. "Cooperative Region of Organic Producer Pool")
        # rather than a retail brand, which drags the old Jaccard-floor
        # eligibility gate below 0.6 even when every query token is present.
        query_normalized = "new york strip steak"
        candidates = [
            make_candidate(
                1,
                "cooperative region of organic producer pool grassfed organic beef new york strip steak",
                127,
            )
        ]
        status, entry = evaluator._classify(query_normalized, evaluator._tokens(query_normalized), candidates)
        self.assertEqual(status, "acceptable")
        self.assertEqual(entry["fdc_id"], 1)


class AggregateUsableAndCompleteTests(unittest.TestCase):
    def test_usable_and_complete_rates_over_accepted_matches_only(self):
        full = {"fdc_id": 1, "nutrient_mask": evaluator.COMPLETE_MASK}
        usable_only = {"fdc_id": 2, "nutrient_mask": evaluator.USABLE_MASK}
        neither = {"fdc_id": 3, "nutrient_mask": 0}
        results = [
            ("acceptable", full),
            ("acceptable", usable_only),
            ("acceptable", neither),
            ("no_match", None),
        ]
        aggregate = evaluator._aggregate(results, "acceptable")
        self.assertEqual(aggregate["denominator"], 4)
        self.assertEqual(aggregate["match_count"], 3)
        self.assertEqual(aggregate["no_match_count"], 1)
        self.assertAlmostEqual(aggregate["nutrition_usable_rate"], 2 / 3)
        self.assertAlmostEqual(aggregate["nutrition_complete_rate"], 1 / 3)

    def test_no_matches_yields_none_rates_not_division_by_zero(self):
        results = [("no_match", None), ("no_match", None)]
        aggregate = evaluator._aggregate(results, "acceptable")
        self.assertIsNone(aggregate["nutrition_usable_rate"])
        self.assertIsNone(aggregate["nutrition_complete_rate"])


class ArchiveIndexTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.foundation_path = os.path.join(self.tmp.name, "foundation.zip")
        self.fndds_path = os.path.join(self.tmp.name, "fndds.zip")
        self.branded_path = os.path.join(self.tmp.name, "branded.zip")
        build_foundation_zip(self.foundation_path)
        build_fndds_zip(self.fndds_path)
        build_branded_zip(self.branded_path)

    def tearDown(self):
        self.tmp.cleanup()

    def test_ordinary_index_excludes_non_searchable_data_types(self):
        index = evaluator.build_ordinary_index(self.foundation_path, self.fndds_path)
        fdc_ids = {entry["fdc_id"] for entry in index}
        self.assertIn(1, fdc_ids)
        self.assertIn(2, fdc_ids)
        self.assertIn(100, fdc_ids)
        self.assertNotIn(3, fdc_ids)

    def test_branded_index_excludes_discontinued_rows(self):
        index, _ = evaluator.build_branded_index(self.branded_path)
        from nutrition_eval_lib import normalize_gtin
        self.assertNotIn(normalize_gtin("96385074"), index)

    def test_branded_index_includes_live_record(self):
        index, _ = evaluator.build_branded_index(self.branded_path)
        from nutrition_eval_lib import normalize_gtin
        entry = index[normalize_gtin("012345678905")]
        self.assertEqual(entry["fdc_id"], 10)
        self.assertEqual(entry["nutrient_mask"], evaluator.COMPLETE_MASK)

    def test_same_date_tie_is_flagged_ambiguous(self):
        _, ambiguous_gtins = evaluator.build_branded_index(self.branded_path)
        from nutrition_eval_lib import normalize_gtin
        self.assertIn(normalize_gtin(TIE_GTIN), ambiguous_gtins)

    def test_barcode_sample_evaluation(self):
        index, ambiguous_gtins = evaluator.build_branded_index(self.branded_path)
        from nutrition_eval_lib import normalize_gtin

        status, entry = evaluator.evaluate_barcode_sample(
            {"canonical_gtin": normalize_gtin("012345678905")}, index, ambiguous_gtins
        )
        self.assertEqual(status, "exact_match")
        self.assertEqual(entry["fdc_id"], 10)

        status, entry = evaluator.evaluate_barcode_sample(
            {"canonical_gtin": normalize_gtin(TIE_GTIN)}, index, ambiguous_gtins
        )
        self.assertEqual(status, "ambiguous")
        self.assertIsNone(entry)

        status, entry = evaluate_status = evaluator.evaluate_barcode_sample(
            {"canonical_gtin": normalize_gtin("96385074")}, index, ambiguous_gtins
        )
        self.assertEqual(status, "no_match")

        status, entry = evaluator.evaluate_barcode_sample(
            {"canonical_gtin": "99999999999999"}, index, ambiguous_gtins
        )
        self.assertEqual(status, "no_match")


class EndToEndCliTests(unittest.TestCase):
    def test_cli_produces_expected_aggregate_structure(self):
        with tempfile.TemporaryDirectory() as tmp:
            foundation_path = os.path.join(tmp, "foundation.zip")
            fndds_path = os.path.join(tmp, "fndds.zip")
            branded_path = os.path.join(tmp, "branded.zip")
            build_foundation_zip(foundation_path)
            build_fndds_zip(fndds_path)
            build_branded_zip(branded_path)

            samples = {
                "strata": {
                    "ordinary_foods": {"samples": [
                        {"query": "Chicken Breast Raw"},
                        {"query": "Totally Unmatched Query Xyz"},
                    ]},
                    "branded_names": {"samples": [
                        {"brand": "Kraft", "product_name": "Mac And Cheese"},
                    ]},
                    "exact_barcodes": {"samples": [
                        {"canonical_gtin": "00012345678905"},
                        {"canonical_gtin": "99999999999999"},
                    ]},
                },
            }
            samples_path = os.path.join(tmp, "samples.json")
            with open(samples_path, "w", encoding="utf-8") as handle:
                json.dump(samples, handle)

            output_path = os.path.join(tmp, "output.json")
            result = subprocess.run(
                [
                    sys.executable,
                    os.path.join(SCRIPTS_DIR, "evaluate-fooddata-central-discovery.py"),
                    "--samples", samples_path,
                    "--foundation", foundation_path,
                    "--fndds", fndds_path,
                    "--branded", branded_path,
                    "--output", output_path,
                ],
                capture_output=True, text=True, check=False,
            )
            self.assertEqual(result.returncode, 0, result.stderr)

            with open(output_path, "r", encoding="utf-8") as handle:
                output = json.load(handle)

            self.assertEqual(output["strata"]["ordinary_foods"]["denominator"], 2)
            self.assertEqual(output["strata"]["ordinary_foods"]["match_count"], 1)
            self.assertEqual(output["strata"]["branded_names"]["match_count"], 1)
            self.assertEqual(output["strata"]["exact_barcodes"]["match_count"], 1)
            self.assertEqual(output["strata"]["exact_barcodes"]["no_match_count"], 1)
            self.assertIn("name_match_eligibility", output)
            dumped = json.dumps(output)
            self.assertNotIn("Chicken Breast Raw", dumped)
            self.assertNotIn("012345678905", dumped)


if __name__ == "__main__":
    unittest.main()
