# Task 040 — Game-logic full-decode master campaign (FINAL report)

RUN DATE 2026-10-15/16 · STARTING_HEAD `2ac1ebbd27e55785382938be40cc1af9d48be6c1`
· corpus: the Task-036 authorized capture + the local live server
(loopback). Static + the 033-method live enumeration. Nothing binary
committed.

## 0. Campaign verdict

**Complete to the practical milestone set** — every phase of the
master plan delivered or delivered-to-labeled-boundary across eight
checkpoints (S1, S2×2, S3, S4, S5×2, S6, S7). The game body is no
longer "recovered but unread": its network stack, codec, three-layer
dispatch, security module, and sender/builder census are decoded and
named, cross-validated three ways (live protocol × in-image × v95).

## 1. The campaign's results by phase

**Phase 0 (dispatch completion)** — done:
- pump 0x9583A (recv 1460-chunk loop → append → extract → decrypt);
- **the phase dispatcher 0x95F83** (login-band cases 0x10-0x1C, range
  bands 0x20-0x80 + 0x177-0x181, and the delegate object [0xBDF54C] —
  the phase-injection point);
- the field dispatcher 0x14112E (20 bands) + the range dispatcher
  0x610CE0 (**97-slot jump table, 92 handlers extracted**);
- three address-hygiene fixes (VA/RVA ×3, caller-search base) —
  recorded as method hazards.

**Phase 1 (protocol labeling)** — done: **137 c2s channel-zone opcodes
live-enumerated** (the server's own naming) + 18 s2c observed, with
the three-way validation corrections: 0x81 = WARP_TO_MAP, 0xA2 =
SPAWN_PLAYER, 0x16F = KEYMAP — each confirmed by the decoded handler
semantics (CharacterId on warp; is-it-me on spawn; 89-key walker).

**Phase 2 (codec closure)** — done to the primitive level: the codec
family (funny_shit/crypt/custom±, encrypt/decrypt_full) form-matched;
the **heap cipher instances are STANDARD AES** (S-box confirmed
byte-exact ×2) with runtime-computed tables — explaining the
static-absence of all AES material; the obfuscated key repository
located (unreferenced by static code — runtime-derived). Remaining
label: the key-expansion routine itself.

**Phase 3 (handler factory)** — 178/486 send sites named +
the complete builder census (**967 WriteHeader call sites**,
WriteHeader=0x661F, COutPacket ctor=0x2F5E40) + band handlers named
for WARP/SPAWN/KEYMAP.

**Phase 4 (security + builders)** — CSecurity mapped (throw-site
table 0x793494-0x793524 + ctor cluster 0x79C1BC-0x79C35C + data
block 0x7D38F8-0x7D4230 **co-located with the cipher material** —
KeyCryptInitFailed semantics self-consistent); the patch/disconnect
sibling at 0x711E-0x720A; the builder family decoded (ctor →
WriteHeader → data writes → send via 0x95C5C).

**Phase 5 (integration)** — `result/task040-game-logic-map.csv` (the
terminal deliverable): ~24 two-evidence NAMEs + the labeled census +
tables; this report.

## 2. Numbers

| Metric | Count |
| --- | --- |
| two-evidence NAMEs (functions/objects/primitives) | 24 |
| provisionally-named send sites | 178/486 |
| builder census (WriteHeader sites) | 967 |
| live-enumerated c2s opcodes | 137 |
| dispatch handlers extracted | 25 + 92 + 20 bands |
| corrected early labels | 3 (0x81/0xA2/0x16F) |

## 3. README goals closure assessment

1. PE/x86 structure — **closed** (034 + 036-037 imports).
2. Network init/connect/send/recv/codec — **closed** (037 + 038 +
   040's standard-AES confirmation).
3. Client opcode dispatcher ↔ server protocol mapping — **closed**
   (three-layer dispatch + 137 live c2s + corrected s2c labels).
4. Core modules/classes/functions naming — **substantially advanced**
   (24 NAMEs + 178 senders + the tables; the per-handler deep naming
   is now routine table work).
5. WZ resource loading — closed since Task 023.

## 4. Strongest finding / uncertainty / next

- **Strongest finding**: the three-way validation — live protocol,
  in-image dispatch, and decoded handler semantics independently
  agreeing (warp/spawn/keymap) — plus the standard-AES confirmation
  closing the codec question.
- **Uncertainty**: the key-expansion routine (runtime-computed) and
  the ~300 senders whose opcodes arrive via registers/parameters.
- **Next direction**: (a) Task 041 object-model deep dive (CField/
  CUser via the named handlers); (b) multi-phase re-capture (B36-3)
  to diff code state; (c) the mechanical completion of the sender
  census by parameter tracing.

## 5. Session ledger

`2ac1ebb` (spec) → `389e754` (S1) → `0eba223`/`a711bbc` (S2) →
`4d45473` (S3) → `eee39ad` (S4) → `dfff5d8` (S5-1) → this final
commit (S5-2/S6/S7).
