import sys
from pathlib import Path
from collections import Counter

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import maple079_probe_cfg as probe  # noqa: E402
import maple079_post_probe_scan as t  # noqa: E402

raw = t.WINDOW.read_bytes()
dec = bytearray(raw)
t.decode(dec)
dec = bytes(dec)

probe.blob = dec
probe.END = probe.BASE + len(dec)


def read_cstr(rva: int, max_len: int = 80) -> str:
    off = rva - probe.BASE
    out = bytearray()
    while off < len(dec) and len(out) < max_len and dec[off] != 0:
        b = dec[off]
        out.append(b)
        off += 1
    return out.decode("latin1", errors="replace")


print("== bytes at referenced sites ==")
for rva in (0x85EE5A, 0x85F762, 0x85F76E, 0x85F787, 0x85F7AA, 0x85F9DA, 0x85FBFF, 0x85FC98):
    print(f"  {rva:#x}: {read_cstr(rva)!r}")

print("== gate writes in driver stage 0x85FCC0-0x862000 (decoded) ==")
cnt = Counter()
sites: dict[str, list[int]] = {}
for off in range(0x85FCC0 - probe.BASE, min(len(dec) - 7, 0x862000 - probe.BASE)):
    if dec[off] == 0xC6 and dec[off + 1] == 0x85:
        disp = int.from_bytes(dec[off + 2 : off + 6], "little")
        if probe.formed(disp) == probe.GATE_SLOT:
            val = dec[off + 6]
            ch = chr(val) if 32 <= val < 127 else f"0x{val:02x}"
            cnt[ch] += 1
            sites.setdefault(ch, []).append(probe.BASE + off)
for ch, n in cnt.most_common():
    print(f"  {ch!r} x{n}: {[hex(a) for a in sites[ch][:8]]}")

print("== disasm 0x860C60-0x860CC0 ==")
for insn in probe.md.disasm(dec[0x860C60 - probe.BASE : 0x860CC0 - probe.BASE], 0x860C60):
    com = probe.slot_comment(insn)
    print(f"  {insn.address:#x} {insn.mnemonic} {insn.op_str}  {com}")

print("== disasm 0x8610F0-0x861140 ==")
for insn in probe.md.disasm(dec[0x8610F0 - probe.BASE : 0x861140 - probe.BASE], 0x8610F0):
    com = probe.slot_comment(insn)
    print(f"  {insn.address:#x} {insn.mnemonic} {insn.op_str}  {com}")

print("== 0x85934B context (decoded) ==")
for insn in probe.md.disasm(dec[0x859330 - probe.BASE : 0x8593A0 - probe.BASE], 0x859330):
    print(f"  {insn.address:#x} {insn.bytes.hex():14} {insn.mnemonic} {insn.op_str}")

print("== 0x8602C0-0x860310 (decoded) ==")
for insn in probe.md.disasm(dec[0x8602C0 - probe.BASE : 0x860310 - probe.BASE], 0x8602C0):
    print(f"  {insn.address:#x} {insn.bytes.hex():14} {insn.mnemonic} {insn.op_str}")
