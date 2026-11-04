# Entry stub

Sample SHA-256 `5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d`. Image base `0x00400000`. The `jtrppsow` section is RVA `0x009D8000`–`0x009D9000`. Capstone 5.0.7 linear disassembly of that page is code only through RVA `0x009D8069`. Every byte after `0x009D806C` is zero. The `int3` at `0x009D800A` is not on the taken path.

## Taken blocks

| Block | RVA | What it does |
| --- | --- | --- |
| prologue | `0x009D8000`–`0x009D8009` | `sub esp, 4`; `push eax`; `push ebx`; `call 0x009D800B` |
| skipped | `0x009D800A` | `int3` (`CC`). The call above pushes this address and lands on the next byte |
| EIP recover | `0x009D800B`–`0x009D801D` | `pop eax` gets `0x00DD800A`; copy to `ebx`; `inc eax`; then `sub 0xC6000`, `sub 0x5F3571`, `add 0x5F3566` |
| flag | `0x009D801E`–`0x009D8021` | `cmp byte [ebx], 0xCC` / `jne 0x009D803C` |
| setup | `0x009D8023`–`0x009D8037` | store `00` over the `int3`; length `0x1000`; keys `0x4DDE8746` and `0x5069D49F`; `call 0x009D8046` |
| leave | `0x009D803C`–`0x009D8045` | write the pointer into the slot created by `sub esp, 4`; pop the saved registers; `ret` to that pointer |
| transform | `0x009D8046`–`0x009D8069` | dword loop, then `ret 0x10` |

There is no indirect branch in this page. The only calls are the two direct calls above. Nothing in this page references `.idata` or `GetLocalTime`.

## Address math

`eax` after `pop` is VA `0x00DD800A`. The three immediates reduce it as follows:

```text
0x00DD800B - 0x000C6000 - 0x005F3571 + 0x005F3566 = 0x00D12000
```

RVA `0x00D12000 - 0x00400000 = 0x00912000`, the first byte of `tpuaozxc`. `0x000C6000` is also that section's virtual size. `ebx` still points at the `int3`.

## Transform

`0x009D8046` is a stdcall dword loop. The destination and the source are the same pointer. `ecx` is `0x1000`, then shifted right by 2, so the loop runs `0x400` times:

```text
xor dword [esi], 0x4DDE8746
add dword [esi], 0x5069D49F
add esi, 4
```

It returns to `0x009D803C`. The following `ret` transfers control to VA `0x00D12000`.

The `cmp byte [ebx], 0xCC` is a one-shot flag. The first pass sees `CC`, clears it, and runs the loop. A later pass would skip the loop. It is not a debugger check.

## Decoded stub at `0x00912000`

The first decoded instructions are `mov eax, 0` / `pushal` / `or eax, eax` / `je 0x00912072`. Because `eax` is zero, that jump is taken. The bytes at `0x0091200A` are a later re-entry path (`call/pop`, test for `E9`) and are not executed on this pass.

The taken path:

```text
0x00912072  mov eax, 0x00C19014     ; destination VA
0x00912077  mov ecx, 0x00D12259     ; source VA
0x0091207C  push eax
0x0091207D  push ecx
0x0091207E  call 0x0091210A         ; depack
```

`0x00C19014` is RVA `0x00819014` in the second virtual area. `0x00D12259` is RVA `0x00912259`, still inside `tpuaozxc`, 0x259 bytes into the decoded page. A second form at `0x00912062` uses the RVA values `0x00819014` and `0x00912259` plus a delta in `edi`. That form is not taken when the image stays at `0x00400000`.

`0x0091210A` is a bitstream decoder: `mov dl, 0x80`, then `add dl, dl` / `adc`, literal bytes, and `rep movsb` matches. The constants `0x500` and `0x7D00` are the 1280 and 32000 thresholds of the public aPLib depack routine. This identifies the transform. It does not by itself name the protector product.

After the depack returns, the stub plants an `E9` at `0x00912062` and jumps to `0x00912254`. That instruction is `jmp 0x00C19014`, so the first materialized instruction is entered at RVA `0x00819014`.
