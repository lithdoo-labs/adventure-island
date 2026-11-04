"""Re-run the committed stage-2 replay and capture a WIDE Tail B memory
snapshot at the CreateFileA probe stop (0x00859757).

Reuses scripts/maple079_stage2_continue.py unmodified (read-only import).
The only addition: when the committed script performs its fixed probe-window
read (uc.mem_read(0x00C56000, 0xC000)), we also snapshot the whole Tail B
(0x00819000-0x00912000, 0xF9000 bytes) at that same instant.

Reproduction gate: the re-run probe-window.bin must be byte-identical to
.work/task-009/probe-window.bin before the wide capture is trusted.

No branch forcing, no API fabrication: the replay stops at CreateFileA with
the call unanswered, exactly as in Tasks 007-009.
"""
from __future__ import annotations

import hashlib
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

import maple079_stage2_continue as rep  # noqa: E402
from unicorn import Uc  # noqa: E402

IMAGE = 0x400000
PROBE_VA = IMAGE + 0x856000
PROBE_LEN = 0xC000
TAILB_VA = IMAGE + 0x819000
TAILB_LEN = 0xF9000

OUT_DIR = ROOT / "glm-work" / "scratch" / "replay"
WIDE = ROOT / "glm-work" / "scratch" / "tailb-wide-at-probe.bin"
REF = ROOT / ".work" / "task-009" / "probe-window.bin"


def main() -> int:
    exe = next((ROOT / ".work" / "task-001" / "extracted").rglob("MapleStory.exe"))
    kernel32 = Path(r"C:\Windows\SysWOW64\kernel32.dll")
    block = ROOT / ".work" / "task-006" / "tail-b-nonzero.bin"

    # sanity on inputs (same hashes the committed replay recorded)
    assert hashlib.sha256(exe.read_bytes()).hexdigest() == rep.EXPECTED if hasattr(rep, "EXPECTED") else True
    k32h = hashlib.sha256(kernel32.read_bytes()).hexdigest()
    if k32h != "bafd9e061964642802d62f1eb694e7e4af60de739a8df1a492f90006dc5680f3":
        raise SystemExit(f"kernel32 hash changed: {k32h}")
    blh = hashlib.sha256(block.read_bytes()[0x14:]).hexdigest()
    if blh != "5529577eec208295e36d61dc11aee42ebe45f7ffb511691f5679676b2330c865":
        raise SystemExit(f"block hash changed: {blh}")

    orig = Uc.mem_read
    captured: dict[str, bytes] = {}

    def patched(self, address, size=-1, *_):
        if address == PROBE_VA and size == PROBE_LEN and "wide" not in captured:
            captured["wide"] = bytes(orig(self, TAILB_VA, TAILB_LEN))
        return orig(self, address, size, *_)

    Uc.mem_read = patched
    sys.argv = [
        "maple079_stage2_continue.py",
        "--exe", str(exe),
        "--kernel32", str(kernel32),
        "--block", str(block),
        "--work-dir", str(OUT_DIR),
        "--json-out", str(OUT_DIR / "replay.json"),
    ]
    print("running committed replay (stops at unanswered CreateFileA)...")
    code = rep.main()
    Uc.mem_read = orig

    rerun = OUT_DIR / "probe-window.bin"
    if not rerun.exists():
        raise SystemExit("re-run produced no probe window")
    same = rerun.read_bytes() == REF.read_bytes()
    print("probe window reproduction:", "identical" if same else "DIFFERENT")
    if not same:
        raise SystemExit("replay did not reproduce; wide capture not trusted")

    wide = captured.get("wide")
    if wide is None:
        raise SystemExit("wide capture missed")
    WIDE.write_bytes(wide)
    print("wide Tail B capture:", hex(TAILB_VA), len(wide), "bytes ->", WIDE)
    return code


if __name__ == "__main__":
    sys.exit(main())
