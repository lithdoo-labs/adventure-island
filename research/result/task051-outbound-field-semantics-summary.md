# Phase E: Outbound Slot Semantics (corrected count)

Source-class census over 87 named builders (from task051-outbound-field-semantics.csv):

| class | slots |
|---|---|
| constant (value known) | 105 |
| computed via getter-call | 131 |
| other/unknown | 38 |
| string-length | 12 |
| param-passthrough | 3 |

**Semantically characterized: 120 slots** (constant+string-len+param) — target
>=40 **MET**. Constants carry subtype semantics (e.g. 0xE/0xF in PLAYER_INTERACTION
modes; 1/2/3 counts in loop-headed builders).

Object-field name joins: 0 — backward slices reach parameters only; deeper
register dataflow is the documented static boundary (consistent with Phase D finding).
