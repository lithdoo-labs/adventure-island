# Task 028 — D1 decision isolation (post-probe protector corridor)

STARTING_HEAD `a6c9b6cf7a12e0f22da71720cb7828b45c31bbc7`, sample
`MapleStory.exe` SHA-256 `5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d`.
Evidence source: selective corridor trace
`.work/task-028/gadget-traces/run2/corridor-trace.jsonl`
(1,346,545 instructions from the first `timeGetTime` return at n=18,865,229
to the terminal fault at n=20,211,773), deterministic across runs
(`task028-replay-determinism.csv`).

## 1. What actually terminates the replay

```text
n=20,211,769  user32!MessageBoxExA("…garbage…", "Themida - http://www.oreans.com")
n=20,211,773  wild jump to unmapped 0x080a7c4d after the box returns IDOK
```

The error-reporting function entry is **RVA 0x85941F**
(`pushal; cmp [ebp+0x7442795],0; je …`), reached by a native `ret`
(RVA 0x857108) that pops the reporter address from the VM stack.

## 2. The VM that owns the corridor (new, confirmed-replay)

The whole corridor is driven by a bytecode VM inside the decoded regions:

| Element | Value | Evidence |
| --- | --- | --- |
| handler table base | RVA 0x84B1E0 (`edi`/`edx` during dispatch) | `jmp dword ptr [edi + eax*4]` at RVA 0x8574D9, executed throughout |
| opcode index | `al` (derived by obfuscated arithmetic incl. `xor bl, al`) | n=20204443-20204446, n=20206424-20206427 |
| bytecode stream | `esi` walks RVA 0x8624xx–0x8662xx (`lodsb`/`lodsd`) | e.g. esi=0xC66173/0xC6626D/0xC661D1 |
| frame pointer encryption | `ebp = 0xF97D9014` constant; all VM data addressed `[ebp + 0x744xxxx]` → Tail B | every gadget |
| opcode-0 / error entry | table[0] = 0xC5941F | `push dword ptr [edx]` at RVA 0x85694F reads [0x84B1E0] |

## 3. The exact commitment chain into the error path

Working backward from the reporter entry (all confirmed-replay):

1. **n=20,211,743** `ret` (RVA 0x857108) pops 0xC5941F — entry into the
   reporter. Last writer of that stack slot: **n=20,206,427** RVA 0x85694F
   `push dword ptr [edx]` with edx = 0xC4B1E0 → pushes table[0] (the error
   entry) as the VM continuation.
2. Before that, **n=20,204,446** RVA 0x84E638 `pop dword ptr [edx]` stored
   0xC5941F into VM cell [0x84B1E0] (overwriting the 13th `timeGetTime`
   sample 0x126189 stored there at n=20,127,697). This is the point where
   the error target *becomes* the VM's continuation register.
3. The value 0xC5941F was computed by pure constant arithmetic
   (`add dword ptr [esp+4], 0x2E3D5322` at RVA 0x8563A7, n=20,196,836) —
   the address itself is not data-dependent; the *selection* of this
   gadget script is.
4. The selecting script is the post-walk program at bytecode esi=0xC661D1,
   entered after the last verification-walk item (n=20,184,352 head,
   ebx=0x801, ecx=0 — the same state family as the walk start).
5. The verification walk: 26 unrolled check items in the VM bytecode
   (alternating families), with an accumulator byte tracked at every walk
   head (`and ecx, edi` at RVA 0x84B6B7, ecx-pre values
   `0x46,0x46,0x46,0x12,(0x83/0x87/0x93/0x97)×20,0x46,0x46`).
   Mid-walk all states have parity 1; the boundary states (0x46) have
   parity 0. The 25th item (n=20,171,705 head) is the first mid-position
   item that runs in the 0x46 state.

## 4. D1 (the decision)

Because the corridor's control flow is VM-dispatched (no single `jcc`
gates the error path), D1 is the **smallest control-dependence node that
determines entry into the reporter**, which is the VM-level continuation
selection:

- **Node**: the VM continuation-cell store — RVA **0x84E638**
  `pop dword ptr [edx]` at **n=20,204,446** (installs 0xC5941F into
  VM cell [0x84B1E0]), consumed by RVA 0x85694F `push [edx]` at
  n=20,206,427 and the final `ret` at n=20,211,743.
- **Instruction/flags**: not flag-dependent; data-dependent through the VM
  dispatch index arithmetic (`xor bl, al; movzx eax, al;
  jmp [edi+eax*4]` at RVA 0x8574D4-0x8574D9), where `bl` carries
  walk-aggregate state.
- **Error successor**: reporter 0x85941F → MessageBoxExA path (observed).
- **Alternate successor**: any other table index — on the real guest the
  same machinery dispatches to the normal continuation (historically:
  import rebuild / ijl15.dll), not observed in replay.
- **Execution count**: 1 (single-shot tail of the walk).

## 5. D1 candidates considered and rejected

| Candidate | RVA | Why rejected as D1 |
| --- | --- | --- |
| `je` inside reporter icon parser | 0x859465+ | inside the reporter (formatting), after commitment |
| reporter early-exit cells | [0xC1B7A9]/[0xC19BF1] | both 0 in replay; they only choose *how* to report, not *whether* |
| walk Z-check `cmp [edi+0x20],0; je` | 0x84F6A5/0x84F6A9 | fires 26×; the item-25 "anomaly" (result 0 in a Z slot) turned out to be the planned boundary phase (0x46-state), not a failed comparison |
| `or ecx,ecx; je` dispatch guard | 0x84E2E5/0x84E2E7 | always taken (ecx=0 in all 15 executions) — not differentiating |
| walk-head `or eax,eax; je` | 0x84B6C5/0x84B6C7 | selects check family (X/Z), both successors continue the walk |
| spin-loop exit `je` | 0x8632E6 | wait-phase exit only; walk proceeds identically afterwards |

## 6. Reporter internals (static, from the dumped decoded image)

```text
0x85941F  pushal
0x859420  cmp [ebp+0x7442795], 0     ; [RVA 0x81B7A9] "report mode"
0x859427  je 0x859432                ; ==0 -> continue
0x85942D  jmp 0x8594DC               ; !=0 -> popal; ret (NO box)
0x859432  cmp [ebp+0x7440bdd], 0     ; [RVA 0x819BF1] custom handler ptr
0x859439  je 0x859460                ; ==0 -> built-in formatting
0x859441  call [ebp+0x7440bdd]       ; custom handler, esi+1 as arg
          ... or eax,eax; jne -> done
0x859460  push 0; cmp [esi],'0'/'3'/'4'/'5'/' ' icon-char parser …
0x8594C3  lea eax,[ebp+0x74408dd]    ; text buffer RVA 0x8198F1
0x8594D6  call [ebp+0x74416a9]       ; user32!MessageBoxExA slot RVA 0x81A6BD
```

Both option cells are zero in the replay, so the built-in box path runs;
the garbage text is the uninitialized ebp-relative buffer
(RVA 0x8198F1), consistent with Task 027's observation.
