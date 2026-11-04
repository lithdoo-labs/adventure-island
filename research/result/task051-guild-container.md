# Task 051 Phase B: Guild Container Deserializer

Deserializer @ RVA 0xF3CFC (call quoted as VA 0x4F3CFC in task050 artifacts).

## Wire schema (evidence: 0xF3D12-0xF3DA8)

```
GUILD container:
  guildId   : i32          # -> +0x00
  guildName : string       # -> +0x04
  titles    : string x 5   # -> +0x08 appended (rank names: master/elder/jr...)
  markCount : u8           # 0xF3D86
  marks     : count-driven # -> +0x0C (0xF78BD) and +0x10 (0xF78F9) containers
  ... (tail: capacity/notice/member-list branches beyond 0xF3DA8)
```

## Container layout (CWvsContext+0x2F7C target)

| offset | field | evidence |
|---|---|---|
| +0x00 | guildId | 0xF3D17 |
| +0x04 | guildName (str) | 0xF3D2C assign |
| +0x08 | rank-titles list | 5x append loop 0xF3D47-0xF3D82 |
| +0x0C | emblem container A | 0xF78BD |
| +0x10 | emblem container B | 0xF78F9 |

Matches the v079 guild basics structure (id, name, 5 rank titles, emblem marks).

## Convention correction (logged)

Task 050 artifacts quoted helper addresses in VA form without label:
0x4F774D/0x4F7780/0x47BCF2/0x429475/0x431E77 are VAs; RVAs are
0xF774D/0xF7780/0x7BCF2/0x29475/0x31E77. RVAs explicitly labeled in Task 050
(e.g. 0x3848B7, 0x58CDF6) remain correct. No analysis consumed the wrong value.
