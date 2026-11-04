# Task 061 — Deep Game Logic Extraction: Formulas, Handler Code, Knowledge Graph

## 0. Mission

Leverage the 52K Ghidra-decompiled functions + 365 protocol opcodes + WZ data
to extract the game's core logic:

1. **Phase A**: Game formula extraction
   - Damage calculation (atk vs def)
   - Experience curves (level → exp needed)
   - Drop rate formulas
   - Stat derivation (STR/DEX → damage)
2. **Phase B**: Complete handler pseudo-code documentation
   - All 365 packets with actual decompiled C code
   - Cross-referenced with server Java implementations
3. **Phase C**: Cross-layer knowledge graph
   - opcode → handler → fields → objects → WZ data
   - Queryable semantic database

## 1. Success Criteria
- A: ≥5 game formulas extracted and documented
- B: ≥100 handlers with full C pseudo-code
- C: Knowledge graph with ≥1000 cross-layer edges
