# Task 025 — Thread activity summary (Phase C, no debugger)

Source: `result/task025-thread-activity.csv` (3,106 rows over runs A1R1, A1R2,
A1R3, A2R1, A3R1; sampled every ~2–6 s of wall time for 150 s per run through the
normal .NET `ProcessThread` API from an elevated same-user observer; no thread
suspension, no GetThreadContext, no stack reads).

## 1. Thread count

Every run, both outcomes: the process starts with 1 thread, and by t0 + 3–5 s
(after the PCA click) it has exactly **25 threads**, which then stays constant for
the whole window. Thread count does not change again; no thread-exit storms, no
additional spawns.

## 2. The hot thread is the process's initial thread

- Spin outcome (A1R1, A1R3 — client disk mounted second, `G:`): one thread (the
  initial thread — first seen at the first sample with CPU already accumulating)
  consumes essentially **all** CPU: e.g. A1R1 73.54 s of the process's 73.87 s
  total (99.6 %). Its state is `Running` at every sample; `WaitReason` is empty
  (only defined in Wait state). User/kernel split ≈ **45 % user / 55 % kernel**
  (A1R1: 33.45/40.09 s; A1R3 similar), mirrored at process level. The other 24
  threads use 0.00 s CPU: 14 sit in `Wait:UserRequest` at priority `Highest`,
  9 in `Wait:ExecutionDelay` at `Normal`.
- Dialog outcome (A1R2, A2R1, A3R1 — client disk mounted first, `F:`): the same
  initial thread performs a bounded **~2.6–2.7 CPU-seconds** of work (≈2.4–2.5 s
  user, ≈0.17 s kernel — i.e. almost entirely user-mode), then the whole process
  goes idle: all 25 threads in `Wait` (`UserRequest` for the modal dialog's message
  loop, `ExecutionDelay` for timers), CPU stops growing for the remaining ~140 s.

## 3. Start-address classification (coarse, honest limitation)

`ProcessThread.StartAddress` on this system (Win7 SP1 x86, PowerShell 2.0 / .NET
2.0) returns `0x776a7098` — inside `ntdll.dll` — for **every thread in every
run**, i.e. the `RtlUserThreadStart` trampoline, not the protector/game entry.
Therefore start-address classification is degenerate: it can attribute the hot
thread's start to neither the MapleStory image nor a protector region beyond
"ntdll trampoline". It is **not** treated as current EIP (it is not), and no
further inference is drawn from it.

## 4. Interpretation

- The busy state is a **single-threaded, continuously-Running loop** on the
  process's initial thread, not a thread pool churn and not an I/O-bound wait.
- The ~45/55 user/kernel split of the spin (vs ~93 % user for the successful
  loader burst) is consistent with a syscall-heavy loop; without stack sampling
  (forbidden here) the split is the only available mode evidence.
- In dialog-outcome runs the loader's entire unpack/verify burst is ~2.6 CPU-s,
  after which the process is purely message-idle — nothing continues in the
  background.

Evidence tags: thread counts/states/CPU splits = **confirmed-runtime**;
"initial thread" identification = **probable** (first-seen + PID-relative TID
ordering); any mapping of the loop to a specific protector stage = **unknown**
(no non-invasive channel can attribute it).
