# Subsystem Dossier: Map-Object Families

## Coverage
CUserRemote (17 facts), CPet (3), effect map +0x1BBC / active list +0x1BD4,
CItem family (5 classes), RandomEventProvider

## Key structures
- pet selection: ReadByte idx -> CUserRemote+0x1BB4 array -> [+idx*8+4]
- effect lifecycle: FindInMap(0x54B09A) -> deserialize(0x54B203) -> Add to +0x1BD4
- foreign-effect 0xD0 27-mode table (task050-d0-effect-modes.csv)

## Open questions
- summon-vs-mist effect discrimination byte: deeper register-level dataflow on existing corpus
- live effect ids: needs post-login capture: values only observable at runtime (see blockers)
