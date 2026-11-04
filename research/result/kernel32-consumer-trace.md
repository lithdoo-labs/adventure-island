# kernel32 base consumers

The found path stores `0x76240000` at RVA `0x0081A621` and `0x0081B45D`. Both slots still hold that value at the end of the run (`00 00 24 76` little-endian).

## First read

| Field | Value |
| --- | --- |
| Instruction | 1,191,526 |
| EIP | VA `0x00C2210C`, RVA `0x0082210C` |
| Bytes | `FF 32` `push dword ptr [edx]` |
| EDX | `0x00C1A621` (the slot) |
| Next | `jmp 0x00821797` |

The same instruction reads the slot again at instructions 1,446,323 and 1,606,093. A later read is at RVA `0x00858A4D`, instruction 2,296,854. `0x0081B45D` was not the first read.

## How the value is used

The export walker at `0x0081CF01` does not reload the slot itself. It adds a base held on the stack to PE offsets:

```text
0x0081CF01  lodsw                         ; reads kernel32+0x3C (e_lfanew)
0x0081CF3C  mov eax, dword ptr [eax+0x78] ; PE + 0x78 = DataDirectory[0]
0x0081CF97  mov eax, dword ptr [eax+0x18]
0x0081D034  lodsd
0x0081D126  lodsd                         ; name-pointer slot
0x0081D138  cmp al, byte ptr [edi]        ; name byte
0x0081D13F  scasb                         ; walk to the NUL
```

Observed kernel32 accesses, in order:

| VA | What it is |
| --- | --- |
| `0x7624003C` | DOS `e_lfanew` |
| `0x76240160` | `PE+0x78`, the export data directory |
| `0x762D5FB8` | `IMAGE_EXPORT_DIRECTORY` |
| `0x762D5FBC` / `C0` / `C4` | the next three header dwords |
| `0x762D79DC` and the following dwords | `AddressOfNames` slots |
| single-byte reads such as `0x762DA166` | export name characters |

`AddressOfFunctions` and `AddressOfNameOrdinals` are part of the same directory the walker has already entered. The compared bytes are name characters, not a hash. No rotate/xor name hash was required to explain the reads.

This is an export walker. It is not merely "a read of kernel32".
