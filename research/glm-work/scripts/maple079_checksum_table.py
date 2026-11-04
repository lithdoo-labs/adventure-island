"""Name the protector resolver immediates via the walker itself.

Method (ground truth, no reimplementation): map the probe-stop Tail B state
plus the real system DLL images into Unicorn, enter the REAL walker at
0x0081CEC7 with a never-matching checksum so it enumerates every export
name, and instrument 0x0081D13C (name start) / 0x0081D184 (computed checksum
cmp) to harvest (name -> checksum) pairs. The Task 011/012 resolver
immediates are then looked up directly.

The direct resolver call form is:
    mov byte [slot 0x81A361], <gate char>
    push imm32                      <- the name checksum itself
    push dword [module base slot]   <- e.g. 0x81A621 (kernel32) / 0x81974D
    call dword [slot 0x81C245] | lea eax,[0x81CEC7]; call eax
The helper 0x0081CEC7 does: edx = [esp+0x28] (the imm), esi = [esp+0x24]+0x3C.

No target-process execution, no API fabrication: this runs the protector's
own lookup code offline against real export tables.
"""
from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import maple079_probe_cfg as probe  # noqa: E402

import pefile
from unicorn import Uc, UC_ARCH_X86, UC_MODE_32, UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_EBP, UC_X86_REG_EDI, UC_X86_REG_ESI, UC_X86_REG_ESP

ROOT = HERE.parent.parent
WIDE = ROOT / "glm-work" / "scratch" / "tailb-wide-at-probe.bin"  # rebuild via mapl079_wide_capture.py

WALKER = 0x400000 + 0x81CEC7
SENTINEL = 0x50000000
HOOK_NAME_PUSH = 0x400000 + 0x81D13C
HOOK_CMP = 0x400000 + 0x81D184

MODULES: dict[str, tuple[int, str]] = {
    # bases observed in the real process (result/process-layout-snapshot.csv)
    "kernel32": (0x76240000, r"C:\Windows\SysWOW64\kernel32.dll"),
    "advapi32": (0x767F0000, r"C:\Windows\SysWOW64\advapi32.dll"),
    "user32": (0x76980000, r"C:\Windows\SysWOW64\user32.dll"),
    "ntdll": (0x77080000, r"C:\Windows\SysWOW64\ntdll.dll"),
}

IMMS: list[tuple[str, int, str]] = [
    ("0x85A380", 0xADE47B07, "registry fill#1 -> slot 0x859CE5, gate 'R' (3-arg key API)"),
    ("0x85A39E", 0x902E00E5, "registry fill#2 -> slot 0x859CE1, gate 'R' (1-arg key API)"),
    ("0x85A3BC", 0xB9BF1235, "registry fill#3 -> slot 0x81A829, gate 'R' (6-arg value API)"),
    ("0x85A3DA", 0x98781034, "registry fill#4 -> slot 0x8191E9, gate 'R' (1-arg key API)"),
    ("0x85A3F8", 0xC005DBD4, "registry fill#5 -> slot 0x819C95, gate 'R' (6-arg value API)"),
    ("0x85FFE5", 0x99395F90, "driver stage"),
    ("0x86003F", 0x90045206, "driver stage"),
    ("0x8600C5", 0xBC907028, "driver stage"),
    ("0x86017C", 0xD9DA1CE9, "driver stage"),
    ("0x860203", 0xBADE0614, "driver stage"),
    ("0x86023B", 0x8A0FB5E2, "driver stage"),
    ("0x8602D6", 0x83D0B5F3, "driver stage"),
    ("0x860343", 0xF397A8A3, "driver stage"),
    ("0x8603C3", 0x8728FAF6, "driver stage"),
    ("0x860456", 0xBC8E6EFC, "driver stage"),
    ("0x8604E6", 0x8E726969, "driver stage"),
    ("0x86055E", 0xB8F2EC64, "driver stage (DeviceIoControl family)"),
    ("0x860594", 0xCEE4E7B8, "driver stage"),
    ("0x860613", 0xC0764AA7, "driver stage / detection edge"),
    ("0x860681", 0xFCB148D8, "driver stage"),
    ("0x860849", 0x93C8F7C1, "driver stage"),
    ("0x860B45", 0xE3E45B86, "driver stage"),
    ("0x860CBA", 0xC7B15E87, "driver stage (after \\\\.\\Oreans.vxd open)"),
    ("0x8594FF", 0xA43576A8, "pre-probe user32 resolution (walker-log run 4; expected MessageBoxExA)"),
    ("0x8595E7", 0xBC8E6EFC, "pre-probe kernel32 resolution for the SICE probe (walker-log run 5)"),
]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, default=ROOT / "glm-work" / "result")
    args = parser.parse_args()
    if not WIDE.exists():
        raise SystemExit("wide capture missing; run maple079_wide_capture.py first")
    image = WIDE.read_bytes()[: 0x862000 - 0x819000]

    uc = Uc(UC_ARCH_X86, UC_MODE_32)
    uc.mem_map(0x400000 + 0x819000, (len(image) + 0xFFF) & ~0xFFF)
    uc.mem_write(0x400000 + 0x819000, image)
    uc.mem_map(0x4FF00000, 0x1000)
    uc.mem_map(0xF0000, 0x20000)
    for base, path in MODULES.values():
        p = Path(path)
        pe = pefile.PE(str(p), fast_load=True)
        size = (int(pe.OPTIONAL_HEADER.SizeOfImage) + 0xFFF) & ~0xFFF
        data = p.read_bytes()
        uc.mem_map(base, size)
        uc.mem_write(base, data[: 0x1000])
        for sec in pe.sections:
            raw = data[sec.PointerToRawData : sec.PointerToRawData + sec.SizeOfRawData]
            if raw:
                uc.mem_write(base + sec.VirtualAddress, raw)

    def read_cstr(va: int, limit: int = 64) -> bytes:
        out = bytearray()
        for i in range(limit):
            b = uc.mem_read(va + i, 1)[0]
            if b == 0:
                break
            out.append(b)
        return bytes(out)

    flat: dict[int, tuple[str, str]] = {}
    for mod, (base, _p) in MODULES.items():
        state = {"name_va": None, "pairs": 0}

        def on_code(uc_, address, size, user, state=state, mod=mod):
            if address == HOOK_NAME_PUSH:
                state["name_va"] = uc_.reg_read(UC_X86_REG_EDI)
            elif address == HOOK_CMP:
                va = state["name_va"]
                if va:
                    name = read_cstr(va)
                    if name:
                        flat.setdefault(uc_.reg_read(UC_X86_REG_EAX), (mod, name.decode("latin1", "replace")))
                        state["pairs"] += 1

        h = uc.hook_add(UC_HOOK_CODE, on_code)
        uc.mem_write(0xFF000 - 12, SENTINEL.to_bytes(4, "little"))
        uc.mem_write(0xFF000 - 8, base.to_bytes(4, "little"))
        uc.mem_write(0xFF000 - 4, 0xDEADBEEF.to_bytes(4, "little"))
        uc.reg_write(UC_X86_REG_ESP, 0xFF000 - 12)
        uc.reg_write(UC_X86_REG_EBP, 0xF97D9014)
        uc.reg_write(UC_X86_REG_ESI, 0)
        uc.reg_write(UC_X86_REG_EAX, 0)
        try:
            uc.emu_start(WALKER, SENTINEL, count=30_000_000)
        except Exception:
            pass
        uc.hook_del(h)
        print(f"{mod}: {state['pairs']} names enumerated")

    args.out.mkdir(parents=True, exist_ok=True)
    named = 0
    with (args.out / "resolver-api-dictionary.csv").open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["callsite", "imm_checksum", "module", "api_name", "note"])
        for site, imm, note in IMMS:
            hit = flat.get(imm)
            if hit:
                named += 1
            w.writerow([site, f"0x{imm:08X}", hit[0] if hit else "", hit[1] if hit else "", note])
            print(f"{site} 0x{imm:08X} -> {(hit[0] + '!' + hit[1]) if hit else 'UNRESOLVED'}  ({note})")
    print(f"named {named}/{len(IMMS)}")


if __name__ == "__main__":
    main()
