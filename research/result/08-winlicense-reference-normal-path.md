# Task 010 — WinLicense reference and the normal path

Client SHA-256 `5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d`.

## Attribution

**Probable Oreans WinLicense**, medium confidence. The decoded block contains `Software\WinLicense` and `Software\WLkt`. A secondary report lists both strings under a Themida/WinLicense label. The value names `WinLicenseVersion`, `WinLicenseDriverVersion`, and `WinLicenseInstance` are in this sample and were not found in a vendor page. Themida stays possible because it is the same engine. XProtector is only the `XprotExit` spelling. A generic custom protector does not account for those two keys.

The SoftICE names are older than that attribution. Compuware's April 1999 manual names `NTICE.SYS` and `SIWVID.SYS`. MeltICE (1997) and OpenRCE (2006) open `\\.\SICE`, `\\.\SIWVID`, and `\\.\NTICE`.

## This host

Windows 10 Pro build 26200. All three `CreateFileA` calls returned `0xFFFFFFFF` with `GetLastError` 2 (`ERROR_FILE_NOT_FOUND`). The service keys and `HKCU\Software\WinLicense` / `HKCU\Software\WLkt` are absent. Nothing was installed to obtain that.

Microsoft's `OPEN_EXISTING` rule is the same result when the device object does not exist. Task 009 maps that handle to the fall-through at `0x00859780`. The other edge, `0x00859A61`, is the valid-handle edge.

## Normal path

**`0x00859780` is the ordinary-system edge.** Confidence is high. Public checks treat `INVALID_HANDLE_VALUE` as "SoftICE not present" and continue, and this host produces that return. The present edge is the historical debugger-present path. It was not executed.

The miss span holds `\\.\SIWVID` then `\\.\NTICE`, which is the 2006 order. That is a reference-supported expectation of further device probes, not a completed run. The registry cluster after that is protector coordination state (version, instance, enter/leave names). Its API slots are unresolved. It is not a game stage. Tail A, Ztl, WZ, AES/IV, and Winsock are still absent.

The emulator was not given a fake `CreateFileA` result.

## Route

**Route A.** The normal edge is identified. The next task should keep reading the `0x00859780` side statically, or watch a real environment that has no SoftICE device. It should not force the failure return inside the emulator.

## Blocker

The game image is still behind the rest of the probe cluster. Knowing which SICE edge is normal does not materialize Tail A.
