#!/usr/bin/env python3
"""T088 WP0 + ledger integration (one-shot, audit-preserved).

Fixes the three T087-acceptance findings and integrates the T088 results:
  F1  EV-92 instruction_or_data: old 0x98 routing -> byte-accurate routing
      (states 0|1|6 -> 0x564FBE / 2|5 -> 0x564E52 / 3|4 -> 0x56512A or
      fallback 0x564E52; only state<0 or >6 no-op).
  F2  P2-01 readiness ORIGINAL-STATIC-PROVEN -> PRODUCT-READY (report-level
      label retained inside evidence_grade_and_type).
  F3  P4-07 refresh (no stale runtime/stale identity tasks) + the
      'seven funnel callers PLUS direct-slot family' wording in
      P2-01/P2-05/P2-06.

New ledger content: C-106..C-109, EV-93..EV-97, G10 scope rewrite,
C-103/C-028 revision notes.
"""
import csv
import io
import os
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SOT = os.path.join(REPO, "research", "source-of-truth")
MATRIX = os.path.join(REPO, "research", "result", "stage-readiness",
                      "P0-P4-REQUIREMENT-EVIDENCE-MATRIX.csv")


def read_csv(path):
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.reader(f))


def write_csv(path, rows):
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerows(rows)


def main():
    # ---------------- evidence.csv ----------------
    ev = read_csv(os.path.join(SOT, "evidence.csv"))
    hdr, rows = ev[0], ev[1:]
    for r in rows:
        if r[0] == "EV-92":
            r[5] = ("G17 BOAT payload grammars: router 0x5658FF (0x97->0x565935, 0x98->0x56599A, default 0x54112E); "
                    "0x97 = sub-opcode dispatcher (first byte 7..12; sub 7/9/11 EMPTY ret-4 stubs; sub 8 arg==2 -> 0x564E52; "
                    "sub 10 arg 4->0x56512A / 5->0x565492; sub 12 arg==6 -> 0x564FBE); "
                    "0x98 = 2-byte state machine (SIGNED compares; only state<0 or state>6 is a no-op — "
                    "t088 ledger fix per t087-reviewer correction: states 0|1|6 -> 0x564FBE when [this+0x774]==0; "
                    "states 2|5 -> 0x564E52 when ==0; states 3|4 -> 0x56512A when [this+0x774]==1 && flag==1, "
                    "else 0x564E52 when ==0); boat object this+0x768, docked-state this+0x774; "
                    "0x564FBE/0x564E52 resolve namespace id 0x43A='Whistle' (sound)")
        elif r[0] == "EV-90":
            # clarify writer #6/#7 (t088) inside the interpretation, correction-context marker kept
            r[6] = r[6].replace(
                "field writers 0x9E6D18 record pair +0x38/+0x3C and 0x9F1ADF packed 16:16 coord; PLUS",
                "funnel callers 0x9E6D18 and 0x9F1ADF (t088 re-classification in C-107/EV-94: both are "
                "CURSOR-mode writers — enumeration-callback PtInRect gate / window-proc mouse band lParam — "
                "not world-space gameplay writers); PLUS")
    new_ev = [
        ["EV-93", "research/result/stage-readiness/forensics/T088-VECTOR2D-ID31D-RESOLVE-CENSUS.csv",
         "3a26cd4fa31ea975be3e78643f15d39de07bd688c50061055d7fc3c3e03f65cc",
         "80 resolve sites (63 push 0x31D + 17 mov r32,0x31D); 501 call [reg+0x90] encodings; 39 joined candidates",
         "census",
         ("63 push 0x31D + 17 mov r32,0x31D sites in band; per-site 0x447891 attach targets; 501 slot+0x90 "
          "encodings; 39 resolve-joined candidates with receiver/args/variant decode"),
         ("resolve-site census: 12 persistent-field aliases incl [fieldctx+0xD4]/[singleton+0x9B0]/"
          "[edi+0xE30-E38]/[esi+0x28D0], rest stack-slot transients; companion classification CSV "
          "sha256=828e501ff5304e4a82b3e694c2fb99eea63ffe7ba9fed952ba18be97f7bd24c5 (39 candidates: "
          "2 CONFIRMED-CAMERA-WRITER, 10 CONFIRMED-SHARED-WRITE-CONTEXT-UI, 2 RECEIVER-OTHER, "
          "25 INCONCLUSIVE; 33/39 carry the default V{VT_ERROR,missing} builder)"),
         "C-106;C-109", "research/scripts/t088_wp1_id31d_census.py (sha-pinned, LF canonical)"],
        ["EV-94", "research/result/stage-readiness/forensics/T088-FIELD-9E6CA4-CFG.txt",
         "aa5e48e001ccce05db267467f8502155e3e5b753a0803baa027b3ad326df902e",
         "0x9E6CA4-0x9E6E37; 0x9E649A head+tail; 0x9F1784-0x9F1B60; 0x93CB27-0x93CD74; 10 caller windows",
         "instruction",
         ("writer #6 callback gates G1-G5 + Set 0x5CA91A; singleton base-read seeding at 0x9E6C30; "
          "writer #7 mouse-band unpack shr16/movzx + gate [singleton+0xC]==0; focus writer body + "
          "0x769B51 caller idiom x10"),
         ("writer #6 path predicate (5 conjunctive gates incl PtInRect; point = screen cursor via "
          "0x5CABE1); writer #7 window-proc mouse band (lParam 16:16 client mouse point); focus writer "
          "0x93CB27 full body + 10-caller census (N in {500,800,1000}); companion file sha256="
          "ad04fcb08f8fb6d26eb0431e59b8418d35d50f3d0328e3856ce353c33c4c6ecd"),
         "C-107;C-109", "research/scripts/t088_wp2_field_writers.py (sha-pinned, LF canonical)"],
        ["EV-95", "research/result/stage-readiness/forensics/T088-SHAPE2D-VECTOR2D-SET-SEMANTICS.txt",
         "744064f086192587a76eb0bc9408006f46e1033601bfb4b48152d70a84ef7f1a",
         "Shape2D.dll 0x514018EB-0x51401910; 0x5140C2F0 table; 0x5140828F-0x5140833B; 0x514081F0; "
         "0x5140724A; 0x514074C8; PCOM.dll 0x50C04CD1-0x50C04DA6; Shape2D 0x5140106D; "
         "0x51402FB6-0x51403081; EXE 0x447891",
         "instruction",
         ("CWzVector2D vtable/ctor/getters/Set bodies; PCOM PcCreateObject protocol; Shape2D "
          "DllGetClassObject + factory 0x51402FB6 lazy-singleton record walk; EXE 0x447891 = "
          "PcCreateObject wrapper with IID 0xBA0500"),
         ("Set semantics: immediate int store on VT_ERROR/VT_EMPTY defaults vs time-interpolated "
          "(V3 VT_I4 duration, V4&0x10000000 flags, pending list [this+0x30]); creation chain = "
          "registry lazy-SINGLETON (record+0x10 cached instance + QI); IID@0xBA0500 = "
          "{F28BD1ED-3DEB-4F92-9EEC-10EF5A1C3FB4} = Shape2D 0x514101C0"),
         "C-106;C-108", "research/scripts/t088_wp3_shape2d_set.py (sha-pinned over 3 binaries)"],
        ["EV-96", "research/result/stage-readiness/forensics/T088-CAMERA-CADENCE-DEADZONE.md",
         "a4b859d9e1c8a862fb8b7501e2d45f02049dd4e0aa66b3dfead49a4a6b90fcfe",
         "n/a (synthesis over EV-93/EV-94/EV-95 bodies)", "analysis",
         "ten-question cadence/deadzone matrix with per-question evidence boundaries",
         ("NO per-tick camera writer in the decoded set; NO deadzone/smoothing constant in any decoded "
          "gate (bounded to decoded bodies); Shape2D interpolation never armed by camera-relevant sites "
          "(defaults proven immediate end-to-end); writers #6/#7 cursor-mode; focus writer 0x93CB27 = "
          "event/script-driven follow candidate with the [F28+0x14] residual"),
         "C-107;C-108;C-109", "derived from EV-93/EV-94/EV-95 (all instruction-level)"],
        ["EV-97", "research/result/stage-readiness/forensics/T088-CAMERA-BOUNDS-SCENE-PORTAL.md",
         "fa851184d187bd0d78b649438ebe6036a199cc9d2a3174124930df4d4b4da8e4",
         "slot15 0x53471A; 31 +0x1CC mov/lea sites; 9 direct +0x1CC writers; 33 slot15-family tables",
         "instruction+census",
         "slot15 cull window re-dump; +0x1CC full-band probe census; family-vtable install checks; "
         "portal ordering edge table",
         ("camera-side map-bounds clamp NEGATIVE (bounded to decoded writer bodies; bounds on the "
          "consume side slot15 + VR fold); [scene+0x1CC]: none of the 9 direct writers installs a "
          "slot15-family vtable and the 33 family tables have no imm32 code reference — installer "
          "UNLOCATED (bounded negative); portal->camera edges typed (E1 synchronous focus write in "
          "portal-trigger/packet-spawn stacks; E2/E3 message-driven, pump-phase interleaving "
          "statically undecidable)"),
         "C-109", "research/scripts/t088_wp4_scene_portal.py (sha-pinned, LF canonical)"],
    ]
    rows.extend(new_ev)
    write_csv(os.path.join(SOT, "evidence.csv"), [hdr] + rows)
    print(f"evidence.csv: {len(rows)} rows (EV-92 fixed, +EV-93..EV-97)")

    # ---------------- claims.csv ----------------
    cl = read_csv(os.path.join(SOT, "claims.csv"))
    hdr, rows = cl[0], cl[1:]
    for r in rows:
        if r[0] == "C-103":
            r[7] = ("t088 REVISION of the writer-set reading (C-107/EV-94): funnel callers 0x9E6D18/0x9F1ADF "
                    "are CURSOR-mode writers (enumeration PtInRect gate over the singleton base-read point; "
                    "window-proc mouse band lParam), NOT world-space gameplay writers; the closest "
                    "player-follow candidate is the DIRECT focus writer 0x93CB27 (C-109). " + r[7])
            r[6] = "EV-89;EV-90;EV-93;EV-94"
        elif r[0] == "C-028":
            r[6] = "EV-21;EV-89;EV-90;EV-94;EV-95;EV-96"
            r[8] = (r[8] + " t088 (C-106..C-109/EV-93..EV-96): the write machinery is event-driven "
                    "(no per-tick writer in the decoded set) and immediate (Shape2D Set callee-side proof); "
                    "the cadence/deadzone residual is now bounded to the [F28+0x14] target semantics and the "
                    "25 INCONCLUSIVE census sites.")
    new_cl = [
        ["C-106", "Camera",
         "G10 SHARED-OBJECT CLOSURE (t088, EV-93/EV-95): the namespace id 0x31D create chain is a PER-CLASS "
         "SINGLETON — EXE 0x447891 is NOT an AddRef attach but PcCreateObject(nameRecord, IID@0xBA0500="
         "{F28BD1ED-3DEB-4F92-9EEC-10EF5A1C3FB4}, &slot, extra) (bytes re-verified; IID == Shape2D "
         "0x514101C0); PCOM PcCreateObject 0x50C04CD1 resolves the name in the runtime registry and invokes "
         "the class entry slot3; Shape2D DllGetClassObject 0x5140106D name-keys L'Vector2D' -> factory "
         "0x51402FB6 whose registry record ([0x51411660] table, stride 0x24/0x1C, GUID-keyed) caches THE "
         "instance at record+0x10 (lazy create once via [record+8]([record+0xC],0x5140DA0C,&rec+0x10), then "
         "always reused + QI). Therefore every one of the 80 EXE resolve sites (63 push 0x31D + 17 mov "
         "r32,0x31D) aliases THE ONE shared CWzVector2D (primary vtable 0x5140C2F0 installed by ctor "
         "0x514018ED; X/Y int fields +0x1C/+0x20; getters slot+0x20 0x5140724A / slot+0x28 0x514074C8 = EXE "
         "0x404B07/0x404B2E); persistent aliases include [fieldctx+0xD4], [singleton+0x9B0], "
         "[edi+0xE30/+0xE34/+0xE38], [ebx+0x18], [ebx+0x38], [esi+0x44], [esi+0x30], [ebx+0x120], "
         "[esi+0x28D0] — the 'camera' is ONE global mutable vector consumed by scene-cull (slot15), "
         "world->screen (0x9EA446), the cursor/UI surfaces, and the focus writer",
         "CLOSED-STATIC", "A", "EV-93;EV-95", "unpack079+Shape2D.dll+PCOM.dll",
         "0x447891;0xBA0500;0x50C04CD1;0x5140106D;0x51402FB6;0x51403029;0x5140C2F0;0x5140828F",
         "factory walk + QI protocol decoded instruction-level on both sides of the module boundary; "
         "80-site alias census machine-generated",
         "a second creation path for 'Shape2D#Vector2D' returning a distinct instance (none in the decoded "
         "factory; falsifier = any PcCreateObject bypass writing record+0x10 twice with distinct pointers)",
         "(none)", "T088-CAMERA-CADENCE-WRITER-CLOSURE-REPORT.md;forensics/T088-SHAPE2D-VECTOR2D-SET-SEMANTICS.txt"],
        ["C-107", "Camera",
         "G10 FIELD-WRITER TRIGGER RE-CLASSIFICATION (t088, EV-94; corrects the T087 reading of funnel "
         "writers #6/#7 as world-space gameplay writers): writer #6 0x9E6D18 fires inside callback "
         "0x9E6CA4 (registered by the surface-present fn 0x9E649A tail via [0xBE1554](0x9E6CA4, ctx)); its "
         "record +0x38/+0x3C are seeded by the SINGLETON BASE READ 0x5CABE1 (screen cursor) at 0x9E6C30 and "
         "the write path requires FIVE conjunctive gates (hwnd != keyboard-focus [[0xBDD89C]+4]; IsWindow "
         "[0xBE1718]; GetClientRect-style [0xBE16F4]; IsRectEmpty-style [0xBE175C]==0; PtInRect [0xBE1734] "
         "over the cursor point) — CURSOR-followed mode; writer #7 0x9F1ADF fires in the window-proc "
         "0x9F1784 MOUSE band (msgs 0x200..0x206 and 0x20A): y=lParam>>16, x=(word)lParam (Win32 packed "
         "client-space mouse point, unsigned words, no extra sign extension) with the single gate "
         "[singleton+0xC]==0 (active input-device slot empty), then 0x5CA91A(singleton,x,y) — also cursor "
         "mode; NO distance/threshold constant appears in any gate; the 0x9E649A present path has an "
         "EQUALITY re-draw guard (skip only when both coords unchanged), not a deadzone",
         "CLOSED-STATIC", "A", "EV-94", "unpack079", "0x9E6CA4;0x9E6C30;0x9E6D18;0x9F1784;0x9F1AC8;0x9F1ADF",
         "both trigger chains decoded end-to-end from raw bytes with path predicates; caller/callee "
         "convention and gate semantics instruction-level",
         "a world-coordinate source reaching either writer (both inputs proven screen-space)",
         "(none)", "T088-CAMERA-CADENCE-WRITER-CLOSURE-REPORT.md;forensics/T088-FIELD-9E6CA4-CFG.txt"],
        ["C-108", "Camera",
         "G10 SET SEMANTICS (t088, EV-95): CWzVector2D Set (primary vtable 0x5140C2F0 slot +0x90, body "
         "0x5140828F, ret 0x2C = this,x,y,V3(16B),V4(16B)) — if V3.vt in {VT_EMPTY, VT_ERROR}: IMMEDIATE "
         "store [this+0x1C]=x, [this+0x20]=y (or the aux-notified store 0x51407A34 when [this+0x24]!=0); "
         "else INTERPOLATED: 0x514081F0 coerces V3 to VT_I4 duration (global-tick units [0x51411C34]), "
         "flags = V4 & 0x10000000, record assembled by 0x51407FE1 and committed by 0x5140833B into the "
         "[this+0x30] pending-animation collection; slot+0x94 (0x514083CF) is the relative-Move variant "
         "with the same V3 gate. Every classified camera-relevant call site passes V{VT_ERROR,missing} "
         "defaults (22/39 census sites carry the 0x40318F(0xBE7330) default builder; both confirmed camera "
         "writers do) => the camera write path NEVER arms interpolation and 0x5CA91A's "
         "camera:=point-(400,300) is an unconditional immediate write END-TO-END (caller AND callee); "
         "EV-41's V{VT_I4,phase}+V{VT_I4,0x10000000} call arms the machinery on a per-object Vector2D "
         "(tiling scroll), not on the shared camera",
         "CLOSED-STATIC", "A", "EV-95", "Shape2D.dll", "0x5140828F;0x514081F0;0x51407FE1;0x5140833B;0x514083CF",
         "callee-side body decode closes the T087 open sub-question (default-VARIANT semantics) with "
         "instruction-level proof on both the immediate and interpolated branches",
         "a camera-relevant site arming V3 with a non-empty VARIANT (census: none among classified sites)",
         "(none)", "T088-CAMERA-CADENCE-WRITER-CLOSURE-REPORT.md;forensics/T088-SHAPE2D-VECTOR2D-SET-SEMANTICS.txt"],
        ["C-109", "Camera",
         "G10 FOCUS-WRITER FAMILY (t088, EV-94/EV-93): direct shared-V2D Set site 0x93CC9B inside "
         "0x93CB27(this, scriptRecord) — shared-object create chain 0x7A48D0/0x40634C/0x447891 at "
         "0x93CBBE-0x93CBDD, default variants, then Set(X(src), Y(src)) with src = [[this+0xF28]+0x14] "
         "(AddRef getter 0x93CD77; X via 0x404B07/[vt+0x20], Y via 0x404B2E/[vt+0x28]); gates: record "
         "present, [this+0x3B8]==0, payload count ([eax-4]>>1)!=0, record tag in {0x4F5C6A, 0xD7511E} "
         "(unknown tags take the 0x4B1C27(this,&arg3) fill-and-skip path); EXACTLY 10 E8 callers "
         "(0x5C0342 N=0x320; 0x93E00B/0x959493/0x959527 N=0x3E8; 0x964E16 N=0x3E8 same-map portal-trigger "
         "family; 0x9651CC/0x965567 seat region; 0x98DC43 N=0x1F4 packet-spawn family; 0x990E21/0x990E91 "
         "user region) with the uniform idiom 0x769B51([0xBD8FEC], string_id, N, 0) -> record -> "
         "0x93CB27 — an EVENT/SCRIPT-driven focus (portal/spawn camera focus candidate), NOT a per-tick "
         "updater; NO -(400,300) offset at this site (funnel bypassed); BOUNDED: src is a private position "
         "object of the avatar-container class (NOT a 0x31D alias — no +0x14 attach exists among the 80 "
         "resolve sites), and its writer census (whether src tracks the avatar draw position centred, "
         "top-left, or scripted offsets) is the remaining semantic half",
         "PARTIAL-STATIC", "B", "EV-94;EV-93", "unpack079",
         "0x93CB27-0x93CD74;0x93CC9B;0x93CBBE;0x93CD77;0x769B51;10 caller sites",
         "full body + caller census instruction-level; the target-object semantics bounded (its writers "
         "not yet censused)",
         "a writer of [[user+0xF28]+0x14] storing values incompatible with a follow-focus interpretation",
         "(none)", "T088-CAMERA-CADENCE-WRITER-CLOSURE-REPORT.md;forensics/T088-PACKED-COORD-WRITER-CALLGRAPH.txt"],
    ]
    rows.extend(new_cl)
    write_csv(os.path.join(SOT, "claims.csv"), [hdr] + rows)
    print(f"claims.csv: {len(rows)} rows (C-103/C-028 revised, +C-106..C-109)")

    # ---------------- gaps.csv ----------------
    gp = read_csv(os.path.join(SOT, "gaps.csv"))
    hdr, rows = gp[0], gp[1:]
    for r in rows:
        if r[0] == "G10":
            r[3] = ("PARTIAL-STATIC")
            r[4] = (
                "VR fold A (C-026); scene-manager skeleton (C-084); t086 (C-101/EV-87) slot15 caller census; "
                "t086.1 (C-102/EV-88) consumption chain; t087 (C-103/C-104, EV-89/90/91) object identity "
                "(Shape2D#Vector2D) + write formula camera:=point-(400,300) + screen<->world converters; "
                "t088 (C-106..C-109, EV-93..EV-97): (a) SHARED-SINGLETON CLOSURE — the 0x31D create chain "
                "(EXE 0x447891=PcCreateObject wrapper; PCOM registry; Shape2D factory 0x51402FB6 "
                "lazy-singleton record+0x10) aliases ALL 80 resolve sites to ONE CWzVector2D (vtable "
                "0x5140C2F0; x/y int +0x1C/+0x20; getters +0x20/+0x28); (b) SET SEMANTICS (C-108/EV-95) — "
                "immediate int store on VT_ERROR/VT_EMPTY defaults, time-interpolation engine (VT_I4 "
                "duration, flag 0x10000000) exists but is NEVER armed by camera-relevant sites: the camera "
                "write is immediate end-to-end; (c) TRIGGERS (C-107/EV-94) — funnel writers #6/#7 "
                "re-classified CURSOR-mode (enumeration-callback PtInRect over the singleton base-read "
                "point / window-proc mouse band lParam with [singleton+0xC]==0 gate); (d) FOCUS WRITER "
                "(C-109/EV-94) — direct shared-V2D Set 0x93CC9B in 0x93CB27, 10 event callers (portal-trigger "
                "0x964E16, packet-spawn 0x98DC43, seat, input, user regions) via 0x769B51 script records; "
                "(e) CADENCE (EV-96) — NO per-tick camera writer in the decoded set (all writers "
                "event/message-driven); NO deadzone/smoothing constant in any decoded gate (negative "
                "bounded to the decoded bodies: funnel+callbacks+window-proc+focus writer+Shape2D Set); "
                "(f) BOUNDS (EV-97) — no map-edge clamp on any decoded camera write; bounds live on the "
                "consume side (slot15 cull window) and load side (VR fold)")
            r[5] = (
                "[[user+0xF28]+0x14] writer census (the focus-writer target object's semantics — centred "
                "follow vs top-left vs scripted offsets; it is a private position object, not a 0x31D "
                "alias); 25 INCONCLUSIVE direct-slot census sites (containing-function bodies not fully "
                "decoded — possible additional write contexts or clamps bounded to those functions); "
                "slot15-family scene +0x1CC installer (9 direct +0x1CC writers are all OTHER classes; 33 "
                "family vtables have no imm32 code ref — indirect construction path unpinned); "
                "message-pump phase interleaving of cursor-driven writes vs scene draw (statically "
                "undecidable); camera-vs-map-edge clamp: negative only within decoded writers")
            r[7] = ("STATIC: census the writers of [[user+0xF28]+0x14] (avatar-container position class) to "
                    "close the focus-writer semantics; decode the 25 INCONCLUSIVE containing functions; "
                    "then re-evaluate G10 closure")
            r[9] = "C-026;C-028;C-101;C-102;C-103;C-104;C-106;C-107;C-108;C-109"
    write_csv(os.path.join(SOT, "gaps.csv"), [hdr] + rows)
    print("gaps.csv: G10 rewritten (PARTIAL-STATIC kept)")

    # ---------------- matrix ----------------
    mx = read_csv(MATRIX)
    hdr, rows = mx[0], mx[1:]
    idx = {c: i for i, c in enumerate(hdr)}

    def setrow(rid, col, val):
        for r in rows:
            if r[idx["requirement_id"]] == rid:
                r[idx[col]] = val
                return True
        return False

    # F2: P2-01 readiness + wording
    setrow("P2-01", "readiness", "PRODUCT-READY")
    setrow("P2-01", "evidence_grade_and_type",
           "A（t087 指令级：world→screen = world − camera 已静态恢复；相机初值 (-400,-300)；EV-89/EV-90；"
           "报告级标签 ORIGINAL-STATIC-PROVEN 保留于此说明列，不进入 readiness 枚举）")
    setrow("P2-01", "minimum_next_work",
           "（已静态闭合变换层）相机跟随节奏/焦点写入者语义见 P2-05/P2-06（t088：0x93CB27 焦点写入者家族已定位，"
           "[F28+0x14] 目标语义为剩余半边）")
    # P2-05
    setrow("P2-05", "claim_ids", "C-028;C-102;C-103;C-104;C-106;C-107;C-109")
    setrow("P2-05", "evidence_ids", "EV-21;EV-88;EV-89;EV-90;EV-91;EV-93;EV-94")
    setrow("P2-05", "evidence_grade_and_type",
           "A（t087：相机对象身份+写入公式+7 个 0x5CA91A 漏斗调用点；t088：全部 80 个命名空间解析点经 "
           "PCOM/Shape2D 注册表惰性单例闭包为同一共享 CWzVector2D；漏斗 #6/#7 定标为光标模式（枚举回调 "
           "PtInRect 门/窗口过程鼠标带 lParam 门）；直接 [vt+0x90] 家族 39 候选分类：2 CONFIRMED-CAMERA-"
           "WRITER（fieldctx ctor 初始 + 0x93CB27 焦点写入者）、10 CONFIRMED-SHARED-WRITE-CONTEXT-UI、"
           "2 RECEIVER-OTHER、25 INCONCLUSIVE）")
    setrow("P2-05", "unproven",
           "写入者集合=7 个 0x5CA91A 漏斗调用点（全部光标/UI 事件驱动）另有直接 [vt+0x90] 写入家族"
           "（39 候选已逐项分类，25 个 INCONCLUSIVE 含函数体未全解码）；焦点写入者 0x93CB27 的目标对象 "
           "[[user+0xF28]+0x14] 语义未闭合（其写入者未普查）；无每 Tick 相机写入者（限界于已解码函数体）")
    setrow("P2-05", "minimum_next_work",
           "STATIC：普查 [[user+0xF28]+0x14] 位置对象的写入者（关闭焦点写入者几何语义）；解码 25 个 "
           "INCONCLUSIVE 普查点的包含函数")
    setrow("P2-05", "can_static_continue_or_runtime",
           "STATIC 追 [[user+0xF28]+0x14] 写入者普查与 INCONCLUSIVE 站点解码；产品可按 T087/T088 契约（§5 参数化）实施")
    # P2-06
    setrow("P2-06", "claim_ids", "C-028;C-103;C-107;C-108;C-109")
    setrow("P2-06", "evidence_ids", "EV-21;EV-89;EV-90;EV-94;EV-95;EV-96")
    setrow("P2-06", "evidence_grade_and_type",
           "A（t088 双侧证明：Shape2D Set 被调体 0x5140828F —— VT_ERROR/VT_EMPTY 默认参=立即整型存储，"
           "时间插值引擎存在但相机相关站点从未武装；漏斗+回调+窗口过程+焦点写入者门内无任何距离阈值常量；"
           "负结论限界于已解码函数体）")
    setrow("P2-06", "unproven",
           "deadzone/平滑：在全部已解码写入路径（漏斗、枚举回调、窗口过程鼠标带、焦点写入者 0x93CB27、"
           "Shape2D Set 本体）均无阈值/平滑常量（有界负结论）；剩余可能栖息地=[[user+0xF28]+0x14] 写入者"
           "（未普查）与 25 个 INCONCLUSIVE 站点包含函数；小地图边界相机 clamp 未证明（消费侧 slot15 已证）")
    setrow("P2-06", "minimum_next_work",
           "STATIC 同 P2-05（[F28+0x14] 写入者普查）；产品按 T088 §6 契约选择 deadzone 策略并标注产品替代")
    # P4-07 refresh
    setrow("P4-07", "claim_ids", "C-028;C-054;C-103;C-107;C-109")
    setrow("P4-07", "evidence_ids", "EV-21;EV-35;EV-89;EV-90;EV-94;EV-97")
    setrow("P4-07", "evidence_grade_and_type",
           "A（t080 指令级：同图 0x78/0x258 冷却窗与 tick 源；t088：跨图/同图事件栈内同步焦点写入者调用"
           "——0x964E16 传送触发族与 0x98DC43 包生成族均直接调用 0x93CB27；相机写入时序边已类型化 E1 同步/"
           "E2E3 消息驱动，EV-97）")
    setrow("P4-07", "unproven",
           "焦点写入者目标对象 [[user+0xF28]+0x14] 语义（是否=落点居中）未闭合；跨图输入抑制路径未解码；"
           "消息驱动相机写与绘制的泵相位交错静态不可判定")
    setrow("P4-07", "can_static_continue_or_runtime",
           "STATIC：[F28+0x14] 写入者普查 + INCONCLUSIVE 站点；跨图门输入抑制仍为静态待核项")
    setrow("P4-07", "minimum_next_work",
           "冷却已闭合（C-054/EV-35）；t088 已闭合：共享单例身份（C-106）、相机写 Set 语义（C-108）、"
           "#6/#7 触发定标（C-107）、焦点写入者家族+调用者（C-109）；剩余：[[user+0xF28]+0x14] 写入者普查"
           "（定焦点几何语义）、跨图输入抑制、E2/E3 泵相位（静态不可判定部分需产品契约）")
    write_csv(MATRIX, [hdr] + rows)
    print("matrix: P2-01 readiness fixed; P2-05/P2-06/P4-07 refreshed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
