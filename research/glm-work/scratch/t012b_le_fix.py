import struct
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE / "scripts"))
import maple079_probe_cfg as probe  # noqa: E402
import maple079_post_probe_scan as t12  # noqa: E402

dec = bytearray(probe.WINDOW.read_bytes())
t12.decode(dec)
dec = bytes(dec)
off = 0x85B405 - probe.BASE
e_lfanew = struct.unpack_from("<I", dec, off + 0x3C)[0]
le = off + e_lfanew
assert dec[le : le + 2] == b"LE"

# OS/2 LE/LX header layout
(word_order, ) = struct.unpack_from("<H", dec, le + 2)
fmt = struct.unpack_from("<HHII", dec, le + 2)  # byte_order, word_order(overlap)... do it field by field
byte_order, word_order = struct.unpack_from("<HH", dec, le + 2)
format_level, = struct.unpack_from("<I", dec, le + 4)
cpu_type, os_type = struct.unpack_from("<HH", dec, le + 8)
module_version, module_flags, module_pages, eip_obj, eip, esp_obj, esp, page_size, last_page, fixup_size, fixup_sum, loader_size, loader_sum, objtab_off, objtab_n = struct.unpack_from("<15I", dec, le + 12)
objpages, objshift, opentab_off, opentab_n, restab_off, restab_n = struct.unpack_from("<6I", dec, le + 68)
print(f"byte_order {byte_order} word_order {word_order} level {format_level:#x} cpu {cpu_type:#x} os {os_type:#x}")
print(f"module_version {module_version:#x} flags {module_flags:#x} pages {module_pages:#x}")
print(f"eip obj {eip_obj} eip {eip:#x} | esp obj {esp_obj} esp {esp:#x}")
print(f"page_size {page_size:#x} last_page {last_page:#x}")
print(f"objtab @+{objtab_off:#x} x{objtab_n} objpages {objpages:#x} shift {objshift}")
print(f"opentab @+{opentab_off:#x} x{opentab_n} restab @+{restab_off:#x} x{restab_n}")
print(f"total image bytes = pages*page_size(align) + last_page = {(module_pages - 1) * page_size + last_page:#x}" if module_pages else "pages=0")
for idx in range(min(objtab_n, 6)):
    o = struct.unpack_from("<IIIBBH", dec, le + objtab_off + idx * 24)
    print(f"  obj{idx}: size {o[0]:#x} base {o[1]:#x} flags1 {o[2]:#010x} pagemap {o[3]}+{o[4]}")
pos = dec.find(b"XPROTVXD", le, le + 0x400)
print(f"'XPROTVXD' at LE+{pos - le:#x}" if pos >= 0 else "name not near header")
# DDB (Virtual Device Description Block) starts at eip usually; device name inside
print(f"first 32 bytes @LE+0xC0: {dec[le+0xC0:le+0xE0].hex()}")
