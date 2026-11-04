# Task 006 — Static Loader Dataflow

## 1. Environment

Windows 10 build 26200. Python 3.14.4. pefile 2024.8.26, Capstone 5.0.7, Unicorn 2.1.4. Ghidra, IDA, Cutter, radare2, and Binary Ninja were not used. Observation time 2026-10-09 18:17 local. No debugger was attached.

## 2. Sample Verification

`MapleStory.exe` SHA-256 is `5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d`. Image base `0x00400000`, entry RVA `0x009D8000`, `SizeOfImage` `0x009DA000`. Existing RVA conclusions still apply.

## 3. Entry Stub

The taken path never executes the `int3` at `0x009D800A`. A `call/pop` recovers that address, and three immediates compute VA `0x00D12000` (RVA `0x00912000`, the start of `tpuaozxc`). A one-shot `CC` flag then runs an in-place dword transform of `0x1000` bytes and `ret`s into the decoded stub. Detail is in `loader-entry-analysis.md`.

## 4. PE Region Map

`scripts/maple079_loader_map.py` and `result/loader-region-map.csv`. The locked RVAs:

| RVA | Raw backing | Virtual tail |
| --- | --- | --- |
| `0x002CE000` | no | yes |
| `0x005FC19F` / `0x005FC1B0` / `0x005FC1C1` | no | yes |
| `0x00819000` | yes | no |
| `0x00862E76` / `0x00862FB0` | no | yes |
| `0x00912000` | yes | no |
| `0x009D8000` | yes | no |

## 5. Address References

`result/loader-address-references.csv`. The entry forms its source address with `call/pop` plus `sub/add`, not with a bare absolute store. The decoded stub then uses absolute VAs `0x00C19014` and `0x00D12259`.

## 6. Transform Candidates

| ID | RVA | Source | Destination | Length |
| --- | --- | --- | --- | --- |
| T1 | `0x009D8046` | `0x00912000` | same, in place | `0x1000` |
| T2 | `0x0091210A` | `0x00912259`–`0x009D634A` | `0x00819014`–`0x00911B25` | output `0xF8B11` |
| T3 | `0x0081CB1B` | inside the T2 output | `0x0081CB21` for `0x7000` bytes | `dec byte` |

T2 matches the public aPLib depack bit reader, including thresholds `0x500` and `0x7D00`. That names the transform, not a commercial protector product.

## 7. Offline Emulation

Mapped at the real image base with headers and raw sections, virtual tails zero, budget 30,000,000. First write into `0x00819000`–`0x00912000` is RVA `0x00819014`. There is no write into `0x002CE000`–`0x007EA000`.

First instruction with no raw backing is RVA `0x0081C6C5`. The run stops on the generated stub's MZ/PE scan failure path (`popad; ret`), after a minimal `fs:[0]` SEH stub. The success path was not patched. `GetLocalTime` was not called. Detail is in `loader-emulation-observations.md`.

Written range SHA-256 `5529577eec208295e36d61dc11aee42ebe45f7ffb511691f5679676b2330c865`.

## 8. Materialization Map

`tpuaozxc` is packed source. `0x00819014`–`0x00911B25` is runtime-generated protector code. `0x002CE000`–`0x007EA000` stays a zero-filled tail. See `materialization-map.csv` and `materialization-hypotheses.md`.

## 9. Known Anchor Search

No hit in the T2 output or in the on-disk image for the AES key, the IV table prefix, the IV seed, `List.wz`, `.wz`, `WS2_32`, `connect`, `send`, or `recv`. `result/materialized-anchor-hits.csv`.

## 10. ZtlTaskMem Slots

Not written. Still zero. No thunk was formed. The `0x11` spacing is only the export RVA spacing.

## 11. Anti-debug RVA Mapping

`0x00862E76` and `0x00862FB0` are inside the T2 block. The bytes at those RVAs are `0F 3F` and `ED`. The emulation did not execute them. See `anti-debug-rva-materialization.md`.

## 12. Runtime Dialog Observation

PID 23452, HWND `0x50ACE`, class `#32770`, title `MapleStory`, only an OK button. Win32 and UI Automation did not return a body. Classification unknown. See `runtime-dialog-observation.md`.

## 13. High-confidence Findings

- The entry reads `tpuaozxc`, not the first section and not tail A.
- T1 decodes a 4 KB stub. T2 decompresses that section into tail B.
- Tail B as generated here is protector code.
- The two Task 003 exception RVAs are in that one generated block.

## 14. Uncertainties

- Tail A's role is still unknown because nothing wrote it.
- The Ztl slots were not filled.
- The MZ scan's success path was not followed.
- Three `55 8B EC` hits were not treated as game functions.
- The dialog body is unread.

## 15. Recommended Next Route

Route C. The first materializer is known, and it does not reveal a game or network anchor. The next stub depends on a real call stack and on an MZ/PE scan that this mapping does not satisfy. Patching that branch, or answering a debugger query, is not the next step. The next step is a reference client or a compatibility VM that can observe the process without hiding a debugger.

Route A is not available: there is no game-code region and no crypto or network anchor. Route B would fit only if the remaining regions were already explained by this loader. They are not.

## 16. Reproduction Commands

```text
python scripts/maple079_loader_map.py <MapleStory.exe> query
python scripts/maple079_loader_map.py <MapleStory.exe> regions --csv result/loader-region-map.csv
python scripts/maple079_loader_emulate.py <MapleStory.exe> --budget 30000000 --seh-slot
```

The emulator prints JSON. It does not write a PE. `--work-dir` may receive a temporary copy of the generated range; that directory is gitignored.
