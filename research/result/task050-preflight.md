# Task 050 Preflight

## Corpus
| Item | Path | Identity |
| --- | --- | --- |
| MapleStory.exe | .work/task-001/extracted/冒险岛online/ | SHA-256 5d280cf1… (canonical, unchanged) |
| Game image | .work/task-036/game-image-unpacked.bin | 10,330,112 bytes; materialized memory @ base 0x400000 |
| Semantic DB | .work/task-050/db/ | function-summary, field-facts, callgraph, state-writes |

## Tools
| Tool | Version |
| --- | --- |
| Python | 3.14 |
| capstone | 5.0.7 |
| pycryptodome | installed |

## Baseline (§10 strict)
See result/task050-baseline.csv for the audited baseline after CWvsContext demotion.
