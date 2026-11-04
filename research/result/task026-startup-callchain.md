# Task 026 — Startup / initialization call chain (best current reconstruction)

Evidence-annotated chain from protector completion toward the Wizet runtime
and (projected) login/network. RVAs are CMS079-local static evidence;
`[runtime]` marks edges observed in Task 024/025/026 runs; `[static]` marks
disassembly-proven edges; `[projected]` marks edges expected but not yet
observed at runtime (blocked at the modal gate / post-modal depth).

## 1. Chain

```text
[1] MapleStory.exe PE entry (protector/repack wrapped)
      T1 -> T2 (aPLib) -> T3 -> stage-2 PE scan -> rounds 1-3
      -> SICE/SIWVID/NTICE probe cluster -> decoders A/B
      -> driver-install block (skipped: no cmdline switches)
      -> 0x862000+ encoded region (pre-game protector stage)
            |  fork input UNKNOWN (correlates that co-varied with it:
            |  client drive letter F:/G:, enumeration waves, timing -
            |  all falsified as necessary/sufficient by T26F3/F4/F7/C2;
            |  one branch -> continue (loads ijl15.dll), other -> spin)
            v
[2] protector reconstructs imports; loads ijl15.dll
      = repack stub (8,192 B; VC9 "UFO" 2012)
            |
            v  [runtime: Task025 F: runs; T26F1]
[3] stub!DllMain (0x10e0) on DLL_PROCESS_ATTACH
      -> LoadLibraryW(L"iloveaki.dat")            [E02/E03]
         = genuine Intel JPEG Library 1.51 @ 0x60000000
      -> GetProcAddress x6 -> export forward slots [E04]
      -> GetModuleHandleW(ntdll) -> ZwCreateMutant [E05/E06]
      -> VirtualProtect + E5 hook at +0x12        [E07; inert on Win7]
      -> MessageBoxW "iloveaki success."          [E08]
            |  = THE MODAL GATE (loader lock held; whole process idle
            |    at 2.6-2.7 CPU-s / 25 threads - Task 025 confirmed)
            v  user clicks 确定 ONCE  [T26F3 in flight -> T027 audit: NEVER EXECUTED; 0/8 T26 runs reached the modal]
[4] DllMain returns TRUE; ijl15.dll load completes
      -> game calls ijlInit/ijlRead... (forwarded to Intel lib)  [E10]
            v  [projected]
[5] Wizet runtime bootstrap via PCOM object model
      -> PcInitModule (PCOM.dll 0x104ca)
         cross-loads NameSpace/Canvas/ResMan/Gr2D/Sound via each DLL's
         self + "PCOM.DLL" name-table entries (PcInitModule contract) [E21]
      -> PcCreateObject (0x4cd1) + per-DLL DllGetClassObject factories [E22]
            v
[6] WZ resource bootstrap
      -> PCOM!PcomListWzPathInit (0x6cc7)
         GetModuleFileNameA -> dir -> List.wz existence check [E20]
      -> NameSpace!WzPackageMount (0x13070)
         PKG1 header check (stream vmethod [eax+0x18], ref 0x137BA),
         PKG%04x.tmp staging, CreateFileA attrs 0xC0000000/0x4000080 [E15]
      -> NameSpace!WzArchiveOpen (0x13729)
         wide-name hash -> stream wrapper vft 0x5080D5BB
         -> LoadLibraryA(PCOM.DLL) + GetProcAddress x5 (late binding)
         -> PcSerializeString (0x6411)
            -> SerializeEntity (0x64e3)
               -> RootNamespaceObj (0x6653)
                  -> write 0x74fc / read 0x7575 per-byte transforms [E11-E14]
            v
[7] WZ payload decode bridge
      -> Canvas!CWzZlzStream family (dtor 0x22910 / init 0x22980 / vft 0x285e0)
         -> ZLZ!ZLZCreateInflator (0xb410) / ZLZCreateDeflator (0xac50)
         -> ZLZ!ZLZCloseFilter (0xb830)                     [E16-E19]
         (ZLZ PDB D:\ACGAME_CN\ztl\ZLZ\... - official ztl base library)
            v
[8] Rendering / audio (structural, [projected])
      -> Gr2D_DX8!CWzGr2DLayer / CWzRawCanvas (vft 0x2e2c4, 151 slots)
      -> Sound_DX8!CWzSound (vft 0x183e8, 64 slots; CWzSoundStateDA/DS/Mute;
         CStreamSource/CStreamFilter/CAcmStream/CPcmStream RTTI) [E23]
            v
[9] Network / login [not reached - all v95 seeds unmatched]
      ws2_32 never loaded in any observed run; no socket ever created.
      Expected anchors once reached: CClientSocket singleton /
      SendLoginPacket / version-79 handshake (15-byte, ports 9555,
      7575-7578, 8600), MapleAES key + IV table + seed F25350C6,
      funnyBytes - all documented server-side in result/01-03.
```

## 2. Edge table

See `result/task026-call-edges.csv` (23 edges; 20 confirmed-static or
confirmed-runtime, 3 high/medium projected).

## 3. Where the chain is currently cut

- **Cut point A (runtime)**: step [3]->[4] — the modal. No Task 026 run
  reached it (B06 environment regression); the authorized single OK click +
  300 s post-modal window live in the observer (Check-Aki) awaiting the
  first gating run.
- **Cut point B (static)**: the exe-interior steps between [1] and [2]
  (the `0x862000+` encoded region incl. the unknown fork check; the
  F:/G: letter reading was falsified by T26F3/F4/F7/C2). No safe
  static channel exists yet (decoder-C producer inside the region itself).
- **Cut point C (semantics)**: steps [5]-[8] ordering is inferred from
  import/export/structural evidence only; runtime module first-seen order
  from a successful post-modal run will pin the real sequence.
