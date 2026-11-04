"""Track A (T-101): static inventory of the unpacked Wizet DLLs.

For each target DLL:
- PE summary (image base, sections, imports, exports with stdcall arg counts)
- ASCII/UTF-16 string inventory (filtered to interesting tokens)
- code references (push imm32 / mov reg,imm32 / lea-style absolute VA) to the
  addresses of the interesting strings

Read-only: parses files under .work/, writes CSV/JSON under glm-work/result/.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import struct
import sys
from pathlib import Path

import pefile
from capstone import Cs, CS_ARCH_X86, CS_MODE_32

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
CLIENT_DIR = ROOT / ".work" / "task-001" / "extracted"

TARGETS = [
    "ResMan.dll", "Canvas.dll", "PCOM.dll", "NameSpace.dll", "Shape2D.dll",
    "Gr2D_DX8.dll", "Sound_DX8.dll", "ZLZ.dll", "WzMss.dll", "ijl15.dll",
]

INTERESTING = [
    b"List.wz", b".wz", b"WZ", b"PWS2_32", b"WS2_32", b"ws2_32",
    b"WSAStartup", b"connect", b"send", b"recv", b"socket",
    b"PKG", b"ResMan", b"Canvas", b"PCOM", b"Inflate", b"Deflate",
    b"ZLZ", b"Soap",
]

md = Cs(CS_ARCH_X86, CS_MODE_32)
md.detail = True


def find_dll(name: str) -> Path:
    return next(CLIENT_DIR.rglob(name))


def strings_of(data: bytes) -> list[tuple[int, bytes]]:
    out = []
    run = bytearray()
    start = 0
    for i, b in enumerate(data):
        if 32 <= b < 127:
            if not run:
                start = i
            run.append(b)
        else:
            if len(run) >= 5:
                out.append((start, bytes(run)))
            run = bytearray()
    if len(run) >= 5:
        out.append((start, bytes(run)))
    # UTF-16LE quick pass for .wz / List tokens
    for tok in (b"List.wz", b".wz"):
        needle = tok.decode().encode("utf-16-le")
        pos = 0
        while True:
            i = data.find(needle, pos)
            if i < 0:
                break
            out.append((i, "U16:" + tok.decode()))
            pos = i + 1
    return out


def rva_of(pe: pefile.PE, file_off: int) -> int | None:
    for sec in pe.sections:
        lo = sec.PointerToRawData
        hi = lo + max(sec.SizeOfRawData, sec.Misc_VirtualSize)
        if lo <= file_off < hi:
            return sec.VirtualAddress + (file_off - lo)
    if file_off < pe.OPTIONAL_HEADER.SizeOfHeaders:
        return file_off
    return None


def va_refs(pe: pefile.PE, data: bytes, va: int) -> list[tuple[int, str]]:
    """Find push imm32 / mov r32,imm32 sites referencing va."""
    needle = struct.pack("<I", va)
    refs = []
    pos = 0
    text_sections = [s for s in pe.sections if s.Characteristics & 0x20000000]  # EXEC
    while True:
        i = data.find(needle, pos)
        if i < 0:
            break
        pos = i + 1
        # opcode right before decides the form
        if i >= 1 and data[i - 1] == 0x68:
            form = "push imm32"
        elif i >= 1 and 0xB8 <= data[i - 1] <= 0xBF:
            form = "mov r32, imm32"
        elif i >= 2 and data[i - 2] == 0x8D and (data[i - 1] & 0xC7) in (0x05, 0x05 | 0):
            form = "lea"
        elif i >= 2 and data[i - 2] in (0xC7,):
            form = "mov mem, imm32"
        else:
            form = "dword occurrence"
        rva = rva_of(pe, i)
        if rva is None:
            continue
        in_text = any(s.VirtualAddress <= rva < s.VirtualAddress + s.Misc_VirtualSize for s in text_sections)
        refs.append((rva, form if in_text else form + " (non-exec)"))
    return refs


def export_arg_bytes(pe: pefile.PE, data: bytes, rva: int, limit: int = 220) -> int | None:
    """Follow an export body for a `ret N` to estimate stdcall args."""
    off = pe.get_offset_from_rva(rva)
    code = data[off : off + limit]
    eip = 0
    for _ in range(80):
        insns = list(md.disasm(code[eip : eip + 16], eip, count=1))
        if not insns:
            return None
        insn = insns[0]
        if insn.mnemonic in ("ret",):
            ops = insn.operands
            return ops[0].imm if ops else 0
        if insn.mnemonic == "jmp" and insn.operands[0].type == 1:  # imm
            tgt = insn.operands[0].imm
            if 0 <= tgt < limit - 4:
                eip = tgt
                continue
            return None
        if insn.mnemonic.startswith("j"):
            return None  # branchy; bail
        eip += insn.size
        if eip >= limit:
            return None
    return None


def analyze(name: str) -> dict:
    path = find_dll(name)
    data = path.read_bytes()
    sha = hashlib.sha256(data).hexdigest()
    pe = pefile.PE(str(path), fast_load=True)
    pe.parse_data_directories(directories=[
        pefile.DIRECTORY_ENTRY["IMAGE_DIRECTORY_ENTRY_IMPORT"],
        pefile.DIRECTORY_ENTRY["IMAGE_DIRECTORY_ENTRY_EXPORT"],
    ])
    base = pe.OPTIONAL_HEADER.ImageBase
    info: dict = {"dll": name, "sha256": sha, "image_base": hex(base), "size": len(data)}

    # imports
    imports = []
    if hasattr(pe, "DIRECTORY_ENTRY_IMPORT"):
        for entry in pe.DIRECTORY_ENTRY_IMPORT:
            names = [imp.name.decode() if imp.name else f"ord{imp.ordinal}" for imp in entry.imports]
            imports.append({"dll": entry.dll.decode(), "count": len(names), "notable": [n for n in names if any(t in n.upper() for t in ("WSA", "SOCKET", "CONNECT", "SEND", "RECV"))][:12]})
    info["imports"] = imports

    # exports
    exports = []
    if hasattr(pe, "DIRECTORY_ENTRY_EXPORT"):
        for sym in pe.DIRECTORY_ENTRY_EXPORT.symbols:
            if not sym.name:
                continue
            args = export_arg_bytes(pe, data, sym.address)
            exports.append({"name": sym.name.decode(), "rva": hex(sym.address), "stdcall_args": args})
    info["exports"] = exports

    # interesting strings + refs
    strings = strings_of(data)
    hits = []
    for off, s in strings:
        low = s if isinstance(s, bytes) else s.encode()
        if not any(t in low for t in INTERESTING):
            continue
        rva = rva_of(pe, off)
        if rva is None:
            continue
        refs = va_refs(pe, data, base + rva)
        hits.append({
            "string": (s.decode("latin1") if isinstance(s, bytes) else s),
            "rva": hex(rva), "va": hex(base + rva),
            "refs": [(hex(r), f) for r, f in refs[:8]],
        })
    info["strings"] = hits
    return info


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, default=ROOT / "glm-work" / "result")
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    report = []
    for name in TARGETS:
        try:
            info = analyze(name)
        except Exception as exc:
            info = {"dll": name, "error": f"{exc.__class__.__name__}: {exc}"}
        report.append(info)
        print(f"== {name}: exports={len(info.get('exports', []))} string-hits={len(info.get('strings', []))} imports={len(info.get('imports', []))}")

    (args.out / "wizet-dll-inventory.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")

    with (args.out / "resman-entry-points.csv").open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["dll", "export", "rva", "stdcall_args", "guess"])
        guesses = {
            "Open": "WZ/file open candidate",
            "Read": "read candidate",
            "Create": "object creation",
            "Mount": "mount/attach",
            "Init": "init",
        }
        for info in report:
            for exp in info.get("exports", []):
                g = next((v for k, v in guesses.items() if k.lower() in exp["name"].lower()), "")
                w.writerow([info["dll"], exp["name"], exp["rva"], exp["stdcall_args"], g])
    print("wrote wizet-dll-inventory.json and resman-entry-points.csv")


if __name__ == "__main__":
    main()
