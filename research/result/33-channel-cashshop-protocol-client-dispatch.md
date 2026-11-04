# Task 033 — Channel & cash-shop protocol legs + client dispatch correlation (final report)

RUN DATE 2026-10-14 · STARTING_HEAD `53b97359ea85c353105cb7812cbd38fd273a61b6`
· canonical client sample `5d280cf1…` unchanged and untouched (all protocol
knowledge derived from the server implementation + live loopback exchanges
with the project-owned synthetic client).

## 0. Task 033 complete?

**Yes — Stop A: C0 through C5 all reached.** The central question is answered
affirmatively: the synthetic client walks the **full protocol chain** —
login, server list, character list, character select, channel migration,
in-channel login burst — and the client-side dispatch structure now exists
for every recovered server flow.

## 1. Head / push

FINAL_COMMIT recorded at push; no force push; `.raw/` untouched; the GBK
ini was restored to pristine at task end; server/MySQL processes stopped;
nothing binary committed.

## 2. The headline discoveries

1. **This build renumbers the odinms-standard c2s opcodes** (anti-bot
   gate). The authoritative table came from the server's own dispatch
   debug: CHARLIST_REQUEST=0x09, CHAR_SELECT=0x0A, PLAYER_LOGGEDIN=0x0B,
   CREATE_CHAR=0x11 … Task 032's static pairing was wrong (blocker
   B33-1 documents why static pairing fails here).
2. **The login socket must be closed after the redirect.** The channel's
   `Loggedin` check (decoded from bytecode) passes only when the account
   state ∈ {0,1,6}; holding the login connection open pins it at 2 →
   guaranteed rejection with 检测账号下已有角色登陆游戏. This single
   state-machine step was the entire difference between rejection and a
   full in-channel login.
3. **The channel port (7575) and cash-shop port (8600) share the login
   port's wire format exactly** — same server-first 15-byte hello, same
   IV derivation, same header words.

## 3. The proven chain (C0/C1/C2/C3)

See `result/task033-protocol-chain.md` for the full annotated chain:
login → LOGIN_ACCOUNT_INFO + SERVERLIST(+FF) → CHARLIST(161B with the
seeded character) → CHAR_SELECT → SERVER_IP redirect {127.0.0.1, 7575,
charid 25} → **login-socket close** → channel hello → PLAYER_LOGGEDIN →
**18-packet in-channel burst** (CHARINFO 658B, INVENTORY 270B, SKILLS
453B, welcome notices, …). Cash shop: hello + PLAYER_LOGGEDIN acceptance
proven; deeper flow gated on the in-channel ENTER_CASH_SHOP path (honest
boundary, B33-2).

## 4. v95 client-side correlation (C4)

`result/task033-client-dispatch-map.csv` — 20 structural rows mapping the
reference bundle's client symbols (CClientSocket::SendPacket,
SendLoginPacket, CLogin.LoginStep, CWvsContext.{AccountId,WorldId,
ChannelId,CharacterId,ClientKey}, CUIWorldSelect/CUIChannelSelect/
CUICharSelect, WorldItem/ChannelItem structs, CWvsApp.TargetVersion) onto
every live-proven server flow. All rows labeled reference-derived;
names/structure only — no addresses copied into CMS079 conclusions.

## 5. Strongest finding / uncertainty / blocker

- **Strongest finding**: the complete chain — including the two hidden
  state-machine gates (renumbered opcodes; login-close-before-migration)
  — is now proven end-to-end offline, and the project-owned synthetic
  client reproduces it on demand.
- **Strongest uncertainty**: the channel-zone opcodes beyond the login
  zone (movement, combat, cash-shop entry) still carry the renumbering
  and are not yet enumerated (B33-1's live-probe method extends to them).
- **Primary blocker**: none hard; B33-1/B33-2 are enumerable follow-ups.

## 6. Recommended next direction

(a) Live-enumerate the channel-zone opcode table (0x14+) with the same
dispatch-debug method, completing the renumbered tables; (b) extend the
synthetic client: ENTER_CASH_SHOP from the in-channel state → the 8600
session; (c) CREATE_CHAR through the protocol to remove the dependency
on the seeded account. The protocol leg remains fully independent of the
closed protector boundary.

## 7. Artifacts

`result/33-channel-cashshop-protocol-client-dispatch.md` (this file),
`task033-protocol-chain.md`, `task033-client-dispatch-map.csv`,
`task033-milestones.csv`, `task033-blockers.csv`,
`task033-progression-timeline.csv`; tooling: `scripts/maple079_syn_client.py`
(Task-033 full-chain edition). Transcripts in `.work/task-033/logs/`
(not committed).
