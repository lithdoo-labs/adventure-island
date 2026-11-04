import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import maple079_resolver_dict as rd  # noqa: E402
from unicorn import Uc, UC_ARCH_X86, UC_MODE_32, UC_HOOK_CODE, UC_HOOK_MEM_INVALID
from unicorn.x86_const import UC_X86_REG_EBP, UC_X86_REG_ESP, UC_X86_REG_EIP

image = rd.build_image()
imm = 0x0747EF76  # known LoadLibraryA site

uc = Uc(UC_ARCH_X86, UC_MODE_32)
uc.mem_map(rd.MEM_BASE, rd.MEM_LEN)
uc.mem_write(rd.MEM_BASE + rd.IMG_OFF, image)
uc.mem_map(rd.STACK - 0x10000, 0x20000)
uc.mem_write(rd.STACK - 4, imm.to_bytes(4, "little"))
uc.mem_write(rd.STACK - 8, 0xDEADBEEF.to_bytes(4, "little"))
uc.reg_write(UC_X86_REG_ESP, rd.STACK - 4)
uc.reg_write(UC_X86_REG_EBP, rd.FRAME)

trail: list[int] = []
state = {"insns": 0}

def on_code(uc_, address, size, user):
    state["insns"] += 1
    trail.append(address)
    if len(trail) > 40:
        trail.pop(0)
    if state["insns"] > 600_000:
        uc_.emu_stop()

def on_invalid(uc_, access, address, size, value, user):
    print(f"INVALID access={access} addr={address:#x} size={size} eip={uc_.reg_read(UC_X86_REG_EIP):#x}")
    return False

uc.hook_add(UC_HOOK_CODE, on_code)
uc.hook_add(UC_HOOK_MEM_INVALID, on_invalid)
try:
    uc.emu_start(rd.WRAP, rd.WALKER, count=600_000)
    print("returned without exception")
except Exception as exc:
    print("exception:", type(exc).__name__, exc)

print("insns:", state["insns"])
print("eip now:", hex(uc.reg_read(UC_X86_REG_EIP)))
print("trail tail:", [hex(a) for a in trail[-25:]])
