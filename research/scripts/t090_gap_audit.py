"""T090: generate the T090 gap-closure audit CSV (start/end statuses, new
evidence, still-unmet conditions) from the current authoritative ledgers."""
import csv
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
OUT = REPO / "research/result/stage-readiness/T090-GAP-CLOSURE-AUDIT.csv"

ROWS = [
    ["gap_id", "start_status", "proven_this_round", "still_unmet", "end_status",
     "status_change_reason", "reviewer_opinion"],
    ["G10", "PARTIAL-STATIC",
     "C-116/EV-106: filter CONSUMER CHAIN closed — the filter commit (0x51408C9A) creates the animation wrapper at [v+0x24] (ctor 0x51407340), the X/Y getters (+0x20/+0x28) route through the resolver 0x51406ADC which pumps the engine 0x51406CF7 inline and returns the FILTERED coordinate (w+0x70/+0x74) whenever the wrapper is armed, immediate Sets become delta stores (0x51407A34), and slot15/world→screen consume via the getters (consume edge 0x48AEC3→0x404B07/0x404B2E→[vt+0x20/+0x28] byte-verified); EXE +0xA4 query census = 0; C-119: caller table refined (8 arg3=0 incl. the 0x990E21/91 esi=0 correction; 0x959493 caller-dependent; 0x98DC43 shares the [0xBDD460] context with the filter arming); 25 residual slot90 sites classified 18 SHARED-WRITE-CONTEXT-POSSIBLE + 7 RECEIVER-OTHER-POSSIBLE with per-site static reasons",
     "[[arg3]+0x14] member-writer census (geometric point identity); arg3↔[user+0xF28] relationship (F28 direct-write census: one ctor-zero writer only); E2/E3 pump interleaving; wrapper persistence across scene transitions; receiver linkage for the 18 POSSIBLE sites; slot15 derived-table install chain (t088.1 bounded negative retained)",
     "PARTIAL-STATIC",
     "consumer-linkage residual RESOLVED structurally (C-116); object-identity and phase residuals remain — not closable without them",
     "pending phase-2/3"],
    ["G36", "PARTIAL-STATIC",
     "C-118/EV-106: +0x9C (0x514086B3) fully decoded = rect-extent member attach (ret 0x34, 0xFFFFFF clamps, VARIANT gate, fast-path rect math, pending-list commit via 0x5140833B, member [vt+8] invoke; 8 EXE sites); attach-baseline mechanism documented (snapshot of the [0xBE2788] origin position at registration); 387-record 13-map layout table from the ORIGINAL WZ (C-051 spans + C-111 ratios, viewport 800x600)",
     "first-frame ABSOLUTE screen offsets (attach baseline is a runtime snapshot; load-order interleaving E2/E3 — statically unprovable in principle, same boundary as OpenMS GMS083); per-tile draw bodies (runtime)",
     "PARTIAL-STATIC",
     "all statically decodable residuals closed (+0x9C, baseline mechanism, layout data); absolute baseline is a principled static boundary",
     "pending phase-2/3"],
    ["G37", "PARTIAL-STATIC",
     "EV-104: obj-layer frame census merged into the G39 resource closure (3,540 obj frames, 2,114 explicit delay; tiler 0x66ABCD 120-default covers flow-child per-frame defaults); shared engine confirmed — no separate Obj timing logic",
     "per-frame DRAW bodies of flow instances (runtime-bound)",
     "PARTIAL-STATIC",
     "narrowed via the shared proven engine + resource census; draw bodies unchanged",
     "pending phase-2/3"],
    ["G39", "PARTIAL-STATIC",
     "C-117/EV-104/EV-105: original Map.wz census (4,347 frames / 475 resources; 2,450 explicit delays, 44 distinct values 100..4000; 225/329 multi-frame resources default-dependent; portal frames delay-less pv=8/ph 4-7-3/psh-1 delay=1500+a0/a1); animationScale default = 1000 (accumulator 0x5040B9DE = [vt+0x110]@0x5042E3F0; 0x504027BB fast path 0x5040283D stores 0x3E8); COMPLETE 36-site default matrix (120x18 all imm8 6A 78, 150x2, 60x2, 180x3 bytes-confirmed, 1000x2, registerx9); portal flat-record delay default = 0 (0x71A203 xor ebx,ebx); numeric timeline model (32-bit semantics, repeat triage, truncation)",
     "per-frame consumer default for the PORTAL family (the flat 0x71A72A read defaults 0 but is a different dataflow; the portal loaders register via 0x43E3A6→slot25 and call neither 0x43EC69 nor 0x427DE0 — the per-frame portal read is not located in the static image); 8 register-seeded defaults remain variable; 960/480/840/360 ms figures stay default-based estimates",
     "PARTIAL-STATIC",
     "three of four T089 residuals CLOSED by original evidence; the portal per-frame default is not statically locatable this round — closure would be by approximation, refused",
     "pending phase-2/3"],
    ["G35", "CLOSED-STATIC", "(not targeted — closure complete in T089; re-verified unchanged)", "(none static)", "CLOSED-STATIC", "no reopening without new counter-evidence", "pending phase-2/3"],
    ["G40", "PARTIAL-STATIC", "(not targeted per dispatch policy; WP0-C audit-status reconciliation only)", "T3/T6 slot4 bodies; 0x9BD757 family sequencing; M+0x198 installer", "PARTIAL-STATIC", "unchanged", "pending phase-2/3"],
    ["G20", "OPEN-STATIC", "(not targeted)", "stance-switch writers", "OPEN-STATIC", "unchanged", "pending phase-2/3"],
    ["G16", "OPEN-STATIC", "(not targeted)", "window handler bodies", "OPEN-STATIC", "unchanged", "pending phase-2/3"],
]

with open(OUT, "w", encoding="utf-8", newline="") as f:
    csv.writer(f, lineterminator="\n").writerows(ROWS)
print(f"{len(ROWS) - 1} audit rows -> {OUT}")
