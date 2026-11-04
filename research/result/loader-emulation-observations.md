# Offline emulation

Unicorn 2.1.4, x86 32-bit. The client file was not modified. No new PE was written. The generated block stayed under `.work/task-006/`.

## Mapping

- Image at `0x00400000`, size `0x009DA000`, virtual tails left zero.
- `SizeOfHeaders` copied to the image base, then each section's raw bytes copied to its RVA.
- Stack at `0x00200000`, size `0x00100000`, registers cleared.
- Start EIP `0x00DD8000` (`0x00400000 + 0x009D8000`).
- Instruction budget 30,000,000. No conditional branch was patched.

`UC_X86_REG_FS_BASE` on this Unicorn build is a no-op. The run therefore does not have a real TEB.

## What executed

| Step | Evidence |
| --- | --- |
| T1 writes `0x00912000`–`0x00913000` | 2050 write events, one merged range of length `0x1000` |
| one-byte flag clear | single write at RVA `0x009D800A` |
| T2 first write | RVA `0x00819014`, 1 byte, at instruction 6199 |
| T2 finished range | RVA `0x00819014`–`0x00911B25`, length `0xF8B11`, 1,047,444 write events |
| compressed source reads | `0x00912259` through `0x009D634A` |
| first RIP in tail B | RVA `0x00819014` at instruction 11,390,243. That address still has raw backing |
| first RIP with no raw backing | RVA `0x0081C6C5`, the target of `jmp` at `0x00819014` (`E9 AC 36 00 00`) |
| tail A | no write. First page stayed zero |
| Ztl slots | `0x005FC19F`, `0x005FC1B0`, `0x005FC1C1` stayed 16 zero bytes and were never executed |

Written-block SHA-256, from `0x00819014` for `0xF8B11` bytes: `5529577eec208295e36d61dc11aee42ebe45f7ffb511691f5679676b2330c865`. Entropy 7.7122. The block contains the byte sequence `55 8B EC` three times. That is not an MSVC code section.

## Stop

The first stop, with no FS handling, is `push dword ptr fs:[0]` at RVA `0x0081CB38`. The fault address is 0 because the segment base is 0. That instruction only reads the SEH list head.

A second run handled exactly three encodings, and only when the displacement is 0:

```text
64 FF 35 00 00 00 00    push dword ptr fs:[0]
64 89 25 00 00 00 00    mov dword ptr fs:[0], esp
64 8F 05 00 00 00 00    pop dword ptr fs:[0]
```

Any other `64` prefix stops the run. The stub does not create a PEB and does not answer `BeingDebugged`. Six `fs:[0]` operations ran.

That run then reached the scan at RVA `0x0081CC60`:

```text
cmp eax, 0x32
cmp word ptr [esi], 0x5A4D
sub esi, 0x10000
```

It also checks `PE\0\0` at `[esi+0x3C]`. The stride is 64 KB and the cap is `0x32` steps. The scan did not take the found path. It executed `pop dword ptr fs:[0]`, `popad`, `ret` at `0x0081CC8B`. EIP became 0 because the stack slot under that frame was the zeroed simulator stack. Instruction count 12,151,305. `eax` was 0.

The found path at `0x0081CCC6` was not entered. Forcing that branch would be a patch, so it was left alone. Static disassembly of that path is another `call/pop` stub, not a resolved import.

## Blocker

The entry materializer itself does not need a debugger answer. It stops being self-contained once the generated stub wants a TEB and then fails its own MZ/PE scan inside a 50-by-64 KB window. Continuing past `popad; ret` needs the real call stack and whatever image that scan is meant to find. No API return was forged to get there. `GetLocalTime` was never reached.
