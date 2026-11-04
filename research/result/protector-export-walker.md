# Protector export walker

One generic walker. Entry RVA `0x0081CF01`. It is the code decoded by round 1 and it is below `0x0081D633`, so round 2 does not overwrite it. The same directory-pointer stores (`0x0081CF30`, `0x0081D04D`, `0x0081D08F`, `0x0081D0F2`) run for kernel32 and again for user32. That is one walker used twice, not two walkers.

A wrapper at `0x00821750` is shared by the `push imm32; jmp 0x00821750` callsites. It relocates one internal table of `0xA8` dwords, takes the pushed immediate as a descriptor cursor, executes `lodsb`, and jumps into the obfuscated chain. `pop dword ptr [edx]` at `0x00834871` writes a pointer into slot `0x00821478`. Those are wrappers around the walker, not additional export walkers.

## Inputs

| Input | Where |
| --- | --- |
| Module base | dword at `[esp+0x24]` on entry. Added to `e_lfanew`, to the export RVA, and to each `AddressOf*` RVA |
| `e_lfanew` cursor | ESI. The first instruction is `lodsw` and the observed read is kernel32+`0x3C` |
| Name checksum | EDX, compared after the mix loop |
| Optional first character | byte slot `0x0081A361`. Zero skips the test. The epilogue clears it |

`ret 8` pops two stack arguments. The base used by the adds is the `[esp+0x24]` dword, which is the module base at the `lodsw`.

## Export directory

kernel32 directory VA `0x762D5FA0`. The walker reads:

| RVA | Instruction | Field |
| --- | --- | --- |
| `0x0081CF01` | `lodsw` | DOS `e_lfanew` at module+`0x3C` |
| `0x0081CF3C` | `mov eax, [eax+0x78]` | DataDirectory[0] |
| `0x0081CF97` | `mov eax, [eax+0x18]` | `NumberOfNames`, saved at slot `0x0081CEB7` |
| `0x0081D034` | `lodsd` / `stosd` | `AddressOfFunctions` → slot `0x0081A331` |
| `0x0081D063` | `lodsd` / `stosd` | `AddressOfNames` → slot `0x0081A7ED` |
| `0x0081D0CF` | `lodsd` / `stosd` | `AddressOfNameOrdinals` → slot `0x00819101` |

For kernel32 those three arrays are `0x762D5FC8`, `0x762D79DC`, and `0x762D93F0`. The user32 walk stored `0x76A565D8`, `0x76A57A70`, and `0x76A58ABC`, which are user32's three arrays at base `0x76980000`.

## Name test

`0x0081D126` loads the next name pointer and adds the module base. `0x0081D138` compares the optional first character. `0x0081D13F` `scasb` finds the NUL and the following subtract is the length, including the NUL. The bytes are then mixed: each byte is shifted through AX/BX eight times, with `xor ax, 0x5041` and `xor bx, 0x5449` when the carry is set. `0x0081D184` compares that result with the EDX saved before the loop. Equal takes `0x0081D197`. Not equal advances ESI by 4, increments the index at slot `0x0081AD91`, and decrements the name count.

This is a checksum over the export name, gated by one character. It is not `strcmp` against a pointer the caller passed in.

## Ordinal and function

On a match, index × 2 is added to the ordinal-table slot and `lodsw` reads the name ordinal. That word × 4 is added to the functions-table slot and `lodsd` reads the function RVA. The module base is added. `IMAGE_EXPORT_DIRECTORY.Base` is not added. The ordinal from `AddressOfNameOrdinals` is already an index into `AddressOfFunctions`.

## Return and failure

The VA is written to `[esp+0x1c]`, which is the EAX slot of the enclosing `pushal`. `popal` at `0x0081D397` loads it into EAX. `0x0081D398` stores EAX at slot `0x0081A81D`. `0x0081D2A4` adds the same pointer into slot `0x0081AAA5` (the slot was zero, so the stored value equals the VA). `ret 8`.

If the name count hits zero, `0x0081D115` writes `0` to `[esp+0x1c]` and jumps to the same epilogue at `0x0081D38A`. Failure is EAX `0` and a cleared `0x0081A81D` slot.

## Forwarder

`0x0081D2AA` loads the first byte at the resolved VA and tests it with four `rcl`. A set condition jumps to the epilogue and skips some of the side stores. No instruction in this path reads a forwarder string such as `NTDLL.Rtl…`. `LoadLibraryA`, `GetLocalTime`, and `MessageBoxExA` are not forwarded. A forwarder path was not observed.

## Callsites of the wrapper

Each site is `push imm32; jmp 0x00821750`. The return address recorded by the stub is the next site.

| Site | Returned to | What ran |
| --- | --- | --- |
| `0x00857E4A` | `0x00857E54` | `LoadLibraryA("USER32.dll")` |
| `0x00857E54` | `0x00857E5E` | `LoadLibraryA("ADVAPI32.dll")` |
| `0x00857E5E` | | not a stubbed API |
| `0x00857E68` | `0x00857E72` | `LoadLibraryA("NTDLL.dll")` |
| `0x00857E7C` | `0x00857E86` | `GetLocalTime` |
| `0x00857E86`–`0x00857EAE` | | later wrapper entries; `MessageBoxExA` is stored after `GetLocalTime` returns, from the walker at `0x0081D398` |
