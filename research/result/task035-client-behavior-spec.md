# Task 035 — Client behavior specification (B1)

The per-packet client behavior spec for CMS079 — built ONLY from:
live-proven exchanges (Tasks 032/033 transcripts), server-code-proven
semantics (JAR bytecode), and the v95 reference structure
(reference-derived, labeled). Unproven internals are marked **unknown**,
never guessed. This is the document the project matches against the
game body the day it becomes reachable.

Legend: **[live]** proven by our loopback transcript · **[srv]** decoded
from server code · **[v95]** reference-derived structure · **[?]** unknown.

## 0. Process launch

| Step | Client behavior | Evidence |
| --- | --- | --- |
| argv | `MapleStory.exe <ip> <port>` — server address from the command line (launcher bat) | [live] the bat's content |
| protector | loader → ijl15 stub → iloveaki.dat; modal; then the VM corridor (offline-closed; runtime behavior unknown past the box) | [srv/history] 026-031 |
| engine boot | PCOM PcInitModule → engine COM factories (NameSpace mount of WZ via file mappings; Canvas/Gr2D/Shape2D/Sound) | [live-static] 034/035 |

## 1. Login leg (port from argv, default 9555)

Wire model (all [live]): server-first hello `0D 00 4F 00 00 00 <iv1>
<iv2> 04`; client sends with header word 0x4F00 + session IV =
hello[6:10]; decrypts with 0xB0FF + hello[10:14]; AES-OFB + custom
shuffle; IVs roll per packet.

| # | Exchange | Client sends | Server replies | Client state (v95) |
| --- | --- | --- | --- | --- |
| 1 | connect | — | hello | CClientSocket stores IV pair [v95]; CWvsApp.TargetVersion must equal 79 [v95] |
| 2 | LOGIN_PASSWORD 0x0001 | `01 00` + maplestr(account) + maplestr(pwd) + mac[6] | 0x0000 LOGIN_ACCOUNT_INFO; then auto-push SERVERLIST 0x0009 (+FF end) | CLogin.LoginStep advances; CWvsContext.AccountId/EmailAccount set [v95] |
| 3 | (optional) SERVERLIST_REQUEST 0x0002 | `02 00` | SERVERLIST again | WorldItem/ChannelItem lists rebuilt [v95]; CWvsContext.WorldId on selection |
| 4 | CHARLIST_REQUEST 0x0009 | `09 00` + byte + byte + int | 0x000A CHARLIST (161B for 1 char) | CLogin.CountCharacters/slots [v95] |
| 5 | CHAR_SELECT 0x000A | `0A 00` + int charid | 0x000B SERVER_IP redirect `{?,ip(4),port(2),charid(4),flag,key}` | CWvsContext.CharacterId/ClientKey [v95] |
| 6 | **close the login socket** | — | — | REQUIRED: the login server's session-close resets the account state the channel check demands [srv] |

## 2. Channel leg (redirect port, 7575)

| # | Exchange | Client sends | Server replies | Notes |
| --- | --- | --- | --- | --- |
| 7 | connect | — | same-format hello (fresh IVs) | [live] |
| 8 | PLAYER_LOGGEDIN 0x000B | `0B 00` + int charid + 8 zero bytes | 18-packet burst: 0x0041 SERVERMESSAGE×N, 0x0081 CHARINFO(658B), 0x00A2 INVENTORY, 0x016F SKILLS(453B), 0x0026×2, 0x0091×N, 0x0048, 0x003C, 0x0065, 0x006A, 0x002B, 0x0022, 0x007D(charid) | [live] the CUser/CField init set [v95] |
| 9 | keepalive | PONG 0x0000 on PING | — | [srv] |

## 3. Cash shop (8600) — boundary

Same hello format; PLAYER_LOGGEDIN accepted [live]; the real entry is
ENTER_CASH_SHOP sent from an established channel session [srv] — client
construction **[?]** (opcode value in the renumbered table not yet
enumerated).

## 4. Renumbered opcode table (anti-bot gate) [srv]

The client MUST use this build's values, not odinms-standard ones:
c2s `PONG=0x00 LOGIN_PASSWORD=0x01 SERVERLIST=0x02 LICENSE=0x03
SET_GENDER=0x04 SERVERSTATUS=0x05 CHARLIST=0x09 CHAR_SELECT=0x0A
PLAYER_LOGGEDIN=0x0B CHECK_CHAR_NAME=0x0C CREATE_CHAR=0x11
DELETE_CHAR=0x12`; s2c observed `0x0000 acct-info 0x0005 status 0x0009
serverlist 0x000A charlist 0x000B redirect 0x0041 notice 0x0081
charinfo 0x00A2 inventory 0x016F skills …`. Channel-zone values (0x14+)
remain unenumerated [?].

## 5. What is deliberately NOT specified

Anything inside the VM: the dispatch table's addresses, the codec's
code, the CLogin/CField handler bodies, timing/anti-cheat behavior.
These stay unreachable(EXE-VM) per the 027-031 boundary proofs — the
day they open, rows above convert from [v95]/[srv] to [live] one by one.
