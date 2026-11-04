# Task 033 — The complete proven protocol chain (C5)

Every exchange below was proven live on loopback with the project-owned
synthetic client (`scripts/maple079_syn_client.py`), Task-033 edition.
Transcripts: `.work/task-033/logs/{c0-complete,c1-channel3,c3-cashshop}.txt`.

## 1. The authoritative opcode discovery

This CMS079 build **renumbers the odinms-standard c2s opcodes** (anti-bot
measure). The Task-032 static extraction paired enum names with the wrong
values; the server's own dispatch debug (`客户端发送 <NAME> [value]`) gave
the authoritative login-zone table:

| c2s value | server name | c2s value | server name |
| --- | --- | --- | --- |
| 0x0000 | PONG | 0x0009 | **CHARLIST_REQUEST** |
| 0x0001 | LOGIN_PASSWORD | 0x000A | **CHAR_SELECT** |
| 0x0002 | SERVERLIST_REQUEST | 0x000B | **PLAYER_LOGGEDIN** |
| 0x0003 | LICENSE_REQUEST | 0x000C | CHECK_CHAR_NAME |
| 0x0004 | SET_GENDER | 0x0011 | CREATE_CHAR |
| 0x0005 | SERVERSTATUS_REQUEST | 0x0012 | DELETE_CHAR |

s2c (observed live): 0x0000 LOGIN_ACCOUNT_INFO · 0x0005 SERVERSTATUS ·
0x0009 SERVERLIST(+FF end marker) · 0x000A CHARLIST · 0x000B SERVER_IP
redirect · in-channel: 0x0041 SERVERMESSAGE · 0x0081 CHARINFO ·
0x00A2 INVENTORY · 0x016F SKILLS · 0x007D (charid) … (full 18-packet burst).

## 2. The chain (all live-proven)

```text
[login 9555]  connect → server-first hello (15B, version 79, iv1 iv2)
  -> 0x01 LOGIN_PASSWORD   { maplestr(account) maplestr(pwd) mac[6] }
  <- 0x0000 LOGIN_ACCOUNT_INFO (account data)
  <- 0x0009 SERVERLIST (world + 4 channels) + 0x09FF end marker   [auto-push]
  -> 0x02 SERVERLIST_REQUEST  { }  → <- SERVERLIST again
  -> 0x09 CHARLIST_REQUEST    { byte byte int } → <- 0x000A CHARLIST (161B,
                                                     char 25 江浩浩 GBK + stats)
  -> 0x0A CHAR_SELECT         { int charid }
  <- 0x000B SERVER_IP redirect { .. ip(4)=127.0.0.1 port(2)=7575
                                   charid(4)=25 flag(1) key(4) }
  ** CLOSE THE LOGIN SOCKET **   ← the real client's critical step

[channel 7575] connect → same-format hello (fresh IV pair)
  -> 0x0B PLAYER_LOGGEDIN     { int charid + 8B }
  <- 18-packet in-channel burst:
     0x0041 SERVERMESSAGE ×3 (welcome notices, GBK)
     0x0081 CHARINFO (658B — the full character record)
     0x00A2 INVENTORY (270B) · 0x016F SKILLS (453B)
     0x0026 ×2 · 0x0091 ×3 · 0x0048 · 0x003C · 0x0065 · 0x006A ·
     0x002B · 0x0022 · 0x007D (charid 25)

[cash shop 8600] connect → same-format hello;
  PLAYER_LOGGEDIN processed without rejection — deeper flow requires the
  in-channel ENTER_CASH_SHOP path (honest boundary; see blockers).
```

## 3. The two state-machine discoveries

1. **The login socket must be closed after the redirect.** The channel's
   `InterServerHandler.Loggedin` check decodes (bytecode) to:
   `state = getLoginState(); pass = false; if (state in {0,1,6}) {
      pass = !World.isCharacterListConnected(names); }
   if (!pass) reject("检测账号下已有角色登陆游戏")`. With the login socket
   held open the account stays at state 2 → the check block is skipped →
   pass stays false → guaranteed rejection. Closing the login connection
   lets the login server's session-close reset the state to 0 → the check
   runs and passes.
2. **The renumbered opcode table** (§1) — any client speaking
   odinms-standard values is rejected as UNKNOWN (this is the server-side
   gate that the protected client's custom build matches).

## 4. Crypto summary (unchanged from Task 032, re-proven on all ports)

server-first hello `0D 00 4F 00 00 00 <iv1> <iv2> 04`; c2s header word
0x4F00 with session IV = hello[6:10]; s2c word 0xB0FF with IV =
hello[10:14]; body = MapleCustomEncryption-shuffled AES-OFB; IVs roll
forward per packet in both directions.

## 5. Honest boundary

- Channel leg: the burst is received; interactive gameplay (movement,
  combat) is a graphical-client concern and is NOT exercised.
- Cash shop: handshake + PLAYER_LOGGEDIN acceptance proven; the
  enter-from-channel path is unproven (C3 boundary).
- CREATE_CHAR/DELETE_CHAR: values identified but flows not exercised
  this task (the seeded char sufficed for the chain).
