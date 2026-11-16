"""T091: apply WP0 canonical errata (A: C-106 76/4 wording; B: C-108 wrapper
nuance; C: G10 next_action) and add the T091 provenance claim/evidence rows
(C-120/EV-108) + G10 scope refresh. Idempotent; verifies row counts after.
"""
import csv
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
CLAIMS = REPO / "research/source-of-truth/claims.csv"
GAPS = REPO / "research/source-of-truth/gaps.csv"
EVID = REPO / "research/source-of-truth/evidence.csv"


def read(p):
    with open(p, encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))
        fields = list(rows[0].keys()) if rows else []
    return fields, rows


def write(p, fields, rows):
    with open(p, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)


# ---------- WP0-A: C-106 ----------
f, rows = read(CLAIMS)
for r in rows:
    if r["claim_id"] == "C-106":
        old = "Therefore every one of the 80 EXE resolve sites (63 push 0x31D + 17 mov r32,0x31D) aliases THE ONE shared CWzVector2D"
        new = ("Therefore the 80 id-0x31D candidate sites (63 push 0x31D + 17 mov r32,0x31D) split into 76 real create calls "
               "that alias THE ONE shared CWzVector2D and 4 sites that perform NO create call [t091 WP0-A: the t088 main-sentence "
               "'every one of the 80 … aliases' overstated the census — the 76/4 split was already byte-proven in the t088.1 "
               "reviewer phase and is now the canonical wording; no reversal]")
        if old in r["claim"]:
            r["claim"] = r["claim"].replace(old, new)
            print("WP0-A applied to C-106")
        elif "[t091 WP0-A" in r["claim"]:
            print("WP0-A already applied")

# ---------- WP0-B: C-108 ----------
for r in rows:
    if r["claim_id"] == "C-108":
        old = "=> the camera write path NEVER arms interpolation and 0x5CA91A's camera:=point-(400,300) is an unconditional immediate write END-TO-END (caller AND callee)"
        new = ("=> the camera write path NEVER arms the VT_I4 duration interpolation (every classified site passes default V{VT_ERROR,missing}) "
               "and 0x5CA91A's camera:=point-(400,300) lands as an immediate store END-TO-END in the UNARMED state (caller AND callee) "
               "[t091 WP0-B refinement, per C-116: when the animation wrapper [v+0x24] is armed, the SAME immediate Set path routes through "
               "0x51407A34 as a DELTA store preserving the filter displacement, and the getters return the filtered coordinate — the immediate/raw "
               "wording holds only for the unarmed vector; no reversal of the default-VARIANT branch proof]")
        if old in r["claim"]:
            r["claim"] = r["claim"].replace(old, new)
            print("WP0-B applied to C-108")
        elif "[t091 WP0-B" in r["claim"]:
            print("WP0-B already applied")

# ---------- C-120 (new) ----------
if not any(r["claim_id"] == "C-120" for r in rows):
    rows.append({
        "claim_id": "C-120",
        "module": "Camera",
        "claim": ("G10 FOCUS-OBJECT PROVENANCE CLOSED (t091; resolves the C-109 '[[arg3]+0x14] member-writer census' residual for the Set path): "
                  "arg3 of the focus writer 0x93CB27 is W, a per-focus 0x48-byte CAMERA-FOCUS WRAPPER (allocated by 0x94B8F7/ctor 0x94B92D; final vtables "
                  "[W]=0xB0BC40 primary / [W+4]=0xB0BC64 secondary; initializing ctor 0x5BFE8C(this=W, string-id, user, cameraV2D, X, Y, 0, 0)); "
                  "[[arg3]+0x14] = [W+0x14] = a QI-derived IVector2D view (IID 0xBA0500 = the Shape2D Vector2D interface id, C-106) of a fresh 0x240-byte "
                  "BASE-CLASS MOVEMENT OBJECT P (factory 0x9C2911, ctor 0x9C28BF on base 0x9BC2EB, vtables 0xB0C660 primary / 0xB0C5B0 iface2; movement-family "
                  "derived vtables 0xB0C760/0xB0C870/0xB0C970/0xB0CA70 at 0x110 stride); the X/Y getters used by the Set (0x404B07/0x404B2E -> [P-vt+0x20/+0x28] "
                  "= 0x9C0FEF/0x9C105F) forward to slot+0x8C (0x9C1499) which — the delegate slot [P+0x1C] having no writer but the ctor zero — returns a "
                  "TIME-EXTRAPOLATED position X = round(dec(P+0x20) + (dec(P+0x80) - dec(P+0x20))·k), k = elapsed·(1/30) ([0xB0C5A8]=1/30; decryptor 0x548806 / "
                  "encryptor 0x6131F4 — the same encrypted slot-pair machinery as the movement chain with x@+0x20/y@+0x38/vx@+0x50/vy@+0x68); INITIAL COORDINATES "
                  "COME FROM SERVER PACKET OPCODE 0xCE (dispatcher band 0xBC..0xCE at 0x97FAC9, arm 0x97FB7A -> 0x99142A decodes v1..v4 -> user-vt+0x7C 0x948DE7 "
                  "-> W ctor): X=v1, Y=v2, string-id=v4, installed as (X±1, Y-0x14) into P's base slots (0x9BC622 via the W ctor; ±1 by the camera-null branch "
                  "0x5BFEEA-0x5BFEF6; -20 at 0x5BFF04), clamped to the map-bounds block [P+0x138..0x140] copied from [[0xBDD498]+0x24] (0x9BC602), with the target "
                  "slots mirrored at ctor (base==target, rep movsd @0x9BC749) so the camera holds the packet point until a Set lands; the outer consumer "
                  "0x93839F takes receiver = [[user+0x1C30]+4] = W (installed by scene handler 0x5EBAB1 (vtable 0xB02FB8 slot+0x20) via 0x5D5377 with arg4 = "
                  "[obj9C+0x68], a smart-ptr wrapper X whose +4 = W) and runs 0x5C0349(W) which refreshes [W+0x24/+0x28] from P via [[W+0x14]+0x8C], gates on "
                  "[P+0x238]!=0, and branches by user-vt+0xC (0x935076) to W's own methods 0x5C02CB/0x5C0327 — BOTH Set-capable callers (0x5C0342 direct; "
                  "0x959493 via 0x9573A6 with arg7=W from 0x5C031A) DELIVER THE SAME OBJECT W; the 14 E8 callers of 0x9573A6 are 13 PROVEN-NULL arg7 "
                  "(dominance-proven zero registers) + the single 0x5C031A object site; the `this` of 0x93CB27/0x9573A6 = [W+0x10] = the USER (vtable 0xB0BCE8, "
                  "ctor 0x9343EF family that zeroes +0xF28); ARG3 vs [user+0xF28]: DISTINCT-DATAFLOW-PROVEN — W is installed at user+0x1C30 (disjoint field from "
                  "+0xF28), the Set never reads F28, the unknown-tag fill path 0x4B1C27 replaces arg3 with [user+0xF28] and SKIPS the Set; RESIDUALS (honest): "
                  "the ongoing Set driver of P's target slots (vtable slot+0x90->+0x40 = 0x9C1113 has zero direct E8 callers; the dispatch site on W's P is not "
                  "byte-located), the [P+0x238] arm dispatch for the base class, the Eye-side writer of [obj9C+0x68], and T090's remaining F28 lea sites "
                  "(2 of 13 now classified read/release: 0x949B46 read via 0x44484B, 0x934B9E release via 0x4063B5)"),
        "status": "CLOSED-STATIC",
        "evidence_grade": "A",
        "evidence_refs": "EV-108;EV-94;EV-107;EV-93",
        "binary_identity": "unpack079",
        "address": "0x5BFE8C;0x948DE7;0x97FB7A;0x99142A;0x9C2911;0x9C28BF;0x9BC602;0x9BC622;0x5C1A08;0x9C0EC0;0x9C0FEF;0x9C105F;0x9C1499;0x9C1113;0x5C0349;0x5C02CB;0x5C0327;0x93839F;0x5D5377;0x5EBAB1;0x5C0342;0x959493;0x5C031A;vtables 0xB0BC40/0xB0BC64/0xB0C660/0xB0C5B0/0xB0BCE8/0xB02FB8",
        "reasoning": ("two independent identification routes agree: (1) ctor+vtable (allocation sizes, final vtable installs at 0x94B9A5-0x94B9AB and "
                      "0x9C28CE-0x9C28D4, sub-object and owner installs) and (2) usage+dataflow (W methods reading exactly the ctor-installed members; "
                      "0x9573A6 reading W-vt+0x10 = &W+0x24 under tag 0xD7511E; 0x93CD77 AddRef-getter shape on [W+0x14]); the caller classification uses "
                      "per-site dominance proofs of the first-pushed (7th) stack argument at all 14 E8 callers of 0x9573A6 and the 10 callers of 0x93CB27"),
        "falsification": ("a byte-located dispatch site calling [P-vt+0x90]/[+0x40] on W's P with coordinate args incompatible with the packet-driven "
                          "follow interpretation, or a second non-null arg7 caller of 0x9573A6, or a direct writer storing W into [user+0xF28]"),
        "supersedes": "resolves the C-109 Set-path member-writer residual (no reversal of C-109/C-115/C-119)",
        "affected_documents": ("forensics/T091-FOCUS-OBJECT-PROVENANCE.md;forensics/T091-ARG3-CALLER-IDENTITY.csv;"
                               "forensics/T091-ARG3-MEMBER14-WRITERS.csv;forensics/T091-FOCUS-CHAIN-DISASM.txt;"
                               "T091-G10-FOCUS-PROVENANCE-REPORT.md"),
    })
    print("C-120 appended")

write(CLAIMS, f, rows)
print(f"claims now {len(rows)}")

# ---------- gaps.csv: G10 ----------
f, rows = read(GAPS)
for r in rows:
    if r["gap_id"] == "G10":
        if "t091: FOCUS-OBJECT PROVENANCE CLOSED" in r["verified_scope"]:
            print("G10 already updated")
        else:
            r["verified_scope"] = (r["verified_scope"] +
                "; t091: FOCUS-OBJECT PROVENANCE CLOSED (C-120) — arg3 = W the per-focus 0x48-byte camera-focus wrapper "
                "(vtables 0xB0BC40/0xB0BC64, ctor 0x94B8F7/0x94B92D/0x5BFE8C); [[arg3]+0x14] = QI(IID 0xBA0500) view of a fresh "
                "0x240-byte base movement object P (0x9C2911/0x9C28BF, vtables 0xB0C660/0xB0C5B0) whose X/Y getters return an "
                "encrypted-slot extrapolated position; initial coordinates from SERVER PACKET OPCODE 0xCE (X±1, Y-20, map-bounds "
                "clamped); both Set-capable callers deliver the same W; 13/14 callers of 0x9573A6 proven arg7=0; the Set `this` = "
                "the user ([W+0x10]) and arg3-vs-F28 = DISTINCT-DATAFLOW-PROVEN (W @ user+0x1C30 vs F28 @ user+0xF28; the Set "
                "never reads F28)")
            r["unresolved_scope"] = (
                "t091 residuals inside the closed chain: the ONGOING Set driver of P's target slots (vtable slot+0x90->+0x40 "
                "= 0x9C1113; zero direct E8 callers; dispatch site not byte-located) and the [P+0x238] arm dispatch (gate of "
                "0x5C0349; base ctor zeroes it; derived-entry setters decoded, dispatch site not located); Eye-side writer of "
                "[obj9C+0x68] (the W-wrapper install into the scene); T090's remaining F28 lea sites (11 undecoded; 2 now "
                "classified read/release). Carried residuals from t090 (unchanged): E2/E3 pump interleaving (statically "
                "undecidable); wrapper persistence across scene transitions; receiver linkage for the 18 SHARED-WRITE-CONTEXT-POSSIBLE "
                "sites; slot15-family scene +0x1CC installer (t088.1 retained: base-table install chain known, 32 derived tables' "
                "construction untraced; [scene+0x1CC] class identity unproven); NO 0x00641EF1-equivalent clamp traced (T089 list)")
            r["next_action"] = (
                "STATIC: locate the vtable dispatch sites for P's Set (call [reg+0x90]/[reg+0x40] with receiver [W+0x14]) and the "
                "[P+0x238] arm entry (0x9C3DAD family) — the last unclosed edges of the focus-position write path; wrapper lifecycle "
                "(record retirement/scene switch); E2/E3 message phase; the 18 receiver-alias sites; slot15 derived-table "
                "construction chain (from base-ctor sites 0x52F1BC/0x52F1CF/0xA0B39E/0xA0BB2A + shared init 0x52F37F); then "
                "re-evaluate G10 closure. [t091 WP0-C: the t090 filtered-consumer task item (closed by C-116) removed from the list]")
            print("G10 updated")
write(GAPS, f, rows)

# ---------- evidence.csv: EV-108 ----------
f, rows = read(EVID)
if not any(r["evidence_id"] == "EV-108" for r in rows):
    rows.append({
        "evidence_id": "EV-108",
        "source_file": ".work/task-036/game-image-unpacked.bin",
        "source_sha256": "d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718",
        "address": ("0x97FB7A;0x99142A;0x948DE7;0x94B8F7;0x94B92D;0x5BFE8C;0x9C2911;0x9C28BF;0x9BC2EB;0x9BC602;0x9BC622;0x5C1A08;0x9C0EC0;0x9C0FEF;0x9C105F;0x9C1499;0x9C1113;0x9C16DD;0x9C3DAD;0x5C0349;0x5C02CB;0x5C0327;0x93839F;0x5D5377;0x5EBAB1;0x5C0342;0x959493;0x5C031A;0x948E48;vtables 0xB0BC40/0xB0BC64/0xB0C660/0xB0C5B0/0xB0BCE8/0xB02FB8/0xB02FB8-family;[0xB0C5A8]=1/30"),
        "evidence_type": "instruction+data (capstone byte-anchored disasm)",
        "instruction_or_data": ("opcode-0xCE arm push edi/mov ecx,esi/call 0x99142A; 0x99142A 4x call 0x4066FF + push v2/v1/[esp+0x1C]/v4 + call 0x948DE7; "
                                 "0x94B902 push 0x48; 0x94B9A5/0x94B9AB mov [edi],0xB0BC64 / mov [esi],0xB0BC40; 0x5BFE8C ctor member stores + 0x9C2911 + 0x9BC602(P,W) + "
                                 "[edx+4]=0x9BC622(P,1,X+-1,Y-0x14,0,0,P) + 0x5C1A08 QI(0xBA0500) at &[ebx+0x14]; 0x9C28BF vtable installs 0xB0C660/0xB0C5B0 + and [esi+0x238],0; "
                                 "0x9C0EC0 QI IID set {0xB0E760,0xBD37B0,0xBA0378,0xBA0500} self-return; 0x9C0FEF/0x9C105F forward to [edx+0x8C]; 0x9C1499 [esi+0x10] delegate-null "
                                 "-> 0x9C1529-0x9C15E6 extrapolation (fmul [0xB0C5A8]=1/30, 0x548806 decrypt, round via [0xAFEC20]/[0xB00D60]); 0x9BC676-0x9BC6C4 encrypt x/y/vx/vy "
                                 "via 0x6131F4 to P+0x20/38/50/68; 0x9BC749 rep movsd mirror to P+0x80; 0x5C0349 refresh via [[W+0x14]+0x8C] + gate [P+0x238] + branch user-vt+0xC; "
                                 "0x93835F-0x93839F receiver=[[user+0x1C30]+4]; 0x5D5377 group install +0x1C24..0x1C30; 0x5EBBFD-0x5EBC0C arg4=[obj9C+0x68]; "
                                 "14 caller windows of 0x9573A6 with first-push dominance proofs (13 zero + 1 object)"),
        "interpretation": ("arg3 = W (same object at both Set-capable sites); [[arg3]+0x14] = QI(P, IID 0xBA0500) IVector2D view of the 0x240-byte base movement object P; "
                            "X/Y = extrapolated encrypted-slot positions seeded by packet opcode 0xCE (X±1, Y-0x14, map-bounds clamped from [[0xBDD498]+0x24]); "
                            "the Set this = the user ([W+0x10]); F28 = distinct dataflow (unknown-tag fill path only, Set skipped)"),
        "claim_id": "C-120",
        "reproducibility": ("python research/scripts/t091_dump_chain.py (byte dump with raw opcode columns -> T091-FOCUS-CHAIN-DISASM.txt); "
                             "python research/scripts/t091_wp1b_9573a6_callers.py + t091_wp1b_reg_origin.py (caller classification); "
                             "python research/scripts/t091_update_ledgers.py (ledger rows)"),
    })
    print("EV-108 appended")
write(EVID, f, rows)
print(f"evidence now {len(rows)}")
