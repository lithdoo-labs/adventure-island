# Offline replay

The scan was replayed in Unicorn 2.1.4. MapleStory was mapped at `0x00400000`. SysWOW64 `kernel32.dll` was mapped at the observed base `0x76240000`. The IAT dword at RVA `0x0081802B` was set to `0x7625D430` (`kernel32 + GetLocalTime RVA 0x0001D430`), which is what the loader writes for that non-forwarded export. No scan branch was inverted, no flag was forced, and execution was not started at `0x0081CCC6`.

The T2 dump is the block after its own `dec byte` pass. Those `0x7000` bytes were incremented once in the emulator image so the pass at `0x0081CB10` could run again. EIP started at the stage-2 entry `0x0081C6C5`. This Unicorn build cannot write `DS`; the `and cl, 4` test therefore saw 0. Bit 2 of the real user selector `0x0023` is also clear, so the same fallthrough is the Windows path. `fs:[0]` was handled only for the three encodings already used in Task 006. `BeingDebugged` was not set or cleared.

## Hit

| Item | Value |
| --- | --- |
| Candidate module | `kernel32.dll` |
| Scan ESI | `0x76250000` |
| MZ tests | `0x76250000` (not a header), then `0x76240000` |
| Candidate VA | `0x76240000` |
| Found-path RVA | `0x0081CCC6` |
| Instructions to get there | 760,723 |
| Registers at that RVA, before `xchg` | EAX `1`, ESI `0x76240000`, EDI `0x762400E8`, ECX `0x7625D430`, EDX `0x00400000` |

`0x762400E8` is the kernel32 `PE\0\0` (e_lfanew `0xE8`). ECX is `GetLocalTime`. The hit is the natural `je` at `0x0081CC80`.

## After the hit

The first in-place transform finished. The run then continued 20,000 instructions and stopped while the second loop was still jumping at `0x0081D622`. Stop reason: `after-transform-loop`. Total instructions 977,412.

Writes after the hit stay on the stack and in RVA `0x00819000`–`0x00824000`. Tail A's first page stayed zero. The three Ztl slots stayed 16 zero bytes. No other module was mapped, and the found path did not need one to pass the scan.
