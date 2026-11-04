import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import maple079_resolver_dict as rd  # noqa: E402
from unicorn import Uc, UC_ARCH_X86, UC_MODE_32
from unicorn.x86_const import (
    UC_X86_REG_EAX, UC_X86_REG_EBX, UC_X86_REG_ECX, UC_X86_REG_EDX,
    UC_X86_REG_ESI, UC_X86_REG_EDI, UC_X86_REG_EBP, UC_X86_REG_ESP,
)

image = rd.build_image()
EXPECT = 0xBC793BBC  # checksum("LoadLibraryA")
imm = 0x0747EF76

uc = Uc(UC_ARCH_X86, UC_MODE_32)
uc.mem_map(rd.MEM_BASE, rd.MEM_LEN)
uc.mem_write(rd.MEM_BASE + rd.IMG_OFF, image)
uc.mem_map(rd.STACK - 0x10000, 0x20000)
uc.mem_write(rd.STACK - 4, imm.to_bytes(4, "little"))
uc.mem_write(rd.STACK - 8, 0xDEADBEEF.to_bytes(4, "little"))
uc.reg_write(UC_X86_REG_ESP, rd.STACK - 4)
uc.reg_write(UC_X86_REG_EBP, rd.FRAME)

RET_VA = 0x400000 + 0x829219
try:
    uc.emu_start(rd.WRAP, RET_VA, count=600_000)
except Exception as exc:
    print("exception:", exc)
print("stopped, eip =", hex(uc.reg_read(UC_X86_REG_EIP) if False else 0) if False else "see regs")
for name, reg in (("eax", UC_X86_REG_EAX), ("ebx", UC_X86_REG_EBX), ("ecx", UC_X86_REG_ECX),
                  ("edx", UC_X86_REG_EDX), ("esi", UC_X86_REG_ESI), ("edi", UC_X86_REG_EDI),
                  ("ebp", UC_X86_REG_EBP), ("esp", UC_X86_REG_ESP)):
    v = uc.reg_read(reg)
    print(f"  {name} = {v:#010x}{'   <== EXPECT' if v == EXPECT else ''}")
for slot_rva in (0x821494, 0x821478, 0x8214AC, 0x81A81D, 0x81AAA5):
    va = 0x400000 + slot_rva
    cur = int.from_bytes(uc.mem_read(va, 4), "little")
    print(f"  slot {slot_rva:#x} = {cur:#010x}{'   <== EXPECT' if cur == EXPECT else ''}")
# stack residue
print("  stack top:", uc.mem_read(uc.reg_read(UC_X86_REG_ESP), 16).hex())
