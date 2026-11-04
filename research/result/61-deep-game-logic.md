# Task 061 Final Report — Deep Game Logic Extraction

## Verdict: **Success** — Game formulas + handler documentation + knowledge graph

## Phase A: Game Formulas ✅

### Damage Formula (most important discovery)
```
最大伤害 = (主属性 × 5.0 + 副属性) × 武器攻击力 ÷ 100
```

| 武器类型 | 主属性 | 副属性 |
|---|---|---|
| 弓/弩 | DEX | STR |
| 爪/短剑(盗贼) | LUK | DEX + STR |
| 法杖/魔杖 | INT | LUK |
| 剑/斧/锤(战士) | STR | DEX |

### Damage Cap
```
伤害上限 = 199,999 + VIP等级 × 1,000,000
```

### MP Growth
```
MaxMP += INT ÷ 10 (每10点INT+1MP)
```

### Formula Candidates
202 additional formula-bearing functions identified for future analysis.

## Phase B: Handler Pseudo-Code ✅

19 top handlers documented with:
- Wire schema (field types in order)
- Client handler RVA
- **Decompiled C code** (with symbol substitution)
- Server Java cross-reference

Key handlers documented: WARP_TO_MAP, SPAWN_PLAYER, CHATTEXT,
UPDATE_STATS, MODIFY_INVENTORY, TEMP_STATS, KEYMAP, BUDDYLIST,
PARTY_OPERATION, GUILD_OPERATION, CHAR_CASH, etc.

## Phase C: Knowledge Graph ✅

88 cross-layer edges connecting:
- opcode → handler RVA
- handler → called functions
- handler → data references

This is queryable: "what does WARP_TO_MAP touch?" → handler → all callees + data refs

## Artifacts
- result/task061-game-formulas.md (damage formula + constants)
- result/task061-formula-candidates.csv (202 candidates)
- result/task061-handler-reference.md (17KB, 19 handlers with C code)
- result/task061-knowledge-graph.csv (88 edges)
