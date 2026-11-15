# T088.1 — Scene slot15-family vtable install coverage statement (STATIC-ONLY)

Round: T088.1 (2026-11-16). Binary: `game-image-unpacked.bin`
sha256 `d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718`
(linear, VA = file offset + 0x400000). Generator:
`research/scripts/t088_wp4_scene_portal.py` (t088.1 rebuilt scanner).
Companion forensics: `T088-CAMERA-BOUNDS-SCENE-PORTAL.md` §2/§2b/§2c/§2d.

This document is the auditable coverage statement required by the T088.1
acceptance questions for the slot15-family install negative: what was
scanned, how hits are proven, what the negative does NOT cover, and where a
reproduction is incomplete.

## 1. The T088 defect being corrected

The T088 release scanned for family-vtable installs inside the +0x1CC writer
functions with:

```python
for m in re.finditer(rb".\xb0\x00\x00", blob):
    val = struct.unpack("<I", blob[m.start():m.start() + 4])[0]
    if fam_starts[0] <= val <= fam_starts[-1] + 0x300: ...
```

Two structural faults: (a) the pattern requires byte2 == 0xB0 and
byte3 == byte4 == 0x00 of the 4-byte window, but the little-endian encoding of
every family address 0x00B012xx..0x00B026xx begins `xx 1x B0 00` — byte2 of
the pattern is matched against the address's SECOND byte (0x12..0x26), so no
family address can ever match; (b) even on a hypothetical match the unpack
reads from `m.start()` which includes the wildcard byte, decoding
`(any, 0xB0, 0x00, 0x00)` = a 0x0000B0xx value that fails the range test.
Consequently every `family-vtable-installs=[]` line in the T088 forensics was
emitted by a scanner that **could not fire**; the T088 nine-writer negative
was asserted, not executed. The same release's `seh_start` heuristic also
failed to bound writer 0x60088A (`fn None`).

Additionally the T088 +0x1CC reference probe compared capstone **VAs** against
raw **file offsets** (`ins.address + len(ins.bytes) > off2 + 2`, always true
after +0x400000) and matched the substring `"0x1cc"` in any operand text —
so overlapping bogus decodes could swallow real instructions. This is how the
tenth direct writer, `mov dword ptr [ebx+0x1CC], eax` at **0x952ECE** (a
+0x1C8..+0x1DC pair-copy loop), was dropped, producing the committed "30
mov/lea, 9 writers" figures.

## 2. The corrected scanner

1. **Family table set** — 33 starts re-derived from data: `start = a - 0x3C`
   for every `a` in 0xB01278..0xB02730 (step 4) where the dword equals
   0x53471A (slot15 member). Range: 0xB01278..0xB026A0.
2. **imm32 census** — for each of the 33 addresses T, every byte occurrence
   of `pack("<I", T)` in the code band [0x401000, 0xBEA000) is decoded at
   every candidate instruction start (p-8 .. p-1); an occurrence counts only
   when some decode yields an instruction whose IMMEDIATE operand equals T
   (capstone operand type IMM). Classified: INSTALL (`mov dword ptr [mem],
   imm`, C7 /0), LOAD (`mov reg, imm`), PUSH (`push imm`), OTHER-IMM;
   occurrences with no instruction-boundary decode are DATA, not code.
3. **Positive control** — the generator ABORTS unless the base table
   0xB01278 yields exactly the four known imm32 installs
   {0x52F1BC, 0x52F1CF, 0xA0B39E, 0xA0BB2A}. This is the acceptance
   "known-positive" test the T088 scanner could not pass (it found none).
4. **+0x1CC census** — every occurrence of `cc 01 00 00` is decoded at every
   candidate start; an instruction counts only with a MEM operand whose
   displacement is exactly 0x1CC (no substring matching). Partition:
   `lea` (address-taken), `mov dword ptr [..] <- reg` (direct writers),
   `mov reg <- dword ptr [..]` (reads).
5. **Writer bounding** — containing function per writer via the t046 census
   (E8 targets + standard prologues; the same method as t088_wp1), plus an
   SEH-ctor anchor scan and a nearest-preceding-prologue scan as alternative
   candidate starts. Scan window = [earliest candidate start, next census
   start). The 2d listing prints all three candidates and the chosen
   (earliest) start for each writer.

## 3. Results (machine-derived, reproducible)

* 49 distinct instructions with a MEM disp32 +0x1CC operand:
  21 `lea`, **10 direct writers**, 17 reads, 1 other.
* mov/lea excluding reads (the T088 taxonomy): **31** — the T088 report's
  "31" was numerically right; its forensics' "30" missed 0x952ECE.
* Direct writers: 0x60088A, 0x67B139, 0x6D429C, 0x703819, 0x71FAA1,
  0x79293F, 0x793570, 0x7C939A, **0x952ECE (new)**, 0xA029BA.
* Family imm32 census: base table 0xB01278 only — 4 INSTALLs (positive
  control PASS), 2 LOADs (0x52EEF1, 0x8DC052 — register-mediated installs
  onto stack objects `[ebp-0x3C]` followed by `call 0x52F37F`), 1 DATA
  occurrence (0xBE62E4, no instruction boundary). The other **32 derived
  tables have ZERO byte occurrences** in the band — no imm32 install of a
  derived table exists anywhere in the scanned image.
* Per-writer verdicts: **10/10 CENSUS-FN-BOUNDED-NEGATIVE** and
  BOUNDARY-ROBUST. Conservative windows take the EARLIEST of three candidate
  starts (census start / SEH-ctor anchor `mov eax,imm; call 0xA6FC7C` /
  nearest preceding standard prologue), so a false-late census start cannot
  hide an install in a true function prefix. Because the imm32 census is
  exhaustive over the whole code band, the negative does not depend on any
  single boundary: the complete family imm32 site set is
  {0x52EEF1, 0x52F1BC, 0x52F1CF, 0x8DC052, 0xA0B39E, 0xA0BB2A} (+ data
  0xBE62E4), and the closest pair (writer 0xA029BA's window end 0xA02B82 vs
  install 0xA0B39E) is separated by a hard barrier — 8 further genuine
  prologues (first 0xA03F2D), 430 in-window E8 call targets, and the
  install's own containing function lie between them (t088.1-reviewer
  phase-2 fact, lead-verified) — so NO single function can span the gap.
* t088.1-reviewer blind-phase boundary findings adopted: 0x79240D (census
  start for 0x79293F) and 0x7C8BEB (for 0x7C939A) are mid-instruction false
  starts (the reviewer's true earlier starts are 0x791FE9/0x7C8E9F);
  0x60088A's census start 0x6006AD decodes mid-instruction (internal label,
  single caller 0x5FE6C0, no ret between) — that writer's conservative
  window falls back to the nearest preceding prologue (0x5FD9B1). The
  0x4000-back SEH scan anchors (e.g. 0x78FA4C for 0x79293F) may sit in the
  ADJACENT function; earliest-start conservatism accepts that (it only
  widens the scanned region — safe for a negative claim). The T088 "fn None"
  for 0x60088A was a heuristic-scan artifact, not evidence of an unbounded
  function.
* Init chain: 0x52F1BC installs then **tail-jmps** 0x52F37F; 0x52F1CF and
  0xA0BB2A install then `call 0x52F37F`; 0xA0B39E installs the base table
  then a sibling embedded table 0xB0D3D4 (init beyond the +0x28 dump).

## 4. What the negative does NOT cover (audit boundary)

* **Census extent** — mitigated by the earliest-start conservative window
  and the hard-barrier corroboration (§3): between the closest writer/install
  pair lie 8 further prologues, 430 in-window E8 call targets and the
  install's own containing function, so boundary error cannot resurrect an
  install inside a writer's function.
* **Indirect installs** — register-mediated stores (`mov [mem], reg` where
  reg was loaded from the table array), loads from data structures, or
  runtime-computed addresses install without any imm32; the 0x52EEF1/0x8DC052
  pattern proves this path exists for the BASE table.
* **Callee/SEH/thunk installs** — installs performed by called constructor
  helpers, SEH dispatch, or tail-call thunks outside the writer windows are
  not excluded (0x52F1BC itself is a thunk).
* **[scene+0x1CC] object identity** — the ten writers write same-offset
  fields of DIFFERENT classes (0x60088A: callee-returned object; 0x952ECE:
  pair-copy loop [esi]->[ebx]; others: this/parameter objects). No writer is
  proven to write THE slot15 scene member; the member's class identity and
  installer remain UNLOCATED.

## 5. Formal statement

> BOUNDED NEGATIVE (boundary-robust): within each of the ten direct +0x1CC
> writers' containing functions in the SHA-pinned image — under every
> candidate boundary (census / SEH anchor / preceding prologue, earliest
> taken) — there is no instruction storing any of the 33 slot15-family
> vtable addresses as an immediate; the exhaustive whole-band census plus
> the prologue/call-target barrier between the closest writer/install pair
> closes the boundary question. The base
> table's own install chain IS statically located (4 imm32 installs + 2
> register-mediated installs + shared init 0x52F37F); the 32 derived tables'
> construction/install chain is untraced (STATIC-UNDERDETERMINED) and is the
> T089-WP3 entry point.

## 6. Reproduction

```
python research/scripts/t088_wp4_scene_portal.py   # aborts if positive control fails
python -m unittest research.tests.test_t0881_round -v   # positive-control regression
```
