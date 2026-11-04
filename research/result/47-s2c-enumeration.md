# Task 047 — s2c Enumeration & Handler Closure (final report)

RUN DATE 2026-10-16 · STARTING_HEAD `46d1e08426dbbad4124a6bd312253a20ef8754a8`
· corpus: server JAR + local loopback server + Task-036 client image.

## 0. Verdict

**Stop B — the s2c renumbering layer is a newly discovered architectural
boundary.** 18 wire values captured; the complete 116-name logical table
extracted; the mapping between them requires the renumbering decode.

## 1. The renumbering discovery (the campaign's headline)

The server JAR's `SendPacketOpcode` enum has **logical values** (e.g.
SERVERLIST=0x0004, WARP_TO_MAP=0x0015) that DO NOT match the **wire
values** the server actually sends (SERVERLIST=0x0009,
WARP_TO_MAP=0x0081). This renumbering applies to BOTH directions
(c2s renumbered per Task 033, s2c per this task).

| Packet | Logical (JAR enum) | Wire (observed) | Delta |
| --- | --- | --- | --- |
| SERVERLIST | 0x0004 | 0x0009 | +5 |
| SERVER_IP | 0x0006 | 0x000B | +5 |
| CHARLIST | 0x0007 | 0x000A | +3 |
| UPDATE_STATS | 0x0012 | 0x0022 | +16 |
| WARP_TO_MAP | 0x0015 | 0x0081 | +108 |
| SPAWN_PLAYER | 0x0023 | 0x00A2 | +127 |
| SERVERMESSAGE | 0x0016 | 0x0041 | +43 |
| KEYMAP | 0x0044 | 0x016F | +299 |

The deltas are irregular — this is a **custom lookup table**, not a
simple offset. The renumbering is implemented in the server's packet
construction layer (not in the enum itself, since the enum's `setValue`
is never called from outside).

## 2. What WAS recovered

- **Complete logical s2c table**: 116 names + values from the JAR
  (`result/task047-s2c-opcodes.csv`)
- **18 wire values with confirmed names** from live observation
  (`result/task047-s2c-wire-full.csv`)
- **New wire value**: PARTY_OPERATION = 0x003B (from the DISTRIBUTE_SP
  probe's response)
- **CHANGE_KEYMAP causes server disconnect** — the server validates
  keymap data and disconnects on invalid input

## 3. The path to the complete mapping

The renumbering decode requires finding the packet-construction
method in the server JAR that maps logical → wire values. This is in
the `MaplePacketLittleEndianWriter.writeShort()` path or a wrapper.
The next session should:
1. Disassemble `MaplePacketLittleEndianWriter` from the JAR
2. Find the opcode transformation (lookup table or function)
3. Apply to all 116 names → the complete wire table

## 4. Artifacts

`result/47-s2c-enumeration.md` (this file),
`result/task047-s2c-opcodes.csv` (116 logical),
`result/task047-s2c-wire-full.csv` (18 wire-confirmed).
