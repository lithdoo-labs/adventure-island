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


off = to_off(0x13770)
addr = BASE + 0x13770
while addr < BASE + 0x13800:
    insn = list(md.disasm(data[off : off + 12], addr, count=1))
    if not insn:
        off += 1
        addr += 1
        continue
    i = insn[0]
    note = ""
    for op in i.operands:
        if op.type == 2 and 0x50817000 <= op.imm < 0x50819000:
            ro = to_off(op.imm - BASE)
            if ro is not None:
                s = data[ro : ro + 40].split(b"\x00")[0]
                if len(s) >= 3 and all(32 <= b < 127 for b in s):
                    note = f'   ; "{s.decode("latin1")[:36]}"'
    mark = "   <== PKG1" if BASE + 0x137B8 <= i.address <= BASE + 0x137C0 else ""
    print(f"{i.address:#010x} {i.mnemonic:<8} {i.op_str}{note}{mark}")
    off += i.size
    addr = i.address + i.size
