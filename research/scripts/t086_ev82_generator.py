#!/usr/bin/env python3
"""T086 WP1 final EV generator — consolidated node-class/insert/comparator
chain evidence for G24/G01/G07 (Gr2D, sha-pinned).
"""
import hashlib
from pathlib import Path

import pefile
from capstone import Cs, CS_ARCH_X86, CS_MODE_32

REPO = Path(__file__).resolve().parents[2]
DLL = REPO / ".work/task-001/extracted/冒险岛online/Gr2D_DX8.dll"
SHA = "ad67b9a08a0a360e9a31f0274d29b8cb9839d95d691762961454c806ef6a25d1"
IMG = 0x50400000
OUT = REPO / "research/result/stage-readiness/forensics/T086-EV82-NODE-CLASS-INSERT-COMPARATOR.txt"

pe = pefile.PE(str(DLL), fast_load=True)
data = DLL.read_bytes()
assert hashlib.sha256(data).hexdigest() == SHA
md = Cs(CS_ARCH_X86, CS_MODE_32)


def off(va):
    rva = va - IMG
    for s in pe.sections:
        if s.VirtualAddress <= rva < s.VirtualAddress + max(s.Misc_VirtualSize, s.SizeOfRawData):
            return s.PointerToRawData + (rva - s.VirtualAddress)
    raise ValueError(hex(va))


L = [f"# T086 EV-82 — Gr2D node class + keyed insert + comparator (static)", f"# dll sha256 {SHA}", ""]


def dis(va, size, title):
    L.append(f"\n===== {title} ({va:#x} +{size:#x}) =====")
    for i in md.disasm(data[off(va):off(va) + size], va):
        L.append(f"{i.address:08X}  {i.bytes.hex():<22} {i.mnemonic} {i.op_str}")


# 1. slot25 out-object acquisition (slot reuse + acquire+QI + helper call)
dis(0x504041A0, 0xA5, "slot25 0x5040418C head: guards + VARIANT coerce + [ebp+8] slot reuse -> 0x50405846 -> helper 0x50409922")
# 2. acquire+QI
dis(0x50405846, 0x55, "0x50405846 acquire punk (0x50406233) + QI 6DC8C7CE (0x504062AA)")
dis(0x50406233, 0x60, "0x50406233 punk source: [0x5043A198] -> 0x504074CF -> ctor 0x504067D7")
# 3. the REAL ctor installing the vtable stack
dis(0x504067D7, 0x35, "NODE CTOR 0x504067D7: vtables +0:0x5042E3F0 +4:0x5042E3EC +8:0x5042E3E8 +0xC:0x5042E3D0")
# 4. QI thunk + intmap
dis(0x50406AB4, 0x18, "QI thunk slot0 (pushes intmap 0x5042E520 -> ATL IQI 0x50401945)")
L.append("\nintmap 0x5042E520 entries (piid, dw, cnt):")
for va in range(0x5042E520, 0x5042E55C, 12):
    a = int.from_bytes(data[off(va):off(va) + 4], "little")
    b = int.from_bytes(data[off(va) + 4:off(va) + 8], "little")
    c = int.from_bytes(data[off(va) + 8:off(va) + 12], "little")
    L.append(f"  {va:#x}: {{piid={a:#x}, dw={b:#x}, cnt={c:#x}}}")
iid = data[off(0x50436540):off(0x50436540) + 16]
L.append(f"IID @0x50436540 = {iid.hex(' ')}  (6DC8C7CE-8E81-4420-B4F6-4B60B7D5FCDF byte order)")
# 5. out write
dis(0x504045A0, 0x40, "slot25 success epilogue: *arg15 = [ebp+8] (created object) at 0x504045CB")
# 6. slot45 + insert + comparator
dis(0x50409ECD, 0x28, "slot45 (+0xB4) = 0x50409ECD: forwards (key, &node[0xC], node[0xF8]) to [node+0x2C]")
dis(0x50409EF4, 0x120, "container insert 0x50409EF4: setkey/settag + search 0x5040390D + comparator walk")
dis(0x50403A42, 0x85, "COMPARATOR 0x50403A42 (free fn): slot4-chain climb + slot0-key compare + tie-break")
dis(0x5040390D, 0x50, "tree search 0x5040390D (parent/child navigation, +0x10 bias)")
# 7. payload vtable 0x5042E3D0 six methods
for slot, body in [(0, 0x50406946), (1, 0x5040694A), (2, 0x50406954), (3, 0x50406966), (4, 0x50406974), (5, 0x5040697B)]:
    dis(body, 0x14, f"payload table 0x5042E3D0 slot{slot} = {body:#x}")

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text("\n".join(L) + "\n", encoding="utf-8")
print("wrote", OUT)
