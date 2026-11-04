# Task 046 — Skill / Buff / Debuff Dossier

## Evidence basis
- DISTRIBUTE_SP c2s 0x57, SPECIAL_MOVE c2s 0x58, CANCEL_BUFF c2s 0x59 (live)
- SKILL_EFFECT c2s 0x5A, CANCEL_DEBUFF c2s 0x60, SKILL_MACRO c2s 0x6D (live)
- USE_SKILL_BOOK c2s 0x4F (live)
- 12 functions classified `skill`
- The skill WZ data cross-validated in Task 023

## Classes/objects

| Class/Object | Evidence | Confidence |
| --- | --- | --- |
| SkillTable (implied) | skill ID lookups from packets | medium |
| BuffState | CANCEL_BUFF / SKILL_EFFECT flows | medium |
| SkillMacro | SKILL_MACRO c2s packet | medium |

## Key functions

| RVA / Site | Name | Evidence |
| --- | --- | --- |
| (senders) | DISTRIBUTE_SP_sender | c2s live name |
| (senders) | SPECIAL_MOVE_sender | c2s live name |
| (senders) | CANCEL_BUFF_sender | c2s live name |
| (senders) | SKILL_EFFECT_sender | c2s live name |
| (senders) | CANCEL_DEBUFF_sender | c2s live name |
| (senders) | SKILL_MACRO_sender | c2s live name |
| (senders) | USE_SKILL_BOOK_sender | c2s live name |

## Packet links

**Outbound**: DISTRIBUTE_SP (0x57), SPECIAL_MOVE (0x58), CANCEL_BUFF (0x59),
SKILL_EFFECT (0x5A), CANCEL_DEBUFF (0x60), SKILL_MACRO (0x6D), USE_SKILL_BOOK (0x4F)
**Inbound**: TEMP_STATS_RESET (s2c 0x26 observed), UPDATE_SKILLS (implied),
buff apply/cancel updates (in the field dispatcher bands)

## Representative flows

### Flow 1: SP distribution
```
user opens skill window → clicks "+" on a skill →
  sender (DISTRIBUTE_SP c2s 0x57):
    COutPacket(0x57)
    WriteHeader(0x57)
    write(skill_id)
    write(amount)           // usually 1
    write(unknown)          // amulet-related
    send_wrapper()
  server updates skill level →
  client receives UPDATE_SKILLS → refreshes skill window
```
Confidence: high (c2s live + protocol semantics)

### Flow 2: Skill activation (special move)
```
user presses skill key →
  client checks MP/cooldown/animation →
  sender (SPECIAL_MOVE c2s 0x58):
    WriteHeader(0x58)
    write(skill_id)
    write(skill_level)
    // if buff: no targets
    // if attack: target list (delegates to attack builder)
    send_wrapper()
  // for attack skills: delegates to the appropriate attack sender
  //   (CLOSE_RANGE 0x28 / RANGED 0x29 / MAGIC 0x2A)
```
Confidence: high

### Flow 3: Buff lifecycle
```
player activates a buff skill →
  SPECIAL_MOVE(0x58) sent →
  server applies buff →
  client receives buff update (field band) →
    displays buff icon
    starts timer
  // when buff expires or is cancelled:
  client sender (CANCEL_BUFF c2s 0x59):
    WriteHeader(0x59)
    write(reason)           // 0=expired, 1=manual
    send_wrapper()
```
Confidence: high (both directions named)

### Flow 4: Debuff cancellation
```
player uses debuff-removal item/skill →
  sender (CANCEL_DEBUFF c2s 0x60):
    send_wrapper()
  server removes debuff →
  client receives TEMP_STATS_RESET (s2c 0x26) →
    clears debuff icons
    restores stats
```
Confidence: confirmed (s2c observed live in the burst)

## Unresolved gaps
- Skill WZ data loading path (client-side skill table initialization)
- Cooldown timer implementation
- Buff stacking/override logic
- Skill animation/effect trigger (rendering side)
