import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import maple079_resolver_dict as rd  # noqa: E402

import pefile
from unicorn import Uc, UC_ARCH_X86, UC_MODE_32, UC_HOOK_CODE, UC_HOOK_MEM_INVALID
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_EBP, UC_X86_REG_ESI, UC_X86_REG_ESP, UC_X86_REG_EIP

ROOT = Path(__file__).resolve().parents[2]
K32 = Path(r"C:\Windows\SysWOW64\kernel32.dll")
K32_BASE = 0x76240000
WALKER = 0x400000 + 0x81CEC7
SENTINEL = 0x50000000

image = rd.build_image()
pe = pefile.PE(str(K32), fast_load=True)
ksize = (int(pe.OPTIONAL_HEADER.SizeOfImage) + 0xFFF) & ~0xFFF
kbytes = K32.read_bytes()

uc = Uc(UC_ARCH_X86, UC_MODE_32)
uc.mem_map(rd.MEM_BASE, rd.MEM_LEN)
uc.mem_write(rd.MEM_BASE + rd.IMG_OFF, image)
uc.mem_map(K32_BASE, ksize)
uc.mem_write(K32_BASE, kbytes[:0x1000])
for sec in pe.sections:
    raw = kbytes[sec.PointerToRawData : sec.PointerToRawData + sec.SizeOfRawData]
    if raw:
        uc.mem_write(K32_BASE + sec.VirtualAddress, raw)
uc.mem_map(0x4FF00000, 0x1000)
uc.mem_map(rd.STACK - 0x10000, 0x20000)

cs = rd.probe_checksum("GetLocalTime")
uc.mem_write(rd.STACK - 12, SENTINEL.to_bytes(4, "little"))
uc.mem_write(rd.STACK - 8, K32_BASE.to_bytes(4, "little"))
uc.mem_write(rd.STACK - 4, cs.to_bytes(4, "little"))
uc.reg_write(UC_X86_REG_ESP, rd.STACK - 12)
uc.reg_write(UC_X86_REG_EBP, rd.FRAME)

state = {"insns": 0, "trail": []}

def on_code(uc_, address, size, user):
    state["insns"] += 1
    state["trail"].append(address)
    if len(state["trail"]) > 30:
        state["trail"].pop(0)
    if state["insns"] > 3_000_000:
        uc_.emu_stop()

def on_invalid(uc_, access, address, size, value, user):
    print(f"INVALID access={access} addr={address:#x} eip={uc_.reg_read(UC_X86_REG_EIP):#x}")
    return False

uc.hook_add(UC_HOOK_CODE, on_code)
uc.hook_add(UC_HOOK_MEM_INVALID, on_invalid)
try:
    uc.emu_start(WALKER, SENTINEL, count=3_000_000)
except Exception as exc:
    print("exception:", exc)
print("insns:", state["insns"], "eax:", hex(uc.reg_read(UC_X86_REG_EAX)), "esi:", hex(uc.reg_read(UC_X86_REG_ESI)))
print("trail:", [hex(a) for a in state["trail"][-20:]])
