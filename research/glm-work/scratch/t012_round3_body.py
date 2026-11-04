import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import maple079_probe_cfg as probe  # noqa: E402

probe.blob = probe.WINDOW.read_bytes()
probe.END = probe.BASE + len(probe.blob)

eip = 0x8593A1
print("== round-3 loop body from 0x8593A1 (aligned at jne target) ==")
while eip <= 0x8593E9:
    insn = probe.one(eip)
    if insn is None:
        break
    com = probe.slot_comment(insn)
    print(f"{insn.address:#010x}  {insn.bytes.hex():18} {insn.mnemonic:<10} {insn.op_str}  {com}")
    eip = insn.address + insn.size
