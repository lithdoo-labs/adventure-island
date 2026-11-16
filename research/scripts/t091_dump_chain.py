"""T091: produce the byte-anchored disassembly evidence dump for the decisive
focus-object chain (W ctor / P factory / QI / getters / installers / callers).
Output: research/result/stage-readiness/forensics/T091-FOCUS-CHAIN-DISASM.txt
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from t091_lib import (EXE_SHA, disasm, fmt, prev_pushes, read)  # noqa: E402

OUT = Path(__file__).resolve().parents[1] / "result/stage-readiness/forensics/T091-FOCUS-CHAIN-DISASM.txt"

SECTIONS = [
    ("A. packet opcode 0xCE dispatcher arm (0x97FAC9 band 0xBC..0xCE; arm at 0x97FB7A)",
     0x97FB70, 0x18),
    ("A2. opcode-0xCE handler 0x99142A: 4x 0x4066FF decode -> user vt+0x7C (0x948DE7)",
     0x99142A, 0x48),
    ("B. W creator 0x948DE7 (user vtable 0xB0BCE8 slot +0x7C): enumerate [user+0x1C24], get camera via [user+0xEC8]->vt+0xD4 (0x4423C0), call W ctor",
     0x948DE7, 0x68),
    ("C. W allocation 0x94B8F7 -> 0x48 bytes; ctor body 0x94B92D installs vtable 0xB0BC40 (+0) / 0xB0BC64 (+4) FINAL; sub-object 0x9C at +0x20 (ctor 0x692A82)",
     0x94B944, 0x30),
    ("C2. 0x94B9A5-0x94B9B1: final vtable install (mov [edi],0xB0BC64; mov [esi],0xB0BC40)",
     0x94B993, 0x20),
    ("D. W initializing ctor 0x5BFE8C: +0x44=arg1(string-id) +0x10=arg2(user) +0x24/+0x2C=arg4(X) +0x28/+0x30=arg5(Y); P factory 0x9C2911; owner 0x9BC602(P,W); P init call [P-vt+4]=0x9BC622(P,1,X+-1,Y-0x14,0,0,P); QI-attach 0x5C1A08 at &W+0x14; renderer [0xBE2788] attach 0x427EB3; W+0x18 install 0x429919; finalize 0x5C0084",
     0x5BFE8C, 0x90),
    ("D2. ctor tail 0x5BFEDF-0x5BFF18: P factory result / 0x9BC602(P,W) / x+-1 & y-0x14 args / 0x5C1A08 QI attach at &[ebx+0x14]",
     0x5BFEDF, 0x3C),
    ("E. QI-attach 0x5C1A08: eax=[src]; ecx=[eax+0xC] (iface2 vtable 0xB0C5B0); push out; eax+=0xC; push IID 0xBA0500; call [ecx] (QI 0x9C0EC0); store into &W+0x14",
     0x5C1A08, 0x48),
    ("F. P factory 0x9C2911 (alloc 0x240 via [0xBE1DE0]) + ctor 0x9C28BF (base 0x9BC2EB; vtables 0xB0C660/0xB0C5B0; zeroes +0x238)",
     0x9C2911, 0x30),
    ("F2. P ctor body 0x9C28BF",
     0x9C28BF, 0x22),
    ("G. QI 0x9C0EC0 on iface2 (vtable 0xB0C5B0 slot+0): accepts IIDs {0xB0E760,0xBD37B0,0xBA0378,0xBA0500}; returns self ([ebp+8]) with AddRef",
     0x9C0EC0, 0x80),
    ("H. GetX 0x9C0FEF / GetY 0x9C105F (vtable 0xB0C5B0 slots +0x20/+0x28): forward to slot+0x8C",
     0x9C0FEF, 0x48),
    ("H2. GetY 0x9C105F",
     0x9C105F, 0x48),
    ("I. slot+0x8C resolver 0x9C1499: [iface+0x10] (=[P+0x1C] delegate) NULL -> extrapolation path; reads [0xBE2788]/[0xBDD89C]; k = elapsed * [0xB0C5A8]=1/30; dec(P+0x20/P+0x80 pairs) via 0x548806; round +-0.5 ([0xAFEC20]/[0xB00D60]); out X/Y",
     0x9C1499, 0x50),
    ("I2. extrapolation math 0x9C152B-0x9C15E6",
     0x9C1529, 0xC0),
    ("J. P position init 0x9BC622 (vtable 0xB0C660 slot+4; W-ctor calls it): clamps to [P+0x138..0x140] (map bounds block copied from [[0xBDD498]+0x24] by 0x9BC602); encrypts x->P+0x20, y->P+0x38, arg4->P+0x50, arg5->P+0x68 via 0x6131F4; owner (arg6) -> [P+0x110]/[P+0x114]; copies owner raw [o+0x1C]/[o+0x20] -> [P+0x130]/[P+0x134]; mirrors P+0x20.. -> P+0x80.. (rep movsd)",
     0x9BC622, 0x60),
    ("J2. encrypt + mirror region 0x9BC676-0x9BC749",
     0x9BC676, 0xD8),
    ("K. owner/back-ptr setter 0x9BC602: [P+0x14] = arg1 (W); copies [[0xBDD498]+0x24] 16 bytes -> P+0x138",
     0x9BC602, 0x20),
    ("L. Set path (vtable 0xB0C5B0 slot+0x90 = 0x9C16DD -> slot+0x40 = 0x9C1113): writes target slots P+0x80/P+0x98 (+checksums) encrypted; vtable 0xB0C660 also exposes the family via derived tables 0xB0C760/0xB0C870/0xB0C970/0xB0CA70 (stride 0x110) whose slot+4 forwarders write +0x238/+0x23C/+0x254/+0x258",
     0x9C1113, 0x50),
    ("L2. slot+0x90 thunk 0x9C16DD",
     0x9C16DD, 0x14),
    ("L3. +0x238 setter family 0x9C3DAD (calls 0x9BC602 then writes [esi+0x238]/[esi+0x23C])",
     0x9C3DAD, 0x22),
    ("M. W focus methods: 0x5C0349 outer (reads [[W+0x14] vt+0x8C] -> W+0x24/+0x28; saves old into +0x2C/+0x30; gate [P+0x238]!=0; branch by user-vt+0xC; calls 0x5C02CB/0x5C0327 with ecx=W)",
     0x5C0349, 0xC0),
    ("M2. branch tail 0x5C0410-0x5C0435",
     0x5C0410, 0x28),
    ("M3. W method 0x5C0327 (direct focus): 0x769B51([0xBD8FEC],[W+0x44]) -> 0x93CB27(this=[W+0x10], record, 0x320, W)",
     0x5C0327, 0x22),
    ("M4. W method 0x5C02CB (via 0x9573A6): 0x9573A6(this=[W+0x10], ...arg7=W)",
     0x5C02CB, 0x58),
    ("N. consumer 0x93839F context: user+0x1C30 -> [X+4] = W receiver; runs 0x5C0349; on success 0x94B4AC(&local, X) into [user+0x1C24]",
     0x93835F, 0x60),
    ("O. installer of user+0x1C24..0x1C30 group: 0x5D5377 (+0x1C24=a1..+0x1C30=a4, copy-ctor +0x1C34)",
     0x5D5377, 0x50),
    ("O2. scene handler 0x5EBAB1 (vtable 0xB02FB8 slot+0x20) installs arg4=[obj9C+0x68] into user+0x1C30 via 0x5D5377",
     0x5EBB36, 0x18),
    ("O3. branch B install 0x5EBBFD-0x5EBC0C: arg4 = [ebp-0x14] = [esi+0x9C]->+0x68",
     0x5EBBD5, 0x40),
    ("P. W vtable 0xB0BC40 dump (slots +0..+0x2C) and 0xB0BC64 (+0..+0x24); W vt+0x10/+0x14 = &W+0x24/&W+0x2C; vt+0x18 reads [P+0x134]",
     0xB0BC40, 0x30),
    ("P2. 0x94B9E9/0x94B9ED/0x94B9F1 (slot accessors)",
     0x94B9E9, 0x20),
    ("Q. focus writer 0x93CB27: getter 0x93CD77 ([ecx+0x14]) + X/Y getters 0x404B07/0x404B2E + Set 0x93CC9B (re-anchored this round)",
     0x93CC15, 0x30),
    ("Q2. anchor bytes at the Set call",
     0x93CC9B, 0x10),
    ("R. 0x9573A6 head + the 0x959493 window (arg3=[ebp+0x20]=arg7)",
     0x9573A6, 0x30),
    ("R2. 0x959482 window",
     0x959482, 0x18),
    ("R3. 0x9573A6 reads W vt+0x10 (=&W+0x24) gated on tag 0xD7511E (2 sites)",
     0x958540, 0x40),
    ("S. user ctor 0x9343EF zeroes +0xF24/+0xF28 (the fill-path container slot; ctor arg1 -> +0xF2C) + pet[3] at +0x1BB4 + the +0x1C24 group region",
     0x93443D, 0x50),
]

lines = []
lines.append("T091 FOCUS-OBJECT CHAIN — byte-anchored disassembly (capstone, EXE sha " + EXE_SHA[:16] + "…)")
lines.append("STATIC-ONLY. All addresses VA (base 0x400000). Generated by research/scripts/t091_dump_chain.py.")
lines.append("")
for title, va, n in SECTIONS:
    lines.append("=" * 100)
    lines.append("== " + title)
    lines.append("=" * 100)
    for ins in disasm(va, n):
        raw = " ".join(f"{b:02x}" for b in read(ins.address, ins.size))
        lines.append(f"{ins.address:08X}  {raw:<20}  {ins.mnemonic} {ins.op_str}")
    lines.append("")

while lines and not lines[-1]:
    lines.pop()
OUT.write_text("\n".join(l.rstrip() for l in lines) + "\n", encoding="utf-8")
print(f"wrote {OUT} ({len(lines)} lines)")
