# Task 028 — Concurrency assessment (Phase H)

Question: does the replay's single-threadedness materially affect the
D1 decision region?

## Evidence gathered (whole-run uncapped API log + corridor trace)

1. **Thread-creation APIs: zero.** No `CreateThread`, `_beginthread`,
   `RtlCreateUserThread`, `CreateRemoteThread`, or threadpool calls
   (`TrySubmitThreadpoolCallback`, `RegisterWaitForSingleObject`, …)
   appear anywhere in the 4103-event API log.
2. **Synchronization APIs: zero.** No `WaitForSingleObject` (the
   `ZwWaitForSingleObject` stub exists but is never invoked),
   no events/mutexes/critical-section APIs on the executed path.
   The only two lock-shaped calls (`RtlAcquireSRWLockShared` /
   `RtlReleaseSRWLockShared`) are ntdll-internal, back-to-back inside
   the exception dispatch window (n=18,864,928-18,864,937), a
   single-threaded code path by construction.
3. **Thread IDs: never queried.** `GetCurrentThreadId`/`GetCurrentProcessId`
   stubs exist and are never called on this path.
4. **APC/timer callbacks: none.** `timeBeginPeriod` is never called
   (relevant also to the timeGetTime resolution model), no
   queue-user-APC, no timer-queue APIs.
5. **Interlocked state shared with another thread: none observable.**
   The corridor's memory-read surface contains only the VM's own stack
   and Tail B cells; no cross-thread communication structures exist on
   the path, and the 26 walk items' read sets are identical instruction
   for instruction.
6. **Sleep(50)** (n=19,389,422) is the only yielding call; it is a plain
   timed sleep with no other thread to run.

## Conclusion

Single-threadedness is **downgraded to a non-cause** for the D1
divergence: the executed protector path is single-threaded by its own
construction, and no concurrency semantics are exercised that the replay
could get wrong. (The real client later creates ~25 threads per the
historical runtime observation, but that happens long after the D1
region — the module timeline shows the thread explosion begins at the
game/bootstrap stage, not in the post-probe corridor.)
