# Protector probe map

The captured window is RVA `0x00856000` for `0xC000` bytes, taken at the `CreateFileA` stop. Probes below are names and call shapes in that window. None of them were satisfied or skipped.

## Devices

| ID | RVA | Target | Evidence |
| --- | --- | --- | --- |
| P1 | `0x00859757` | `\\.\SICE` | `CreateFileA`, handle test at `0x00859779` |
| P2 | `0x00859882` | `\\.\SIWVID` | `lea ebx` of the string, in the span after the absent edge |
| P3 | `0x008599BF` | `\\.\NTICE` | `lea ebx` of the string, still before `0x00859A61` |

P1 is the only one whose call and return test were both reached. P2 and P3 are sibling loads. Their `CreateFileA` call, if it exists, is past the instruction where the replay stopped, so it was not observed.

## Registry

| ID | RVA | Target |
| --- | --- | --- |
| P4 | `0x00859D07` | `HKCU\Software\WinLicense` |
| P5 | `0x00859D26` and the following leas | value names under that key |

P4 is `lea` of the subkey, `push 0x80000001` (`HKEY_CURRENT_USER`), and `call dword [ebp+0x7480CD1]`. Three pushes, so the shape is `RegOpenKeyA`. The slot's export name was not recovered.

P5 pushes a value name, a zero, and the opened-key slot, then `call dword [ebp+0x7441815]`. Value names in the same cluster:

`WinLicenseVersion`, `WinLicenseDriverVersion`, `WinLicenseInstance`, `CheckIN`, `CheckOUT`, `XprotExit`, `ExitOk`, `ProcIN`, `ProcOUT`, `ExitIN`, `ExitOUT`, `ExpInfo`, `Software\WLkt`.

## Looked for and not found in this window

No `NtQueryInformationProcess` / `ZwQueryInformationProcess` call, no debugger process or window-class string, no PEB `BeingDebugged` read, no `int 2d` / `int 3` probe, no service-name string beyond the WinLicense key. `rdtsc` occurs on the absent-side landing and inside the export walker, with registers saved around it. That is the same junk shape used throughout this protector, so it is not a separate timing probe.

The two anti-debug RVAs from Task 004 (`0x00862E76`, `0x00862FB0`) are outside this window and were not executed.
