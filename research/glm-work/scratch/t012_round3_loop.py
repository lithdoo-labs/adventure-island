import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import maple079_probe_cfg as probe  # noqa: E402

probe.blob = probe.WINDOW.read_bytes()
probe.END = probe.BASE + len(probe.blob)
probe.STRINGS = probe.strings()

print("== 0x85940B-0x8594E0 (loop continuation) ==")
eip = 0x85940B
while eip < 0x8594E0:
    insn = probe.one(eip)
    if insn is None:
        break
    com = probe.slot_comment(insn)
    print(f"{insn.address:#010x}  {insn.bytes.hex():18} {insn.mnemonic:<10} {insn.op_str}  {com}")
    if insn.mnemonic == "ret":
        break
    eip = insn.address + insn.size

print()
print("== search 'mov ebx, [edi+eax]' / lodsd / reads feeding the store ==")
for pat, name in ((b"\x8b\x1c\x07", "mov ebx,[edi+eax]"), (b"\xad", "lodsd"), (b"\x8b\x1f", "mov ebx,[edi]")):
    off = 0
    hits = []
    while True:
        i = probe.blob.find(pat, off, 0x85A530 - probe.BASE)
        if i < 0:
            break
        hits.append(probe.BASE + i)
        off = i + 1
    print(f"  {name}: {[hex(h) for h in hits[:12]]}")
