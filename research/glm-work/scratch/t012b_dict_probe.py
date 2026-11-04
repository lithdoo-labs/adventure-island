"""Extract known wrapper call-site immediates and test the descriptor ->
checksum hypotheses against names whose resolutions were observed
(LoadLibraryA, GetLocalTime, MessageBoxExA).
"""
from __future__ import annotations

import sys
from pathlib import Path

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE / "scripts"))
import maple079_probe_cfg as probe  # noqa: E402

probe.blob = probe.WINDOW.read_bytes()
probe.END = probe.BASE + len(probe.blob)
md = probe.md

DELTA = 0xF93D9014


def checksum(name: str) -> int:
    """Literal simulation of the walker mix loop at 0x0081D14C-0x0081D186."""
    data = name.encode("ascii") + b"\x00"
    ecx = 0xFFFFFFFF
    edx = 0xFFFFFFFF
    for b in data:
        eax = 0
        ebx = 0
        al = (b ^ (ecx & 0xFF)) & 0xFF
        # ecx:edx byte chain: cl<-ch, ch<-dl, dl<-dh (dh reused as counter)
        ecx = ((ecx >> 8) & 0xFFFF) | ((edx & 0xFF) << 8)
        edx = (edx >> 8) & 0x00FFFFFF
        S = al  # ebx<<16|eax, ebx=0
        for _ in range(8):
            out = S & 1
            S >>= 1
            if out:
                S ^= 0x54495041
        ecx ^= S & 0xFFFF
        edx ^= (S >> 16) & 0xFFFF
    ecx = (~ecx) & 0xFFFFFFFF
    edx = (~edx) & 0xFFFFFFFF
    # final: eax = edx; rol 16; ax = cx  => word-swapped 32-bit complement
    return ((edx & 0xFFFF) << 16) | (ecx & 0xFFFF)


def chain_edx(v: int) -> int:
    """0x00821BB: edi=v; +1; ^0x20921D3D; ~; -0x925774A6 -> edx."""
    edi = (v + 1) & 0xFFFFFFFF
    edi ^= 0x20921D3D
    edi = (~edi) & 0xFFFFFFFF
    edi = (edi - 0x925774A6) & 0xFFFFFFFF
    return edi


print("checksums of known names:")
for n in ("LoadLibraryA", "GetLocalTime", "MessageBoxExA", "GetProcAddress", "CreateFileA"):
    print(f"  {n:>16}: {checksum(n):#010x}")

print("\nsites: find `push imm32; jmp 0x821750` in 0x857E40-0x860000")
sites = []
for off in range(0x857E40 - probe.BASE, 0x860000 - probe.BASE - 10):
    if probe.blob[off] == 0x68:
        rel = int.from_bytes(probe.blob[off + 6 : off + 10], "little", signed=False)
        if probe.blob[off + 5] == 0xE9:
            target = (probe.BASE + off + 10 + ((rel ^ 0x80000000) - 0x80000000 if rel >= 0x80000000 else rel)) & 0xFFFFFFFF
            if target == 0x821750:
                imm = int.from_bytes(probe.blob[off + 1 : off + 5], "little")
                sites.append((probe.BASE + off, imm))
for site, imm in sites:
    cursor = (imm + DELTA) & 0xFFFFFFFF
    print(f"  site {site:#x}: imm {imm:#010x} -> cursor {cursor:#x}")
    if probe.BASE <= cursor < probe.END - 8:
        d = probe.blob[cursor - probe.BASE : cursor - probe.BASE + 8]
        print(f"    descriptor bytes: {d.hex()}")
        v = int.from_bytes(d[:4], "little")
        print(f"    dword0 {v:#010x}  chain_edx {chain_edx(v):#010x}")
