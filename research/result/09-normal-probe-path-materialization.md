# Task 011 — normal probe path and the materialization boundary

Client SHA-256 `5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d`.

## Normal path

`0x00859780` is still the ordinary SICE miss. From there the CFG reaches two more device calls and then leaves the device-probe cluster.

| Probe | Callsite | Miss | Detection |
| --- | --- | --- | --- |
| `\\.\SICE` | `0x00859757` | `0x00859780` | `0x00859A61` |
| `\\.\SIWVID` | `0x008598B3` | `0x008598C2` | `0x00859A61` |
| `\\.\NTICE` | `0x008599FC` | `0x0085A00B` | `0x00859A61` |

SIWVID and NTICE are real `call eax` probes. Each builds `GENERIC_READ|GENERIC_WRITE`, share 3, `OPEN_EXISTING`, flags `0x80`, template 0, and the device string. The return test is `inc eax / jne 0x00859A61`, the same test as SICE. This host returns `INVALID_HANDLE_VALUE` and error 2 for all three names. That return was not written into the emulator.

The WinLicense registry call block is not on this edge. `0x00859CE9` jumps to `0x0085A36E` and skips `0x00859D07`–`0x0085A341`. Last confirmed device probe: NTICE at `0x008599FC`.

## Post-probe boundary

`0x0085A464` is a 5977-dword in-place decode (`xor`, `xor`, `sub`) writing `0x0085A530`–`0x00860293`. The plaintext is a command-line switch parser (`/getwlstatus`, `/checkprotection`, `/bugcheck`). The no-switch path runs a second 5958-dword decode at `0x0085AA35`. That plaintext contains an `MZ`/`LE` VxD at `0x0085B405` and Oreans driver text: `oreans32.sys`, `oreansx64.sys`, `\\.\oreans32`, `SecureEngine`, `OpenSCManagerA`, `CreateServiceA`. A patched `jmp` at `0x0085B400` goes to `0x0085EBD5` and then `0x0085FCC0`.

`\\.\oreans32` is string-loaded. Its callsite is unresolved. The driver body at `0x0085FCC0` is the blocker.

## Game state

No Tail A write. No Ztl write. No execute outside Tail B. No new allocation. No AES key, IV, WZ, Winsock, or RTTI in the decoded spans. v95 symbol correlation was not started. A non-elevated `CreateProcess` of the client failed with WinError 740, so there is no new runtime memory picture.

## Route

**Route B — post-probe materializer identified.**

The materializer is the pair of in-place decoders. Game anchors are not in the output. The next task is Post-Probe Materializer Reconstruction, starting at the driver-install entry `0x0085FCC0` and the embedded LE image `0x0085B405`.
