# Task 051 — Static Deep-Water Semantic Completion

## 0. Mission

Task 050 concluded at Stop B: the practical static boundary for *broad* recovery.
This task drives the *deep* static work that Stop B explicitly listed as
`static-solvable`, to conclusion or to a proven deeper boundary:

1. **Equip stat-slot decode** — walk the type-1 (0xF9) item object's decoder
   (CItem vtable+0x70 equip override) and map the equip stat layout.
2. **Guild container layout** — decode the 0x4F3CFC guild deserializer structure.
3. **VClass semantic naming** — promote structural vtable classes to semantic
   names via ctor/singleton/field/resource correlation.
4. **Locator field owner promotion** — attribute unknown-owner field facts by
   register/object tracking at access sites.
5. **Outbound payload field semantics** — pair builder backward-slices with
   named CWvsContext/CUserRemote fields (which int32 is itemId etc.).
6. **S3 sender tail re-attempt** — decompiler-grade constant/dataflow pass on
   the 112 vtable-hosted sites; either advance or re-confirm the boundary.

## 1. Inputs (all verified)

- Game image `.work/task-036/game-image-unpacked.bin` (RVA==offset, base 0x400000)
- Semantic DB `.work/task-050/db/` (function-summary, callgraph, callers)
- Task 050 artifacts (task050-*.csv/md), esp.:
  - vtable-classes.csv (179 ctor-validated)
  - field-facts.csv (522; 146 owned)
  - outbound-payload-semantics.csv (87 sliced builders)
  - hotspots.csv / blockers.csv classifications

## 2. Rules (inherited, non-negotiable)

- Honest reporting; no fabricated names; ≥2 evidence families for high confidence
- VA/RVA discipline: capstone prints VAs — always subtract 0x400000
- Commit only normalized text/CSV + project scripts; never .work/ or binaries
- Checkpoint commits allowed; final commit wording matches verdict
- No new protector/dynamic work in this task (static corpus only)

## 3. Phases

### Phase A — Equip decode (target: stat-slot map)
- Locate equip vtable (~0x7008C8 family) decode slot (vtable+0x70)
- Walk the decoder: reader calls + 0xF9-object field writes
- Deliver: result/task051-equip-decode.md + .csv (offset→wire field)

### Phase B — Guild container (target: entry layout)
- Disassemble 0x4F3CFC; record op sequence, entry sizes, sub-decodes
- Deliver: result/task051-guild-container.md

### Phase C — VClass naming (target: ≥30 promoted names)
- For each of the 179 ctor-validated vtables: collect ctor writes beyond
  vtable (field inits), singleton refs, resource links, known-role callees
- Promote names only with ≥2 independent evidence families
- Deliver: result/task051-vclass-naming.csv (+ updated class-map)

### Phase D — Field owner promotion (target: ≥100 re-attributed)
- For locator facts: find the access instruction's `this` provenance
  (mov ecx/esi/edi, [singleton] chains) within the enclosing function
- Re-attribute only when the object source is provable
- Deliver: result/task051-field-owner-promotion.csv

### Phase E — Outbound field semantics (target: ≥40 named slots)
- Join payload-semantics slices with owned field names (owner+offset→name)
- Deliver: result/task051-outbound-field-semantics.csv (updated)

### Phase F — Sender tail (attempt; boundary re-confirm acceptable)
- Constant/dataflow analysis around the 112 unresolved hosts
- Deliver: result/task051-sender-tail.md (advance or boundary proof)

### Phase G — Conclusion
- result/51-static-deep-water.md with per-phase verdicts
- Update task050 blockers/hotspots cross-references
- Final commit wording per actual verdict

## 4. Success criteria

- A: equip stat layout ≥20 fields mapped, or documented blocker
- B: guild entry layout decoded, or documented blocker
- C: ≥30 VClass names promoted (honest), else best-effort + reason
- D: ≥100 facts re-attributed with proof, else documented reason
- E: ≥40 outbound slots semantically named
- F: any advance, or a concrete boundary statement
- All artifacts manifest-clean; no empty stubs
