"""Task 012c follow-up 5: verify the tpuaozxc jmps, dump thunk-table bytes."""
from __future__ import annotations

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

print("=== tpuaozxc-referencing sites")
for site in (0x88250A, 0x883656):
    off = site - WBASE - 0x20
    for ins in md.disasm(wide[off : off + 0x60], site - 0x20):
        mark = " <<<" if abs(ins.address - site) < 8 else ""
        print(f"  0x{ins.address:X}: {ins.mnemonic} {ins.op_str}{mark}")
    print()

print("=== targets inside tpuaozxc")
for tgt in (0x98D0C8, 0x971F5D):
    off = tgt - WBASE
    if 0 <= off < len(wide):
        print(f"  0x{tgt:X} (inside Tail B wide? offset {off:#x}) bytes: {wide[off:off+16].hex(' ')}")
    else:
        print(f"  0x{tgt:X}: beyond wide capture (tpuaozxc proper)")

print("=== thunk table dumps")
for base in (0x8E1600, 0x8F4700):
    off = base - WBASE
    data = wide[off : off + 0x60]
    print(f"--- 0x{base:X}: {data.hex(' ')}")
    e = base
    for i in range(6):
        ins = next(md.disasm(wide[e - WBASE : e - WBASE + 12], e, count=1), None)
        if ins:
            print(f"   0x{e:X}: {ins.mnemonic} {ins.op_str}")
            e += ins.size
        else:
            break

print("=== wrapper head (readable region, for entry convention)")
e = 0x821750
for i in range(14):
    ins = next(md.disasm(wide[e - WBASE : e - WBASE + 16], e, count=1), None)
    if not ins:
        break
    print(f"  0x{e:X}: {ins.mnemonic} {ins.op_str}")
    if ins.mnemonic in ("ret", "jmp") and i > 4:
        break
    e += ins.size
