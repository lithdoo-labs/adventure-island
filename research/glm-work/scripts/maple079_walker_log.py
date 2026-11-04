"""Third replay run: log every walker invocation (entry 0x0081CEC7) with its
EDX (expected name checksum) and module base, so every pre-probe resolver
call can be named against the ground-truth checksum tables.

Reuses scripts/maple079_stage2_continue.py unmodified (read-only import).
Intercepts Uc.hook_add so our extra UC_HOOK_CODE logger rides along.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

import maple079_stage2_continue as rep  # noqa: E402
from unicorn import Uc, UC_HOOK_CODE  # noqa: E402
from unicorn.x86_const import UC_X86_REG_EDX, UC_X86_REG_EBP, UC_X86_REG_ESI, UC_X86_REG_ESP  # noqa: E402

IMAGE = 0x400000
WALKER_VA = IMAGE + 0x81CEC7
OUT = ROOT / "glm-work" / "scratch" / "walker-invocations.json"

log: list[dict] = []


def my_code_hook(uc, address, size, user):
    if address == WALKER_VA:
        esp = uc.reg_read(UC_X86_REG_ESP)
        def dword(va):
            try:
                return int.from_bytes(uc.mem_read(va, 4), "little")
            except Exception:
                return None
        log.append(
            {
                "edx": uc.reg_read(UC_X86_REG_EDX),
                "ret": dword(esp),
                "module_base": dword(esp + 4),
                "imm": dword(esp + 8),
            }
        )
        if len(log) > 400:
            uc.emu_stop()


def main() -> int:
    exe = next((ROOT / ".work" / "task-001" / "extracted").rglob("MapleStory.exe"))
    kernel32 = Path(r"C:\Windows\SysWOW64\kernel32.dll")
    block = ROOT / ".work" / "task-006" / "tail-b-nonzero.bin"

    orig_hook_add = Uc.hook_add

    def patched_hook_add(self, htype, callback=None, *args, **kwargs):
        if htype == UC_HOOK_CODE:
            try:
                orig_hook_add(self, htype, my_code_hook, *args, **kwargs)
            except Exception:
                pass
        return orig_hook_add(self, htype, callback, *args, **kwargs)

    Uc.hook_add = patched_hook_add
    sys.argv = [
        "maple079_stage2_continue.py",
        "--exe", str(exe),
        "--kernel32", str(kernel32),
        "--block", str(block),
    ]
    print("running replay with walker-entry logger...")
    code = rep.main()
    Uc.hook_add = orig_hook_add

    OUT.write_text(json.dumps(log, indent=2), encoding="utf-8")
    print(f"walker invocations: {len(log)} -> {OUT}")
    for item in log:
        print(" ", {k: (hex(v) if isinstance(v, int) else v) for k, v in item.items()})
    return code


if __name__ == "__main__":
    sys.exit(main())
