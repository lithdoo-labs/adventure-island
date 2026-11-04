# Task 032 — Server-Side Protocol Recovery & Synthetic-Client Campaign

## Objective

Continue from Task 031.

Tasks 027-031 took the main-EXE protector route to a three-side-proven
offline boundary: the protected client's game body cannot be reached by
faithful offline replay, and the divergence is proven to lie below the
emulated surface. The project's primary goals that remain open are the
**protocol layer**: network initialization, connect, send/receive, the
packet codec, the client opcode dispatcher, and the client↔079-server
protocol mapping (README goals 2-3).

Task 032 pivots the campaign series to the leg where all assets are
locally available and no protection boundary exists:

```
local CMS079 server (079V5 tree: 江浩079.jar + bundled JRE7 + MySQL)
 -> stand up login (9555) / channels (7575-7578) / cash shop (8600) on loopback
 -> extract the COMPLETE protocol semantics from the server implementation
    (handshake, opcodes, packet structures, sequence, crypto)
 -> build a project-owned SYNTHETIC CLIENT that completes the real
    handshake + login flow against the local server (end-to-end protocol
    proof WITHOUT the protected client)
 -> v95 reference correlation: map the client-side handler structure
    (CClientSocket / CLogin / packet dispatch) so the anchor table is
    ready for whenever the CMS079 game body becomes reachable
 -> support-DLL protocol-relevant correlation
```

This replaces the unreachable protected client for protocol purposes,
advances the README's primary goals, and hardens the whole recovery
pipeline: once the game body is ever reachable (VM gate or otherwise),
the protocol layer will already be documented end-to-end.

## Milestones

- **P0** server inventory + local standup — the 079V5 tree runs; login
  server listens on 127.0.0.1:9555
- **P1** protocol extraction — complete login-flow semantics from the
  server implementation (handshake bytes, opcode table, packet
  structures, DB prerequisites)
- **P2** synthetic client — a project-owned offline client completes the
  15-byte handshake and the login exchange against the local server
- **P3** protocol tables — normalized login/channel/cash-shop opcode +
  structure tables cross-validated between the server implementation
  and the synthetic-client transcript
- **P4** v95 client-side correlation — the client-side dispatch map
  (handler names/structure from the reference bundle), clearly labeled
  as reference-derived, never address-copied
- **P5** support-DLL correlation — protocol-relevant pieces in the
  recovered support DLLs (codec users, socket helpers), if any

Honesty rules inherited: no inflated claims; reference material is
names/structures only; artifacts only when reached.

## Main Work

### 1. Server inventory + standup (P0)

- Re-validate the extracted `.work/task-002/server/079V5/` tree against
  the Task 001 manifest; re-extract from `.raw/.rar` if missing.
- Read `启动服务端.bat`, `服务端配置.ini`, `dist/` layout; identify the
  login/channel/cash-shop executables (JARs) and their configs.
- Start the bundled MySQL (127.0.0.1:3306) and the login server; verify
  `127.0.0.1:9555` listens. Record versions/ports/pids.
- All binding must stay on loopback; no public exposure.

Create: `result/task032-server-inventory.md`

### 2. Protocol extraction (P1)

- Inventory the server JAR's classes; locate the network bootstrap,
  handshake handler, login packet handlers, opcode constants, and the
  AES/OFB implementation (already validated in Task 002 as
  `MapleAESOFB`).
- Extract (via bytecode inspection `javap` or available decompilers —
  no third-party binaries committed): the exact handshake bytes, the
  login-flow opcode numbers and their field layouts, the account DB
  schema prerequisites (username/password format, ban/PIP fields), and
  the channel/cash-shop listener protocols.
- Cross-check every extracted constant against
  `scripts/maple079_packet.py` (the validated codec).

Create: `result/task032-protocol-login.md`, `result/task032-opcodes.csv`

### 3. Synthetic client (P2)

- Build `scripts/maple079_syn_client.py` (project-owned, loopback-only):
  performs the 15-byte CMS079 handshake, sends a login packet for a
  test account (created via the server's own DB/console tooling —
  gm小助手 or direct SQL insert on the local DB), and records the
  server's responses through the validated codec.
- The synthetic client is derived ONLY from the server-side protocol
  and the documented handshake — never from protected client code.
- Target: complete the full login exchange (connect → handshake →
  login request → response), and if reachable the channel-select and
  world-list steps.

Create: `scripts/maple079_syn_client.py`,
`result/task032-synthetic-transcript.md`

### 4. Protocol tables (P3)

- Normalize: opcode, direction, name, fields (order/type/semantics),
  evidence (server class/method + transcript byte offset).
- Channel (7575-7578) and cash-shop (8600) listeners: at minimum their
  handshake/first-packet semantics; deeper flow only if naturally
  reachable with the synthetic client.

Create: `result/task032-packet-structures.csv`

### 5. v95 client-side correlation (P4)

- From `reference/maplestory-symbols` (v95 bundle): extract the
  client-side login/dispatch structure — `CClientSocket`
  (connect/OnRead/OnPacket), `CLogin` handlers, `CWvsApp` bootstrap —
  as a structural map with reference names only.
- Mark every row reference-derived; never copy addresses into CMS079
  conclusions.

Create: `result/task032-client-dispatch-map.csv`

### 6. Support-DLL correlation (P5)

- Cross-check the recovered support-DLL set (Task 026) for
  protocol-relevant exports/usages (socket wrappers, codec helpers);
  report only what the evidence supports.

Create: `result/task032-support-dll-correlation.csv` (only if non-empty
findings)

## Restrictions

- Loopback/host-only networking only; the server binds 127.0.0.1; the
  synthetic client connects only to 127.0.0.1; **never any public
  internet endpoint**.
- Do not modify or run the protected client in this task at all; the
  synthetic client must not be derived from protected code.
- No committing of original server binaries, WZ files, the JAR, or
  third-party decompilers; only normalized text/CSV findings and
  project-owned scripts.
- Database work only on the local bundled MySQL instance; no real
  account data (synthetic test accounts only).
- Inherited safety boundary (Tasks 026-031) otherwise unchanged.

## Operational machinery (inherited)

Sync gate (clean tree, ff-only, record STARTING_HEAD); `.work/task-032/`
scratch; mandatory reading: `result/01-server-baseline.md`,
`result/02-runtime-network-bootstrap.md`,
`result/server-file-manifest.csv`, `scripts/maple079_packet.py`,
`result/26-…` support-DLL recovery summary, `result/31-…` (boundary
context); sample/tool gate (client hash unchanged is NOT required for
the server leg, but record it once for continuity); time budget 8-16 h
(P0 10%, P1 30%, P2 25%, P3 15%, P4 10%, P5 5%, buffer 5%); stop
conditions: A) P5 reached with a complete protocol layer, B) a
hard blocker (e.g., server cannot run on this host) precisely
characterized, C) time budget exhausted with precise state; commit
message `Complete Task 032 server-side protocol recovery synthetic
client campaign`; never force push.

## Final Report

Create `result/32-server-protocol-recovery-synthetic-client.md` +
`result/task032-milestones.csv`, `task032-blockers.csv`,
`task032-progression-timeline.csv`. The report must state: server
standup status; protocol extraction coverage; the synthetic-client
transcript outcome (handshake/login completion); opcode/structure table
coverage; v95 dispatch-map status; support-DLL findings; strongest
finding / uncertainty / blocker; next direction.

The most important question Task 032 must answer:

```
"Can the complete CMS079 login protocol be recovered and proven
end-to-end against the local server with a project-owned synthetic
client — giving the project the protocol layer the unreachable game
body would have spoken?"
```
