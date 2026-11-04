# Task 046 — Mob / Combat Dossier

## Evidence basis
- CLOSE_RANGE_ATTACK c2s 0x28, RANGED_ATTACK c2s 0x29, MAGIC_ATTACK c2s 0x2A (all live)
- PASSIVE_ENERGY c2s 0x2B, TAKE_DAMAGE c2s 0x2C (live)
- ARAN_COMBO c2s 0x9F (live)
- 11 functions classified `combat`
- SPAWN_PLAYER handler's is-it-me check (combat-adjacent identity)

## Classes/objects

| Class/Object | Evidence | Confidence |
| --- | --- | --- |
| CMob (implied) | attack handlers read target_id from packets | medium |
| DamageResult | TAKE_DAMAGE reads damage info | medium |
| SummonObject | USE_SUMMONbag + CYGNUS_SUMMER c2s | low |

## Key functions

| RVA / Site | Name | Evidence |
| --- | --- | --- |
| (senders) | CLOSE_RANGE_ATTACK_sender | c2s live name |
| (senders) | RANGED_ATTACK_sender | c2s live name |
| (senders) | MAGIC_ATTACK_sender | c2s live name |
| (senders) | TAKE_DAMAGE_sender | c2s live name |
| (senders) | ARAN_COMBO_sender | c2s live name |

## Packet links

**Outbound**: CLOSE_RANGE_ATTACK (0x28), RANGED_ATTACK (0x29), MAGIC_ATTACK (0x2A),
PASSIVE_ENERGY (0x2B), TAKE_DAMAGE (0x2C), ARAN_COMBO (0x9F)
**Inbound**: mob damage/die updates (in the field dispatcher's bands — exact opcodes
need the s2c enumeration for the combat range)

## Representative flows

### Flow 1: Close-range attack
```
user presses attack key →
  client checks cooldown/animation →
  sender (CLOSE_RANGE_ATTACK c2s 0x28):
    COutPacket(0x28)
    WriteHeader(0x28)
    write(skill_id)        // 0 for normal attack
    write(target_count)
    for each target:
        write(mob_id)
        write(hit_x, hit_y)  // hit info
    write(attack_type)
    send_wrapper()

  server responds with damage numbers →
  client displays damage overlay
```
Confidence: high (c2s live + builder pattern + protocol semantics)

### Flow 2: Taking damage
```
mob attacks player →
  server sends damage packet →
  client handler processes damage →
  if damage > 0:
      HP -= damage
      if HP <= 0: death animation + respawn UI
  // client ALSO sends TAKE_DAMAGE (0x2C) as acknowledgment:
  sender:
    write(damage)
    write(attack_type)
    write mob_oid (obstruction/miss info)
```
Confidence: high

### Flow 3: Ranged/magic attack
```
user uses bow/staff skill →
  sender (RANGED/MAGIC_ATTACK c2s 0x29/0x2A):
    WriteHeader(0x29 or 0x2A)
    write(skill_id)
    write(charge_time)      // for charged skills
    write(target_count)
    for each target: write(mob_id, hit_info)
    write(casting_position)  // for magic position checks
```
Confidence: high

### Flow 4: Aran combo
```
player attacks (Aran class) →
  combo counter increments →
  at threshold: sender (ARAN_COMBO c2s 0x9F):
    write(combo_count)
  // server advances the combo stage
```
Confidence: medium (c2s name + Aran-specific behavior)

## Unresolved gaps
- CMob object layout and lifecycle (spawn/remove/update)
- Client-side mob HP bar update handler
- Buff-effect application to outgoing attacks
- Critical/damage calculation display
- The exact s2c opcodes for mob damage updates (need live enumeration)
