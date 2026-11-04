from pathlib import Path

import pefile
from capstone import Cs, CS_ARCH_X86, CS_MODE_32

ROOT = Path(__file__).resolve().parents[2]
path = next((ROOT / ".work" / "task-001" / "extracted").rglob("NameSpace.dll"))
data = path.read_bytes()
pe = pefile.PE(str(path), fast_load=True)
BASE = pe.OPTIONAL_HEADER.ImageBase
md = Cs(CS_ARCH_X86, CS_MODE_32)
md.detail = True


def to_off(rva):
    for s in pe.sections:
        if s.VirtualAddress <= rva < s.VirtualAddress + max(s.SizeOfRawData, s.Misc_VirtualSize):
            return s.PointerToRawData + (rva - s.VirtualAddress)
    return None


print("== 0x137FF - 0x138F0: the record decode loop ==")
off = to_off(0x137FF)
addr = BASE + 0x137FF
n = 0
while addr < BASE + 0x138F0 and n < 100:
    insn = list(md.disasm(data[off : off + 12], addr, count=1))
    if not insn:
        off += 1
        addr += 1
        continue
    i = insn[0]
    print(f"{i.address:#010x} {i.mnemonic:<8} {i.op_str}")
    off += i.size
    addr = i.address + i.size
    n += 1
