# Task 011 baseline

Client SHA-256 is still `5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d`. Size is 3889632. Existing RVAs stay in use.

The official task file was not in the local tree. `git fetch` failed with `Recv failure: Connection was reset`, so this pass follows the task text in the request. The symbol seed CSV and the V95 tree were not present locally. No new public-document search was done.

## This host

Windows 10 build 26200. The same `CreateFileA` argument list used by the client was issued again for the three device names:

| Path | Handle | GetLastError |
| --- | --- | --- |
| `\\.\SICE` | `0xFFFFFFFF` | 2 `ERROR_FILE_NOT_FOUND` |
| `\\.\SIWVID` | `0xFFFFFFFF` | 2 |
| `\\.\NTICE` | `0xFFFFFFFF` | 2 |

`HKCU\Software\WinLicense`, `HKCU\Software\WLkt`, and the `SICE` / `SIWVID` / `NTICE` service keys are absent. Nothing was installed to obtain that.

## Normal edge

Task 009 showed `0x00859779` is `inc eax` and `0x0085977A` is `jne 0x00859A61`. `INVALID_HANDLE_VALUE` makes that `inc` set ZF, so control falls through to `0x00859780`. That edge is unchanged. The forward CFG in this task starts there and does not feed a handle back into the emulator.
