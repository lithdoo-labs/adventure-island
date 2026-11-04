# Task 008 — Stage-2 in-place decode

## Replay

Client SHA-256 `5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d`. SysWOW64 `kernel32.dll` SHA-256 `bafd9e061964642802d62f1eb694e7e4af60de739a8df1a492f90006dc5680f3`. Base `0x76240000`. `GetLocalTime` RVA `0x0001D430`, VA `0x7625D430`. T2 block SHA-256 `5529577eec208295e36d61dc11aee42ebe45f7ffb511691f5679676b2330c865`.

Unicorn 2.1.4. Execution started at RVA `0x0081C6C5`. The IAT slot `0x0081802B` was set to `GetLocalTime`. No branch was patched and EIP was not moved to `0x0081CCC6`.

The scan tested `0x76250000` and then `0x76240000`. The found path was entered at instruction 760,723 with ESI `0x76240000`, EDI `0x762400E8`, ECX `0x7625D430`, EAX `1`, EDX `0x00400000`. That matches Task 007.

## Rounds

| Round | Producer | Range | Count | Transform |
| --- | --- | --- | --- | --- |
| 1 | `0x0081CE47` | `0x0081CEB5`–`0x00824080` (`0x71CC`) | 7283 | `xor 0x458541F1`, `add 0x2E061E72`, `xor 0x27D0B2FD` |
| 2 | `0x0081D5D8` | dword pointers `0x0081D633`–`0x00824093` | `0x1A99` (6809) | backward `pop dword [eax]` |

Round 1 decodes the export walker. Round 2 finishes; Task 007 had left it running. No third in-place round completed before the stop. Hashes and densities are in `result/stage2-decode-rounds.csv`. The CFG difference is in `result/stage2-selfmod-cfg.md`.

## Resolver

The first read of the saved kernel32 base is RVA `0x0082210C` (`push dword ptr [edx]`, EDX = the slot). The walker at `0x0081CF01` then reads `e_lfanew`, the export data directory at `PE+0x78`, the export directory, and export name bytes. Comparison is `cmp al, [edi]` plus `scasb`. There is no name-hash loop.

`LoadLibraryA` returned the observed bases of `USER32.dll` (`0x76980000`), `ADVAPI32.dll` (`0x767F0000`), and `NTDLL.dll` (`0x77080000`). Those DLLs were mapped from the Task 007 snapshot. No module that was absent from that snapshot was invented. `GetLocalTime` was given a fixed `SYSTEMTIME` of 2010-01-31. Stored pointers include `LoadLibraryA`, `GetLocalTime`, and `MessageBoxExA`.

## Stop

The next call is `CreateFileA` with argument `\\.\SICE`. That is a SoftICE device probe. Its return value would decide an anti-debug branch, so it was not answered. Instruction 2,409,207. VA `0x7625EA00`.

## What did not happen

Tail A was not written. The Ztl slots were not written. Nothing was written outside Tail B. No AES key, IV prefix, IV seed, `List.wz`, `.wz`, `WS2_32`, `WSAStartup`, `connect`, `send`, or `recv` appeared after either round. No game-like block.

## Route

**Route A.** A string export walker and the first resolved APIs are in hand. The game image is not. The next task is API resolver reconstruction and import emergence. Continuing this replay would require answering `CreateFileA(\\.\SICE)`, which this task does not do.
