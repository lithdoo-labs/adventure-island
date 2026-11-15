#!/usr/bin/env python3
"""T088 WP4 — camera bounds vs scene cull, [scene+0x1CC] installer search,
portal->camera ordering evidence (CMS079, STATIC-ONLY).

Outputs: forensics/T088-CAMERA-BOUNDS-SCENE-PORTAL.md

T088.1 CORRECTION (T088.1-WP2): the T088 release searched slot15-family
vtable installs inside the nine +0x1CC writer functions with

    re.finditer(rb".\\xb0\\x00\\x00", blob)   # then unpack 4 bytes at m.start()

That pattern requires byte2==0xB0 and byte3==byte4==0x00 of a 4-byte window,
then reads (any,0xB0,0x00,0x00) — it can never match the little-endian
encoding of a family-table address such as 0x00B01278 (78 12 B0 00: byte2 is
0x12), and the unpack also read one byte early. Every
"family-vtable-installs=[]" line in the T088 forensics was therefore produced
by a scanner that structurally could not fire (the nine-writer negative was
never actually executed by it). The scanner is replaced by an exact
instruction-boundary imm32 census:

  * for each of the 33 slot15-family table addresses T, every byte occurrence
    of pack('<I', T) in the code band is decoded at every candidate
    instruction start (p-8..p-1) with capstone; a hit counts only when the
    occurrence is an IMMEDIATE operand of a decoded instruction
    (INSTALL = C7 /0 imm->mem store; LOAD = B8+r reg<-imm; PUSH = 68);
    occurrences with no instruction-boundary decode are reported as data
    slices, not code;
  * positive control: the base table 0xB01278 must yield its four known
    imm32 installs (0x52F1BC, 0x52F1CF, 0xA0B39E, 0xA0BB2A) or the generator
    aborts — the old scanner could not detect any of them;
  * the direct +0x1CC writers are bounded by the t046 census-function
    method (E8 targets + prologues) with per-writer boundary provenance; the
    install negative is labelled per writer and is explicitly BOUNDED to the
    census window (census starts are a superset heuristic, not a disassembly
    proof of true function extent);
  * t088.1 census correction: the old +0x1CC probe compared capstone VAs
    against raw file offsets (always-true after +0x400000) and matched the
    substring "0x1cc" in ANY operand, so the field-copy writer 0x952ECE was
    swallowed by a bogus overlapping decode — the true direct-writer count
    is TEN (0x60088A, 0x67B139, 0x6D429C, 0x703819, 0x71FAA1, 0x79293F,
    0x793570, 0x7C939A, 0x952ECE, 0xA029BA), and the mov/lea (reads-excluded)
    total is 31, not 30.

Contents:
  1. camera-side clamp search: writers of the shared Vector2D checked for
     map-bounds clamping (negative result with scan boundary);
  2. [scene+0x1CC] direct-write census (disp32=0x1CC, encoding-complete,
     instruction-verified) + family imm32 install census + the nine-writer
     bounded negative + base-ctor/init-chain re-verification;
  3. slot15 cull-window re-derivation vs camera writes (the bounds live on
     the CONSUME side);
  4. portal-arrival ordering: the known static chain with edge typing
     (synchronous call / later tick / undetermined).

Binary identity: EXE sha256 d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718.
"""
import bisect
import hashlib
import io
import os
import re
import struct
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
from capstone import Cs, CS_ARCH_X86, CS_MODE_32
from capstone.x86 import X86_OP_MEM, X86_OP_IMM

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
EXE = os.path.join(REPO, ".work", "task-036", "game-image-unpacked.bin")
EXE_SHA = "d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718"
BASE = 0x400000
CODE_START, CODE_END = 0x1000, 0x7EA000
OUT = os.path.join(REPO, "research", "result", "stage-readiness", "forensics")
md = Cs(CS_ARCH_X86, CS_MODE_32)
md.detail = True

# t088.1: known-positive install sites of the base family table — the scanner
# must find ALL of these or abort (positive control against the T088 regex
# scanner that could find none of them).
BASE_TABLE = 0xB01278
BASE_TABLE_INSTALLS = (0x52F1BC, 0x52F1CF, 0xA0B39E, 0xA0BB2A)
INIT_HELPER = 0x52F37F


def function_census(img):
    """t046 method (same as t088_wp1): E8 targets + standard prologues."""
    functions = set()
    for i in range(CODE_START, CODE_END):
        if img[i:i + 3] == b"\x55\x8b\xec":
            functions.add(i)
        elif img[i:i + 5] == b"\x8b\xff\x55\x8b\xec":
            functions.add(i)
    for i in range(CODE_START, CODE_END - 5):
        if img[i] == 0xE8:
            rel = struct.unpack("<i", img[i + 1:i + 5])[0]
            tgt = i + 5 + rel
            if CODE_START <= tgt < CODE_END:
                functions.add(tgt)
    funcs = sorted(functions)

    def containing(off):
        i = bisect.bisect_right(funcs, off) - 1
        if i < 0:
            return None, None
        nxt = funcs[i + 1] if i + 1 < len(funcs) else None
        return funcs[i], nxt
    return funcs, containing


def family_tables(img):
    """33 slot15-family vtable starts: dword 0x53471A at start+0x3C."""
    fam = sorted(set(a - 0x3C for a in range(BASE_TABLE, 0xB02730, 4)
                     if struct.unpack("<I", img[a - BASE:a - BASE + 4])[0] == 0x53471A))
    return fam


def imm32_census(img, values):
    """Exact instruction-boundary census of imm32 occurrences of `values`.

    Returns {value: [ (insn_va, kind, 'mnemonic op_str') ]} where kind in
    {INSTALL, LOAD, PUSH, OTHER-IMM}. A byte occurrence counts only if some
    candidate decode (start p-8..p-1) yields an instruction whose IMMEDIATE
    operand equals the value; occurrences with no such decode are recorded
    with kind=DATA (no instruction boundary).
    """
    out = {v: [] for v in values}
    raw = img[CODE_START:CODE_END]
    for v in values:
        pat = re.escape(struct.pack("<I", v))
        for m in re.finditer(pat, raw):
            p = CODE_START + m.start()
            found = None
            for s in range(p - 8, p):
                for ins in md.disasm(raw[s - CODE_START:p + 8 - CODE_START], s + BASE):
                    if ins.address + len(ins.bytes) <= p + BASE:
                        continue
                    imm_ok = any(op.type == X86_OP_IMM and op.imm == v
                                 for op in ins.operands)
                    if imm_ok:
                        found = ins
                    break
                if found:
                    break
            if found is None:
                out[v].append((p + BASE, "DATA", "(no instruction-boundary decode)"))
                continue
            t = f"{found.mnemonic} {found.op_str}"
            if found.mnemonic == "mov" and "[" in found.op_str.split(",")[0]:
                kind = "INSTALL"
            elif found.mnemonic == "mov":
                kind = "LOAD"
            elif found.mnemonic == "push":
                kind = "PUSH"
            else:
                kind = "OTHER-IMM"
            out[v].append((found.address, kind, t))
    return out


def ref_1cc_census(img):
    """Instruction-verified census of every [mem + disp32 0x1CC] reference."""
    found = {}
    raw = img[CODE_START:CODE_END]
    for m in re.finditer(rb"\xcc\x01\x00\x00", raw):
        p = CODE_START + m.start()
        for s in range(p - 8, p):
            ok = None
            for ins in md.disasm(raw[s - CODE_START:p + 4 - CODE_START], s + BASE):
                if ins.address + len(ins.bytes) <= p + BASE:
                    continue
                if any(op.type == X86_OP_MEM and op.mem.disp == 0x1CC
                       for op in ins.operands):
                    ok = ins
                break
            if ok:
                found[ok.address] = f"{ok.mnemonic} {ok.op_str}"
                break
    return dict(sorted(found.items()))


def main():
    img = open(EXE, "rb").read()
    if hashlib.sha256(img).hexdigest() != EXE_SHA:
        raise SystemExit("sha mismatch")

    funcs, containing = function_census(img)

    L = []
    A = L.append
    A("# T088 WP4 — camera bounds / [scene+0x1CC] / portal ordering (STATIC-ONLY)")
    A(f"# binary=game-image-unpacked.bin sha256={EXE_SHA}")
    A("# generated by research/scripts/t088_wp4_scene_portal.py")
    A("# t088.1: §2 scanner rebuilt (instruction-boundary imm32 census with a")
    A("#   base-table positive control); see script header for the T088 regex defect.")
    A("")

    # ---- 1. slot15 cull window re-derivation ----
    A("## 1. Bounds live on the CONSUME side (slot15 cull window)")
    off = 0x53471A - BASE
    A("```")
    for i in md.disasm(img[off:off + 0x60], 0x53471A):
        A(f"{i.address:08X}  {i.bytes.hex():<20} {i.mnemonic} {i.op_str}")
    A("```")
    A("""
Cull window (T087 re-proof): X1 + (3 - X0) <= arg_x <= X1 + ([scene+0x1D0] - X0) + 5,
Y isomorphic with 5/5 margins, where X0/Y0 = camera Vector2D X/Y (via
0x48AEC3 + 0x404B07/0x404B2E) and X1/Y1 = [scene+0x1CC] member X/Y.
=> map/world bounds enter at the CULL/COMPARE side. No camera-side clamp is
involved in this window computation.
""")

    # ---- 2. [scene+0x1CC] census (instruction-verified) ----
    A("## 2. [scene+0x1CC] reference census (encoding-complete, instruction-verified)")
    refs = ref_1cc_census(img)
    lea = {a: t for a, t in refs.items() if t.startswith("lea ")}
    mov_read = {}
    mov_write = {}
    for a, t in refs.items():
        if not t.startswith("mov "):
            continue
        dst, _, src = t.partition(", ")
        if dst.startswith("mov dword ptr ["):
            mov_write[a] = t
        elif src.startswith("dword ptr ["):
            mov_read[a] = t
    A(f"distinct instructions with a MEM disp32 +0x1CC operand: {len(refs)}")
    A(f"  lea (address-taken)        : {len(lea)}")
    A(f"  mov dword ptr [..] <- reg  : {len(mov_write)}  (the direct writers)")
    A(f"  mov reg <- [..] (reads)    : {len(mov_read)}")
    A(f"  mov/lea excluding reads (T088 taxonomy): {len(lea) + len(mov_write)}")
    A("")
    A("t088.1 count reconciliation: the T088 forensics reported 'mov/lea subset:")
    A("30' with 9 direct writers, while the T088 report/EV-97 said '31 mov/lea")
    A("sites'. The instruction-verified truth under the same taxonomy (lea +")
    A(f"write-mov, reads excluded) is {len(lea) + len(mov_write)}: the committed T088 probe")
    A("mixed VA and file-offset in its window comparison and matched the string")
    A("'0x1cc' inside ANY operand, so the field-copy writer 0x952ECE (`mov")
    A("[ebx+0x1CC], eax`, copy loop over +0x1C8..+0x1DC pairs) was consumed by a")
    A("bogus overlapping decode and dropped. The direct-writer census is")
    A(f"THEREFORE {len(mov_write)} sites, not 9; the T088 report's '31 mov/lea' figure was")
    A("numerically correct while its own forensics list (30) was not.")
    A("")
    A("Direct writers (mov dword ptr [base + 0x1CC], src):")
    for a, t in mov_write.items():
        A(f"  {a:08X}  {t}")
    A("")

    # ---- 2b. family vtable imm32 install census + positive control ----
    A("### 2b. slot15-family imm32 install census (instruction-boundary, positive-controlled)")
    fam = family_tables(img)
    A(f"")
    A(f"slot15-family vtables: {len(fam)} tables, starts {fam[0]:#x}..{fam[-1]:#x}")
    census = imm32_census(img, fam)
    # positive control — must reproduce the known base-table installs
    base_hits = census[BASE_TABLE]
    got_installs = sorted(va for va, kind, _ in base_hits if kind == "INSTALL")
    expect = sorted(BASE_TABLE_INSTALLS)
    if got_installs != expect:
        raise SystemExit(
            f"POSITIVE CONTROL FAILED: base-table installs {list(map(hex, got_installs))} "
            f"!= expected {list(map(hex, expect))}")
    A("")
    A("POSITIVE CONTROL: base table 0xB01278 imm32 installs found at "
      + ", ".join(f"{v:#x}" for v in got_installs)
      + " — the T088 regex scanner found none of these (structurally blind).")
    A("")
    tables_with_refs = 0
    for v in fam:
        hits = census[v]
        if not hits:
            continue
        tables_with_refs += 1
        for va, kind, t in hits:
            A(f"  table {v:#x}: {va:08X} [{kind}] {t}")
    no_ref = [v for v in fam if not census[v]]
    A("")
    A(f"summary: {tables_with_refs}/{len(fam)} family tables have any code-band imm32")
    A(f"reference; the remaining {len(no_ref)} tables (all derived tables) have ZERO")
    A("byte occurrences of their address in the code band (not merely no instruction")
    A("decode — the bytes do not occur), so an imm32 install of a derived table")
    A("does not exist anywhere in the scanned band.")
    A("")

    # ---- 2c. base-table ctor / init chain ----
    A("### 2c. base-family install sites + shared init chain (re-verified)")
    A("```")
    for site in BASE_TABLE_INSTALLS:
        o = site - BASE
        dis = list(md.disasm(img[o:o + 0x28], site))
        edge = None
        for i in dis:
            if i.mnemonic in ("call", "jmp") and i.op_str == hex(INIT_HELPER):
                edge = i.mnemonic
                break
        tail = f" + {edge} 0x52F37F within window" if edge else ""
        A(f"# site {site:#x}{tail}")
        for i in dis:
            A(f"{i.address:08X}  {i.bytes.hex():<18} {i.mnemonic} {i.op_str}")
    A("```")
    A("")
    A("0x52F1BC is the vtable-stamping THUNK: `mov [ecx],0xB01278; jmp 0x52F37F`")
    A("(install then TAIL-CALL into the shared init); 0x52F1CF installs then")
    A("`call 0x52F37F`; 0xA0BB2A installs then `call 0x52F37F`; 0xA0B39E installs")
    A("the base table then a sibling embedded table 0xB0D3D4 (no init call in")
    A("the +0x28 window — its init, if any, is beyond the dump).")
    A("")
    A("Register-load sites (mov r32, 0xB01278) are ALSO base-family construction:")
    A("0x52EEF1 and 0x8DC052 immediately store the register into a stack object")
    A("slot ([ebp-0x3C]) and call the shared init helper 0x52F37F — an INDIRECT")
    A("(register-mediated) base-table install that the imm32 census classifies as")
    A("LOAD, plus an alias write `mov [ebp-0x3C], reg`. The init helper 0x52F37F")
    A("follows all four imm32 installs (2c above, call or tail-jmp) and both LOAD")
    A("sites — the base-family ctor chain is PARTIALLY LOCATED (T088-reviewer C7,")
    A("re-verified with the corrected scanner).")
    A("")

    # ---- 2d. the direct writers: bounded install negative ----
    A(f"### 2d. {len(mov_write)} direct +0x1CC writers — family-install negative (BOUNDED, boundary-robust)")
    A("```")
    fam_va_set = set()
    for v in fam:
        for va, kind, _ in census[v]:
            if kind == "INSTALL":
                fam_va_set.add(va)
    all_installs = sorted(fam_va_set)
    all_imm_sites = sorted(va for v in fam for va, _, _ in census[v])
    A(f"# family imm32 INSTALL instructions in the whole code band: "
      f"{[hex(a) for a in all_installs]}")
    A(f"# ALL family imm32 sites of any kind (install/load) in the whole band: "
      f"{[hex(a) for a in all_imm_sites]}")
    A("# (the imm32 census is exhaustive over .text: a containing function can")
    A("#  hold a family imm32 install IFF one of these VAs lies inside it)")

    def seh_anchor(w, back=0x4000):
        for i in range(w - BASE - 8, w - BASE - back, -1):
            if img[i] == 0xB8 and img[i + 5] == 0xE8:
                rel = struct.unpack("<i", img[i + 6:i + 10])[0]
                if i + 10 + rel + BASE == 0xA6FC7C:
                    return i + BASE
        return None

    def prev_prologue(w, back=0x4000):
        best = None
        for i in range(w - BASE - 8, w - BASE - back, -1):
            if img[i:i + 3] == b"\x55\x8b\xec" or img[i:i + 5] == b"\x8b\xff\x55\x8b\xec":
                best = i + BASE
                break
        return best

    verdicts = []
    for w in sorted(mov_write):
        f, nxt = containing(w - BASE)
        # conservative window: take the EARLIEST plausible start (census /
        # SEH ctor anchor / nearest preceding prologue) so that a false-late
        # census start cannot hide an install in the true function prefix
        cands = {"census": f + BASE if f is not None else None,
                 "seh-anchor": seh_anchor(w),
                 "prev-prologue": prev_prologue(w)}
        starts = {v for v in cands.values() if v is not None and v <= w}
        lo = min(starts) if starts else None
        hi = (nxt + BASE) if nxt is not None else (w + 0x2000)
        src = [k for k, v in cands.items() if v == lo]
        hits = [a for a in all_installs if lo is not None and lo <= a < hi]
        nearest = min(all_imm_sites, key=lambda a: abs(a - w))
        dist = abs(nearest - w)
        A(f"writer {w:#x} insn '{mov_write[w]}'")
        A(f"  candidate starts: {dict((k, hex(v) if v else None) for k, v in cands.items())}")
        A(f"  conservative window {hex(lo) if lo else 'UNRESOLVED'}..{hi:#x} "
          f"(start={'+'.join(sorted(src))}); installs in window: "
          f"{[hex(x) for x in hits] if hits else 'NONE'}")
        A(f"  whole-text corroboration: nearest family imm32 site of ANY kind is "
          f"{nearest:#x}, {dist:#x} bytes away")
        if hits:
            verdicts.append((w, "INSTALL-PRESENT"))
        elif lo is None:
            verdicts.append((w, "REPRODUCTION-INCOMPLETE"))
        else:
            verdicts.append((w, "CENSUS-FN-BOUNDED-NEGATIVE"))
    A("```")
    A("")
    A("t088.1-reviewer blind-phase notes adopted: the plain census can yield")
    A("FALSE-EARLY window starts (0x79240D for 0x79293F, 0x7C8BEB for 0x7C939A")
    A("are mid-instruction E8 targets; the reviewer's true earlier starts are")
    A("0x791FE9/0x7C8E9F) and 0x60088A's census start 0x6006AD decodes")
    A("mid-instruction (internal label, single caller 0x5FE6C0, no ret")
    A("between) — for that writer the conservative window falls back to the")
    A("nearest preceding prologue. (Note: the 0x4000-back SEH scan anchors")
    A("0x78FA4C/0x7C8E9F can sit in the ADJACENT function — earliest-start")
    A("conservatism accepts that; it only widens the scanned region, which")
    A("is safe for a negative claim.) Boundary-closure fact (reviewer")
    A("phase-2, lead-verified): between writer 0xA029BA's window end")
    A("(0xA02B82) and the nearest install 0xA0B39E lie 8 further genuine")
    A("prologues (first 0xA03F2D), 430 in-window E8 call targets, and the")
    A("install's own containing function — NO single function can span the")
    A("gap, so the negative does not rest on a size plausibility argument.")
    A("")
    A("Because the family imm32 census is exhaustive over the whole code")
    A("band, the per-writer negative does NOT hinge on any single boundary:")
    A("no boundary choice places a family install inside a +0x1CC writer's")
    A("function.")
    A("")
    A("Per-writer object identity note: each writer stores into [base+0x1CC] of")
    A("WHATEVER object its containing function holds in the base register — the")
    A(f"writers are in {len(mov_write)} DIFFERENT functions (2d above) and are")
    A("not pooled evidence about one class. 0x60088A stores into the object")
    A("returned by `call 0x61059F` (callee-allocated), 0x952ECE is one field of")
    A("a +0x1C8..+0x1DC pair-copy loop ([esi]->[ebx]), the rest store into")
    A("their function's this/parameter object — same-offset fields of")
    A("DIFFERENT classes must not be conflated. The negative is per-writer:")
    A("no writer's function (under ANY of the candidate boundaries) contains")
    A("a slot15-family imm32 install, i.e. no writer simultaneously constructs")
    A("the scene-class object it writes to.")
    A("")
    n_neg = sum(1 for _, v in verdicts if v == "CENSUS-FN-BOUNDED-NEGATIVE")
    A(f"verdict: {n_neg}/{len(mov_write)} writers CENSUS-FN-BOUNDED-NEGATIVE; "
      f"{sum(1 for _, v in verdicts if v == 'REPRODUCTION-INCOMPLETE')}/{len(mov_write)} REPRODUCTION-INCOMPLETE; "
      f"{sum(1 for _, v in verdicts if v == 'INSTALL-PRESENT')}/{len(mov_write)} INSTALL-PRESENT")
    A("")
    A("""BOUNDED NEGATIVE (t088.1 restatement of the t088-reviewer C7 correction):
none of the direct +0x1CC writers (t088.1: TEN sites — the T088 probe missed
0x952ECE) installs a slot15-family vtable via an imm32 store inside its
containing function, under every candidate boundary recorded in 2d
(census start / SEH ctor anchor / nearest preceding prologue — the window
takes the EARLIEST). The negative is BOUNDARY-ROBUST because the imm32
census is exhaustive over the code band: the complete set of family imm32
instructions is {4 installs + 2 loads}, and the barrier between the closest
pair (writer 0xA029BA's window end 0xA02B82 and install 0xA0B39E) contains
8 further genuine prologues, 430 in-window E8 call targets and the
install's own containing function — no single function can span it. SCAN BOUNDARY / what this negative does NOT cover
(audit note for SEH, thunks, tail calls, indirect construction and alias
writes):
  * function extent is heuristic (census E8 targets + prologues can produce
    false-late or mid-instruction starts — t088.1-reviewer demonstrated both:
    0x79240D/0x7C8BEB are false census starts, 0x6006AD decodes
    mid-instruction); the scan therefore takes the EARLIEST of the candidate
    starts (census / SEH ctor anchor / nearest preceding prologue) as a
    conservative window and additionally reports the whole-text distance to
    the nearest family imm32 site, making the negative robust to boundary
    error (see 2d);
  * INDIRECT installs are not excluded: a vtable pointer loaded from a data
    structure or computed at runtime (register-mediated stores such as the
    0x52EEF1/0x8DC052 stack-object pattern `mov [ebp-0x3C], reg` +
    `call 0x52F37F`) installs the BASE table without any imm32 store;
  * installs performed in CALLED functions (constructor helpers) or via SEH
    dispatch, tail-call thunks, or duplicate shared code paths are outside
    these windows;
  * the derived 32 family tables have no code-band imm32 occurrence at all,
    so their installation path is entirely non-imm32 (UNLOCATED, carried to
    T089 WP3), and [scene+0x1CC] target-object identity remains unproven.
The T087 observation stands: ctor 0x52429B installs an embedded vtable
0xB002C0 at ITS +0x1CC, but that class (primary 0xB01040) is not in the
33-table slot15 family.
""")

    # ---- 3. camera-side clamp negative scan ----
    A("## 3. Camera-side map-bounds clamp: negative scan over decoded writer bodies")
    A("""
Checked bodies (this round + T087, all fully disassembled):
  0x5CA91A funnel        - no compare against any field pair; constants only -400/-300
  0x5CB0E0              - clamp x[0,800] y[0,600] (SCREEN bounds, C-027; not map bounds)
  0x5CB573              - same screen clamp + equality-change gate
  0x9E6CA4 callback     - gates G1-G5 (window identity/IsWindow/rect/IsRectEmpty/PtInRect);
                          NO distance or map-coordinate compare
  0x9F1784 mouse band   - gate [singleton+0xC]==0 only; unpacks lParam; no clamp
  0x93CB27 focus writer - tag/count gates; Set(X(src), Y(src)); no clamp
  Shape2D 0x5140828F    - immediate store / interp record; no clamp inside Set
Scan boundary: the fully-decoded bodies above. The 25 INCONCLUSIVE census
sites (T088-DIRECT-SLOT90-WRITER-CLASSIFICATION.csv) have NOT each been
disassembled end-to-end, so a clamp inside one of THEIR containing
functions cannot be excluded — bounded negative, scope = decoded writers.
CONCLUSION (bounded): no map-edge clamp exists on any DECODED camera write
path; the world-bounds enter rendering via the slot15 cull window
(consume side) and the VR fold (load side, C-026). Equivalent-result
question (world->screen equality): the cull window shifts by the camera
X0/Y0 exactly as screen = world - camera shifts, so a camera beyond the
map edge culls the same tiles that would be off-screen — the visual
equivalent of clamping is produced by the consume side, without the camera
value itself being clamped (STATIC-PROVEN for the decoded paths).
""")

    # ---- 4. portal ordering ----
    A("## 4. Portal -> Move/Field -> Camera -> Scene order (typed edges)")
    A("""
Established chains (citations: EV-35/36/45/70/73/77/78/89/90 + this round):
  cross-map: opcode 0x81 -> 0x97EBC9 (alloc field, 0x94FDB4 load incl. VR fold,
            0x980A8C attach) -> 0x9507F0 arrival write (encrypted coords,
            map-bounds clamp INSIDE move-object setters [M+0x138..0x144],
            velocity zero) -> [0x953FA5 appearance reset] -> first tick
            T7->0x9BCD6C no-ctx rebuild (mode=1) -> slot5 ctx install.
  same-map: 0x963CE1 cooldown gates -> pending pair + deadline -> apply
            0x9C1113 (clear ctx, write coords, notify) -> physics-loop rebuild.
Camera edges (THIS ROUND):
  E1 (synchronous, cross-map): 0x9507F0 arrival family -> 0x964E16 (portal
     trigger neighbourhood) -> 0x93CB27 focus write — same call stack as the
     arrival processing (callee of the trigger handler). Camera write happens
     AFTER the arrival position write in program order.
  E2 (event-driven, input): window-proc mouse band 0x9F1784 -> 0x5CA91A —
     fires on OS mouse messages, INDEPENDENT of portal events (gate
     [singleton+0xC]==0 only). No portal interaction.
  E3 (event-driven, enumeration): 0x9E649A surface-present ->
     [0xBE1554] enumeration -> 0x9E6CA4 -> PtInRect gate -> 0x5CA91A.
     Triggered by the surface-present pass, NOT by movement ticks.
  Scene cull: slot12 tick 0x53465B / slot14 per-draw 0x5346EF happen in the
  scene tick/draw phases AFTER the movement tick chain (C-084 order), and
  READ the camera (no write) — ordering camera-write -> cull-read is
  guaranteed by phase separation (tick before draw) for E1; for E2/E3 the
  write is message-driven and may interleave arbitrarily with ticks
  (STATIC-UNDERDETERMINED which message pump phase delivers them).
  Portal input suppression (up-key during cooldown): the same-map cooldown
  gate [0x2900]!=0 && [0x2904]>now (C-054) suppresses re-trigger; the
  cross-map input suppression path is NOT among this round's decoded
  surfaces — carried as the P4-07 residual.
""")
    path = os.path.join(OUT, "T088-CAMERA-BOUNDS-SCENE-PORTAL.md")
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(L) + "\n")
    print(f"wrote {path}")
    print(f"refs={len(refs)} lea={len(lea)} mov_write={len(mov_write)} mov_read={len(mov_read)}")
    print(f"family tables={len(fam)}; base installs={list(map(hex, got_installs))}")
    print(f"writer verdicts: {[(hex(w), v) for w, v in verdicts]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
