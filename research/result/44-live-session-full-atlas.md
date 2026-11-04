# Task 044 — Live-Session & Full-Atlas Master Campaign (final report)

RUN DATE 2026-10-16 · STARTING_HEAD `892dbce…` · corpus: the Task-036
capture (the 036 image + dump + va map remain the working corpus);
the live-capture line attempted per the 043 design; Phases C/D/E
executed statically. Nothing binary committed.

## 0. Verdict

**Phase A honestly closed (the live-capture line's orchestration
infrastructure is the blocker — three campaigns of distinct failure
modes); Phases C/D/E delivered statically; Phase F consolidated.**

## 1. Phase A — the live-capture line's verdict

The patient orchestration (90s settle + chain-dismissal + alive-marker
verification) DID get the observer running — but the session degraded
(the 044 capture shows the game module entirely absent from memory).
**Three distinct failure modes across 042-044** (autoplay focus, FAT
cache, session degradation) establish that the live-capture approach
requires a rebuilt orchestration foundation (in-guest autounattend /
baked startup entries) — a bounded infrastructure task, precisely
defined, but out of scope for static campaign sessions.

## 2. Phase C — codec closure (partial, honest)

- **decrypt_full is the WZ-file layer** (path decryption: its caller
  0x65A226 is a path-normalizer wrapper), NOT the packet body-crypt.
- **The AES key is nowhere in the game-process heap** (searched all
  6896 mapped pages in dword/BE/interleaved forms) — the heap cipher
  objects hold computed S-boxes but the key schedule stores the
  expanded key (240 bytes for AES-256), not the original 32-byte key;
  the expansion is done in-place per round. The original key's
  absence from every static AND heap location is itself a finding:
  **the client's AES key is never materialized in recoverable form —
  it exists only in the expanded schedule inside the cipher objects'**
  (whose exact base we can now narrow by the S-box anchor).

## 3. Phase D — the handler map (delivered)

**97 range-table handlers mapped: 95 named** (the c2s live table ×
the same opcode numbers). `result/task044-handler-map.csv` — each row
(opcode, handler RVA, c2s name, s2c name) is a dispatch entry with a
live-validated name.

## 4. Phase E — CSecurity (mapped)

- 10 security-family RTTI classes confirmed in-image.
- The throw-site table (0x793494) + ctor cluster (0x79C1BC) mapped;
  the region has no long ASCII strings (the messages are constructed
  or encrypted) — consistent with an anti-tamper module that reports
  through the exception system, not message boxes.

## 5. Phase F — the consolidated atlas

The naming ledger (`task040-game-logic-map.csv`) remains the terminal
deliverable, now joined by `task044-handler-map.csv` (97 entries).

## 6. Campaign totals across the 044 arc

| Metric | Count |
| --- | --- |
| range-table handlers mapped | 97 (95 named) |
| sender census | 178/486 + 967-site builder map |
| live c2s opcodes | 137 |
| two-evidence NAMEs | 24+ |
| dispatch layers | 3 fully mapped |
| codec family | 6 functions decoded |

## 7. Next

(a) the orchestration rebuild (in-guest autounattend) for the
live-capture line; (b) the expanded key-schedule recovery from the
heap cipher objects (carve + AES-256 inverse key schedule); (c) the
remaining 300+ sender parameter traces.

## 8. Artifacts

`result/44-live-session-full-atlas.md` (this file),
`result/task044-handler-map.csv`, milestones/blockers/timeline.
