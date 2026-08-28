import random
import unittest

from _load_module import SCRIPTS_DIR  # noqa: F401  (ensures scripts dir is on sys.path)
from nutrition_eval_lib import (
    InsufficientSampleFrameError,
    allocate_quota,
    gtin_check_digit_is_valid,
    normalize_food_name,
    normalize_gtin,
    weighted_sample_without_replacement,
    wilson_score_interval,
)


class GtinValidationTests(unittest.TestCase):
    def test_valid_gtin8(self):
        self.assertTrue(gtin_check_digit_is_valid("96385074"))

    def test_valid_gtin12(self):
        self.assertTrue(gtin_check_digit_is_valid("012345678905"))

    def test_valid_gtin13(self):
        self.assertTrue(gtin_check_digit_is_valid("4006381333931"))

    def test_valid_gtin14(self):
        self.assertTrue(gtin_check_digit_is_valid("14006381333938"))

    def test_invalid_check_digit(self):
        self.assertFalse(gtin_check_digit_is_valid("012345678904"))

    def test_non_digit_characters(self):
        self.assertFalse(gtin_check_digit_is_valid("01234567890A"))

    def test_wrong_length_short(self):
        self.assertFalse(gtin_check_digit_is_valid("123456789"))
        self.assertFalse(gtin_check_digit_is_valid("12345678901"))

    def test_wrong_length_long(self):
        self.assertFalse(gtin_check_digit_is_valid("123456789012345"))

    def test_normalize_rejects_invalid(self):
        self.assertIsNone(normalize_gtin("012345678904"))

    def test_normalize_pads_gtin12_to_gtin14_preserving_leading_zeroes(self):
        self.assertEqual(normalize_gtin("012345678905"), "00012345678905")

    def test_normalize_pads_gtin8_to_gtin14(self):
        self.assertEqual(normalize_gtin("96385074"), "00000096385074")

    def test_normalize_leaves_gtin14_unchanged(self):
        self.assertEqual(normalize_gtin("14006381333938"), "14006381333938")


class WilsonScoreIntervalTests(unittest.TestCase):
    @staticmethod
    def _reference(successes, total, z=1.95996):
        if total == 0:
            return 0.0, 0.0, 0.0
        n = total
        p_hat = successes / n
        denom = 1 + z * z / n
        centre = p_hat + z * z / (2 * n)
        adjustment = z * ((p_hat * (1 - p_hat) / n + z * z / (4 * n * n)) ** 0.5)
        lower = (centre - adjustment) / denom
        upper = (centre + adjustment) / denom
        return p_hat, max(0.0, lower), min(1.0, upper)

    def test_zero_total_returns_zeros(self):
        self.assertEqual(wilson_score_interval(0, 0), (0.0, 0.0, 0.0))

    def test_zero_successes_lower_bound_is_zero(self):
        point, lower, upper = wilson_score_interval(0, 100)
        self.assertEqual(point, 0.0)
        # Algebraically exactly 0; floating-point sqrt rounding can leave a
        # ~1e-18 residual, so compare with tolerance rather than equality.
        self.assertAlmostEqual(lower, 0.0, places=9)
        self.assertGreater(upper, 0.0)

    def test_all_successes_upper_bound_is_exactly_one(self):
        point, lower, upper = wilson_score_interval(50, 50)
        self.assertEqual(point, 1.0)
        self.assertAlmostEqual(upper, 1.0, places=9)
        self.assertLess(lower, 1.0)
        self.assertGreaterEqual(lower, 0.0)

    def test_matches_independently_written_reference_formula(self):
        for successes, total in ((350, 385), (346, 385), (308, 385), (1, 385), (384, 385)):
            with self.subTest(successes=successes, total=total):
                expected = self._reference(successes, total)
                actual = wilson_score_interval(successes, total)
                for e, a in zip(expected, actual):
                    self.assertAlmostEqual(e, a, places=9)

    def test_ordinary_food_worked_example_clears_lower_bound_threshold(self):
        point, lower, upper = wilson_score_interval(350, 385)
        self.assertGreater(point, 0.90)
        self.assertGreater(lower, 0.85)
        self.assertLess(lower, upper)

    def test_rejects_successes_out_of_range(self):
        with self.assertRaises(ValueError):
            wilson_score_interval(-1, 10)
        with self.assertRaises(ValueError):
            wilson_score_interval(11, 10)


class WeightedSampleWithoutReplacementTests(unittest.TestCase):
    def test_deterministic_given_same_seed(self):
        items = [f"item-{i}" for i in range(50)]
        weights = [1.0 + (i % 5) for i in range(50)]
        first = weighted_sample_without_replacement(items, weights, 10, random.Random(20260827))
        second = weighted_sample_without_replacement(items, weights, 10, random.Random(20260827))
        self.assertEqual(first, second)

    def test_heavily_weighted_item_selected_far_more_often_than_uniform_baseline(self):
        items = list(range(20))
        weights = [1.0] * 20
        weights[0] = 1_000_000.0
        hits = 0
        trials = 200
        for seed in range(trials):
            sample = weighted_sample_without_replacement(items, weights, 3, random.Random(seed))
            if 0 in sample:
                hits += 1
        uniform_expected = trials * (3 / 20)
        self.assertGreater(hits, uniform_expected * 2)

    def test_raises_when_k_exceeds_pool(self):
        with self.assertRaises(ValueError):
            weighted_sample_without_replacement([1, 2], [1.0, 1.0], 3, random.Random(1))

    def test_k_equals_pool_returns_all_items(self):
        items = [1, 2, 3]
        result = weighted_sample_without_replacement(items, [1.0, 1.0, 1.0], 3, random.Random(1))
        self.assertEqual(sorted(result), items)


class AllocateQuotaTests(unittest.TestCase):
    def test_sums_to_exact_sample_size_even_split(self):
        pools = {"a": 200, "b": 200, "c": 200, "d": 200}
        quota = allocate_quota(pools, 385)
        self.assertEqual(sum(quota.values()), 385)
        for category, count in quota.items():
            self.assertLessEqual(count, pools[category])

    def test_sums_to_exact_sample_size_lopsided_pools(self):
        pools = {"a": 2, "b": 500, "c": 500, "d": 500, "e": 500, "f": 500, "g": 500, "h": 500}
        quota = allocate_quota(pools, 385)
        self.assertEqual(sum(quota.values()), 385)
        self.assertLessEqual(quota["a"], 2)

    def test_sums_to_exact_sample_size_many_lopsided_configurations(self):
        configurations = [
            {"a": 1, "b": 1, "c": 1000},
            {"a": 60, "b": 60, "c": 60, "d": 60, "e": 60, "f": 60, "g": 60, "h": 60},
            {"a": 385},
            {"a": 100, "b": 100, "c": 100, "d": 100},
        ]
        for pools in configurations:
            with self.subTest(pools=pools):
                quota = allocate_quota(pools, 385)
                self.assertEqual(sum(quota.values()), 385)

    def test_raises_when_total_pool_insufficient(self):
        with self.assertRaises(InsufficientSampleFrameError):
            allocate_quota({"a": 10, "b": 10}, 385)

    def test_empty_pools_with_zero_sample_size(self):
        self.assertEqual(allocate_quota({}, 0), {})

    def test_empty_pools_with_positive_sample_size_raises(self):
        with self.assertRaises(InsufficientSampleFrameError):
            allocate_quota({}, 5)


class NormalizeFoodNameTests(unittest.TestCase):
    def test_case_whitespace_and_punctuation_normalize_predictably(self):
        variants = [
            "  Ground Beef,  85% Lean  ",
            "ground beef, 85% lean",
            "GROUND BEEF 85% LEAN",
            " ground   beef   85%   lean ",
        ]
        normalized = {normalize_food_name(v) for v in variants}
        self.assertEqual(len(normalized), 1)

    def test_preserves_variant_and_preparation_tokens(self):
        for word in ("diet", "zero", "light", "original", "raw", "cooked", "frozen", "canned"):
            self.assertIn(word, normalize_food_name(f"Sample {word} Product").split(" "))

    def test_preserves_brand_tokens(self):
        self.assertIn("kraft", normalize_food_name("Kraft Mac and Cheese").split(" "))

    def test_plurals_fold_predictably(self):
        self.assertEqual(normalize_food_name("apples"), "apple")
        self.assertEqual(normalize_food_name("Tomatoes"), "tomatoe")

    def test_short_and_exempted_words_not_mangled(self):
        self.assertEqual(normalize_food_name("Swiss"), "swiss")
        self.assertEqual(normalize_food_name("Hummus"), "hummus")
        self.assertEqual(normalize_food_name("Raw"), "raw")


if __name__ == "__main__":
    unittest.main()
