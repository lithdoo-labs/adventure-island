# Task 050 S10 Sample: CHATTEXT (s2c 0xA4/0xA5) Full Semantic Reconstruction

Demonstrates the source-reconstruction methodology on one complete flow.
Every statement carries its RVA evidence. Handler: `CUserRemote::OnChatText` @ **0x53D546**.

## Wire schema (evidence: reader calls in 0x57F9C1 band + 0x53D546 body)

```
CHATTEXT (0xA4 remote / 0xA5 self):
  [band header]  id        : int32   # 0x57F9D0 ReadInt32; object lookup 0x57EC5E
  [handler]      type      : u8      # 0x53D562 ReadByte  -> [ebp-0x24]
  [handler]      name      : string  # 0x53D573 ReadString
  [handler]      flag      : u8      # 0x53D57D ReadByte  -> [ebp-0x30]
  [if self=1]    extra     : string  # 0x53D59E ReadString -> [ebp-0x1c] (self display text)
```

The 0xA5 path in the band (0x57F9EB): if the speaker id resolves to no object,
the handler is invoked on `dispatcher->[+8]` = **the local player object** with
`is_self=1`; otherwise the opcode is demoted to 0xA4 with `is_self=0`.

## Reconstructed source (C++-like, evidence-annotated)

```cpp
void CUserRemote::OnChatText(CInPacket& pkt, int is_self) {   // 0x53D546
    uint8 type  = pkt.ReadByte();          // 0x53D562
    ZString name = pkt.ReadString();       // 0x53D573
    uint8 flag  = pkt.ReadByte();          // 0x53D57D

    ZString selfText;                      // [ebp-0x14]
    if (is_self) {                         // 0x53D58B cmp [ebp+0xc], ebx
        selfText = pkt.ReadString();       // 0x53D59E
        // std::string assign 0x418F94 + reserve 0x429F5A(len-0xC)
    }

    // Balloon display time: per-object override or global default
    DWORD t = this->[0xF30] ? this->[0xF30] : *(DWORD*)0xBE7B74;   // 0x53D5C5-0x53D5D5

    if (ChatFilter(name_or_msg, ...) != 0) {                       // 0x53D5E1 call 0xA70A20
        // format into 0x400 buffer (0x53D5F3 push 0x400)
        AppendChatLog(buf, 1, 0, 1, 1);                            // 0x53D601 call 0x7A6E6E
    }

    if (this->vtbl[0xC]() == 0) {          // 0x53D617: not-on-field / position check
        CField* fld = GetFieldSingleton(); // 0x53D61E call 0x4376F2
        if (fld && fld->vtbl[0x1C]() == 0x13) {          // 0x53D630 field state 19
            // Miniroom mutual-exclusion: same-room chat only
            int myRoom = this->[0x28B0];                 // 0x53D638
            if (myRoom == 2) myRoom = 0;                 // value 2 normalizes to 0
            int locRoom = (*0xBDD4A0)->[+8]->[0x28B0];   // local avatar via singleton chain
            if (locRoom == 2) locRoom = 0;
            if (myRoom != -1 && locRoom != -1 && myRoom != locRoom) {
                ZString s = FormatMessage(GetRoomContext(), name);  // 0x53D674 call 0x5552E2
                selfText = s;                            // 0x53D681 assign
            }
        }
    }
    // (display path split on is_self at 0x53D69E)
}
```

## New semantic facts proven in this pass

| fact | evidence | confidence |
|---|---|---|
| fact | evidence | confidence |
|---|---|---|
| **CORRECTED** +0xF30 = display-name string (NOT balloon time) | decodeAvatar 0x58CE38 assigns std::string; see sample #2 | confirmed |
| CUserRemote +0x28B0 = miniroom membership (2→0 normalization; -1 = none) | 0x53D638-0x53D666 two-sided compare | high |
| singleton 0xBDD4A0 → [+8] = local avatar object | 0x53D645 chain, parallel +0x28B0 read | medium |
| 0xA70A20 = chat filter (name/text, mute/profanity) | gates log append only | medium |
| 0x7A6E6E = chat log append (5 args incl. 0x400 buf) | 0x53D601 | high |
| 0x4376F2 = GetField singleton | repeated across handlers | high |
| field vtable+0x1C returns field state; 0x13 gates cross-room chat | 0x53D630 cmp | medium |
| CHATTEXT 0xA5 = self-speech variant (extra string payload) | band 0x57F9EB + 0x53D58B | confirmed |

## Methodology (replicable for S10 proper)

1. Band decode (JT/cmp-chain) → per-opcode leaf + is_self-style flag carries
2. Reader-sequence → wire schema with local-variable mapping
3. Field/global singleton xrefs in body → owner attribution
4. Compare chains (==2→0, !=-1) → enum/value-domain recovery
5. Call-site argument shapes → helper naming (filter/log/format)
