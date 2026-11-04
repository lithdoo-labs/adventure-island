# Subsystem Dossier: Skill / Buff

## Dispatch coverage
- UPDATE_SKILLS 0x27 (12 reads, loop), SKILL_USE_RESULT 0x28, CANCEL_BUFF 0x24
- Foreign-effect 0xD0: 27-mode sub-dispatch JT@0x53F052 (three-layer decode)

## Wire schemas
- buff entries stride-0x0C (raw, computed) pairs; codec 0x3848B7 apply / 0x38453C reset
- SKILL_MACRO 0x80: [i32 x3] -> avatar +0x2860/64/68 macro slots

## Resource links
Skill/ItemSkill.img referenced (1 function)

## State machines
SM05 buff lifecycle (SPECIAL_MOVE->GIVE_BUFF->CANCEL_BUFF), SM11 skill batch

## Open questions
- per-buff source-skill decode of the 0x0C-stride computed half: deeper register-level dataflow on existing corpus
- cooldown timer values: needs post-login capture: values only observable at runtime (see blockers)
