"""Read-only PE RVA / file-offset map for the CMS079 loader analysis.

Does not modify the input file. Example:

    python scripts/maple079_loader_map.py path\\to\\MapleStory.exe query 0x862E76
    python scripts/maple079_loader_map.py path\\to\\MapleStory.exe regions
"""

from __future__ import annotations

import argparse
import csv
import sys
from dataclasses import dataclass

import pefile


IMAGE_BASE_FALLBACK = 0x400000


@dataclass
class SectionSpan:
    name: str
    virtual_start: int
    virtual_size: int
    raw_start: int
    raw_size: int
    characteristics: int
    entropy: float

    @property
    def virtual_end(self) -> int:
        return self.virtual_start + self.virtual_size

    @property
    def raw_backed_end(self) -> int:
        return self.virtual_start + min(self.raw_size, self.virtual_size)

    def contains(self, rva: int) -> bool:
        return self.virtual_start <= rva < self.virtual_end

    def has_raw(self, rva: int) -> bool:
        return self.virtual_start <= rva < self.raw_backed_end and self.raw_size > 0

    def permissions(self) -> str:
        read = bool(self.characteristics & 0x40000000)
        write = bool(self.characteristics & 0x80000000)
        execute = bool(self.characteristics & 0x20000000)
        text = ""
        text += "R" if read else "-"
        text += "W" if write else "-"
        text += "X" if execute else "-"
        return text


def section_name(raw: bytes) -> str:
    text = raw.split(b"\x00", 1)[0].decode("ascii", "replace").strip()
    return text if text else "(unnamed)"


def load(path: str) -> tuple[pefile.PE, list[SectionSpan]]:
    pe = pefile.PE(path, fast_load=True)
    spans: list[SectionSpan] = []
    for section in pe.sections:
        data = section.get_data()[: section.SizeOfRawData]
        spans.append(
            SectionSpan(
                name=section_name(section.Name),
                virtual_start=section.VirtualAddress,
                virtual_size=section.Misc_VirtualSize,
                raw_start=section.PointerToRawData,
                raw_size=section.SizeOfRawData,
                characteristics=section.Characteristics,
                entropy=section.get_entropy(),
            )
        )
    return pe, spans


def image_base(pe: pefile.PE) -> int:
    return int(pe.OPTIONAL_HEADER.ImageBase) or IMAGE_BASE_FALLBACK


def section_for(spans: list[SectionSpan], rva: int) -> SectionSpan | None:
    for span in spans:
        if span.contains(rva):
            return span
    return None


def rva_to_offset(spans: list[SectionSpan], rva: int) -> int | None:
    span = section_for(spans, rva)
    if span is None or not span.has_raw(rva):
        return None
    return span.raw_start + (rva - span.virtual_start)


def offset_to_rva(spans: list[SectionSpan], offset: int) -> int | None:
    for span in spans:
        if span.raw_size and span.raw_start <= offset < span.raw_start + span.raw_size:
            return span.virtual_start + (offset - span.raw_start)
    return None


def is_virtual_tail(spans: list[SectionSpan], rva: int) -> bool:
    span = section_for(spans, rva)
    return bool(span and span.raw_size < span.virtual_size and rva >= span.raw_backed_end)


def describe(spans: list[SectionSpan], rva: int) -> dict[str, str]:
    span = section_for(spans, rva)
    if span is None:
        return {
            "rva": f"0x{rva:08X}",
            "section": "",
            "raw_backing": "no",
            "virtual_tail": "no",
            "file_offset": "",
            "permissions": "",
            "entropy": "",
        }
    offset = rva_to_offset(spans, rva)
    return {
        "rva": f"0x{rva:08X}",
        "section": span.name,
        "raw_backing": "yes" if span.has_raw(rva) else "no",
        "virtual_tail": "yes" if is_virtual_tail(spans, rva) else "no",
        "file_offset": "" if offset is None else f"0x{offset:08X}",
        "permissions": span.permissions(),
        "entropy": f"{span.entropy:.4f}",
        "section_va": f"0x{span.virtual_start:08X}",
        "section_vend": f"0x{span.virtual_end:08X}",
        "raw_backed_end": f"0x{span.raw_backed_end:08X}",
    }


def region_rows() -> list[dict[str, str]]:
    """Static region rows. Evidence strings stay short; entropy is filled by the caller."""
    return [
        {
            "region": "section1-raw",
            "start_rva": "0x00001000",
            "end_rva": "0x002CE000",
            "classification": "file-backed high-entropy data",
            "evidence": "raw size ends at 0x2CE000; not referenced by the entry stub",
            "confidence": "medium",
        },
        {
            "region": "virtual-tail-A",
            "start_rva": "0x002CE000",
            "end_rva": "0x007EA000",
            "classification": "zero-filled virtual tail",
            "evidence": "VirtualSize exceeds SizeOfRawData; export slots live here",
            "confidence": "high",
        },
        {
            "region": "rsrc",
            "start_rva": "0x007EA000",
            "end_rva": "0x00818000",
            "classification": "file-backed high-entropy section",
            "evidence": "section name .rsrc; not a normal resource directory",
            "confidence": "medium",
        },
        {
            "region": "idata",
            "start_rva": "0x00818000",
            "end_rva": "0x00819000",
            "classification": "import data",
            "evidence": "only kernel32!GetLocalTime",
            "confidence": "high",
        },
        {
            "region": "virtual-tail-B-raw",
            "start_rva": "0x00819000",
            "end_rva": "0x0081A000",
            "classification": "file-backed low-entropy page",
            "evidence": "section raw size is 0x1000",
            "confidence": "high",
        },
        {
            "region": "virtual-tail-B",
            "start_rva": "0x0081A000",
            "end_rva": "0x00912000",
            "classification": "zero-filled virtual tail",
            "evidence": "no raw backing; Task 003 exception RVAs sit in this range",
            "confidence": "high",
        },
        {
            "region": "tpuaozxc",
            "start_rva": "0x00912000",
            "end_rva": "0x009D8000",
            "classification": "packed source",
            "evidence": "entry address math lands on 0x912000; first 0x1000 bytes are the transform input",
            "confidence": "high",
        },
        {
            "region": "entry",
            "start_rva": "0x009D8000",
            "end_rva": "0x009D9000",
            "classification": "loader/protector control code",
            "evidence": "AddressOfEntryPoint; call/pop plus in-place dword transform",
            "confidence": "high",
        },
        {
            "region": "uvrwsdpb",
            "start_rva": "0x009D9000",
            "end_rva": "0x009DA000",
            "classification": "adjacent loader scratch",
            "evidence": "not referenced by the entry stub",
            "confidence": "low",
        },
    ]


def write_region_csv(path: str, pe: pefile.PE, spans: list[SectionSpan]) -> None:
    rows = []
    for row in region_rows():
        start = int(row["start_rva"], 16)
        span = section_for(spans, start)
        offset = rva_to_offset(spans, start)
        end = int(row["end_rva"], 16)
        raw_end = ""
        if span is not None and span.has_raw(start):
            backed = min(end, span.raw_backed_end)
            raw_end = f"0x{span.raw_start + (backed - span.virtual_start):08X}"
        rows.append(
            {
                "region": row["region"],
                "start_rva": row["start_rva"],
                "end_rva": row["end_rva"],
                "section": "" if span is None else span.name,
                "raw_backing": "yes" if span and span.has_raw(start) else "no",
                "raw_start": "" if offset is None else f"0x{offset:08X}",
                "raw_end": raw_end,
                "permissions": "" if span is None else span.permissions(),
                "entropy": "" if span is None else f"{span.entropy:.4f}",
                "classification": row["classification"],
                "evidence": row["evidence"],
                "confidence": row["confidence"],
            }
        )
    with open(path, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "region",
                "start_rva",
                "end_rva",
                "section",
                "raw_backing",
                "raw_start",
                "raw_end",
                "permissions",
                "entropy",
                "classification",
                "evidence",
                "confidence",
            ],
        )
        writer.writeheader()
        writer.writerows(rows)


def parse_rva(text: str) -> int:
    return int(text, 16)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Read-only RVA map for MapleStory.exe")
    parser.add_argument("exe")
    parser.add_argument("command", choices=("sections", "query", "regions"))
    parser.add_argument("values", nargs="*")
    parser.add_argument("--csv")
    args = parser.parse_args(argv)
    pe, spans = load(args.exe)
    print(f"image_base 0x{image_base(pe):08X}")
    print(f"entry_rva 0x{pe.OPTIONAL_HEADER.AddressOfEntryPoint:08X}")
    print(f"size_of_image 0x{pe.OPTIONAL_HEADER.SizeOfImage:08X}")
    if args.command == "sections":
        for span in spans:
            print(
                f"{span.name:12} VA 0x{span.virtual_start:08X}-0x{span.virtual_end:08X} "
                f"raw 0x{span.raw_start:08X}+0x{span.raw_size:X} "
                f"backed_end 0x{span.raw_backed_end:08X} {span.permissions()} entropy {span.entropy:.4f}"
            )
    elif args.command == "query":
        targets = [parse_rva(item) for item in args.values] or [
            0x002CE000,
            0x005FC19F,
            0x005FC1B0,
            0x005FC1C1,
            0x00819000,
            0x00862E76,
            0x00862FB0,
            0x00912000,
            0x009D8000,
        ]
        for rva in targets:
            info = describe(spans, rva)
            print(
                f"{info['rva']} section={info['section']} raw={info['raw_backing']} "
                f"tail={info['virtual_tail']} file={info['file_offset']} "
                f"perm={info['permissions']} entropy={info['entropy']}"
            )
    elif args.command == "regions":
        destination = args.csv or "result/loader-region-map.csv"
        write_region_csv(destination, pe, spans)
        print(destination)
    return 0


if __name__ == "__main__":
    sys.exit(main())
