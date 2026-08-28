#!/usr/bin/env python3
"""
scripts/sas_xport.py

Minimal standard-library reader for the SAS Transport (XPORT, V5) file format,
scoped to what this repository's nutrition evaluation tooling needs: reading
NHANES/WWEIA dietary data files, which CDC publishes exclusively in this
format (no CSV/XLSX alternative exists).

Implements SAS Technical Support document TS-140's V5 transport layout.
Header records (library, member, descriptor, namestr, obs) are fixed 80-byte
ASCII blocks; namestr (variable metadata) records are fixed 140-byte binary
structs; observation data is fixed-width binary rows, one per subject/food
entry, with numeric values stored as IBM/370 hexadecimal floating point.

Not a general-purpose SAS reader: only V5 transport (not V8/CPORT), and only
the numeric/character variable types NHANES files actually use.
"""

from __future__ import annotations

import struct
from typing import Any, Dict, Iterator, List, Optional, Union

_RECORD_LEN = 80
_NAMESTR_LEN = 140


def _find_record(data: bytes, marker: bytes) -> int:
    idx = data.find(marker)
    if idx == -1:
        raise ValueError(f"malformed XPORT file: marker not found: {marker!r}")
    return (idx // _RECORD_LEN) * _RECORD_LEN


def _decode_ibm_float(raw: bytes) -> Optional[float]:
    padded = raw + b"\x00" * (8 - len(raw)) if len(raw) < 8 else raw
    first = padded[0]
    # SAS missing-value sentinel: '.' or 'A'-'Z' in the leading byte with an
    # otherwise all-zero mantissa/exponent field.
    if (first == 0x2E or 0x41 <= first <= 0x5A) and padded[1:] == b"\x00" * 7:
        return None
    if padded == b"\x00" * 8:
        return 0.0
    sign = -1.0 if (first & 0x80) else 1.0
    exponent = (first & 0x7F) - 64
    mantissa_int = int.from_bytes(padded[1:8], "big")
    return sign * (mantissa_int / 16.0 ** 14) * (16.0 ** exponent)


class XportVariable:
    __slots__ = ("ntype", "nlng", "nvar0", "name", "label")

    def __init__(self, ntype: int, nlng: int, nvar0: int, name: str, label: str):
        self.ntype = ntype
        self.nlng = nlng
        self.nvar0 = nvar0
        self.name = name
        self.label = label


def _read_namestrs(data: bytes) -> List[XportVariable]:
    namestr_hdr_pos = _find_record(data, b"NAMESTR HEADER RECORD")
    pos = namestr_hdr_pos + _RECORD_LEN
    variables: List[XportVariable] = []
    expected_nvar0 = 1
    while True:
        chunk = data[pos : pos + _NAMESTR_LEN]
        if len(chunk) < _NAMESTR_LEN:
            raise ValueError("malformed XPORT file: truncated namestr block")
        ntype, _nhfun, nlng, nvar0 = struct.unpack(">hhhh", chunk[0:8])
        # Sequential nvar0 validation (rather than trusting the namestr
        # header's embedded count field, whose exact field width TS-140
        # documents inconsistently across tooling) is what makes this
        # self-checking: it stops exactly where real files place the OBS
        # header, confirmed against actual NHANES files during development.
        if nvar0 != expected_nvar0 or ntype not in (1, 2):
            break
        name = chunk[8:16].decode("latin-1").rstrip()
        label = chunk[16:56].decode("latin-1").rstrip()
        variables.append(XportVariable(ntype, nlng, nvar0, name, label))
        expected_nvar0 += 1
        pos += _NAMESTR_LEN
    if not variables:
        raise ValueError("malformed XPORT file: no namestr records found")
    return variables


def _obs_data_start(data: bytes, namestr_end: int) -> int:
    obs_hdr_pos = ((namestr_end + _RECORD_LEN - 1) // _RECORD_LEN) * _RECORD_LEN
    marker = data[obs_hdr_pos : obs_hdr_pos + _RECORD_LEN]
    if b"OBS" not in marker or b"HEADER RECORD" not in marker:
        raise ValueError(
            "malformed XPORT file: expected OBS header record not found at "
            f"offset {obs_hdr_pos}; namestr parsing likely desynchronized"
        )
    return obs_hdr_pos + _RECORD_LEN


def read_xport_variables(path: str) -> List[Dict[str, Any]]:
    """Returns namestr metadata only (name, label, type, length) — cheap, no observation data read."""
    # A dataset with hundreds of variables still fits comfortably in 1 MiB of
    # namestr records (140 bytes each); observation data is never read here.
    with open(path, "rb") as source:
        header = source.read(1024 * 1024)
    variables = _read_namestrs(header)
    return [
        {
            "name": variable.name,
            "label": variable.label,
            "type": "numeric" if variable.ntype == 1 else "character",
            "length": variable.nlng,
        }
        for variable in variables
    ]


def iter_xport_rows(path: str) -> Iterator[Dict[str, Union[str, float, None]]]:
    """Yields one dict per observation, keyed by variable name."""
    with open(path, "rb") as source:
        data = source.read()

    namestr_hdr_pos = _find_record(data, b"NAMESTR HEADER RECORD")
    variables = _read_namestrs(data)
    namestr_end = namestr_hdr_pos + _RECORD_LEN + len(variables) * _NAMESTR_LEN
    obs_start = _obs_data_start(data, namestr_end)

    record_len = sum(variable.nlng for variable in variables)
    if record_len <= 0:
        raise ValueError("malformed XPORT file: zero-length observation record")

    obs_bytes = data[obs_start:]
    row_count = len(obs_bytes) // record_len

    for row_index in range(row_count):
        row_start = row_index * record_len
        offset = 0
        row: Dict[str, Union[str, float, None]] = {}
        for variable in variables:
            raw = obs_bytes[row_start + offset : row_start + offset + variable.nlng]
            if variable.ntype == 2:
                row[variable.name] = raw.decode("latin-1").rstrip()
            else:
                row[variable.name] = _decode_ibm_float(raw)
            offset += variable.nlng
        yield row
