# Task 032 — Static bridge update (protocol layer opened)

Extends `result/task031-main-static-bridge.md`. This task pivoted from the
closed protector route to the server-side protocol leg (README goals 2-3).

## New facts (confirmed-live against the local loopback server)

| Fact | Evidence |
| --- | --- |
| Full local stack runs headless: MySQL 5.5.53 (pre-initialized DB) + 江浩 JAR (login 9555, channels 7575-7578, cashshop 8600) | `task032-server-inventory.md` |
| **The 15-byte hello is SERVER-first** (odinms sessionOpened); a client-first handshake poisons the decoder and kills the session | 8-combination live matrix |
| Wire format pinned: c2s word 0x4F00 with session IV = hello[6:10]; s2c word 0xB0FF with IV = hello[10:14]; AES-OFB + MapleCustomEncryption shuffle + rolling IVs (Task-002 codec confirmed end-to-end live) | `task032-protocol-login.md` |
| Crypto construction asymmetry decoded from the JAR: `MapleAESOFB(iv1,(short)-80)` / `MapleAESOFB(iv2,(short)79)`; the short byte-swaps into the 16-bit header word (0xB0FF / 0x4F00) | sessionOpened bytecode |
| Full login exchange proven with a project-owned synthetic client: LOGIN_PASSWORD → LOGIN_ACCOUNT_INFO + SERVERLIST(+FF end marker) → PONG/SERVERLIST_REQUEST/SERVERSTATUS → CHARLIST flow | `scripts/maple079_syn_client.py`, full transcript |
| LOGIN_PASSWORD body = maplestr(account) + maplestr(password) + mac[6]; seeded accounts fl1234/fl2223 use **plain sha1(password)** | login handler bytecode + DB |
| Login-zone handler dispatch recovered (opcode → handler) from `handlePacket`'s switch; full 116/117 recv/send opcode tables extracted from the enums' `<clinit>` | `task032-opcodes.csv` |

## Pipeline state

The protocol layer — the layer the unreachable protected game body speaks —
is now recoverable and provable **end-to-end without the protected client**.
When the main-EXE game body ever becomes reachable (VM gate or otherwise),
the anchor table (`task032-opcodes.csv`, `task032-packet-structures.csv`)
plus the synthetic client give the project the complete wire semantics to
match against it.

Tooling added: `scripts/maple079_syn_client.py` (loopback-only synthetic
client). No changes to the protected client; nothing extracted from it.
