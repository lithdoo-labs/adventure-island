# Task 027 — Main image boundary (MapleStory.exe)

Canonical `5d280cf1…`; ImageBase 0x00400000; SizeOfImage 0x9DA000
(10,330,112 = file size: the protector rewrote the PE so raw offsets equal
RVAs — handy for every dump this task produced).

## Region state after Task 027

| RVA span | Classification | Task 027 state |
| --- | --- | --- |
| 0x001000–0x2CE000 | packed source data (entropy 7.98) | **not a plain aPLib stream at its start** (DC-C1 falsified); no consumer found up to the replay divergence point |
| 0x2CE000–0x7EA000 | **Tail A** — game-image virtual area incl. ZtlTaskMem* slots | still zero in every offline state (0 writes); no game anchors anywhere |
| 0x7EA000–0x818000 | .rsrc | directory tree plaintext (see decoder-targets DC-R1); payloads encoded; bitmaps #125-127 and all version/manifest blobs live in the *virtual tail* — no file bytes |
| 0x818000–0x819000 | .idata | GetLocalTime slot only |
| 0x819000–0x912000 | Tail B — runtime-generated protector code | decode chain fully understood to the probes; **0x862000+ refined: contains post-probe-executable code with deliberate #UD/#GP traps** (0x862E76 = 0F 3F trap, handler 0x862F19 in-region, ZwContinue-resume 0x862E7A); executed range in replay 0x862D92–0x863280+ |
| 0x912000–0x9D8000 | tpuaozxc packed source | T2 stream ends 0x9D634A; the 7KB unread tail = encoded resource payloads (icons/version/manifest), not a second stream |
| 0x9D8000–0x9DA000 | entry + uvrwsdpb | unchanged |

## ZtlTaskMem export slots

`0x5FC19F/0x5FC1B0/0x5FC1C1` — still 16 zero bytes each in every offline
state (`ztl_writes` empty across all replay variants). They remain the best
natural probes for game-image materialization: any runtime observation of
these becoming non-zero/committed equals game-code materialization.

## What moved this task

1. The "0x862000+ is opaque encoded data" reading is now **too coarse**:
   parts of it are executed post-probe through exception-driven control
   flow. Static disassembly of that region must model SEH dispatch or the
   trap bytes look like garbage/entry into encoded data.
2. The post-probe path's shape is now known up to the winmm/timing phase:
   probes -> command line / version / registry -> SEH-trap choreography ->
   winmm + timeGetTime timing loop -> (real guest: continues to import
   reconstruction and the ijl15.dll load; replay: diverges into the Themida
   error reporter).
3. The F/G fork's likely territory narrowed: a post-probe timing/behavior
   phase using `timeGetTime` around the winmm load — consistent with the
   environment-timing regression that closed the gate (B06/B27-1).

## Boundary statement

Static recovery of the game body (Tail A semantics) still requires either
(a) a faithful-enough replay through the timing phase (next: instrumented
data-flow tracing of the resolver gadgets to find the exact check the
replay fails), or (b) runtime progression past the fork (R1/R2), which
materializes Tail A naturally. No prohibited technique is needed or used.
