# Probe order and convergence

The normal miss order is not "registry immediately after NTICE".

## Timeline

| Order | Target | Callsite | Test | Miss edge | Detection edge | Downstream |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `\\.\SICE` | `0x00859757` `call eax` | `0x00859779 inc eax` / `0x0085977A jne` | `0x00859780` | `0x00859A61` | SIWVID |
| 2 | `\\.\SIWVID` | `0x008598B3` `call eax` | `0x008598BB inc eax` / `0x008598BC jne` | `0x008598C2` | `0x00859A61` | NTICE |
| 3 | `\\.\NTICE` | `0x008599FC` `call eax` | `0x0085A004 inc eax` / `0x0085A005 jne` | `0x0085A00B` | `0x00859A61` | resolver, then self-decode |

Each miss test is the same shape. `inc` of `0xFFFFFFFF` falls through. Any other handle is the detection edge. On this host all three `CreateFileA` calls return `0xFFFFFFFF` with error 2, so each miss edge is the ordinary result. Those returns were not supplied to the emulator. The detection block starts `mov ebx, eax` / `clc` / `dec ebx`, which puts the original handle back in EBX. It was not followed.

## Branches that converge

- The `jno` at `0x008597B6` has two successors. Both reach the SIWVID `lea` and the `call eax`.
- The `je` / `jno` pair around `0x00859888` also both reach that call.
- The NTICE `jle` falls into an unconditional `jmp` to the same `mov [esp], ebx`.
- After NTICE, `jb` and `jns` at `0x00859C0B` both reach `0x00859C1B`, then the jump to `0x0085A36E`.
- The command-line byte test before the second decoder has two successors, and both enter the second decoder.

## Registry cluster

`Software\WinLicense` and `Software\WLkt` remain in the image, with the call list from Task 010. The miss path jumps from `0x00859C1F` to `0x00859CE9` to `0x0085A36E` and does not execute that list. Last confirmed device probe on the normal path: `\\.\NTICE` at `0x008599FC`.

## Next protector stage

After the two decoders the plaintext is Oreans SecureEngine driver setup, including `\\.\oreans32`. That name is a later probe candidate. Its callsite is not identified yet. The stage that produces it is a materializer, not another SoftICE check.
