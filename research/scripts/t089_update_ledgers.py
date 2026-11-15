#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""t089_update_ledgers.py — append T089 claims/evidence, update gaps, correct C-024/EV-20.

All edits are surgical: append rows to claims.csv / evidence.csv; rewrite specific gap
rows (G35/G36/G37/G39/G10); mark C-024 superseded-by-C-110 with an in-place revision note
(history preserved); EV-20 row is NOT deleted — its interpretation is annotated superseded
(immutable-provenance rule: original text kept, status note appended).
"""
import csv
import io
import os
import sys

REPO = os.environ.get('RE_VALIDATE_ROOT') or os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SOT = os.path.join(REPO, 'research', 'source-of-truth')


def read_csv(path):
    with open(path, 'r', encoding='utf-8', newline='') as f:
        rows = list(csv.reader(f))
    return rows[0], rows[1:]


def write_csv(path, header, rows):
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator='\r\n')
    w.writerow(header)
    w.writerows(rows)
    with open(path, 'w', encoding='utf-8', newline='') as f:
        f.write(buf.getvalue())


def main() -> int:
    # ---------- claims ----------
    cp = os.path.join(SOT, 'claims.csv')
    ch, crows = read_csv(cp)
    idx = {r[0]: i for i, r in enumerate(crows)}

    new_claims = [
        ["C-110", "Map/Sort",
         "G35 BACKGROUND DEPTH KEY CLOSED (t089, supersedes C-024's 0x423E6B attribution): CMS079 back key = -0x40000000 - 128000 + index*1000 and front key = -0x40000000 + 271200 + index*1000, computed at 0x669923/0x669930 (imul eax,eax,0x3E8; sub eax,0x4001F400 / 0x3FFBDCA0) inside Back loader 0x669397; branch = boolean-normalized WZ property 0x54B (namespace-decrypted 'front'); index = Back child enumeration order (caller loop 0x6692B9-0x66936E passes edi as arg1); the key is consumed by BOTH registration branches: non-ani 0x427EB3 slot25 insertion (key pushed at 0x669BD6) and ani-branch creation 0x43E3A6 (key pushed at 0x669FE6); whole-image census = 61 imul-1000 sites (EV-20's 'exactly 1' superseded; 0x423E6B is an unrelated x1000 scaling); 13-map FSDB: 387 Back records, 26 front=1, index domains 1..47 — all inside the strict back<tile<obj<front ordering envelope. Cross-version: back constant IDENTICAL to the OpenMS GMS083 candidate (B-128000) but the front constant DIFFERS (CMS079 B+271200 vs GMS083 B+272000, delta 800) — direct porting refuted by bytes",
         "CLOSED-STATIC", "A", "EV-98",
         "unpack079", "0x66991C-0x66993B;0x6692B9-0x66936E;0x6698C7-0x669904;0x669BD6;0x669FE6",
         "imul/sub pairs with folded constants 0x4001F400 (B-128000) and 0x3FFBDCA0 (B+271200); je polarity: front==0 -> 0x4001F400 path; enumeration loop feeds edi; two consumption sites push [ebp-0x34]",
         "any differing bytes at the four cited windows or any second background-key imul-1000 site in the 0x66xxxx band",
         "supersedes C-024 (address 0x423E6B attribution)",
         "T089-G35-BACKGROUND-KEY.md;T089-G35-KEY-SEARCH.txt;T089-G35-FUNCTION-CHAIN.txt;T089-G35-FSDB-CENSUS.txt;T089-OPENMS-CMS079-MATCH-MATRIX.csv"],
        ["C-111", "Map/Background",
         "G36 PARALLAX ENGINE CLOSED AT DLL LEVEL (t089): CMS079 Shape2D.dll 0x5140847D (vtable slot +0x98 of BOTH vector-family tables 0x5140C0FC and 0x5140C2F0 — absolute slots 0x5140C194/0x5140C388; +0x90 numeric Set 0x5140828F at 0x5140C18C/0x5140C380) is the parallax attach: validates source, allocates record {+8 src,+0xC X0,+0x10 Y0,+0x14 Dx,+0x18 Dy,+0x1C Wx,+0x20 Wy}, SNAPS the attachment baseline (source X/Y via 0x51405CD9/0x51405D00), stores denominators/numerators (loader passes 100,100 and rx/ry or auto-scroll forms (0,ry+100)/(rx+100,0) at 0x66A729/0x66A792), installs the evaluator into the pending list (0x5140833B — same list as Set interpolation); evaluator 0x514085B3 computes localX += trunc((srcX_now-srcX_attach)*Wx/Dx) and localY += trunc((srcY_now-srcY_attach)*Wy/Dy) via signed idiv (truncate-toward-zero) — instruction-identical to the OpenMS GMS083 contract cited at the same addresses; scroll phase (C-060) = globalTick + 20000/|rate| delivered as VT_I4 with flag 0x10000000 = the Set-interpolation END TIME (auto-scroll duration in tick-ms), where globalTick = Vector2D slot +0x58 (0x514076CC reads [0x51411C34]; monotonic writer slot +0x5C 0x514076E8); property names closed by namespace decryption: 0x545/0x546/0x547/0x548/0x54A/0x549 = rx/ry/cx/cy/a/ani (full table in EV-103)",
         "CLOSED-STATIC", "A", "EV-99;EV-103",
         "unpack079+shape2d", "0x5140847D-0x5140857C;0x514085B3-0x51408609;0x514076CC;0x514076E8;0x5140C2F0+0x98",
         "attach stores snapshot+ratios; evaluator sub/imul/cdq idiv/add per axis; ret 0x18 / ret 0xC shapes",
         "differing Shape2D bytes at 0x5140847D/0x514085B3 or a different slot target for the loader's +0x98 calls",
         "(none)",
         "T089-SHAPE2D-GR2D-ENGINE.md;T089-DLL-CROSSVERSION-PROBES.txt;T089-SHAPE2D-CONST-VTABLES.txt"],
        ["C-112", "Map/Background",
         "G39 FRAME TIMING CORE CLOSED (t089): CMS079 delay property id = 0x155D (namespace-decrypted 'delay') with UNIVERSAL DEFAULT 120 (push 0x78 immediately before push 0x155D at 18 EXE sites incl. frame converter 0x43EC69 (0x43EC79/0x43EC81) and the tiler per-child read 0x66ABC5-0x66ABCD); a0/a1 = ids 0x1550/0x1551 defaults -1; z0/z1 = 0x323/0x324; all six delivered via 0x427DE0 = vtable slot +0x104 to Gr2D 0x5040ABE6 (frame-record writer: VT_I4-checked stores delay@+0x0C, a0@+0x10, a1@+0x14, z-pair@+0x18/+0x1C, -1 defaults, serial inc [esi+0xD0] on insertion); Gr2D timeline accumulator (in the function containing 0x5040B9E7) computes end-timestamp += frameDelay*animationScale/1000 (unsigned per-frame div 0x3E8; signed total loop period) into event records {+0x10 end-ts, +0x14 period|-1} gated by mode flags 0x20 (loop) / 0x10 (one-shot) from mode selector 0x50403ECA ([this+0x2C]: 0x17->0x10, 0x16->0x20)",
         "CLOSED-STATIC", "A", "EV-100",
         "unpack079+gr2d", "0x43EC69-0x43EF70;0x5040ABE6-0x5040AD5D;0x5040B952-0x5040BD60;0x50403ECA",
         "push 0x78/push 0x155D pairing x18; VT_I4 store layout; imul+div/idiv 0x3E8 accumulation",
         "differing bytes at the cited Gr2D/EXE windows or an additional delay default value",
         "(none)",
         "T089-SHAPE2D-GR2D-ENGINE.md;T089-G39-DELAY-SITES.txt;T089-G39-DELAY-DEFAULT.txt;T089-G39-FRAME-CONVERTER.txt;T089-GR2D-FRAME-REGION.txt"],
        ["C-113", "Map/Background",
         "G39 REPEAT + PORTAL FAMILY (t089): CMS079 repeat property id = 0x8D4 (decrypted 'repeat'; id 0x1061 'repeatStartIndex' also in pool); read by Obj loader 0x66885B (the C-002 key function — structural counterpart of GMS083 0x0063C212) into an out-slot; registration dispatcher 0x66F890 triages: repeat>=0 -> mode 0x20 (loop; value passed as VT_I4 — repeating-suffix start) via [obj.vtable+0x110]; repeat==-1 -> mode 0; repeat==-2 -> mode 0x10 one-shot gated by 0x443717 + property read 0x402C26; other -> no registration. Portal graphics family: ids pv=0x601, Map/MapHelper.img=0x602, game=0x603, portalStart=0xF7D, portalContinue=0xF7E, portalExit=0xF7F (consumer sites 0x71AExx-0x71Bxxx); 13-map FSDB HelperFrame frame counts: pv=8, ph/default portalStart=4, portalContinue=7, portalExit=3 — identical to the GMS083-documented 8 / 4+7+3 split (960/480/840/360 ms at the proven 120-ms default when per-frame delays absent)",
         "CLOSED-STATIC", "A", "EV-101;EV-103",
         "unpack079+fsdb", "0x66885B+0x66891C;0x66F890-0x66FA8E;0x71BAE3;0x71BDA9;0x71B81C",
         "cmp -1 / cmp -2 triage with pushes 0x20/0/0x10; [vt+0x110] registrations; FSDB resource paths helper/portal/game/*",
         "differing triage bytes or differing FSDB portal frame counts",
         "(none)",
         "T089-SHAPE2D-GR2D-ENGINE.md;T089-G39-REPEAT-SITES.txt;T089-G39-PORTAL-IDS.txt"],
        ["C-114", "Camera",
         "G10 CAMERA SMOOTH FILTER PROVEN IN CMS079 (t089; cross-checked against OpenMS GMS083 51408d23/51408e33 candidates): Shape2D Vector2D slot +0xA8 (0x51408C9A) = filter COMMIT — finds/creates evaluator id 0x1E0000 (template vtables 0x5140D968/0x5140D964/0x5140D974; record method 0x51408D23) and stores the coefficient at [rec+8]; slot +0xA4 (0x51408BED) = filter query; commit method 0x51408D23 SNAPS on first commit (double history X/Y +0x10/+0x18, time +0x20), then per axis D = target-history with residual 0x51408E33: |D|<=28.0 ([0x5140D978] DEADBAND) -> no approach; else residual = max(0, coef*1000*|D|/(elapsed*|D|+coef*1000)) (imul 0x3E8 materializes coef*1000), output = D-residual sign-directed, round-clamped +-0.5, int-committed; EXE integration: exactly 3 call [vector+0xA8] sites — 0x43787D inside 0x437717 (push 0x64 = COEFFICIENT 100), 0x942DF7 (0x9426B0), 0x94A796 (0x949DA3), all IID-0xBA0500-tagged; 0x437717(parent) = resolve 0x31D -> create vector -> +0x64 attach to parent -> +0x90 Set(0,-0x32) [= (0,-50) GEOMETRIC OFFSET matching the GMS083 (x,y-50) candidate] -> +0xA8 filter commit(100) -> attach into renderer origin (0x4371B1 on [0xBE2788]); caller 0x950993 (in 0x94F715) renews [user+0xF28] (release old, 0x43291A new) then calls 0x437717 on it",
         "CLOSED-STATIC", "A", "EV-102",
         "unpack079+shape2d", "0x51408BED;0x51408C9A;0x51408D23-0x51408E30;0x51408E33-0x51408E7D;0x437717-0x4379A2;0x43787D;0x942DF7;0x94A796;0x950970-0x950993",
         "push 0x1E0000; fcom [0x5140D978]=28.0; imul 0x3E8; snap path stores doubles+time; Set(0,-0x32); push 0x64",
         "differing Shape2D filter bytes, additional +0xA8 call sites, or absence of the 0x437717->0x950993 chain",
         "(none)",
         "T089-SHAPE2D-GR2D-ENGINE.md;T089-G10-FILTER-CALLSITES.txt;T089-G10-FILTER-FUNCTIONS.txt;T089-G10-FILTER-CALLERS.txt;T089-G10-FILTER-CALLERS2.txt"],
        ["C-115", "Camera",
         "G10 FOCUS-WRITER SOURCE WORDING CORRECTION (t089, refines C-109/EV-94 with the T089 blind reviewer's caller-idiom finding; no re-disassembly of #6/#7): 0x769B51 is ret 4 (ONE arg), so the 10 callers of the focus writer 0x93CB27 pass (record, N in {500,800,1000}, arg3); the Set path's source object is [[arg3]+0x14] obtained via getter 0x93CD77 (arg3 = the caller-supplied object), while the [this+0xF28]-based path via 0x4B1C27 handles unknown vtable tags (0x4F5C6A/0xD7511E) and SKIPS the Set — therefore the t088 phrasing 'src=[[this+0xF28]+0x14]' is NOT byte-proven for the Set path and is corrected to [[arg3]+0x14]; [user+0xF28] remains the container whose renewal (0x950970/0x950993 in 0x94F715) immediately arms the (0,-50)+filter(100) target vector via 0x437717 (C-114)",
         "CLOSED-STATIC", "A", "EV-94;EV-102",
         "unpack079", "0x769B51;0x93CB27+0x93CC20;0x93CD77;0x950970-0x950993",
         "ret 4 at 0x769B51; 0x4B1C27 unknown-tag branch skips Set; 0x93CD77 getter returns [+0x14]-derived position",
         "a caller of 0x93CB27 passing fewer/more args or a Set path reading [this+0xF28]+0x14 directly",
         "refines C-109 (no reversal)",
         "T089-G10-FILTER-CALLERS2.txt;T089-OPENMS-STATIC-GAP-CLOSURE-REPORT.md"],
    ]
    for row in new_claims:
        if row[0] in idx:
            print(f"claim {row[0]} already present; skipping append")
            continue
        crows.append(row)

    # C-024 revision note (history preserved; add supersession marker in reasoning + supersedes col)
    i024 = idx.get('C-024')
    if i024 is not None and 'T089-REVISED' not in crows[i024][8]:
        crows[i024][8] += " [T089-REVISED: address 0x423E6B attribution REFUTED — whole-image census finds 61 imul-1000 sites and 0x423E6B is an unrelated x1000 scaling; see C-110/EV-98]"
        crows[i024][3] = 'SUPERSEDED'
        crows[i024][10] = 'superseded by C-110'
    write_csv(cp, ch, crows)
    print(f"claims.csv: {len(crows)} rows")

    # ---------- evidence ----------
    ep = os.path.join(SOT, 'evidence.csv')
    eh, erows = read_csv(ep)
    eidx = {r[0]: i for i, r in enumerate(erows)}
    EXE_SHA = 'd4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718'
    SHAPE_SHA = '9802baccd787543221391b4b902ce199e99fb2cde6a4edadc2f4972490c8111b'
    GR2D_SHA = 'ad67b9a08a0a360e9a31f0274d29b8cb9839d95d691762961454c806ef6a25d1'
    new_evidence = [
        ["EV-98", ".work/task-036/game-image-unpacked.bin", EXE_SHA,
         "0x66991C-0x66993B;0x6692B9-0x66936E;0x6698C7-0x669904;0x669BD6;0x669FE6;whole-image 0x69-imul census",
         "instruction+census",
         "imul eax,eax,0x3E8; sub eax,0x4001F400 (back) / 0x3FFBDCA0 (front); front flag = boolean(property 0x54B); index = enumeration order (loop 0x6692B9); key pushed at 0x669BD6 (slot25 insertion) and 0x669FE6 (0x43E3A6 ani-creation); 61 imul-1000 sites image-wide",
         "back key = B-128000+index*1000; front key = B+271200+index*1000 (GMS083 B+272000 REFUTED for CMS079); EV-20 'exactly 1 site' superseded",
         "C-110", "research/scripts/t089_wp1_g35_key.py + t089_wp1b_g35_chain.py + t089_wp1c_g35_consume.py + t089_wp1d_g35_consume2.py + t089_wp1e_g35_site2.py (sha-pinned, capstone); companion T089-G35-FSDB-CENSUS.txt from t089_wp1g_g35_fsdb.py"],
        ["EV-99", ".work/task-063/client-stage/Shape2D.dll", SHAPE_SHA,
         "0x5140847D-0x5140857C;0x514085B3-0x51408609;0x514076CC;0x514076E8;vtables 0x5140C0FC/0x5140C2F0",
         "instruction",
         "attach: snapshot srcX/Y at rec+0xC/+0x10, ratios +0x14..+0x20, evaluator install via 0x5140833B; evaluator: [edi]+=trunc((src_now-src_attach)*num/den) via cdq+idiv per axis; slot+0x58=[0x51411C34] getter; slot+0x5C monotonic setter",
         "parallax displacement contract + baseline snapshot + global-tick clock — G36 +0x90/+0x98 bodies closed; scroll phase = interpolation end-time",
         "C-111", "research/scripts/t089_wp2a_dll_probes.py + t089_wp5a_shape2d_vt.py (sha-pinned, capstone+pefile)"],
        ["EV-100", ".work/task-063/client-stage/Gr2D_DX8.dll", GR2D_SHA,
         "0x43EC69-0x43EF70 (EXE); 0x5040ABE6-0x5040AD5D; 0x5040B952-0x5040BD60; 0x50403ECA",
         "instruction",
         "EXE: push 0x78 + push 0x155D x18 sites; delay/a0/a1/z0/z1 reads; delivery call 0x427DE0 (slot+0x104). Gr2D 0x5040ABE6: VT_I4-checked stores delay@+0x0C a0@+0x10 a1@+0x14 (-1 defaults, serial inc). Accumulator: end-ts += delay*[scale]/1000 (div 0x3E8 unsigned; total period idiv); event records {+0x10 end-ts,+0x14 period|-1}; mode gates 0x20/0x10; mode selector 0x50403ECA reads [this+0x2C]",
         "delay default 120 + ms-class unit (scale/1000) + end-timestamp accumulation + loop/one-shot modes",
         "C-112", "research/scripts/t089_wp3a_g39_delay.py + t089_wp3b_g39_default.py + t089_wp3d_frameconv.py + t089_wp3e_gr2d_slot104.py + t089_wp3f_gr2d_region.py + t089_wp3g_gr2d_accum.py (sha-pinned)"],
        ["EV-101", ".work/task-036/game-image-unpacked.bin", EXE_SHA,
         "0x66885B+0x66891C;0x66F890-0x66FA8E;0x71BAE3;0x71BDA9;0x71B81C;content FSDB map.helper.jsonl",
         "instruction+resource",
         "repeat id 0x8D4 read in Obj loader 0x66885B -> out-slot; 0x66F890 triage (>=0 -> push 0x20 loop via [vt+0x110]; -1 -> mode 0; -2 -> push 0x10 one-shot with 0x443717 gate); portal ids pv=0x601/MapHelper=0x602/game=0x603/Start=0xF7D/Continue=0xF7E/Exit=0xF7F; FSDB helper frames pv=8, ph Start/Continue/Exit = 4/7/3",
         "repeat semantics + portal animation family structure with frame counts matching GMS083 8 / 4+7+3",
         "C-113", "research/scripts/t089_wp3h_repeat.py + t089_wp3i_portal_ids.py (sha-pinned); FSDB content/[FSDB]adventure/[group]map.HelperFrame/map.helper.jsonl"],
        ["EV-102", ".work/task-063/client-stage/Shape2D.dll", SHAPE_SHA,
         "0x51408BED;0x51408C9A;0x51408D23-0x51408E30;0x51408E33-0x51408E7D; EXE 0x437717-0x4379A2;0x43787D;0x942DF7;0x94A796;0x950970-0x950993",
         "instruction+census",
         "filter id 0x1E0000 find/install (slots +0xA4/+0xA8); commit method: snap-on-first-commit, doubles history, deadband 28.0 ([0x5140D978]), residual max(0,coef*1000*D/(dt*D+coef*1000)) (imul 0x3E8), +-0.5 round clamps; EXE: exactly 3 call [vt+0xA8] sites; 0x437717 = create->attach->Set(0,-0x32)->filter(100)->origin-attach; 0x950993 renews [user+0xF28] then calls it",
         "CMS079 smooth camera filter present and armed with coefficient 100 on a (0,-50) target attached to the [user+0xF28] container — G10 focus provenance",
         "C-114;C-115", "research/scripts/t089_wp5c_filter_calls.py + t089_wp5d_filter_fns.py + t089_wp5f_filter_callers.py + t089_wp5g_filter_callers2.py (sha-pinned)"],
        ["EV-103", ".work/task-036/game-image-unpacked.bin", EXE_SHA,
         "namespace table 0xBA7B04 (records 0xBC96xx/0xBAD8xx/0xBB56xx etc.)",
         "data+decryption",
         "C-103 cipher applied to the full id table: 0x54B='front'; 0x543/0x544=bS/Map/Back/; 0x545-0x54A=rx/ry/cx/cy/ani/a; 0x54D=back/%d; 0x331/0x332/0x323/0x324=x/y/z0/z1; 0x1581=type; 0xBF0=flow; 0x54F-0x553=moveType/moveR/moveW/moveH/moveP; 0x155D/0x1550/0x1551=delay/a0/a1; 0x8D4=repeat; 0x1061=repeatStartIndex; 0x601/0x602/0x603/0x656=pv/Map/MapHelper.img/game/pg; 0xF7D/0xF7E/0xF7F=portalStart/portalContinue/portalExit; 0x53B=once; 0x53A=blend; 0x31D=Shape2D#Vector2D (control); 0x819=Gr2D_DX8 (control)",
         "static property/class name resolution — closes the G36 string-name residual and grounds G35/G39/G10 id claims",
         "C-110;C-111;C-112;C-113", "research/scripts/t089_wp1f_names.py + t089_wp5b_ns_bulk.py (cipher per C-103/t087_wp1_fieldctx_d4.py)"],
    ]
    for row in new_evidence:
        if row[0] in eidx:
            print(f"evidence {row[0]} already present; skipping")
            continue
        erows.append(row)
    # EV-20 annotation (history preserved)
    i20 = eidx.get('EV-20')
    if i20 is not None and 'T089-REVISED' not in erows[i20][6]:
        erows[i20][6] += " [T089-REVISED: superseded by EV-98 — 61 imul-1000 sites exist; the single-site context claim is withdrawn]"
    write_csv(ep, eh, erows)
    print(f"evidence.csv: {len(erows)} rows")

    # ---------- gaps ----------
    gp = os.path.join(SOT, 'gaps.csv')
    gh, grows = read_csv(gp)
    gidx = {r[0]: i for i, r in enumerate(grows)}

    def setgap(gid, status, verified, unresolved, blocker, next_action, impact, claims):
        i = gidx[gid]
        grows[i][3] = status
        grows[i][4] = verified
        grows[i][5] = unresolved
        grows[i][6] = blocker
        grows[i][7] = next_action
        grows[i][8] = impact
        grows[i][9] = claims

    setgap('G35', 'CLOSED-STATIC',
           "t089 (C-110/EV-98): back key = B-128000+index*1000; front key = B+271200+index*1000 (GMS083 B+272000 refuted, delta 800); branch = boolean(WZ 'front', id 0x54B name-proven); index = Back child enumeration order (loop 0x6692B9-0x66936E); BOTH consumption branches byte-proven (non-ani slot25 insertion at 0x669BD6; ani-branch creation 0x43E3A6 at 0x669FE6); 61-site whole-image census (EV-20 'exactly 1' withdrawn); 13-map FSDB 387 records / 26 front / index domains 1..47 inside the strict back<tile<obj<front envelope; signed boundary vectors incl. negative-index arithmetic checks",
           "(none static)", "(none)",
           "(none; closure complete — runtime corroboration optional)",
           "background queue separation + front-layer ordering now EXACTLY implementable (ORIGINAL-STATIC-PROVEN; use B+271200 for front, NOT the v83 constant)",
           "C-024;C-110")

    setgap('G36', 'PARTIAL-STATIC',
           "t080: 0x66A8D5 layout/modes/zero-step/span/scroll-phase; t089 (C-111/EV-99/EV-103): +0x90 (numeric Set 0x5140828F) and +0x98 (parallax attach 0x5140847D + evaluator 0x514085B3 with baseline snapshot + idiv truncation) method bodies CLOSED statically from Shape2D.dll; receiver = Shape2D vector-family tables (0x5140C2F0/0x5140C0FC, layout-invariant); scroll phase = Set-interpolation END TIME globalTick+20000/|rate| (slot+0x58 getter [0x51411C34], monotonic +0x5C setter); ALL property names closed (bS/no/x/y/rx/ry/cx/cy/a/ani/type/front + delay/a0/a1); auto-scroll ratio forms (0,ry+100)/(rx+100,0) reconfirmed",
           "first-frame ABSOLUTE screen offsets (attachment-baseline dependent — statically unprovable in principle, same boundary as OpenMS GMS083); +0x9C (0x514086B3) variant-method semantics; per-map numeric first-frame layout (product computation over FSDB)",
           "none - static work continues (bounded): +0x9C decode optional",
           "STATIC (optional): decode 0x514086B3; then product-side first-frame layout computation using the now-closed formulas",
           "P0 13-map background placement fully implementable incl. parallax + auto-scroll timing (offsets anchored to attachment baseline as documented)",
           "C-024;C-048;C-049;C-050;C-051;C-052;C-060;C-111")

    setgap('G37', 'PARTIAL-STATIC',
           "t080: Obj shares 0x66A8D5 with flow mapping; single-instance flow=0; per-child creation 0x427DE0 slot+0x104; t089 (C-112/C-113): per-child properties ARE delay/a0/a1 (names proven; tiler read sites with default 120/-1/-1); delivery -> Gr2D frame writer 0x5040ABE6 (delay@+0x0C etc.) + accumulator/mode engine + 0x66F890 repeat triage — flow-child ANIMATION TIMING semantics closed on the shared proven engine",
           "per-frame DRAW bodies of flow instances (rendering path remains runtime-bound)",
           "method draw bodies not in image",
           "same residual class as G36 dynamic draw; no separate Obj-family re-disassembly planned",
           "P0 flow records implementable with exact animation timing; per-frame draw stays engine-side",
           "C-017;C-049;C-052;C-112;C-113")

    setgap('G39', 'PARTIAL-STATIC',
           "t080: registration chain, origin slots, five auto-move attrs, scroll-phase delivery; t089 (C-112/C-113/EV-100/EV-101): delay id 0x155D default 120 universal (18 sites); a0/a1 defaults -1; Gr2D record layout delay@+0x0C/a0@+0x10/a1@+0x14; timeline accumulation delay*scale/1000 -> end timestamps with mode gates 0x20/0x10; repeat triage >=0/-1/-2 -> loop/0/one-shot; portal family ids + FSDB frame counts pv=8, Start/Continue/Exit=4/7/3 (= GMS083 counts); clock base = Shape2D global tick (slots +0x58/+0x5C)",
           "per-frame EXPLICIT delay values (WZ-side; absent from static FSDB); animationScale default value; resource-level portal durations beyond the default-120 computation",
           "frame delay data lives in WZ resources not present as static samples",
           "WZ-side frame delay extraction (out of STATIC-EXE scope) or accept default-based timing with documented boundary",
           "P1 animated visuals implementable with default-120/exlicit-delay rule + repeat modes + portal structure (resource delay values feed in as data)",
           "C-024;C-059;C-060;C-112;C-113")

    setgap('G10', 'PARTIAL-STATIC',
           "t088 verified scope unchanged; t089 (C-114/C-115/EV-102): CMS079 smooth filter PROVEN — Shape2D slots +0xA4/+0xA8, filter id 0x1E0000, deadband 28.0, coef*1000 residual formula, snap-on-first-commit; 3 EXE commit sites; 0x437717 target-vector helper = create->attach->Set(0,-50)->filter(100)->origin-attach, called at 0x950993 immediately after [user+0xF28] renewal in 0x94F715; focus-writer source wording corrected to [[arg3]+0x14] (0x93CD77 getter; [this+0xF28] path skips the Set)",
           "[[arg3]+0x14] member write census (the +0x14 store into the arg3 object); runtime interleaving of filtered target vs immediate shared-Vector2D Sets (E2/E3 pump phases statically undecidable); 25 INCONCLUSIVE direct-slot sites (not decoded this round); slot15-family derived-table install chain; whether/where the filtered coordinate feeds the slot15 consume side",
           "none - static work continues",
           "STATIC: census writers of [obj+0x14] on the arg3 class; decode the 25 INCONCLUSIVE containing functions; trace filtered-coordinate consumers; then re-evaluate closure",
           "camera follow now has a PROVEN candidate mechanism (smooth filter, 28px deadband, coef 100) + proven (0,-50) target geometry — product may implement follow via this engine while pump-phase interleaving remains a documented design boundary",
           "C-026;C-028;C-101;C-102;C-103;C-104;C-106;C-107;C-108;C-109;C-114;C-115")

    write_csv(gp, gh, grows)
    print(f"gaps.csv: {len(grows)} rows")
    return 0


if __name__ == '__main__':
    sys.exit(main())
