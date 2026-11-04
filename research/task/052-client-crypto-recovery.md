# Task 052 — Client Crypto-Object Recovery & Stream Layer Completion

## 0. Mission

Complete the client-side crypto architecture using the existing authorized
corpus (Task 036 memory capture + recovered static image), and restart the
authorized QEMU line for a post-login capture attempt:

1. **Phase A — S-box anchor carve**: scan `t036-mem.elf` for AES S-box
   instances (task038 proved heap-resident runtime-computed standard S-box);
   enumerate cipher-object candidates around each anchor.
2. **Phase B — schedule recovery**: extract the expanded schedule region
   (AES-256: 240 bytes; first 32 bytes of the schedule ARE the original key);
   compare against the known server key (JAR lineage). Also test the
   word-swapped storage form.
3. **Phase C — cipher object layout + ownership**: map the object structure
   around confirmed anchors (S-box, inv-S-box, schedule, state, counters);
   cross-reference static image: find the init/ctor site referencing the
   cipher object family, bind to CClientSocket+0x54 (known cipher field).
4. **Phase D — stream layer decode (B44-3)**: decode the stream-processing
   internals at [socket+0x40] (the pump's append->extract chunked loop) and
   the body-crypt application order (AES-OFB vs custom shanda order) from
   the static image.
5. **Phase E — QEMU restart attempt (B44-1)**: restart the task024-qemu
   container, verify guest state, and attempt the in-guest autounattend
   rebuild path for a post-login capture. Bounded: if session degradation
   recurs, document and stop — no heroics.

## 1. Rules

- Same corpus restrictions as Tasks 036/045 (authorized QEMU host-side
  capture data only; no new capture techniques beyond restarting the
  existing authorized container).
- Honest reporting; no fabricated crypto; validations must round-trip
  (encrypt/decrypt match on known vectors from task033 traffic).
- Commit only normalized artifacts + scripts.

## 2. Success criteria

- A: all S-box instances enumerated with page/offset
- B: schedule recovered; client-key vs server-key verdict (match/divergence)
  with round-trip validation against task033 stream samples
- C: cipher object layout documented; ownership bound to socket cipher field
- D: body-crypt order decoded (which transform, what order) OR concrete blocker
- E: container restarted + guest state verified; capture attempted; outcome
  documented either way

## 3. Artifacts

result/task052-sbox-anchors.csv · task052-schedule-recovery.md ·
task052-cipher-object.md · task052-stream-layer.md · task052-qemu-restart.md ·
result/52-client-crypto-recovery.md (final)
