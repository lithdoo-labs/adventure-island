#!/usr/bin/env python3
"""T088.1 — source-of-truth ledger corrections (one-shot, fail-closed).

Applies the T088.1 acceptance findings to research/source-of-truth/:
  F2  EV-93 interpretation: drop the dangling "= 35/39 immediate-class"
      bucket (t088-reviewer C4 revoked it; 39/39 uniform default), add the
      semantic layering statement (default VARIANT param vs Set immediacy vs
      shared receiver vs containing-function semantics) and the t088.1
      census VA-fix provenance; refresh source_sha256 (census CSV
      regenerated from the fixed generator).
  F7  EV-97: refresh source_sha256 (forensics md regenerated); writer count
      9 -> 10 (the T088 probe missed 0x952ECE); mov/lea taxonomy unified to
      21 lea + 10 write-mov = 31 (reads excluded); interpretation restates
      the census-bounded negative with the positive-controlled scanner.
  F4  C-028 / C-103: mark the T087 'field-family world-space writers' and
      'deadzone only upstream of the two field writers' readings as
      historical, superseded by C-107/EV-94 (cursor mode) + C-109 (focus
      writer). Shared-object identity and coordinate transforms (C-103)
      are NOT revoked.
  x   C-106 reasoning: remove an accidentally duplicated sentence.
  F3  G10: unresolved_scope drops '33 family vtables have no imm32 code ref'
      (refuted: base table installs located; 32 derived tables have zero
      imm32 occurrence but their install chain is untraced); blocker drops
      the completed [fieldctx+0xD4]/[0xBDD838] identity tasks; next_action
      adds the T089 derived-table chain entry point.

Every edit is an exact-substring replacement; a missing anchor aborts.
"""
import csv
import io
import os
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SOT = os.path.join(REPO, "research", "source-of-truth")

CENSUS_SHA = "69f18c64aece419ead6246faf688ce91ecb3c651cfff7273b0039d38010e3559"
BOUNDS_SHA = "d4a9cdcf9795f83b3eae0ddc357207fc58ba009318445a245d5122d708bc86cf"


def replace_exact(text, old, new, what):
    if old not in text:
        raise SystemExit(f"ABORT: anchor not found for {what}")
    if text.count(old) != 1:
        raise SystemExit(f"ABORT: anchor not unique for {what} ({text.count(old)} hits)")
    return text.replace(old, new)


def main():
    # ---------------- evidence.csv ----------------
    path = os.path.join(SOT, "evidence.csv")
    with open(path, newline="", encoding="utf-8") as f:
        rd = csv.reader(f)
        hdr, rows = next(rd), list(rd)
    idx = {c: i for i, c in enumerate(hdr)}
    n = 0
    for r in rows:
        eid = r[idx["evidence_id"]]
        if eid == "EV-93":
            r[idx["source_sha256"]] = replace_exact(
                r[idx["source_sha256"]],
                "7534683672805f69d1f77bdb68eff400cb5c4bc394af5c1bda92de77051a085e",
                CENSUS_SHA, "EV-93 census sha")
            r[idx["interpretation"]] = replace_exact(
                r[idx["interpretation"]],
                "resolve-site census: 12 persistent-field aliases incl [fieldctx+0xD4]/"
                "[singleton+0x9B0]/[edi+0xE30-E38]/[esi+0x28D0], rest stack-slot transients; "
                "companion classification CSV sha256="
                "2f5c550e303495909336471fbc8d1445a5492ae8fc7b258ea2362cd6706abe4c "
                "(39 rows / 38 unique sites — 0x6BE6F4 joined via both the resolve and the "
                "getter path; 2 CONFIRMED-CAMERA-WRITER, 12 CONFIRMED-SHARED-WRITE-CONTEXT-UI "
                "(t088-reviewer C1 reclassified 0x4B3BC5/0x4B3DAD), 0 RECEIVER-OTHER, "
                "25 INCONCLUSIVE; 39/39 default V{VT_ERROR,missing} — C4: the two cleared "
                "slots are re-templated from 0xBE7330) = 35/39 immediate-class)",
                "resolve-site census (t088.1: the T088 create_call_va column carried a "
                "double-BASE defect — all 76 non-empty call VAs were 0x400000 too high; "
                "fixed at the GENERATOR, every emitted call byte-verified E8->0x447891 "
                "inside [0x401000,0xBEA000); the 4 empty rows are imm32-operand sites "
                "(sub/dispatch consumption), not resolves; 80-row independent "
                "verification = forensics/T0881-VA-CALLSITE-VERIFICATION.csv): 12 "
                "persistent-field aliases incl [fieldctx+0xD4]/[singleton+0x9B0]/"
                "[edi+0xE30-E38]/[esi+0x28D0] (t088.1: now machine-derived — the "
                "alias_kind column's broken bracket regex previously mislabeled "
                "them 'register'), rest stack-slot transients; companion "
                "classification CSV sha256="
                "2f5c550e303495909336471fbc8d1445a5492ae8fc7b258ea2362cd6706abe4c "
                "(unchanged by the fix; 39 rows / 38 unique sites — 0x6BE6F4 joined via "
                "both the resolve and the getter path; 2 CONFIRMED-CAMERA-WRITER, "
                "12 CONFIRMED-SHARED-WRITE-CONTEXT-UI (t088-reviewer C1 reclassified "
                "0x4B3BC5/0x4B3DAD), 0 RECEIVER-OTHER, 25 INCONCLUSIVE; 39/39 default "
                "V{VT_ERROR,missing} — C4: the two cleared slots are re-templated from "
                "0xBE7330; the T088-era '33 default + 2 VT_EMPTY / 35/39 immediate-class' "
                "bucketing is revoked. SEMANTIC LAYERING (t088.1): 'default VARIANT' "
                "asserts only the call-parameter class — Set immediacy is proven "
                "callee-side (C-108), shared receiver by C-106, and the 25 INCONCLUSIVE "
                "sites' containing-function business semantics remain open; default "
                "parameters do NOT auto-upgrade their classification)",
                "EV-93 interpretation")
            n += 1
        elif eid == "EV-97":
            r[idx["source_sha256"]] = replace_exact(
                r[idx["source_sha256"]],
                "f5ad994a376978efbf01c563da5fd44bebd56cab872bd92ff907a225fbcb2bd5",
                BOUNDS_SHA, "EV-97 bounds sha")
            r[idx["address"]] = replace_exact(
                r[idx["address"]],
                "slot15 0x53471A; 31 +0x1CC mov/lea sites; 9 direct +0x1CC writers; "
                "33 slot15-family tables",
                "slot15 0x53471A; 31 +0x1CC mov/lea sites (t088.1 instruction-verified "
                "taxonomy: 21 lea + 10 write-mov, reads excluded; the T088 forensics "
                "figure of 30 missed one writer); 10 direct +0x1CC writers (t088.1: "
                "0x952ECE field-copy writer added — the T088 probe mixed VA/file-offset "
                "and substring-matched '0x1cc', dropping it); 33 slot15-family tables",
                "EV-97 address")
            r[idx["interpretation"]] = replace_exact(
                r[idx["interpretation"]],
                "camera-side map-bounds clamp NEGATIVE (bounded to decoded writer bodies; "
                "bounds on the consume side slot15 + VR fold); [scene+0x1CC]: none of the "
                "9 direct writers installs a slot15-family vtable (bounded negative "
                "stands); t088-reviewer C7: the BASE family table 0xB01278 IS installed "
                "at 0x52F1CF/0xA0B39E/0xA0BB2A (shared init 0x52F37F) — the \"no imm32 "
                "code ref\" draft claim withdrawn; derived tables and the +0x1CC member "
                "install remain UNLOCATED; portal->camera edges typed (E1 synchronous "
                "focus write in portal-trigger/packet-spawn stacks; E2/E3 message-driven, "
                "pump-phase interleaving statically undecidable)",
                "camera-side map-bounds clamp NEGATIVE (bounded to decoded writer bodies; "
                "bounds on the consume side slot15 + VR fold); [scene+0x1CC]: none of the "
                "TEN direct writers (t088.1 census correction: +0x952ECE) installs a "
                "slot15-family vtable via an imm32 store inside its containing function — "
                "CENSUS-FN-BOUNDED-NEGATIVE 10/10 and BOUNDARY-ROBUST: the scanner is an "
                "instruction-boundary imm32 census positive-controlled on the base "
                "table's four installs (self-aborting if not found; the T088 scanner's "
                "regex was structurally blind), windows take the EARLIEST candidate "
                "start (census / SEH ctor anchor / preceding prologue), and the census "
                "is exhaustive over the code band so the negative does not hinge on any "
                "single boundary (between the closest pair — writer 0xA029BA's window "
                "end 0xA02B82 and install 0xA0B39E — lie 8 further genuine prologues, "
                "430 in-window E8 call targets and the install's own containing "
                "function, so no single function can span the gap); t088-reviewer C7 (re-verified, addresses "
                "corrected): the BASE family table 0xB01278 has FOUR imm32 installs — "
                "0x52F1BC (thunk: install then tail-jmp 0x52F37F), 0x52F1CF and "
                "0xA0BB2A (install then call 0x52F37F), 0xA0B39E — plus two "
                "register-mediated installs (0x52EEF1/0x8DC052: mov esi,0xB01278; "
                "mov [ebp-0x3C],esi; call 0x52F37F); the \"no imm32 code ref\" draft "
                "claim is withdrawn; the 32 DERIVED tables have ZERO byte occurrences in "
                "the code band, so their construction/install chain is entirely "
                "non-imm32 and remains UNLOCATED, as does the +0x1CC member's class "
                "identity; portal->camera edges typed (E1 synchronous focus write in "
                "portal-trigger/packet-spawn stacks; E2/E3 message-driven, pump-phase "
                "interleaving statically undecidable)",
                "EV-97 interpretation")
            n += 1
    if n != 2:
        raise SystemExit(f"ABORT: expected 2 evidence rows edited, got {n}")
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(hdr)
        w.writerows(rows)
    print("evidence.csv: EV-93/EV-97 corrected")

    # ---------------- claims.csv ----------------
    path = os.path.join(SOT, "claims.csv")
    with open(path, newline="", encoding="utf-8") as f:
        rd = csv.reader(f)
        hdr, rows = next(rd), list(rd)
    idx = {c: i for i, c in enumerate(hdr)}
    n = 0
    for r in rows:
        cid = r[idx["claim_id"]]
        if cid == "C-028":
            # T088 report §6 promised "C-028 ... EV-94/95/96 引用" — the refs
            # only reached binary_identity; add them to evidence_refs too
            if r[idx["evidence_refs"]] != "EV-21;EV-89;EV-90":
                raise SystemExit("ABORT: C-028 evidence_refs anchor mismatch")
            r[idx["evidence_refs"]] = "EV-21;EV-89;EV-90;EV-94;EV-95;EV-96"
            r[idx["reasoning"]] = replace_exact(
                r[idx["reasoning"]],
                "camera WRITE formula camera := point - (400,300) at 0x5CA91A with a "
                "7-site writer census incl. two field-family world-space writers "
                "(0x9E6D18 record pair, 0x9F1ADF packed 16:16); screen<->world "
                "converters 0x9EC924/0x9EC989 combine cursor+camera; STILL OPEN: follow "
                "cadence/deadzone (the upstream gating of the two field writers — the "
                "only place a deadzone could live — not decoded) and camera-vs-map-edge "
                "clamp",
                "camera WRITE formula camera := point - (400,300) at 0x5CA91A with a "
                "7-site writer census [T087 HISTORICAL READING, superseded by "
                "C-107/EV-94 in t088: the funnel writers 0x9E6D18 (record pair) and "
                "0x9F1ADF (packed 16:16) were then read as 'field-family world-space "
                "writers' and as 'the only place a deadzone could live' — both are now "
                "PROVEN cursor-mode (enumeration-callback PtInRect gate / window-proc "
                "mouse band), and the direct focus writer 0x93CB27 (C-109) is the "
                "actual player-follow candidate]; screen<->world converters "
                "0x9EC924/0x9EC989 combine cursor+camera; [the t087 'STILL OPEN: "
                "deadzone upstream of the two field writers' item is CLOSED as "
                "mis-scoped: t088 found no deadzone constant in any decoded gate — a "
                "bounded negative that stands] and camera-vs-map-edge clamp",
                "C-028 reasoning")
            n += 1
        elif cid == "C-103":
            r[idx["claim"]] = replace_exact(
                r[idx["claim"]],
                "writers = singleton-ctor init 0x5CA774, cursor setter 0x5CB0E0 "
                "(0x5CB12E/0x5CB139), 0x5CB3DF, keyboard mover 0x5CB74B, FIELD writers "
                "0x9E6D18 (record pair +0x38/+0x3C) and 0x9F1ADF (packed 16:16 dword: "
                "low word x, high word y)",
                "writers = singleton-ctor init 0x5CA774, cursor setter 0x5CB0E0 "
                "(0x5CB12E/0x5CB139), 0x5CB3DF, keyboard mover 0x5CB74B, funnel writers "
                "0x9E6D18 (record pair +0x38/+0x3C) and 0x9F1ADF (packed 16:16 dword: "
                "low word x, high word y) [T087 historical labels 'FIELD writers' — "
                "superseded by the t088 revision recorded in `address`: both are "
                "CURSOR-mode (C-107/EV-94), not world-space field writers; the closest "
                "player-follow writer is the direct focus writer 0x93CB27 (C-109)]",
                "C-103 claim writers list")
            r[idx["claim"]] = replace_exact(
                r[idx["claim"]],
                "BOUNDED: follow cadence/deadzone of the two field writers (the only "
                "place a deadzone could live) NOT decoded;",
                "BOUNDED (t087 scoping, superseded by C-107/C-109 in t088): 'follow "
                "cadence/deadzone of the two field writers' — both writers are "
                "cursor-mode and their decoded gates contain no threshold; the "
                "cadence/deadzone residual lives in the [[user+0xF28]+0x14] writer "
                "census and the 25 INCONCLUSIVE sites (see G10);",
                "C-103 claim bounded note")
            # t088.1-reviewer phase-2 D1: the T088 report §6 promise "C-103 ...
            # EV-93/94 引用" was applied by the T088 wp0 script to the WRONG
            # column (binary_identity, overwriting the identity string) and
            # evidence_refs was never extended. Fix BOTH cells:
            if r[idx["evidence_refs"]] != "EV-89;EV-90":
                raise SystemExit("ABORT: C-103 evidence_refs anchor mismatch")
            r[idx["evidence_refs"]] = "EV-89;EV-90;EV-93;EV-94"
            if r[idx["binary_identity"]] != "EV-89;EV-90;EV-93;EV-94":
                raise SystemExit("ABORT: C-103 binary_identity anchor mismatch")
            r[idx["binary_identity"]] = "unpack079+Shape2D.dll"
            n += 1
        elif cid == "C-106":
            dup = ("t088-reviewer C1 reinforcement: the 0x4B3BC5/0x4B3DAD receivers are "
                   "in-function resolve+0x447891 creates (out-slots [ebp-0x1C]@0x4B3764/"
                   "[ebp-0x14]@0x4B3824) — two more confirmed shared writes; reviewer "
                   "additionally proved [0xBE1FB0]=GetProcAddress(\"PcCreateObject\") via "
                   "resolver 0x79C52F.")
            doubled = dup + " " + dup
            if r[idx["reasoning"]].count(doubled) != 1:
                raise SystemExit("ABORT: C-106 doubled sentence not found exactly once")
            r[idx["reasoning"]] = r[idx["reasoning"]].replace(
                doubled,
                dup + " [t088.1: this sentence was accidentally duplicated in the T088 "
                      "commit; duplicate removed]")
            # t088.1-reviewer blind-phase precision note: the 80-site census
            # includes 4 imm32-operand occurrences that create nothing
            anchor = "80-site alias census machine-generated"
            r[idx["reasoning"]] = replace_exact(
                r[idx["reasoning"]], anchor,
                anchor + " (t088.1 precision, reviewer blind-phase: 4 of the 80 "
                          "regex sites — 0x73E40A/0xA197DD/0xA19D57 (imm32 consumed as "
                          "integer id-range operands via 0x43FD38/0x43FD62) and "
                          "0x93A0A1 (dispatch-chain data) — perform NO create call; "
                          "the singleton-alias closure applies to the 76 sites that "
                          "actually call 0x447891; census labels them 'imm32-operand "
                          "(not a resolve)')",
                "C-106 precision note")
            n += 1
    if n != 3:
        raise SystemExit(f"ABORT: expected 3 claim rows edited, got {n}")
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(hdr)
        w.writerows(rows)
    print("claims.csv: C-028/C-103/C-106 corrected")

    # ---------------- gaps.csv ----------------
    path = os.path.join(SOT, "gaps.csv")
    with open(path, newline="", encoding="utf-8") as f:
        rd = csv.reader(f)
        hdr, rows = next(rd), list(rd)
    idx = {c: i for i, c in enumerate(hdr)}
    n = 0
    for r in rows:
        if r[idx["gap_id"]] == "G10":
            # t088.1-reviewer phase-2 D3: "ALL 80 resolve sites" overreach —
            # the closure applies to the 76 creating sites
            r[idx["verified_scope"]] = replace_exact(
                r[idx["verified_scope"]],
                "aliases ALL 80 resolve sites to ONE CWzVector2D (vtable "
                "0x5140C2F0; x/y int +0x1C/+0x20; getters +0x20/+0x28)",
                "aliases ALL CREATING resolve sites to ONE CWzVector2D "
                "(t088.1 precision: 76 of the 80 regex sites actually call "
                "0x447891; the other 4 are imm32-operand non-resolves — "
                "3 id-range endpoints + 1 dispatch datum, see C-106 note; "
                "vtable 0x5140C2F0; x/y int +0x1C/+0x20; getters +0x20/+0x28)",
                "G10 verified_scope 80-site precision")
            r[idx["unresolved_scope"]] = replace_exact(
                r[idx["unresolved_scope"]],
                "slot15-family scene +0x1CC installer (9 direct +0x1CC writers are all "
                "OTHER classes; 33 family vtables have no imm32 code ref — indirect "
                "construction path unpinned)",
                "slot15-family scene +0x1CC installer (t088.1: TEN direct +0x1CC "
                "writers — the T088 census missed the field-copy writer 0x952ECE — "
                "none installs a slot15-family vtable inside its census function "
                "window, bounded negative; the BASE table 0xB01278's imm32 install "
                "chain IS statically located — installs 0x52F1BC (thunk, tail-jmp "
                "init), 0x52F1CF, 0xA0B39E, 0xA0BB2A + shared init 0x52F37F, plus "
                "register-mediated installs 0x52EEF1/0x8DC052 — but the 32 DERIVED "
                "tables have zero imm32 occurrence in the code band and their "
                "construction/install chain is untraced; the [scene+0x1CC] member's "
                "class identity is unproven)",
                "G10 unresolved_scope")
            r[idx["blocker"]] = replace_exact(
                r[idx["blocker"]],
                "none - static work continues ([fieldctx+0xD4] writer census, "
                "[0xBDD838] class identity via creation-site tracing); runtime "
                "corroboration optional",
                "none - static work continues (t088.1: the [fieldctx+0xD4] identity "
                "(= shared 0x31D Vector2D, C-103/C-106) and [0xBDD838] identity "
                "(input/cursor-manager singleton, C-104) tasks are CLOSED; remaining "
                "static work = [[user+0xF28]+0x14] writer census + slot15 "
                "derived-table install chain); runtime corroboration optional",
                "G10 blocker")
            r[idx["next_action"]] = replace_exact(
                r[idx["next_action"]],
                "STATIC: census the writers of [[user+0xF28]+0x14] (avatar-container "
                "position class) to close the focus-writer semantics; decode the 25 "
                "INCONCLUSIVE containing functions; then re-evaluate G10 closure",
                "STATIC: census the writers of [[user+0xF28]+0x14] (avatar-container "
                "position class) to close the focus-writer semantics; decode the 25 "
                "INCONCLUSIVE containing functions; T089 WP3: trace the slot15 "
                "derived-table construction/install chain from the base-ctor sites "
                "0x52F1BC/0x52F1CF/0xA0B39E/0xA0BB2A and shared init 0x52F37F (the "
                "[scene+0x1CC] member identity); then re-evaluate G10 closure",
                "G10 next_action")
            n += 1
    if n != 1:
        raise SystemExit(f"ABORT: expected 1 gap row edited, got {n}")
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(hdr)
        w.writerows(rows)
    print("gaps.csv: G10 corrected")
    return 0


if __name__ == "__main__":
    sys.exit(main())
