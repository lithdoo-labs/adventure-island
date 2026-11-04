# Task 029 — Static bridge update (VM decoded layer)

Extends `result/task028-main-static-bridge.md`. Canonical sample
`5d280cf1…`; all RVAs `MapleStory.exe` from the decoded-image dump.

## New facts (confirmed-replay / confirmed-static)

| Fact | Evidence |
| --- | --- |
| VM dispatch live from n=19,295,510; 4,489 clean dispatches across 28 opcodes | dispatch-log extraction (xor/movzx/jmp signature with edi=table) |
| Handler table 0x84B1E0 fully mapped: 171 in-image entries, 28 executed, opcode 0x00 = reporter | task029-vm-handlers.csv |
| Fetch arithmetic: 0x88 imm = raw − 0x12833B5C − ebx (verified); 0x61/0x3E/0x42 imm8 keyed by bl; 0x1F imm16; 0x8E/0x92 multi-gadget const chains; 0x79 rekeys bl | task029-opcode-semantics.csv |
| 0xA6 = check+branch: `lodsd <signed off>; cmp [edi+0x20],0; je → esi+=off` — Z-block −488 self-loop, X-block +5 exit | disasm + dynamic branch targets |
| Walk expected constants: Z=0x193155AD, X=0x193162AE, staging 0x193159AD/0x193155AD/0x193163AD, final 0x193159AD | task029-check-items.csv (25/26 reproduced by the disassembler validator) |
| timeGetTime wrapper at native RVA 0xC4B4CC: pushal saves the sample pair, `cmp eax,[edi+0x2c]` frame validation, **lock cmpxchg** reentrancy guard (cell 0x84B210) | n=19507006 window |
| The steady-state check core: `cmp old,new; pushfd` (flags 0x83 for new>old) + prev_delta<<16 carry in edx | n=19526670 window |
| The walk is a **timeGetTime behavior state machine** — no memory-integrity divergence exists in its steady state | check-programs.md §4 |

## Zone refinement

- 0xC4B4CC-0xC4B522: VM->native timeGetTime wrapper (+lock guard).
- 0xC5782C: the `cmp ecx,eax; pushfd` comparison primitive.
- 0x865733-0x86A475: the executed bytecode window (Z/X blocks + staging
  + tail; the Task 012-era 0x862000+ zone is now fully VM territory).
- 0x84B1E0-0x84B5FF: table + context cells (0x84B200 result, 0x84B204,
  0x84B210 lock, 0x84B364-0x84B480 parameters).

## Tooling added

`scripts/maple079_vm_disasm.py` (trace-driven VM disassembler +
validator + dispatch-log extractor). Reuses
`scripts/maple079_full_replay.py` corridor tracer unchanged.

## Boundary status (unchanged)

Tail A: 0 writes; ZtlTaskMem slots zero; no import rebuild / ijl15 /
ws2_32 activity; the replay's deepest state remains the error
continuation — now with the consumed input class named (timing
behavior), converting the Task 028 open question into B29-1/B29-2.
