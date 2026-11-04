# Task 042 — Later-Phase Re-Capture Campaign (live object population)

## Objective

Task 041 proved the 036 capture predates the game logic (singletons
NULL, CWvsContext identity zero). This campaign re-captures at a
LATER phase, with the local server reachable, to populate the live
objects:

```
1. host: local server UP (login 9555 loopback)
2. QEMU with USER-MODE networking (SLIRP): guest 10.0.2.2 -> host
   loopback; the client launched as `MapleStory.exe 10.0.2.2 9555`
   (fidelity note: a NIC now exists — the goal is phase coverage,
   not no-NIC fidelity; recorded)
3. observe: server accept log (the moment the client connects = the
   game logic LIVE) + screen OCR + status
4. capture at the right moment (connection/login activity):
   stop + dump-guest-memory (036 method)
5. carve the KNOWN targets: the globals/objects whose structure 041
   mapped (CWvsContext fields, NULL singletons, identity model,
   socket object) + re-verify the image regions
```

## Milestones

- **R0** environment: server up + QEMU(SLIRP) + client drive
- **R1** client launched with server args; modal → authorized OK
- **R2** LATER PHASE REACHED: server observes the client's connection
  (or the screen shows the login UI) — the game logic is LIVE
- **R3** capture at the live moment (stop + dump)
- **R4** carve + compare: CWvsContext identity populated? singletons
  constructed? the identity/char model filled?
- **R5** the populated object atlas + diff vs the 036 capture

## Restrictions (inherited, unchanged scope)

The Task-036 authorization covers memory capture of our own offline
VM; SLIRP is host-internal (no public network); no patching, no
guest-side debugger. Nothing binary committed.

## Operational machinery (inherited)

`.work/task-042/`; stop A-D; commit message `Complete Task 042
later-phase re-capture campaign`; never force push.
