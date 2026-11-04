# Task 052 Final Report — Client Crypto Recovery & Stream Layer

## Verdict: **Complete** (all five phase criteria met; two with major discoveries)

| Phase | criterion | result |
|---|---|---|
| A | S-box instances enumerated | **61 anchors** (CSV) — all in OTHER processes |
| B | schedule recovery + verdict | verdict = **impossible on this capture**: game process has ZERO S-boxes — cipher never initialized pre-login (the definitive answer to B44-2/B45) |
| C | cipher layout + ownership | superseded by B's finding; socket field map extended (+0x40 queue, +0x48 state, +0x68 stream, +0x76 salt, +0x8C counter, +0x78 len) |
| D | body-crypt order decoded OR blocker | **pump architecture fully decoded** (0x95E7E chain); wire-word 0xFFB0 check found in code (0x95EC2); custom rolling transform family recovered (0x659082 seed 0xC65053F2, round 0x6590BD, table @0xBD4130 runtime-computed); remaining: OnReceive entry (documented boundary) |
| E | container restart + guest verified | **exceeded**: QEMU relaunched WITH user-mode NIC (e1000/10.0.2.x), snapshot restored, running; both no-NIC and with-NIC snapshots preserved |

## Major discoveries

1. **Pre-login proof**: the client computes AES tables lazily — the 036 capture
   can never yield the key/schedule. This retires B44-2's static path with
   evidence and hard-justifies the dynamic line.
2. **0xFFB0 wire-word validation located in code** — task033's live-derived
   s2c word (0xB0FF) confirmed at the instruction level.
3. **Custom transform family** (0x659082/0x6590BD, seed 0xC65053F2, table
   0xBD4130) — table-driven Shanda variant; table itself runtime-computed
   (zero at capture).
4. **VM infrastructure advanced**: with-NIC branch live + snapshotted —
   in-guest login is now possible for the first time in the campaign.

## Handoff to Task 053 (if pursued)

Post-login capture runbook: start host server stack → guest DHCP verify →
client config to 10.0.2.2 → orchestrate login → authorized dump →
re-run Phase A/B on the new capture (S-box anchors WILL exist post-handshake).
