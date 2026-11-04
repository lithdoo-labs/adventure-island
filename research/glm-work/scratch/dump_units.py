import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import maple079_probe_cfg as m  # noqa: E402

m.blob = m.WINDOW.read_bytes()
m.END = m.BASE + len(m.blob)
m.STRINGS = m.strings()

for start, length in ((0x859EBE, 0x70), (0x85A1E0, 0x60), (0x85A2FC, 0x30)):
    print(f"===== {start:#x} =====")
    eip = start
    while eip < start + length:
        insn = m.one(eip)
        if insn is None:
            break
        com = m.slot_comment(insn)
        print(f"{insn.address:#010x}  {insn.bytes.hex():16} {insn.mnemonic:<8} {insn.op_str}  {com}")
        if insn.mnemonic == "ret":
            break
        eip = insn.address + insn.size
    print()
