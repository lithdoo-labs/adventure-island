# Found path

Entry `0x0081CCC6`. No branch was patched. The bytes below are the post-decrypt block; the control-flow gadgets were followed statically, then checked by the offline replay.

At the `je` that arrives here, ESI is the candidate base and EAX is the iteration index (1 for the observed hit). EDI points at the `PE\0\0` dword (`candidate + e_lfanew`). EDX is still the host image base. ECX is the unaligned `GetLocalTime` address.

## What it saves

`xchg esi, eax` puts the candidate base in EAX. The SEH frame is removed. Then:

| Store | RVA | Value |
| --- | --- | --- |
| `0x0081CD44` | `0x0081ABA1` | `1` |
| `0x0081CD8C` | `0x0081A621` | candidate base |
| `0x0081CD95` | `0x0081B45D` | candidate base |

Those RVAs are `pop_eip + disp - 0x074436BB` with the pop at `0x0081C6CF`. The replay wrote the kernel32 base `0x76240000` to `0x00C1A621` and `0x00C1B45D`, which are those RVAs at image base `0x00400000`.

`mov cx, ds` / `and cl, 4` / `or cl, cl` / `jne 0x0081CD7D` tests bit 2 of DS. A user selector `0x0023` has that bit clear, so the `jne` falls through. The taken side was not used.

## What it does not do in this prefix

The recovered instructions do not walk the candidate's section table, import directory, export directory, or resources. They do not form a pointer into Tail A (`0x002CE000`–`0x007EA000`) or into the Ztl slots `0x005FC19F`, `0x005FC1B0`, `0x005FC1C1`. The candidate base is only stored.

## Next materializer

The next real work is an in-place dword transform of the stage-2 body, not a new allocation.

1. A call/pop captures a return address, adds `0x72DD`, and uses that as EDX (`0x00C2407D` at this image base). EBX is then 0.
2. `0x0081CDD8` reads `dword [edx+ebx]`. A fixed `xor` / `add` / `xor` sequence runs (`0x458541F1`, `0x2E061E72`, `0x27D0B2FD`).
3. `0x0081CE47` writes the dword back to the same address.
4. EBX decreases by 4 (`sub 0x250168DA` / `add 0x250168D6`).
5. The loop stops when EBX becomes `0xFFFF8E34`.

That covers VA `0x00C1CEB5` through `0x00C24080` (RVA `0x0081CEB5`, length `0x71CC`, 7283 dwords). The destination is inside the existing T2 region.

Fallthrough at `0x0081CE77` reaches `0x0081D52E` and a second counted loop:

- EBX is `0x1A99` (6809).
- EAX is a return address plus `0x6B29`, VA `0x00C24093`.
- Each round rewrites `dword [eax]` and subtracts 4.
- The loop body is `0x0081D594`–`0x0081D622`.

Its full span would be RVA `0x0081D633`–`0x00824093`, still inside the stage-2 body, overlapping the top of the first transform. The offline run finished the first loop and was still inside the second when it stopped. Neither loop writes Tail A.

Further protector rounds are still encoded in the bytes those loops rewrite. That is the remaining runtime dependency. References are in `result/stage2-found-path-references.csv`.
