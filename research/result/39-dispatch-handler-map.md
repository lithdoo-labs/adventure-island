# Task 039 — Dispatch-driven handler map (final report, session 1)

RUN DATE 2026-10-14 · STARTING_HEAD `27a1e4b6deab9df151f93fb94000eae826620795`
· corpus: the Task-036 authorized capture; static analysis only;
nothing binary committed.

## 0. Task 039 complete?

**Stop D (budget)**: the dispatch's band structure is now FULLY mapped
(20 bands), three proven protocol opcodes have landed on named bands,
and the login-band question has a precise verdict (separate phase
object; router = the pump's virtual chain). H4/H5 open.

## 1. The complete band map (H2)

`OnPacket(opcode, packet) @ 0x14112E` — the in-game dispatcher:

| Band | Handler | Singleton |
| --- | --- | --- |
| 0x81-0x83 (**CHARINFO**) | 0x77E6F3 | — |
| 0x84-0x86 | 0x670AF5 | — |
| 0x87-0x9F | jump table @0x141585 (25 slots) | — |
| 0xA2-0xED (**INVENTORY**) | 0x97F64C | [0xBDD4A0] |
| 0xEE-0x103 | 0x6A6AB0 | [0xBDD49C] |
| 0x104-0x10C | 0x6CB061 | [0xBDEB44] |
| 0x10D-0x10F | 0x51B3A3 | [0xBDEA94] |
| 0x110-0x111 | 0x50E6CF | [0xBDEA68] |
| 0x112-0x114 | 0x688CBA | [0xBDEB40] |
| 0x115-0x116 | 0x431648 | [0xBDD45C] |
| 0x117-0x118 | … | [0xBDEB3C] |
| 0x119-0x11B | 0x5CDF60 | [0xBDEB2C] |
| 0x11C-0x11F | 0x741C0B | [0xBDEB38] |
| 0x145 | 0x753092 | [0xBDEB34] |
| 0x146-0x147 / 0x148-0x149 / 0x14B-0x14C | 0x76400C / 0x425053 / 0x7A1424 | — |
| 0x16A-0x16E | 0x662B01 | [0xBDEB30] |
| 0x16F-0x171 (**SKILLS**) | 0x5B9F14 | [0xBDE95C] |
| 0x182-0x185 | 0x548034 | — |
| 0x144 / 0x14A / 0x14D-0x14F / 0x15F | inline | — |
| **< 0x81** | **dropped** (login band lives elsewhere) | — |

## 2. H1 — the login-band verdict

- The field dispatcher provably drops opcodes < 0x81.
- The dispatcher is invoked virtually: a **vtable family at
  0x7015xx-0x702xxx** (10+ entries) shares the OnPacket slot
  (0x14112E) with per-class unique methods — the scene/channel
  handler classes.
- The login-phase dispatcher (0x00-0x0B) is a different object,
  reached through the pump's (0x9583A) virtual handoff — the precise
  next entry (B39-1).

## 3. H3 — protocol-anchored naming

Three 033-burst opcodes landed: **0x81 → CHARINFO band @0x77E6F3,
0xA2 → INVENTORY band @0x97F64C, 0x16F → SKILLS band @0x5B9F14**
(protocol-live + in-image dispatch, two-evidence).

## 4. Strongest finding / uncertainty / blocker

- **Strongest finding**: the complete 20-band dispatch map — handler
  decoding is now table-driven for the entire in-game opcode space.
- **Strongest uncertainty**: the login router and the bands' internal
  opcode tables.
- **Blocker**: budget only (B39-1/2).

## 5. Next direction (session 2)

(a) pump 0x9583A full decode → the OnPacket virtual handoff → the
login-phase dispatcher; (b) band-internal tables (0x97F64C inventory
first); (c) H4 builders (0x95CC2); (d) H5 CSecurity.

## 6. Artifacts

`result/task039-milestones.csv`, `task039-blockers.csv`,
`task039-progression-timeline.csv`, this report; logs in
`.work/task-039/logs/` and `.work/task-038/logs/g3-*`.
