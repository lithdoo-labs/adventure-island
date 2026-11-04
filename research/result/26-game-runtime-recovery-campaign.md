# Task 026 — Game Runtime Recovery Campaign (final report)

RUN DATE 2026-10-13 · STARTING_HEAD `f8241f5c38bca54f0a07b3e39b05738bdbf5b594`

## 0. Task 026 complete?

Yes — as a campaign, ending on **Stop C (environment regression)** for the
post-modal phase after a systematic falsification sequence, with all other
phases completed. Minimum success criteria met (sync/HEAD recorded,
canonical hash revalidated, Task 025 CSV repaired against raw evidence,
iloveaki success path attempted repeatedly with the authorized OK-click
machinery in place, iloveaki layer statically characterized **and fully
decoded**, milestone/blocker ledgers maintained; function/class recovery
began in-task and produced a reusable dataset).

Highest milestone reached: **M5** (function/class recovery baseline, on
static evidence per task-spec §5 M3's "defensible static boundary" clause).
Runtime progression itself ends at **M1** — the gate mechanism is fully
understood and was historically reproduced (Task 025), but re-entering it
this session was blocked by a VM-infrastructure regression (§5/C2), not by
protection. M6 is partial (DLL-side startup chain; exe-interior + login
edges blocked by 0x862000+).

FINAL_COMMIT / push status: see §10.

## 1. Highest milestone: M5 — Function/class recovery baseline

- **M0 reached** — Task 025 outcomes reproduced under the Task 026 observer
  (T26F2: G:-client spin; T26F3/F4/F7 + C2: F:-client spins — both layouts,
  full windows, clean observer completions).
- **M1 reached** — iloveaki success gate historically reproduced (Task 025
  A1R2/A2R1/A3R1/A2E) and **mechanistically decoded** this task (§3).
- **M2 blocked (Stop C)** — the gate did not reopen under any safe stack
  this session, including the exact Task 025 stack (C2 control spun);
  the authorized OK-click machinery ships in the observer
  (`Check-Aki`) ready for the first gating run (§5).
- **M3 reached (defensible static boundary)** — all 10 Wizet game DLLs
  statically characterized: 46 exports, 59 RTTI classes, 70 collapsed
  vtables, key serialize/mount/decompress chains disassembled
  (task026-function-map.csv / task026-class-map.csv).
- **M4 not reached** — ws2_32/socket/9555 never observed in any run
  (blocker B05).
- **M5 reached** — 115 function rows + 88 class rows; ≥25 game-side
  anchors with two-independent-evidence naming — see §6.
- **M6 partial** — startup chain reconstructed from PE entry to the WZ
  decode bridge with 23 evidence-annotated edges (20 confirmed);
  exe-interior (post-modal depth) and login/network edges blocked.

## 2. Runtime progression

```text
PCA (Run program)                          [confirmed-runtime, all runs]
 → protector loader burst ~2.6 CPU-s       [Task 025 runs; T26F1]
 → ijl15.dll(stub)+iloveaki.dat+MSVCR90    [Task 025 runs; T26F1]
 → "iloveaki success." modal               [Task 025 runs; mechanism §3]
 → single OK click (authorized)            [NOT EXECUTED — see §5]
 → post-modal outcome                      [blocked this session — see §5]
 → first game module (PCOM/NameSpace/…)    [not observed]
 → Winsock/9555                            [not reached — M4]
```

## 3. The iloveaki layer — fully decoded (headline static result)

The "iloveaki boundary" is **not an opaque protector stage**: it is an
8,192-byte VC9 loader stub (`ijl15.dll`, PDB
`C:\Users\UFO\...\IJL15\Release\IJL15.pdb`, 2012-02-17) that:

1. `LoadLibraryW(L"iloveaki.dat")` — the renamed **genuine Intel JPEG
   Library 1.51** (SHA `41d37bfb…`, exports ijlInit/ijlRead/…);
2. forwards all 6 ijl15 exports to it via `jmp [slot]` thunks;
3. resolves `ntdll!ZwCreateMutant` and writes an E5 `jmp` at **+0x12** to a
   `xor eax,eax; ret 0x10` stub (intended anti-single-instance neutering —
   **misaligned and inert on Win7 SP1 x86**: `ZwCreateMutant`'s own
   `ret 0x10` at +0x0C exits first; the patch corrupts the adjacent
   `ZwCreateNamedPipeFile` stub instead — verified against the guest's
   actual ntdll extracted from the install ISO);
4. shows `MessageBoxW(0, L"iloveaki success.", L"iloveaki",
   MB_ICONINFORMATION)` **from inside DllMain** — the whole process idles
   at 25 threads holding the loader lock, exactly matching Task 025's
   frozen-CPU observation.

Clicking 确定 lets DllMain return TRUE; the stub contains no further logic
by construction. Full details: task026-iloveaki-static.md /
-xrefs.csv / -controlflow.md.

**Corollary:** the F:/G: fork lives in the exe's own protector (upstream of
ijl15.dll loading — in the G: layout the stub never loads at all). This
campaign falsified the letter-determinism reading and — via the C2 control —
established that the fork's true input is an environmental dimension not
captured by any controlled variable (§4/§5). Reproducing either branch is
currently hostage to a VM-infrastructure regression; the check itself
almost certainly lives inside the `0x862000+` encoded region.

## 4. Environment findings (F/G/UAC)

| Variable | Status |
| --- | --- |
| F:/G: | **letter determinism falsified** (T26F3/F4/F7 F:-spins); letter↔outcome correlation was real inside Task 025's window but the letter is neither necessary nor sufficient |
| Attach order / enumeration waves | falsified as sufficient (T26F4 exact-order spin; T26F3 two-wave spin) |
| xfer contents (Procmon etc.) | falsified as the trigger (T26F7 clean-xfer spin) |
| Observer gate touches | falsified (NoTouchGate runs still spun) |
| Window/shell state | ruled out (A1R2 gated with same windows up) |
| Snapshot identity | verified unchanged (win7x86-clean 2026-10-13 01:51:24) |
| UAC/parent elevation | single elevated path used throughout; Task 024 historical exception remains untested and moot |
| **Net finding** | **environment regression (C2 control spun with the exact Task 025 stack)** — the fork depends on a dimension below all controlled variables; VM-infrastructure refresh required before any further runtime progression work |

## 5. Post-modal campaign outcome — the gate did not reopen this session

Seven orchestrated runs (T26F1–F7) + one Task-025-stack control attempted to
reproduce the F:-layout iloveaki gate under the Task 026 observer. Every
launched run **spun** (pre-game protector loop) and two launch attempts
flaked. Systematic elimination (full matrix in
task026-environment-matrix.csv):

| hypothesis | run that killed it |
| --- | --- |
| drive letter F: is sufficient | T26F3 (F:-client spin, clientwait attach) |
| Task-025 attach order suffices | T26F4 (F:-client spin, exact usb-attach) |
| Procmon.exe on xfer tripped an analysis-tool scan | T26F7 (F:-client spin, scrubbed xfer) |
| observer pre-launch touches (iloveaki.dat hash, dir walk) | T26F7 (-NoTouchGate, still spun) |
| window/shell state (AutoPlay/Explorer open) | A1R2 gated with the same windows up |

The VM snapshot is verified unchanged (`win7x86-clean` 2026-10-13 01:51:24,
the exact snapshot Task 025 used), the client hash re-verifies canonical in
every guest run, and the visible-window sets are byte-identical to A1R2's.
A final Task-025-stack control (C2) **also spun** — see the verdict below.

Consequences for the milestone ledger: **M2 (post-modal crossing) was not
reached at runtime this session** — recorded as blocked (blocker B06), not
as a code boundary: the modal mechanism itself is fully understood
statically (§3) and the click is authorized; reproducing the gate is an
environmental-reproduction problem, not a protection problem that would
require prohibited techniques.

### C2 control verdict — environment regression (final)

The exact Task-025-stack control (same orchestrator, observer, staging,
attach order; client=F:) **spun** (`.work/task-025/runs/C2/`): the gate is
not currently reproducible by any safe stack, including the one that
reproduced it 6/6 earlier the same day. The fork condition is sensitive to
an environmental dimension below the controlled variables (suspects:
22 h container uptime, accumulated qcow2/USB hot-plug state, sub-guest
timing). This is **Stop C** for the post-modal phase: an infrastructure
regression, not a protection wall; no prohibited technique would even be
relevant. Re-establishing the gate is VM-infrastructure work (fresh
container/QEMU topology, rebuilt xfer image), recommended as the first
step of the follow-up campaign.

## 6. Function recovery

- **115 function candidates** (task026-function-map.csv):
  - confirmed: 34 (T027 audit: recomputed from the CSV; the 36 in an
    earlier draft of this report was a transcription error) — exports
    incl. PcCreateObject/PcInitModule/
    PcSerializeObject/PcSerializeString/PcRootNameSpace/PcTermModule,
    ZLZCreateInflator/Deflator/CloseFilter, ZtlTaskMem*Imp ×3,
    repack layer ×3, CWzSound::AddRef/Release, CWzZlzStream dtor/init, …)
  - high: 8 (PCOM serialize chain 0x64e3/0x6653/0x74fc/0x7575,
    WzPackageMount 0x13070, WzArchiveOpen 0x13729, CWzSound::IsFormatSupported,
    CWzSound::dtor)
  - medium/low: 71 (structural vtable anchors, unnamed big tables)
- Most important anchors: ZLZ inflate/deflate factory pair (WZ decode
  entry), NameSpace PKG1 mount/open chain (WZ archive access),
  PCOM serialize write/read byte transforms (WZ property codec),
  PCOM List.wz bootstrap, Canvas↔ZLZ bridge class, ztl allocator exports
  (materialization probes for the exe game image — they point into the
  zero-filled Tail A virtual range 0x2ce000–0x7ea000, i.e. the game code
  that materializes only after full unpacking).

## 7. Class recovery

88 class rows (task026-class-map.csv): 27 high, 7 medium, 54 low.
Class inventory by RTTI type descriptors + structural vtables:
CWzStream/CWzProperty/CWzList/CWzUOL/CWzArchiveContext (PCOM),
CWzNameSpace(+Property)/CWzFileSystem/CWzPackage/CWzArchive/CWzRawArchive/
CArchiveSource (NameSpace), CWzCanvas/CWzDIBRawCanvas/CWzFont/CWzClipToken
(Canvas), CWzGr2DLayer/CWzRawCanvas (Gr2D_DX8),
CWzSound + CWzSoundStateDA/DS/Mute + CStreamSource/CStreamFilter/
CEnumPins/CEnumMediaTypes/CDACommon/CAcmStream/CPcmStream (Sound_DX8),
CWzVector2D/CVectorAux (Shape2D), ZException. Largest vtables:
Sound_DX8 225-slot, Gr2D 151-slot, Canvas 124-slot, NameSpace 124-slot.
Build has no /GR (no COL metadata) — vtables located structurally via
ctor-store + pointer-run collapse; classes linked via throw-site proximity.

## 8. Startup/login chain

task026-startup-callchain.md + task026-call-edges.csv: 23 edges
(20 confirmed) covering PE entry → protector → ijl15 stub → modal →
(projected) PCOM/NameSpace/WZ mount → Canvas/ZLZ decode → Gr2D/Sound.
Login/network (ws2_32, 9555, handshake, AES/IV anchors) unreached —
all 19 v95 seeds remain unmatched pending exe-side game-code
materialization (blocker B05).

## 9. Static unresolved boundary — 0x862000+

Still the primary static blocker for exe-interior semantics (unchanged from
Task 012c). New relationships established this campaign:
- the exe's only exports (ZtlTaskMem*Imp) point into Tail A — the
  materialization target of the packed game image, downstream of the
  0x862000+ decode stages;
- the F:/G: check also lives on the exe side (upstream of ijl15.dll load),
  i.e. inside the encoded/protected region — same family as Q15/Q18/Q19.
No blind decoder work was done (per task rules); targeted resumption
criteria unchanged.

## 10. Remaining blockers

- **Primary (runtime)**: VM-infrastructure regression that closed the
  iloveaki gate for all safe stacks (B06/C2). Fix is infrastructural:
  fresh container/QEMU topology, rebuilt xfer image, then re-run the
  T026 observer (the OK-click + 300 s post-modal machinery is ready and
  validated end-to-end).
- **Primary (static)**: `0x862000+` decoder-C / exe game-code
  materialization (B05) — unchanged from Task 012c, now with two new
  runtime hooks: the drive-fork check and the ZtlTaskMem* export probes
  both live in/around that region.
- **Secondary**: ~30% orchestrator launch flakiness (OCR false-positives,
  UAC timing — B07; partially mitigated), pull-path nesting quirk in the
  t025 orchestrator (worked around manually).

## 11. Next research direction

One broad direction: **rebuild the VM foundation, then ride the gate.**

1. Recreate the QEMU environment from scratch (fresh container, fresh
   xfer/client images, same snapshot restore) until the Task 025 stack
   gates again; then immediately run the Task 026 post-modal observer
   (click OK, 300 s window, module watch). Every downstream milestone
   (M2→M4 runtime, M6 completion) is downstream of that single fix.
2. In parallel, deepen the DLL-side recovery that this task started:
   name the 70 collapsed vtables' slots via cross-DLL call semantics
   (the serialize/mount/decompress chains give the entry points), and
   extend the call-edges graph — no runtime dependency.
3. When game code materializes, the two ready-made probes pay off
   immediately: the ZtlTaskMem* exports (Tail A materialization) and the
   v95 seed list (CWvsApp/CClientSocket/CLogin + AES/IV anchors).

## 12. Commits / artifacts

- Repaired: result/task025-launch-matrix.csv (+task026-task025-data-repair.md)
- New results: 26-game-runtime-recovery-campaign.md, task026-milestones.csv,
  task026-blockers.csv, task026-post-modal-observation.md,
  task026-post-modal-timeline.csv, task026-function-map.csv,
  task026-class-map.csv, task026-call-edges.csv,
  task026-startup-callchain.md, task026-reference-correlation.csv,
  task026-environment-matrix.csv, task026-iloveaki-static.md,
  task026-iloveaki-xrefs.csv, task026-iloveaki-controlflow.md,
  task026-module-transition.csv
- New reusable script: scripts/maple079_postmodal_observe.ps1
  (guest-side post-modal observer, PS 2.0-compatible)

FINAL_COMMIT: recorded at push time.
