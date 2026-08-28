import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sas_xport import _decode_ibm_float  # noqa: E402


class TestDecodeIbmFloat(unittest.TestCase):
    def test_official_ts140_reference_vectors(self):
        cases = [
            (bytes.fromhex("4110000000000000"), 1.0),
            (bytes.fromhex("C110000000000000"), -1.0),
            (bytes.fromhex("0000000000000000"), 0.0),
            (bytes.fromhex("4264000000000000"), 100.0),
        ]
        for raw, expected in cases:
            with self.subTest(raw=raw.hex()):
                self.assertAlmostEqual(_decode_ibm_float(raw), expected, places=9)

    def test_self_derived_two_point_zero(self):
        # exponent (0x41 & 0x7F) - 64 = 1; mantissa 0x20 * 16^12 -> 2/16 * 16 = 2.0
        self.assertAlmostEqual(_decode_ibm_float(bytes.fromhex("4120000000000000")), 2.0, places=9)

    def test_self_derived_half(self):
        # exponent (0x40 & 0x7F) - 64 = 0; mantissa 0x80... -> 8*16^13 / 16^14 = 0.5
        self.assertAlmostEqual(_decode_ibm_float(bytes.fromhex("4080000000000000")), 0.5, places=9)

    def test_missing_value_dot_sentinel(self):
        raw = b"." + b"\x00" * 7
        self.assertIsNone(_decode_ibm_float(raw))

    def test_missing_value_letter_sentinel(self):
        raw = b"Z" + b"\x00" * 7
        self.assertIsNone(_decode_ibm_float(raw))

    def test_short_field_right_padded(self):
        # A 3-byte field is right-padded with zero bytes before decoding, per XPORT spec.
        self.assertAlmostEqual(_decode_ibm_float(bytes.fromhex("411000")), 1.0, places=9)


if __name__ == "__main__":
    unittest.main()
