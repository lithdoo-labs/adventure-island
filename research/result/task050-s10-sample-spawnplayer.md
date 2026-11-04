# Task 050 S10 Sample #2: SPAWN_PLAYER (s2c 0xA2) Full Semantic Reconstruction

Handler chain: band 0x57F64C → 0x57F6C0 (leaf). Decode core: `decodeAvatar` @ **0x58CDF6**.
Constructor: **0x98CC52 = CUserRemote::ctor** (object size **0x3500**).

## Wire schema (evidence: reader calls @0x57F6C0 + 0x58CDF6 + 0x58CFF2+)

```
SPAWN_PLAYER (0xA2):
  id            : int32     # 0x57F6D4; is-it-me vs CWvsContext+0x2084; already-spawned check
  -- decodeAvatar(0x58CDF6) --
  a_28B8        : u8        # 0x58CE1D  (level)
  f_F30         : string    # 0x58CE2E  (primary display name — see CHATTEXT filter use)
  f_F34         : string    # 0x58CE5E
  f_F38         : i16       # 0x58CE8D
  f_F3A         : u8        # 0x58CE9B
  f_F3C         : i16       # 0x58CEA8
  f_F3E         : u8        # 0x58CEB6
  buffs         : container # 0x78FABE deserializes into this+0x28BC
  f_34FC        : i16       # 0x58CED5 (job / rank hint)
  look_iterator : vtable 0xAFEB88 (0x4F69B0) — equip-slot decode driver
  v1            : int32     # 0x58CF26 (hair)
  v2            : int32     # 0x58CF30 (face)
  f_2828        : string    # 0x58CF3E
  f_282C        : string    # 0x58CF6E
  f_2830        : i16       # 0x58CF9A
  f_2832        : i16       # 0x58CFA8
  f_34DC        : int32     # 0x58CFB6 -> transformed by 0x965A8F into this+0xF04
  pos_x         : i16 (sx)  # 0x58CFD0 movsx
  pos_y         : i16 (sx)  # 0x58CFDD movsx
  f_3C0         : u8        # 0x58CFEA (stance)
  ... (decode continues past 0x58CFF2)
```

## Reconstructed source (evidence-annotated)

```cpp
void FieldDispatcher::OnSpawnPlayer(CInPacket& pkt) {              // 0x57F6C0
    int id = pkt.ReadInt32();                                      // 0x57F6D4
    CWvsContext* ctx = *(CWvsContext**)0xBD9028;
    if (id == ctx->[0x2084]) return;          // own spawn handled elsewhere
    if (this->FindObject(&id, this->[+0xC], 0) != 0) return;        // 0x980E40 already present
    if (ctx->[0x2FE8] != 0) return;            // spawn gate (confirmed earlier)

    AvatarDesc* desc = PoolAlloc(0xBE1DE0, 0x1C);                  // 0x57F716
    CUserRemote* user = PoolAlloc(0xBE1DE0, 0x3500);               // 0x57F744
    CUserRemote::ctor(user, id);                                   // 0x98CC52
    desc->Attach(user);                                            // 0x980A3A
    user->[0x14] = this->GetAvatarLayer(+0x24).Add(name);          // 0x98107B + 0x980CD3
    this->[+0xC].Register(&id, user);                              // 0x980E94  (object map)
    user->[0x18] = this->GetFieldList(+0x54).Add(user);            // 0x98138F + 0x980D0C
    ZString tag = ctx->LookupTag(id, 1);                           // 0xA4984C
    user->GetAvatarPart(+0x10)->decodeAvatar(pkt, tag);            // 0x98CDF6
    CField* fld = GetFieldSingleton();                             // 0x4376F2
    ... // insertion into field render lists
}

void CUserRemote::decodeAvatar(CInPacket& pkt, ZString tag) {      // 0x58CDF6
    this->[0x3B8] = tag;                                           // 0x58CE17
    this->[0x28B8] = pkt.ReadByte();                               // level
    this->[0xF30] = pkt.ReadString();                              // display name
    this->[0xF34] = pkt.ReadString();
    this->[0xF38] = pkt.ReadInt16();
    this->[0xF3A] = pkt.ReadByte();
    this->[0xF3C] = pkt.ReadInt16();
    this->[0xF3E] = pkt.ReadByte();
    this->[0x28BC].Deserialize(pkt);                               // 0x78FABE: buff container
    this->[0x34FC] = pkt.ReadInt16();
    LookIterator it(vt 0xAFEB88); it.Init(pkt);                    // 0x4F69B0
    hair = pkt.ReadInt32(); face = pkt.ReadInt32();
    this->[0x2828] = pkt.ReadString();
    this->[0x282C] = pkt.ReadString();
    this->[0x2830] = pkt.ReadInt16();
    this->[0x2832] = pkt.ReadInt16();
    this->[0x34DC] = pkt.ReadInt32();
    this->[0xF04] = Transform(0x965A8F)(that);                     // 0x58CFC2
    int px = (int16)pkt.ReadInt16();                               // position
    int py = (int16)pkt.ReadInt16();
    this->[0x3C0] = pkt.ReadByte();                                // stance
    ...
}
```

## Proven facts this pass

| fact | evidence | confidence |
|---|---|---|
| 0x98CC52 = CUserRemote ctor; size 0x3500 | alloc 0x57F744 + init call | high |
| FieldDispatcher +0xC = object map (find/register) | 0x57F6F7 find, 0x57F7A6 register | high |
| FieldDispatcher +0x24 = avatar layer container | 0x57F780-0x57F790 | high |
| FieldDispatcher +0x54 = field object list | 0x57F7B1-0x57F7BE | high |
| CUserRemote +0x3B8 = display tag param | 0x58CE17 (from 0xA4984C lookup) | medium |
| CUserRemote +0x28BC = buff container (packet-deserialized) | 0x78FABE(pkt) | high |
| CUserRemote +0x28B8 = level byte | first avatar field, v079 order | medium |
| spawn pos = two signed i16 | movsx pair 0x58CFD0/0x58CFDD | high |
| equip decode = vtable-iterator object 0xAFEB88 | 0x4F69B0 | medium |
| pool allocator @0xBE1DE0 | both allocs | high |

## CORRECTION to CHATTEXT sample (+0xF30)

In sample #1, `+0xF30` was labeled "balloon display time override". decodeAvatar proves
`+0xF30` is a **std::string** (assigned via 0x418F94 at 0x58CE38). The CHATTEXT code
`mov eax,[esi+0xF30]; test` therefore tests the string's buffer pointer (non-empty),
and `0xBE7B74` holds a default string — the call 0xA70A20(a, b) takes TWO STRINGS
(display-name override vs message), not (time, msg). Field facts updated accordingly.

## Addendum: pet handler family (band 0xAF-0xB3, hand-verified)

| opcode | leaf | wire shape | action |
|---|---|---|---|
| 0xAF | 0x30E006 | (none) | thunk -> method 0x2B8FB7 (pos sync) |
| 0xB0 | 0x30E027 | u8, u8, str | SetPetName via 0x30EE77; gated by pet+0x94 avatar +0x3B8 |
| 0xB1 | 0x30E0AC | str | assign pet+0x98 message; state via 0x30CAE6 |
| 0xB2 | 0x30E179 | u8... | pre-state 0x30D436 + byte(s) |
| 0xB3 | 0x30F607 | u8... | (same family) |

Pet selection in sub-band: ReadByte index -> CUserRemote+0x1BB4 array -> [+idx*8+4].
