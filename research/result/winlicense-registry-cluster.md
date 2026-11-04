# WinLicense registry cluster

The calls below are in the materialized window at RVA `0x00856000`. The API slots are still unresolved. No export name is assigned to them.

## Keys and values

The string table at `0x00859C24` is:

`Software\WinLicense`, `Software\WLkt`, `CheckIN`, `XprotExit`, `CheckOUT`, `WinLicenseVersion`, `WinLicenseDriverVersion`, `WinLicenseInstance`, `ExitOk`, `ProcIN`, `ProcOUT`, `ExitIN`, `ExitOUT`, `TpIN`, `HWIN`, `ExpInfo`.

Every open uses root immediate `0x80000001`, which is `HKEY_CURRENT_USER`.

## Call shape

The repeated block is:

1. `lea eax` of a local slot at `0x00859CD5`, then `push eax`.
2. `lea eax` of `Software\WinLicense` or, once, `Software\WLkt`.
3. `push 0x80000001`.
4. `call dword [slot 0x00859CE5]`.

Three arguments, last pushed first: root, subkey, pointer to a handle slot. That is the shape of `RegOpenKeyA`. The slot is not a resolved export, so the name stays unresolved.

Then, for a value name:

1. `push 0x19`.
2. `push dword [slot 0x00859CD9]`.
3. `push 1`.
4. `push 0`.
5. `push` the value-name address.
6. `push dword [slot 0x00859CD5]`.
7. `call dword [slot 0x0081A829]`.

Six arguments. Reserved `0` and an immediate type `1` (`REG_SZ`'s numeric value) look like a value write more than a query, because a query passes a pointer for the type. The data operand is a pushed slot dword, not a `lea`, so a write is not proven either. The slot `0x0081A829` is next to the walker output slot `0x0081A81D` and was not one of the named stores (`LoadLibraryA`, `GetLocalTime`, `MessageBoxExA`).

Two more calls follow most values, through slots `0x00859CE1` and `0x008191E9`. The first is a single push of the handle slot, which is a close shape. Both slots are unresolved.

## What the names suggest

| Names | Likely role | Confidence |
| --- | --- | --- |
| `WinLicenseVersion`, `WinLicenseDriverVersion` | protector or driver version stamp | medium, from the names only |
| `WinLicenseInstance`, `CheckIN`, `CheckOUT`, `ProcIN`, `ProcOUT`, `ExitIN`, `ExitOUT`, `ExitOk`, `TpIN` | process or instance lifecycle | medium, from the names only |
| `XprotExit` | exit or coordination flag; the `Xprot` token is the older product spelling | low |
| `ExpInfo`, `HWIN` | unknown | low |
| `Software\WLkt` with `CheckIN` | a second key in the same cluster; a secondary report calls `WLkt` token storage | medium for "same family", low for the token-storage gloss |

This is not the customer license blob described by Oreans. That blob uses a path the developer picks. This cluster is a fixed key and a fixed set of short value names, opened once per value. It reads as protector coordination state: version, instance, and enter/leave marks. It is not, by itself, an anti-debug device check. The device checks are the earlier `CreateFileA` names.

Nothing here writes Tail A or a Ztl slot.
