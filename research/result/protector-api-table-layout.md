# Protector API table layout

The resolved pointers are not stored as a dense import array. Three slots receive API values, and a separate set of slots holds the export-directory cursors for the walker.

## Output slots

| RVA | Write | Observed values |
| --- | --- | --- |
| `0x0081A81D` | `mov` at `0x0081D398` | `LoadLibraryA`, then `GetLocalTime`, then `MessageBoxExA` |
| `0x0081AAA5` | `add` at `0x0081D2A4` | `LoadLibraryA` (`0x76271F70`); the slot was 0, so the add stored the VA |
| `0x00821478` | `pop dword [edx]` at `0x00834871` | `LoadLibraryA`, the three module bases, `GetLocalTime` |

`0x0081A81D` is overwritten on every successful return. It holds the latest API, not a growing table. `CreateFileA` was in EAX at the probe call and was not written to any of these slots before the stop.

The kernel32 base `0x76240000` stays in `0x0081A621` and `0x0081B45D` (`00 00 24 76`). Those are base slots, not API slots.

## Walker scratch

| RVA | Contents |
| --- | --- |
| `0x0081CEB7` | `NumberOfNames`, decremented once per name |
| `0x0081AD91` | name index |
| `0x0081A361` | optional first character; cleared on the way out |
| `0x0081A331` | `AddressOfFunctions` VA |
| `0x0081A7ED` | `AddressOfNames` VA |
| `0x00819101` | `AddressOfNameOrdinals` VA |

## What was recovered

Four kernel32/user32 APIs, counted only when the stored dword is an exact export or the call entered that export:

| Module | API | Category | Calls before the probe |
| --- | --- | --- | --- |
| kernel32 | `LoadLibraryA` | module loading | 3 |
| kernel32 | `GetLocalTime` | system information | 1 |
| kernel32 | `CreateFileA` | anti-debug/environment probe | 1, unanswered |
| user32 | `MessageBoxExA` | window/UI | stored, not called |

advapi32 and ntdll were loaded. No export from either was stored. No memory-management, registry, process, or exception API was stored before `CreateFileA`. Registry calls later in the window go through unresolved slots (`0x00859CE5` and `0x0081A829`), so those API names are not in this table.

Other 4-byte image writes during the two decode rounds fall numerically inside a mapped DLL and are not exports. They are not listed here.
