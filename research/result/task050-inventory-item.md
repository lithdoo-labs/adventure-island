# Subsystem Dossier: Inventory / Item

## Dispatch coverage
MODIFY_INVENTORY_ITEM 0x20 (5-mode op loop), inventory family 0x20-0x23

## Object model
- CItem polymorphic family (factory 0xF2B2F, shared ctor 0xF8AF6):
  Equip type1 0xF9 / Use type2 0x4D / Setup type3 0x79 / Type100 0x72
- equality fields +0x18/+0x1C/+0x20/+0x24; decode via vtable+0x70

## Wire schemas
[flag u8][op_count u8]{ [mode u8][slot u8][arg i16] mode-payload } (sample #5)

## Open questions
- per-equip stat-slot mapping inside the 0xF9 object: deeper register-level dataflow on existing corpus
  (needs the type-1 decode walk)
- item expiration semantics: needs post-login capture: values only observable at runtime (see blockers)
