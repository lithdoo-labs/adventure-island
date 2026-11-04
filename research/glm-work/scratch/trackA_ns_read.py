import struct
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


for vt in (0x18AF0, 0x18ACC, 0x18AC8, 0x18AC4, 0x18B2C, 0x18B74):
    off = to_off(vt)
    entries = []
    for k in range(8):
        v = struct.unpack_from("<I", data, off + 4 * k)[0]
        entries.append(v - BASE)
    print(f"vt {vt:#x}: " + " ".join(f"{e:#x}" for e in entries))

# primary vtable +0x18 -> entry index 3
off = to_off(0x18AF0)
read_va = struct.unpack_from("<I", data, off + 0x18)[0]
print(f"\nRead method = {read_va:#x} (RVA {read_va - BASE:#x})")

print("== disasm Read method ==")
addr = read_va
off = to_off(read_va - BASE)
n = 0
while n < 70:
    insn = list(md.disasm(data[off : off + 12], addr, count=1))
    if not insn:
        off += 1
        addr += 1
        continue
    i = insn[0]
    note = ""
    if i.mnemonic == "call" and i.op_str.startswith("0x"):
        note = f"   ; sub_{int(i.op_str, 0) - BASE:x}"
    print(f"{i.address:#010x} {i.mnemonic:<8} {i.op_str}{note}")
    off += i.size
    addr = i.address + i.size
    n += 1
    if i.mnemonic == "ret" and n > 8:
        break
