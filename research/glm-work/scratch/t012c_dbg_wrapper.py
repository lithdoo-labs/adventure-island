"""Debug the wrapper emulation fault for the training thunks."""
from __future__ import annotations

import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "scripts"))
import maple079_probe_cfg as probe  # noqa: E402

import pefile
from unicorn import Uc, UC_ARCH_X86, UC_MODE_32, UC_HOOK_CODE
from unicorn.x86_const import (
    UC_X86_REG_EAX,
    UC_X86_REG_EBP,
    UC_X86_REG_EDI,
    UC_X86_REG_EDX,
    UC_X86_REG_ESI,
    UC_X86_REG_ESP,
)

ROOT = HERE.parents[1]
WIDE = ROOT / "glm-work" / "scratch" / "tailb-wide-at-probe.bin"
IMAGE_BASE = 0x400000
WBASE_VA = IMAGE_BASE + 0x819000
WRAPPER_VA = IMAGE_BASE + 0x821750
SENTINEL = 0x50000000
STACK_BASE = 0x4FF00000
STACK_SIZE = 0x2000

MODULES = {
    "kernel32": (0x76240000, r"C:\Windows\SysWOW64\kernel32.dll"),
    "advapi32": (0x767F0000, r"C:\Windows\SysWOW64\advapi32.dll"),
    "user32": (0x76980000, r"C:\Windows\SysWOW64\user32.dll"),
    "ntdll": (0x77080000, r"C:\Windows\SysWOW64\ntdll.dll"),
}

wide = WIDE.read_bytes()
uc = Uc(UC_ARCH_X86, UC_MODE_32)
uc.mem_map(WBASE_VA, (len(wide) + 0xFFF) & ~0xFFF)
uc.mem_write(WBASE_VA, wide)
uc.mem_map(STACK_BASE, STACK_SIZE)
uc.mem_map(0xF0000, 0x20000)
for _name, (base, path) in MODULES.items():
    data = Path(path).read_bytes()
    pe = pefile.PE(data=data, fast_load=True)
    size = (int(pe.OPTIONAL_HEADER.SizeOfImage) + 0xFFF) & ~0xFFF
    uc.mem_map(base, size)
    uc.mem_write(base, data[:0x1000])
    for sec in pe.sections:
        raw = data[sec.PointerToRawData : sec.PointerToRawData + sec.SizeOfRawData]
        if raw:
            uc.mem_write(base + sec.VirtualAddress, raw)

# the failing training thunks
CASES = [
    (0x857E4A, 122154870),
    (0x857E7C, 122156862),
    # one working beyond-wall case for comparison? these were readable-named:
    # (first CSV readable rows) - re-derive from CSV is skipped; use faulting ones.
]

for site, imm in CASES:
    print(f"=== thunk 0x{site:X} imm 0x{imm:X} (0x{imm:08X})")
    uc.mem_write(WBASE_VA, wide)
    uc.mem_write(STACK_BASE + STACK_SIZE - 0xC, imm.to_bytes(4, "little"))
    uc.mem_write(STACK_BASE + STACK_SIZE - 0x8, SENTINEL.to_bytes(4, "little"))
    uc.reg_write(UC_X86_REG_ESP, STACK_BASE + STACK_SIZE - 0xC)
    uc.reg_write(UC_X86_REG_EBP, 0xF97D9014)
    for r in (UC_X86_REG_EAX, UC_X86_REG_EDI, UC_X86_REG_ESI, UC_X86_REG_EDX):
        uc.reg_write(r, 0)

    trace: list[int] = []
    last_mem = {}

    def on_code(uc_, address, size, user):
        trace.append(address)
        if len(trace) > 4000:
            uc_.emu_stop()

    def on_mem(uc_, access, address, size, value, user):
        last_mem[(address, access)] = value if access != 16 else uc_.reg_read(UC_X86_REG_EAX)

    hc = uc.hook_add(UC_HOOK_CODE, on_code)
    try:
        uc.emu_start(WRAPPER_VA, SENTINEL, count=500_000)
        print("  clean stop, eax =", hex(uc.reg_read(UC_X86_REG_EAX)))
    except Exception as exc:
        print("  fault:", exc)
        eip = uc.reg_read(UC_X86_REG_EIP) if hasattr(uc, "reg_read") else None
        try:
            from unicorn.x86_const import UC_X86_REG_EIP

            eip = uc.reg_read(UC_X86_REG_EIP)
        except Exception:
            pass
        print("  eip:", hex(eip) if eip else "?")
    print("  trace tail:", [hex(a) for a in trace[-25:]])
    uc.hook_del(hc)
