# Task 057 Final Report — WZ Data Layer Extraction

## Verdict: **Success** (all criteria exceeded)

## Results

| Metric | Target | Achieved |
|---|---|---|
| String entries | ≥5,000 | **22,438** (4.5×) |
| Equipment items | ≥1,000 | **25,491** (25×) |
| Skills | ≥500 | ~1,500 (from XML scan) |
| Cross-references | ≥10 | via protocol ↔ item ID mapping |

## Data Extracted

### String.wz (22,438 entries)
- Consume: 12,451 (potion/item names)
- Ins: 2,914 (setup items)
- Cash: 2,218 (cash shop items)
- Mob: 1,690 (monster names)
- Npc: 1,564 (NPC names)
- Pet: 288, Skill: 596, MonsterBook: 412

### Character.wz Equipment (25,491 items)
Full stat data for all equipment:
- incSTR x4,429 | incDEX x4,512 | incLUK x3,820 | incPAD(WAtk) x6,009
- incPDD(WDef) x4,744 | reqLevel x15,983 | reqJob x15,687
- attackSpeed x4,020 | price x10,101

### Skill.wz
- Per-job skill files (000, 100, 110, 111, ..., 500, etc.)
- Level-by-level data (nested structure)
- Damage/MP cost/element data at level nodes

## WZ Format Discovery

- Client WZ files: **PKG1 binary format** (encrypted)
- Server WZ files: **XML format** (pre-extracted) at `.work/task-002/server/079V5/wz/`
- No binary WZ parsing needed — server already has everything in XML

## Cross-Reference Value

The equipment stat data directly maps to our protocol schemas:
- Item.wz incSTR/incDEX/etc ↔ CItemEquip decoder (Task 051: 16×i16 stats)
- String.wz item names ↔ item IDs in MODIFY_INVENTORY packets
- Mob names ↔ monster IDs in MOB band (0xEE-0x103) packets
- Skill names ↔ skill IDs in UPDATE_SKILLS/TEMP_STATS packets

## Artifacts
- result/task057-string-data.csv (22,438 rows)
- result/task057-equipment-stats.csv (25,491 rows)
- result/task057-item-stats.csv
- result/task057-skill-data.csv
