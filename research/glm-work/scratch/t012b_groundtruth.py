"""Extract GROUND-TRUTH (export name -> real checksum) pairs by instrumenting
the real walker loop, then look up the Task 011/012 resolver immediates.

Hooks:
  0x0081D13C  push edi        -> edi = current export-name VA (name start)
  0x0081D184  cmp edx, eax    -> eax = walker-computed checksum of that name

One failing walk enumerates EVERY exported name of the module.
"""
from __future__ import annotations

import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import maple079_resolver_dict as rd  # noqa: E402

import pefile
from unicorn import Uc, UC_ARCH_X86, UC_MODE_32, UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_EBP, UC_X86_REG_EDI, UC_X86_REG_ESI, UC_X86_REG_ESP

ROOT = Path(__file__).resolve().parents[2]
WALKER = 0x400000 + 0x81CEC7
SENTINEL = 0x50000000
HOOK_NAME_PUSH = 0x400000 + 0x81D13C
HOOK_CMP = 0x400000 + 0x81D184

image = rd.build_image()
uc = Uc(UC_ARCH_X86, UC_MODE_32)
uc.mem_map(rd.MEM_BASE, rd.MEM_LEN)
uc.mem_write(rd.MEM_BASE + rd.IMG_OFF, image)
uc.mem_map(0x4FF00000, 0x1000)
uc.mem_map(rd.STACK - 0x10000, 0x20000)

modules: dict[str, tuple[int, Path]] = {
    "kernel32": (0x76240000, Path(r"C:\Windows\SysWOW64\kernel32.dll")),
    "advapi32": (0x767F0000, Path(r"C:\Windows\SysWOW64\advapi32.dll")),
    "user32": (0x76980000, Path(r"C:\Windows\SysWOW64\user32.dll")),
    "ntdll": (0x77080000, Path(r"C:\Windows\SysWOW64\ntdll.dll")),
}
for _mod, (base, path) in modules.items():
    pe = pefile.PE(str(path), fast_load=True)
    size = (int(pe.OPTIONAL_HEADER.SizeOfImage) + 0xFFF) & ~0xFFF
    data = path.read_bytes()
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


def walk_module(mod: str, base: int) -> dict[int, str]:
    table: dict[int, str] = {}
    state = {"name_va": None, "pairs": 0}

    def on_code(uc_, address, size, user):
        if address == HOOK_NAME_PUSH:
            state["name_va"] = uc_.reg_read(UC_X86_REG_EDI)
        elif address == HOOK_CMP:
            name_va = state["name_va"]
            if name_va:
                name = read_cstr(name_va)
                if name:
                    table[uc_.reg_read(UC_X86_REG_EAX)] = name.decode("latin1", "replace")
                    state["pairs"] += 1

    h = uc.hook_add(UC_HOOK_CODE, on_code)
    uc.mem_write(rd.STACK - 12, SENTINEL.to_bytes(4, "little"))
    uc.mem_write(rd.STACK - 8, base.to_bytes(4, "little"))
    uc.mem_write(rd.STACK - 4, 0xDEADBEEF.to_bytes(4, "little"))  # never matches
    uc.reg_write(UC_X86_REG_ESP, rd.STACK - 12)
    uc.reg_write(UC_X86_REG_EBP, rd.FRAME)
    uc.reg_write(UC_X86_REG_ESI, 0)
    uc.reg_write(UC_X86_REG_EAX, 0)
    try:
        uc.emu_start(WALKER, SENTINEL, count=30_000_000)
    except Exception as exc:
        print(f"  {mod}: stopped ({exc.__class__.__name__}) after {state['pairs']} pairs")
    uc.hook_del(h)
    print(f"  {mod}: {len(table)} distinct name->checksum pairs")
    return table


all_tables: dict[str, dict[int, str]] = {}
for mod in modules:
    base = modules[mod][0]
    print(f"walking {mod} @ {base:#x} ...")
    all_tables[mod] = walk_module(mod, base)

flat: dict[int, tuple[str, str]] = {}
for mod, table in all_tables.items():
    for cs, name in table.items():
        flat.setdefault(cs, (mod, name))

IMMS = {
    0xADE47B07: "fill#1 -> 0x859CE5 open-shape, gate R",
    0x902E00E5: "fill#2 -> 0x859CE1 close-shape, gate R",
    0xB9BF1235: "fill#3 -> 0x81A829 set-shape, gate R",
    0x98781034: "fill#4 -> 0x8191E9 close2, gate R",
    0xC005DBD4: "fill#5 -> 0x819C95 unknown, gate R",
    0x99395F90: "driver @0x85FFE5",
    0x90045206: "driver @0x86003F",
    0xBC907028: "driver @0x8600C5",
    0xD9DA1CE9: "driver @0x86017C",
    0xBADE0614: "driver @0x860203",
    0x8A0FB5E2: "driver @0x86023B",
    0x83D0B5F3: "driver @0x8602D6",
    0xF397A8A3: "driver @0x860343",
    0x8728FAF6: "driver @0x8603C3",
    0xBC8E6EFC: "driver @0x860456",
    0x8E726969: "driver @0x8604E6",
    0xB8F2EC64: "driver @0x86055E",
    0xCEE4E7B8: "driver @0x860594",
    0xC0764AA7: "driver/detection @0x860613",
    0xFCB148D8: "driver @0x860681",
    0x93C8F7C1: "driver @0x860849",
    0xE3E45B86: "driver @0x860B45",
    0xC7B15E87: "driver @0x860CBA (after Oreans.vxd open)",
}

out = ROOT / "glm-work" / "result"
out.mkdir(parents=True, exist_ok=True)
with (out / "resolver-api-dictionary.csv").open("w", newline="", encoding="utf-8") as fh:
    w = csv.writer(fh)
    w.writerow(["imm_checksum", "module", "api_name", "callsite_note"])
    named = 0
    for imm, note in IMMS.items():
        hit = flat.get(imm)
        if hit:
            named += 1
        w.writerow([f"0x{imm:08X}", hit[0] if hit else "", hit[1] if hit else "", note])
        print(f"0x{imm:08X}  {(hit[0] + '!' + hit[1]) if hit else '???':<30} {note}")
print(f"named {named}/{len(IMMS)}")

# sanity: verify ground truth for known resolutions
for mod, name, expect_cs in (("kernel32", "GetLocalTime", None), ("kernel32", "LoadLibraryA", None)):
    for cs, (m, n) in flat.items():
        if m == mod and n == name:
            print(f"sanity: {mod}!{name} real checksum {cs:#010x} (mine {rd.probe_checksum(name):#010x})")
            break
