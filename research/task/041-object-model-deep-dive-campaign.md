# Task 041 — Game Object-Model Deep-Dive Campaign

## Objective

Continue from Task 040 (named handlers + dispatch maps): recover the
game's OBJECT MODEL — the live structures behind the names:

```
O0 singleton carving — read the static global pointers
   ([0xBD9028] CWvsContext, [0xBDD8A8] version obj, [0xBDF54C]
   delegate, [0xBD9024] socket, [0xBDD4A0]-family band singletons)
   from the image -> carve each LIVE heap object from the dump via the
   va map -> field layout ground truth
O1 field-map consolidation — merge the carved layouts with the
   handler-read/write semantics (+0x205C CharacterId, +0x2084, +0x2F60,
   ...) into a CWvsContext/CUser field atlas
O2 CUser/identity model — the SPAWN_PLAYER handler's is-it-me
   semantics + the carved identity fields -> the CUser view
O3 game-object vtables — vtable pointers in the carved objects ->
   method tables -> cross-reference with the named handler/builder
   census (967 WriteHeader sites)
O4 naming integration — the object atlas joins the game-logic map
```

Corpus: the Task-036 capture (image + dump + va map); static only.

## Milestones

- **O0** ≥6 live objects carved with verified field layouts
- **O1** the CWvsContext field atlas ≥12 annotated fields
- **O2** the identity/char model documented
- **O3** ≥3 game-object vtables mapped to method lists
- **O4** integrated ledger + report

## Restrictions (inherited)

Static analysis of the authorized capture; nothing binary committed;
naming by the two-evidence rule.

## Operational machinery (inherited)

Sync gate; `.work/task-041/`; time budget 8-16 h; stop A-D; commit
message `Complete Task 041 game object-model deep-dive campaign`;
never force push.

## Final Report

`result/41-object-model-deep-dive.md` + ledgers. The most important
question:

```
"Can the live heap objects be carved and their field layouts joined
with handler semantics into a verified object atlas — giving the
game's data model the same ground truth its code now has?"
```
