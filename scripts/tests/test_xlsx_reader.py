import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from xlsx_reader import iter_sheet_rows  # noqa: E402

_CONTENT_TYPES = b"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>"""

_SHARED_STRINGS = b"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="2" uniqueCount="2">
<si><t>Food code</t></si>
<si><t>Milk, human</t></si>
</sst>"""

_SHEET1 = b"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetData>
<row r="1"><c r="A1" t="s"><v>0</v></c></row>
<row r="2"><c r="A2"><v>11000000</v></c><c r="C2" t="s"><v>1</v></c></row>
</sheetData>
</worksheet>"""


def _build_fixture_xlsx(path: str) -> None:
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("[Content_Types].xml", _CONTENT_TYPES)
        archive.writestr("xl/sharedStrings.xml", _SHARED_STRINGS)
        archive.writestr("xl/worksheets/sheet1.xml", _SHEET1)


class TestIterSheetRows(unittest.TestCase):
    def test_reads_shared_strings_and_inline_numbers_with_column_gaps(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = f"{tmp}/fixture.xlsx"
            _build_fixture_xlsx(path)
            rows = list(iter_sheet_rows(path))
        self.assertEqual(rows[0], ["Food code"])
        # Column B is a gap (no <c r="B2">) -- must appear as None, not be skipped.
        self.assertEqual(rows[1], ["11000000", None, "Milk, human"])


if __name__ == "__main__":
    unittest.main()
