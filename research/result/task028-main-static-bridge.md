# Task 028 — Main static bridge update (protector VM corridor)

This file extends `result/task027-main-static-bridge.md` with the Task
028 corridor findings. All RVAs are `MapleStory.exe` (canonical sample
`5d280cf1…`), reconstructed from the decoded image at the corridor stop
plus the dynamic corridor trace.

## 1. New structural facts (confirmed-replay)

| Fact | Evidence |
| --- | --- |
| The post-probe corridor is driven by a **bytecode VM** | handler table at RVA 0x84B1E0 (0x100+ entries), dispatch `jmp dword ptr [edi+eax*4]` at RVA 0x8574D9, opcode byte in `al`, bytecode stream at `esi` (RVA 0x8624xx–0x8662xx), encrypted frame pointer `ebp=0xF97D9014`, all VM data via `[ebp+0x744xxxx]` → Tail B |
| VM opcode-0 / error entry = 0xC5941F (the reporter) | handler `push dword ptr [edx]` at RVA 0x85694F pushes table[0] |
| The corridor's name resolution uses a **custom CRC-32** with polynomial bytes 0x5041/0x5449 ("APIT"), seed 0xFFFFFFFF, bitwise, final `not` | disasm RVA 0x81D14C-0x81D197 + dynamic operand capture (esi=kernel32 name bytes) |
| kernel32 export walk resolved **"Sleep"** (target first char 'S' staged at [0xC1A361]); 154 S-block names / 3229 bytes hashed, exactly 1 match | dynamic trace n=19,071,027-19,294,561 |
| A second export walk covered advapi32's name zone (+0x15000-0x19000, ~100K reads) before the RegOpenKeyA call | whole-run read-page map |
| The verification walk = **26 unrolled check items** in the bytecode with an accumulator byte at the walk heads (0x46 boundary states / 0x83-0x97 running states, parity 1 mid-walk) | 26 `and ecx,edi` executions at RVA 0x84B6B7 |
| The walk's aggregate selects the post-walk script; the error target is then *computed by constants* (add 0x2E3D5322) and installed as the VM continuation (D1 = RVA 0x84E638 `pop [edx]`) | decision-isolation.md |
| The reporter has two early-exit option cells ([RVA 0x81B7A9] report-mode, [RVA 0x819BF1] custom handler) — both zero in replay | static disasm of 0x85941F+ |
| PEB/TEB debug fields are **never read** on the whole executed path; the corridor's only external reads are kernel32/advapi32 export structures + the timeGetTime/Sleep APIs | whole-run read-page map + fs-event log |

## 2. Corridor region map (dynamic blocks, top zones)

- 0x81D106-0x81D198: export-name scan/hash engine (custom CRC-32) —
  shared by the kernel32/advapi32 resolution passes.
- 0x84B1E0-0x84B4FF: VM context (handler table, result cells 0x84B200/
  0x84B204, staged check-parameter cells 0x84B364/0x84B3B4/0x84B404/
  0x84B478/0x84B480).
- 0x84B6C5-0x857Dxx: walk/gadget engine (all dispatch gadgets).
- 0x862000-0x8662xx: VM bytecode + data (includes the #UD/SEH choreography
  zone 0x862E76/0x862F19 from Task 027 — now understood as VM bytecode
  territory).
- 0x819000-0x81D1xx: reporter support cells (0x8198F1 text buffer,
  0x81A6BD MessageBoxExA slot, 0x81B7A9/0x819BF1 option cells, 0xC1AD91
  skip-counter, 0xC1A361 search-char cell).

## 2b. VM opcode table (decoded from the dumped image — B28-3 foundation)

Handler table at RVA 0x84B1E0, entry per opcode byte:

| Opcode | Handler RVA | Semantics (first instructions) |
| --- | --- | --- |
| 0x00 | 0x85941F | **the error reporter itself** (executing opcode 0 = report) |
| 0x1F | 0x851114 | `lodsw` + decode — 16-bit immediate fetch |
| 0x36 | 0x85264F | `push [edi+0x38]` — VM-cell push |
| 0x3E | 0x852F2C | `lodsb; xor al, bl` — bytecode byte fetch (key bl) |
| 0x42/0x43/0x45/0x47 | 0x84BEF7/0x84CB7C/0x855CAA/0x84FC60 | stack-shuffle ops |
| 0x61 | 0x8549B6 | `lodsb; xor al, bl` — immediate fetch (x38 per Z-item) |
| 0x62 | 0x854E37 | edx/edi staging op |
| 0x75 | 0x84CE08 | stack/alu op |
| 0x7D | 0x84E638 | `pop dword ptr [edx]` — store to VM cell (the D1 instruction) |
| 0x88 | 0x84C4FA | `lodsd; sub eax,c; sub eax,ebx` — 32-bit immediate fetch |
| 0x89 | 0x84F198 | `mov edx,[esp]` — VM register move |
| 0x8E | 0x84DEE7 | `lodsd` + arithmetic — 32-bit immediate variant |
| 0x92 | 0x85017A | `lodsd` + const arithmetic — immediate variant |
| 0x99 | 0x85694F | `push dword ptr [edx]` — push VM cell (continuation push) |
| 0xA3/0xA8/0xAD | 0x84CD0A/0x84CB10/0x853559 | stack ops |
| 0xA6 | 0x851315 | `lodsd; jmp 0xC4F6A5` — **the conditional check**: `cmp [edi+0x20],0; je` — check/branch opcode |

Steady-state walk item programs (from the dynamic opcode stream): Z-items
run a 208-op program, X-items a 127-op program, both strictly repeating
across items — the 26 items are a staged **data table** processed by two
program shapes; staging happens in items 0-3 (export walks + "APIT"-CRC
hashing). One anomalous 92-op Z-item (n=19,996,653) and the boundary
programs (59-op item 25, 132-op post-walk tail) complete the picture.

## 3. Boundary status

Tail A: still **0 writes** in every state (unchanged from Task 027);
ZtlTaskMem slots still zero. The replay's deepest faithful state remains
the error-reporter commitment (D1) — with three real fidelity defects
fixed this task (GetVersionEx layout + 16-byte OOB write; command-line
quoting; registry duplicate-handle value), the outcome is unchanged, so
the remaining divergence cause is inside the staged-data/timing-model
dimension recorded in the blocker ledger.

## 4. Reproducibility

```text
python scripts/maple079_full_replay.py --exe <MapleStory.exe> \
    --guest-dir <guestdll> --client-dir <client> --budget 60000000 \
    --save-ck .work/task-028/checkpoints --trace-dir <out> \
    --apilog-out <out>/apilog.json
# resume (30s iterations):
python scripts/maple079_full_replay.py … --resume-ck .work/task-028/checkpoints \
    --trace-dir <out2> [--trace-log-reads] [--tgt-15ms] [--cmdline …]
```
