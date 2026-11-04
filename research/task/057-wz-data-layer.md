# Task 057 — WZ Data Layer Extraction

## 0. Mission

Extract and normalize the game's WZ data files to complete the data-layer
understanding. This adds the "what" (items, skills, maps, mobs) to the
"how" (protocol, already complete from Tasks 055-056).

1. **Phase A**: Inventory WZ files, determine format (binary WZ or XML)
2. **Phase B**: Parse Item.wz → item definitions (ID, stats, requirements)
3. **Phase C**: Parse Skill.wz → skill definitions (ID, effects, levels)
4. **Phase D**: Parse String.wz → localized strings (item names, map names, NPC names)
5. **Phase E**: Cross-reference WZ data with protocol analysis
   (item IDs in packets ↔ item definitions; skill IDs ↔ buff masks)

## 1. Success Criteria

- A: WZ format identified, parser working
- B: ≥1000 item definitions extracted
- C: ≥500 skill definitions extracted
- D: ≥5000 localized strings extracted
- E: ≥10 cross-references between WZ data and packet schemas
