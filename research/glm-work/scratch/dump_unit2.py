import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import maple079_probe_cfg as m  # noqa: E402

m.blob = m.WINDOW.read_bytes()
m.END = m.BASE + len(m.blob)
m.STRINGS = m.strings()

for start, stop in ((0x859D45, 0x859DA0), (0x85A2A1, 0x85A2C0), (0x85A308, 0x85A370)):
    print(f"===== {start:#x} =====")
    eip = start
    while eip < stop:
        insn = m.one(eip)
        if insn is None:
            break
        com = m.slot_comment(insn)
        print(f"{insn.address:#010x}  {insn.bytes.hex():18} {insn.mnemonic:<8} {insn.op_str}  {com}")
        eip = insn.address + insn.size
    print()
