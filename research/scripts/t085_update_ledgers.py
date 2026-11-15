#!/usr/bin/env python3
"""T085 ledger update: appends claims C-088..C-094, evidence EV-77..EV-81,
documents, updates gaps G34/G38/G40/G41 and matrix rows P3-15/P4-06.
UTF-8 in/out; preserves all other rows byte-for-byte in semantics."""
import csv
import io
import os
import sys

REPO = os.environ.get("RE_VALIDATE_ROOT") or os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SOT = os.path.join(REPO, "research", "source-of-truth")
MATRIX = os.path.join(REPO, "research", "result", "stage-readiness",
                      "P0-P4-REQUIREMENT-EVIDENCE-MATRIX.csv")

EXE_SHA = "d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718"
UNPACK = "unpack079"
FORENSICS = "research/result/stage-readiness/forensics"

NEW_CLAIMS = [
    ("C-088", "Movement",
     "0x9BE703 (extent 0x9BE703-0x9BF13F, 883 reached insns, ret 0xC; thiscall(M, srcState*, int* budget, int mode); mode=1 fresh rebuild / mode=0 drop recovery) physics-loop FULL body: head 0x9BF7EA(M,src,budget) = map-bounds clamp+partial budget (left M+0x138/right M+0x140/top M+0x13C, position clamp+velocity zero at edges); four decrypt+round of src/M x/y; dx==dy==0 -> budget-=full, vt+0x18 record, ret 0; swept query 0x5114AA([0xBDD498]+0x44, walker{0xB00D88}, src.x, src.y, M.x, M.y); candidate gates: [M+0x120]!=0 filter, m1<=0.0 -> platform!=field+0x40 && !=M+0x134 requires state([M+0x14].vt0())==7 AND [M+0x114] layer match; winding tests select supporting segment pair with corner resolution via prev/next links + 0x9BF144 wedge test (pure cross products); no segment -> ret 0 (stays ctx-less); segment -> consumed=full*ratio, tang encrypted M+0xF8, [M+0x118]==seg early-out ret 0, else t->M+0xE0 clamp [0,len]: m1>0.0 -> [M+0x150]<0 ? tang=0 : tang*0.5, 0x9BC992 reproject, vt+0x14 slot5 install (ctx triplet +(layer,platform)), ret 1; m1<=0.0 -> mode==0 plain reproject / mode!=0 full velocity rebuild, vt+0x18 record only (NO install), ret 1. DEAD BRANCHES (census-proven): [M+0x120] has NO setter in the image (ctor=0 0x9BC348 + slot5 and0 0x9BFB9D only; all encodings incl and/pop/SIB/rep-movs checked) so the pinned-segment filter, the [ebp-0x74] falling-flag set/clear, and the whole 0x9BF08F-0x9BF13F pinned-reproject block (incl its vt+0x14 call) are unreachable. FSDB census (13 maps, 2283 footholds): x1>x2 = 0 records, vertical = 676 -> m1>0 for every non-vertical target-map foothold; the platform/state-7 gate applies exactly to verticals, and for the local user the state getter ([M+0x14]=user+4, vtable 0xB0BD04 slot0=0x4B6E2C 'xor eax,eax; ret') always returns 0 != 7, so the state-7 branch is dead for the local player in this build",
     "CLOSED-STATIC", "A", "EV-77;EV-78", UNPACK,
     "0x9BE703-0x9BF13F;0x9BF7EA-0x9BF9D3;0x9BF144-0x9BF1F9;0x9BC2EB-0x9BC3D8;0x9507F0-0x950DBF",
     "recursive-descent full body + helper bodies + writer census + FSDB jsonl census; constants decoded (0.0/0.5/0.499999999/0.001/-0.001/20.0/1.3/0.3)",
     "any setter of M+0x120 anywhere in the image (would re-live the dead branches), or a target-map foothold with x1>x2",
     "(none)", "T085-G38-FIRST-TICK-CONTEXT.md;T085-STATIC-FORENSICS-REPORT.md"),
    ("C-089", "Movement",
     "move-object per-state physics vtable variant map COMPLETED (8 tables, dword-verified): slot4 = 0x9BE703 in T1/T2/T4/T5/T7/T8 but T3(0xB0C760)=0x9C6028 and T6(0xB0CA70)=0x9D06D4 (C-076 'slot4=0x9BE703' holds for 6/8 tables only); slot9 = 0x9BCCFB standard except T3=0x9C3D1D (call 0x9BCCFB then discard, push 0x5A pop eax ret = swim step override 90) and T4=0x9C9CF7 ([M+0x244]+=step; >=0x5A fire and wrap -0x5A = accumulator, 3-tick cycle at canonical step 0x1E); T7 overrides slot5=0x9D3CCA (reentrancy [0xBE2844], [0xB0CBB8]/[field+8]+0x68 divisor) and slot6=0x9D3DE6 (gates on ([user+0x3C0]&~1)==0x12); state semantics anchored: T1=ctor default ground, T2=ctx-less water-entry recovery tick 0x9C2966 ([M+0x238]=1; installed by thunks 0x9C28BF/0x9C28FF), T3=swim, T7=fresh cross-map object (ctor 0x9D34FA = base ctor 0x9BC2EB then vtable swap; allocator 0x9D359D called by 0x950915 inside arrival-write 0x9507F0 and by 0x98D016 packet-spawn), T8=climb; T7 slot10 0x9D4024 delegates to 0x9BCD6C in both early branches",
     "CLOSED-STATIC", "A", "EV-78;EV-80;EV-81", UNPACK,
     "0xB0C498..0xB0CC78 slot dwords;0x9D34FA-0x9D3591;0x9D4024-0x9D40A9;0x9C2966-0x9C29DB;0x9C3D1D-0x9C3D25;0x9C9CF7-0x9C9D30",
     "dword dump of slots 1..16 in all 8 tables + transition/install-site census (imm32 xrefs) + tick-head disassembly",
     "a 9th physics table or a different slot assignment in any table",
     "(refines C-076 slot4/slot9 wording)", "T085-G40-MOVEMENT-SLOT3-VARIANTS.md;T085-G38-FIRST-TICK-CONTEXT.md"),
    ("C-090", "Movement",
     "user slot14 (0x965A09) caller enumeration COMPLETE: all 30 `call [reg+0x38]` sites censused (2 SIB false positives excluded); 0x965A09 exists in exactly one image dword (0xB0BD60 = user vt 0xB0BD28 slot14). Exactly THREE user dispatch sites exist: (1) 0x965937 flag=0 inside 0x9658CC = opcode 0xCF case-0 STAND sub-case (packet byte 0x4066C9==0; gate RNG 0x416DE8(user+0x2E90,[user+0x2E98])!=0; router 0x9571BF reached via [outer+8] thunk 0x97FCBA) -> 0x53E95D(M,0xB) notify; the SIT sub-case (byte!=0) resolves the seat record (stride-8 table at [0x4376F2()+0x16C]), tests the user position in the occupancy box {x-0xA, y-0x1E, x+0xA, y+0x1E} via [0xBE1734], writes seat state 1 and teleports M to the seat via 0x9D35F2(M,seat.x,seat.y); (2) 0x948AB4 flag=0 inside 0x948AA2 (gate arg1!=0; callers 0x9509D7 = cross-map arrival 0x9507F0 with RNG gate 0x416DE8(user+0x265C,[user+0x2664]), 0x98D0C2 = user-movement packet spawner (stance via 0x965A8F->[user+0xF04], [user+0x3C0], fresh M 0x9D359D@0x98D016), 0x94489D) - portal arrival and packet spawn therefore FIRE the stand-up notify when their RNG gates pass; (3) 0x9500A3 flag=1 (full reset, t084 C-081 unchanged). No user dispatch with dynamic flag exists. Non-user sites classified: 0x9BCCE1 = M-family state driver 0x9BCCC4 (slot9->slot14->slot10->slot11; M slot14 T1=0x9BCCFA bare ret), 0x923CC5/0x924524/0x92459A/0x9245FB life controllers (+0x824/+0x82C/+0x844/+0x848), 0x9DDB99 life sub-object, 0x9F1EC7 UI, 0x9E05A2 forwarding thunk, 0x9DE0BA/0xA174B7 HRESULT COM, 0x9DDF5E slot14+slot80 pair, 0xA11C0E singleton [0xBD9020], 14 sites in COM/UI/CRT families",
     "CLOSED-STATIC", "A", "EV-79", UNPACK,
     "0x9658CC-0x965A06;0x948AA2-0x948B63;0x9508E0-0x9509E0;0x98CFA0-0x98D020;0x97FCBA-0x97FCD1;0x9BCCC4-0x9BCCF9",
     "encoding-exhaustive census + receiver-provenance proofs (field writes 0x2944/0x294C/0x2E90; the 0x4B1C27 + p-0xC M-retrieval idiom) + full trigger bodies; independently cross-checked by the blind reviewer (same census, same three user sites)",
     "a fourth user slot14 dispatch site (would have to appear in the census)",
     "(completes C-081's open enumeration clause)", "T085-G41-STANDUP-TRIGGERS.md"),
    ("C-091", "Movement",
     "arrow-key input arbitration (T8 tick 0x9D7ADA @0x9D7B8B-0x9D7BD9, after UI gates: climb validator 0x9D8233, keyboard focus [0xBDD89C]+4 vs [0xBE1790], 0x9EA638([0xBDD6F4]), UI-modal [0xBD9020], keymap [0xBDF54C]): key-state reader 0x5CAAA9(keymap=[0xBDD838], VK); vertical axis = (+1 if VK_DOWN 0x28) + (-1 if VK_UP 0x26); horizontal axis = (+1 if VK_RIGHT 0x27) + (-1 if VK_LEFT 0x25); simultaneous opposite presses cancel to 0; axes stored via 0x9C4B78(M,horiz,vert). Because the rope-grab adjudication (C-071) branches strictly on the vertical sign, simultaneous up+down yields 0 -> NEITHER grab path fires that tick",
     "CLOSED-STATIC", "A", "EV-79", UNPACK,
     "0x9D7B8B-0x9D7BEE;0x5CAAA9 body;0x9D7ADA-0x9D7B8B",
     "axis-construction disassembly + sign-fork cross-reference to C-071 boxes",
     "a third vertical-key source or a grab path not gated on the axis sign",
     "(none)", "T085-G41-STANDUP-TRIGGERS.md;T085-STATIC-RESIDUAL-TRIAGE.md"),
    ("C-092", "Movement",
     "slot3 variants are PRE-PROCESSORS that tail-delegate to the generic mover 0x9BF1FA (both ret 8, both zero direct callers, installed by T3/T5 dwords): 0x9C5B8A (T3, extent 0x9C5B8A-0x9C5F5F) = SWIM - dt=decrypt(M+0xE0)-decrypt(src.t), dt==0 -> delegate; [M+0x238]==1 surface swim (neighbor by dt sign, neighbor m1>0 gate, t clamped to len-20.0/20.0 [0xB064A8]); [M+0x238]==2 lane swim (platform-range table [field+0x34] indexed by ctx-platform AND [M+0x23C], span>0x28 shrunk +-0x14); tail forces input 0x9C4B78(M,+-1,0), runs 0x9C62A8, then E8-tail 0x9BF1FA. 0x9CCAA8 (T5, extent 0x9CCAA8-0x9CCC96) = platform-edge RNG skip - reads [user+0x94] object ([[M+0x14]-4+0x94]) vt+0x18 getter compared with [M+0x134] platform; platform-range +-0x14/0x28 narrowing; ctx-neighbor edge-proximity + x-in-ctx-range gates; all passing -> 0xA70BAD rand, rand%2: odd -> delegate 0x9BF1FA; even -> copy 0x30 bytes t/tang src->M+0xE0, [M+0x158]=1, ret 0 (move SKIPPED); next tick 0x9BD567 clears [M+0x158], sets [M+0x15C]=1, and on 0x9BD0D9(M)!=0 notifies 0x53E95D(M,1)",
     "CLOSED-STATIC", "A", "EV-80", UNPACK,
     "0x9C5B8A-0x9C5F5C;0x9CCAA8-0x9CCC96;0x9BD567-0x9BD58E",
     "full bodies both variants + delegation tail verified + pending-action chain disassembly; independently reproduced by the blind reviewer",
     "a call inside either variant that modifies the mover's arguments (both forward the original args unchanged)",
     "(resolves G40's slot3-variant differential)", "T085-G40-MOVEMENT-SLOT3-VARIANTS.md"),
    ("C-093", "Movement",
     "M item slots: [M+0x190] = per-map STEP TABLE pointer (ctor-zero; installed at 0x9BCD2B in T1 tick and 0x9BC85D in slot1 rebind from [0xBDD498]+0xAC; read 0x6A0545([M+0x190]+0x24) in walk integrator 0x9BD0D9); [M+0x198] = SHOE-attribute item pointer (ctor-zero 0x9BC37E; readers 0x9BD0D9 attrs +0x48/+0x24 combined with [field+8]+0x70/+0x08, friction [M+0x150], multiplier 1.3 [0xB064B0], slip 0.3 [0xB05538]; 0x9BDF18 +0xC; wider 0x9BD1xx-0x9BDCxx family) - BOUNDED NEGATIVE: no setter for M+0x198 exists in the movement/user-dispatch regions (image-wide direct disp32 write census = 10 sites, 9 outside the movement ctor are COM/UI-region writes not targeting M); readers dereference unguarded after state gates, so the installer is outside the examined regions (probable equipment pipeline) and NO default value is statically derivable; the four decrypted movement pairs x/y/vx/vy are unrelated to the shoe slots (T1-era 'DEC slots' wording disambiguated)",
     "PARTIAL-STATIC", "B", "EV-78;EV-80", UNPACK,
     "0x9BC2EB-0x9BC3D8 (ctor zeros);0x9BC852-0x9BC877;0x9BCD1A-0x9BCD2B;0x9BD0D9-0x9BD1B3;0x9BDF18-0x9BDF70",
     "writer census (all encodings) + reader bodies; negative bounded to direct disp32 writes - register-offset/SIB stores into M+0x198 via an aliasing pointer cannot be fully excluded",
     "a write of a shoe/item object into M+0x198 (equipment-pipeline census or runtime capture)",
     "(none)", "T085-G40-MOVEMENT-SLOT3-VARIANTS.md"),
    ("C-094", "Camera",
     "G34 resolved: NO conversion relation exists between 0x5A and 0x1E. Exactly two sites where the constants meet, neither a conversion: (a) 0x9C3D1D T3 slot9 = step OVERRIDE (calls 0x9BCCFB, discards the returned step value - canonical table entry 0x1E per EV-23 - and returns 0x5A); (b) 0x9C9CF7 T4 slot9 = accumulator ([M+0x244] += step; fires at >=0x5A, wraps -0x5A; 3-tick cycle only when the table step is 0x1E - the ratio is threshold/data, not a hardcoded x3). No x3//3 arithmetic between 90 and 30 exists anywhere (two independent censuses). All other uses are disjoint domains: 0x5A = UI metrics (0x95B9F0-0x95C250 family), swim RNG-tick divisors ((rand%400+800)/90, (rand%2000+1000)/90 -> [M+0x4D4]/[M+0x4D8] at 0x9C4BF3/0x9C4DB6/0x9C4EAD/0x9C51BD/0x9C52E5), ASCII 'Z'; 0x1E = geometry half-extents (seat box y 0x965965/0x965976, hit-test expansions 0x9B4AAF/0x9B4B2B/0x9B4F16/0x9B4F92, 0x9D06B9, 0x958624/0x958635, 0x99F453/0x99F4E3), bound compares (0x93B8C4/0x942880/0x955473/0x96D444/0x96DC7F/0x974D24/0x974E1D/0x975D91/0x97A40E), argument pushes, and the step-table data value",
     "CLOSED-STATIC", "A", "EV-81", UNPACK,
     "0x9C3D1D-0x9C3D25;0x9C9CF7-0x9C9D30;0x96595A-0x96599A;0x95B9E0-0x95BA30;immediate census 0x401000-0xA80000",
     "two independent immediate censuses (lead + blind reviewer, different scanners, same image hash) + byte-level re-verification of every differing site",
     "a third 90/30 meeting site or any mul/div-by-3 chain linking the constants",
     "(closes G34)", "T085-G34-CONSTANT-RELATION.md"),
]

NEW_EVIDENCE = [
    ("EV-77", f"{FORENSICS}/T085-EV77-9BE703-PHYSICS-LOOP-FULL.txt",
     "2582b7870f3ead827bea79d94911cc9a884256fcd2b90e822441b50e0e652832",
     "0x9BE703-0x9BF13F;0x9BF7EA-0x9BF9D3;0x9BF144-0x9BF1F9", "instruction",
     "physics loop full recursive-descent body (883 insns) + map-bounds partial-budget helper + corner-wedge cross-product helper + FPU constant table (0.0/0.5/0.499999999/0.001/-0.001/20.0/1.3/0.3)",
     "slot4 physics loop complete body incl all exits and dead-branch anchors", "C-088",
     "research/scripts/t085_dump_evidence.py (sha-pinned, linear model)"),
    ("EV-78", f"{FORENSICS}/T085-EV78-FIRST-TICK-CHAIN.txt",
     "4742e583ee597a498a92fc61d9fc13db088aebba4063e43b4877f65c8e363fbe",
     "0x9BC2EB-0x9BC3D8;0x9D34FA-0x9D3591;0x9BCD6C-0x9BCFD9;0x9BCE78-0x9BCE78+0x170;0x9C2966-0x9C29DB;0x9D4024-0x9D40E4;0x9BDF18-0x9C0037;0x9C1113-0x9C11FB;0x9508E0-0x9509DF;0x9BD0D9-0x9BD1B8;0x9BD567-0x9BD596", "instruction",
     "first-tick chain: base ctor (13 ctx zeros), T7 ctor/allocator, T1 tick with no-ctx path 0x9BCF0C and mode-arg dispatch, T2 recovery tick, T7 tick head, airborne integrator head, same-map teleport full body (mirror pairs M+0x80/0x98/0xB0), cross-map arrival body (random portal pick, 0x9BC602, slot1 arg7=0, y-0xA, 0x948AA2 call), ctx-triplet writer census, walk integrator head, [M+0x158] action",
     "portal-arrival first-tick context rebuild chain end-to-end", "C-088;C-089;C-093",
     "research/scripts/t085_dump_evidence.py"),
    ("EV-79", f"{FORENSICS}/T085-EV79-STANDUP-CALLERS.txt",
     "cc02d2b326ba10cb51c1283f64f4a523073d8970596ad1c6e99f58605fee859e",
     "0x9658CC-0x965A06;0x948AA2-0x948B63;0x95098C-0x9509EB;0x98CFA0-0x98D01F;0x97FCBA-0x97FCD1;0x9D7B8B-0x9D7BEE;0x5CAAA9;0x9BCCC4-0x9BCCF9", "instruction",
     "30-site call [reg+0x38] census + classification; 0x9658CC full body (opcode 0xCF sit/stand, seat box x+-0xA/y+-0x1E, 0x9D35F2 seat teleport, RNG gate, flag=0 slot14); 0x948AA2 full body; arrival caller window; packet-spawn window; router thunk 0x97FCBA; up/down axis construction; key reader 0x5CAAA9; M-family driver disambiguation",
     "user slot14 caller closure + flag provenance + input axis", "C-090;C-091",
     "research/scripts/t085_dump_evidence.py"),
    ("EV-80", f"{FORENSICS}/T085-EV80-SLOT3-VARIANTS.txt",
     "adfa2722d136d0165cad4e7672af8294e887d01d08d210cc84fef814ca673ed2",
     "0xB0C498..0xB0CC78;0x9C5B8A-0x9C5F5C;0x9CCAA8-0x9CCC96;0x9C9CF7-0x9C9D30;0x9D3CCA-0x9D3E29;0x9D3DE6-0x9D3E45;0x95049C-0x9504B5", "instruction",
     "8-table vmap dump (slots 1..16); T3/T5 slot3 full bodies; T4 accumulator; T7 slot5/6 variant heads; user sub-object vtable installs; FSDB 13-map x1/x2 census (2283 records: x1>x2=0, vertical=676)",
     "slot variant map + swim/platform-edge semantics + FSDB structural consequence", "C-089;C-092;C-088",
     "research/scripts/t085_dump_evidence.py"),
    ("EV-81", f"{FORENSICS}/T085-EV81-CONSTANT-5A-1E.txt",
     "6f35840f1a900a16f96a3ed655b29a864af2004f070ba9454f6f70eb41d5e12a",
     "0x9C9CF7-0x9C9D30;0x9C3D1D-0x9C3D25;0x9BCCFB body;0x96595A-0x965999;0x95B9E0-0x95BA2F;immediate census 0x401000-0xA80000", "instruction+census",
     "immediate censuses (0x5A: 82 sites; 0x1E: 223 sites) with domain classification; both 90/30 meeting sites disassembled (override + accumulator); step reader 0x9BCCFB; H1/H2 verdict with falsifiers",
     "G34 constant-relation resolution", "C-094",
     "research/scripts/t085_dump_evidence.py"),
]

NEW_DOCS = [
    ("research/result/stage-readiness/T085-STATIC-FORENSICS-REPORT.md", "ACTIVE", "round-report",
     "C-088;C-089;C-090;C-091;C-092;C-093;C-094", "(t085 commit)", "", "t085 main round report"),
    ("research/result/stage-readiness/T085-G38-FIRST-TICK-CONTEXT.md", "ACTIVE", "round-report",
     "C-088;C-089;C-093", "(t085 commit)", "", "WP1 G38 first-tick context"),
    ("research/result/stage-readiness/T085-G41-STANDUP-TRIGGERS.md", "ACTIVE", "round-report",
     "C-090;C-091", "(t085 commit)", "", "WP2 G41 stand-up triggers"),
    ("research/result/stage-readiness/T085-G40-MOVEMENT-SLOT3-VARIANTS.md", "ACTIVE", "round-report",
     "C-089;C-092;C-093", "(t085 commit)", "", "WP3 G40 slot variants"),
    ("research/result/stage-readiness/T085-G34-CONSTANT-RELATION.md", "ACTIVE", "round-report",
     "C-094", "(t085 commit)", "", "WP4 G34 constants"),
    ("research/result/stage-readiness/T085-STATIC-RESIDUAL-TRIAGE.md", "ACTIVE", "round-report",
     "C-091", "(t085 commit)", "", "WP5 residual triage"),
    (f"{FORENSICS}/T085-REVIEWER-BLIND.md", "ACTIVE", "review", "", "(t085 commit)", "",
     "t085 independent blind reviewer verbatim"),
]

GAP_UPDATES = {
    "G34": {
        "status": "CLOSED-STATIC",
        "verified_scope": "0x1E step input proven (EV-23); t085: H1 conversion REFUTED by two independent immediate censuses - exactly two 90/30 meeting sites, both state-specific step mechanisms (T3 slot9 override 0x9C3D1D returns 90 discarding the table value; T4 slot9 accumulator 0x9C9CF7 threshold 90 over summed steps), all other uses are disjoint domains (0x5A UI/RNG-divisors/ASCII; 0x1E geometry half-extents/bound compares/step data) (C-094/EV-81)",
        "unresolved_scope": "(none)",
        "blocker": "(none)",
        "next_action": "(none)",
        "implementation_impact": "step/tick constants are data and per-state mechanisms, not a 3x30 conversion",
        "claim_refs": "C-033;C-094",
    },
    "G38": {
        "status": "CLOSED-STATIC",
        "verified_scope": "t080 same-map + cross-map chains (C-054/C-055); t082 rebind deferral + projection + bounds (C-061..C-065); t084 handler order (C-083); t085: FIRST-TICK CONTEXT REBUILD CLOSED - 0x9BE703 full body (C-088): same-map = T1 tick 0x9BCD6C no-ctx path 0x9BCF0C (snapshot 4 pairs -> airborne integrate 0x9BDF18 -> slot4 mode=1 -> swept query -> install via slot5 / ret 0 stays airborne); cross-map = fresh T7 object (ctor zeroes 13 ctx fields) -> T7 tick 0x9D4024 delegates to 0x9BCD6C; arrival write 0x9507F0 order re-proven (random portal pick, y-0xA, 0x9BC602 bounds, slot1 arg7=0, 0x953FA5, RNG-gated stand-up 0x948AA2); [M+0x120] cleared-only -> pinned-branch family dead; FSDB x1>x2=0 -> m1>0 landing path covers all non-vertical footholds; verticals = platform-gated, no-install path (C-088/C-089)",
        "unresolved_scope": "(none static; camera refresh timing is tracked in G10 and the 0x81 registration in C-066 - neither is part of the arrival state-transfer question)",
        "blocker": "(none)",
        "next_action": "(none; runtime corroboration of the first-tick chain is optional and not blocking)",
        "implementation_impact": "portal arrival position/state/snap AND first-tick rebuild fully implementable; camera order pending G10",
        "claim_refs": "C-054;C-055;C-061;C-062;C-063;C-064;C-065;C-066;C-083;C-088;C-089;C-090",
    },
    "G40": {
        "verified_scope": "T1 ground-step + 19-field Physics (EV-23/26); head+halfWidth (C-058); 0x9BF1FA chain (C-067); foothold layout + [M+0x110] (C-068/C-080); map-bounds clamp (C-064 chain); two-vtable-family (C-076); fh loader (C-080); slot13 commit/ctx fork (C-078); t085: complete 8-table slot-variant map incl slot4 variants T3/T6 and slot9 variants T3/T4 + T7 slot5/6 overrides (C-089); slot3 variants fully diffed - T3 swim pre-processor (lane/surface sub-modes) and T5 platform-edge rand%2 skip both tail-delegate 0x9BF1FA (C-092); [M+0x190] step-table install proven; [M+0x198] shoe readers + bounded no-setter census (C-093); first-tick landing chain (C-088)",
        "unresolved_scope": "T3 slot4 0x9C6028 and T6 slot4 0x9D06D4 full bodies; walk/swim/land full sequencing inside the 0x9BD757 family; shoe-object installer for M+0x198 (equipment pipeline)",
        "blocker": "none - static work continues",
        "next_action": "disassemble 0x9C6028/0x9D06D4 + 0x9BD757 family; equipment-region census for the M+0x198 writer",
        "implementation_impact": "slope-walk/transition/snap + swim lanes + step data implementable now",
        "claim_refs": "C-029;C-034;C-058;C-063;C-067;C-068;C-076;C-078;C-080;C-088;C-089;C-092;C-093",
    },
    "G41": {
        "status": "CLOSED-STATIC",
        "verified_scope": "climb 3.0 + seat writes (C-056/C-057); rope hit/rope layout (C-069); grab adjudication (C-071); SetStandingContext (C-070); endpoint labels (C-072); halfWidth audit (C-073); type fork (C-078/C-079); rope loader (C-079); [M+0x130/0x134] resolved (C-080); stand-up chain (C-081); t085: slot14 caller enumeration CLOSED (C-090) - flag=0 exactly at 0x965937 (opcode 0xCF STAND sub-case, RNG-gated) and 0x948AB4 (0x948AA2; fired by cross-map arrival 0x9509D7 and movement-packet spawn 0x98D0C2, RNG-gated); flag=1 only 0x9500A3; SIT sub-case fully recovered (seat box x+-0xA/y+-0x1E, 0x9D35F2 seat teleport); up+down input axis arbitration closed - simultaneous presses cancel to 0, no grab (C-091)",
        "unresolved_scope": "(none static; runtime corroboration optional)",
        "blocker": "(none)",
        "next_action": "(none)",
        "implementation_impact": "rope grab/climb/leave + sit/stand + input axis implementable; fork is a data convention (id sign)",
        "claim_refs": "C-029;C-056;C-057;C-069;C-070;C-071;C-072;C-073;C-078;C-079;C-080;C-081;C-090;C-091",
    },
}


def main():
    # claims
    path = os.path.join(SOT, "claims.csv")
    with open(path, encoding="utf-8", newline="") as f:
        rows = list(csv.reader(f))
    header = rows[0]
    existing = {r[0] for r in rows[1:]}
    for c in NEW_CLAIMS:
        assert c[0] not in existing, c[0]
        rows.append(list(c))
    with open(path, "w", encoding="utf-8", newline="") as f:
        csv.writer(f).writerows(rows)

    # evidence
    path = os.path.join(SOT, "evidence.csv")
    with open(path, encoding="utf-8", newline="") as f:
        rows = list(csv.reader(f))
    existing = {r[0] for r in rows[1:]}
    for e in NEW_EVIDENCE:
        assert e[0] not in existing, e[0]
        rows.append(list(e))
    with open(path, "w", encoding="utf-8", newline="") as f:
        csv.writer(f).writerows(rows)

    # documents
    path = os.path.join(SOT, "documents.csv")
    with open(path, encoding="utf-8", newline="") as f:
        rows = list(csv.reader(f))
    for d in NEW_DOCS:
        if d[0] not in {r[0] for r in rows[1:]}:
            rows.append(list(d))
    with open(path, "w", encoding="utf-8", newline="") as f:
        csv.writer(f).writerows(rows)

    # gaps
    path = os.path.join(SOT, "gaps.csv")
    with open(path, encoding="utf-8", newline="") as f:
        rows = list(csv.reader(f))
    hdr = rows[0]
    gi = {h: i for i, h in enumerate(hdr)}
    for r in rows[1:]:
        if r[0] in GAP_UPDATES:
            upd = GAP_UPDATES[r[0]]
            for k, v in upd.items():
                r[gi[k]] = v
    with open(path, "w", encoding="utf-8", newline="") as f:
        csv.writer(f).writerows(rows)

    # matrix
    with open(MATRIX, encoding="utf-8", newline="") as f:
        mrows = list(csv.DictReader(f))
        fields = list(mrows[0].keys())
    for r in mrows:
        if r["requirement_id"] == "P3-15":
            r["claim_ids"] = "C-057;C-066;C-081;C-090;C-091"
            r["evidence_ids"] = "EV-38;EV-52;EV-69;EV-79"
            r["evidence_grade_and_type"] = ("A（0xCF dispatch 指令级绑定 + t085 起身触发枚举闭合：flag=0 恰好两处 "
                                            "0x965937/0x948AB4（到达与包生成路径 RNG 门控），flag=1 仅 0x9500A3；"
                                            "SIT 子命令含座位占用盒 x±0xA/y±0x1E 与 0x9D35F2 座位传送；上下键轴仲裁闭合）")
            r["unproven"] = "—（t085 起身/坐下触发链与输入轴已静态闭合；运行时佐证可选）"
            r["gap_ids"] = "G41"
            r["can_static_continue_or_runtime"] = "无（flag=0/flag=1/动态 flag 调用点枚举已完成 t085 C-090/EV-79；静态无残项）"
            r["readiness"] = "RE-READY"
            r["minimum_next_work"] = "无（触发链闭合；可选运行时佐证不阻塞）"
        if r["requirement_id"] == "P4-06":
            r["claim_ids"] = "C-054;C-055;C-061;C-062;C-063;C-064;C-065;C-083;C-084;C-088;C-089;C-090"
            r["evidence_ids"] = "EV-35;EV-36;EV-45;EV-46;EV-47;EV-48;EV-50;EV-51;EV-70;EV-73;EV-77;EV-78;EV-79"
            r["evidence_grade_and_type"] = ("A（t082 全链 + t085 首帧链闭合：跨图新鲜 T7 对象构造清零、到达写顺序、"
                                            "T1/T7 tick 无 ctx 路径 mode=1 重建、落地 slot5 安装/垂段无安装路径、"
                                            "RNG 门控起身通知）")
            r["unproven"] = "Camera 更新顺序（G10 关联，运行时；归属 P4-07 自身残项而非本项运动状态重置行为）"
            r["blocks_acceptance"] = "否（传送后速度/立足/座位/游泳态重置与首帧重建已闭合 t085 C-088/C-089/C-090；Camera 残项在 P4-07/G10 独立跟踪）"
            r["can_static_continue_or_runtime"] = "本项静态闭合（t085）；Camera 刷新时机归 P4-07/G10 运行时 dump"
            r["readiness"] = "RE-READY"
            r["minimum_next_work"] = "无（运动侧首帧链已闭合；Camera 顺序见 P4-07/G10）"
    with open(MATRIX, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(mrows)
    print("ledgers updated: claims +%d, evidence +%d, docs +%d, gaps %s, matrix P3-15/P4-06" %
          (len(NEW_CLAIMS), len(NEW_EVIDENCE), len(NEW_DOCS), list(GAP_UPDATES)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
