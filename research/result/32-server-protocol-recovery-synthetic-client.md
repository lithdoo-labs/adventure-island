# Task 032 — Server-side protocol recovery & synthetic-client campaign (final report)

RUN DATE 2026-10-14 · STARTING_HEAD `b37c3056f7010d928d050825e731a70344316072`
· canonical client sample `5d280cf1…` unchanged (untouched this task; the
protected client was never run, patched, or inspected for this campaign —
the protocol was recovered purely from the server implementation + live
loopback exchanges with a project-owned synthetic client).

## 0. Task 032 complete?

**Yes as a campaign — P0/P1/P2/P3 reached, P4/P5 not started (Stop D:
high-value core complete with precise next steps).** The central question
is answered affirmatively: the complete CMS079 login protocol was recovered
and **proven end-to-end against the live local server** by a synthetic
client — no protected code involved at any point.

## 1. Head / push

FINAL_COMMIT recorded at push time; no force push; `.raw/` untouched
(read-only extraction to `.work/`); no server binaries/WZ/JAR committed.

## 2. Server standup (P0)

Bundled MySQL 5.5.53 (pre-initialized `079v5` DB) + the 江浩 Java server,
headless via `server.Start` (GUI bypassed), all bound to 127.0.0.1: login
9555, channels 7575-7578, cash shop 8600. Two standup hazards found and
fixed (defaults-file InnoDB; GBK ini corruption — see blockers).

## 3. Protocol extraction (P1)

- 116 recv + 117 send opcodes extracted from the enums' `<clinit>`
  bytecode (custom Python class-file reader; nothing third-party committed).
- Login-zone handler dispatch (opcode → handler) from `handlePacket`'s
  switch; LOGIN_PASSWORD's exact read sequence from the handler bytecode.
- The AES/OFB header-word construction asymmetry decoded
  ((short)-80 → 0xB0FF, (short)79 → 0x4F00).

## 4. Synthetic client + the three live discoveries (P2)

1. **Server-first hello** — the 15-byte hello the pre-campaign model
   assumed client-sent is actually server-sent; sending it client-first
   poisons the decoder and kills every session (this alone explained all
   early silent failures).
2. **Wire words/IV pairing** — an 8-combination live matrix pinned:
   c2s word 0x4F00 + session IV hello[6:10]; s2c word 0xB0FF + IV
   hello[10:14]. Exactly one combination replies.
3. **Full login exchange proven live**:

```text
-> 0x0001 LOGIN_PASSWORD (account+password+MAC)
<- 0x0000 LOGIN_ACCOUNT_INFO (account data)
<- 0x0009 SERVERLIST ×N + 0x09FF end marker
-> 0x0000 PONG / 0x0005 SERVERLIST_REQUEST / 0x0006 CHARLIST_REQUEST
<- 0x0006 SERVERSTATUS …
```

Seeded accounts use plain sha1(password) (`sha1("123456")` matches both
rows); auto-register enforces one-account-per-MAC.

## 5. Protocol tables (P3)

`task032-opcodes.csv` (login-zone opcode → handler, direction, evidence)
and `task032-packet-structures.csv` (step/packet/meaning), cross-validated
between the JAR bytecode and the live transcript. Full 233-constant tables
in `.work/`.

## 6. P4/P5

Not started (time budget consumed by the standup hazards and the
wire-format matrix). Reference bundle and Task-026 support-DLL recovery
are ready inputs for the next task.

## 7. Strongest finding / uncertainty / blocker

- **Strongest finding**: the protocol layer is now provable end-to-end
  offline — including three corrections to the pre-campaign wire model
  (server-first hello being the critical one).
- **Strongest uncertainty**: the channel/cash-shop legs (7575-7578/8600)
  are up but not yet characterized; char-select continuation needs a
  longer drain window.
- **Primary blocker**: none hard — B32-1/B32-2 are window/extension work.

## 8. Recommended next broad direction

Extend the synthetic client through world-select → char-select → channel
port 7575 (its own handshake) → cash shop 8600; then P4 (v95 client-side
dispatch correlation) so the client-side handler names exist before the
game body is ever reached. The protocol leg can now advance independently
of the closed protector boundary.

## 9. Artifacts

`result/32-server-protocol-recovery-synthetic-client.md` (this file),
`task032-server-inventory.md`, `task032-protocol-login.md`,
`task032-opcodes.csv`, `task032-packet-structures.csv`,
`task032-milestones.csv`, `task032-blockers.csv`,
`task032-progression-timeline.csv`, `task032-main-static-bridge.md`.
Tooling: `scripts/maple079_syn_client.py`. P4/P5 artifacts intentionally
not created.
