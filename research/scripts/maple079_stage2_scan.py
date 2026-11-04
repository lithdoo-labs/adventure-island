"""Stage-2 PE-scan correlation for the MapleStory CMS079 protector.

Reads the already materialized T2 block and a process-layout snapshot.
It does not attach a debugger, patch a process, or write process memory.
Generated protector bytes are never written by this script.
"""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

from capstone import Cs, CS_ARCH_X86, CS_MODE_32
import pefile

BLOCK_RVA = 0x819000
POP_RVA = 0x81C6CF
POP_SUB = 0x74436BB
IMAGE_BASE = 0x400000
SCAN_LO = 0x81C6C5
SCAN_HI = 0x81D800


def slot_rva(disp: int) -> int:
    return (POP_RVA + disp - POP_SUB) & 0xFFFFFFFF


def load_block(path: Path) -> bytes:
    return path.read_bytes()


def insn_at(block: bytes, rva: int):
    off = rva - BLOCK_RVA
    if off < 0 or off + 16 > len(block):
        return None
    md = Cs(CS_ARCH_X86, CS_MODE_32)
    return next(md.disasm(block[off : off + 16], rva), None)


def gadget_landing(block: bytes, ins) -> int | None:
    if ins.mnemonic != "call" or not ins.op_str.startswith("0x"):
        return None
    target = int(ins.op_str, 16)
    first = insn_at(block, target)
    second = insn_at(block, target + first.size) if first else None
    third = insn_at(block, second.address + second.size) if second else None
    if not (
        first
        and first.mnemonic == "pop"
        and second
        and second.mnemonic == "mov"
        and "esp + 4" in second.op_str
        and third
        and third.mnemonic == "add"
        and "esp + 4" in third.op_str
    ):
        return None
    imm = int(third.op_str.split(",")[-1], 16)
    return ins.address + ins.size + imm


def build_cfg(block: bytes) -> list[dict]:
    md = Cs(CS_ARCH_X86, CS_MODE_32)
    rows: list[dict] = []
    seen: set[int] = set()
    work = [SCAN_LO]
    while work:
        rva = work.pop()
        if rva in seen or not (SCAN_LO <= rva < SCAN_HI):
            continue
        off = rva - BLOCK_RVA
        if off < 0 or off >= len(block):
            continue
        ins = next(md.disasm(block[off : off + 16], rva), None)
        if ins is None or ins.address != rva:
            continue
        seen.add(rva)
        landing = gadget_landing(block, ins)
        edges: list[str] = []
        if landing is not None:
            edges.append(f"gadget:{landing:08X}")
            work.append(landing)
        elif ins.mnemonic == "jmp" and ins.op_str.startswith("0x"):
            target = int(ins.op_str, 16)
            edges.append(f"jmp:{target:08X}")
            work.append(target)
        elif ins.mnemonic.startswith("j") and ins.op_str.startswith("0x"):
            target = int(ins.op_str, 16)
            fall = ins.address + ins.size
            edges.append(f"branch:{target:08X}")
            edges.append(f"fall:{fall:08X}")
            work.append(target)
            work.append(fall)
        elif ins.mnemonic == "call" and ins.op_str.startswith("0x"):
            target = int(ins.op_str, 16)
            fall = ins.address + ins.size
            edges.append(f"call:{target:08X}")
            edges.append(f"return:{fall:08X}")
            work.append(target)
            work.append(fall)
        elif ins.mnemonic in ("ret", "retn"):
            edges.append("ret")
        else:
            fall = ins.address + ins.size
            edges.append(f"next:{fall:08X}")
            work.append(fall)
        rows.append(
            {
                "rva": f"0x{rva:08X}",
                "bytes": ins.bytes.hex(),
                "mnemonic": ins.mnemonic,
                "operands": ins.op_str,
                "edges": ";".join(edges),
            }
        )
    rows.sort(key=lambda item: int(item["rva"], 16))
    return rows


def require(block: bytes, rva: int, raw: bytes, label: str) -> None:
    off = rva - BLOCK_RVA
    got = block[off : off + len(raw)]
    if got != raw:
        raise SystemExit(f"{label} at {rva:#x} is {got.hex()}, expected {raw.hex()}")


def validation_rows() -> list[dict]:
    # Offsets are from the candidate base. failure_target is the RVA taken when
    # the comparison does not match.
    return [
        {
            "check_order": "1",
            "instruction_rva": "0x0081CBB3",
            "field": "e_magic",
            "offset": "0x00",
            "comparison": "word == 0x5A4D",
            "failure_target": "0x0081CBC8",
            "meaning": "Host walk, 0x1000 stride. Finds the image that contains this code.",
            "confidence": "confirmed",
        },
        {
            "check_order": "2",
            "instruction_rva": "0x0081CBBA",
            "field": "e_lfanew",
            "offset": "0x3C",
            "comparison": "word, zero-extended, no range check",
            "failure_target": "",
            "meaning": "Host walk loads e_lfanew as a 16-bit field.",
            "confidence": "confirmed",
        },
        {
            "check_order": "3",
            "instruction_rva": "0x0081CBC0",
            "field": "PE signature",
            "offset": "e_lfanew",
            "comparison": "dword == 0x00004550",
            "failure_target": "0x0081CBC8",
            "meaning": "Host walk accepts the image. This is MapleStory, not the later scan target.",
            "confidence": "confirmed",
        },
        {
            "check_order": "4",
            "instruction_rva": "0x0081CC60",
            "field": "iteration",
            "offset": "",
            "comparison": "eax == 0x32",
            "failure_target": "0x0081CC84",
            "meaning": "Stop before the 51st test. eax starts at 0 and increments after each miss.",
            "confidence": "confirmed",
        },
        {
            "check_order": "5",
            "instruction_rva": "0x0081CC65",
            "field": "e_magic",
            "offset": "0x00",
            "comparison": "word == 0x5A4D",
            "failure_target": "0x0081CC6C",
            "meaning": "64 KB scan. Failure subtracts 0x10000 and increments eax.",
            "confidence": "confirmed",
        },
        {
            "check_order": "6",
            "instruction_rva": "0x0081CC75",
            "field": "e_lfanew",
            "offset": "0x3C",
            "comparison": "dword, no range check",
            "failure_target": "",
            "meaning": "Added to ESI to form the PE-header pointer.",
            "confidence": "confirmed",
        },
        {
            "check_order": "7",
            "instruction_rva": "0x0081CC7A",
            "field": "PE signature",
            "offset": "e_lfanew",
            "comparison": "dword == 0x00004550",
            "failure_target": "0x0081CC6C",
            "meaning": "Match enters the found path at 0x0081CCC6.",
            "confidence": "confirmed",
        },
        {
            "check_order": "8",
            "instruction_rva": "",
            "field": "Machine",
            "offset": "e_lfanew+4",
            "comparison": "not checked",
            "failure_target": "",
            "meaning": "Absent from both walks and from the recovered found-path prefix.",
            "confidence": "confirmed",
        },
        {
            "check_order": "9",
            "instruction_rva": "",
            "field": "NumberOfSections",
            "offset": "e_lfanew+6",
            "comparison": "not checked",
            "failure_target": "",
            "meaning": "Absent from both walks and from the recovered found-path prefix.",
            "confidence": "confirmed",
        },
        {
            "check_order": "10",
            "instruction_rva": "",
            "field": "OptionalHeader.Magic",
            "offset": "e_lfanew+24",
            "comparison": "not checked",
            "failure_target": "",
            "meaning": "Absent from both walks and from the recovered found-path prefix.",
            "confidence": "confirmed",
        },
        {
            "check_order": "11",
            "instruction_rva": "",
            "field": "ImageBase",
            "offset": "e_lfanew+52",
            "comparison": "not checked",
            "failure_target": "",
            "meaning": "Absent from both walks and from the recovered found-path prefix.",
            "confidence": "confirmed",
        },
        {
            "check_order": "12",
            "instruction_rva": "",
            "field": "SizeOfImage",
            "offset": "e_lfanew+80",
            "comparison": "not checked",
            "failure_target": "",
            "meaning": "Absent from both walks and from the recovered found-path prefix.",
            "confidence": "confirmed",
        },
        {
            "check_order": "13",
            "instruction_rva": "",
            "field": "section table",
            "offset": "",
            "comparison": "not checked",
            "failure_target": "",
            "meaning": "No section walk in the scan or the recovered found-path prefix.",
            "confidence": "confirmed",
        },
        {
            "check_order": "14",
            "instruction_rva": "",
            "field": "DataDirectory",
            "offset": "",
            "comparison": "not checked",
            "failure_target": "",
            "meaning": "No data-directory walk in the scan or the recovered found-path prefix.",
            "confidence": "confirmed",
        },
    ]


def found_references() -> list[dict]:
    return [
        {
            "rva": "0x0081CCC6",
            "kind": "register",
            "target": "eax",
            "detail": "xchg esi, eax. EAX becomes the candidate base; ESI becomes the iteration index.",
        },
        {
            "rva": "0x0081CD44",
            "kind": "store",
            "target": f"0x{slot_rva(0x7441B8D):08X}",
            "detail": "Writes 1. Re-entry / found flag.",
        },
        {
            "rva": "0x0081CD8C",
            "kind": "store",
            "target": f"0x{slot_rva(0x744160D):08X}",
            "detail": "Saves the candidate base.",
        },
        {
            "rva": "0x0081CD95",
            "kind": "store",
            "target": f"0x{slot_rva(0x7442449):08X}",
            "detail": "Saves the candidate base a second time.",
        },
        {
            "rva": "0x0081CDD8",
            "kind": "transform-read",
            "target": "edx+ebx",
            "detail": "Reads one dword of the stage-2 body. ebx starts at 0 and then steps by -4.",
        },
        {
            "rva": "0x0081CE47",
            "kind": "transform-write",
            "target": "edx+ebx",
            "detail": "Writes the dword back after xor/add. This is the next in-place materializer.",
        },
        {
            "rva": "0x0081CE6B",
            "kind": "loop-end",
            "target": "0xFFFF8E34",
            "detail": "Leaves the first transform when ebx reaches this value.",
        },
        {
            "rva": "0x0081D58D",
            "kind": "loop-count",
            "target": "0x1A99",
            "detail": "Second in-place dword loop. Still inside the stage-2 body.",
        },
        {
            "rva": "0x0081D5F6",
            "kind": "stride",
            "target": "eax -= 4",
            "detail": "Second loop walks backward four bytes at a time.",
        },
    ]


def expand_path(text: str) -> str:
    if text.startswith("%USERPROFILE%"):
        import os

        return os.environ["USERPROFILE"] + text[len("%USERPROFILE%") :]
    return text


def header_status(path: str, rva: int) -> tuple[str, str]:
    """Return (file_is_pe, candidate_va_passes_scan) without reading process memory."""
    try:
        pe = pefile.PE(path, fast_load=True)
    except (OSError, pefile.PEFormatError):
        return "no", "no"
    file_ok = pe.DOS_HEADER.e_magic == 0x5A4D and pe.NT_HEADERS.Signature == 0x4550
    if rva < 0 or rva + 0x40 > pe.OPTIONAL_HEADER.SizeOfImage:
        return ("yes" if file_ok else "no"), "no"
    try:
        magic = pe.get_data(rva, 2)
        lfanew = int.from_bytes(pe.get_data(rva + 0x3C, 4), "little")
    except pefile.PEFormatError:
        return ("yes" if file_ok else "no"), "no"
    passes = False
    if magic == b"MZ" and 0 <= lfanew <= pe.OPTIONAL_HEADER.SizeOfImage - 4:
        try:
            passes = pe.get_data(rva + lfanew, 4) == b"PE\0\0"
        except pefile.PEFormatError:
            passes = False
    return ("yes" if file_ok else "no"), ("yes" if passes else "no")


def correlate(layout: Path, scan_start: int) -> list[dict]:
    modules = []
    with layout.open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            modules.append(
                {
                    "name": row["module_name"],
                    "base": int(row["module_base"], 16),
                    "size": int(row["module_size"], 16),
                    "alloc": int(row["allocation_base"], 16) if row["allocation_base"] else 0,
                    "type": row["memory_type"],
                    "path": row["normalized_path"].strip('"'),
                }
            )
    rows = []
    for index in range(0x32):
        va = (scan_start - index * 0x10000) & 0xFFFFFFFF
        owner = next((item for item in modules if item["base"] <= va < item["base"] + item["size"]), None)
        if owner is None:
            rows.append(
                {
                    "iteration": str(index),
                    "candidate_va": f"0x{va:08X}",
                    "candidate_module": "",
                    "allocation_base": "",
                    "mapped": "no",
                    "mem_image": "no",
                    "disk_pe_valid": "no",
                    "passes_validation": "no",
                    "visited_before_hit": "",
                }
            )
            continue
        disk, passes = header_status(expand_path(owner["path"]), va - owner["base"])
        rows.append(
            {
                "iteration": str(index),
                "candidate_va": f"0x{va:08X}",
                "candidate_module": owner["name"],
                "allocation_base": f"0x{owner['alloc']:08X}",
                "mapped": "yes",
                "mem_image": "yes" if owner["type"] == "MEM_IMAGE" else "no",
                "disk_pe_valid": disk,
                "passes_validation": passes,
                "visited_before_hit": "",
            }
        )
    hit = next((row for row in rows if row["passes_validation"] == "yes"), None)
    for row in rows:
        if hit is None:
            row["visited_before_hit"] = "yes"
        else:
            row["visited_before_hit"] = "yes" if int(row["iteration"]) <= int(hit["iteration"]) else "no"
    return rows


def write_csv(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--block", type=Path, required=True)
    parser.add_argument("--layout", type=Path, required=True)
    parser.add_argument("--kernel32-base", type=lambda s: int(s, 16), required=True)
    parser.add_argument("--getlocaltime-rva", type=lambda s: int(s, 16), required=True)
    parser.add_argument("--out-dir", type=Path, default=Path("result"))
    parser.add_argument("--json-out", type=Path)
    args = parser.parse_args()

    block = load_block(args.block)
    require(block, 0x81CC60, bytes.fromhex("83f832"), "cmp eax, 0x32")
    require(block, 0x81CC65, bytes.fromhex("66813e4d5a"), "cmp word [esi], MZ")
    require(block, 0x81CC6C, bytes.fromhex("81ee00000100"), "sub esi, 0x10000")
    require(block, 0x81CC1F, bytes.fromhex("81e60000ffff"), "and esi, 0xFFFF0000")
    require(block, 0x81CC01, bytes.fromhex("be40808100"), "mov esi, import directory")
    require(block, 0x81CCC6, bytes.fromhex("96"), "xchg esi, eax")

    scan_start = (args.kernel32_base + args.getlocaltime_rva) & 0xFFFF0000
    cfg = build_cfg(block)
    checks = validation_rows()
    refs = found_references()
    candidates = correlate(args.layout, scan_start)
    write_csv(args.out_dir / "stage2-scan-cfg.csv", cfg)
    write_csv(args.out_dir / "stage2-pe-validation.csv", checks)
    write_csv(args.out_dir / "stage2-found-path-references.csv", refs)
    write_csv(args.out_dir / "stage2-scan-candidates.csv", candidates)
    hit = next(row for row in candidates if row["passes_validation"] == "yes")
    summary = {
        "scan_start": f"0x{scan_start:08X}",
        "scan_last": f"0x{(scan_start - 49 * 0x10000) & 0xFFFFFFFF:08X}",
        "iterations": 50,
        "stride": "0x10000",
        "cap": "0x32",
        "import_directory_rva": "0x00818040",
        "first_thunk_rva": "0x0081802B",
        "saved_base_rva": [f"0x{slot_rva(0x744160D):08X}", f"0x{slot_rva(0x7442449):08X}"],
        "host_scan_start": f"0x{(IMAGE_BASE + 0x3C90) & ~0xFFF:08X}",
        "first_hit": hit,
        "cfg_instructions": len(cfg),
    }
    if args.json_out:
        args.json_out.parent.mkdir(parents=True, exist_ok=True)
        args.json_out.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
