import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import maple079_probe_cfg as probe  # noqa: E402
import maple079_resolver_dict as rd  # noqa: E402

img = rd.build_image()
BASE = rd.MEM_BASE + rd.IMG_OFF  # VA of img[0] (RVA 0x819000)
md = probe.md

for rva in (0x829216, 0x829B51, 0xC29216 - 0x400000):
    pass

print("== RVA 0x829200-0x829240 ==")
eip = 0x829200
while eip < 0x829240:
    insn = list(md.disasm(img[eip - 0x819000 : eip - 0x819000 + 16], 0x400000 + eip, count=1))
    if not insn:
        eip += 1
        continue
    i = insn[0]
    print(f"{i.address:#010x}  {i.bytes.hex():18} {i.mnemonic:<10} {i.op_str}")
    eip = i.address + i.size - 0x400000

print("== RVA 0x829B40-0x829B60 ==")
eip = 0x829B40
while eip < 0x829B60:
    insn = list(md.disasm(img[eip - 0x819000 : eip - 0x819000 + 16], 0x400000 + eip, count=1))
    if not insn:
        eip += 1
        continue
    i = insn[0]
    print(f"{i.address:#010x}  {i.bytes.hex():18} {i.mnemonic:<10} {i.op_str}")
    eip = i.address + i.size - 0x400000
