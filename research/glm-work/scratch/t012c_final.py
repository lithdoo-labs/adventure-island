"""Final checks: named-3 sites, and direct disasm at the unresolved cluster
backedge targets."""
from __future__ import annotations

import csv
import sys
from pathlib import Path

from capstone import CS_ARCH_X86, CS_MODE_32, Cs

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "scripts"))
import maple079_probe_cfg as probe  # noqa: E402

ROOT = HERE.parents[1]
WIDE = ROOT / "glm-work" / "scratch" / "tailb-wide-at-probe.bin"
WBASE = 0x819000
wide = WIDE.read_bytes()
md = Cs(CS_ARCH_X86, CS_MODE_32)
md.detail = True

rows = list(csv.DictReader((ROOT / "glm-work" / "result" / "beyond-wall-thunk-names.csv").open(encoding="utf-8")))
print("named rows:")
for r in rows:
    if r["api_name"]:
        print(" ", r["thunk_site_rva"], r["descriptor_imm"], r["module"], r["checksum"], r["api_name"], r["note"])

print("\ncapture-less end statuses:")
from collections import Counter

print(Counter(r["note"] for r in rows if not r["api_name"]))

print("\ndirect disasm at unresolved cluster backedge targets:")
for start, n in ((0x85AB66, 16), (0x8589CF, 14), (0x8578E5, 14)):
    print(f"--- 0x{start:X}")
    e = start
    for _ in range(n):
        ins = next(md.disasm(wide[e - WBASE : e - WBASE + 16], e, count=1), None)
        if not ins:
            print("   <undecodable>")
            break
        print(f"   0x{e:X}: {ins.mnemonic} {ins.op_str}")
        if ins.mnemonic in ("ret",):
            break
        if ins.mnemonic == "jmp" and ins.operands[0].type == 2:
            e = ins.operands[0].imm & 0xFFFFFFFF
            continue
        e += ins.size
