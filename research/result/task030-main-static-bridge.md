# Task 030 — Static bridge update (provenance boundary)

Extends `result/task029-main-static-bridge.md`. Canonical sample
`5d280cf1…`; all RVAs `MapleStory.exe`.

## New facts (all confirmed-replay)

| Fact | Evidence |
| --- | --- |
| A **second bytecode VM instance** drives the pre-corridor phase (module loads, GetLocalTime, probes, cmdline, versionex, registry): handler table RVA 0x81464, context RVA 0x821464-0x821494, same encrypted-frame convention as the corridor VM (table RVA 0x84B1E0) | GLT consumer window trace; dispatch `xor bl,al; movzx; jmp [edi+eax*4]` with edi=0xC21464 |
| GetLocalTime's **wSecond (+12) and wMilliseconds (+14)** are consumed by VM2 (n=13,285,873 / 13,304,345) and terminate in VM2's context — **zero flow into the corridor read set** | watch-list provenance (`api_watch`/`watch_hits`) |
| The corridor's pre-staged inputs reduce to 27 non-bytecode cells: decode-era cells (n<25K, effectively static), the resolved winmm!timeGetTime pointer (n=18,865,220, RVA 0x81A5AD), one VM context byte (RVA 0x84B218=0), the user32!MessageBoxExA slot (RVA 0x81A6BD) | `--write-log` census over the corridor read set |
| The pre-corridor resolution pass (n≈12.7-13.7M) performs APIT-CRC name hashing with **5 successful matches** (incl. RegOpenKeyA) — the staging resolution channel is faithful | trace-from 12.67M, je 0xC1D186 taken ×5 |
| **The corridor is timing-invariant**: identical control flow (26 heads, 13/26 checks, same continuation) across clock scales 22.7→1135 (walk deltas 1→78 ms) | 6-run checkpoint sweep |
| Therefore the error continuation is a pure function of the runtime-decoded program state; the only unvalidated input channel is the decoded image itself | elimination table in `task030-terminal-predicate.md` |

## Zone additions

- RVA 0x81464/0x821464-0x821494: VM2 handler table + context (pre-corridor).
- RVA 0x81A5AD: resolved timeGetTime pointer cell (SEH-window write).
- RVA 0x84B218: VM1 context byte `[edi+0x38]` (opcode 0x36 source), value 0.

## Tooling changes (regression-clean)

`scripts/maple079_full_replay.py`: API output watch-list
(`api_watch`/`watch_hits`), filtered whole-run write logger
(`--write-log`), and a checkpoint clock-scale override fix (resume
previously restored the saved scale, silently ignoring the CLI value —
the Task 030 sweep exposed it; full-run experiments were unaffected).
Default-configuration signature unchanged.

## Boundary status

Tail A 0 writes; ZtlTaskMem zero; no import rebuild / ijl15 / ws2_32.
The replay divergence is now **proven to be independent of every
controllable input** (timing falsified three ways + 5000× sweep; all
API/provenance channels accounted). Remaining channel: runtime-decoded
image ground truth (prohibited live extraction) — B30-1, Stop C form.
