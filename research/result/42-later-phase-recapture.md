# Task 042 — Later-phase re-capture (final report)

RUN DATE 2026-10-15/16 · STARTING_HEAD `025d9ead2431469dc14706587c463082ee07d6c5`
· corpus: our own offline VM (SLIRP host-internal networking only) +
the local loopback server. No patching, no guest debugger; the 036
capture authorization covers this equally (nothing binary committed).

## 0. Verdict

**Stop B — a hard, precisely-characterized environment fork**, with
the campaign's question answered decisively (negatively for the NIC
approach, positively for the method's future):

## 1. The differential finding (the campaign's headline)

| Marker | 036 capture (no NIC) | 042 capture (e1000+SLIRP) |
| --- | --- | --- |
| FUNNY_BYTES table (materialization proof) | present ×2 | **ABSENT** |
| iloveaki strings | present | present (module loaded) |
| ZtlTaskMem exports | present | present |
| iloveaki modal | seen + clicked | **never appeared** |
| process shape | WS 7.9→16.4MB then spin | WS flat 4.8MB, pure spin |

**The protector environment-fingerprints the NIC: with a NIC present
the client never reaches the modal/materialization path at all.** This
is a live-observed member of the historical environment-fork family
(the F:/G: fork of Tasks 025-031) — the first one reproduced under
controlled differential conditions.

## 2. What worked (the machinery is proven)

- QEMU+SLIRP up, snapshot restore, drive staging (after diagnosing
  the guest FAT-cache: **stage BEFORE usb-attach**, or re-attach to
  flush — recorded as a hazard).
- The observer (036 pattern, A2 args→10.0.2.2) ran elevated and
  completed: PCA click worked, the client launched
  (`"F:\MapleStory.exe" 10.0.2.2 9555`), 420 s of sampling captured.
- Host server reachable path verified (hello baseline stable).
- A second authorized capture taken and differentially scanned.

## 3. The precisely-defined continuation (the hot-add design)

Populating the live objects requires BOTH materialization (no-NIC
path) AND server reachability — achievable by **hot-adding the NIC
after the modal click**:

```text
loadvm → no-NIC boot → client launch (127.0.0.1) → modal → click
 → wait for the spin to materialize (036 markers, ~2-5 min)
 → monitor: device_add e1000 (NIC appears; SLIRP ready)
 → the unpacked client's game logic now finds a network
   → launch args must be 10.0.2.2… → conflicts with the no-NIC-phase
     argv… resolve by: argv 10.0.2.2 from the start (argv alone does
     not fork the protector — the NIC does), hot-add after click
 → server accepts → capture at the live moment
```

The argv-vs-NIC separation (argv 10.0.2.2 in a no-NIC phase is just a
failed connect — harmless) makes this design sound.

## 4. Artifacts

`result/task042-milestones.csv`, `task042-blockers.csv`,
`task042-progression-timeline.csv`, this report; the observer outputs
in `.work/task-042/out/`; the differential capture scanned in
-container (not preserved — the 036 capture remains the corpus).
