#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""t084.1 round-2 ledger corrections (post-review): phantom-slot attributions,
second long table 0x5042D154, bounded negatives, completed 0x81 census."""
import csv, io, os, sys, hashlib
sys.stdout.reconfigure(encoding='utf-8')
REPO = r"C:\Users\lithd\Documents\GitHub\adventure-island"
SOT = os.path.join(REPO, 'research', 'source-of-truth')


def rewrite(path, mutator):
    rows = list(csv.reader(open(path, encoding='utf-8')))
    header, body = rows[0], rows[1:]
    body = mutator(header, body)
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator='\n')
    w.writerow(header)
    w.writerows(body)
    open(path, 'w', encoding='utf-8', newline='').write(buf.getvalue())


def sha_of(rel):
    return hashlib.sha256(open(os.path.join(REPO, rel), 'rb').read()).hexdigest()


# ---------------- claims.csv ----------------
def fix_claims(header, rows):
    idx = {c: i for i, c in enumerate(header)}
    for r in rows:
        if r[0] == 'C-082':
            # phantom-slot re-attribution (reviewer D1); body facts + withdrawal stand
            r[2] = r[2].replace(
                "(1) layer-table 0x5042D140 slot25 0x50403FBE = trivial setter "
                "([this+0xCC]=arg2, ret 8) - never writes the production out (15 pushed dwords, "
                "out would stay the stale vt dword 13 and fault 0x666FAC); (2) outer 0x5042D204 "
                "slot25 0x50404E85 = boolean out-getter (*arg2=[this+0x78]!=0, ret 8) - would "
                "treat the pushed x-int as an out address (wild write) and leaves the real out "
                "unwritten; both remain correctly excluded from the production path.",
                "(1) dword [0x5042D1A4] = 0x50403FBE, trivial setter ([this+0xCC]=arg2, ret 8) - "
                "never writes the production out (out would stay the stale vt dword 13 and fault "
                "0x666FAC); t084.1/reviewer structure correction: the t084/t081 label 'layer-table "
                "0x5042D140 slot25' was a PHANTOM slot - 0x5042D140 is a 5-entry thunk table and "
                "[0x5042D1A4] is class-2 long table 0x5042D154 slot20; (2) dword [0x5042D268] = "
                "0x50404E85, boolean out-getter (*arg2=[this+0x78]!=0, ret 8) - would treat the "
                "pushed x-int as an out address (wild write) and leaves the real out unwritten; "
                "the t084 label 'cluster-outer 0x5042D204 slot25' was likewise a PHANTOM slot - "
                "0x5042D204 is a 3-entry IUnknown table and [0x5042D268] is inner 0x5042D224 "
                "slot17; both BODIES remain correctly excluded from the production path (neither "
                "matches the 15-dword production stack), but neither was ever a real slot25 of "
                "a typed interface.")
            r[7] = ("t084.1+reviewer: full-body + call-site stack accounting; structure re-read: "
                    "the EV-72 windows are byte-accurate dwords but were sliced into overlapping "
                    "'slot25's (phantom slots); real slot25s of both long tables = 0x5040418C")
        if r[0] == 'C-083':
            r[2] = r[2].replace(
                "(sub/cmp imm 0x81 census: only 0x77E6F3 = channel context 0x81/0x82/0x83; "
                "cmp sites 0x5414A1/0x75A0AB unrelated; the 33 handler-family dword dumps carry "
                "no registration references)",
                "(sub/cmp imm 0x81 census - t084.1 completed per reviewer: sub site 0x77E6F3 = "
                "channel context 0x81/0x82/0x83; cmp sites 0x5414A1 and 0x62B75D are range "
                "guards that FEED 0x77E6F3 (same channel dispatcher), 0x75A0AB and 0x9355A9 are "
                "unrelated range checks on other values; the 33 handler-family dword dumps carry "
                "no registration references)")
        if r[0] == 'C-086':
            r[2] = r[2].replace(
                "Candidates 0x50403FBE (ret 8, no out write) and 0x50404E85 (ret 8, boolean out "
                "at the wrong stack position) are excluded by (a)/(b).",
                "The two t084-named 'candidates' 0x50403FBE and 0x50404E85 are excluded by "
                "(a)/(b) as BODIES (ret 8 vs 15 dwords; no out write / out at wrong position), "
                "and per the t084.1/reviewer structure correction neither dword was a real "
                "slot25: [0x5042D1A4] is T154 slot20, [0x5042D268] is T224 slot17 (phantom "
                "windows over one contiguous block). The REAL slot25 dwords of BOTH Gr2D long "
                "tables are the SAME body: T224 0x5042D224 slot25 @0x5042D288 and T154 "
                "0x5042D154 slot25 @0x5042D1B8 both = 0x5040418C - the production-path match is "
                "invariant across the two classes.")
            r[2] = r[2].replace(
                "The [this+0x128] collection belongs to sibling slots 26/27/28 (0x50404ECA/0x50404EE9/0x50404F05 "
                "thin wrappers over [this+0x128]), NOT to 0x5040418C (t084 report wording "
                "corrected)",
                "The [this+0x128] collection belongs to sibling slots 26/27/28 (0x50404ECA/"
                "0x50404EE9/0x50404F05 thin wrappers over [this+0x128]), NOT to 0x5040418C "
                "(t084 report wording corrected); EV-72's printed dwords are byte-accurate - the "
                "original defect was the overlapping-window slot numbering, not wrong values")
        if r[0] == 'C-087':
            r[2] = r[2].replace(
                "the Gr2D intmap 0x5042D1E0 entry0 {piid=0x50435120, dw=0, "
                "simple} of the 0x5042D204-cluster class yields QI(E576EA33) = INNER subobject "
                "pointer (obj+0x10): outer QI 0x504014A5 delegates to the map with "
                "pThis=this+0x10, inner QI 0x50401522 walks it directly, ATL IQI 0x50401945 "
                "returns pThis+dw; ctor 0x504013E3 installs [obj+0]=0x5042D204 (outer), "
                "[obj+0x10]=0x5042D224 (inner), [obj+0x14]=0x5042D210 (mid, thunk family "
                "0x5040184E/58/62), [obj+0x18]=owner; ",
                "the Gr2D intmap 0x5042D1E0 entry0 {piid=0x50435120, dw=0, "
                "simple} is SHARED by TWO Gr2D classes: class-1 (ctor 0x504013E3: [obj+0]=3-"
                "entry outer table 0x5042D204, [obj+0x10]=inner long table 0x5042D224 with QI "
                "0x50401522, [obj+0x14]=5-entry mid thunk table 0x5042D210, [obj+0x18]=owner; "
                "outer QI 0x504014A5 delegates with pThis=this+0x10) and class-2 (ctor fragment "
                "0x50401295: [obj+0]=long table 0x5042D154 with QI 0x504013CA walking the same "
                "map with pThis=this, [obj+4]=5-entry thunk table 0x5042D140); QI(E576EA33) "
                "therefore yields EITHER the class-1 inner pointer (vtable 0x5042D224) OR the "
                "class-2 primary (vtable 0x5042D154) - both long tables share slot25="
                "0x5040418C, slot3=0x504030D3 and slot20=0x50403FBE, so every downstream "
                "conclusion is class-invariant; ATL IQI 0x50401945 returns pThis+dw; ")
            r[2] = r[2].replace(
                "the initializer's first direct calls on "
                "[0xBE2788] are compatible ONLY with the inner vtable (slot3(0x320,0x258) = "
                "0x504030D3 device init writing [this+0x90]; outer slot3 would be the mid QI-thunk "
                "0x5040184E which, entered with the unadjusted outer this, computes this-4=obj-4 "
                "and dereferences [obj+4] (refcount) as owner - crash-incompatible with the "
                "(0x320,0x258) init args; slot20(0xFF000000) = 0x50403FBE [this+0xCC] color "
                "setter, ret 8, matches) - static derivation: [0xBE2788] = inner interface "
                "pointer (vtable 0x5042D224, slot25=0x5040418C per C-086); ",
                "the initializer's first direct calls on "
                "[0xBE2788] are compatible ONLY with a LONG-TABLE vtable (slot3(0x320,0x258) = "
                "0x504030D3 device init writing [this+0x90], ret 0x3C; the 3-entry outer table "
                "has no slot3 and the 5-entry mid/140 tables' slot3=0x50404860 is a ret-0x10 "
                "switch incompatible with those args; slot20(0xFF000000) = 0x50403FBE "
                "[this+0xCC] color setter, ret 8, matches) - static derivation: [0xBE2788] = "
                "E576EA33 interface pointer with vtable 0x5042D224 (class-1 inner) OR 0x5042D154 "
                "(class-2 primary), slot25=0x5040418C either way (C-086); ")
            r[2] = r[2].replace(
                "EV-72 mid-table correction: rows slot3/slot4 are off by one "
                "dword (raw [0x5042D21C]=0x50404860, [0x5042D220]=0x50404CB2; EV-72 printed "
                "0x50404CB2 under [0x5042D21C] and dropped the slot4 row); mid slot25 = "
                "0x50403FBE itself is correct",
                "EV-72 data status (reviewer-confirmed): every printed dword is byte-accurate "
                "against the raw image - there is NO off-by-one value error; the defect was "
                "purely the overlapping-window slot numbering (phantom slots) corrected above")
        if r[0] == 'C-087':
            r[7] = ("byte-level IID equality + single-occurrence census (EXE/DLL/PCOM and all "
                    "22 folder DLLs per reviewer) + export-name resolution + full "
                    "PcCreateObject/creator/initializer/QI/ctor bodies + raw re-dumps of BOTH "
                    "vtable groups; runtime clause kept because the PCOM registry binding "
                    "(incl. which of the two classes is news'd) is runtime data")
    return rows


rewrite(os.path.join(SOT, 'claims.csv'), fix_claims)
print('claims.csv round-2 fixed')

# ---------------- gaps.csv ----------------
def fix_gaps(header, rows):
    for r in rows:
        if r[0] == 'G10':
            r[4] = r[4].replace(
                "t084.1 boundary restated: "
                "EXE-image static territory is EXHAUSTED for post-load/per-frame writers of "
                "scene+0xF0..0xFC (C-028/C-084 negatives re-verified); Gr2D side carries no "
                "producer to search - the camera rect reaches Gr2D only as slot15 CONSUMER "
                "args (C-084); unchecked scope = the runtime writer (if any lives outside "
                "the image) and the slot15 caller chain",
                "t084.1 boundary restated (bounded phrasing per "
                "reviewer): no post-load/per-frame writer of scene+0xF0..0xFC was found in the "
                "EXAMINED EXE-image censuses (C-028/C-084 bounded negatives - not an unbounded "
                "whole-image claim); no Gr2D-side producer of the scene fields was found in the "
                "examined Gr2D paths - the camera rect reaches Gr2D only as slot15 CONSUMER "
                "args (C-084); unchecked scope = a runtime writer outside those censuses (if "
                "any) and the slot15 caller chain")
        if r[0] == 'G24':
            r[7] = r[7].replace(
                "predicted [ESI] = "
                "interface pointer with vtable 0x5042D224 (DLL-base-relative 0x2D224) and "
                "[EBP-0x10] = object created by 0x5040418C",
                "predicted [ESI] = E576EA33 interface pointer whose vtable is 0x5042D224 "
                "(DLL-relative 0x2D224, class-1 inner) OR 0x5042D154 (DLL-relative 0x2D154, "
                "class-2 primary) - both carry slot25=0x5040418C - and [EBP-0x10] = object "
                "created by 0x5040418C")
            r[4] = r[4].replace(
                "static derivation [0xBE2788] = inner "
                "subobject via QI intmap {E576EA33,dw=0} + init-slot compatibility (C-087)",
                "static derivation [0xBE2788] = E576EA33 interface pointer with vtable "
                "0x5042D224 or 0x5042D154 (two Gr2D classes share the intmap; slot25/slot3/"
                "slot20 identical - C-087)")
        if r[0] == 'G38':
            r[4] = r[4].replace(
                "opcode 0x81 has NO byte binding in the examined static dispatch patterns (imm "
                "sub/cmp census + 33-family dword dumps);",
                "opcode 0x81 has no byte binding in the examined static dispatch patterns "
                "(imm sub/cmp census completed t084.1: sub 0x77E6F3; cmp 0x5414A1/0x62B75D feed "
                "the same channel dispatcher, 0x75A0AB/0x9355A9 unrelated range checks; "
                "33-family dword dumps clean);")
    return rows


rewrite(os.path.join(SOT, 'gaps.csv'), fix_gaps)
print('gaps.csv round-2 fixed')

# ---------------- evidence.csv ----------------
def fix_evidence(header, rows):
    for r in rows:
        if r[0] == 'EV-75':
            r[2] = sha_of('research/result/stage-readiness/forensics/T0841-EV75-IID-IDENTITY-CHAIN.txt')
            r[5] = (
                "IID bytes byte-identical EXE 0xBA0570 == Gr2D 0x50435120 "
                "({E576EA33-D465-4F08-AAB1-E78DF73EE6D9}), single occurrence each, NONE in "
                "PCOM.dll; PCOM exports Pc*; factory [0xBE1FB0]=PcCreateObject via "
                "GetProcAddress names; PcCreateObject namespace routing -> class entry slot3 "
                "create+QI; creator/initializer bodies (slot3(0x320,0x258), slot20(0xFF000000) "
                "on [0xBE2788]); class-1 ctor vtable installs (3-entry outer 0x5042D204 / "
                "39-entry inner 0x5042D224 / 5-entry mid 0x5042D210) + class-2 ctor fragment "
                "(0x5042D154 long table + 0x5042D140 5-entry thunks, QI 0x504013CA walking the "
                "SHARED intmap); QI chain + ATL IQI bodies; authoritative raw re-dumps of BOTH "
                "vtable groups incl. phantom-slot corrections (EV-72 dwords byte-accurate; the "
                "defect was overlapping-window slot numbering: [0x5042D1A4]=T154 slot20, "
                "[0x5042D268]=T224 slot17; real slot25 of both long tables = 0x5040418C)")
            r[6] = (
                "complete IID->factory->QI->subobject evidence chain; source of C-087; static "
                "derivation [0xBE2788] = E576EA33 interface pointer (vtable 0x5042D224 or "
                "0x5042D154, slot25 identical) with the PCOM-registry runtime clause")
        if r[0] == 'EV-76':
            r[2] = sha_of('research/result/stage-readiness/forensics/T0841-EV76-SLOT25-CANDIDATE-COMPARISON.txt')
            r[5] = (
                "three candidate bodies side by side with phantom-slot annotations (0x50403FBE "
                "ret 8 = real body at T154 slot20 / T224 slot20; 0x50404E85 ret 8 = real body "
                "at T224 slot17; 0x5040418C ret 0x3C = the REAL slot25 of BOTH long tables "
                "@0x5042D288 and @0x5042D1B8); wrapper 0x427EB3 full stack accounting (15 "
                "dwords incl. two by-value VARIANTs + VARIANT* = &[ebp+0x24], readback *arg1 = "
                "[ebp+0x24]); tile path window: VARIANT pack, [0xBE2788] guard, 0x42944A "
                "null-assert returning the slot25 RESULT object, slot45 [eax+0xB4] and slot56 "
                "[eax+0xE0] called on that object, 0x666FAC Release; 0x411FE1 VT_UNKNOWN pack; "
                "slots 26/27/28 [this+0x128] collection wrappers")
    return rows


rewrite(os.path.join(SOT, 'evidence.csv'), fix_evidence)
print('evidence.csv round-2 fixed')

# ---------------- matrix ----------------
def fix_matrix(header, rows):
    idx = {c: i for i, c in enumerate(header)}
    for r in rows[1:]:
        if r[0] == 'P1-09':
            r[idx['unproven']] = (
                "[eax+0xB4] 目标类 = slot25 返回对象（0x42944A 取 [ebp-0x10]）仍需运行时（t084.1：生产 "
                "slot25=0x5040418C——两张 Gr2D 长表 0x5042D224/0x5042D154 的真实 slot25 同为此值，15 参数 "
                "ret 0x3C + VARIANT* 出参对象写，C-086）；[0xBE2788]=E576EA33 接口指针为静态推导（vtable "
                "0x5042D224 或 0x5042D154 二选一，PCOM PcCreateObject+共享 QI intmap，C-087），运行时 dump "
                "现为确认命名预测而非三选一判定；出参/调用约定/[ebp-0x20] 已静态闭合")
            r[idx['minimum_next_work']] = (
                "bp 0x666F77 dump ESI/[ESI]/[EBP-0x10]（确认预测：[ESI] vtable 应为 0x5042D224（DLL 相对 "
                "0x2D224）或 0x5042D154（DLL 相对 0x2D154）二者其一；并取 slot25 返回对象 [0] vtable 以定 "
                "slot45 目标类）；静态已闭合 t084.1（C-086/C-087，EV-74/75/76）")
        if r[0] == 'P4-07':
            r[idx['minimum_next_work']] = r[idx['minimum_next_work']].replace(
                "Camera 写点 EXE 静态范围已穷尽（C-028/C-084 负结论）",
                "Camera 写点在已检查的 EXE 镜像普查中未发现（C-028/C-084 有界负结论，非全镜像断言）")
    return [rows[0]] + rows[1:]


rewrite(os.path.join(REPO, 'research', 'result', 'stage-readiness',
                     'P0-P4-REQUIREMENT-EVIDENCE-MATRIX.csv'), fix_matrix)
print('matrix round-2 fixed')
