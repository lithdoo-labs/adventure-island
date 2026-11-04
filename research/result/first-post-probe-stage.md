# First stage after the device probes

| Field | Value |
| --- | --- |
| Boundary RVA | `0x0085A464` |
| Previous stage | NTICE miss at `0x0085A00B`, then the jump to `0x0085A36E` |
| Next stage | command-line switch parser at `0x0085A5D9`, then the second decoder, then driver setup at `0x0085FCC0` |
| Why it is not a probe | It is an in-place dword rewrite. It does not open a device or a registry key. |
| Confidence | high |

The write instruction is `pop dword ptr [ebx+esi]` at `0x0085A4C2`. Destination RVA `0x0085A530`–`0x00860293`, length `0x5D64`. The bytes were already inside the captured Tail B window. The transform is fully determined by the loop, and the output is readable switch text (`/getwlstatus`, `/checkprotection`, `/bugcheck`).

The no-switch path then runs a second in-place decoder at `0x0085AA35`. That output contains an `MZ`/`LE` image at `0x0085B405` and the Oreans driver strings (`oreans32.sys`, `SecureEngine`, `OpenSCManagerA`, `CreateServiceA`). A one-dword patch at `0x0085B401` turns the following `jmp` into `jmp 0x0085EBD5`, which jumps to `0x0085FCC0`. That entry was opened only far enough to see the next gadget. It was not fully walked.

This is the post-probe boundary. It is still protector code. Tail A, the three Ztl slots, WZ, the AES key, the IV table, Winsock, and RTTI are not in either decoded span.

The precise blocker past this boundary is the still-obfuscated driver-install body at `0x0085FCC0`, plus `\\.\oreans32` at `0x0085ECB8` whose callsite is unresolved.
