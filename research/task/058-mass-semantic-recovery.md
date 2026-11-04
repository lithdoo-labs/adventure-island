# Task 058 — Mass Function Semantic Recovery

## 0. Mission

Scale function semantics from 25% to 60%+ using five propagation strategies:
1. **Phase A**: Server-source cross-naming (7,507 Java method names → client functions)
2. **Phase B**: Call-graph label propagation (spread known names through call tree)
3. **Phase C**: String-reference clustering (group by shared strings)
4. **Phase D**: Handler-tree expansion (trace from all known handlers)
5. **Phase E**: Combined scoring + naming

## 1. Inputs

- Game image (10.3MB) + function DB (51,200)
- Server source (364 Java files, 7,507 methods, 861 classes)
- Existing semantic grades (13,518 functions with roles)
- Callgraph (146K edges)
- Protocol map (365 opcodes with handler mappings)

## 2. Success Criteria

- ≥15,000 functions with medium+ semantic labels (from current ~13K structural)
- ≥3,000 functions with high-confidence names
- Every function in the top-50 call-centrality ranks named or classified
