# WinLicense and SoftICE reference index

Client SHA-256 `5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d`. Each row below was read from the page itself. Search snippets were not used as evidence.

## Device names

| Source | Date | What it says |
| --- | --- | --- |
| [Using SoftICE](https://doczz.net/doc/2748802/using-softice), Compuware Corporation, part 0000-55-4027 | April 1999 | SoftICE for Windows 95/98 is `WINICE.EXE` plus video VxD `SIWVID.386`. SoftICE for Windows NT is kernel driver `NTICE.SYS` plus video driver `SIWVID.SYS`. |
| [MeltICE, Fravia archive](https://www.accessroot.com/fravia/fp_melti.htm) | 22 August 1997 | David Eriksson's MeltICE opens `\\.\SICE` on Windows 95 and `\\.\NTICE` on Windows NT with `CreateFile`, `GENERIC_READ\|GENERIC_WRITE`, share mode 3, `OPEN_EXISTING`, `FILE_ATTRIBUTE_NORMAL`. A handle other than `INVALID_HANDLE_VALUE` means that SoftICE is loaded. The listed push constants are `0`, `0x80`, `3`, `0`, `3`, `0xC0000000`. |
| [OpenRCE, SoftIce Driver Detection](https://www.openrce.org/reference_library/anti_reversing_view/3/SoftIce%20Driver%20Detection/) | 11 March 2006 | ap0x lists `\\.\SICE`, `\\.\SIWVID`, and `\\.\NTICE` in that order and treats `CreateFileA` returning anything other than `-1` as the driver being present. |

The 1999 manual names the driver files. The 1997 and 2006 sources name the `\\.\` paths that user mode opens. Together they identify the three strings as SoftICE debugger and video-driver devices, not as files.

## Registry

| Source | Date | What it says |
| --- | --- | --- |
| [Oreans, Registry keys](https://oreans.com/help/wl/hm_registry-keys.htm) | undated current help | WinLicense can store a customer license under a registry key and value chosen in the Registration panel, in `HKEY_LOCAL_MACHINE` or `HKEY_CURRENT_USER`. The page does not name `Software\WinLicense` or any of the value names in this client. |
| [Joe Sandbox reverser report](https://www.joesandbox.com/joereverser/analysis/download/4b701ba2-fe7f-4826-807c-007de0bf1fd5?type=html) | 16 December 2025 | The IOC table lists the strings `Software\WinLicense` and `Software\WLkt` and labels the sample Themida/WinLicense 2.XX. It does not list `WinLicenseVersion`, `XprotExit`, `CheckIN`, or the other value names. The report is an automated secondary write-up, not vendor documentation. |

## Indicators with no fetched external quotation

`WinLicenseVersion`, `WinLicenseDriverVersion`, `WinLicenseInstance`, `CheckIN`, `CheckOUT`, `XprotExit`, `ExitOk`, `ProcIN`, `ProcOUT`, `ExitIN`, `ExitOUT`, `TpIN`, `HWIN`, and `ExpInfo` were read from the materialized Tail B window. No fetched vendor page or public source listing contained those exact value names. Their meaning is inferred from the names and from the call shape in `result/winlicense-registry-cluster.md`, not from a second document.

## What was not used

Pages that only describe how to alter a SoftICE device name were not used as a method. No third-party bypass or crack source was downloaded or run.
