from pathlib import Path

import pefile

ROOT = Path(__file__).resolve().parents[2]
path = next((ROOT / ".work" / "task-001" / "extracted").rglob("NameSpace.dll"))
data = path.read_bytes()
pe = pefile.PE(str(path), fast_load=True)
BASE = pe.OPTIONAL_HEADER.ImageBase


def to_off(rva):
    for s in pe.sections:
        if s.VirtualAddress <= rva < s.VirtualAddress + max(s.SizeOfRawData, s.Misc_VirtualSize):
            return s.PointerToRawData + (rva - s.VirtualAddress)
    return None


def cstr(rva):
    off = to_off(rva)
    out = bytearray()
    while off < len(data) and data[off] and len(out) < 80:
        out.append(data[off])
        off += 1
    return out.decode("latin1")


print("DLL name  @0x1E4EC:", repr(cstr(0x1E4EC)))
for rva, glob in ((0x1E4F8, "0x1EC38"), (0x1E508, "0x1EC34"), (0x1E51C, "0x1EC30"),
                  (0x1E530, "0x1EC2C"), (0x1E548, "0x1EC28")):
    print(f"proc @{rva:#x} -> global {glob}: {cstr(rva)!r}")

# also dump the 16-byte master key blob at 0x1EC10
off = to_off(0x1EC10)
print("16-byte key blob @0x1EC10:", data[off : off + 16].hex())
# and 0x1EC10 surroundings for context
print("surroundings:", data[off - 16 : off + 32].hex())
