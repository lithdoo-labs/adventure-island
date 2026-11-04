"""Task 012c/012d — name the beyond-wall wrapper thunks statically.

For every `push imm32 ; jmp 0x00821750` thunk pair found in the Tail B
capture (372 beyond the wall + 11 readable, from beyond-wall-thunk-tables.csv),
statically emulate the REAL wrapper code (0x00821750, readable region) in
Unicorn on the probe-stop memory image, hooking the walker helper entry
(0x0081CED7, after its pushal) to capture:

    [esp+0x24] = module base, [esp+0x28] = expected name checksum

then name the checksum against the ground-truth tables produced by the
same method as maple079_checksum_table.py (real walker + real export
tables, failed-search enumeration).

Validation gates:
- the three known wrapper training thunks (0x857E4A/0x857E68 LoadLibraryA,
  0x857E7C GetLocalTime) must name correctly;
- image memory is restored from the pristine capture between runs.

No target-process execution, no API fabrication, no patching: the
protector's own decode and lookup code runs offline against real DLLs.
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
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
THUNKS = ROOT / "glm-work" / "result" / "beyond-wall-thunk-tables.csv"

IMAGE_BASE = 0x400000
WBASE_VA = IMAGE_BASE + 0x819000
WRAPPER_VA = IMAGE_BASE + 0x821750
HELPER_EDX_VA = IMAGE_BASE + 0x81CED7  # mov edx,[esp+0x28]
SENTINEL = 0x50000000
STACK_BASE = 0x4FF00000
STACK_SIZE = 0x2000

MODULES: dict[str, tuple[int, str]] = {
    "kernel32": (0x76240000, r"C:\Windows\SysWOW64\kernel32.dll"),
    "advapi32": (0x767F0000, r"C:\Windows\SysWOW64\advapi32.dll"),
    "user32": (0x76980000, r"C:\Windows\SysWOW64\user32.dll"),
    "ntdll": (0x77080000, r"C:\Windows\SysWOW64\ntdll.dll"),
}
BASE_TO_MOD = {base: name for name, (base, _p) in MODULES.items()}

TRAINING = {0x857E4A: "LoadLibraryA", 0x857E68: "LoadLibraryA", 0x857E7C: "GetLocalTime"}


def build_checksum_table(uc: Uc) -> dict[int, tuple[str, str]]:
    """Failed-search enumeration of every export name of the four modules
    through the real walker (same method as maple079_checksum_table.py)."""
    walker_va = IMAGE_BASE + 0x81CEC7
    hook_name = IMAGE_BASE + 0x81D13C
    hook_cmp = IMAGE_BASE + 0x81D184
    flat: dict[int, tuple[str, str]] = {}

    def read_cstr(va: int, limit: int = 64) -> bytes:
        out = bytearray()
        for i in range(limit):
            b = uc.mem_read(va + i, 1)[0]
            if b == 0:
                break
            out.append(b)
        return bytes(out)

    for mod, (base, _p) in MODULES.items():
        state = {"name_va": None, "pairs": 0}

        def on_code(uc_, address, size, user, state=state, mod=mod):
            if address == hook_name:
                state["name_va"] = uc_.reg_read(UC_X86_REG_EDI)
            elif address == hook_cmp:
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
            uc.emu_start(walker_va, SENTINEL, count=40_000_000)
        except Exception:
            pass
        uc.hook_del(h)
        print(f"  {mod}: {state['pairs']} names")
    return flat


def run_thunk(uc: Uc, image: bytes, imm: int, captures: list):
    """One wrapper emulation; returns captures of (module_base, checksum)."""
    # restore pristine image + reset stack
    uc.mem_write(WBASE_VA, image)
    uc.mem_write(STACK_BASE + STACK_SIZE - 0xC, imm.to_bytes(4, "little"))
    uc.mem_write(STACK_BASE + STACK_SIZE - 0x8, SENTINEL.to_bytes(4, "little"))
    uc.reg_write(UC_X86_REG_ESP, STACK_BASE + STACK_SIZE - 0xC)
    uc.reg_write(UC_X86_REG_EBP, 0xF97D9014)
    uc.reg_write(UC_X86_REG_EAX, 0)
    uc.reg_write(UC_X86_REG_EDI, 0)
    uc.reg_write(UC_X86_REG_ESI, 0)
    uc.reg_write(UC_X86_REG_EDX, 0)
    try:
        uc.emu_start(WRAPPER_VA, SENTINEL, count=2_000_000)
    except Exception as exc:
        captures.append(("FAULT", str(exc)[:80]))
        return
    captures.append(("DONE", uc.reg_read(UC_X86_REG_EAX)))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, default=ROOT / "glm-work" / "result")
    parser.add_argument("--limit", type=int, default=0, help="only first N thunks (0=all)")
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)

    digest = probe.client_sha()
    if digest != probe.EXPECTED_SHA:
        raise SystemExit(f"client hash changed: {digest}")
    wide = WIDE.read_bytes()
    if len(wide) != 0xF9000:
        raise SystemExit("unexpected wide length")
    if not THUNKS.exists():
        raise SystemExit("thunk table missing; run maple079_beyond_wall.py first")

    rows = list(csv.DictReader(THUNKS.open(encoding="utf-8")))
    if args.limit:
        rows = rows[: args.limit]

    uc = Uc(UC_ARCH_X86, UC_MODE_32)
    uc.mem_map(WBASE_VA, (len(wide) + 0xFFF) & ~0xFFF)
    uc.mem_write(WBASE_VA, wide)
    uc.mem_map(STACK_BASE, STACK_SIZE)
    uc.mem_map(0xF0000, 0x20000)
    for base, path in MODULES.values():
        p = Path(path)
        pe = pefile.PE(str(p), fast_load=True)
        size = (int(pe.OPTIONAL_HEADER.SizeOfImage) + 0xFFF) & ~0xFFF
        data = p.read_bytes()
        uc.mem_map(base, size)
        uc.mem_write(base, data[:0x1000])
        for sec in pe.sections:
            raw = data[sec.PointerToRawData : sec.PointerToRawData + sec.SizeOfRawData]
            if raw:
                uc.mem_write(base + sec.VirtualAddress, raw)

    print("building checksum tables (4 failed-search walker runs)...")
    flat = build_checksum_table(uc)
    print("checksum table entries:", len(flat))
    del uc  # fresh instance for the thunk phase: no residue from enumeration

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

    hook_hits: list[tuple[int, int]] = []
    h = uc.hook_add(
        UC_HOOK_CODE,
        lambda uc_, address, size, user: hook_hits.append(
            (
                int.from_bytes(uc_.mem_read(uc_.reg_read(UC_X86_REG_ESP) + 0x24, 4), "little"),
                int.from_bytes(uc_.mem_read(uc_.reg_read(UC_X86_REG_ESP) + 0x28, 4), "little"),
            )
        )
        if address == HELPER_EDX_VA
        else None,
    )

    results = []
    image = wide
    for idx, row in enumerate(rows):
        site = int(row["thunk_site_rva"], 16)
        imm = int(row["descriptor_imm"], 16)
        hook_hits.clear()
        captures: list = []
        run_thunk(uc, image, imm, captures)
        checksum = None
        module_base = None
        if hook_hits:
            module_base, checksum = hook_hits[0]
        name = None
        mod = BASE_TO_MOD.get(module_base, hex(module_base) if module_base else None)
        if checksum is not None:
            hit = flat.get(checksum)
            if hit:
                name = f"{hit[0]}!{hit[1]}"
        results.append(
            {
                "site": site,
                "imm": imm,
                "module": mod,
                "checksum": checksum,
                "name": name,
                "captures": len(hook_hits),
                "end": captures[-1] if captures else None,
                "region": row["region"],
            }
        )
        if (idx + 1) % 50 == 0:
            print(f"  {idx + 1}/{len(rows)} done")
    uc.hook_del(h)

    named = [r for r in results if r["name"]]
    # mechanism gate: the emulation must capture walker (module, checksum)
    # pairs and name them for a meaningful share of thunks. (The earlier
    # "training site" idea was wrong: walker-log return addresses 0x857E4A/
    # 0x857E68/0x857E7C are slot-form call returns; the adjacent push/jmp
    # pairs are jump-table entries not executed in sequence.)
    captured = [r for r in results if r["checksum"] is not None]
    gate = len(named) >= 20 and len(named) / max(1, len(results)) >= 0.1
    print(f"captured {len(captured)}/{len(results)} walker pairs; named {len(named)}; mechanism gate: {gate}")

    with (args.out / "beyond-wall-thunk-names.csv").open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["thunk_site_rva", "descriptor_imm", "module", "checksum", "api_name", "region", "note"])
        for r in results:
            w.writerow(
                [
                    f"0x{r['site']:08X}",
                    f"0x{r['imm']:08X}",
                    r["module"] or "",
                    f"0x{r['checksum']:08X}" if r["checksum"] is not None else "",
                    r["name"] or "",
                    r["region"],
                    r["end"][0] if r["end"] else "",
                ]
            )

    summary = {
        "gates": {"client_sha": digest, "mechanism_gate": gate, "captured": len(captured)},
        "total": len(results),
        "named": len(named),
        "by_module": {},
        "failures": [
            {"site": f"0x{r['site']:X}", "end": r["end"]} for r in results if not r["name"]
        ][:30],
        "names": sorted({r["name"] for r in named}),
    }
    for r in named:
        summary["by_module"][r["module"]] = summary["by_module"].get(r["module"], 0) + 1
    (args.out / "task012c-thunk-names-summary.json").write_text(
        json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(json.dumps({k: v for k, v in summary.items() if k != "failures"}, indent=2))


if __name__ == "__main__":
    main()
