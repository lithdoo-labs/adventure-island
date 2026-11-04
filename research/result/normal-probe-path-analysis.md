# Normal-path CFG from `0x00859780`

The walk uses `.work/task-009/probe-window.bin`, the image bytes at the unanswered `CreateFileA("\\.\SICE")` stop. Base RVA `0x00856000`, length `0xC000`. Control flow follows direct branches, the `call / pop / add [esp+4] / ret` gadgets, and `call eax`. A conditional that only skips one junk byte is not a split. Real conditionals are recorded on both sides. The normal-path continuation is the miss edge of each `inc eax / jne 0x00859A61`. The detection target was not used as the main path.

`scripts/maple079_normal_path_analyze.py` checks the client hash, the two later `call eax` sites, the immediate decodes, and the embedded `MZ`/`LE` signature.

## How far it goes

`0x00859780` reaches three device calls, skips the WinLicense registry call block, runs five unresolved resolver calls, then two in-place dword decoders. The second decoder's plaintext is an Oreans driver-install stage with an embedded LE/VxD. The walked instructions stay inside Tail B (`0x00819000`–`0x00912000`).

## SIWVID

`lea ebx` at `0x00859882` is on every edge out of the `rdtsc` / `jno` at `0x008597B6`. Both the fall-through and the taken side meet again before the call. The call is not inferred from the `lea` alone.

Argument formation, in push order, decodes to the SICE recipe:

| Argument | Value |
| --- | --- |
| hTemplateFile | 0 |
| dwFlagsAndAttributes | `0x80` from `0xBE816E45 + 0x417E923B` |
| dwCreationDisposition | 3 `OPEN_EXISTING` |
| lpSecurityAttributes | 0 |
| dwShareMode | 3 |
| dwDesiredAccess | `0xC0000000` from `0xE6E15503 xor 0x26E15503` |
| lpFileName | `0x00C59510`, RVA `0x00859510`, `\\.\SIWVID` |

The filename is written by `mov [esp], ebx` at `0x008598A9`, over the dummy `push eax`. The call is `call eax` at `0x008598B3` (`FF D0`). The return test is `inc eax` at `0x008598BB` and `jne 0x00859A61` at `0x008598BC`. The miss edge is `0x008598C2`. The detection edge is the same `0x00859A61` used by SICE.

`call eax` is the same opcode and the same seven constants as the SICE site, whose EAX at the stop was `kernel32!CreateFileA`. The handle from that call is replaced by `pop eax` before the next `call eax`. No other API slot is loaded into EAX on this stretch. Confidence that SIWVID is the same CreateFileA probe is high.

## NTICE

The miss edge builds the same seven arguments. `lea ebx` at `0x008599BF` forms `\\.\NTICE` at RVA `0x0085951B`. `dwFlagsAndAttributes` is `0xE56575C7 + 0x1A9A8AB9 = 0x80`. `dwDesiredAccess` is `0xDEE0C1FB xor 0x1EE0C1FB = 0xC0000000`. `mov [esp], ebx` at `0x008599DC` stores the name. The call is `call eax` at `0x008599FC`. The test is `inc eax` at `0x0085A004` and `jne 0x00859A61` at `0x0085A005`. The miss edge is `0x0085A00B`.

## What the miss path does next

`0x0085A00B` jumps to `0x00859B8C`. Two compares then decide whether to `call ebx` into `0x0085A307` and `0x00859EBE`:

- `cmp dword [0x0081BAB5], 0` / `jne`
- `cmp dword [0x008191F1], 0` / `je`

Both dwords are zero in the T2 image, and this miss path does not write them before the compares. The zero result skips both calls. Confidence is medium because those dwords were not re-read from a fresh emulator stop in this pass.

Every edge of the following `jb` / `jns` pair reaches `0x00859C1B`. That block jumps to `0x00859CE9`, which jumps to `0x0085A36E`. The registry calls from `0x00859D07` through `0x0085A341` sit between those two jumps, so the normal miss path does not enter them.

`0x0085A36E` issues five `call dword [0x0081C245]` sites (`0x0085A380`, `0x0085A39E`, `0x0085A3BC`, `0x0085A3DA`, `0x0085A3F8`). Each pushes an immediate and one slot, then stores EAX. The slot is the unresolved resolver slot from Task 010. The API names are not assigned.

## First decoder

`0x0085A446` does `add ebx, 0x5E7B` on the return address `0x0085A415`, so EBX is VA `ImageBase+0x00860290`. The loop at `0x0085A464` reads a dword, applies `xor 0x5D02E67B`, `xor 0x587ACB01`, `sub 0x651CFF63`, and writes it back with `pop dword ptr [ebx+esi]` at `0x0085A4C2`. ESI starts at 0 and steps by -4 until it equals `0xFFFFA29C`. That is 5977 dwords, RVA `0x0085A530` through `0x00860293`, length `0x5D64`.

The plaintext begins `jmp 0x0085A5D9` and then the switch names `/bugcheck2`, `/bugcheck`, `/nosplash`, `/forcerun`, `/bugcheckfull`, `/showcode`, `/showcode2`, `/clrt`, `/dis1`, `/showinstance`, `/getwlstatus`, `/logstatus`, `/dumpstatus`, `/checkprotection`. The no-switch exit is `0x0085A986` (`mov eax, 0` / `je`). Both results of the later byte compare still reach the second decoder.

## Second decoder

`0x0085A9B6` is `call 0x0085A9CD`. `pop edx` plus `add edx, 0x5DA4` sets the cursor to VA `ImageBase+0x0086075F`. `push 0x1746` / `pop esi` sets the count. Each step is `add 0x141E9FC6`, `xor 0x75AA4D86`, `add 0x601EFFF4`, then `pop dword ptr [edx]` at `0x0085AA35`, then `sub edx, 4`. 5958 dwords, length `0x5D18`, from `0x0086075F` down to `0x0085AA4B`. Entropy of that span after the transform is 2.648. SHA-256 is `d6cfe6b9e933a59ce97291e38325ebd1f75084ba804aaf78682c9220bb0e4172`. The first span's SHA-256 is `4ddbdf0e304328b837c2142b3a49064381491ec3edd20fa544d09ab1c8f4ff47`. Neither buffer is committed.

The exit is `mov ecx, [slot]` at `0x0085AA45`, then `jmp 0x0085B0E0`. A short stub copies `0x37D0` over the displacement of `jmp` at `0x0085B400`. After that patch the instruction is `jmp 0x0085EBD5`, and `0x0085EBD5` is `jmp 0x0085FCC0`.

## Plaintext in the second span

Coherent strings include `Cannot write oreans.vxd`, `ADVAPI32.DLL`, `OpenSCManagerA`, `CreateServiceA`, `StartServiceA`, `OpenServiceA`, `DeleteService`, `ControlService`, `GetNativeSystemInfo`, `oreans32.sys`, `oreansx64.sys`, `\\.\oreans32`, `\\.\Global\oreans32`, `\\.\Global\oreansx64`, `SecureEngine driver cannot be updated`, `XprotEvent`, and `\\.\Oreans.vxd`.

At RVA `0x0085B405` the bytes are `MZ`. `e_lfanew` is `0xB0`. The signature at `0x0085B4B5` is `LE`, a Linear Executable / VxD, matching the `XPROTVXD` name. `\\.\oreans32` is present as data. Its `CreateFile` callsite was not walked, so the sequence table says string loaded but callsite unresolved.

No AES key, IV prefix, IV seed, `List.wz`, `.wz`, `WS2_32`, `WSAStartup`, `.?AV`, or `.?AU` appears in the probe window or in either decoded span.
