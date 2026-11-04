"""Task 012b parts 3+4: flag-slot writers in the DECODED driver-stage buffer,
and the LE/VxD header parse of the embedded image at 0x0085B405.
"""
from __future__ import annotations

import struct
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE / "scripts"))
import maple079_probe_cfg as probe  # noqa: E402
import maple079_post_probe_scan as t12  # noqa: E402

ROOT = HERE.parent
raw = probe.WINDOW.read_bytes()
dec = bytearray(raw)
t12.decode(dec)
dec = bytes(dec)

probe.blob = dec
probe.END = probe.BASE + len(dec)
probe.STRINGS = probe.strings()

# --- (3) flag-slot writers in the decoded buffer --------------------------
DISPS = {0x7442AA1: 0x81BAB5, 0x74401DD: 0x8191F1}
MODRM = {0x85: "eax", 0x8D: "ecx", 0x95: "edx", 0x9D: "ebx", 0xA5: "esp", 0xAD: "ebp", 0xB5: "esi", 0xBD: "edi"}
print("== flag-slot writers in DECODED buffer ==")
hits = 0
for i in range(len(dec) - 10):
    if dec[i] in (0x89, 0xC7) and dec[i + 1] in MODRM:
        disp = int.from_bytes(dec[i + 2 : i + 6], "little")
        if disp in DISPS:
            slot = DISPS[disp]
            tail = dec[i + 6 : i + 8].hex() if dec[i] == 0x89 else dec[i + 6 : i + 10].hex()
            print(f"  {probe.BASE + i:#x}: {'mov' if dec[i]==0x89 else 'mov imm'} [slot {slot:#x}], {MODRM[dec[i+1]]} tail {tail}")
            hits += 1
print(f"  total {hits}")

# also: cmp/read references to the flags in the decoded region (context)
print("== flag-slot references (any ebp-mem opcode) in decoded buffer, 0x85EBD5+ ==")
count = 0
for i in range(0x85EBD5 - probe.BASE, len(dec) - 6):
    if dec[i] in (0x83, 0x3B, 0x39, 0x8B) and dec[i + 1] in (0xBD, 0xB5, 0x95, 0x8D):
        disp = int.from_bytes(dec[i + 2 : i + 6], "little")
        if disp in DISPS:
            count += 1
            if count <= 8:
                print(f"  {probe.BASE + i:#x} opcode {dec[i]:02x}{dec[i+1]:02x} slot {DISPS[disp]:#x}")
print(f"  total references >= {count}")

# --- (4) LE/VxD header parse ----------------------------------------------
print("\n== embedded LE/VxD image @0x85B405 ==")
off = 0x85B405 - probe.BASE
mz = dec[off : off + 0x40]
assert mz[:2] == b"MZ"
e_lfanew = struct.unpack("<I", mz[0x3C:0x40])[0]
print(f"  MZ ok, e_lfanew {e_lfanew:#x}")
le = dec[off + e_lfanew : off + e_lfanew + 0xA0]
assert le[:2] == b"LE", le[:2].hex()
fields = struct.unpack("<HHHHIIIIIIIIIIIIIIIIIIIIIIIIII", le[2 : 2 + 4 * 28])
names = (
    "byte_order", "word_order", "format_level", "cpu_type", "os_type", "module_version",
    "module_flags", "module_num_pages", "eip_object", "eip", "esp_object", "esp",
    "page_size", "last_page_size", "fixup_size", "fixup_checksum", "loader_size",
    "loader_checksum", "obj_table_off", "obj_tab_entries", "obj_pages", "obj_shift",
    "opentab_off", "opentab_entries", "restab_off", "restab_entries",
)
for n, v in zip(names, fields):
    print(f"  {n:>16}: {v:#x}")
# VxD DDB usually sits right after the LE header (aligned); scan for the device name
rest = dec[off + e_lfanew : off + e_lfanew + 0x400]
pos = rest.find(b"XPROTVXD")
print(f"  'XPROTVXD' at +{pos:#x}" if pos >= 0 else "  'XPROTVXD' not found near LE header")
# object table
ot = struct.unpack_from("<IIII", le, 0x74 - 2) if len(le) >= 0x80 else None
obj_off = fields[18]
obj_n = fields[19]
print(f"  object table at LE+{obj_off:#x}, {obj_n} objects")
for idx in range(min(obj_n, 6)):
    base = off + e_lfanew + obj_off + idx * 24
    o_size, o_base_, o_flags1, o_pagemap, o_pagemap_hi = struct.unpack_from("<IIIBBH", dec, base)
    print(f"    obj{idx}: size {o_size:#x} base {o_base_:#x} flags1 {o_flags1:#010x} pagemap {o_pagemap}+{o_pagemap_hi}")
