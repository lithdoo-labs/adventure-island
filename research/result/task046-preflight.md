# Task 046 — Preflight

## Corpus

| Item | Path | Identity |
| --- | --- | --- |
| MapleStory.exe (original) | `.work/task-001/extracted/冒险岛online/` | SHA-256 `5d280cf1…` (canonical, unchanged) |
| Recovered game image | `.work/task-036/game-image-unpacked.bin` | 10,330,112 bytes; materialized memory image @ base 0x400000; 1 page missing |
| Full memory dump | `.work/task-036/captures/t036-mem.elf` | 2.0 GiB ELF (not committed) |
| Process VA→PA map | `.work/task-036/proc-vamap.csv` | 6,896 pages |
| Image census | `.work/task-036/image-list.txt` | 84 PE images |

## Tool versions

| Tool | Version |
| --- | --- |
| Python | 3.14 |
| capstone | 5.0.7 |
| pycryptodome | (installed) |
| Custom analysis scripts | `.work/task-046/` + `.work/task-035/disasm_helper.py` |

## Baseline (from Tasks 036-045, reverified)

| Metric | Baseline |
| --- | --- |
| Range-table handlers | 97 (95 named) |
| Sender sites | 486 (178→207 named after round 2) |
| WriteHeader sites | 967 (475 with immediate opcodes) |
| Live c2s opcodes | 137 |
| Two-evidence NAMEs | ~24 |
| Subsystem-classified functions | ~504 (from Phase B+C initial run) |

## Notes

- The recovered image is a MEMORY image: RVA == file offset; all capstone-printed
  operands are VAs (must subtract 0x400000).
- The VA/RVA confusion hazard has been recorded 4 times across Tasks 040-043.
- The image has ~13 zero pages (data pages absent at capture time).
