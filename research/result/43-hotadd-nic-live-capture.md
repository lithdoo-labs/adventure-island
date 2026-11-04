# Task 043 — Hot-add-NIC live capture (final report)

RUN DATE 2026-10-16 · STARTING_HEAD `6a106b5…` · our own offline VM;
SLIRP host-internal; authorized capture; nothing binary committed.

## 0. Verdict

**Stop C — orchestration-layer failure, precisely characterized; the
hot-add design remains sound but untested to completion.**

## 1. What happened

- The stack came up correctly: QEMU with the ORIGINAL no-NIC config,
  snapshot restored, observer files staged BEFORE usb-attach (the 042
  lesson applied — the files WERE visible in the guest this time).
- The external keyboard launch of the observer failed AGAIN (third
  occurrence): autoplay focus-stealing defeated the typed launch; the
  observer never ran (the alive marker stayed at the 042 timestamp).
- The hot-add itself was executed per design (netdev_add + device_add
  e1000 — the NIC appeared, `info network` confirmed) but with no
  client running it could not connect.
- **An honest unknown**: the server's hello counter rose 9→11 during
  the session window with no matching client-send records (two
  connections that hello'd and closed). Recorded as B43-2 — no
  conclusion drawn without evidence.

## 2. The refined continuation (for the next attempt)

The failure layer is EXCLUSIVELY external keyboard orchestration. The
fix is a self-contained in-guest orchestrator (one CMD pushed on the
xfer disk, run from an autorun/RunOnce or the startup folder — zero
external typing):

```text
guest-side: launch client (10.0.2.2) → click PCA → click modal →
            log the click moment to the xfer disk
host-side:  watch the alive marker → +4 min (materialization, 036
            timing) → netdev_add+device_add (the proven commands) →
            watch the server hello → login typing (the observer
            machinery can be extended to type credentials)
```

All components exist and are proven individually; only their
composition needs the autorun change.

## 3. Artifacts

`result/task043-milestones.csv`, `task043-blockers.csv`,
`task043-progression-timeline.csv`, this report.
