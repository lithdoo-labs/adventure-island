# Task 026 — Post-modal runtime observation (iloveaki OK-click campaign)

Campaign runs T26F1–T26F4 (QEMU TCG, Win7 Pro SP1 x86, snapshot
`win7x86-clean`, elevated guest observer
`scripts/maple079_postmodal_observe.ps1`, canonical
`MapleStory.exe` SHA `5d280cf1…` re-verified in every run; client disk =
`client.img`, xfer disk = `xfer2.img`, both USB via hub ports 2.1/2.2).

## 1. Run inventory

| run | attach variant | client | xfer | observer | outcome |
| --- | --- | --- | --- | --- | --- |
| T26F1 | usb-attach (2 s) | F: | G: | v1 | game reached loader stage; observer died 1.3 s after PCA click (v1 callback bug, fixed); game's final state unrecorded |
| T26F2 | usb-attach (2 s) | G: | F: | v2 | **clean G:-client spin**, full 480 s window, observer completed; validates v2 stability |
| T26F3 | usb-attach-clientwait (45 s) | F: | G: | v2 | **F:-client SPIN — the letter counterexample** (see §2) |
| T26F4 | usb-attach (Task-025 exact, 2 s) | F: | G: | v2 | **F:-SPIN with Task-025-exact attach** (wave-timing + letter theories falsified; see §2/§7) |
| T26F5 | usb-attach (2 s) | - | - | v2 | launch flaked (no ALIVE markers; B07) |
| T26F6 | usb-attach (2 s) | G: | F: | v2 (-NoTouchGate, clean xfer) | clean G:-spin (letter rule predicts spin anyway; uninformative) |
| T26F7 | clientwait (45 s) | F: | G: | v2 (-NoTouchGate, clean xfer) | **F:-SPIN with clean xfer + no observer touches** (Procmon/observer-touch theories falsified) |
| C2 | Task-025-exact stack | F: | - | T025 observer | **F:-SPIN — environment regression confirmed** (§7) |

## 2. Headline: the drive-letter hypothesis is falsified (T26F3)

Task 025 concluded F:→iloveaki-gate 6/6, G:→spin 5/5 within its controlled
matrix. T26F3 — with the client mounted as **F:** (bare launch
`"F:\MapleStory.exe"`, working dir F:\, xfer=G:) — **spun**:

- CPU grows linearly at ~0.95 CPU-s/s for the whole 480 s window
  (136.1 s at t0+285 s; user/priv = 47%/53% — Task 025 spin signature);
- working set constant 4,956 KB; 25 threads; initial thread (TID 2140)
  continuously Running at 99.6% of process CPU;
- module set frozen at the 16 pre-game system DLLs (winmm last);
  `iloveaki.dat`/`ijl15.dll`/`MSVCR90.dll` never load; no game window
  ever created (`wins.csv`: only shell/observer windows);
- `aki=False` for the whole run (no modal → no OK click → post-modal
  phase not reached).

Window-state control: during T26F3 an Explorer window (`XFER (G:)`) and
the AutoPlay dialog were open — **identical to Task 025 A1R2 (the
F:-success run), which had the same windows up and still reached the
gate** (verified in A1R2 wins.csv). Window/shell state is therefore not
the variable.

### What T26F3 changed vs the Task 025 success configuration

1. USB enumeration happened in **two waves 45 s apart** (client first,
   then xfer) instead of one wave (2 s apart);
2. the Task 026 observer's gate **touched the client volume more**
   (`certutil -hashfile iloveaki.dat`, `dir /a /s /b F:\` walk) than the
   Task 025 observer did.

T26F4 (Task-025 attach order + full Task-026 observer) was the planned
discriminator (gate → wave-timing causal; spin → observer-gate-touch
causal, to be bisected with `-NoTouchGate`). It **spun**; T26F7 then
falsified the observer-touch/Procmon reading too (§1). Final verdict:
§7 (environment regression).

### Refined causality model

The protector's fork is a **pre-`ijl15.dll` environment check inside the
exe** whose observable correlates (letter, enumeration order, timing)
co-varied in Task 025's matrix. Letter alone is neither necessary nor
sufficient. Classification: **was letter-correlated, now multi-factor
unknown; not needed for progression** (both layouts are reproducible on
demand).

## 3. Pre-click state (modal gate) — from Task 025 + static analysis

(complete state capture lives in T26F1/F4-class runs once one gates; the
static picture from task026-iloveaki-static.md: the modal is
`MessageBoxW` inside the repack stub's DllMain with the loader lock
held.)

## 4. The single authorized OK click

To be executed by Check-Aki (BM_CLICK on the dialog's Button child) in a
gating run; one click only; no other dialog is ever clicked.

## 5. Post-modal timeline / classification

Pending a gating run (see §1/§2). P0–P7 classification per task spec
will be applied to the first successful OK-click run.

## 6. Module watch list status (all runs so far)

Never loaded in any Task 026 run (consistent with Task 025):
`iloveaki.dat`(in spin runs), `PCOM.dll`, `NameSpace.dll`, `Canvas.dll`,
`ResMan.dll`, `ZLZ.dll`, `Gr2D_DX8.dll`, `Sound_DX8.dll`,
`ehsvc.dll`, `AspINet.dll`, `ws2_32.dll`, `wininet.dll` — no game /
network / HackShield module has ever appeared before the modal gate.

## 7. C2 control verdict — environment regression confirmed

The final control re-ran the **exact Task 025 stack** (its orchestrator, its
observer, its staging, its attach order; client=F:, `"F:\MapleStory.exe"`,
same snapshot). It **spun** (CPU 0.062→15.6 s linear over the first 45 s,
WS constant 5,104 KB, no window, no game module —
`.work/task-025/runs/C2/`).

Conclusion: the iloveaki gate is **not currently reproducible by any safe
stack, including the one that reproduced it 6/6 earlier the same day**. The
fork condition (inside the exe's pre-`ijl15.dll` protector stage) is
sensitive to some environmental dimension that all controlled variables
(letters, attach order, enumeration waves, xfer contents, observer
behavior, window state, snapshot identity) failed to capture — a host- or
VM-infrastructure-level regression (22 h container uptime, accumulated
qcow2/USB hot-plug state, or sub-guest timing).

Per the campaign stop rules this is **Stop C for the post-modal phase**:
the environment can no longer produce the evidence; the boundary is NOT a
protection wall requiring prohibited techniques. Re-establishing the gate
likely needs a fresh QEMU process topology / fresh container / rebuilt
xfer image — infrastructure work, not analysis.

Everything else in this file (§1–§6, the falsification matrix) stands as
the systematic characterization of that boundary.
