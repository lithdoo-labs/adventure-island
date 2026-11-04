# Clean-environment observation

Host: Windows 10 Pro, build 26200, display version 25H2. No debugger was attached. No service, device, or registry value was created or deleted. MapleStory was not started for this check.

The open used the same arguments as the protector call: `GENERIC_READ|GENERIC_WRITE`, share mode 3, `OPEN_EXISTING`, `FILE_ATTRIBUTE_NORMAL`. It was made from a separate process through `CreateFileA`. `scripts/device_probe_observer.c` is that call. This machine has no `cl` or `gcc` on `PATH`, so the binary was not built. The numbers below are from that API, called directly.

## Devices

| Path | Handle | GetLastError |
| --- | --- | --- |
| `\\.\SICE` | `0xFFFFFFFF` | 2 `ERROR_FILE_NOT_FOUND` |
| `\\.\SIWVID` | `0xFFFFFFFF` | 2 `ERROR_FILE_NOT_FOUND` |
| `\\.\NTICE` | `0xFFFFFFFF` | 2 `ERROR_FILE_NOT_FOUND` |

No handle was closed, because none was opened.

## Drivers and services

`HKLM\SYSTEM\CurrentControlSet\Services\SICE`, `NTICE`, and `SIWVID` are absent. `driverquery` printed no row whose name contained `SICE`, `NTICE`, `SIWVID`, `WINICE`, or `SoftICE`.

## Registry

`HKCU\Software\WinLicense` is absent. `HKCU\Software\WLkt` is absent. They were not created.

This host therefore has none of the historical SoftICE device objects and none of the WinLicense keys the protector names.
