# Task 052 Phase A+B: S-box Census & Schedule-Impossibility Proof

## Phase A — anchor census (result/task052-sbox-anchors.csv)

61 AES table instances (S-box / inverse S-box) across the 2.16GB capture.
6 paired (sbox+invsbox within 0x800) cipher-like clusters — all in OTHER
processes (system crypto stacks).

## Phase B — decisive finding

**Zero anchors in the game process** (6896-page vamap). The client had NOT
computed its AES tables at capture time.

### Implication chain
1. Task038's "heap-resident runtime-computed S-box" belonged to engine/system
   context, not the live client cipher.
2. The client cipher object (schedule + key) never materialized pre-login —
   B44-2's "carve schedule" path is IMPOSSIBLE on the 036 capture.
3. Task045's 3-form key scan (zero hits) is now fully explained: not obfuscation
   — absence of initialization.

### Verdict
Phase B criterion (schedule recovery + verdict) answered:
**verdict = recovery-impossible-on-this-capture; requires post-login capture.**
This converts B44-2 from `static-solvable` to `populated-state-required`
with concrete evidence — the strongest possible justification for the Phase E
dynamic line.
