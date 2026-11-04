# Task 040 — Session 3 checkpoint (band tables + live opcode enumeration)

RUN DATE 2026-10-15 · corpus: the Task-036 capture + the local live
server (loopback). Static + the 033-method live enumeration.

## Delivered (S3)

### 1. Band tables (corrected RVAs)

- **WARP band (0x81-0x83) @ 0x37E6F3**: 0x81→0x37E72F, 0x82→0x37FC9E,
  0x83→0x37F209. The 0x81 handler: ReadInt32 → CWvsContext+0x205C
  (CharacterId), change → +0x2F60 flag; ReadByte → +0x2080; then a
  counted loop of ReadString entries — the WARP_TO_MAP parse.
- **KEYMAP band (0x16F-0x171) @ 0x1B9F14**: 0x16F→0x1B9E4F,
  0x170→0x1B9EC8, 0x171→0x1B9EEE; adjacent 0x1B9F47 = an 89×5-byte
  keymap walker (type-4 filter + 4-way dispatch via [0xAFE2C8]).
- **RANGE dispatcher @ 0x610CE0**: jump table (97 slots, 0x20-0x80) —
  **92 handlers extracted** (`.work/task-040/s3-range-table.csv`).
- Reader primitives: 0x4066FF=ReadInt32, 0x4066C9=ReadByte,
  0x4259A2=ReadInt16, 0x471D7A=ReadString.

### 2. Live opcode enumeration (Phase 1) — the server names its tables

Blind-probed c2s 0x14-0x9F on the channel socket (dispatch-debug
naming): **137 c2s channel-zone opcodes** →
`result/task040-channel-opcodes.csv` (CHANGE_MAP=0x21,
ENTER_CASH_SHOP=0x23, CLOSE_RANGE_ATTACK=0x28, NPC_TALK=0x36,
ITEM_MOVE=0x44, DISTRIBUTE_AP=0x54, PARTY_OPERATION=0x78, …).

### 3. s2c observed + THE THREE-WAY VALIDATION

18 s2c values observed (`result/task040-s2c-observed.csv`), correcting
the 033-era labels — and each correction clicks with the decoded code:

| s2c | server name | old guess | code-side confirmation |
| --- | --- | --- | --- |
| 0x81 | **WARP_TO_MAP** | CHARINFO | handler reads CharacterId → +0x205C (warp sets it) |
| 0xA2 | **SPAWN_PLAYER** | INVENTORY | handler compares +0x2084 ("is it me?") |
| 0x16F | **KEYMAP** | SKILLS | the 89×5B walker (≈90-key keymap) |
| 0x41 | SERVERMESSAGE | ✓ | — |

Three independent sources (live protocol, in-image dispatch, decoded
handler semantics) now agree — the naming ledger is validated.

## Next (S4)

AES closure (0x658-0x659 cluster) + the COutPacket builder family
(the c2s table above now names the builders' opcodes).

## Artifacts

`result/task040-channel-opcodes.csv`, `result/task040-s2c-observed.csv`,
`.work/task-040/s3-range-table.csv`, this checkpoint.
