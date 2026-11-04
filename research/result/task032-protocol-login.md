# Task 032 — Login protocol (P1) & synthetic client (P2)

All evidence confirmed-live against the local loopback server unless noted.

## 1. Wire protocol (the definitive model, empirically proven)

```text
connect 127.0.0.1:9555
  <- server HELLO (server-first! odinms sessionOpened):
     0D 00 4F 00 00 00 <iv1:4> <iv2:4> 04
     len=13 version=79(LE) iv1="Fr"+rand iv2="R0x"+rand locale=4
  -> client packets: 4-byte header + AES-OFB body
     header = (iv2_word ^ len_swapped) form with:
       c2s version word 0x4F00, session IV = hello iv1
       s2c version word 0xB0FF, session IV = hello iv2
     body = MapleCustomEncryption.shuffled(AES-OFB(plaintext))
     IV rolls forward after every packet (both directions)
```

Three protocol discoveries were required to reach this (each was proven
by a live differential):

1. **The 15-byte hello is SERVER-first.** Sending it client-first (as the
   pre-campaign codec assumed) poisons the decoder: the server treats those
   bytes as an encrypted packet, `checkPacket` fails, and the session is
   closed — every early attempt died silently this way.
2. **The header version words are 0x4F00 (c2s) / 0xB0FF (s2c) with the
   c2s IV taken from hello[6:10]** — established by an 8-combination live
   matrix (word-pair × IV-pairing) in which exactly one combination
   produced a decrypted reply.
3. **The crypto construction asymmetry** (`sessionOpened` builds
   `MapleAESOFB(iv1, (short)-80)` and `MapleAESOFB(iv2, (short)79)`; the
   short is byte-swapped into the 16-bit check word → 0xB0FF/0x4F00)
   explains both words from the JAR bytecode, matching the empirical
   matrix.

## 2. The login flow (full transcript, `.work/task-032/logs/`)

```text
-> 0x0001 LOGIN_PASSWORD: maplestr("fl1234") maplestr("123456") mac[6]
<- 0x0000 LOGIN_ACCOUNT_INFO (account name/gender/admin/…)
<- 0x0009 SERVERLIST (world 0, 4 channels, names, flag, balloon)
<- 0x0009 SERVERLIST …
<- 0x0009 FF   (end-of-list marker)
-> 0x0000 PONG (on PING)
-> 0x0005 SERVERLIST_REQUEST
<- 0x0006 SERVERSTATUS (06000000)
-> 0x0006 CHARLIST_REQUEST
   (char-list flow entered; final drain window closed before its body)
```

Seeded account credentials: `fl1234` / `123456` (both seeded rows use
`sha1("123456")`). Auto-register exists (`江浩.AutoRegister`) but enforces
one-account-per-MAC — new synthetic accounts are rejected for the
all-zero MAC, so the seeded account is used.

## 3. Synthetic client

`scripts/maple079_syn_client.py` (project-owned, loopback-only): connects,
reads the server hello, derives the session keys, sends LOGIN_PASSWORD,
drains/decrypts replies (with PONG), then SERVERLIST/CHARLIST requests.
Transcript written per run. Built ONLY from the server-side protocol and
the Task-002-validated codec — no protected-client code involved.

## 4. Server-side handler map (login zone)

From `handling/MapleServerHandler.handlePacket` (opcode ordinal → case →
handler) + `handling/RecvPacketOpcode` (116 constants extracted from
`<clinit>` bytecode): see `result/task032-opcodes.csv`. The full 116-entry
recv + 117-entry send tables are in `.work/task-032/logs/RecvPacketOpcode.txt`
/ `SendPacketOpcode.txt`.
