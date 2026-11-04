# Stage-3 materialization

The found path did not allocate a new region and did not write Tail A (`0x002CE000`–`0x007EA000`) or the Ztl slots `0x005FC19F`, `0x005FC1B0`, `0x005FC1C1`. Those three slots were still 16 zero bytes at instruction 977,412.

What did run is an in-place transform of the stage-2 body:

- Producer `0x0081CE47`. Destination RVA `0x0081CEB5`, length `0x71CC`. The low `0x614B` bytes (through `0x00823000`) were no longer being rewritten when the run stopped. Entropy 7.2194. No `55 8B EC`, no `.?AV`, one dword that numerically falls inside the kernel32 mapping.
- A second loop at `0x0081D594` (count `0x1A99`) had started and was still running. Its span stays inside the same body and overlaps the first loop.

That is more protector code, not a game image. No new block was handed to the anchor search. The bytes of the rewritten region were still checked for the known AES key, IV prefix, IV seed, `List.wz`, `.wz`, `WS2_32`, `connect`, `send`, and `recv`. None are present.

Hypothesis, confidence probable: the kernel32 base stored at RVA `0x0081A621` is an input to a later round that has not been decoded yet. Nothing in the traced prefix consumes it as an export walker.

Route remains B.
