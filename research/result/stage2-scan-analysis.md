# Stage-2 scan

The T2 block was rebuilt with the Task 006 emulator (`--seh-slot`, budget 16,000,000) into `.work/task-007/`. The slice at RVA `0x00819014` for `0xF8B11` bytes still hashes to `5529577eec208295e36d61dc11aee42ebe45f7ffb511691f5679676b2330c865`. MapleStory.exe is still `5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d`.

Stage-2 entry is the `jmp` at `0x00819014` (`E9 AC 36 00 00`) to `0x0081C6C5`. Nothing in this path was patched.

## Reachable control flow

`scripts/maple079_stage2_scan.py` walks the post-decrypt block and writes `result/stage2-scan-cfg.csv` (692 instructions). Overlapping junk that the gadgets skip is not listed. The live blocks are:

| RVA | Role |
| --- | --- |
| `0x0081C6C5` | Entry. `call/pop` sets EBP, saves the incoming ESP/ESI/EBP, and returns immediately if a flag dword is already set. |
| `0x0081C6FD` | Two discarded mixing calls, then `jmp 0x0081CB10`. |
| `0x0081CB10` | Subtract 1 from each of the next `0x7000` bytes. The saved block is the result of that pass. |
| `0x0081CB21` | Install an SEH frame whose handler is `0x0081CC90`, then a call/pop/ret gadget lands at `0x0081CB6F`. |
| `0x0081CB6F` | Both the `je` and the following `jmp` go to `0x0081CB8B`. The `jg` and its fallthrough both reach `0x0081CB94`. |
| `0x0081CB94` | `and eax, 0xFFFFF000`. The three conditional jumps that follow all land at `0x0081CBAF`. |
| `0x0081CBB3` | Host walk. Step `0x1000`, accept `MZ` plus `PE\0\0`. No iteration cap; a fault uses the handler at `0x0081CC90`. |
| `0x0081CBD0` | Remove that frame and install the handler at `0x0081CCA3`. Read the host import directory. |
| `0x0081CC1F` | Align ESI down to 64 KB. If that value is `<= 0x80000000`, fall into the scan. |
| `0x0081CC60` | Scan. Cap `0x32`, step `0x10000`, accept `MZ` plus `PE\0\0`. |
| `0x0081CC84` | Failure: pop the SEH frame, `popal`, `ret`. |
| `0x0081CCC6` | Found path. |

The gadget at `0x0081CB46` is the usual overlap sequence: `call` the next byte, `pop`, rewrite `[esp+4]`, `inc`, `push`, `ret`, then a one-byte `pop` / `ret`. Its computed landing is `0x0081CB6F`. The same shape at `0x0081CCD6` lands at `0x0081CCF0`.

## What the scan is

There are two walks. The first finds the PE that contains the executing code (MapleStory at `0x00400000`). The second, at `0x0081CC60`, is the one Task 006 stopped in. It is not searching MapleStory again. It searches backward from the resolved `kernel32!GetLocalTime` import. Provenance is in `result/stage2-register-provenance.md`.
