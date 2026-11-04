# Task 040 — Session 5 checkpoint (sender census)

RUN DATE 2026-10-15 · corpus: the Task-036 capture + the live c2s table.

## Delivered (S5 part 1)

**The packet-sender census**: 486 call sites of the send wrapper
(0x95C5C, via the socket singleton [0xBD9024]); **210 carry a
c2s-matching opcode constant within 64 bytes** and are provisionally
named by the live server table (evidence: [img]+[srv-live]):

examples — USE_CHAIR@0x6B402, TAKE_DAMAGE@0x6B4DF, CHANGE_MAP@0x6DF6A,
CLOSE_RANGE_ATTACK@0x6F61D, MERCH_ITEM_STORE@0x72112, …

The remaining 276 need the opcode write traced through the packet
object (values passed as parameters rather than pushed at the site) —
the mechanical S5 continuation.

## Campaign cumulative state

- Dispatch: three layers fully mapped (pump → phase → field/range),
  jump tables extracted (25 + 97 slots)
- Codec: family decoded + key repository located + IV-roll identified
- Naming: ~22 two-evidence NAMEs + 210 provisionally-named senders +
  137 live c2s opcodes + corrected s2c labels
- Remaining: the 276 sender traces, handler-side batch naming,
  CSecurity, the final integration document

## Artifacts

`result/task040-s5-sender-census.csv` (copied from .work), this
checkpoint.
