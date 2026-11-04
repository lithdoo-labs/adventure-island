import sys
from pathlib import Path

import pefile
from capstone import Cs, CS_ARCH_X86, CS_MODE_32

ROOT = Path(__file__).resolve().parents[2]
CLIENT = ROOT / ".work" / "task-001" / "extracted"
md = Cs(CS_ARCH_X86, CS_MODE_32)
md.detail = True


def load(name):
    path = next(CLIENT.rglob(name))
    data = path.read_bytes()
    pe = pefile.PE(str(path), fast_load=True)
    pe.parse_data_directories(directories=[
        pefile.DIRECTORY_ENTRY["IMAGE_DIRECTORY_ENTRY_IMPORT"],
    ])
    return path, data, pe


def to_off(pe, rva):
    for s in pe.sections:
        if s.VirtualAddress <= rva < s.VirtualAddress + max(s.SizeOfRawData, s.Misc_VirtualSize):
            return s.PointerToRawData + (rva - s.VirtualAddress)
    return None


def cstr(data, pe, rva):
    off = to_off(pe, rva)
    out = bytearray()
    while off < len(data) and data[off] and len(out) < 64:
        out.append(data[off])
        off += 1
    return out.decode("latin1")


_p, data, pe = load("PCOM.dll")
print("PCOM strings near List.wz:")
for rva in (0x174b0, 0x174b8, 0x174bc):
    s = cstr(data, pe, rva).encode("unicode_escape").decode("ascii")
    print(f"  {rva:#x}: {s}")

print("\nPCOM imports containing thunks 0x50c13070 / 0x50c1301c:")
thunks = {0x50C13070: "?", 0x50C1301C: "?"}
if hasattr(pe, "DIRECTORY_ENTRY_IMPORT"):
    for e in pe.DIRECTORY_ENTRY_IMPORT:
        for imp in e.imports:
            va = 0x50C00000 + imp.address - pe.OPTIONAL_HEADER.ImageBase if False else None
            # imp.address is an RVA of the IAT slot
            slot_va = pe.OPTIONAL_HEADER.ImageBase + imp.address
            if slot_va in thunks:
                thunks[slot_va] = f"{e.dll.decode()}!{imp.name.decode() if imp.name else imp.ordinal}"
for k, v in thunks.items():
    print(f"  {k:#x} -> {v.encode('unicode_escape').decode('ascii') if isinstance(v, str) else v}")

print("\nCanvas.dll: locate exact push of 0x5002d6f4 (List.wz) and disasm around it")
_p, data, pe = load("Canvas.dll")
needle = bytes.fromhex("68") + (0x5002D6F4).to_bytes(4, "little")
pos = data.find(needle)
print("  push site file-off:", hex(pos))
if pos >= 0:
    # rva of push site
    for s in pe.sections:
        if s.PointerToRawData <= pos < s.PointerToRawData + s.SizeOfRawData:
            rva = s.VirtualAddress + (pos - s.PointerToRawData)
            break
    print("  push site rva:", hex(rva))
    start_off = pos - 0x50
    for insn in md.disasm(data[start_off : pos + 0x60], 0x50000000 + rva - 0x50):
        mark = "  <-- push List.wz" if insn.address == 0x50000000 + rva else ""
        print(f"  {insn.address:#010x} {insn.mnemonic:<8} {insn.op_str}{mark}")
        if insn.address > 0x50000000 + rva + 0x50:
            break

print("\nCanvas.dll imports (all):")
if hasattr(pe, "DIRECTORY_ENTRY_IMPORT"):
    for e in pe.DIRECTORY_ENTRY_IMPORT:
        names = [i.name.decode() if i.name else f"ord{i.ordinal}" for i in e.imports]
        print(f"  {e.dll.decode()}: {names[:20]}")