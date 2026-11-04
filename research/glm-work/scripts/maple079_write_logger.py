"""Second replay run with an injected write-logger for the uncatalogued
rewrite region 0x0085941A-0x0085FA3E (found by the Task 012 wide diff).

Reuses scripts/maple079_stage2_continue.py unmodified. We intercept
Uc.hook_add so that when the committed script registers its own
UC_HOOK_MEM_WRITE hook, we register one extra callback of ours that logs
(eip, address, size) for every write into the MapleStory image below
0x00912000. Aggregated per producer RVA. Output: JSON in glm-work/scratch/.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

import maple079_stage2_continue as rep  # noqa: E402
from unicorn import Uc, UC_HOOK_MEM_WRITE  # noqa: E402
from unicorn.x86_const import UC_X86_REG_EIP  # noqa: E402

IMAGE = 0x400000
TAIL_B_HI = 0x912000
OUT = ROOT / "glm-work" / "scratch" / "uncatalogued-round-producers.json"

log: list[dict] = []
seen_first: dict[int, int] = {}


def my_write_hook(uc, access, address, size, value, _user):
    if IMAGE <= address < IMAGE + TAIL_B_HI:
        eip = uc.reg_read(UC_X86_REG_EIP)
        rva = eip - IMAGE
        page = address & 0xFFFFF000
        rec = (rva, page, size)
        if len(log) < 400_000:
            log.append({"eip_rva": rva, "page": page - IMAGE, "size": size})
        key = (rva, page)
        if key not in seen_first:
            seen_first[key] = len(log)


def main() -> int:
    exe = next((ROOT / ".work" / "task-001" / "extracted").rglob("MapleStory.exe"))
    kernel32 = Path(r"C:\Windows\SysWOW64\kernel32.dll")
    block = ROOT / ".work" / "task-006" / "tail-b-nonzero.bin"

    orig_hook_add = Uc.hook_add

    def patched_hook_add(self, htype, callback=None, *args, **kwargs):
        if htype == UC_HOOK_MEM_WRITE:
            # register our logger alongside the committed hook
            try:
                orig_hook_add(self, htype, my_write_hook, *args, **kwargs)
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
    print("running replay with injected write logger...")
    code = rep.main()
    Uc.hook_add = orig_hook_add

    from collections import Counter

    per_producer = Counter()
    per_region = Counter()
    for item in log:
        per_producer[item["eip_rva"]] += 1
        per_region[item["page"]] += 1
    focus = {
        "total_image_writes": len(log),
        "top_producers": [
            {"rva": hex(r), "writes": n} for r, n in per_producer.most_common(30)
        ],
        "top_pages": [
            {"page": hex(p), "writes": n} for p, n in per_region.most_common(40)
        ],
    }
    OUT.write_text(json.dumps(focus, indent=2), encoding="utf-8")
    print(json.dumps(focus, indent=2))
    return code


if __name__ == "__main__":
    sys.exit(main())
