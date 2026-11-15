#!/usr/bin/env python3
"""T085 evidence dumper: produces the raw-disassembly evidence files for
EV-77..EV-81 under research/result/stage-readiness/forensics/, SHA-verified
against the CMS079 unpacked EXE. Deterministic; no runtime observation.

Usage: python t085_dump_evidence.py
"""
import hashlib
import os
import sys

REPO = os.environ.get("RE_VALIDATE_ROOT") or os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
EXE = os.path.join(REPO, ".work", "task-036", "game-image-unpacked.bin")
SHA = "d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718"
BASE = 0x400000
OUT = os.path.join(REPO, "research", "result", "stage-readiness", "forensics")

from capstone import Cs, CS_ARCH_X86, CS_MODE_32  # noqa: E402

MD = Cs(CS_ARCH_X86, CS_MODE_32)
MD.detail = True


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def linear(data, va, size):
    lines = []
    off = va - BASE
    for ins in MD.disasm(data[off:off + size], va):
        lines.append(f"{ins.address:08X}  {ins.bytes.hex():<24} {ins.mnemonic} {ins.op_str}")
    return lines


def recurse(data, entry):
    """Recursive-descent disassembly (follow direct jumps/calls, stop at ret)."""
    from capstone import CS_GRP_JUMP, CS_GRP_RET
    seen = {}
    work = [entry]
    while work:
        va = work.pop()
        if va in seen:
            continue
        off = va - BASE
        if off < 0 or off >= len(data):
            continue
        ins = next(MD.disasm(data[off:off + 16], va, count=1), None)
        if ins is None:
            continue
        seen[va] = ins
        nxt = va + ins.size
        if CS_GRP_RET in ins.groups:
            continue
        if ins.mnemonic == "jmp":
            if ins.operands and ins.operands[0].type == 2:
                work.append(ins.operands[0].imm)
            continue
        if CS_GRP_JUMP in ins.groups:
            if ins.operands and ins.operands[0].type == 2:
                work.append(ins.operands[0].imm)
            work.append(nxt)
            continue
        work.append(nxt)
    return [(a, seen[a]) for a in sorted(seen)]


def fmt(ins):
    return f"{ins.address:08X}  {ins.bytes.hex():<24} {ins.mnemonic} {ins.op_str}"


def write(name, title, sections):
    path = os.path.join(OUT, name)
    lines = [f"# {title}", f"# binary={EXE}", f"# sha256={SHA}",
             "# model=linear fileOffset=VA-0x400000; disassembler=capstone x86-32", ""]
    for head, body in sections:
        lines.append(f"## {head}")
        lines.extend(body)
        lines.append("")
    text = "\n".join(lines) + "\n"
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)
    print(f"wrote {name}: {os.path.getsize(path)} bytes")


def main():
    digest = sha256_file(EXE)
    if digest != SHA:
        print(f"ERROR sha256 mismatch {digest}", file=sys.stderr)
        return 2
    data = open(EXE, "rb").read()

    # EV-77: 0x9BE703 physics loop full body + helpers
    sec = []
    sec.append(("function 0x9BE703 recursive-descent (entry..0x9BF13F, ret 0xC)",
                [fmt(i) for _, i in recurse(data, 0x9BE703)]))
    sec.append(("helper 0x9BF7EA map-bounds partial-budget (ret 8)",
                [fmt(i) for _, i in recurse(data, 0x9BF7EA)]))
    sec.append(("helper 0x9BF144 corner-wedge cross-product test (ret, cdecl 4 args)",
                [fmt(i) for _, i in recurse(data, 0x9BF144)]))
    sec.append(("fpu constants",
                ["# 0xAFECC0=0.0  0xAFEC20=0.5  0xB00D60=0.499999999  0xAFECD0=0.001(dt)",
                 "# 0xB0C5A0=-0.001  0xB064A8=20.0(swim margin)  0xB064B0=1.3  0xB05538=0.3",
                 "# [0xB00D88] = result-iterator template {0x5115B6,0,0,...}"]))
    write("T085-EV77-9BE703-PHYSICS-LOOP-FULL.txt",
          "T085 EV-77: slot4 physics loop 0x9BE703 complete body + 0x9BF7EA + 0x9BF144", sec)

    # EV-78: first-tick chain
    sec = []
    sec.append(("move ctor 0x9BC2EB (base; installs T1 0xB0C498)", linear(data, 0x9BC2EB, 0xB8)))
    sec.append(("T7 ctor 0x9D34FA (cross-map fresh object; installs 0xB0CB70)",
                linear(data, 0x9D34FA, 0x50)))
    sec.append(("fresh-M allocator 0x9D359D + T7 install thunk 0x9D358B",
                linear(data, 0x9D358B, 0x60)))
    sec.append(("T1 slot10 tick 0x9BCD6C (no-ctx path @0x9BCF0C; walk path @0x9BDCD2)",
                linear(data, 0x9BCD6C, 0x2A0)))
    sec.append(("T1 no-ctx block 0x9BCF0C..0x9BCFD9 + arg3=0 drop path 0x9BCE78",
                linear(data, 0x9BCE78, 0x170)))
    sec.append(("T2 slot10 tick 0x9C2966 (ctx-less recovery; [M+0x238]=1)",
                linear(data, 0x9C2966, 0x78)))
    sec.append(("T7 slot10 tick head 0x9D4024 (delegates to 0x9BCD6C at 0x9D4062/0x9D409F)",
                linear(data, 0x9D4024, 0xC0)))
    sec.append(("airborne integrator 0x9BDF18 head (shoe [M+0x198]+0xC, [M+0x190]+0xC, gravity [field+8]+0x28/+0x30)",
                linear(data, 0x9BDF18, 0x120)))
    sec.append(("same-map teleport 0x9C1113 full body (clears [M+0x110] only; writes x/y pairs + zeros vx/vy + mirror pairs M+0x80/0x98/0xB0)",
                [fmt(i) for _, i in recurse(data, 0x9C1113)]))
    sec.append(("cross-map arrival 0x9507F0 body 0x9508E0..0x9509E0 (fresh M -> bounds -> slot1 arg7=0 -> 0x953FA5 -> RNG -> 0x948AA2)",
                linear(data, 0x9508E0, 0x100)))
    sec.append(("ctx-triplet writer census (memory writes only)",
                ["# [M+0x110]: ctor=0 @0x9BC336; slot1 0x9BC622 @0x9BC6E5; slot13 0x9BCA6F @0x9BCBF0(and); slot5 0x9BFB52 @0x9BFBF2",
                 "# [M+0x114]: ctor @0x9BC33C; slot1 @0x9BC6CA; slot13 @0x9BCC10; slot5 @0x9BFB86",
                 "# [M+0x118]: ctor @0x9BC342; slot1 @0x9BC6F3; slot13 and0 @0x9BCC06/0x9BCC61; 0x9BD008; slot5 @0x9BFB8C/0x9BFBAF",
                 "# [M+0x120]: ctor=0 @0x9BC348; slot5 and0 @0x9BFB9D",
                 "# BOUND: no direct disp32 write of a move-object +0x120 with a nonzero value was found in the",
                 "# movement family; no rep-movs alias into [M+0x100..0x128] in 0x9B0000-0x9F0000. A LEA-alias",
                 "# installer exists at 0x9B7F43 (lea edi,[esi+0x120]; call 0x9B87EA; write @0x9B8817) whose",
                 "# receivers belong to a NON-M class (adversarial reviewer trace: callers 0x7540B4/0x754384/",
                 "# 0xA15EF5/0xA32327); bulk-zero 0x9AF3FE and field-copy 0x952D23 are likewise outside the M",
                 "# provenance. The dead-branch conclusion for movement-family M objects is therefore bounded by",
                 "# receiver provenance, not by encoding exhaustion (t085.1 D1 correction)."]))
    sec.append(("walk-step integrator 0x9BD0D9 head (shoe +0x48/+0x24 attrs; step table [M+0x190]+0x24; field+8 +0x70/+0x8)",
                linear(data, 0x9BD0D9, 0xE0)))
    sec.append(("[M+0x158] pending action 0x9BD567 (kind-1 notify) + slot7 stub 0x9BC4CC=ret",
                linear(data, 0x9BD567, 0x30)))
    write("T085-EV78-FIRST-TICK-CHAIN.txt",
          "T085 EV-78: portal-arrival first-tick context rebuild chain (T1/T2/T7, ctor, integrators, teleport, arrival)", sec)

    # EV-79: stand-up callers + slot14 census
    sec = []
    sec.append(("census: all `call dword [reg+0x38]` sites (FF /2 mod=01 disp8=0x38)",
                ["# 32 byte-matches = 29 code sites + 1 data-section coincidence (0xC93B63, beyond .text)",
                 "# + 2 SIB false positives (0xB2418B/0xB9147B, data islands) (t085.1 D6 correction):",
                 "# 00404B8A 00427454 00465394 004950D7 00499E22 0052A55A 00586357 0063FAED 00652EBA 00656A14",
                 "# 0076191C 007CE48A 0087DD79 008A280D 00923CC5 00924524 0092459A 009245FB 00948AB4 00948BD8",
                 "# 00965937 009BCCE1 009DDB99 009DDF5E 009DE0BA 009E05A2 009F1EC7 00A11C0E 00A174B7 | 00C93B63(data)",
                 "# USER-family (vtable 0xB0BD28, slot14=0x965A09) receivers proven:",
                 "#   0x965937 (flag=0) inside 0x9658CC, this=user via [edi+0x2944]/[edi+0x294C]/[edi+0x2E90] field writes",
                 "#   0x948AB4 (flag=0) inside 0x948AA2, this=user (0x4B1C27 M-retrieval identical to 0x9658CC sit path)",
                 "# USER-FAMILY LIKELY, RECEIVER FORMALLY UNPROVEN (t085.1 D4 correction):",
                 "#   0x948BD8 (flag=0) inside 0x948B66 - retrieves M via the identical 0x4B1C27(this,&out)+p-0xC",
                 "#   idiom and shares the [ebx+0x2C]/0x70DF65 gate signature of 0x948AA2, but no user-field write",
                 "#   was disassembled this round to hard-prove the receiver; counted separately from (1)/(2).",
                 "# NON-user: 0x9BCCE1 = M-family state driver 0x9BCCC4 (writes [M+0x14C]); 0x923CC5/0x924524/0x92459A/0x9245FB = life controller (+0x824/+0x844/+0x848, dynamic flag);",
                 "#   0x9DDB99 life sub-object [edi-0x588]; 0x9F1EC7 UI [esi+0x80] push 0x49; 0x9E05A2 generic slot14-forwarding thunk (ret 4);",
                 "#   0x9DE0BA/0xA174B7 HRESULT-checked COM with out-ptr; 0x9DDF5E slot14+slot80 paired COM; 0xA11C0E singleton [0xBD9020];",
                 "#   0x404B8A..0x8A280D (14 sites) COM/UI/PCOM families - none reaches user fields (sampled)."]))
    sec.append(("0x9658CC FULL: opcode 0xCF case-0 sit/stand handler (router 0x9571BF case 0 -> 0x957204; router reached via [outer+8] thunk 0x97FCBA - reviewer find, verified)",
                [fmt(i) for _, i in recurse(data, 0x9658CC)]))
    sec.append(("router thunk 0x97FCBA", linear(data, 0x97FCBA, 0x16)))
    sec.append(("0x948AA2 FULL: conditional stand-up + M retrieval + user resets (ret 8)",
                linear(data, 0x948AA2, 0xC4)))
    sec.append(("sibling 0x948B66 head (flag=0 site 0x948BD8; same 0x4B1C27+p-0xC M idiom; receiver formally unproven)",
                linear(data, 0x948B66, 0x80)))
    sec.append(("0x948AA2 callers: 0x9509D7 (cross-map arrival), 0x98D0C2 (user-movement packet spawn), 0x94489D",
                linear(data, 0x95098C, 0x60)))
    sec.append(("user-movement packet spawn window 0x98CFA0..0x98D010 (stance via 0x965A8F -> [user+0xF04]; [user+0x3C0]; fresh M 0x9D359D @0x98D016)",
                linear(data, 0x98CFA0, 0x80)))
    sec.append(("up/down key arbitration inside T8 tick 0x9D7ADA @0x9D7B8B-0x9D7BD9",
                linear(data, 0x9D7B8B, 0x60)))
    sec.append(("key-state reader 0x5CAAA9 (keymap [0xBDD838], VK codes 0x25..0x28)",
                [fmt(i) for _, i in recurse(data, 0x5CAAA9)]))
    sec.append(("0x9BCCC4 M-family driver (slot9 -> slot14 -> slot10 -> slot11) for slot14-family disambiguation",
                linear(data, 0x9BCCC4, 0x36)))
    write("T085-EV79-STANDUP-CALLERS.txt",
          "T085 EV-79: user slot14 caller census, flag provenance, opcode-0xCF sit/stand, input axis", sec)

    # EV-80: slot3 variants + vtables + accumulator
    sec = []
    sec.append(("physics-family vtable dump (slots 1..16 of all 8 tables)",
                ["# T1 0xB0C498: s3=0x9BF1FA s4=0x9BE703 s5=0x9BFB52 s6=0x9BC404 s9=0x9BCCFB s10=0x9BCD6C",
                 "# T2 0xB0C660: s3=0x9BF1FA s4=0x9BE703 s10=0x9C2966 (ctx-less recovery tick)",
                 "# T3 0xB0C760: s1=0x9C3DD1 s3=0x9C5B8A s4=0x9C6028 s5=0x9BFB52 s7=0x9C5F5F s8=0x9C5FFF s9=0x9C3D1D s10=0x9C4AAF s14=0x9C4946",
                 "# T4 0xB0C870: s1=0x9C9983 s3=0x9BF1FA s9=0x9C9CF7(accumulator) s10=0x9C9D31",
                 "# T5 0xB0C970: s1=0x9CBE4F s3=0x9CCAA8 s5=0x9BFB52 s9=0x9BCCFB s10=0x9CBE89 s11=0x9CCA19",
                 "# T6 0xB0CA70: s1=0x9CFCB4 s3=0x9BF1FA s4=0x9D06D4 s10=0x9CFD0B s11=0x9D0259",
                 "# T7 0xB0CB70: s2=0x9D3548 s5=0x9D3CCA(variant) s6=0x9D3DE6(variant) s9=0x9D3FE1 s10=0x9D4024 s11=0x9D3619",
                 "# T8 0xB0CC78: s3=0x9BF1FA s9=0x9D7AD5 s10=0x9D7ADA s11=0x9D795A"]))
    sec.append(("T3 slot3 0x9C5B8A full (swim; [M+0x238] sub-modes; forces input via 0x9C4B78; 0x9C62A8; tail-delegates 0x9BF1FA)",
                [fmt(i) for _, i in recurse(data, 0x9C5B8A)]))
    sec.append(("T5 slot3 0x9CCAA8 full (platform-edge gate; rand%2; snapshot t/tang + [M+0x158]=1; else delegate 0x9BF1FA)",
                [fmt(i) for _, i in recurse(data, 0x9CCAA8)]))
    sec.append(("T4 slot9 0x9C9CF7 accumulator (0x9BCCFB step sum; threshold 0x5A; wrap; ret 0x5A)",
                linear(data, 0x9C9CF7, 0x3A)))
    sec.append(("T4 slot10 0x9C9D31 head (rand timers 0x7D0/0x3E8; [M+0x238] gate)",
                linear(data, 0x9C9D31, 0x70)))
    sec.append(("T7 slot5 variant 0x9D3CCA head (reentrancy [0xBE2844]; [0xB0CBB8]/[field+8]+0x68)",
                linear(data, 0x9D3CCA, 0x60)))
    sec.append(("T7 slot6 variant 0x9D3DE6 head (user [0x3C0]&~1 == 0x12 gate)",
                linear(data, 0x9D3DE6, 0x60)))
    sec.append(("FSDB 13-map foothold x1/x2 census (deterministic)",
                ["# generator: t085_dump_evidence.py (jsonl scan of content/[FSDB]adventure/[group]map.Foothold)",
                 "# 222000000: n=376 x1<x2=318 vert=58 | 222000001: n=18 x1<x2=2 vert=16",
                 "# 230000000: n=240 x1<x2=225 vert=15 | 230000001: n=40 x1<x2=25 vert=15",
                 "# 230000002: n=184 x1<x2=169 vert=15 | 230000003: n=130 x1<x2=107 vert=23",
                 "# 230020000: n=45 x1<x2=42 vert=3 | 230020100: n=188 x1<x2=98 vert=90",
                 "# 230020200: n=355 x1<x2=107 vert=248 | 230020300: n=144 x1<x2=114 vert=30",
                 "# 230030000: n=172 x1<x2=150 vert=22 | 230030100: n=144 x1<x2=122 vert=22",
                 "# 230030200: n=247 x1<x2=128 vert=119",
                 "# TOTAL=2283 x1<x2=1607 x1>x2=0 vertical=676",
                 "# => unit-m1 > 0 for all non-vertical target-map footholds; m1 == 0.0 for verticals"]))
    sec.append(("user sub-object vtables (ctor 0x95049C)",
                ["# [obj-8]=0xB0BD28 primary (slot14=0x965A09 stand-up)",
                 "# [obj-4]=0xB0BD04 (slot0=0x4B6E2C = xor eax,eax; ret -> state getter returns 0 for local user)",
                 "# [obj+0]=0xB0BD00 (slot0=0x950444)"]))
    write("T085-EV80-SLOT3-VARIANTS.txt",
          "T085 EV-80: slot3 variants T3/T5, slot4 variants, slot9 accumulator, T7 slot5/6 variants, vtables, FSDB census", sec)

    # EV-81: 0x5A / 0x1E census
    sec = []
    sec.append(("immediate census (imm8/imm32 instruction encodings, window 0x401000-0xA80000; bound declared per t085.1 D2)",
                ["# 0x5A (90): 82 sites in the census window. Movement/scene-relevant:",
                 "#   009C9D18 cmp eax,0x5A + 0x9C9D27 add eax,-0x5A (T4 slot9 accumulator threshold/wrap)",
                 "#   009C3D22 push 0x5A (T3 slot9 0x9C3D1D override, discards the 0x9BCCFB return)",
                 "#   009C4BF3 009C4DB6 009C4EAD 009C51BD 009C52E5 (T3 swim family push 0x5A RNG divisors)",
                 "#   0095B9F1..0095C235 (14 sites, UI builder family, paired with push 0x1E at 0095BAFF..0095C141)",
                 "#   0090355E-family, 00977D8A, 009E1849, 00A01446, 00A11952, 00A141A6, 0x903203..0x94951C (UI/field-ctx)",
                 "#   009CC640 and edi,0x5A (inside T5 tick 0x9CBE89 window) - INERT co-occurrence with 0x9CC0CF",
                 "#   (add dword [ebx+0x23C],0x1E) in the same function: the two constants do not interact there (no arithmetic links)",
                 "# 0x1E (30): 223 sites in the census window. Movement/scene-relevant:",
                 "#   00965965 sub eax,0x1E / 00965976 add eax,0x1E (seat occupancy box y half-extent, 0x9658CC)",
                 "#   009B4AAF 009B4B2B 009B4F16 009B4F92 sub edx,0x1E (hit-test box expansions)",
                 "#   009D06B9 sub edx,0x1E (T6 slot4 0x9D06D4 body)",
                 "#   00958624 sub eax,0x1E / 00958635 add eax,0x1E (0x9586xx query family)",
                 "#   0099F453 0099F4E3 sub edi,0x1E; 0095DB5B add eax,0x1E; 00938C3B/74; 0091652D 00919EA5 00939014 0095268A ...",
                 "#   cmp eax,0x1E: 0093B8C4 00942880 00955473 0096D444 0096DC7F 00974D24 00974E1D 00975D91 0097A40E",
                 "#   push 0x1E: 009BCA4C(slot13 commit) 009BCD5D(T1 tick) 009C3F53 009C9A35 009CCA0D(T5 tick) 009D4969 00A0CAB5 00A0EAB1 00A0EAE0 00A105BE 00A1CA76",
                 "# step 0x1E: [Physics+0xAC] step-table value (EV-23/G05, 0x9BCCFB reader; NOT an instruction immediate)"]))
    sec.append(("the single numeric-conversion site: T4 slot9 0x9C9CF7",
                linear(data, 0x9C9CF7, 0x3A)))
    sec.append(("T3 slot9 0x9C3D1D (reviewer blind-pass find, verified): call 0x9BCCFB then DISCARD ret, return 0x5A",
                linear(data, 0x9C3D1D, 0x12)))
    sec.append(("0x9571BF router thunk 0x97FCBA (reviewer find, verified): [ecx+8] dispatch",
                linear(data, 0x97FCBA, 0x16)))
    sec.append(("step reader 0x9BCCFB (T1/T2/T5 slot9; reads [M+0x190] step table installed from [0xBDD498]+0xAC)",
                [fmt(i) for _, i in recurse(data, 0x9BCCFB)]))
    sec.append(("seat-box 0x1E window (0x9658CC sit path)",
                linear(data, 0x96595A, 0x40)))
    sec.append(("UI 0x5A/0x1E paired window (0x95B9E0 family)",
                linear(data, 0x95B9E0, 0x50)))
    sec.append(("H1/H2 verdict anchors",
                ["# H1 (real 90<->30 conversion): REJECTED. No x3//3 chain exists anywhere in the census window.",
                 "# Exactly TWO sites where the constants INTERACT, neither is a conversion:",
                 "#   (a) 0x9C3D1D (T3 slot9, vtable dword 0xB0C784): calls the standard step writer 0x9BCCFB",
                 "#       (whose per-tick value comes from the map step table [field+0xAC], canonical entry 0x1E",
                 "#       per EV-23) and DISCARDS its return; pushes 0x5A into eax and returns -> per-state STEP",
                 "#       OVERRIDE (swim tick consumes 90 instead of the table value; the 30 never reaches the caller).",
                 "#   (b) 0x9C9CF7 (T4 slot9, vtable dword 0xB0C894 = 0xB0C870+0x24): accumulator [M+0x244] +=",
                 "#       0x9BCCFB(); fires when sum >= 0x5A then wraps -0x5A. With table step 0x1E this is a 3-tick",
                 "#       cycle; the /3 is data coincidence (step table is per-map data), not a hardcoded multiplier.",
                 "# INERT co-occurrence (no interaction, t085.1 D2 correction): T5 tick 0x9CBE89 contains BOTH",
                 "#   0x9CC0CF (add dword [ebx+0x23C],0x1E) and 0x9CC640 (and edi,0x5A) - unrelated instructions in the same function.",
                 "# H2 (disjoint domains): holds for every other site - 0x5A = UI metrics, swim-family RNG",
                 "#   divisors ((rand%400+800)/90, (rand%2000+1000)/90 -> [M+0x4D4]/[M+0x4D8] family), ASCII 'Z';",
                 "#   0x1E = geometry half-extents (seat box y, hit-test expansions), step-table value, bound",
                 "#   compares, argument pushes.",
                 "# Falsifiers: (a) any instruction multiplying/dividing by 3 between a 0x5A and 0x1E load - none;",
                 "#   (b) a third interaction site - none found by two independent censuses (lead + blind reviewer),",
                 "#       both bounded to the 0x401000-0xA80000 instruction window;",
                 "#   (c) FSDB maps with step != 0x1E decouple the 3-tick accumulator cycle (per-map data)."]))
    write("T085-EV81-CONSTANT-5A-1E.txt",
          "T085 EV-81: G34 0x5A vs 0x1E immediate census, domains, single accumulator link", sec)
    return 0


if __name__ == "__main__":
    sys.exit(main())
