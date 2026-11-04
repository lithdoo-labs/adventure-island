"""Check the wrapper magic slot and the 3 successful thunk sites."""
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

def rd(rva: int, n: int = 4) -> bytes:
    return wide[rva - WBASE : rva - WBASE + n]

print("slot 0x861490 (wrapper magic check [edi+0x2c]):", rd(0x861490).hex(" "),
      "->", hex(int.from_bytes(rd(0x861490), "little")))
print("slot 0x861464 area:", rd(0x861460, 0x40).hex(" "))

print("\nwrapper check path:")
e = 0x821750
for i in range(26):
    ins = next(md.disasm(wide[e - WBASE : e - WBASE + 16], e, count=1), None)
    if not ins:
        break
    print(f"  0x{e:X}: {ins.mnemonic} {ins.op_str}")
    if ins.mnemonic in ("ret",):
        break
    if ins.mnemonic == "jmp":
        tgt = ins.operands[0].imm
        e = tgt
        continue
    e += ins.size

print("\nnamed thunks from CSV:")
rows = list(csv.DictReader((ROOT / "glm-work" / "result" / "beyond-wall-thunk-names.csv").open(encoding="utf-8")))
for r in rows:
    if r["api_name"]:
        print(" ", r["thunk_site_rva"], r["descriptor_imm"], r["api_name"], r["note"])

# where do the successful sites differ: dump their descriptor cursors
print("\ndescriptor cursor check (base 0xF97D9014):")
for r in rows[:8]:
    imm = int(r["descriptor_imm"], 16)
    cur = (0xF97D9014 + imm) & 0xFFFFFFFF
    rva = cur - 0x400000
    ok = 0x819000 <= rva < 0x912000
    data = rd(rva, 12) if ok else b""
    print(f"  site {r['thunk_site_rva']} imm 0x{imm:08X} -> cursor VA 0x{cur:08X} (RVA 0x{rva:X}) in_tailb={ok} bytes={data.hex(' ') if ok else '-'}")
