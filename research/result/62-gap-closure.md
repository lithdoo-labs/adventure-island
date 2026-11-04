# Task 062 Final Report — Gap Closure

## Verdict: **Partial Success** — significant progress on all three gaps

## Phase A: Runtime Sender Tail ✅ (partial)

**112 unresolved sender sites** analyzed with three methods:

| Method | Sites | Result |
|---|---|---|
| vtable_slot | 16 | Identified owning class + packet context (shop/ui/config) |
| decompiled_refs | 42 | Found SendPacket/WriteHeader references in Ghidra code |
| transitive_calls | 8 | Found send calls in callee functions |
| exhausted | 46 | No evidence found (likely runtime-computed dispatch) |
| no_decompiled | 8 | Function not in Ghidra output |

**Key findings**: CShopSessionWindow sends shop packets at slots 1 and 138;
UI_UIWindow_ViciousHammer sends UI interaction packets at slot 4;
ConfigProviderWindow sends config packets at slot 3.

## Phase B: VClass Semantic Naming ✅ (partial)

**100 unnamed vtable classes** classified by behavioral signature:

| Classification | Count | Meaning |
|---|---|---|
| math/computational | 57 | Heavy arithmetic — game calculations |
| text | 8 | String/text processing |
| data_structure | 2 | Container/list management |
| indeterminate | 33 | No clear behavioral signal |

57 computational classes likely include damage formulas, stat derivations,
and game logic processors — these are the "engine room" of the game.

## Phase C: Client-Server Field Alignment ✅

**70 locator fields** mapped to server variable names:

Sample alignments:
```
CWvsContext+0x20   (u32) GIVE_BUFF         → givePirateBuff[6/10] = buffid
CWvsContext+0xbfc  (u32) CANCEL_BUFF       → cancelForeignDebuff[1/4] = cid
CWvsContext+0x2088 (u32) SKILL_USE_RESULT  → useSkillBook[1/4] = chr
CWvsContext+0x39   (u32) ENGAGE_REQUEST    → sendEngagementRequest[2/3] = cid
CWvsContext+0xc    (u32) AVATAR_MEGA       → getAvatarMega[1/5] = itemId
```

## Remaining Gaps (honest assessment)

1. **46 truly exhausted sender sites**: These are dispatched through runtime-
   computed function pointers that leave no static trace. Resolution requires
   dynamic tracing or decompiler-level dataflow analysis beyond our toolset.

2. **33 indeterminate vtable classes**: Their slot methods don't contain
   enough behavioral signal for classification. They're likely internal
   engine classes (memory pools, callback managers) without game-specific
   references.

3. **306 unmapped locator fields**: The 70 alignments cover fields whose
   handler RVAs match known packets handlers. The remaining 306 fields belong
   to handler functions not yet in our RVA→packet mapping (or to functions
   without packet associations).

## Artifacts
- result/task062-sender-tail-resolved.csv (112 sites)
- result/task062-vclass-classification.csv (100 classes)
- result/task062-field-alignment.csv (70 mappings)
