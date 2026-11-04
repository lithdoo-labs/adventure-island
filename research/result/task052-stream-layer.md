# Task 052 Phase D: Inbound Stream Layer — Pump Architecture Decoded

## Proven chain (all RVAs hand-verified)

```
recv callback (site TBD — see Boundary)
   -> [socket+0x40] buffer queue
PUMP 0x95E7E (loop while [sock+0x48]):
  chunk = FramingFSM(0x2F5896)(stream [sock+0x68], chunk [sock+0x4C], &out)
       -- 4-byte header accumulation: +0xC have / +0xE seq / +0x10 length
       -- seq validation: [0x2F590A] word1 ^ word2 stored at +0x10
  if drained: DiscardBuffer 0x9682C([sock+0x40], chunk)
  WIRE-WORD CHECK (0x95EC2): ([sock+0x8C] >> 0x10) ^ [sock+0x76] == 0xFFB0
       *** the 0xB0FF s2c word from task033's live model, confirmed in code ***
       also: [sock+0x78] <= 0x10000 length sanity
  if frame complete (chunk_size == 2 boundary):
       Extract 0x2F5811 (plain memcpy of payload into packet object)
       IV/state transform 0x659082(&[sock+0x8C], 4, seed=0xC65053F2)
       ProcessPacket 0x95F83: ctor, ReadInt16 opcode, switch
            -> dispatch switch 0x610CE0 -> range/band handlers (task049 map)
```

## Custom transform family (recovered)

- **0x659082**: `Transform(buf, len, state=0xC65053F2)` — per-byte rolling state
- **0x6590BD**: round = table-driven Shanda variant: state[0]+=T[s1]-b;
  state[1]-=s2^T[b]; ... with T @ **0xBD4130**
- T is runtime-computed — the slot is ZERO in the recovered image
  (pre-login, same root cause as Phase B's S-box absence)

## Interpretation

0x659082 operates on the 4-byte header/state (len=4 call in the pump) —
consistent with a header checksum/derivation feeding the 0xFFB0 check,
not the body crypt. The body crypt (Shanda+AES-OFB per JAR ground truth)
applies in the recv callback BEFORE [socket+0x40] — that callback is the
one remaining unfound piece (bounded below).

## Boundary (honest)

The recv callback is registered via the socket event layer (likely
WSAAsyncSelect message → window proc → CClientSocket::OnReceive); its
resolution requires either the UI-window plumbing walk (deep static) or a
post-login capture. B44-3 is 80% closed: framing, validation, state
transform, and dispatch all decoded; only the OnReceive entry point remains.
