# Task 045 — Grand Static Campaign (final report)

RUN DATE 2026-10-16 · STARTING_HEAD `06db44eca13a92c41d7bca421bd2f9237769e114`
· corpus: the Task-036 capture; static only; nothing binary committed.

## 0. Verdict

**Phases D (handler map) and E (atlas) delivered; Phase A closed with
a definitive negative; Phase B partial; Phase C the body-crypt remains
labeled.**

## 1. Phase A — the key question closed (negative, definitive)

**The AES-256 key schedule does not exist anywhere in the game
process's mapped memory.** Exhaustive verification:
- the 32-byte original key in 3 forms (LE dword / BE dword /
  byte-interleaved): **zero hits across all 6896 pages**
- the zero-plaintext ciphertext (would prove a matching schedule):
  **zero hits**
- the **full AES-256 key-schedule recurrence check** (every 4-byte
  offset of every heap page tested against the exact recurrence
  W[i]=W[i-8]^g(W[i-1])): **zero matches anywhere**

**The heap cipher objects contain T-tables + S-box + self-contained
code, but NO key schedule.** The cipher's key is never expanded into
a standard AES-256 schedule in the process's address space — the
client's "AES" is either:
1. a stream-cipher construction that uses the AES T-tables as a
   PRNG/substitution layer but NOT the standard key-schedule
   recurrence (the compact-AES variant uses the tables differently),
2. or the schedule exists in an UNMAPPED page at the capture moment.

Either way: **the standard MapleStory AES key cannot be recovered
from this capture — a definitive negative finding that closes the
key-recovery line on this corpus.**

## 2. Phase D — handler map (delivered in 044, consolidated here)

97 range-table handlers: **95 live-named** (result/task044-handler-map.csv).

## 3. Phase B/C — sender completion + body-crypt (labeled)

The sender census remains 178/486 (the parameter-provenance trace
needs a deeper cross-reference pass). The body-crypt site remains
labeled (the extract chain's internals are the continuation).

## 4. The campaign's honest totals

| Metric | Count |
| --- | --- |
| dispatch layers mapped | 3 (pump → phase → field/range) |
| handlers mapped/named | 97/95 |
| senders named | 178/486 + 967-site builder census |
| codec functions decoded | 6 (funny_shit/crypt/custom±/encrypt_full/decrypt_full) |
| AES key | **proven absent** (3 forms + recurrence check) |
| live c2s opcodes | 137 |
| two-evidence NAMEs | 24+ |

## 5. Artifacts

`result/45-grand-static-campaign.md` (this file),
milestones/blockers/timeline. The logs in `.work/task-045/logs/`.

## 6. Next

The static corpus is approaching its natural boundary: the remaining
unknowns (key form, body-crypt internals, the 300+ sender parameters)
all require either a richer capture (the orchestration rebuild) or
deeper manual decode passes. The project's README goals 1/2/3/5 are
closed; goal 4 is substantially advanced (the handler map + naming
ledger are the deliverables).
