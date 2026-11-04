# Task 040 — Session 4 checkpoint (AES material + IV-roll correction + naming ledger)

RUN DATE 2026-10-15 · corpus: the Task-036 capture.

## Delivered (S4)

### 1. AES material located

- **The obfuscated key repository** sits before the table-1 copy
  (RVA 0x7A0630-0x60): the dword array
  `06 02 43 0F B4 4B 35 05 1B 0A 5F 09 0F 50 0C 1B 33 55 01 09 52 DE
  C7 1E` — **identical to the ZLZ/Canvas/PCOM repository** (Task 034).
  The client's cipher key shares the Wizet key infrastructure with the
  engine's WZ layer and expands at runtime into the heap cipher
  objects (the two compact-AES Sbox2 instances at 0x74F12C00 /
  0x756D2000). The byte-level derivation routine (key-expansion code
  beside the cipher ctor) is the remaining piece for a full
  equivalence proof (recorded as the S4 continuation).

### 2. IV-roll correction (important)

The pump's `crypt(ptr, 4, NULL)` @0x95F0D is the **4-byte header-IV
ROLL**, not the body decrypt — `0x659082` with a NULL IV pointer
computes the next IV from the default seed. The body crypt (the
chunked AES+shuffle) lives in the body-processing path (the extract
chain), still to be decoded.

### 3. The naming ledger (F3/F6 deliverable, current state)

`result/task040-game-logic-map.csv` — every named function/object/
table with its evidence class (NAME = two+ independent evidences;
LABEL = provisional). Current counts: **~22 NAMEs** (socket family,
codec family, dispatchers ×3, band handlers WARP/SPAWN/KEYMAP, reader
primitives, CWvsContext singleton) + 137 live-enumerated c2s opcodes
+ the corrected s2c labels.

## Campaign state

| Session | Status |
| --- | --- |
| S1 pump+mechanism / S2 three-layer dispatch+corrections / S3 band tables+live enumeration | ✅ |
| S4 AES material + IV-roll + ledger | ✅ (derivation routine = continuation) |
| S5-S7 handler factory (100+ names), CSecurity, final integration | remaining |

## Next

(a) body-crypt + key-derivation decode (completes the codec closure);
(b) S5: the c2s table (137 names!) × builder family — batch sender
naming; (c) CSecurity; (d) final documents.
