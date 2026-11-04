# Task 050 S10 Sample #3: WARP_TO_MAP Full Semantic Reconstruction

Handler @ **0x37E72F** (range-table slot, known since Task 049; body first fully decoded here).

## Wire schema (evidence: reader calls 0x37E759-0x37E86A)

```
WARP_TO_MAP:
  charid   : i32     # -> CWvsContext+0x205C (0x37E759); compared vs old -> +0x2F60 flag
  grade    : u8      # -> CWvsContext+0x2080 (0x37E766)
  A        : u8      # 0x37E78A -> local (channel)
  B        : u8      # 0x37E794 -> local (gates tail section)
  count    : i16     # 0x37E7A1 -> [ebp-0x2C]
  if count > 0:
    first  : string  # 0x37E7D5
    loop count times: string  # 0x37E806-0x37E842 (appended into second buffer)
  if B != 0:
    v1,v2,v3 : i32 ×3   # 0x37E856-0x37E86A
    -> CWvsContext+0x31F4 container add (0x7940F0)
    -> CWvsContext+0x32F8 container add (0x74120F)
    + further decode (0x4F50CA) and singleton 0xBDEB28 state dispatch
  str -> CWvsContext+0x2F44  (reset to default string from res 0xBDD7E4)
```

## Reconstructed source (evidence-annotated)

```cpp
void CWvsContext::OnWarpToMap(CInPacket& pkt) {                  // 0x37E72F
    int oldId = this->[0x205C];
    this->[0x205C] = pkt.ReadInt32();       // character id        (0x37E759)
    this->[0x2080] = pkt.ReadByte();        // grade byte          (0x37E766)
    if (oldId != this->[0x205C])
        this->[0x2F60] = 1;                 // char-changed flag   (0x37E77E)

    uint8 channel = pkt.ReadByte();         // 0x37E78A
    uint8 hasTail = pkt.ReadByte();         // 0x37E794
    int   count   = pkt.ReadInt16();        // 0x37E7A1

    ZString s1; ZString s2;                 // [ebp-0x44], [ebp-0x4C]
    if (count > 0) {
        s1 = pkt.ReadString();              // 0x37E7D5
        for (int i = 0; i < count; i++)
            s2.Append(pkt.ReadString());    // 0x37E806 loop (dec/jne 0x37E842)
    }
    if (hasTail) {
        int v1 = pkt.ReadInt32();           // 0x37E856
        int v2 = pkt.ReadInt32();           // 0x37E860
        int v3 = pkt.ReadInt32();           // 0x37E86A
        this->[0x31F4].Add(v1, v2, v3);     // 0x7940F0
        this->[0x32F8].Add(v1, v2, v3);     // 0x74120F
        DecodeExtra(&local, pkt, 0);        // 0x4F50CA
        auto* s = *(void**)0xBDEB28;        // new singleton (state 2 / ptr +8)
        if (s) {
            if (s->[0] == 2)      Fn7DAE4C();
            if (s->[8] != 0)      Fn7DADB8();
        }
    }
    this->[0x2F44] = DefaultString(0xBDD7E4);  // reset (0x37E8E3 assign)
}
```

## Proven facts this pass

| fact | evidence | confidence |
|---|---|---|
| WARP schema head = i32,u8,u8,u8,i16 | ordered reads 0x37E759-0x37E7A1 | confirmed |
| count-driven string append loop | dec/jne at 0x37E83F-0x37E842 | confirmed |
| CWvsContext +0x31F4 / +0x32F8 = parallel containers fed by 3×i32 | 0x37E87F / 0x37E893 | high |
| CWvsContext +0x2F44 = string (reset to default on warp) | 0x37E8E3 assign from res 0xBDD7E4 | high |
| singleton 0xBDEB28: +0 state (==2 branch), +8 ptr gate | 0x37E8AA-0x37E8C9 | medium |
| 0x4F50CA = tail decoder taking (pkt, flag) | 0x37E8A5 | medium |
| mapId NOT in this packet's head (absent from first 5 fields) | read sequence | confirmed |

