import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import maple079_resolver_dict as rd  # noqa: E402
from unicorn import Uc, UC_ARCH_X86, UC_MODE_32, UC_HOOK_CODE, UC_HOOK_MEM_WRITE
from unicorn.x86_const import UC_X86_REG_ESP, UC_X86_REG_EBP, UC_X86_REG_EIP

image = rd.build_image()
EXPECT = 0xBC793BBC
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
writes: list[tuple[int, int, int]] = []  # (eip, addr, value)
state = {"insns": 0, "hit": None}


def on_write(uc_, access, address, size, value, user):
    if size == 4:
        eip = uc_.reg_read(UC_X86_REG_EIP)
        writes.append((eip, address, value))
        if value == EXPECT and state["hit"] is None:
            state["hit"] = (eip, address)
            print(f"EXPECT WRITE by eip {eip:#x} (rva {eip-0x400000:#x}) -> addr {address:#x} (rva {address-0x400000:#x})")


def on_code(uc_, address, size, user):
    state["insns"] += 1
    if state["insns"] > 600_000:
        uc_.emu_stop()


uc.hook_add(UC_HOOK_MEM_WRITE, on_write)
uc.hook_add(UC_HOOK_CODE, on_code)
try:
    uc.emu_start(rd.WRAP, RET_VA, count=600_000)
except Exception as exc:
    print("exception:", exc)
print("insns:", state["insns"], "expect-hit:", state["hit"])
print("last 12 dword writes:")
for eip, addr, val in writes[-12:]:
    print(f"  eip rva {eip-0x400000:#x} -> {addr:#x} (rva {addr-0x400000:#x}) = {val:#010x}")
