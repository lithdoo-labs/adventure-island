# Task 009 — Protector resolver and anti-debug boundary

## Replay

Client SHA-256 `5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d`. SysWOW64 `kernel32.dll` SHA-256 `bafd9e061964642802d62f1eb694e7e4af60de739a8df1a492f90006dc5680f3`. Base `0x76240000`. `GetLocalTime` RVA `0x0001D430`, VA `0x7625D430`. Stage-2 block SHA-256 `5529577eec208295e36d61dc11aee42ebe45f7ffb511691f5679676b2330c865`.

The natural replay was run again from RVA `0x0081C6C5` with no branch patch. The found path is instruction 760,723. `CreateFileA` is instruction 2,409,207. Both counts repeated on a second run after the caller-logging change. Resolver entry RVA `0x0081CF01`.

`CreateFileA` was not given a handle. Neither side of its test was executed.

## Resolver

There is one generic export walker at `0x0081CF01`, plus a shared wrapper at `0x00821750`. The wrapper is the target of every `push imm32; jmp 0x00821750` site in the materialized block. A separate `pop dword [edx]` at `0x00834871` commits a pointer into slot `0x00821478`. It is not a second walker.

The walker takes the module base from `[esp+0x24]`, reads `e_lfanew` through ESI, and walks `AddressOfNames`. The name test is an optional first character plus a checksum in EDX (`xor ax, 0x5041` / `xor bx, 0x5449`). It is not a byte-by-byte compare against a caller C string, and it is not a rotate/xor hash of a short fixed width. On a match it reads `AddressOfNameOrdinals` and `AddressOfFunctions`, adds the module base, and returns the VA in EAX. Failure returns EAX `0`. Both paths execute `ret 8` and write EAX to slot `0x0081A81D`. No forwarder string was read. The three resolved exports are not forwarders.

Exact export matches stored before the probe:

| API | VA | Calls |
| --- | --- | --- |
| `kernel32!LoadLibraryA` | `0x76271F70` | 3 |
| `kernel32!GetLocalTime` | `0x7625D430` | 1 |
| `user32!MessageBoxExA` | `0x76A25100` | 0 (stored only) |

`LoadLibraryA` loaded `USER32.dll` (`0x76980000`), `ADVAPI32.dll` (`0x767F0000`), and `NTDLL.dll` (`0x77080000`) from the Task 007 snapshot. `kernel32` was already mapped. No export from advapi32 or ntdll was stored. Output slots used for API pointers are `0x0081A81D`, `0x0081AAA5`, and `0x00821478`.

## SoftICE boundary

`CreateFileA("\\.\SICE")` at RVA `0x00859757` (`call eax`). String RVA `0x00859507`, loaded by `lea ebx` at `0x00859708`. Arguments: access `0xC0000000`, share `3`, security `0`, disposition `3` (`OPEN_EXISTING`), flags `0x80`, template `0`.

The return gadget lands on `inc eax` / `jne 0x00859A61` at `0x00859779`. `INVALID_HANDLE_VALUE` (`0xFFFFFFFF`) sets ZF and falls through to `0x00859780`. Any other handle takes `0x00859A61`, where `dec ebx` restores it.

The fall-through span contains `lea ebx` of `\\.\SIWVID` (`0x00859882`) and `\\.\NTICE` (`0x008599BF`). The taken edge starts after those two loads, keeps the handle, and stores `'C'` into the walker's first-character slot. Neither edge shows a message or a terminate in its first instructions. Neither edge was run.

The same window later has `HKCU\Software\WinLicense` opened through a three-argument call (`hKey` immediate `0x80000001`) and value names `WinLicenseVersion`, `WinLicenseDriverVersion`, `WinLicenseInstance`, `CheckIN`, `CheckOUT`, `XprotExit`, `ExitOk`, `ProcIN`, `ProcOUT`, `ExitIN`, `ExitOUT`, `ExpInfo`, and `Software\WLkt`. No `NtQueryInformationProcess`, debugger-window name, or PEB/TEB read is in the captured window. `rdtsc` appears, with the same register-save shape used as junk inside the walker, so it is not counted as its own timing probe.

The two edges do not meet inside the gadget. `MessageBoxExA` is in a slot before the probe and is not called on either immediate edge. Nothing in the window references Tail A or a Ztl slot.

## After the probes

The next structurally visible block is still the WinLicense registry cluster, which is another probe. The captured range `0x00856000`–`0x00862000` has no `55 8B EC`, no `.?AV`, no WZ name, no Winsock name, and no AES/IV constant. Tail A and the Ztl slots were not written. There is no deterministic decode past the handle test, so the game-image anchors were not re-derived by executing either branch.

## Route

**Route B.** The probe cluster is mapped. The boundary still depends on the `CreateFileA` handle, which this task does not supply. The game image is not present.
