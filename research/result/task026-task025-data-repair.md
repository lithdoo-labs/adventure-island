# Task 026 — Task 025 launch-matrix data repair (Phase 0 housekeeping)

Date: 2026-10-13. STARTING_HEAD `f8241f5c38bca54f0a07b3e39b05738bdbf5b594`.

## Scope

`result/task025-launch-matrix.csv` had a known schema/data ordering defect.
This repair was verified entirely against preserved raw evidence in
`.work/task-025/runs/<RUNID>/` (proc.csv, t0.txt, pca.txt, launch.txt,
bat-info.txt). No values were invented. Time spent: ~25 minutes.

## Defect 1 — metric columns written grouped, header declared interleaved

The header declares, per target time t ∈ {10, 30, 60, 120}:

```text
cpu_s_at_t, ws_kb_at_t, threads_at_t   (interleaved by time)
```

but all nine data rows were written **grouped by metric**:

```text
cpu@10, cpu@30, cpu@60, cpu@120, ws@10, ws@30, ws@60, ws@120,
threads@10, threads@30, threads@60, threads@120
```

Proof (A1E, client G:, spin): committed cells read
`6.755, 26.505, 56.597, 114.38, 4944, 4944, 4944, 4944, 25, 25, 25, 25` —
four distinct CPU values followed by constant WS/thread values. Raw
`proc.csv` samples show WS = 4944 KB and threads = 25 for the whole window
while CPU grows linearly — i.e. the first four numbers are CPU@10/30/60/120,
not (cpu,ws,threads)@10. The same grouped pattern holds in all 9 rows.

### Verified selection rule

The original aggregation used the **proc.csv sample nearest in wall time to
t0+target** (tie → earlier). Confirmed on independent anchors:

- A1E @120 → sample at rel=118.5 s, cpu=114.38 (not the 121.7 s sample 117.562);
- A1R1 @10 → sample at rel=10.6 s, cpu=8.237 (not the 7.9 s sample 5.569);
- A1P @10 → sample at rel=10.3 s, cpu=5.46 (not the 4.1 s sample 0.406).

Repair reproduces every metric cell with this rule **bit-identically** for
all 9 runs, then writes them in the interleaved order the header declares.
No numeric value changed; only column order.

## Defect 2 — A3R1 working_directory corrupt

Committed value `Ma\ (client root)` is a corrupted cell. Evidence:

- `.work/task-025/runs/A3R1/launch.txt`: `LAUNCH ... mode=A3 game=F:`
- observer A3 path: `Start-Process cmd /c <bat> -WorkingDirectory $Game`
  with `$Game = 'F:'`;
- game cmdline is the relative form `MapleStory.exe  127.0.0.1 9555`
  (t0.txt / procs.csv), so the game process inherited cmd's working
  directory `F:\`.

Repaired to: `F:\ (client root; cmd/bat inherited)`.

## Runs re-verified against raw evidence (all 9)

| run | client | outcome | t0 (t0.txt) | cpu@10/30/60/120 (re-derived) | ws / threads | match |
| --- | --- | --- | --- | --- | --- | --- |
| A1E | G: | spin | 01:54:40.261 | 6.755 / 26.505 / 56.597 / 114.38 | 4944 / 25 | exact |
| A1P | G: | spin | 01:53:56.659 | 5.46 / 22.948 / 48.61 / 92.197 | 4876 / 25 | exact |
| A1P2 | G: | spin | 01:54:37.515 | 4.43 / 24.43 / 50.576 / 77.844 | 5096 / 25 | exact |
| A1R1 | G: | spin | 01:59:45.116 | 8.237 / 28.018 / 55.412 / 73.866 | 4936 / 25 | exact |
| A1R2 | F: | iloveaki gate | 01:53:15.100 | 2.605 constant | 7224 / 25 | exact |
| A1R3 | G: | spin | 01:54:32.274 | 7.379 / 25.272 / 50.529 / 96.097 | 4944 / 25 | exact |
| A2E | F: | iloveaki gate | 01:54:41.868 | 2.839 constant | 7248 / 25 | exact |
| A2R1 | F: | iloveaki gate | 01:53:16.614 | 2.652 constant | 7248 / 25 | exact |
| A3R1 | F: | iloveaki gate | 01:53:14.788 | 2.683 / 2.683 / 2.699 / 2.699 | 7224 / 25 | exact |

Requirement "at least one G spin run and one F iloveaki run verified against
raw evidence" is exceeded: all 9 runs verified. pid/parent_pid/t0/cmdline
were also cross-checked against `t0.txt` (no discrepancies beyond the two
defects above).

## Result

`result/task025-launch-matrix.csv` rewritten (LF, no BOM) with:

1. metric cells re-interleaved per the declared header (values unchanged);
2. A3R1 working_directory fixed.

Repair script (scratch, not committed): 
`.work/task-026/task025-repair/repair_matrix.py`; verification: 
`verify_matrix.py`, `inspect_samples.py`.

No other Task 025 artifact was modified; the Task 025 report's historical
observations stand as written.
