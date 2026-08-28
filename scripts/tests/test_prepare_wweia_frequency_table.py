import sys
import unittest
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from importlib import util as importlib_util  # noqa: E402


def _load_prepare_module():
    spec = importlib_util.spec_from_file_location(
        "prepare_wweia_frequency_table",
        Path(__file__).resolve().parents[1] / "prepare-wweia-frequency-table.py",
    )
    module = importlib_util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


prepare = _load_prepare_module()


class TestCountReportingFrequency(unittest.TestCase):
    def test_counts_by_food_code_and_skips_missing(self):
        rows = [
            {"DR1IFDCD": 11000000.0},
            {"DR1IFDCD": 11000000.0},
            {"DR1IFDCD": 27310100.0},
            {"DR1IFDCD": None},
        ]
        frequency = prepare.count_reporting_frequency(rows)
        self.assertEqual(frequency[11000000], 2)
        self.assertEqual(frequency[27310100], 1)
        self.assertNotIn(None, frequency)


class TestReadFoodCodeCrosswalk(unittest.TestCase):
    def test_skips_title_and_header_rows_and_keys_by_int_code(self):
        rows = [
            ["Food and Beverages\n2021-2023 ...", None, None, None, None],
            ["Food code", "Main food description", "Additional food description", "WWEIA Category number", "WWEIA Category description"],
            ["11000000", "Milk, human", None, "9602", "Human milk"],
            ["11111000", "Milk, whole", "leche fresca", "1002", "Milk, whole"],
        ]
        crosswalk = prepare.read_food_code_crosswalk(rows)
        self.assertEqual(crosswalk[11000000], ("Milk, human", "Human milk"))
        self.assertEqual(crosswalk[11111000], ("Milk, whole", "Milk, whole"))
        self.assertEqual(len(crosswalk), 2)

    def test_row_with_missing_code_or_description_excluded(self):
        rows = [["", None, None, None, None], ["11000000", None, None, "9602", "Human milk"]]
        crosswalk = prepare.read_food_code_crosswalk(rows)
        self.assertEqual(crosswalk, {})


class TestBuildFrequencyTable(unittest.TestCase):
    def test_joins_and_reports_unjoined_count(self):
        frequency = Counter({11000000: 5, 99999999: 2})
        crosswalk = {11000000: ("Milk, human", "Human milk")}
        rows, unjoined = prepare.build_frequency_table(frequency, crosswalk)
        self.assertEqual(unjoined, 1)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["food_code"], "11000000")
        self.assertEqual(rows[0]["reporting_frequency"], 5)

    def test_blank_category_defaults_to_general(self):
        frequency = Counter({11000000: 1})
        crosswalk = {11000000: ("Milk, human", "")}
        rows, _ = prepare.build_frequency_table(frequency, crosswalk)
        self.assertEqual(rows[0]["wweia_category_description"], "General")

    def test_output_sorted_by_food_code(self):
        frequency = Counter({30000000: 1, 11000000: 1})
        crosswalk = {30000000: ("B", "cat"), 11000000: ("A", "cat")}
        rows, _ = prepare.build_frequency_table(frequency, crosswalk)
        self.assertEqual([row["food_code"] for row in rows], ["11000000", "30000000"])


if __name__ == "__main__":
    unittest.main()
