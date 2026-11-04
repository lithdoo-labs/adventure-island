# Task 062 — Gap Closure: Runtime Sender Tail, VClass Naming, Client-Server Field Alignment

## 0. Mission

Close the three explicit gaps left by Tasks 053-058:

1. **Phase A**: Resolve ~96 runtime-dispatched sender functions
   (vtable-hosted send sites with zero static callers)
2. **Phase B**: Assign semantic names to ~169 unnamed vtable classes
   (structural classes from Task 051 that never got context labels)
3. **Phase C**: Complete client-field ↔ server-handler alignment
   (the directional mismatch from Task 056: client fields reference s2c
   packet names, server handlers are c2s — need the MaplePacketCreator
   writer path to bridge them)

## 1. Inputs

- Ghidra decompiled code (52K functions, 35.5MB)
- Server decompiled source (364 Java files, MaplePacketCreator.java)
- Task 060 final labels (51,200 functions at 95.3%)
- Vtable class census (179 validated, 70 named, 109+ unnamed)
- Sender provenance (374/486 named, 96+ runtime-dispatched)
- Client field facts (522 facts, 146 owner-named, 376 locator)

## 2. Success Criteria

- A: ≥30 of 96 runtime sender sites identified (vtable slot → class → packet family)
- B: ≥60 of 169 unnamed vtable classes given semantic context labels
- C: ≥100 client locator fields mapped to server writer variable names
