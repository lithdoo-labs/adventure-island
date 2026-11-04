# Task 039 — Dispatch-Driven Handler Map Campaign

## Objective

Continue from Task 038: the master OnPacket (0x14112E) is open with its
jump table and range sub-dispatchers. This campaign converts that map
into named handlers — the batch-decoding phase the whole game-body
effort has been building toward:

```
H1 login-band dispatcher — trace the cascade tail (B38-3) and/or hunt
   the CLogin-side dispatch by its constants (0x09/0x0A/0x0B charlist/
   select/loggedin from the 033 chain) -> the login handler table
H2 sub-dispatcher decode — the range bands ([0xBDD4A0] 0xA2-0xED
   first), each to its opcode->handler table
H3 protocol-aligned naming — every handler reachable from a PROVEN
   033-burst opcode gets named against the protocol semantics (the
   burst: 0x41 notice, 0x81 charinfo, 0xA2 inventory, 0x16F skills,
   0x91/0x26/0x48/0x65/0x6A/0x2B/0x22/0x7D)
H4 packet builders (G4 carry-over) — the COutPacket encode family
   from the handshake write (0x95CC2)
H5 CSecurity (G5 carry-over) — the 13 RTTI TDs' module
H6 census + ledger — function-count baseline of the decoded clusters;
   consolidated naming CSV
```

## Milestones

- **H1** login-band dispatcher located (or its absence explained)
- **H2** >=2 sub-dispatcher bands fully table-mapped
- **H3** >=8 handlers named via proven protocol alignment
- **H4** the builder family's encode entry decoded
- **H5** CSecurity code region mapped
- **H6** naming CSV + census stats

## Restrictions (inherited)

Static analysis of the Task-036 authorized capture only; nothing
binary committed; v95 = names/structure only; honest boundaries.

## Operational machinery (inherited)

Sync gate; `.work/task-039/`; mandatory reading: Task 038 results
(esp. the dispatch map), `task033-protocol-chain.md`; time budget 8-16 h
(H1 20%, H2 30%, H3 20%, H4 15%, H5 10%, H6 5%); stop A-D; commit
message `Complete Task 039 dispatch-driven handler map campaign`;
never force push.

## Final Report

`result/39-dispatch-handler-map.md` + milestones/blockers/timeline.
Must state: the login-band verdict; band coverage; named-handler
count with evidence classes; builder family shape; CSecurity map;
strongest finding / uncertainty / blocker; next direction.

The most important question Task 039 must answer:

```
"Does the opened dispatch convert into a named handler map — the
login band and at least two in-game bands resolved to handlers that
match the proven protocol flows — making batch game-logic decoding
routine?"
```
