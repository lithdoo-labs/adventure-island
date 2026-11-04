# Task 049 — Field Dispatcher Band Closure & Complete Naming Atlas Campaign

## Objective

Task 048's sendops.properties gives the complete 217-entry s2c wire table.
58/97 range-table handlers are named. The remaining 39 map to the field
dispatcher's 20 bands (opcodes 0x81-0x185). This campaign closes the
handler map and produces the final consolidated naming atlas:

```
1. Map ALL 217 s2c wire values to the field dispatcher's 20 bands
2. Name every reachable band handler
3. Merge with the range-table naming → the COMPLETE handler map
4. Re-run subsystem classification with complete data
5. Update all seven subsystem dossiers with the final naming
6. Produce the terminal game-logic atlas
```

## Milestones
- **F0** field dispatcher bands × wire values → complete band naming
- **F1** merged handler map (range + field) → near-100% naming
- **F2** subsystem classification re-run with complete table
- **F3** updated dossiers + terminal atlas

## Corpus
Client image + complete s2c wire table (217) + range/field dispatcher maps.
