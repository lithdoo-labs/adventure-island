import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import maple079_probe_cfg as probe  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
r1 = (ROOT / ".work" / "task-009" / "round-1-post.bin").read_bytes()
BASE = 0x81CEB5
md = probe.md

print("== helper 0x81CEC7 - 0x81CF30 (round-1 image) ==")
eip = 0x81CEC7
while eip < 0x81CF30:
    out = list(md.disasm(r1[eip - BASE : eip - BASE + 16], eip, count=1))
    if not out:
        print(f"{eip:#x} <undecodable>")
        eip += 1
        continue
    i = out[0]
    print(f"{i.address:#010x}  {i.bytes.hex():18} {i.mnemonic:<10} {i.op_str}")
    eip += i.size
