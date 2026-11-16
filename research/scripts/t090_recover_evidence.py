"""T090 RECOVERY: evidence.csv lost its rows to a bad write (phase-3 script).
Rebuild: HEAD (WP0, 103 rows) -> + EV-104..107 (with D1=44 fix + host-path
note + D5 refreshed sha already folded in)."""
import csv
import hashlib
import io
import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
EV = REPO / "research/source-of-truth/evidence.csv"
FORENSICS = REPO / "research/result/stage-readiness/forensics"

EXE_SHA = "d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718"
SHAPE_SHA = "9802baccd787543221391b4b902ce199e99fb2cde6a4edadc2f4972490c8111b"
GR2D_SHA = "ad67b9a08a0a360e9a31f0274d29b8cb9839d95d691762961454c806ef6a25d1"
MAPWZ_SHA = "9e0d2a0fcecac2c99ee3cb15b03c41b5617d7d0637b55fb132f0eeed27155f69"


def cano(p):
    return hashlib.sha256(Path(p).read_bytes().replace(b"\r\n", b"\n")).hexdigest()


# 1. restore from HEAD
head_csv = subprocess.run(
    ["git", "show", "HEAD:research/source-of-truth/evidence.csv"],
    capture_output=True, cwd=str(REPO)).stdout.decode("utf-8")
rows = list(csv.reader(io.StringIO(head_csv)))
hdr = rows[0]
eidx = {n: i for i, n in enumerate(hdr)}
print(f"restored {len(rows) - 1} evidence rows from HEAD")

# sanity: EV-96 must carry the WP0-updated hash (t088 deadzone file annotation)
ev96 = next(r for r in rows if r and r[0] == "EV-96")
assert ev96[eidx["source_sha256"]].startswith("01fe0460"), "HEAD EV-96 hash unexpected"

census = cano(FORENSICS / "T090-G39-WZ-FRAME-CENSUS.csv")
matrix = cano(FORENSICS / "T090-G39-DEFAULT-CONSUMER-MATRIX.csv")
timeline = cano(FORENSICS / "T090-G39-ANIMATION-TIMELINE.md")
fcm = cano(FORENSICS / "T090-G10-FILTER-CONSUMERS.md")
s9c = cano(FORENSICS / "T090-G36-SLOT9C-DISASM.txt")
arg3 = cano(FORENSICS / "T090-G10-ARG3-POSITION-WRITERS.csv")
res25 = cano(FORENSICS / "T090-G10-RESIDUAL-SLOT90-CLASSIFICATION.csv")

new_ev = [
    ["EV-104", ".work/task-001/extracted/冒险岛online/Map.wz", MAPWZ_SHA,
     "whole-file census: Map/Map2/{13 maps}.img back+obj layers; MapHelper.img/portal/game/{pv,ph,psh}",
     "resource+census",
     "wz-python (repo-local, region EMS) frame-property walk; per-frame delay/a0/a1/z0/z1/origin capture; canvas-vs-frameset discrimination",
     f"4,347 frame rows / 475 resources; 2,450 explicit delays (44 distinct values "
     f"[t090 phase-3 D1: count recomputed from the committed census — the original "
     f"prose said 35]); 225 of 329 multi-frame resources default-dependent; portal "
     f"frames delay-less (pv 8, ph 4/7/3; psh/1 delay=1500 with a0/a1; psh/2-3 = "
     f"6/14/6); companion census sha {census[:16]}…; timeline doc sha {timeline[:16]}… "
     f"[host-path note: source_file uses the repo-conventional folder name; the "
     f"on-disk extracted folder carries GBK-mojibake bytes — all t090 scripts "
     f"resolve the directory programmatically (first directory under "
     f".work/task-001/extracted/), so reproduction is name-agnostic]",
     "C-117",
     "research/scripts/t090_wp1b_frame_census.py + t090_wp1b_census_summary.py + "
     "t090_wp1d_timeline_model.py + t090_wp1d_portal_durations.py (sha-pinned inputs)"],
    ["EV-105", ".work/task-063/client-stage/Gr2D_DX8.dll", GR2D_SHA,
     "0x5040B9DE head+accumulator; 0x504027BB; 0x5040283D; 0x5042E500; EXE 36 delay sites; 0x71A203+0x71A72A",
     "instruction+census",
     "accumulator = [vt+0x110] of 0x5042E3F0 (single-occurrence dword); scale coercion default 1000 at the VT_EMPTY/VT_ERROR fast path; per-site seed-idiom scan (imm8 6A 78 / imm32 68 xx / register forms); portal reader fn 0x71A203 (xor ebx,ebx @0x71A21C)",
     f"animationScale default 1000; default matrix 120×18/150×2/60×2/180×3/1000×2/register×9 (portal flat = 0); companion matrix sha {matrix[:16]}…",
     "C-117",
     "research/scripts/t090_wp1c_portal_default_scale.py + t090_wp1c_scale_callers.py + "
     "t090_wp1c_accum_vt.py + t090_wp1b_default_matrix.py + t090_wp1b_reg_seeds.py + "
     "t090_wp1b_annotate_matrix.py"],
    ["EV-106", ".work/task-063/client-stage/Shape2D.dll", SHAPE_SHA,
     "0x51407340;0x514072CF;0x51408C9A;0x5140724A;0x514074C8;0x51406ADC;0x51406CF7;0x5140830E;0x51407A34;0x51408BED;0x514086B3;vtables 0x5140C2F0/0x5140C0FC; EXE call [reg+0xA4]/[reg+0xA8]/[reg+0x9C] censuses",
     "instruction+census",
     "wrapper ctor/layout (fields through at least +0x88); filter commit creates wrapper; getter branch → resolver → inline engine pump; Set delta-store path; +0x9C full body (clamps/rect/pending-list commit); EXE censuses 0/3/8",
     f"filtered-coordinate consumer chain closed (getters return filtered when wrapper "
     f"armed; immediate Sets = deltas); +0x9C = rect-extent member attach; companion "
     f"docs sha filter-consumers {fcm[:16]}… slot9c {s9c[:16]}… [companion slot9c sha "
     f"refreshed phase-3 D5]",
     "C-116;C-118",
     "research/scripts/t090_wp4b_filter_query.py + t090_wp4b_walker.py + "
     "t090_wp4b_engine.py + t090_wp4b_wrapper.py + t090_wp4b_wrapper2.py + "
     "t090_wp4b_getters.py + t090_wp4b_resolver.py + t090_wp4b_aux_store.py + "
     "t090_wp4b_commit.py + t090_wp2a_slot9c.py + t090_wp2a_slot9c_fastpath.py"],
    ["EV-107", ".work/task-036/game-image-unpacked.bin", EXE_SHA,
     "10 anchored caller windows of 0x93CB27; 0x9573A6 + 3 caller windows; 0x990B2E; 25 slot90 residual sites",
     "instruction+census",
     "caller-table refinement (8 zero / 2 object-capable incl. caller-dependent 0x959493); 25-site residual classification: 18 SHARED-WRITE-CONTEXT-POSSIBLE (0x31D resolve in-function, receiver via pointer deref, linkage untraced) + 7 RECEIVER-OTHER-POSSIBLE (no 0x31D in function)",
     f"arg3 table sha {arg3[:16]}…; residual classification sha {res25[:16]}…; "
     f"blind-reviewer adjudications D-A (180×3 bytes confirmed 68 B4 00 00 00), "
     f"D-B (all 18 120-sites are imm8 6A 78), D-C (0x959493 caller-dependent) in "
     f"T090-ADJUDICATION-DADBDC.txt",
     "C-119",
     "research/scripts/t090_wp0a_callers_anchored.py + t090_wp4a_arg3_identity.py + "
     "t090_wp4c_classify25.py + t090_wp4c_verify_receivers.py + t090_wp4c_downgrade.py + "
     "t090_adjudicate_da_db_dc.py"],
]
for e in new_ev:
    row = [""] * len(hdr)
    for k, v in zip(hdr, e):
        if k in eidx:
            row[eidx[k]] = v
    rows.append(row)

with open(EV, "w", encoding="utf-8", newline="") as f:
    csv.writer(f, lineterminator="\n").writerows(rows)
print(f"rebuilt evidence.csv with {len(rows) - 1} rows")
