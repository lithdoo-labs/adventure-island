# Task 053 — Post-Login Capture Run

## 0. Mission

Execute the Task-052 handoff runbook: bring the game client in the VM through
a real login against the local server, then take an authorized host-side
memory capture at the in-game moment, and recover the live cipher objects
(S-box, expanded schedule, table 0xBD4130) that Phase B proved absent
pre-login.

## 1. Runbook

1. **Host server stack**: start MySQL (task-032 lineage, path-corrected my.ini)
   and the game server JAR (079V5) with ports bound for guest access.
2. **Guest networking**: verify DHCP on e1000 (slirp 10.0.2.0/24).
3. **Client config**: point the guest client at 10.0.2.2 (via xfer disk).
4. **Launch + login**: orchestrate client start and credential entry
   (existing task-033 DB account; typed via sendkey path if needed).
5. **Capture**: at the in-field moment, host-side dump via the authorized
   QEMU monitor path (036 lineage: full-memory save + game-process carve).
6. **Recovery**: re-run the Task-052 Phase A/B analyses on the new capture —
   expect non-zero in-game-process S-box anchors; carve schedule; extract
   table @0xBD4130; verify the key against the server key (JAR lineage).

## 2. Rules

- Authorized-corpus rule: host-side QEMU capture of the running VM only
  (036 precedent); no client patching, no anti-debug, no in-guest injection.
- Bounded effort: if guest orchestration fails after reasonable retries
  (the B44-1 history), document precisely and stop — infrastructure state
  (snapshots/scripts) must be left durable.
- Honest reporting; no fabricated capture content.

## 3. Success criteria

- Server stack up and reachable from guest (or precise blocker)
- Client launched and login attempted (screenshots as evidence)
- If in-field: capture taken, S-box anchor count > 0, schedule extracted,
  table dumped, key verdict vs server key
- Artifacts: result/task053-*.md/csv + result/53-post-login-capture.md

## 4. Rollback

VM snapshots `win7x86-clean-nicprep` / `win7x86-nic-running` preserved;
host stack scripts kill cleanly.
