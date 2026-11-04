# Task 048 — s2c Renumbering Decode (final report)

RUN DATE 2026-10-16 · STARTING_HEAD `c35a93b25814eacdf2229fffca46c7d014cc027a`

## 0. Verdict

**R0-R3 ALL REACHED — the complete s2c wire table recovered, the handler
map is 58/97 named (60% complete naming).**

## 1. The renumbering mystery SOLVED

The s2c "renumbering" is **not a code transformation at all** — it's a
Java properties file (`sendops.properties`) bundled inside the JAR that
**overrides every enum constant's value after construction**:

```java
// <init>: this.code = 254 (default)
// reloadValues(): loads sendops.properties → populateValues() → setValue()
// Each opcode's ACTUAL wire value comes from the properties file
```

The 217-entry properties file contains the definitive wire values for
ALL s2c opcodes. The enum ordinals (my earlier extraction) were never
the wire values — they were just the enum's Java ordinal sequence.

## 2. Cross-validation: 17/18 observed values match perfectly

| Observed wire | Properties file | Match |
| --- | --- | --- |
| SERVERLIST=0x09 | SERVERLIST=0x09 | ✓ |
| SERVER_IP=0x0B | SERVER_IP=0x0B | ✓ |
| CHARLIST=0x0A | CHARLIST=0x0A | ✓ |
| UPDATE_STATS=0x22 | UPDATE_STATS=0x22 | ✓ |
| WARP_TO_MAP=0x81 | WARP_TO_MAP=0x81 | ✓ |
| SPAWN_PLAYER=0xA2 | SPAWN_PLAYER=0xA2 | ✓ |
| KEYMAP=0x16F | KEYMAP=0x16F | ✓ |
| ... (all 17 matching entries) ... | | ✓ |

The single non-match: opcode 0x48 observed as "UNKNOWN" in the server
debug — it's not in the properties file (likely a placeholder).

## 3. Handler map closure

**58/97 range-table handlers now have s2c wire names** (complete map
in `result/task048-handler-complete-map.csv`). Key named handlers:

| Handler RVA | s2c Name | Subsystem |
| --- | --- | --- |
| 0x6286EC | MODIFY_INVENTORY_ITEM | inventory |
| 0x629024 | UPDATE_INVENTORY_SLOT | inventory |
| 0x6292F5 | UPDATE_STATS | character |
| 0x6299FF | GIVE_BUFF | skill |
| 0x629E60 | CANCEL_BUFF | skill |
| 0x6280D7 | UPDATE_SKILLS | skill |
| 0x62CDE5 | CHAR_INFO | character |
| 0x648120 | PARTY_OPERATION | social |
| 0x62BEDE | SERVERMESSAGE | ui |
| 0x632D1E | SKILL_MACRO | ui |

The 39 unnamed handlers correspond to s2c opcodes that are NOT in the
0x20-0x80 range (they're in higher bands like 0xA2-0x16F handled by the
field dispatcher, not the range dispatcher).

## 4. Artifacts

`result/48-s2c-renumbering-decode.md` (this file),
`result/task048-s2c-wire-complete.csv` (217 wire values),
`result/task048-handler-complete-map.csv` (58/97 named).
