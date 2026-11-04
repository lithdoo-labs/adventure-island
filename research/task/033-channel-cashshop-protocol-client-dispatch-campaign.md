# Task 033 — Channel & Cash-Shop Protocol Legs + Client Dispatch Correlation Campaign

## Objective

Continue from Task 032.

Task 032 recovered the complete login leg (9555) and proved it end-to-end
with a project-owned synthetic client, pinning the wire format
(server-first hello; c2s word 0x4F00 with IV=hello[6:10]; s2c word 0xB0FF
with IV=hello[10:14]) and the login-zone opcode/handler tables.

Task 033 completes the protocol layer:

```
complete the login drain (charlist — B32-1)
 -> world-select / char-select client state machine
 -> CHANNEL port 7575 handshake (its own hello/crypto derivation)
 -> in-channel packet flow boundary (PLAYER_LOGGEDIN 0x10 etc.)
 -> CASH-SHOP port 8600 handshake
 -> v95 client-side dispatch correlation (P4 from Task 032):
    the client handler structure for every recovered server flow, so the
    client-side anchor table exists before the game body is ever reached
 -> one complete protocol document: login -> channel -> game entry
```

All work remains loopback-only against the local CMS079 server; the
protected client is never run or inspected.

## Milestones

- **C0** login leg completed — charlist body drained; world-select +
  char-select exchanges proven live
- **C1** channel-port (7575) wire format — hello/handshake derivation,
  first authenticated flow (PLAYER_LOGGEDIN) entered
- **C2** channel flow boundary — how far the synthetic client can reach
  into the channel protocol without a real character (honest boundary)
- **C3** cash-shop port (8600) wire format — handshake characterized
- **C4** v95 client-side dispatch correlation — client handler map
  (CClientSocket/CLogin/CStage/CField dispatch structure) from the
  reference bundle, clearly labeled reference-derived
- **C5** unified protocol document — login→channel→(boundary) chain
  with every proven exchange

Honesty rules inherited: no inflated claims; reference material is
names/structure only (never addresses into CMS079); artifacts only when
reached; the synthetic client is built only from server-side evidence.

## Main Work

### 1. Login-leg completion (C0)

- Restart the local stack (path-corrected my.ini; pristine ini + byte-exact
  edits only — B32-3 hazard).
- Rerun the synthetic flow with longer drain windows; capture the full
  CHARLIST body; then SERVERLIST → world-select request (0x0E
  SET_GENDER? / world-select is typically repeated SERVERLIST_REQUEST +
  CHARLIST_REQUEST per world) → CHAR_SELECT (0x0C) → the server's reply
  (expected: channel-redirect packet with the channel IP/port + session
  cookie — the exact bridge packet into C1).
- Record every exchange in the transcript format from Task 032.

Create: extend `result/task033-packet-structures.csv` rows; transcript in
`.work/task-033/logs/`.

### 2. Channel-port handshake (C1)

- On the redirect packet's port (7575): connect, read the channel hello,
  derive the session keys (verify whether the channel port uses the same
  word/IV derivation as login; the JAR's channel `sessionOpened` may
  construct different version shorts — decode it from the bytecode the
  same way Task 032 did for login).
- Send the channel-entry packet the server expects after hello (typically
  PLAYER_LOGGEDIN 0x10 carrying the account/char ids from the redirect).
- Character data is the boundary: the seeded accounts may have no
  characters (check `characters` table; if none, the honest boundary is
  the "empty charlist" flow — record it, do not fabricate characters
  unless via the server's own creation flow through the synthetic client,
  which is allowed: CREATE_CHAR 0x09 through the protocol).

### 3. Channel flow boundary (C2)

- Character creation through the protocol (CREATE_CHAR 0x09) is the
  legitimate way to obtain a playable character; if the created char can
  then be selected and the channel entered, record the first in-channel
  packets (PING/PONG, stats/inv pushes) as the boundary.
- Stop at whatever requires a graphical client (movement etc. — no
  fabrication).

### 4. Cash-shop handshake (C3)

- Port 8600: connect, read hello, try the login-phase opcodes;
  characterize its handshake (it may share the login crypto construction).

### 5. v95 client dispatch correlation (C4)

- From `reference/maplestory-symbols`: extract the client-side structure
  for the recovered flows — socket wrapper (connect/OnRead/OnPacket),
  login handler names, dispatch tables, CStage/CField/CUser entry points.
- Every row labeled reference-derived; structural correlation to the
  recovered server opcodes only.

Create: `result/task033-client-dispatch-map.csv`

### 6. Unified document (C5)

Create: `result/task033-protocol-chain.md` — the complete proven chain
with the honest boundary marked.

## Restrictions (inherited)

- Loopback only; never any public endpoint.
- Never run/patch/inspect the protected client; the synthetic client is
  protocol-level only.
- No committing server binaries/WZ/JAR/dumps; only normalized findings
  and project-owned scripts.
- DB work only on the local bundled MySQL; no real account data.
- GBK ini edits byte-exact only (B32-3).

## Operational machinery (inherited)

Sync gate (clean tree, ff-only, STARTING_HEAD); `.work/task-033/` scratch;
mandatory reading: Task 032 results (esp. `task032-protocol-login.md`,
`task032-opcodes.csv`, `task032-blockers.csv`), `scripts/maple079_syn_client.py`,
`scripts/maple079_packet.py`; time budget 8-16 h (C0 10%, C1/C2 35%,
C3 10%, C4 20%, C5 10%, buffer 15%); stop conditions A-D as before;
commit message `Complete Task 033 channel cash-shop protocol legs client
dispatch correlation campaign`; never force push.

## Final Report

Create `result/33-…md` + `task033-milestones.csv`, `task033-blockers.csv`,
`task033-progression-timeline.csv`. The report must state: C-milestone
states; every newly proven exchange; the channel/cash-shop wire formats;
the honest boundary; v95 correlation coverage; strongest finding /
uncertainty / blocker; next direction.

The most important question Task 033 must answer:

```
"Can the synthetic client walk the full protocol chain — login, world
select, character select/create, channel entry — and does the client-side
dispatch structure now exist for every server flow, completing the
project's protocol layer independent of the closed protector boundary?"
```
