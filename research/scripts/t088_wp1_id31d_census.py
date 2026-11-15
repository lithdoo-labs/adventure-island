#!/usr/bin/env python3
"""T088 WP1 — namespace id 0x31D resolve-point census + direct slot+0x90 writer
classification (CMS079, STATIC-ONLY).

Outputs (canonical, LF):
  research/result/stage-readiness/forensics/T088-VECTOR2D-ID31D-RESOLVE-CENSUS.csv
  research/result/stage-readiness/forensics/T088-DIRECT-SLOT90-WRITER-CLASSIFICATION.csv

Method (all byte-level, sha-pinned):
  1. enumerate every `push 0x31D` (68 1D 03 00 00) and `mov r32, 0x31D`
     (B8+r 1D 03 00 00) site in .text;
  2. for each resolve site, decode the following window and extract the
     attach target of the 0x447891 create call (arg2 expression) — the
     aliasing slot of the shared namespace object;
  3. enumerate every `call [reg+0x90]` encoding (disp8 FF /2, disp32 FF /2,
     SIB forms) in .text;
  4. join resolve sites with slot+0x90 call sites inside the same census
     function (function census = E8 targets + prologues, the t046 method);
  5. for every joined candidate, decode the call-site pre-window: the
     receiver push and the (x, y) argument pushes, plus the VARIANT
     construction idiom (0x40318F from data 0xBE7330 = VT_ERROR/missing
     defaults vs. any other builder).

T088.1 CORRECTION (VA double-BASE bug): `decode_attach` disassembles with the
capstone base `resolve_off + BASE`, so every capstone `ins.address` is ALREADY
a VA. The T088 release formatted the census column as
`f"{call_off + BASE:#010x}"`, adding BASE a SECOND time (every non-empty
create_call_va was 0x400000 too high; 76/80 rows affected). The fix formats
the returned VA directly, and the generator now self-verifies every emitted
call address at byte level (E8 rel32 -> 0x447891, VA within the image code
band) before writing the CSV. Rows without an in-window create call record a
byte-derived reason (imm32 0x31D consumed as an arithmetic/compare operand is
NOT a namespace resolve) instead of a bare "none-within-0x90".

Binary identity:
  EXE .work/task-036/game-image-unpacked.bin (linear, VA-0x400000)
  sha256 d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718
"""
import csv
import hashlib
import io
import os
import re
import struct
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
from capstone import Cs, CS_ARCH_X86, CS_MODE_32

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
EXE = os.path.join(REPO, ".work", "task-036", "game-image-unpacked.bin")
EXE_SHA = "d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718"
BASE = 0x400000
CODE_START, CODE_END = 0x1000, 0x7EA000
OUT_DIR = os.path.join(REPO, "research", "result", "stage-readiness", "forensics")

md = Cs(CS_ARCH_X86, CS_MODE_32)


def load():
    data = open(EXE, "rb").read()
    digest = hashlib.sha256(data).hexdigest()
    if digest != EXE_SHA:
        raise SystemExit(f"sha256 mismatch: {digest}")
    return data


def function_census(img):
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
    import bisect
    funcs = sorted(functions)

    def containing(off):
        i = bisect.bisect_right(funcs, off) - 1
        return funcs[i] if i >= 0 else None
    return funcs, containing


def scan_resolves(img):
    push_sites = [CODE_START + m.start()
                  for m in re.finditer(re.escape(b"\x68\x1d\x03\x00\x00"),
                                       img[CODE_START:CODE_END])]
    mov_sites = [CODE_START + m.start()
                 for m in re.finditer(b"[\xb8-\xbf]\x1d\x03\x00\x00",
                                      img[CODE_START:CODE_END])]
    return push_sites, mov_sites


def decode_attach(img, resolve_off):
    """Decode the window after a resolve and return (call_va, attach_expr).

    The returned call address is a VA (capstone disasm base is
    resolve_off+BASE) — callers must NOT add BASE again (t088.1 fix of the
    t088-reviewer C2 double-BASE defect).
    t088-reviewer C3: when the 2nd push is a bare register, resolve the
    `lea reg, [...]` that fed it.
    """
    blob = img[resolve_off:resolve_off + 0x90]
    insns = list(md.disasm(blob, resolve_off + BASE))
    call_idx = None
    for i, ins in enumerate(insns):
        if ins.mnemonic == "call" and ins.op_str == "0x447891":
            call_idx = i
            break
    if call_idx is None:
        return None, "none-within-0x90"
    pushes = [(x.address, x.op_str) for x in insns[:call_idx] if x.mnemonic == "push"]
    if len(pushes) < 2:
        return insns[call_idx].address, "unknown"
    addr, op = pushes[-2]
    if op in ("eax", "ebx", "ecx", "edx", "esi", "edi"):
        # find the nearest lea defining that register before the push
        for x in reversed(insns[:call_idx]):
            if x.mnemonic == "lea" and x.op_str.startswith(f"{op}, "):
                return insns[call_idx].address, x.op_str.split(", ", 1)[1]
        for x in reversed(insns[:call_idx]):
            if x.mnemonic == "mov" and x.op_str.startswith(f"{op}, "):
                return insns[call_idx].address, x.op_str.split(", ", 1)[1]
    return insns[call_idx].address, op


def scan_slot90(img):
    sites = []
    for m in re.finditer(b"\xff[\x50-\x57]\x90", img[CODE_START:CODE_END]):
        sites.append((CODE_START + m.start(), "disp8"))
    for m in re.finditer(b"\xff[\x90-\x97]\x90\x00\x00\x00", img[CODE_START:CODE_END]):
        sites.append((CODE_START + m.start(), "disp32"))
    for m in re.finditer(b"\xff\x54\x24\x90", img[CODE_START:CODE_END]):
        sites.append((CODE_START + m.start(), "sib-esp"))
    sites.sort()
    return sites


def classify_callsite(img, call_off):
    """Decode the ~0x78 bytes before a slot+0x90 call: receiver + (x,y) args."""
    back = 0xA0
    blob = img[call_off - back:call_off + 8]
    insns = list(md.disasm(blob, call_off - back + BASE))
    insns = [x for x in insns if x.address <= call_off + BASE]
    tail = [x for x in insns if x.address > call_off + BASE - 0x34]
    recv = args = "unknown"
    pushes = [x.op_str for x in tail if x.mnemonic == "push"]
    if len(pushes) >= 3:
        recv, x_arg, y_arg = pushes[-1], pushes[-2], pushes[-3]
        args = f"Set({x_arg}, {y_arg})"
    # VARIANT builder detection: byte-level scan in the wide window — immune
    # to fixed-offset disassembly desync. t088-reviewer C4: the two
    # "cleared-slot" sites are in fact RE-TEMPLATED to VT_ERROR/missing after
    # VariantClear (e.g. fieldctx ctor: clear at 0x9EC57B, then `mov edi,
    # 0xBE7330` + push edi + call 0x402C26 at 0x9EC5A8-0x9EC5D2), so ALL
    # immediate-class sites are uniformly V{VT_ERROR,missing}. Default-variant
    # anchors scanned as raw bytes:
    #   `push 0xBE7330`           (68 30 73 BE 00)
    #   `mov r32, 0xBE7330`       (B8+r 30 73 BE 00)
    #   `call 0x40318F`           (E8 rel32)
    variant = "other/none-in-window"
    lo = call_off - 0xC0
    hi = call_off
    win = img[lo:hi]
    found = b"\x68\x30\x73\xbe\x00" in win            # push 0xBE7330
    if not found:
        for i in range(len(win) - 5):
            if 0xB8 <= win[i] <= 0xBF and win[i + 1:i + 5] == b"\x30\x73\xbe\x00":
                found = True                            # mov r32, 0xBE7330
                break
    if not found:
        want = 0x40318F - BASE
        for i in range(lo, hi):
            if img[i] == 0xE8:
                rel = struct.unpack("<i", img[i + 1:i + 5])[0]
                if i + 5 + rel == want:
                    found = True                        # call 0x40318F
                    break
    if found:
        variant = "default(VT_ERROR,missing)"
    # receiver provenance marker: does the window read a stack slot?
    return recv, args, variant


# Curated per-site classification (lead analysis, this round). Key:
#   CONFIRMED-CAMERA-WRITER — receiver is the shared 0x31D Vector2D (resolve/create or
#     fieldctx+0xD4 getter lineage) AND the value semantics are decoded;
#   CONFIRMED-SHARED-WRITE-CONTEXT-UI — receiver is the shared Vector2D, the write is a
#     UI/surface offset in a non-field context (screen-space / sprite placement);
#   RECEIVER-OTHER — receiver is a different object at this call (the resolve in the
#     function feeds something else);
#   INCONCLUSIVE — receiver lineage not fully traced this round.
CURATED = {
    "0x0043781f": ("CONFIRMED-SHARED-WRITE-CONTEXT-UI", "Set(0, -0x32) on shared V2D (receiver [ebp-0x10] of resolve 0x437732)"),
    "0x0043f17b": ("INCONCLUSIVE", "Set([ebp+8], edx); receiver [ebp-0x10]"),
    "0x004401f3": ("INCONCLUSIVE", "Set([ebx+0x20], ecx([ebx+0x24])); receiver [ebp-0x10]"),
    "0x00443cf9": ("INCONCLUSIVE", "Set([ebx+8], ecx([ebx+0xC])); receiver [ebp+8]"),
    "0x00450438": ("INCONCLUSIVE", "Set([ebp+0xC], [ebp+0x10]); receiver [ebp-0x14]"),
    "0x004505b0": ("CONFIRMED-SHARED-WRITE-CONTEXT-UI", "Set(ebx=0, ebx=0) on persistent alias [edi+0xE2C-family] (attach 0x4505FB lea [edi+0xE34])"),
    "0x00450709": ("CONFIRMED-SHARED-WRITE-CONTEXT-UI", "Set(0, 0) on persistent alias [edi+0xE30] (attach 0x450754)"),
    "0x004b3bc5": ("CONFIRMED-SHARED-WRITE-CONTEXT-UI",
                   "receiver = shared V2D created by the in-function resolve (out-slot [ebp-0x1C] @0x4B3764 "
                   "-> 0x447891) — t088-reviewer C1 reclassification (T087-reviewer's RECEIVER-OTHER ruling "
                   "superseded: the T087 note examined a different receiver line)"),
    "0x004b3dad": ("CONFIRMED-SHARED-WRITE-CONTEXT-UI",
                   "receiver = shared V2D created by the in-function resolve (out-slot [ebp-0x14] @0x4B3824 "
                   "-> 0x447891) — t088-reviewer C1"),
    "0x004ede7c": ("INCONCLUSIVE", "Set([ebp+0x10], [ebp+0x14]) on [ebx+0x18] alias (attach 0x4EDD58)"),
    "0x0050e9ac": ("INCONCLUSIVE", "Set([ebp-0x2C], eax); receiver [ebp-0x20]"),
    "0x00560e52": ("INCONCLUSIVE", "Set(0x217, 8) near getter; receiver eax"),
    "0x0056c16a": ("INCONCLUSIVE", "receiver lineage not decoded"),
    "0x0066c181": ("INCONCLUSIVE", "Set([ebp-0x2C], [ebp-0x34]); map-load family 0x66BD27"),
    "0x0066d972": ("INCONCLUSIVE", "Set([ebp-0x20], ebx)"),
    "0x00688ec3": ("INCONCLUSIVE", "Set([ebp-0x20], ecx([ebp-0x14]+8))"),
    "0x00692280": ("CONFIRMED-SHARED-WRITE-CONTEXT-UI", "Set(0xFFFFFF01(-255), 0) on shared V2D (receiver [ebp-0x10] of resolve 0x69213A)"),
    "0x00694fed": ("INCONCLUSIVE", "Set([ebp-0x38], edx([ebp-0x18]+0xC))"),
    "0x006957df": ("INCONCLUSIVE", "Set(0xFFFFFF01, ebx)"),
    "0x00697ceb": ("INCONCLUSIVE", "Set([ebp-0x1C], [ebp+0x14])"),
    "0x006be6f4": ("CONFIRMED-SHARED-WRITE-CONTEXT-UI", "Set(0x190(400), [ebp-0x14]) on shared V2D (resolve 0x6BE5E8 attach [edi]; ALSO reads fieldctx+0xD4 via getter 0x6BE62A)"),
    "0x006ed7cc": ("CONFIRMED-SHARED-WRITE-CONTEXT-UI", "Set(0x97(151), 0x8D(141)) on shared V2D (receiver [ebp-0x10] of resolve 0x6ED6C2)"),
    "0x006ed9b3": ("INCONCLUSIVE", "Set([ebx], eax([ebp-0x18]+0x55C*[ebp-0x20])) on [ebx-0x30]"),
    "0x0073e445": ("INCONCLUSIVE", "Set(ecx, [ebp-0x14]); receiver [ebp+8]"),
    "0x0073e9e9": ("INCONCLUSIVE", "Set(ecx, [ebp-0x18]); receiver [ebp-0x10]"),
    "0x00741ec8": ("CONFIRMED-SHARED-WRITE-CONTEXT-UI", "Set(ebx=0, ebx=0) zero reset on shared V2D (resolve 0x741DD8)"),
    "0x007aa130": ("INCONCLUSIVE", "Set([ebx+8], ecx([ebx+0xC]))"),
    "0x007aa1dd": ("INCONCLUSIVE", "Set([ebx+0x10], ecx)"),
    "0x007aa848": ("CONFIRMED-SHARED-WRITE-CONTEXT-UI", "Set(0xFFFFFF01(-255), 0) (resolve 0x7AA718; same constants as 0x692280)"),
    "0x0093c37c": ("CONFIRMED-SHARED-WRITE-CONTEXT-UI", "Set(0, -0x1E - X([esi+0x88] via 0x451943)) on shared V2D (resolve 0x93C25E attach [ebp+8])"),
    "0x0093cc9b": ("CONFIRMED-CAMERA-WRITER", "focus writer 0x93CB27: Set(X([[this+0xF28]+0x14]), Y(same)) via 0x404B07/0x404B2E on the shared V2D create 0x93CBBE"),
    "0x00941c1c": ("INCONCLUSIVE", "Set([ebp+0xC], [ebp+0x10]); receiver [ebp-0x10]"),
    "0x009437b4": ("INCONCLUSIVE", "Set(ebx, -0x28); receiver [ebp-0x28] of resolve 0x9436A5"),
    "0x0098694a": ("INCONCLUSIVE", "Set([ebp-0x3C], -0x7D)"),
    "0x00986c90": ("INCONCLUSIVE", "Set([ebp-0x2C], -0x7D)"),
    "0x009ec62a": ("CONFIRMED-CAMERA-WRITER", "fieldctx ctor initial Set(-400, -300) = world origin centred (EV-89 re-proof; V3 slot is VariantClear'd at 0x9EC57B then RE-TEMPLATED to V{VT_ERROR,missing} from 0xBE7330 at 0x9EC5C3-0x9EC5D2 — immediate class; t088-reviewer C4)"),
    "0x00a19800": ("INCONCLUSIVE", "Set(ecx, [ebp-0x10])"),
    "0x00a19d7a": ("INCONCLUSIVE", "Set(ecx, [ebp-0x10])"),
}


def verify_create_call(img, call_va):
    """Byte-verify that `call_va` (a VA) is an `E8 rel32` to 0x447891."""
    off = call_va - BASE
    if not (BASE + CODE_START <= call_va < BASE + CODE_END):
        raise AssertionError(f"create call VA {call_va:#x} outside code band")
    if img[off] != 0xE8:
        raise AssertionError(f"no E8 opcode at {call_va:#x}")
    rel = struct.unpack("<i", img[off + 1:off + 5])[0]
    tgt = call_va + 5 + rel
    if tgt != 0x447891:
        raise AssertionError(f"E8 at {call_va:#x} targets {tgt:#x}, not 0x447891")
    return True


def no_call_reason(img, resolve_off):
    """Byte-derived reason for a resolve site with no 0x447891 call in window."""
    blob = img[resolve_off:resolve_off + 0x90]
    insns = list(md.disasm(blob, resolve_off + BASE))
    has_call = any(i.mnemonic == "call" for i in insns[:12])
    # how is the 0x31D immediate consumed right after the site?
    tail = [i.mnemonic for i in insns[1:4]]
    arith = [m for m in tail if m in ("sub", "add", "cmp", "xor", "imul", "and", "or", "shl", "shr")]
    if arith:
        return (f"no-0x447891-create-call-in-window; imm32 consumed as "
                f"arithmetic/compare operand ({'/'.join(arith)}) — not a namespace resolve")
    if any(j in tail for j in ("jg", "jl", "je", "jne", "jmp")):
        return ("no-0x447891-create-call-in-window; imm32 flows into a compare/"
                "dispatch chain — not a namespace resolve")
    if has_call:
        return "no-0x447891-create-call-in-window (other calls present; no create)"
    return "no-call-in-window"


def main():
    img = load()
    funcs, containing = function_census(img)
    push_sites, mov_sites = scan_resolves(img)
    slot90 = scan_slot90(img)

    # ---- census CSV: every resolve site with attach target + function ----
    rows = []
    verified_calls = 0
    for off in push_sites + mov_sites:
        form = "push imm32" if off in push_sites else "mov r32, imm32"
        call_va, attach = decode_attach(img, off)
        if call_va is None:
            # byte-derived reason (t088.1): never fabricate a call site
            attach = no_call_reason(img, off)
        else:
            verify_create_call(img, call_va)   # t088.1: E8->0x447891 byte proof
            verified_calls += 1
        fn = containing(off)
        # t088.1: bracketed field attachments ([edi + 0xE34] family) are
        # PERSISTENT-FIELD aliases, not "register" — the T088 regex
        # r"\w+ \+ 0x" never matched the bracketed form, leaving EV-93's
        # "12 persistent-field aliases" uncheckable from the column
        if call_va is None:
            alias_kind = "imm32-operand (not a resolve)"
        elif attach and "ebp" in attach:
            alias_kind = "stack-slot/arg"
        elif attach and re.match(r"\[\w+ [+-] 0x", attach):
            alias_kind = "persistent-field"
        elif attach and attach != "unknown":
            alias_kind = "register"
        else:
            alias_kind = attach or "unknown"
        rows.append({
            "resolve_va": f"{off + BASE:#010x}",
            "form": form,
            "function_start": f"{fn + BASE:#010x}" if fn else "",
            # t088.1 fix: call_va is ALREADY a VA (capstone base resolve_off+BASE);
            # the T088 release added BASE again here (+0x400000 on all 76 rows)
            "create_call_va": f"{call_va:#010x}" if call_va else "",
            "attach_target_expr": attach,
            "alias_kind": alias_kind,
        })
    rows.sort(key=lambda r: int(r["resolve_va"], 16))
    census_path = os.path.join(OUT_DIR, "T088-VECTOR2D-ID31D-RESOLVE-CENSUS.csv")
    with open(census_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()), lineterminator="\n")
        w.writeheader()
        w.writerows(rows)
    print(f"create calls byte-verified against 0x447891: {verified_calls}")

    # ---- candidate join: slot90 call sites in the same census-function as a resolve ----
    cands = []
    for off in push_sites:
        fn = containing(off)
        if not fn:
            continue
        for (s, enc) in slot90:
            if 0 <= s - off <= 0x180 and containing(s) == fn:
                recv, args, variant = classify_callsite(img, s)
                _, attach = decode_attach(img, off)
                va = f"{s + BASE:#010x}"
                cur = CURATED.get(va, ("INCONCLUSIVE", ""))
                cands.append({
                    "resolve_va": f"{off + BASE:#010x}",
                    "function_start": f"{fn + BASE:#010x}",
                    "slot90_va": va,
                    "encoding": enc,
                    "receiver_push": recv,
                    "args": args,
                    "variant3_4": variant,
                    "resolve_attach": attach,
                    "classification": cur[0],
                    "notes": cur[1],
                })
    # getter-adjacent family: 0x48AEC3 callers with slot90 in the same fn
    getter_callers = []
    tgt = 0x48AEC3 - BASE
    for i in range(CODE_START, CODE_END - 5):
        if img[i] == 0xE8:
            rel = struct.unpack("<i", img[i + 1:i + 5])[0]
            if i + 5 + rel == tgt:
                getter_callers.append(i)
    for g in getter_callers:
        fn = containing(g)
        if not fn:
            continue
        for (s, enc) in slot90:
            if 0 <= s - g <= 0x180 and containing(s) == fn:
                recv, args, variant = classify_callsite(img, s)
                va = f"{s + BASE:#010x}"
                cur = CURATED.get(va, ("INCONCLUSIVE", ""))
                cands.append({
                    "resolve_va": f"{g + BASE:#010x} (getter 0x48AEC3)",
                    "function_start": f"{fn + BASE:#010x}",
                    "slot90_va": va,
                    "encoding": enc,
                    "receiver_push": recv,
                    "args": args,
                    "variant3_4": variant,
                    "resolve_attach": "fieldctx+0xD4 (getter)",
                    "classification": cur[0],
                    "notes": cur[1],
                })
    cands.sort(key=lambda r: int(r["slot90_va"], 16))
    cls_path = os.path.join(OUT_DIR, "T088-DIRECT-SLOT90-WRITER-CLASSIFICATION.csv")
    with open(cls_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(cands[0].keys()), lineterminator="\n")
        w.writeheader()
        w.writerows(cands)

    print(f"resolve sites: push={len(push_sites)} mov={len(mov_sites)} total={len(rows)}")
    print(f"slot+0x90 encodings (raw): {len(slot90)}")
    print(f"joined candidates: {len(cands)}")
    print(f"wrote {census_path}")
    print(f"wrote {cls_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
