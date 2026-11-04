# SoftICE probe boundary

The replay reaches `kernel32!CreateFileA` at VA `0x7625EA00` on instruction 2,409,207 and stops. The handle is not invented. The classification below is the static control flow of the captured window.

## Call

| Field | Value |
| --- | --- |
| String | `\\.\SICE` |
| String RVA | `0x00859507` |
| String reference | `lea ebx, [ebp+0x74804F3]` at `0x00859708`. That displacement forms `0x00859507` |
| Slot | none. EAX already holds `0x7625EA00`. No image slot received that VA |
| Callsite | `0x00859757` `call eax` |
| Return RVA | `0x00859759` |

Arguments, stdcall, at entry:

| Argument | Value |
| --- | --- |
| `lpFileName` | `0x00C59507` (`\\.\SICE`) |
| `dwDesiredAccess` | `0xC0000000` (`GENERIC_READ` \| `GENERIC_WRITE`) |
| `dwShareMode` | `3` |
| `lpSecurityAttributes` | `0` |
| `dwCreationDisposition` | `3` (`OPEN_EXISTING`) |
| `dwFlagsAndAttributes` | `0x80` (`FILE_ATTRIBUTE_NORMAL`) |
| `hTemplateFile` | `0` |

The bytes immediately after the call are a call/pop/add/ret gadget. Following only those unconditional transfers, the `ret` chain lands on `0x00859779`.

## Return test

```text
0x00859779  inc eax
0x0085977A  jne 0x00859A61
```

`CreateFileA` returns the handle in EAX. `inc eax` sets ZF exactly when EAX was `0xFFFFFFFF` (`INVALID_HANDLE_VALUE`).

| Handle | Flags | Edge | Target |
| --- | --- | --- | --- |
| open failed, device absent | ZF = 1 | fall through | `0x00859780` |
| open succeeded, device present | ZF = 0 | `jne` | `0x00859A61` |

`0x00859780` is the same gadget shape and lands on `0x0085979F`. `0x00859A61` is `mov ebx, eax` / `dec ebx`, which puts the original handle in EBX.

No `CloseHandle` is in either immediate edge.

## What each edge does next

Device absent, fall through `0x00859780`. The address span from that edge up to but not including `0x00859A61` contains:

- `lea ebx` of `\\.\SIWVID` at `0x00859882`
- `lea ebx` of `\\.\NTICE` at `0x008599BF`

Those are the same load shape as the SICE string. This edge is additional device probes. It does not, in the instructions at the landing, call `MessageBox` or write an exit code.

Device present, `0x00859A61`. The handle is restored into EBX. `0x00859A8A` writes `'C'` to the walker's first-character slot `0x0081A361`. The immediate edge does not call the resolved `MessageBoxExA` and does not show a terminate. What the `'C'` resolution would call is not identified. Classification of this edge: unknown past the handle save. It is still protector code inside Tail B.

Neither edge was executed.
