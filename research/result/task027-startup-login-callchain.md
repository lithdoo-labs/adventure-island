# Task 027 — startup / login call chain (updated)

Evidence-annotated continuation of `result/task026-startup-callchain.md`.
`[confirmed-static]` = disassembly/replay-proven; `[replay]` = proven in the
Task 027 faithful replay; `[runtime]` = observed in guest runs;
`[historical-runtime]` = Task 025 era only; `[projected]` = expected, not
observed.

## 1. Chain

```text
[1] PE entry (jtrppsow @0x9D8000)                                [confirmed-static]
      T1 -> inline aPLib depacker (0x912116, T027 traced)         [confirmed-static]
      -> T2 depack into Tail B (SHA 5529577e… reproduced)
      -> T3 -> MZ/PE scan (kernel32 @0x76180000 guest base)
      -> rounds 1/2 (walker/slots) -> round 3 (probe cluster decode)
[2] SICE/SIWVID/NTICE probes via resolver 0x8595E7                [confirmed-static + runtime]
      all devices absent on the real guest -> miss branch
[3] post-probe phase (Task 027 NEW):                              [replay]
      GetCommandLineA (n=14.2M) -> GetVersionExA (n=17.3M)
      -> RegOpenKeyA (n=18.0M) -> obfuscated resolver walk (0x84B-0x857)
[4] SEH trap choreography (Task 027 NEW):                         [replay + runtime RVA match]
      frame installed -> deliberate #UD at 0x862E76 (0F 3F)
      -> real ntdll dispatch -> handler 0x862F19 (decoded region)
      -> ZwContinue resumes at 0x862E7A
[5] winmm + timing phase (Task 027 NEW):                          [replay + runtime module-timeline match]
      LoadLibraryA(winmm.dll) [4th module]
      -> GetProcAddress(timeGetTime) -> timing loop (many samples, Sleep)
[6] fork input region:                                            [inferred]
      the F:/G:-correlated fork (continue-vs-spin) lives in/after the
      timing phase - exactly where the replay diverges (Themida error
      reporter) and where the real guest's module timeline freezes
[7] import reconstruction loads ijl15.dll (repack stub)           [historical-runtime + static]
[8] stub!DllMain -> iloveaki.dat -> "iloveaki success." modal     [historical-runtime + static]
[9] (authorized single OK click)                                  [never executed in any observed session]
[10] PCOM/Wizet bootstrap -> WZ -> Canvas/ZLZ/Gr2D/Sound          [projected]
[11] ws2_32 / CClientSocket / login -> 9555 handshake             [projected; server side verified]
```

## 2. Edge table

`result/task027-main-call-edges.csv` — 16 edges: 11 confirmed
(confirmed-static / +runtime / +replay), 4 projected, 1 not-started.

## 3. Current cut points

- **Cut point A (runtime)**: step [5]->[6] — the timing/fork phase. The
  replay reaches it but diverges (emulation detection); the real guest
  freezes here in spin runs and passes here in the historical gate runs.
- **Cut point B (static)**: same place — the exact comparison inside the
  obfuscated resolver walk that the replay fails is the next static target;
  the tooling to trace it now exists (`scripts/maple079_full_replay.py`
  + dumped-image disassembly).
- Cut point C (downstream): everything past [8] remains projected; no
  post-modal runtime evidence has ever been captured.
