from pathlib import Path

import pefile
from capstone import Cs, CS_ARCH_X86, CS_MODE_32

ROOT = Path(__file__).resolve().parents[2]
path = next((ROOT / ".work" / "task-001" / "extracted").rglob("PCOM.dll"))
data = path.read_bytes()
pe = pefile.PE(str(path), fast_load=True)
pe.parse_data_directories(directories=[pefile.DIRECTORY_ENTRY["IMAGE_DIRECTORY_ENTRY_EXPORT"]])
BASE = pe.OPTIONAL_HEADER.ImageBase
md = Cs(CS_ARCH_X86, CS_MODE_32)
md.detail = True


def to_off(rva):
    for s in pe.sections:
        if s.VirtualAddress <= rva < s.VirtualAddress + max(s.SizeOfRawData, s.Misc_VirtualSize):
            return s.PointerToRawData + (rva - s.VirtualAddress)
    return None


for sym in pe.DIRECTORY_ENTRY_EXPORT.symbols:
    if sym.name and sym.name.startswith(b"PcSerializeString"):
        print(f"export {sym.name.decode()} @ RVA {sym.address:#x}")

off = to_off(0x6411)
addr = BASE + 0x6411
print("== PcSerializeString body ==")
n = 0
while n < 80:
    insn = list(md.disasm(data[off : off + 12], addr, count=1))
    if not insn:
        off += 1
        addr += 1
        continue
    i = insn[0]
    note = ""
    if i.mnemonic in ("jmp", "call") and i.op_str.startswith("0x"):
        note = f"   ; sub_{int(i.op_str, 0) - BASE:x}"
    print(f"{i.address:#010x} {i.mnemonic:<8} {i.op_str}{note}")
    off += i.size
    addr = i.address + i.size
    n += 1
    if i.mnemonic == "ret" and n > 6:
        break
