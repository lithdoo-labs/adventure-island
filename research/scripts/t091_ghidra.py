"""T091 helper: query the local Ghidra decompiled CSV (E:\\ghidra-projects\\decompiled_v2.csv)
by address or name. Returns the decompiled pseudocode of the containing function."""
import bisect
import csv
import sys
from pathlib import Path

csv.field_size_limit(1 << 30)

CSV_PATH = Path(r"E:\ghidra-projects\decompiled_v2.csv")

_cache = None


def _load():
    global _cache
    if _cache is None:
        rows = []
        with open(CSV_PATH, encoding="utf-8", errors="replace") as f:
            r = csv.reader(f)
            next(r)
            for row in r:
                if len(row) >= 3 and row[0]:
                    try:
                        rows.append((int(row[0], 16), row[1], row[2]))
                    except ValueError:
                        pass
        rows.sort()
        _cache = (rows, [x[0] for x in rows])
    return _cache


def functions_in(lo, hi):
    rows, _ = _load()
    return [(va, name) for va, name, _ in rows if lo <= va < hi]


def containing(va):
    """Function whose RVA range covers va (next function start bounds it)."""
    rows, starts = _load()
    i = bisect.bisect_right(starts, va) - 1
    if i < 0:
        return None
    start, name, code = rows[i]
    end = starts[i + 1] if i + 1 < len(starts) else None
    if end is not None and va >= end:
        return None
    return start, end, name, code


def by_name(sub):
    rows, _ = _load()
    sub = sub.lower()
    return [(va, name) for va, name, _ in rows if sub in name.lower()]


if __name__ == "__main__":
    va = int(sys.argv[1], 16)
    res = containing(va)
    if res is None:
        print(f"no containing function for {va:#x}")
    else:
        start, end, name, code = res
        print(f"# {name} @ {start:#x}..{(end or 0):#x} (query {va:#x})")
        print(code)
