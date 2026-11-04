# Task 034 — The client game-logic architecture (G5)

Every claim carries its evidence class: **[proven-in-module]** (binary
evidence in a reachable client module) · **[proven-live]** (Tasks
032/033 loopback) · **[reference-derived]** (v95 bundle, names/structure
only) · **[unreachable(EXE-VM)]** (inside the protector boundary proven
closed, Tasks 027-031).

## 1. The layered architecture

```text
┌────────────────────────────────────────────────────────────────────┐
│ LAUNCHER  单机登陆器.bat → MapleStory.exe <ip> <port>              │
│           [proven-in-module] cmd-line server address (repack mod)  │
├────────────────────────────────────────────────────────────────────┤
│ GAME SHELL + GAME BODY      MapleStory.exe (VM-protected)          │
│   static: kernel32 only; exports ZtlTaskMem{Alloc,Free,Realloc}Imp │
│   [proven-in-module] — the Ztl core allocator the DLLs consume     │
│   CWvsApp / CClientSocket / CLogin / CStage / CField / CUser …     │
│   [reference-derived structure; unreachable(EXE-VM)]               │
│   packet codec: AES key + IV seed provably absent from all         │
│   reachable modules [proven-absent] → codec lives here             │
├────────────────────────────────────────────────────────────────────┤
│ COMPONENT FRAMEWORK   PCOM.dll                                     │
│   PcInitModule / PcCreateObject / PcRootNameSpace / PcSerialize …  │
│   data model: CWzProperty / CWzList / CWzUOL / CWzArchiveContext   │
│   [proven-in-module]                                               │
├────────────────────────────┬───────────────────────────────────────┤
│ WZ RESOURCE LAYER          │ RENDER STACK                          │
│  NameSpace.dll             │  Gr2D_DX8 (CWzGr2DLayer)              │
│   CWzArchive/RawArchive    │  Canvas  (CWzCanvas/DIBRawCanvas/     │
│   CArchiveSource           │           ClipToken/Font)             │
│   CWzPackage/FileSystem    │  Shape2D (CWzVector2D/Shape2D COM)    │
│   CWzNameSpace(+Property)  │  WzFlashRenderer (Flash in WZ)        │
│  ResMan.dll (manager)      │  [proven-in-module]                   │
├────────────────────────────┴───────────────────────────────────────┤
│ STREAM CODEC   ZLZ.dll (repack custom)                             │
│   ZLZCreateInflator/Deflator/CloseFilter; full 256B shuffle table  │
│   + obfuscated WZ-key array [proven-in-module]                     │
│   statically imported by Canvas.dll [proven-in-module]             │
├────────────────────────────────────────────────────────────────────┤
│ AUDIO   Sound_DX8 (CWzSound + State{DA,DS,Mute}, DirectShow)       │
│         WzMss (ATL) → mss32 (Miles Sound System)  [proven]         │
├────────────────────────────────────────────────────────────────────┤
│ LOADER   ijl15.dll stub (8KB VC9) → iloveaki.dat (genuine IJL)     │
│          [Task 026 fully decoded]                                  │
│ ANTI-CHEAT  HShield(HackShield+V3)/pg/v3hunt/aossdk — patched out │
│             by 冒险岛HS修正工具 in the single-machine path           │
└────────────────────────────────────────────────────────────────────┘
```

## 2. Where the game logic actually lives (the honest boundary)

The **engine** (rendering, WZ resources, audio, serialization, component
framework) is fully mapped with real class symbols (64 RTTI names,
proven-in-module). The **game logic proper** — CWvsApp main loop,
CClientSocket networking, CLogin/CField/CUser handlers, the opcode
dispatch — lives in MapleStory.exe behind the VM, unreachable offline
(Tasks 027-031, three-sided proof). What we CAN state about it:

- It drives the engine **through PCOM's COM factories** (`PcCreateObject`)
  and consumes `ZtlTaskMem*` from the EXE's own exports — the DLL side is
  the plugin surface the game body activates.
- Its networking speaks the exact protocol proven in Tasks 032/033
  (server-first hello, 0x4F00/0xB0FF header words, AES-OFB + shuffle,
  renumbered opcodes, login-close-then-migrate). The **codec constants
  provably absent** from every reachable module pin the codec to the
  EXE interior (with CClientSocket per the v95 structure).
- Its structure (class families, field offsets) is documented from the
  v95 reference and correlated to each proven protocol flow in
  `task033-client-dispatch-map.csv` — every such row stays labeled
  reference-derived.

## 3. The architecture facts discovered this task

1. **The client takes `<ip> <port>` from the command line** (repack
   modification) — the launcher bat is literally
   `MapleStory.exe 127.0.0.1 9555`.
2. **MapleStory.exe exports the Ztl allocator** (ZtlTaskMemAlloc/Free/
   ReallocImp) — the engine DLLs get their memory from the game shell.
3. **The engine is a COM-plugin system** — every engine DLL exports
   `DllGetClassObject`; PCOM is the activator; Shape2D's RTTI shows
   literal COM template instantiations with GUIDs.
4. **ZLZ.dll is the stream codec module** (repack custom): full 256-byte
   shuffle table (byte-identical to the packet codec's FUNNY_BYTES) plus
   the obfuscated WZ key; Canvas imports it statically. The WZ/stream
   decryption stack is therefore reachable and analyzable end-to-end.
5. **The packet AES key is nowhere reachable** — the strongest possible
   static statement short of entering the EXE.

## 4. Net assessment against the campaign goal

The user-facing goal — "完整解析游戏逻辑代码架构" — is answered as:
the client's architecture is now **completely mapped around the
protector boundary**: every reachable module censused (61 PEs), every
engine class named (64 real symbols), the codec/launcher/framework facts
pinned, and the protected game body's structure documented from
reference and correlated to the proven protocol chain. What remains
inside the VM stays explicitly marked unreachable — by evidence, not by
lack of trying.
