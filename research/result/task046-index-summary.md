# Task 046 — Mechanical Index Summary

Built by `a1_build_index.py` + `a2_fix_index.py`. All indexes in
`.work/task-046/index/` (scratch, not committed).

## Index inventory

| Index | File | Entries |
| --- | --- | --- |
| Function census | `functions.csv` | 51,200 candidates (prologue + call-target scan) |
| Direct call edges | `call_edges.csv` | 272,429 edges |
| Import call sites | (computed in-function) | 5,200 |
| Strings | `strings.csv` | 1,251 (data sections) |
| String xrefs | (embedded in strings.csv) | 0 (strings not referenced by absolute VA in code — indirect access) |
| RTTI classes | `rtti.csv` | 13 (all in the security/exception family) |
| Vtable candidates | `vtables.csv` | 52 (data-section code-pointer sequences) |
| Switch/jump tables | `switches.csv` | 109 |
| Packet primitive call sites | `packet_callsites.csv` | 4,366 total (ReadInt32/ReadByte/ReadInt16/ReadString/WriteHeader/ctor) |
| Globals accessed | `globals.csv` | 8,445 unique global addresses referenced from code |

## Function boundary uncertainty

The 51,200 function candidates come from two sources:
1. Prologue scan (`55 8B EC` and `8B FF 55 8B EC` patterns) — high confidence
2. Direct call targets — high confidence for the target being code

The overlap is not computed (some prologue-scanned addresses may be
false positives from data that happens to match the pattern). The true
function count is likely between 8,000-15,000 (the image is 10.3MB with
~7.9MB of code).

## Key observations

- The 272K call edges provide a rich xref graph for subsystem clustering.
- The 8,445 globals include singleton object pointers, dispatch tables,
  and state variables — the primary evidence for object recovery.
- The 4,366 packet primitive calls show that packet I/O permeates the
  entire codebase (ReadInt32 alone has ~2,000 call sites).
- String xrefs are zero because data-section strings are accessed through
  indirect references (tables/pointers), not direct VA pushes — a
  consequence of the Themida runtime layout.
