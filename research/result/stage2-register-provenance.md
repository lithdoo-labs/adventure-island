# Register provenance

Provenance is the instruction stream in the post-decrypt T2 block. The Unicorn replay later in `result/stage2-offline-replay.md` only checks the same formulas against the observed module layout. Image base `B` is `0x00400000` for this client.

## Entry, `0x0081C6C5`

```text
mov eax, ebp          ; incoming EBP, saved and then discarded
mov edx, esp          ; incoming ESP
pushal
call $+5 / pop ebp
sub ebp, 0x074436BB   ; EBP = (B + 0x0081C6CF) - 0x074436BB
```

EBP is a base for `[ebp+disp]` slots. It is not the scan pointer. The incoming ESI is stored and not read again on the way to the scan. ESP is the ordinary stack plus two SEH frames (`push handler; push fs:[0]; mov fs:[0], esp`).

The re-entry flag lives at RVA `0x0081B1A1` (`disp 0x0744218D`). Zero means continue.

## EDX becomes the constant `0x00819000`

```text
0x0081CB26  mov edx, 0xF0819000
0x0081CB2B  sub edx, 0xF0000000     ; edx = 0x00819000
```

That constant is the RVA of the T2 region, not a runtime allocation.

## EAX becomes the host-walk cursor

```text
0x0081CB31  lea eax, [ebp + 0x07443C7C]    ; eax = B + 0x0081CC90, the SEH handler
0x0081CB94  sub eax, edx
0x0081CB98  and eax, 0xFFFFF000
```

So the host walk starts at `(B + 0x00003C90) & ~0xFFF`. For `B = 0x00400000` that is `0x00403000`. `ecx` keeps the value `0x00819000` (`mov ecx, edx` at `0x0081CBAF`, before the walk reuses EDX).

The walk at `0x0081CBB3` subtracts `0x1000` until `word [eax] == 0x5A4D` and `dword [eax + word [eax+0x3C]] == 0x00004550`. On this image the header is `0x00400000`, three pages down. EDX is then set from that base (`mov edx, eax` at `0x0081CBEF`). EDX is the host image base from here until the found path consumes it.

## ESI is the resolved GetLocalTime slot, then aligned

`0x0081CBF8` / `0x0081CBFD` is `mov esi, 1` / `or esi, esi`. The `je 0x0081CC13` is dead. The live path is:

```text
0x0081CC01  mov esi, 0x00818040          ; IMAGE_IMPORT_DESCRIPTOR of kernel32.dll
0x0081CC06  add esi, edx                 ; host base + import directory
0x0081CC08  mov esi, dword [esi + 0x10]  ; FirstThunk RVA = 0x0081802B
0x0081CC0B  add esi, edx
0x0081CC0D  mov esi, dword [esi]         ; loader-filled IAT slot
0x0081CC0F  mov ecx, esi                 ; unaligned function address, kept
0x0081CC1F  and esi, 0xFFFF0000          ; 64 KB alignment
```

The on-disk import directory at RVA `0x00818040` names `kernel32.dll` and the only thunk is `GetLocalTime`. `0x0081802B` is that thunk. After the Windows loader runs, the dword is the address of `GetLocalTime`. In SysWOW64 `kernel32.dll` the export is a real function at RVA `0x0001D430`, not a forwarder.

`0x0081CC25` compares the aligned value with `0x80000000`. `jbe 0x0081CC5E` is the path taken when the function sits in the low 2 GB, which is the case for the observed kernel32 base. The other side (`0x0081CC2D`) only runs when the aligned address is above `0x80000000`: if the raw pointer is inside `0xBFF00000`–`0xBFFF0000` it stays aligned, otherwise ESI becomes `dword [raw+1] & 0xFFFF0000`. The `mov esi, 1 / or / je` there is also dead.

## The scan counter

```text
0x0081CC5E  xor eax, eax
0x0081CC60  cmp eax, 0x32
0x0081CC63  je  0x0081CC84          ; failure
0x0081CC65  cmp word [esi], 0x5A4D
0x0081CC6A  je  0x0081CC75
0x0081CC6C  sub esi, 0x10000
0x0081CC72  inc eax
0x0081CC73  jmp 0x0081CC60
```

`0x32` is the exclusive cap on EAX. EAX is tested before the MZ read, starts at 0, and increments only after a miss. The walk therefore performs 50 tests, at `ESI`, `ESI-0x10000`, …, `ESI-0x310000`. It is not a byte length and not an alignment mask.

## Observed values this implies

kernel32 base `0x76240000`, GetLocalTime at `0x7625D430`.

```text
ESI = 0x7625D430 & 0xFFFF0000 = 0x76250000
window = 0x76250000, 0x76240000, …, 0x75F40000
```

`0x76250000 <= 0x80000000`, so the `jbe` path is the one that runs. The first address is inside kernel32 (RVA `0x00010000`, bytes `CC CC` on disk). The second address is the kernel32 image base.
