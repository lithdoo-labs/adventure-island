# Stage-2 self-modifying CFG

Both rounds were measured on the natural replay. The bytes below are the post-transform instructions. The pre-transform bytes at the same RVAs do not disassemble as this control flow.

## Round 1

Producer `0x0081CE47`. The loop reads `dword [edx+ebx]`, applies three immediates, and writes the dword back:

```text
0x0081CE0D  xor ecx, 0x458541F1
0x0081CE21  add ecx, 0x2E061E72
0x0081CE28  xor ecx, 0x27D0B2FD
```

EBX starts at 0 and the stride is -4 (`sub ebx, 0x250168DA` is the obfuscated step). EDX at the first sample is `0x00C2407D`. The covered byte range is RVA `0x0081CEB5` through `0x00824080`, length `0x71CC`, 7283 dwords. Entropy stays near 7.3. Instruction density of a linear sweep stays low (0.015 to 0.035). There is no `55 8B EC`.

What the post-transform bytes add is the export walker, entered at `0x0081CF01`. That RVA is below `0x0081D633`, so round 2 does not overwrite it. Pre-transform linear disassembly of the same window does not contain `lodsw` / `mov eax, [eax+0x78]` / `cmp al, [edi]`.

## Round 2

The loop is only coherent after round 1.

```text
0x0081D58D  mov ebx, 0x1A99
0x0081D594  push dword ptr [eax]      ; loop head
0x0081D5D8  pop dword ptr [eax]       ; body store
0x0081D5F6  sub eax, 4
0x0081D5FF  dec ebx
0x0081D622  jmp 0x0081D594
0x0081D607  jmp 0x0081D633            ; taken when ebx reaches 0
```

The replay executed the head 6809 times (`0x1A99`) and then took `0x0081D633`. EAX walks backward from `0x00C24093` to `0x00C1D633`. Entropy falls from 7.1785 to 6.3819 and the linear instruction density rises from 0.0071 to 0.4119. One `55 8B EC` appears. That single prologue is not a function population.

The first reader of the saved kernel32 base sits in this rewritten span: `0x0082210C` is `push dword ptr [edx]` with EDX equal to VA `0x00C1A621`, then `jmp 0x00821797`.
