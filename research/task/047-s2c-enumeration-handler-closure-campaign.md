# Task 047 — Server-Side s2c Enumeration & Client Handler Semantic Closure

## Objective

Task 046 identified the missing s2c opcode names as the dominant gap
(only 18 observed live vs ~97 handler slots). The server JAR's
MaplePacketCreator methods produce every s2c packet — extracting the
opcode from each builder method gives the complete s2c table, which
then feeds back to name the client's 97+ handlers.

```
1. Extract ALL s2c opcode values + names from the server JAR's
   SendPacketOpcode enum + MaplePacketCreator methods
2. Map every s2c value onto the client's dispatch tables
   (range table 97 handlers + field dispatcher bands + phase handlers)
3. Produce the complete handler semantic map: opcode → name → handler
   → packet reads → subsystem
4. Re-run the subsystem classification with the complete table
```

## Milestones

- **S0** complete s2c table from the JAR (SendPacketOpcode values + builder names)
- **S1** full handler map (s2c name × client handler RVA × semantics)
- **S2** subsystem classification re-run with complete data
- **S3** updated coverage ledger + integration

## Corpus
- Server JAR: `.work/task-002/server/079V5/dist/江浩079.jar`
- Client image: `.work/task-036/game-image-unpacked.bin`
- Existing indexes: `.work/task-046/index/`

## Restrictions (inherited)
Static analysis; nothing binary committed; two-evidence naming.
