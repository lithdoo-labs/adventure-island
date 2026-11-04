# Task 048 — s2c Renumbering Decode Campaign

## Objective

Task 047 discovered the s2c renumbering layer (logical values ≠ wire
values, irregular deltas). This campaign decodes the mapping from the
server JAR's packet-construction code:

```
1. Locate the renumbering code: the MaplePacketLittleEndianWriter
   or the packet-creation wrapper that transforms logical → wire
2. Extract the complete lookup table or transformation function
3. Apply to all 116 logical s2c names → the complete wire table
4. Map wire values onto the client's 97 range-table handlers
5. Produce the complete handler semantic closure
```

## Milestones
- **R0** renumbering code located in the JAR
- **R1** complete mapping table extracted
- **R2** full s2c wire table (116 entries)
- **R3** handler map closure (wire name × handler RVA)

## Corpus
Server JAR: `.work/task-002/server/079V5/dist/江浩079.jar`

## Restrictions (inherited)
Static analysis only; nothing binary committed.
