#!/usr/bin/env python3
"""
scripts/xlsx_reader.py

Minimal standard-library reader for the XLSX (OOXML spreadsheet) format,
scoped to reading simple single-sheet-of-values workbooks such as USDA's
published WWEIA food category crosswalk. An XLSX file is a ZIP archive of
XML parts; this reads only the shared-string table and one worksheet's
inline cell values, both via the standard library's zipfile and
xml.etree.ElementTree.

Not a general-purpose spreadsheet reader: no formulas, no styles/formatting,
no merged-cell handling beyond leaving merged cells blank in the trailing
columns as the source XML already does.
"""

from __future__ import annotations

import zipfile
import xml.etree.ElementTree as ElementTree
from typing import Iterator, List, Optional

_NS = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def _read_shared_strings(archive: zipfile.ZipFile) -> List[str]:
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []
    root = ElementTree.fromstring(archive.read("xl/sharedStrings.xml"))
    strings = []
    for si in root.findall("s:si", _NS):
        text = "".join(node.text or "" for node in si.findall(".//s:t", _NS))
        strings.append(text)
    return strings


def _column_index(cell_ref: str) -> int:
    letters = "".join(character for character in cell_ref if character.isalpha())
    index = 0
    for character in letters:
        index = index * 26 + (ord(character.upper()) - ord("A") + 1)
    return index - 1


def iter_sheet_rows(
    path: str, sheet_name: str = "xl/worksheets/sheet1.xml"
) -> Iterator[List[Optional[str]]]:
    """Yields each row as a list of cell string values (None for a blank cell), left-padded by column position."""
    with zipfile.ZipFile(path) as archive:
        shared_strings = _read_shared_strings(archive)
        sheet_root = ElementTree.fromstring(archive.read(sheet_name))
        for row in sheet_root.findall(".//s:row", _NS):
            cells = row.findall("s:c", _NS)
            values: List[Optional[str]] = []
            for cell in cells:
                column = _column_index(cell.get("r", "A1"))
                while len(values) <= column:
                    values.append(None)
                value_node = cell.find("s:v", _NS)
                if value_node is None or value_node.text is None:
                    continue
                cell_type = cell.get("t")
                if cell_type == "s":
                    values[column] = shared_strings[int(value_node.text)]
                else:
                    values[column] = value_node.text
            yield values
