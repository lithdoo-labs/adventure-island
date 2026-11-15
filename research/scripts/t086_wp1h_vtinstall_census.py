#!/usr/bin/env python3
"""T086 WP1h — vtable-install census for the RawCanvas-family table block
(0x5042E2B0..0x5042E380): every `mov dword ptr [reg], imm32` /
`mov dword ptr [reg+disp], imm32` installing one of these addresses names
the REAL vtable start(s) of the 6DC8C7CE class, independent of the G22
max-run ambiguity.
"""
import hashlib
import re
import struct
from pathlib import Path

import pefile
from capstone import Cs, CS_ARCH_X86, CS_MODE_32

REPO = Path(__file__).resolve().parents[2]
DLL = REPO / ".work/task-001/extracted/冒险岛online/Gr2D_DX8.dll"
SHA = "ad67b9a08a0a360e9a31f0274d29b8cb9839d95d691762961454c806ef6a25d1"
IMG = 0x50400000
LO, HI = 0x5042E2B0, 0x5042E380

pe = pefile.PE(str(DLL), fast_load=True)
data = DLL.read_bytes()
assert hashlib.sha256(data).hexdigest() == SHA
md = Cs(CS_ARCH_X86, CS_MODE_32)

text = None
for s in pe.sections:
    if s.Name.startswith(b".text"):
        text = s
code_start = IMG + text.VirtualAddress
code = data[text.PointerToRawData:text.PointerToRawData + text.SizeOfRawData]

# decode linearly is unreliable; instead scan for C7 opcodes with imm32 in range
hits = []
for m in re.finditer(b"\xc7", code):
    o = m.start()
    # modrm follows; we accept forms 00xxx and 01xxx and 10xxx with [reg] or [reg+disp]
    for modrm_off in range(o + 1, min(o + 8, len(code))):
        modrm = code[modrm_off]
        if (modrm >> 3) & 7 != 0:
            continue
        mod = modrm >> 6
        rm = modrm & 7
        try:
            if mod == 0 and rm != 4:
                imm_at = modrm_off + 1
            elif mod == 1:
                imm_at = modrm_off + 2
            elif mod == 2:
                imm_at = modrm_off + 5
            else:
                continue
            if imm_at + 4 > len(code):
                continue
            imm = struct.unpack("<I", code[imm_at:imm_at + 4])[0]
            if LO <= imm < HI:
                # confirm the C7 is the opcode (preceding byte not part of another insn is unknowable statically;
                # we report all candidates and disassemble a window for context)
                hits.append((code_start + o, imm, code[o:o + 12].hex()))
        except Exception:
            pass

seen = {}
for va, imm, b in hits:
    key = (va, imm)
    if key in seen:
        continue
    seen[key] = 1
    print(f"candidate C7 @ {va:#x}: imm {imm:#x} bytes {b}")

# disassemble context for each unique VA (dedupe nearby)
uniq = sorted(set(va for va, _, _ in hits))
print(f"\ntotal unique candidate VAs: {len(uniq)}")
