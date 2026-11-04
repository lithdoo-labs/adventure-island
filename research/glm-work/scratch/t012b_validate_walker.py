"""Validate the reimplemented name-checksum by running the REAL walker
(0x0081CEC7) against the real kernel32.dll image with a candidate EDX.

Success: EAX == 0x7625D430 (GetLocalTime) for checksum("GetLocalTime").
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import maple079_resolver_dict as rd  # noqa: E402

import pefile
from unicorn import Uc, UC_ARCH_X86, UC_MODE_32
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_EBP, UC_X86_REG_ESI, UC_X86_REG_ESP

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
uc.mem_write(K32_BASE, kbytes[: 0x1000])
for sec in pe.sections:
    raw = kbytes[sec.PointerToRawData : sec.PointerToRawData + sec.SizeOfRawData]
    if raw:
        uc.mem_write(K32_BASE + sec.VirtualAddress, raw)
uc.mem_map(0x4FF00000, 0x1000)          # sentinel page
uc.mem_map(rd.STACK - 0x10000, 0x20000)


def run(cs: int, gate: bytes = b"\x00"):
    uc.mem_write(rd.MEM_BASE + rd.IMG_OFF + (0x81A361 - 0x819000), gate)
    # stack: [esp]=sentinel(ret), [esp+4]=module base, [esp+8]=imm/checksum
    uc.mem_write(rd.STACK - 12, SENTINEL.to_bytes(4, "little"))
    uc.mem_write(rd.STACK - 8, K32_BASE.to_bytes(4, "little"))
    uc.mem_write(rd.STACK - 4, cs.to_bytes(4, "little"))
    uc.reg_write(UC_X86_REG_ESP, rd.STACK - 12)
    uc.reg_write(UC_X86_REG_EBP, rd.FRAME)
    uc.reg_write(UC_X86_REG_ESI, 0)
    uc.reg_write(UC_X86_REG_EAX, 0)
    try:
        uc.emu_start(WALKER, SENTINEL, count=2_000_000)
    except Exception as exc:
        return {"error": str(exc), "eax": uc.reg_read(UC_X86_REG_EAX)}
    return {"eax": uc.reg_read(UC_X86_REG_EAX)}


for name, expect in (("GetLocalTime", 0x7625D430), ("LoadLibraryA", 0x76271F70)):
    cs = rd.probe_checksum(name)
    res = run(cs)
    print(f"{name}: checksum {cs:#010x} -> walker EAX {res.get('eax'):#010x} expect {expect:#010x}",
          "OK" if res.get("eax") == expect else "MISMATCH", res.get("error", ""))
