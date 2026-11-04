# Task 045 — Grand Static Campaign (five-front)

## Objective

The expanded long campaign on the proven 036 corpus — every remaining
static frontier in one arc:

```
Phase A  key recovery — carve the heap cipher objects (S-box anchors
         known); extract the 240-byte expanded AES-256 schedule;
         run the inverse key expansion; recover the original 32-byte
         key; verify against the known MapleStory key
Phase B  sender completion — the 967-site builder census × parameter
         provenance: for each unnamed send site, walk its enclosing
         function's arguments to the WriteHeader call; target ≥85%
Phase C  body-crypt site — decode the extract chain's chunked
         processing (the stream object at [socket+0x40]); find the
         16-byte block loop + the heap cipher call
Phase D  handler deep-dive — decode the top-named handlers to method
         level: WARP_TO_MAP (0x37E72F), SPAWN_PLAYER (0x57F6C0),
         UPDATE_STATS, CHANGE_MAP, CLOSE_RANGE_ATTACK — each to a
         field-annotated read/write map
Phase E  final atlas — the consolidated naming ledger + the terminal
         README assessment
```

## Milestones

- **A** the original AES key recovered (or its irrecoverability proven)
- **B** sender census ≥85% (413+/486)
- **C** the body-crypt call site identified
- **D** ≥5 handlers decoded to field maps
- **E** the terminal atlas + assessment

## Restrictions (inherited)

Static analysis of the 036 corpus; nothing binary committed;
two-evidence naming; honest boundaries.

## Operational machinery (inherited)

Sessions with checkpoints; `.work/task-045/`; stop A-D; commit
`Complete Task 045 grand static campaign`; never force push.
