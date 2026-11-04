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


for lo, hi, label in ((0x0DD44, 0x0DE00, "key-install 0x5080DD44"), (0x0DF90, 0x0E090, "decode-setup 0x5080DF90")):
    print(f"===== {label} =====")
    off = to_off(lo)
    addr = BASE + lo
    while addr < BASE + hi:
        insn = list(md.disasm(data[off : off + 12], addr, count=1))
        if not insn:
            off += 1
            addr += 1
            continue
        i = insn[0]
        note = ""
        if i.mnemonic == "mov" and i.op_str.startswith("dword ptr [e") and "0x5081" in i.op_str:
            note = "   ; vt/data"
        if i.mnemonic == "call" and i.op_str.startswith("0x"):
            note = f"   ; sub_{int(i.op_str, 0) - BASE:x}"
        print(f"{i.address:#010x} {i.mnemonic:<8} {i.op_str}{note}")
        off += i.size
        addr = i.address + i.size
    print()
