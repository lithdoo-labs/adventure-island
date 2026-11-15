#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""t089_reviewer_fixes.py — apply T089 Phase-2 reviewer corrections D1-D8, D15.

D1 (BLOCKING): C-114/C-115/EV-102/G10 — 0x43291A is `mov eax,[0xBDD460]; ret`
   (global getter, not a creator); 0x437717 runs on the [0xBDD460] global with
   the existing [user+0xF28] container as arg1 (stash+AddRef 0x950978-85); the
   0x31D->0x447891 resolution is the C-106 shared-SINGLETON chain (stated);
   containing functions of the other two +0xA8 sites are 0x942AC5 / 0x94A2AE.
D2 (BLOCKING): C-112/EV-100/G39 — withdraw 'UNIVERSAL DEFAULT 120': 18 of 36
   delay sites pair with 0x78; others carry explicit defaults 150/60/180/1000
   or variable defaults.
D3: match-matrix rows 2/3 branch<->address swap fix.
D5: EV-103 cipher zero-plaintext quirk note.
D6: EV-100/EV-102 cross-module EXE provenance annotation.
D8: 'index domains 1..47' -> 0-based per-map counts 1..47.
D15: G36/G39 scroll-phase 'END TIME' downgraded to correlative wording.
"""
import csv
import io
import os
import re
import sys

REPO = os.environ.get('RE_VALIDATE_ROOT') or os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SOT = os.path.join(REPO, 'research', 'source-of-truth')
ST = os.path.join(REPO, 'research', 'result', 'stage-readiness')


def edit_csv(path, key_col, key, updates):
    with open(path, 'r', encoding='utf-8', newline='') as f:
        rows = list(csv.DictReader(f))
        fields = list(rows[0].keys())
    hit = False
    for r in rows:
        if r[key_col] == key:
            r.update(updates)
            hit = True
    assert hit, key
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=fields, lineterminator='\r\n')
    w.writeheader()
    w.writerows(rows)
    with open(path, 'w', encoding='utf-8', newline='') as f:
        f.write(buf.getvalue())


def main() -> int:
    EXE_SHA = 'd4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718'

    # ---------- D2: C-112 claim ----------
    edit_csv(os.path.join(SOT, 'claims.csv'), 'claim_id', 'C-112', {
        'claim': "G39 FRAME TIMING CORE CLOSED (t089): CMS079 delay property id = 0x155D (namespace-decrypted 'delay'); the frame converter 0x43EC69 (push 0x78 at 0x43EC79 before push 0x155D) and the tiler per-child read 0x66ABC5 pair DEFAULT 120 with the id — 18 of the 36 push-0x155D sites carry default 120 (phase-2 D2 correction: the default is NOT universal; other consumers pass explicit defaults 150/60/180/1000 or variable defaults, e.g. 0x406ED1/0x408113/0x40EE40/0x5FA87A families); a0/a1 = ids 0x1550/0x1551 defaults -1; z0/z1 = 0x323/0x324; all six delivered via 0x427DE0 = vtable slot +0x104 to Gr2D 0x5040ABE6 (frame-record writer: VT_I4-checked stores delay@+0x0C, a0@+0x10, a1@+0x14, z-pair@+0x18/+0x1C, -1 defaults, serial inc [esi+0xD0] on insertion); Gr2D timeline accumulator (in the function containing 0x5040B9E7) computes end-timestamp += frameDelay*animationScale/1000 (unsigned per-frame div 0x3E8; signed total loop period) into event records {+0x10 end-ts, +0x14 period|-1} gated by mode flags 0x20 (loop) / 0x10 (one-shot) from mode selector 0x50403ECA ([this+0x2C]: 0x17->0x10, 0x16->0x20)",
        'address': "0x43EC69-0x43EF70;0x5040ABE6-0x5040AD5D;0x5040B952-0x5040BD60;0x50403ECA;explicit-default sites 0x406ED1/0x408113/0x40EE40/0x5FA87A",
    })

    # ---------- D1: C-114 + C-115 claims ----------
    edit_csv(os.path.join(SOT, 'claims.csv'), 'claim_id', 'C-114', {
        'claim': "G10 CAMERA SMOOTH FILTER PROVEN IN CMS079 (t089; cross-checked against OpenMS GMS083 51408d23/51408e33 candidates; phase-2 D1 chain correction applied): Shape2D Vector2D slot +0xA8 (0x51408C9A) = filter COMMIT — finds/creates evaluator id 0x1E0000 (template vtables 0x5140D968/0x5140D964/0x5140D974; record method 0x51408D23) and stores the coefficient at [rec+8]; slot +0xA4 (0x51408BED) = filter query; commit method 0x51408D23 SNAPS on first commit (double history X/Y +0x10/+0x18, time +0x20), then per axis D = target-history with residual 0x51408E33: |D|<=28.0 ([0x5140D978] DEADBAND) -> no approach; else residual = max(0, coef*1000*|D|/(elapsed*|D|+coef*1000)) (imul 0x3E8 materializes coef*1000), output = D-residual sign-directed, round-clamped +-0.5, int-committed; EXE integration: exactly 3 call [vector+0xA8] sites — 0x43787D inside 0x437717 (push 0x64 = COEFFICIENT 100), 0x942DF7 (containing SEH function 0x942AC5), 0x94A796 (containing SEH function 0x94A2AE), all IID-0xBA0500-tagged; 0x437717 runs on the GLOBAL [0xBDD460] object (caller 0x95098C-0x950993: 0x43291A = mov eax,[0xBDD460]; ret — a getter, NOT a creator; the [user+0xF28] container is stashed+AddRef'd as arg1 at 0x950978-85 after its old value is Released at 0x950970-85; no F28 write-back in this window) and resolves 0x31D via 0x447891 = the C-106 SHARED-SINGLETON Vector2D chain (the camera object itself) -> attaches it to the F28-container arg -> +0x90 Set(0,-0x32) [= (0,-50) GEOMETRIC OFFSET matching the GMS083 (x,y-50) candidate] -> +0xA8 filter commit(100) -> attach into renderer origin (0x4371B1 on [0xBE2788]); the arming therefore lands the smooth filter ON THE SHARED CAMERA VECTOR with the user-container target at (0,-50)",
        'address': "0x51408BED;0x51408C9A;0x51408D23-0x51408E30;0x51408E33-0x51408E7D;0x437717-0x4379A2;0x43787D;0x43291A;0x942DF7 (fn 0x942AC5);0x94A796 (fn 0x94A2AE);0x950970-0x950993",
    })
    edit_csv(os.path.join(SOT, 'claims.csv'), 'claim_id', 'C-115', {
        'claim': "G10 FOCUS-WRITER SOURCE WORDING CORRECTION (t089, refines C-109/EV-94 with the T089 blind reviewer's caller-idiom finding; no re-disassembly of #6/#7): 0x769B51 is ret 4 (ONE arg), so the 10 callers of the focus writer 0x93CB27 pass (record, N in {500,800,1000}, arg3); the Set path's source object is [[arg3]+0x14] obtained via getter 0x93CD77 (arg3 = the caller-supplied object), while the [this+0xF28]-based path via 0x4B1C27 handles unknown vtable tags (0x4F5C6A/0xD7511E) and SKIPS the Set — therefore the t088 phrasing 'src=[[this+0xF28]+0x14]' is NOT byte-proven for the Set path and is corrected to [[arg3]+0x14]; [user+0xF28] remains the container bound as the shared camera vector's (0,-50) target parent by 0x437717 on the [0xBDD460] global (C-114 phase-2 corrected chain)",
    })

    # ---------- D2/D6/D15: evidence ----------
    edit_csv(os.path.join(SOT, 'evidence.csv'), 'evidence_id', 'EV-100', {
        'instruction_or_data': "EXE (sha d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718): push 0x78 + push 0x155D at 18 of 36 delay sites (frame converter 0x43EC69 + tiler 0x66ABC5; other sites carry explicit defaults 150/60/180/1000 or variable defaults — phase-2 D2); delay/a0/a1/z0/z1 reads; delivery call 0x427DE0 (slot+0x104). Gr2D (this file): 0x5040ABE6 VT_I4-checked stores delay@+0x0C a0@+0x10 a1@+0x14 (-1 defaults, serial inc 0x5040AC96). Accumulator: end-ts += delay*[scale]/1000 (div 0x3E8 unsigned at 0x5040BCD0; total period idiv at 0x5040BC60); event records {+0x10 end-ts,+0x14 period|-1}; mode gates 0x20/0x10; mode selector 0x50403ECA reads [this+0x2C]",
        'interpretation': "delay default 120 at the frame-converter/tiler family (18/36 sites; default NOT universal per phase-2 D2) + ms-class unit (scale/1000) + end-timestamp accumulation + loop/one-shot modes",
    })
    edit_csv(os.path.join(SOT, 'evidence.csv'), 'evidence_id', 'EV-102', {
        'instruction_or_data': "Shape2D (this file): filter id 0x1E0000 find/install (slots +0xA4/+0xA8); commit method snap-on-first-commit, doubles history, deadband 28.0 ([0x5140D978]), residual max(0,coef*1000*D/(dt*D+coef*1000)) (imul 0x3E8), +-0.5 round clamps. EXE (sha d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718): exactly 3 call [vt+0xA8] sites (0x43787D coef 100 in 0x437717; 0x942DF7 in fn 0x942AC5; 0x94A796 in fn 0x94A2AE); 0x437717 chain per phase-2 D1: runs on global [0xBDD460] (0x43291A getter), resolves the C-106 shared-singleton Vector2D, attaches to the [user+0xF28] container arg (stash+AddRef 0x950978-85), Set(0,-0x32), filter commit(100), origin-attach",
        'interpretation': "CMS079 smooth camera filter present and armed with coefficient 100 on the SHARED camera Vector2D with a (0,-50) target parented to the [user+0xF28] container — G10 focus provenance (phase-2 corrected chain)",
    })
    edit_csv(os.path.join(SOT, 'evidence.csv'), 'evidence_id', 'EV-103', {
        'interpretation': "static property/class name resolution — closes the G36 string-name residual and grounds G35/G39/G10 id claims; PHASE-2 D5 NOTE: the zero-plaintext quirk rule (p==0 -> store key byte, per 0x7A4DEA) is an encoder inference — names 'flow' and 'back%d' depend on it and remain inference-grade (all other listed names do not)",
    })

    # ---------- gaps: G39 (D2 wording), G10 (D1 chain), G36 (D15), G35 (D8) ----------
    with open(os.path.join(SOT, 'gaps.csv'), 'r', encoding='utf-8', newline='') as f:
        rows = list(csv.DictReader(f))
        fields = list(rows[0].keys())
    for r in rows:
        if r['gap_id'] == 'G39':
            r['verified_scope'] = r['verified_scope'].replace(
                "delay id 0x155D default 120 universal (18 sites)",
                "delay id 0x155D default 120 at the frame-converter/tiler family (18 of 36 sites; others carry explicit defaults 150/60/180/1000 — phase-2 D2)")
            r['unresolved_scope'] = r['unresolved_scope'].replace(
                "per-frame EXPLICIT delay values (WZ-side; absent from static FSDB); animationScale default value",
                "per-frame EXPLICIT delay values (WZ-side; absent from static FSDB); animationScale default value; per-consumer default table for the 18 non-120 sites")
        if r['gap_id'] == 'G10':
            r['verified_scope'] = r['verified_scope'].replace(
                "0x437717 = target-vector helper (resolve 0x31D -> create -> attach parent -> +0x90 Set(0,-0x32) = (0,-50) offset -> +0xA8 filter(100) -> attach into renderer origin via 0x4371B1 on [0xBE2788]); caller 0x950993 (in 0x94F715) renews [user+0xF28] then calls 0x437717",
                "0x437717 (phase-2 D1 corrected) runs on the GLOBAL [0xBDD460] (0x43291A getter at 0x95098C), resolves the C-106 SHARED-singleton Vector2D, attaches it to the [user+0xF28] container arg (stashed 0x950978-85), +0x90 Set(0,-0x32) = (0,-50), +0xA8 filter(100), origin-attach — the smooth filter is armed ON the shared camera vector")
        if r['gap_id'] == 'G36':
            r['verified_scope'] = r['verified_scope'].replace(
                "scroll phase = Set-interpolation END TIME globalTick+20000/|rate|",
                "scroll phase delivered as the +0x90 VT_I4 time parameter (flag 0x10000000) with value globalTick+20000/|rate| — END-TIME reading is CORRELATIVE (pending-list walker body undecoded; C-108 'duration' wording retained; phase-2 D15)")
        if r['gap_id'] == 'G35':
            r['verified_scope'] = r['verified_scope'].replace(
                "index domains 1..47 inside the strict back<tile<obj<front envelope",
                "per-map record counts 1..47 (index 0-based) inside the strict back<tile<obj<front envelope")
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=fields, lineterminator='\r\n')
    w.writeheader()
    w.writerows(rows)
    with open(os.path.join(SOT, 'gaps.csv'), 'w', encoding='utf-8', newline='') as f:
        f.write(buf.getvalue())

    # ---------- D3: match matrix rows 2/3 swap ----------
    mp = os.path.join(ST, 'T089-OPENMS-CMS079-MATCH-MATRIX.csv')
    txt = open(mp, 'r', encoding='utf-8', newline='').read()
    txt = txt.replace(
        "G35,https://docs.openms.dev/client/client-evidence,GMS083,0x0063CD4E back B-128000+index*1000,0x669923-0x669929",
        "G35,https://docs.openms.dev/client/client-evidence,GMS083,0x0063CD4E back B-128000+index*1000,0x669930-0x669936")
    txt = txt.replace(
        "G35,https://docs.openms.dev/client/client-evidence,GMS083,0x0063CD4E front B+272000+index*1000,0x669930-0x669936",
        "G35,https://docs.openms.dev/client/client-evidence,GMS083,0x0063CD4E front B+272000+index*1000,0x669923-0x669929")
    txt = txt.replace("blind-notes-independent-confirmation", "phase2-verified")
    open(mp, 'w', encoding='utf-8', newline='').write(txt)
    print('ledger + matrix corrections applied')
    return 0


if __name__ == '__main__':
    sys.exit(main())
