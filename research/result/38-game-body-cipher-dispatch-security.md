# Task 038 — Cipher/dispatch/security decode (final report, sessions 1+2)

RUN DATE 2026-10-14 · STARTING_HEAD `81c0b1aab093259930b559286fd83b2feb8b5e84`
· corpus: the Task-036 authorized capture; static analysis only;
nothing binary committed.

## 0. Task 038 complete?

**Session 2 added the master dispatch map (G3) and the receive-pump
identification (G2).** G1 (cipher) + G3 (dispatch) — the campaign's two
heads — are delivered; G4/G5 remain with pinned entries.

## 1. G1 — the cipher family (decoded, two-way matched)

| RVA | Function (client) | maple079_packet.py counterpart | Match |
| --- | --- | --- | --- |
| **0x6590BD** | `funny_shit(pIV, byte)`: block[1] -= (T[block[1]]-in); block[2] ^= …T[in]…; block[3] = T-mix + block[0]…; **rol32(block,3)** (`shl 3 \| shr 29`) | `funny_shit` | form-identical ✓ |
| **0x659082** | `crypt(data, len, pIV)`: default seed **0xC65053F2** (= `F25350C6` LE) when pIV==NULL; per-byte funny_shit | `crypt`/IV default | ✓ |
| **0x65911A** | `custom_encrypt`: nibble-swap (`shl 4\|shr 4`) + bit-pair rotate (`(b&0xD5)<<1 \|(b>>1)&0x55`) + `T[IV[0]]^` + funny_shit | `custom_encrypt` (roll sequences) | ✓ |
| **0x659182** | `custom_decrypt` (inverse) | `custom_decrypt` | ✓ |

- **The table**: single active copy at **RVA 0x7D4130** — all six code
  xrefs are inside the codec functions above. (The second copy
  0x7A0630 has no absolute-VA refs — a passive/alternate instance.)
- **The AES layer is heap-resident and runtime-computed**: the module
  image contains NO AES tables and no CryptoAPI — instead the process
  heap holds two **compact-AES (Sbox2 doubled-byte form)** cipher
  instances at **VA 0x74F12C00 and 0x756D2000** (the send/recv pair).
  This also explains Task-034's "packet AES key absent from every
  static module": the key never exists in any file — it is expanded
  at runtime next to the computed S-box.

**Net**: the server-side-validated codec and the client's decoded
codec are the same algorithm family — the two-way proof the task
asked for, at the funny_shit/custom layer; the compact-AES block
functions (in the 0x658-0x659 cluster, alongside their heap state)
remain for the next pass.

## 2. G2-G6 — session 2 results

**G2 (receive path — entry identified)**: recv@0x94994 lives inside
Connect (0x947EA — the non-blocking connect-probe); recv@0x95A72 lives
inside **0x9583A = the send/recv PUMP** (the same function family as
Send/Flush): the socket layer processes pending sends and incoming
data in one combined pump.

**G3 (dispatch — the master map)**:

```c
OnPacket(opcode, packet) @ 0x14112E:         // the IN-GAME dispatcher
    if (opcode > 0x144)  -> high cascade (0x14A/0x14D-0x14F/0x15F inline)
    if (opcode == 0x144) -> inline
    if (0x87 <= opcode <= 0x9F)
        -> JUMP TABLE @0x141585 (25 slots -> thunks -> handlers
           0x5415FB / 0x542ABA / 0x542AF6 / … / 0x547C88; one slot is
           a virtual dispatch [vtable+0x24])
    else RANGE SUB-DISPATCHERS (each with a singleton object):
        0xA2-0xED  -> [0xBDD4A0] @0x97F64C   // 0xA2 = inventory band
        0xEE-0x103 -> [0xBDD49C] @0x6A6AB0
        0x104-0x10C-> [0xBDEB44] @0x6CB061
        0x10D-0x10F-> [0xBDEA94] @0x51B3A3
        0x110-0x111-> [0xBDEA68] @0x50E6CF
        0x112-0x114-> [0xBDEB40] @0x688CBA
        0x115-0x116-> [0xBDD45C] @0x431648
        0x117-0x118-> [0xBDEB3C] …
```

The login band (0x00-0x0B) is a separate dispatcher (the cascade tail
— B38-3); hunting it + decoding the sub-dispatchers is now the
mechanical path to the full handler map.

- G4 (builders): entry pinned (0x95CC2 handshake write).
- G5 (CSecurity): method pinned.
- G6: partial (codec + pump + master dispatch named).

## 3. Strongest finding / uncertainty / blocker

- **Strongest finding**: the master dispatch is open — a complete
  OnPacket structure (jump table + range sub-dispatchers with
  singletons) that turns handler decoding into table lookups; plus the
  cipher family fully matched (session 1) and the pump identified.
- **Strongest uncertainty**: the login-band dispatcher (0x00-0x0B) and
  the compact-AES block functions.
- **Blocker**: none — budget only (B38-3/38-4).

## 4. Artifacts

`result/task038-cipher-decode.md` (the G1 decode record),
`task038-milestones.csv`, `task038-blockers.csv`,
`task038-progression-timeline.csv`, this report. Disassembly logs in
`.work/task-038/logs/`.
