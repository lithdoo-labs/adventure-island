"""T090 ledger update: append claims C-116..C-119, evidence EV-104..EV-107,
refine gaps G10/G36/G37/G39 verified/unresolved scopes (no status migration —
all stay PARTIAL-STATIC per the closure conditions), and update the matrix +
gap register. Idempotent (marker-scan)."""
import csv
import hashlib
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SOT = REPO / "research/source-of-truth"
SR = REPO / "research/result/stage-readiness"

EXE_SHA = "d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718"
SHAPE_SHA = "9802baccd787543221391b4b902ce199e99fb2cde6a4edadc2f4972490c8111b"
GR2D_SHA = "ad67b9a08a0a360e9a31f0274d29b8cb9839d95d691762961454c806ef6a25d1"
MAPWZ_SHA = "9e0d2a0fcecac2c99ee3cb15b03c41b5617d7d0637b55fb132f0eeed27155f69"


def rd(p):
    with open(p, encoding="utf-8", newline="") as f:
        return list(csv.reader(f))


def wr(p, rows):
    with open(p, "w", encoding="utf-8", newline="") as f:
        csv.writer(f, lineterminator="\n").writerows(rows)


def cano(p):
    return hashlib.sha256(Path(p).read_bytes().replace(b"\r\n", b"\n")).hexdigest()


def main():
    claims_p = SOT / "claims.csv"
    if "C-116" in Path(claims_p).read_text(encoding="utf-8"):
        print("already applied")
        return

    # ---------------- claims
    rows = rd(claims_p)
    hdr = rows[0]
    idx = {n: i for i, n in enumerate(hdr)}
    new_claims = [
        ["C-116", "Camera",
         "G10 FILTER CONSUMER CHAIN CLOSED (t090; resolves the G10 residual 'whether the filtered coordinate feeds the slot15 consume side' — structurally YES): Shape2D CWzVector2D carries an ANIMATION WRAPPER sub-object at [this+0x24] (ctor 0x51407340, vtable stack {0x5140D8F0 primary, +0x10: 0x5140D8EC, +0xC: 0x5140D8E8, +0x30: 0x5140D8F4}; x/y by VALUE at w+0x20/+0x24; record list w+0x14; resolved outputs w+0x60..+0x88 incl. X@w+0x70/Y@w+0x74); the FILTER COMMIT 0x51408C9A (slot +0xA8) CREATES the wrapper via 0x514072CF(&v+0x24, [v+0x1C], [v+0x20]) on first commit and installs the id-0x1E0000 record (coef at rec+8) into the wrapper list via 0x5140833B — the EXE arming chain 0x437717 (map load, C-114) therefore INSTANTIATES the wrapper on the shared camera; the X/Y GETTERS (slots +0x20 0x5140724A / +0x28 0x514074C8) route through the wrapper resolver 0x51406ADC whenever [this+0x24]!=NULL — the resolver runs the ENGINE 0x51406CF7 INLINE on each getter call when the global tick advanced, applying ALL pending records (filter deadband/residual + interp + parallax) and returning the FILTERED coordinate from w+0x70/+0x74; the IMMEDIATE Set fast path (0x5140830E) writes the RAW [v+0x1C]/[v+0x20] ONLY when the wrapper is NULL — with the wrapper armed it applies DELTAS onto the animated coordinate via 0x51407A34 ([w+0x20]+=new_x−current_x), preserving the filter displacement; EXE call [reg+0xA4] census = 0 sites (all modrm forms incl. SIB) — the EXE never queries the filter coefficient; the +0xA4 body (0x51408BED) is an internal query-and-remove returning the COEFFICIENT; threshold constants [0x5140D8C8]=0.0 (sign gate in 0x51408D23), deadband [0x5140D978]=28.0, round clamps 0.499999999/0.5, 360.0 and 1/180 at the resolver outputs; consequently scene-cull slot15, world→screen 0x9EA446 and every other getter consumer read the FILTERED camera coordinate whenever the wrapper is armed (C-108 'IMMEDIATE store' wording hereby refined: raw-store holds only for the UNARMED vector)",
         "CLOSED-STATIC", "A", "EV-106", "unpack079+shape2d",
         "0x51407340;0x514072CF;0x51408C9A;0x51408C9F-0x51408CA9;0x5140724A;0x514074C8;0x51406ADC;0x51406CF7;0x5140830E-0x5140832E;0x51407A34;0x51408BED",
         "wrapper ctor vtable/field layout; commit creates wrapper + commits record; getter branch on [this+0x24] with resolver pump; engine record application adds deltas at 0x51406F73-0x51406F81; Set fast-path branch; A4 census negative",
         "a getter path that bypasses 0x51406ADC while [this+0x24]!=0, or an armed-state consumer reading [v+0x1C] directly",
         "refines C-108 (immediate-store wording, no reversal)",
         "forensics/T090-G10-FILTER-CONSUMERS.md"],
        ["C-117", "Map/Background",
         "G39 WZ FRAME TIMING CLOSED AT RESOURCE LEVEL (t090; three of the four T089 residuals closed): (1) per-frame EXPLICIT delay values EXIST in the original CMS079 Map.wz (sha 9e0d2a0f…5f69) — census of the 13 target maps + MapHelper portal family = 4,347 frame rows / 475 resources: 2,450 frames carry explicit delay (35 distinct values 100..4000; top: 190×284, 200×265, 170×258, 180×248, 165×215, 205×196, 3000×99), 456 frames carry a0/a1 fades, z0/z1 absent from the corpus; 329 multi-frame animated resources split 99 all-explicit / 225 NO-explicit (consumer-default-dependent) / 5 mixed-within-frameset — normalizing all frames to 120 ms is REFUTED by the resource data; (2) animationScale DEFAULT = 1000 — the timeline accumulator is Gr2D 0x5040B9DE = the [vt+0x110] slot of the node-class primary vtable 0x5042E3F0 (0x5042E3F0+0x110=0x5042E500 holds the single-occurrence dword), and its head coerces the V3 VARIANT arg via 0x504027BB whose VT_EMPTY/VT_ERROR fast path (0x5040283D) stores arg3 = 0x3E8 — every classified registration passes V{VT_ERROR,missing} so the effective scale is 1000 and the per-frame advance is delay·1000/1000 = delay global-tick units (unsigned per-frame div 0x5040BCD0, signed total idiv 0x5040BC60); (3) COMPLETE 36-site delay-consumer default matrix: 120×18 (ALL imm8 '6A 78' seeds; incl. frame converter 0x43EC81 + tiler 0x66ABCD), 150×2 (0x406EDC/0x4071E3), 60×2 (0x40811B/0x40907F), 180×3 (0x40EE4B/0x40F595/0x410832, bytes 68 B4 00 00 00), 1000×2 (0x5FA885/0x9420D6), register-seeded×9 — the PORTAL family flat-record delay read 0x71A72A (inside the portal-graphics reader 0x71A203: ids tm 0x5FF/tn 0x600/pv 0x601/MapHelper.img 0x602/game 0x603/hideTooltip 0xD86/onlyOnce 0xF50/delay 0x155D→rec+0x2C) has DEFAULT = ebx = 0 (xor ebx,ebx @0x71A21C, no rewrite); (4) the original portal frames carry NO delay (pv=8, ph/default Start/Continue/Exit=4/7/3 — origin only; the only explicit portal timing is psh/1 portalStart/0 {a0=0,a1=200,delay=1500} and portalExit/0 {a0=255,a1=0,delay=1500}; psh/2=6/14/6, psh/3=6/14/6 per the blind reviewer cross-check) — the 960/480/840/360 ms figures remain DEFAULT-BASED estimates and the per-frame portal consumer default is NOT yet byte-located (the portal loaders register via 0x43E3A6→slot25 and call neither 0x43EC69 nor 0x427DE0; the portal band 0x71A000-0x71C000 has no per-frame 0x155D read besides the flat 0x71A72A)",
         "CLOSED-STATIC", "A", "EV-104;EV-105", "mapwz+unpack079+gr2d",
         "Map.wz (whole census); 0x5040B9DE;0x504027BB;0x5040283D;0x5042E500;0x71A203+0x71A72A;36 delay sites",
         "wz-python census over the sha-pinned original WZ; accumulator head scale coercion decode; per-site seed-idiom byte scan (68/6A imm + reg forms); portal reader head xor ebx,ebx",
         "a differing frame census from the same Map.wz bytes, or an additional explicit-default site class",
         "resolves three G39 residuals; portal per-frame default residual retained in G39",
         "forensics/T090-G39-ANIMATION-TIMELINE.md;forensics/T090-G39-WZ-FRAME-CENSUS.csv;forensics/T090-G39-DEFAULT-CONSUMER-MATRIX.csv;forensics/T090-G39-PORTAL-DURATIONS.csv"],
        ["C-118", "Map/Background",
         "G36 +0x9C METHOD BODY CLOSED (t090; the G36 '+0x9C variant semantics' residual): Shape2D slot +0x9C = 0x514086B3 on BOTH vector-family tables (0x5140C2F0/0x5140C0FC, identical dwords), ret 0x34 (this + 12 stack dwords); semantics = RECTANGLE-EXTENT MEMBER ATTACH: validates two int extents ([ebp+0x24]/[ebp+0x28]) against 0xFFFFFF (unsigned ja → E_INVALIDARG 0x80070057), VARIANT-gates [ebp+0xC] (VT_EMPTY/VT_ERROR → fast path 0x5140878F: global-collection record 0x51409FC8/0x51408856 + dictionary 0x514054A8), else coerces to VT_UI4 (0x51405A4B) and resolves the collection member 0x51405448; the fast path computes a RECT (x1=[ebp+0x1C], y1=[ebp+0x20], x2=x1+ext1, y2=y1+ext2) applied to the record+0xC via [0x5141185C], installs a clamp-vs-mod mode handler at rec+0x1C (0x514088DB / 0x514088A9 by the 0x51408A12 flag), builds the current-pos wrapper and COMMITS via 0x5140833B into the SAME pending list as Set-interp/parallax/filter, then invokes the member's [vt+8]; EXE call [reg+0x9C] census = 8 sites (0x43759C/0x4379D4 in the 0x437717 filter-arming family wrappers; 0x4B3B0B/0x4B3EC1 UI family with dynamic rect math (2*ecx+0xA5, 2*ecx+0xD4, 0x18-ecx, 0x28-ecx); 0x66B1A6/0x66C0EF/0x66D6D0/0x66DA86 map-band tiler) — materially DIFFERENT from +0x90 (position Set) and +0x98 (parallax ratio attach): it attaches a rect-defined animated member",
         "CLOSED-STATIC", "A", "EV-106", "shape2d+unpack079",
         "0x514086B3-0x5140884D;0x5140878F-0x51408835;vtables 0x5140C2F0/0x5140C0FC +0x9C;8 EXE sites",
         "full body decode incl. clamps/variant gate/fast path/rect math/pending-list commit; slot dwords on both tables; EXE census all modrm forms",
         "differing Shape2D bytes at the body, or a 9th EXE call site",
         "(closes the G36 +0x9C residual)",
         "forensics/T090-G36-SLOT9C-DISASM.txt"],
        ["C-119", "Camera",
         "G10 FOCUS-WRITER CALLER TABLE REFINED (t090; refines C-115 — no reversal): anchored decode of all 10 E8 callers of 0x93CB27 (ret 0xC = this,record,N,arg3; 0x769B51 ret 4): 8 sites pass arg3=0 PROVABLY at the call (0x93E00B ebx xor@0x93DFF8; 0x959527 push 0; 0x964E16/0x9651CC/0x98DC43 ebx pre-push; 0x965567 ebx; 0x990E21/0x990E91 esi=xor@0x990B42 in fn 0x990B2E — CORRECTS the T089 reviewer's object reading); 0x5C0342 passes arg3=esi = the containing method's this (focus-this=[esi+0x10], string-id [esi+0x44]); 0x959493's arg3=[ebp+0x20] of fn 0x9573A6 is CALLER-DEPENDENT — object (esi) via caller 0x5C031A, zero via 0x95282D and 0x955126; known-tag records through arg3=0 sites would fault [[0]+0x14] — only 0x5C0342 and 0x959493(via 0x5C031A) can byte-legally execute the Set; 0x98DC43's containing code calls the [0xBDD460] getter 0x43291A at 0x98DC0C then 0x43D092 — the packet-spawn focus caller runs in the same global-camera-manager context as the 0x437717 filter arming (C-114); the [[arg3]+0x14] member-writer census and the arg3↔[user+0xF28] relationship remain OPEN (two dataflows; +0xF28 direct-write census by the blind reviewer: 64 reads, 5 cmps, exactly ONE direct writer = ctor-zero 0x934443, so the F28 container is installed register-mediated/aliased)",
         "CLOSED-STATIC", "A", "EV-107;EV-94", "unpack079",
         "10 anchored caller windows; 0x9573A6 caller windows (0x5C031A/0x95282D/0x955126);0x990B2E+0x990B42",
         "anchored back-decode + register-init proofs + caller-of-caller arg propagation for 0x959493",
         "a caller window whose arg3 decoding differs from the table",
         "refines C-115 (caller-table precision; no reversal of [[arg3]+0x14])",
         "forensics/T090-G10-ARG3-POSITION-WRITERS.csv;forensics/T090-WP0A-CALLERS-ANCHORED.txt"],
    ]
    for c in new_claims:
        row = [""] * len(hdr)
        for k, v in zip(hdr, c):
            row[idx[k]] = v
        rows.append(row)
    wr(claims_p, rows)

    # ---------------- evidence
    ev_p = SOT / "evidence.csv"
    ev_rows = rd(ev_p)
    ev_hdr = ev_rows[0]
    eidx = {n: i for i, n in enumerate(ev_hdr)}
    census_csv = SR / "forensics/T090-G39-WZ-FRAME-CENSUS.csv"
    matrix_csv = SR / "forensics/T090-G39-DEFAULT-CONSUMER-MATRIX.csv"
    timeline_md = SR / "forensics/T090-G39-ANIMATION-TIMELINE.md"
    fc_md = SR / "forensics/T090-G10-FILTER-CONSUMERS.md"
    s9c = SR / "forensics/T090-G36-SLOT9C-DISASM.txt"
    arg3 = SR / "forensics/T090-G10-ARG3-POSITION-WRITERS.csv"
    res25 = SR / "forensics/T090-G10-RESIDUAL-SLOT90-CLASSIFICATION.csv"
    new_ev = [
        ["EV-104", str(MAPWZ_src := ".work/task-001/extracted/冒险岛online/Map.wz"), MAPWZ_SHA,
         "whole-file census: Map/Map2/{13 maps}.img back+obj layers; MapHelper.img/portal/game/{pv,ph,psh}",
         "resource+census",
         "wz-python (repo-local, region EMS) frame-property walk; per-frame delay/a0/a1/z0/z1/origin capture; canvas-vs-frameset discrimination",
         f"4,347 frame rows / 475 resources; 2,450 explicit delays (35 distinct values); 225 of 329 multi-frame resources default-dependent; portal frames delay-less (pv 8, ph 4/7/3; psh/1 delay=1500 with a0/a1; psh/2-3 = 6/14/6); companion census sha {cano(census_csv)[:16]}…; timeline doc sha {cano(timeline_md)[:16]}…",
         "C-117", "research/scripts/t090_wp1b_frame_census.py + t090_wp1b_census_summary.py + t090_wp1d_timeline_model.py + t090_wp1d_portal_durations.py (sha-pinned inputs)"],
        ["EV-105", ".work/task-063/client-stage/Gr2D_DX8.dll", GR2D_SHA,
         "0x5040B9DE head+accumulator; 0x504027BB; 0x5040283D; 0x5042E500; EXE 36 delay sites; 0x71A203+0x71A72A",
         "instruction+census",
         "accumulator = [vt+0x110] of 0x5042E3F0 (single-occurrence dword); scale coercion default 1000 at the VT_EMPTY/VT_ERROR fast path; per-site seed-idiom scan (imm8 6A 78 / imm32 68 xx / register forms); portal reader fn 0x71A203 (xor ebx,ebx @0x71A21C)",
         f"animationScale default 1000; default matrix 120×18/150×2/60×2/180×3/1000×2/register×9 (portal flat = 0); companion matrix sha {cano(matrix_csv)[:16]}…",
         "C-117", "research/scripts/t090_wp1c_portal_default_scale.py + t090_wp1c_scale_callers.py + t090_wp1c_accum_vt.py + t090_wp1b_default_matrix.py + t090_wp1b_reg_seeds.py + t090_wp1b_annotate_matrix.py"],
        ["EV-106", ".work/task-063/client-stage/Shape2D.dll", SHAPE_SHA,
         "0x51407340;0x514072CF;0x51408C9A;0x5140724A;0x514074C8;0x51406ADC;0x51406CF7;0x5140830E;0x51407A34;0x51408BED;0x514086B3;vtables 0x5140C2F0/0x5140C0FC; EXE call [reg+0xA4]/[reg+0xA8]/[reg+0x9C] censuses",
         "instruction+census",
         "wrapper ctor/layout; filter commit creates wrapper; getter branch → resolver → inline engine pump; Set delta-store path; +0x9C full body (clamps/rect/pending-list commit); EXE censuses 0/3/8",
         f"filtered-coordinate consumer chain closed (getters return filtered when wrapper armed; immediate Sets = deltas); +0x9C = rect-extent member attach; companion docs sha filter-consumers {cano(fc_md)[:16]}… slot9c {cano(s9c)[:16]}…",
         "C-116;C-118", "research/scripts/t090_wp4b_filter_query.py + t090_wp4b_walker.py + t090_wp4b_engine.py + t090_wp4b_wrapper.py + t090_wp4b_wrapper2.py + t090_wp4b_getters.py + t090_wp4b_resolver.py + t090_wp4b_aux_store.py + t090_wp4b_commit.py + t090_wp2a_slot9c.py + t090_wp2a_slot9c_fastpath.py"],
        ["EV-107", ".work/task-036/game-image-unpacked.bin", EXE_SHA,
         "10 anchored caller windows of 0x93CB27; 0x9573A6 + 3 caller windows; 0x990B2E; 25 slot90 residual sites",
         "instruction+census",
         "caller-table refinement (8 zero / 2 object-capable incl. caller-dependent 0x959493); 25-site residual classification: 18 SHARED-WRITE-CONTEXT-POSSIBLE (0x31D resolve in-function, receiver via pointer deref, linkage untraced) + 7 RECEIVER-OTHER-POSSIBLE (no 0x31D in function)",
         f"arg3 table sha {cano(arg3)[:16]}…; residual classification sha {cano(res25)[:16]}…; blind-reviewer adjudications D-A (180×3 bytes confirmed 68 B4 00 00 00), D-B (all 18 120-sites are imm8 6A 78), D-C (0x959493 caller-dependent) in T090-ADJUDICATION-DADBDC.txt",
         "C-119", "research/scripts/t090_wp0a_callers_anchored.py + t090_wp4a_arg3_identity.py + t090_wp4c_classify25.py + t090_wp4c_verify_receivers.py + t090_wp4c_downgrade.py + t090_adjudicate_da_db_dc.py"],
    ]
    for e in new_ev:
        row = [""] * len(ev_hdr)
        for k, v in zip(ev_hdr, e):
            if k in eidx:
                row[eidx[k]] = v
        ev_rows.append(row)
    wr(ev_p, ev_rows)

    # ---------------- gaps (verified/unresolved refinement, statuses unchanged)
    gaps_p = SOT / "gaps.csv"
    g_rows = rd(gaps_p)
    g_hdr = {n: i for i, n in enumerate(g_rows[0])}
    for r in g_rows[1:]:
        gid = r[g_hdr["gap_id"]]
        if gid == "G39":
            r[g_hdr["verified_scope"]] = (
                "t080 registration chain; t089 timing core (C-112/C-113); t090 (C-117/EV-104/EV-105): "
                "WZ-side per-frame EXPLICIT delay census CLOSED from the original Map.wz (4,347 frames; "
                "2,450 explicit; 35 distinct values; 225/329 multi-frame resources default-dependent); "
                "animationScale default = 1000 CLOSED (accumulator 0x5040B9DE = [vt+0x110] of 0x5042E3F0; "
                "0x504027BB fast path 0x5040283D); COMPLETE 36-site consumer-default matrix CLOSED "
                "(120×18 imm8-seeded, 150×2, 60×2, 180×3, 1000×2, register×9); portal original frames "
                "proven delay-less (pv=8, ph 4/7/3; only psh/1 carries delay=1500+a0/a1); numeric "
                "timeline model with 32-bit semantics")
            r[g_hdr["unresolved_scope"]] = (
                "per-frame consumer default for the PORTAL family (the flat record read 0x71A72A "
                "defaults 0 but is a different dataflow; the portal loaders use 0x43E3A6→slot25 and "
                "call neither 0x43EC69 nor 0x427DE0); 8 register-seeded delay defaults remain variable "
                "(dataflow not pinned); 960/480/840/360 ms figures stay default-based estimates")
            r[g_hdr["next_action"]] = (
                "locate the portal per-frame delay consumer (runtime draw path if absent statically) or "
                "accept the documented boundary; pin the 8 variable register-seed defaults")
        if gid == "G36":
            r[g_hdr["verified_scope"]] = (
                "t080 layout/modes/spans; t089 +0x90/+0x98 bodies + property names (C-111); t090: "
                "+0x9C (0x514086B3) FULLY DECODED (C-118) = rect-extent member attach committed to the "
                "shared pending list, materially different from +0x90/+0x98; attach-baseline mechanism "
                "documented (snapshot of the [0xBE2788] origin position at registration); 13-map "
                "per-record layout table from the ORIGINAL WZ (387 back records with C-051 spans + "
                "C-111 ratios, viewport 800×600)")
            r[g_hdr["unresolved_scope"]] = (
                "first-frame ABSOLUTE screen offsets — statically unprovable in principle (attach "
                "baseline is a runtime snapshot; load-order interleaving with camera writers is E2/E3 "
                "pump-phase, see G10); per-tile object draw bodies (runtime)")
            r[g_hdr["next_action"]] = ("product-side first-frame layout using the closed formulas + "
                                       "documented baseline anchor")
        if gid == "G37":
            r[g_hdr["verified_scope"]] = (
                "t080 Obj/tiling share; t089 flow-child animation timing on the shared engine; t090: "
                "the engine's resource-level facts extend to Obj (delay census includes all 13-map obj "
                "layers — 3,540 obj frames, 2,114 explicit delay; the 120-default tiler read 0x66ABCD "
                "covers the flow-child per-frame defaults); the timeline model applies unchanged")
            r[g_hdr["unresolved_scope"]] = (
                "per-frame DRAW bodies of flow instances (rendering path remains runtime-bound) — "
                "unchanged; no separate Obj-family timing logic exists in the decoded engine "
                "(shared with Background)")
        if gid == "G10":
            r[g_hdr["verified_scope"]] = (
                "t088 identity/formula/Set/triggers/cadence/bounds; t089 filter mechanics + (0,-50) "
                "arming; t090: FILTER CONSUMER CHAIN CLOSED (C-116) — the filter commit creates the "
                "animation wrapper on the shared camera, the X/Y getters route through the "
                "wrapper resolver which pumps the engine inline and returns the FILTERED coordinate "
                "(w+0x70/+0x74) whenever armed, and immediate Sets apply as deltas (0x51407A34) "
                "preserving the filter displacement — scene-cull slot15 and world→screen consume the "
                "filtered coordinate structurally; EXE +0xA4 query census = 0; focus-writer caller "
                "table refined (C-119: 8 arg3=0, 2 object-capable; 0x98DC43 in the [0xBDD460] "
                "context); 25 residual slot90 sites classified (18 SHARED-WRITE-CONTEXT-POSSIBLE / "
                "7 RECEIVER-OTHER-POSSIBLE, each with a concrete static reason)")
            r[g_hdr["unresolved_scope"]] = (
                "[[arg3]+0x14] member-writer census (the +0x14 store on the caller-supplied objects — "
                "the geometric point identity); arg3↔[user+0xF28] relationship (F28 has exactly ONE "
                "direct writer = ctor-zero, per the blind reviewer — installed register-mediated); "
                "E2/E3 pump interleaving of filtered target vs immediate Sets (statically "
                "undecidable); wrapper persistence across scene transitions; receiver linkage for the "
                "18 POSSIBLE sites (pointer-deref receivers, exact object untraced); slot15-family "
                "derived-table install chain (t088.1 bounded negative stands)")
    wr(gaps_p, g_rows)

    print("claims 115->119; evidence 103->107; gaps G10/G36/G37/G39 refined (statuses unchanged)")


if __name__ == "__main__":
    main()
