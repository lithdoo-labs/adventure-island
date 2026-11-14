#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""t084.1 ledger update: claims (C-082 corrected, C-083 tightened, new C-086/C-087),
gaps (G10/G24/G27/G38), evidence (EV-74/75/76), documents."""
import csv, io, os, sys, hashlib

sys.stdout.reconfigure(encoding='utf-8')
REPO = r"C:\Users\lithd\Documents\GitHub\adventure-island"
SOT = os.path.join(REPO, 'research', 'source-of-truth')
FORENSICS = os.path.join(REPO, 'research', 'result', 'stage-readiness', 'forensics')


def read_csv(path):
    with open(path, encoding='utf-8', newline='') as f:
        rows = list(csv.reader(f))
    return rows[0], rows[1:]


def write_csv(path, header, rows):
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator='\n')
    w.writerow(header)
    w.writerows(rows)
    with open(path, 'w', encoding='utf-8', newline='') as f:
        f.write(buf.getvalue())


def sha_of(rel):
    return hashlib.sha256(open(os.path.join(REPO, rel), 'rb').read()).hexdigest()


# ---------------- claims.csv ----------------
h, rows = read_csv(os.path.join(SOT, 'claims.csv'))
idx = {c: i for i, c in enumerate(h)}

C082 = ("t084.1 CORRECTION by C-086 (EV-74/EV-76): the t084 conclusion 'candidate set fully "
        "enumerated (2 candidates) and BOTH fail the production-path out constraint' is "
        "WITHDRAWN - a third static candidate present in the same EV-72 dump MATCHES the "
        "production path: inner vtable 0x5042D224 slot25 = 0x5040418C (ret 0x3C = exactly "
        "the 15 dwords pushed at 0x427EB3; E_POINTER-guarded VARIANT* out at arg15 written "
        "at 0x504045CB with a wrapped object pointer). The two t084 body facts stand "
        "unchanged: (1) layer-table 0x5042D140 slot25 0x50403FBE = trivial setter "
        "([this+0xCC]=arg2, ret 8) - never writes the production out (15 pushed dwords, "
        "out would stay the stale vt dword 13 and fault 0x666FAC); (2) outer 0x5042D204 "
        "slot25 0x50404E85 = boolean out-getter (*arg2=[this+0x78]!=0, ret 8) - would "
        "treat the pushed x-int as an out address (wild write) and leaves the real out "
        "unwritten; both remain correctly excluded from the production path. The "
        "'runtime binding must be a put-with-object-out absent from static tables' "
        "inference is falsified: such a method was statically present at inner slot25 "
        "all along; the T082 bp-0x666F77 dump now CONFIRMS a named prediction instead "
        "of discriminating candidates (C-086/C-087)")
C082_REASON = ("t084.1 full-body + call-site stack accounting: only 0x5040418C satisfies "
               "arg-count/out-position/VARIANT/out-object constraints (EV-74/EV-76); "
               "t084 dword dumps of the 3 cluster tables remain valid data")
C082_FALS = ("a fourth static Gr2D slot25 candidate, or runtime evidence that the "
             "production [0xBE2788] slot25 is not 0x5040418C")

C083 = ("map-transition handler 0x97EBC9 (ret 8; sole direct caller 0x533FF1 inside "
        "handler-family vtable slot0 0x533EA4, primary vtable 0xB01414 of the 33-table "
        "family 0xB01308..0xB02730): allocates a 0x3048 field object (pool 0xBE1DE0), "
        "fully loads the new map via 0x94FDB4 (creates field #1 [0xBDD498] incl. "
        "footholds/ropes/physics/VR re-fold), attaches via 0x980A8C(handler+4,field,0), "
        "THEN writes the arrival position via 0x9507F0 (C-055) - so the new map "
        "bounds/VR exist before the arrival write and the [M+0x138..0x144] clamps use "
        "the NEW field. t084.1 TIGHTENED registration wording (C-083 as originally "
        "worded overstated the mechanism): NO byte-level binding of the number 0x81 to "
        "this handler was found in the examined static patterns (sub/cmp imm 0x81 "
        "census: only 0x77E6F3 = channel context 0x81/0x82/0x83; cmp sites 0x5414A1/"
        "0x75A0AB unrelated; the 33 handler-family dword dumps carry no registration "
        "references); the 0x77E6F3 collision DEMONSTRATES that the number 0x81 is "
        "reused across disjoint dispatch contexts, so a bare number cannot identify a "
        "handler - it does NOT prove the map-transition binding is dynamically "
        "registered; the actual binding/registration mechanism remains UNVERIFIED "
        "(C-066 open clause stands)")
C083_REASON = ("full handler body + caller census (1 E8 site) + family dword dump + "
               "collision dispatch body; t084.1: negative bounded to examined patterns, "
               "mechanism inference removed")
C083_FALS = ("another direct caller of 0x97EBC9, or a static imm 0x81 binding to "
             "0x533EA4 (none found in the examined census)")

C086 = ("production slot25 resolution (t084.1): inner vtable 0x5042D224 slot25 (+0x64) = "
        "0x5040418C is the ONLY static Gr2D slot25 candidate satisfying every "
        "production-path constraint of the 0x427EB3 call site: (a) stack shape - callee "
        "ret 0x3C pops exactly the 15 dwords the wrapper pushes (this + five dwords "
        "[ebp+0xC..0x1C] + VARIANT by-value [ebp+0x20] + VARIANT by-value [ebp+0x30] + "
        "VARIANT* [ebp+0x40]); (b) out semantics - E_POINTER guard on arg15, then "
        "*arg15 = wrapped object pointer (0x504045C1-0x504045D1), which the wrapper "
        "forwards to its own arg1 (EV-34/C-053 chain) and the tile path consumes as a "
        "live object (0x42944A null-assert -> slot45 [eax+0xB4] keyed insert + slot56 "
        "[eax+0xE0] on the CREATED object; 0x666FAC Release on the re-inited slot); "
        "(c) VARIANT handling - [ebp+0x30] VT_ERROR(0xA)->esi=-1 fast path; [ebp+0x20] "
        "coerced to VT_UI4 then VT_UNKNOWN (copy), punk extracted, QI'd, with per-item "
        "IDispatch::Invoke expansion and count clamp 0x400; (d) state guard - "
        "[this+0x90]!=0 else E_FAIL, [this+0x90] being the device object created by "
        "inner slot3 0x504030D3 (the initializer call [[0xBE2788]+0xC](0x320,0x258)). "
        "Candidates 0x50403FBE (ret 8, no out write) and 0x50404E85 (ret 8, boolean out "
        "at the wrong stack position) are excluded by (a)/(b). The [this+0x128] "
        "collection belongs to sibling slots 26/27/28 (0x50404ECA/0x50404EE9/0x50404F05 "
        "thin wrappers over [this+0x128]), NOT to 0x5040418C (t084 report wording "
        "corrected)")
C086_ROW = ["C-086", "Gr2D", C086, "CLOSED-STATIC", "A", "EV-74;EV-76;EV-34", "gr2d+unpack079",
            "0x5042D288;0x5040418C-0x5040485D;0x427EB3-0x427F0D;0x666E8C-0x666FBA",
            ("full 1748-byte body (597 insns, SEH) + call-site stack accounting + "
             "out-readback chain + [this+0x90] producer cross-ref (slot3 device init); "
             "slot45/56 receiver = 0x42944A return value verified"),
            ("runtime capture at bp 0x666F77 showing the production [0xBE2788] vtable "
             "is not 0x5042D224 or a slot25 body other than 0x5040418C"),
            "(corrects the exhaustion conclusion of C-082)",
            "T084-1-SLOT25-SCOPE-RECONCILIATION.md;T084-GR2D-SLOT25-ANALYSIS.md"]

C087 = ("[0xBE2788] interface identity chain (t084.1; static derivation with explicit "
        "runtime clause): factory global [0xBE1FB0] = PCOM.dll!PcCreateObject resolved "
        "by name via GetProcAddress (EXE resolver 0x79C52F-0x79C598 stores five Pc* "
        "pointers 0xBE1FB0..0xBE1FC0; PCOM.dll sha256 cf3807f3107152d3b305bfc84be36d58"
        "b62306c94f60133c8e80fd17f9d9e54b, ImageBase 0x50C00000, exports only Dll*+Pc* "
        "and contains NO static IID table); creator 0xA0449B calls PcCreateObject(ctx, "
        "riid=0xBA0570, out=&[0xBE2788], 0) cdecl with old-value Release and "
        "0x800401F0 factory-miss; PcCreateObject resolves the riid in a RUNTIME "
        "namespace registry and then invokes the class entry's vtable slot3 (this, "
        "arg4, riid, ppv) to create+QI - the IID-to-module binding itself is runtime "
        "registration data (NOT statically enumerable in PCOM.dll); IID bytes "
        "{E576EA33-D465-4F08-AAB1-E78DF73EE6D9} are byte-identical and single-occurrence "
        "in EXE 0xBA0570 and Gr2D 0x50435120 (Gr2D is the only game-folder module "
        "carrying them); the Gr2D intmap 0x5042D1E0 entry0 {piid=0x50435120, dw=0, "
        "simple} of the 0x5042D204-cluster class yields QI(E576EA33) = INNER subobject "
        "pointer (obj+0x10): outer QI 0x504014A5 delegates to the map with "
        "pThis=this+0x10, inner QI 0x50401522 walks it directly, ATL IQI 0x50401945 "
        "returns pThis+dw; ctor 0x504013E3 installs [obj+0]=0x5042D204 (outer), "
        "[obj+0x10]=0x5042D224 (inner), [obj+0x14]=0x5042D210 (mid, thunk family "
        "0x5040184E/58/62), [obj+0x18]=owner; the initializer's first direct calls on "
        "[0xBE2788] are compatible ONLY with the inner vtable (slot3(0x320,0x258) = "
        "0x504030D3 device init writing [this+0x90]; outer slot3 would be the QI-thunk "
        "0x5040184E and wild-write ppv=0x258; slot20(0xFF000000) = 0x50403FBE "
        "[this+0xCC] color setter, ret 8, matches) - static derivation: [0xBE2788] = "
        "inner interface pointer (vtable 0x5042D224, slot25=0x5040418C per C-086); "
        "FINAL runtime confirmation of the PCOM registry binding remains open (G24 "
        "capture now verifies this named prediction; IID rendering note: the canonical "
        "string is defined by the 16 bytes; task-prompt grouping "
        "'E576EA33-4F08-D465-8DE7-B1AA-D9E63EF7' is a non-standard rendering of the "
        "same bytes). EV-72 mid-table correction: rows slot3/slot4 are off by one "
        "dword (raw [0x5042D21C]=0x50404860, [0x5042D220]=0x50404CB2; EV-72 printed "
        "0x50404CB2 under [0x5042D21C] and dropped the slot4 row); mid slot25 = "
        "0x50403FBE itself is correct")
C087_ROW = ["C-087", "PCOM", C087, "PARTIAL-STATIC", "A",
            "EV-75;EV-76;EV-04;EV-05;EV-06;EV-07;EV-08", "unpack079+gr2d+pcom",
            ("0xBE1FB0;0xBE2788;0xA0449B;0xA00E5E;0x79C52F-0x79C598;0x50C04CD1;"
             "0x504013E3;0x504014A5;0x50401522;0x50401945;0x5042D1E0;0x50435120;0xBA0570"),
            ("byte-level IID equality + single-occurrence census (EXE/DLL/PCOM) + "
             "export-name resolution + full PcCreateObject/creator/initializer/QI/ctor "
             "bodies + raw cluster re-dump; runtime clause kept because the PCOM "
             "registry binding is runtime data"),
            ("a second game-folder module carrying the same IID bytes, or a runtime "
             "dump showing [0xBE2788]->vtable != 0x5042D224"),
            "(completes the C-004 chain identity)",
            "T084-1-SLOT25-SCOPE-RECONCILIATION.md"]

for r in rows:
    if r[0] == 'C-082':
        r[2], r[7], r[8], r[10], r[11] = C082, C082_REASON, C082_FALS, \
            "(superseded-in-part by C-086: exhaustion conclusion withdrawn; body facts stand)", \
            "T084-GR2D-SLOT25-ANALYSIS.md;T084-1-SLOT25-SCOPE-RECONCILIATION.md"
    if r[0] == 'C-083':
        r[2], r[7], r[8] = C083, C083_REASON, C083_FALS
        r[11] = "T084-OPCODE-0081-REGISTRATION.md;T084-CAMERA-CALLGRAPH.md;T084-1-SLOT25-SCOPE-RECONCILIATION.md"
rows.append(C086_ROW)
rows.append(C087_ROW)
write_csv(os.path.join(SOT, 'claims.csv'), h, rows)
print(f"claims.csv: {len(rows)} rows")

# ---------------- gaps.csv ----------------
h, rows = read_csv(os.path.join(SOT, 'gaps.csv'))
gi = {c: i for i, c in enumerate(h)}

G10_VS = ("VR fold A (C-026); t084: scene-manager skeleton recovered - handler-base "
          "33-vtable family, slot 2 WZ load order (tiles->objs->backs->automove->VR "
          "fold->life), slot12 per-tick (0xA106C3/0x9533EA), slot14 per-draw "
          "(0x953AF4), slot15 cull consumes camera-rect args vs scene+0x1D0/+0x1D4, "
          "viewport = [0xBE2788] slots 11/12 getters (C-084/EV-73); cross-map "
          "bounds/VR re-fold BEFORE arrival write (C-083); t084.1 boundary restated: "
          "EXE-image static territory is EXHAUSTED for post-load/per-frame writers of "
          "scene+0xF0..0xFC (C-028/C-084 negatives re-verified); Gr2D side carries no "
          "producer to search - the camera rect reaches Gr2D only as slot15 CONSUMER "
          "args (C-084); unchecked scope = the runtime writer (if any lives outside "
          "the image) and the slot15 caller chain")

G24_VS = ("t084.1 (C-086/C-087/EV-74/75/76): production slot25 = 0x5040418C (inner "
          "vtable 0x5042D224) - the only candidate matching the 15-dword 0x427EB3 "
          "stack and the VARIANT* out write of an object pointer; the [eax+0xB4] "
          "slot45 call lands on the slot25 RESULT object (0x42944A null-assert returns "
          "[ebp-0x10]), NOT on [0xBE2788] - the t084 report gloss 'slot45 always go "
          "through the same global' is corrected; static derivation [0xBE2788] = inner "
          "subobject via QI intmap {E576EA33,dw=0} + init-slot compatibility (C-087); "
          "prior scope: 22-candidate exclusion (EV-16/18), C-053 out sharpening, C-077 "
          "vtable-group structure")
G24_US = ("concrete class/vtable of the slot25-created render-node object (the "
          "[eax+0xB4] receiver) - runtime; plus runtime confirmation of the PCOM "
          "registry binding prediction ([0xBE2788] -> vtable 0x5042D224)")
G24_BK = "runtime dump required (capture now CONFIRMS a named prediction; no longer an open 3-way discrimination)"
G24_NA = ("execute the T082-R13 section-4 capture (bp 0x666F77): predicted [ESI] = "
          "interface pointer with vtable 0x5042D224 (DLL-base-relative 0x2D224) and "
          "[EBP-0x10] = object created by 0x5040418C; additionally dump the created "
          "object's [0] vtable to name the slot45 target class")
G24_CR = "C-013;C-014;C-053;C-077;C-082;C-086;C-087"

G27_VS = ("t080 (C-053): arg1 IS the out pointer; *out = post-slot25 arg8-slot dword; "
          "t082: [ebp-0x20] lifecycle resolved (C-074); slot45 key-carrying call "
          "(C-075); t084: both then-known candidates rejected (C-082); t084.1 "
          "(C-086/EV-74/EV-76): contradiction RESOLVED - the third static candidate "
          "0x5040418C (inner slot25, ret 0x3C) matches the 0x427EB3 stack exactly and "
          "writes *arg15 = wrapped object pointer at 0x504045CB, which the wrapper "
          "forwards to *arg1; the EV-16 'out = stale vt dword 13 -> crash' "
          "contradiction existed only under candidates that never write the out slot")
G27_US = "(none static; runtime corroboration of the created object's concrete class is tracked in G24)"
G27_BK = "(none static)"
G27_NA = "(closed t084.1; runtime confirmation rides the G24 capture)"
G27_II = "OUT semantics implementable now (object pointer); render-node interop pending G24"
G27_CR = "C-014;C-053;C-074;C-075;C-082;C-086"

G38_VS = G38_OLD = None
for r in rows:
    if r[0] == 'G10':
        r[4] = G10_VS
    if r[0] == 'G24':
        r[4], r[5], r[6], r[7], r[9] = G24_VS, G24_US, G24_BK, G24_NA, G24_CR
    if r[0] == 'G27':
        r[3], r[4], r[5], r[6], r[7], r[8], r[9] = \
            "CLOSED-STATIC", G27_VS, G27_US, G27_BK, G27_NA, G27_II, G27_CR
    if r[0] == 'G38':
        r[4] = r[4].replace(
            "opcode 0x81 has NO static byte binding (context-dependent registration proven "
            "by the 0x77E6F3 channel-0x81 collision) (C-083)",
            "opcode 0x81 has NO byte binding in the examined static dispatch patterns (imm "
            "sub/cmp census + 33-family dword dumps); the 0x77E6F3 channel-0x81 collision "
            "demonstrates the NUMBER is context-reused - the binding/registration mechanism "
            "itself remains unverified, NOT proven dynamic (C-083 t084.1 tightened wording)")
write_csv(os.path.join(SOT, 'gaps.csv'), h, rows)
print(f"gaps.csv: {len(rows)} rows")

# ---------------- evidence.csv ----------------
h, rows = read_csv(os.path.join(SOT, 'evidence.csv'))
EV74 = ["EV-74",
        "research/result/stage-readiness/forensics/T0841-EV74-SLOT25-5040418C-FULL.txt",
        sha_of("research/result/stage-readiness/forensics/T0841-EV74-SLOT25-5040418C-FULL.txt"),
        "0x5042D288;0x5040418C-0x5040485D;0x504030D3-0x5040355F",
        "instruction",
        ("inner slot25 0x5040418C FULL body: ret 0x3C (15 dwords); SEH; arg map "
         "[ebp+8]=this, +0xC..+0x1C five dwords, +0x20/+0x30 VARIANTs by value, +0x40 "
         "VARIANT* out; guards E_POINTER/E_FAIL([this+0x90]); out write *arg15 = "
         "wrapped object pointer @0x504045CB; E_INVALIDARG path; plus slot3 "
         "0x504030D3 device-init head (the [this+0x90] producer, invoked by the EXE "
         "initializer as [[0xBE2788]+0xC](0x320,0x258))"),
        ("complete function boundary + calling convention + parameter order + VARIANT "
         "coerce/punk/QI/IDispatch::Invoke expansion + out semantics of the third "
         "slot25 candidate; source of C-086"),
        "C-086",
        "research/scripts/t0841_dump_evidence.py"]
EV75 = ["EV-75",
        "research/result/stage-readiness/forensics/T0841-EV75-IID-IDENTITY-CHAIN.txt",
        sha_of("research/result/stage-readiness/forensics/T0841-EV75-IID-IDENTITY-CHAIN.txt"),
        ("0xBA0570;0x50435120;0xBE1FB0;0xBE2788;0xA0449B;0xA00E5E;0x79C52F-0x79C598;"
         "0x50C04CD1;0x504013E3;0x504014A5;0x5040184E;0x50401522;0x50401945;"
         "0x5042D1E0-0x5042D2C8"),
        "data+instruction",
        ("IID bytes byte-identical EXE 0xBA0570 == Gr2D 0x50435120 "
         "({E576EA33-D465-4F08-AAB1-E78DF73EE6D9}), single occurrence each, NONE in "
         "PCOM.dll; PCOM exports Pc*; factory [0xBE1FB0]=PcCreateObject via "
         "GetProcAddress names; PcCreateObject namespace routing -> class entry slot3 "
         "create+QI; creator/initializer bodies (slot3(0x320,0x258), "
         "slot20(0xFF000000) on [0xBE2788]); ctor vtable installs obj+0/obj+0x10/"
         "obj+0x14; outer/mid/inner QI + ATL IQI bodies; intmap dump; authoritative "
         "raw cluster re-dump incl. EV-72 mid-table slot3/slot4 off-by-one correction"),
        ("complete IID->factory->QI->subobject evidence chain; source of C-087; "
         "static derivation [0xBE2788] = inner interface pointer (vtable 0x5042D224) "
         "with the PCOM-registry runtime clause"),
        "C-087",
        "research/scripts/t0841_dump_evidence.py"]
EV76 = ["EV-76",
        "research/result/stage-readiness/forensics/T0841-EV76-SLOT25-CANDIDATE-COMPARISON.txt",
        sha_of("research/result/stage-readiness/forensics/T0841-EV76-SLOT25-CANDIDATE-COMPARISON.txt"),
        ("0x50403FBE;0x50404E85;0x50404EA7;0x5040418C;0x427EB3-0x427F0D;"
         "0x666E8C-0x666FBA;0x42944A;0x411FE1;0x50404ECA;0x50404EE9"),
        "instruction",
        ("three candidate bodies side by side (ret 8 / ret 8 / ret 0x3C); wrapper "
         "0x427EB3 full stack accounting (15 dwords incl. two by-value VARIANTs + "
         "VARIANT* = &[ebp+0x24], readback *arg1 = [ebp+0x24]); tile path window: "
         "VARIANT pack, [0xBE2788] guard, 0x42944A null-assert returning the slot25 "
         "RESULT object, slot45 [eax+0xB4] and slot56 [eax+0xE0] called on that "
         "object, 0x666FAC Release; 0x411FE1 VT_UNKNOWN pack; slots 26/27/28 "
         "[this+0x128] collection wrappers"),
        ("only 0x5040418C satisfies the production-path constraints; slot45 receiver "
         "identity corrected (result object, not [0xBE2788]); source of C-086 and the "
         "C-082 correction"),
        "C-086;C-082",
        "research/scripts/t0841_dump_evidence.py"]
rows.extend([EV74, EV75, EV76])
write_csv(os.path.join(SOT, 'evidence.csv'), h, rows)
print(f"evidence.csv: {len(rows)} rows")

# ---------------- documents.csv ----------------
h, rows = read_csv(os.path.join(SOT, 'documents.csv'))
rows.append(["research/result/stage-readiness/T084-1-SLOT25-SCOPE-RECONCILIATION.md",
             "ACTIVE", "round-report", "C-082;C-083;C-086;C-087", "(t084.1 commit)", "",
             "t084.1 slot25 scope reconciliation round report"])
rows.append(["research/result/stage-readiness/forensics/T0841-REVIEWER-REPORT.md",
             "ACTIVE", "review", "", "(t084.1 commit)", "",
             "t084.1 independent reviewer verbatim"])
write_csv(os.path.join(SOT, 'documents.csv'), h, rows)
print(f"documents.csv: {len(rows)} rows")
print("DONE")
