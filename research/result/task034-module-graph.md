# Task 034 — Cross-module architecture (G3)

## 1. The launcher chain (proven from the client tree)

```text
冒险岛HS修正工具.exe   (one-shot HackShield patch — 运行说明 step 1)
单机登陆器.bat:  MapleStory.exe 127.0.0.1 9555      ← the full content
```

**Architecture fact:** the client takes its server address and login port
as **command-line arguments** (`MapleStory.exe <ip> <port>`) — this is the
repack's modification (BY 江浩 2017-09-23, same author as the server), and
it is exactly the surface the project's replay tool drives with
`--cmdline`. `downloadinfo.dat` is a placeholder 404-HTML (patcher
leftover). ASPLnchr/Patcher/Setup belong to the original online-update
path, unused by the single-machine launcher.

## 2. Module classification (from the G0 census)

| Layer | Modules | Evidence |
| --- | --- | --- |
| Game shell (protected) | **MapleStory.exe** | static imports = kernel32 only; high-entropy packed (027-031 VM); exports `ZtlTaskMemAllocImp/Free/Realloc` (the Ztl allocator the DLLs use at runtime) |
| Component framework | **PCOM.dll** | exports `DllGetClassObject/DllCanUnloadNow/PcCreateObject/PcFreeUnusedLibraries/PcInitModule/PcRootNameSpace/PcSerialize…` — the COM-style plugin API |
| WZ resource layer | **NameSpace.dll**, **ResMan.dll** | RTTI: CWzNameSpace/CWzFileSystem/CWzPackage/CWzArchive/CWzRawArchive/CArchiveSource; ResMan (manager) carries only ZException |
| WZ data model | **PCOM.dll** classes | RTTI: CWzProperty/CWzList/CWzUOL/CWzArchiveContext/CWzStream |
| Render stack | **Gr2D_DX8.dll** → **Canvas.dll** → **Shape2D.dll**, **WzFlashRenderer.dll** | RTTI: CWzGr2DLayer/CWzRawCanvas/CWzCanvas/CWzDIBRawCanvas/CWzClipToken/CWzFont/CWzVector2D/CWzShape2D<COM>; Flash renderer exports InitializeFlash/RenderFlash/LoadMediaFile |
| Audio stack | **Sound_DX8.dll**, **WzMss.dll** (+ **mss32.dll** third-party Miles) | RTTI: CWzSound/CWzSoundState{DA,DS,Mute}/CStreamSource/CStreamFilter/CAcmStream/CPcmStream/CDACommon (DirectShow-based) |
| Stream codec | **ZLZ.dll** (repack custom) | exports ZLZCreateInflator/Deflator/CloseFilter; contains the full 256-byte shuffle table + WZ key array (G2) |
| Codec bridge | **Canvas.dll imports ZLZ.dll statically** | the only static engine→engine import edge |
| Anti-cheat stack | HShield/ (HackShield+V3: ehsvc, v3pro32s, asc_*, fse_*, gfs_*), pg.dll (UPX), v3hunt, aossdk | unused by the single-machine path (HS is patched out by 修正工具) |
| Loader stubs | **ijl15.dll** (8KB VC9 stub, Task 026 fully decoded) → iloveaki.dat (genuine IJL 1.51) | unchanged from Task 026 |

## 3. The engine's object model (proven class inventory — see task034-class-census.csv)

All Wizet engine classes are `CWz*` — REAL symbols from RTTI (not
reference-derived):

- **Stream/serialization**: `CWzStream` (present in 6 modules — the shared
  base), `ZException` (the engine's exception type)
- **WZ archive layer** (NameSpace.dll): `CWzArchive`, `CWzRawArchive`,
  `CArchiveSource`, `CWzPackage`, `CWzFileSystem`, `CWzNameSpace`,
  `CWzNameSpaceProperty`
- **WZ data model** (PCOM.dll): `CWzProperty`, `CWzList`, `CWzUOL`
  (user-object-link!), `CWzArchiveContext`
- **Rendering** (Gr2D/Canvas/Shape2D): `CWzGr2DLayer`, `CWzRawCanvas`,
  `CWzCanvas`, `CWzDIBRawCanvas`, `CWzClipToken`, `CWzFont`,
  `CWzVector2D`, `CWzShape2D<IWzConvex2D/PolyShape2D>` COM templates,
  `CVectorAux`
- **Audio** (Sound_DX8): `CWzSound`, state pattern `CWzSoundStateDA/
  DS/Mute`, DirectShow plumbing `CStreamSource/CStreamFilter/CEnumPins/
  CEnumMediaTypes/CAcmStream/CPcmStream/CDACommon`
- Cross-cutting: `_com_error`/`type_info` (compiler runtime), ATL in WzMss

## 4. The dependency graph (static edges proven)

```text
MapleStory.exe (kernel32 only; exports ZtlTaskMem* for the DLLs)
   ├─ (runtime GetProcAddress) PCOM.dll  → PcInitModule/PcCreateObject/…
   │      PCOM → COM factories of: NameSpace / ResMan / Canvas / Gr2D_DX8 /
   │               Shape2D / Sound_DX8 / WzMss / WzFlashRenderer
   ├─ NameSpace.dll → WZ archive/namespace classes
   │      └─ (data model via PCOM CWzProperty family)
   ├─ Canvas.dll ──static──► ZLZ.dll (inflate/deflate + stream crypto)
   ├─ Shape2D / Gr2D_DX8 / WzFlashRenderer (render)
   ├─ Sound_DX8 → DirectShow; WzMss → mss32 (Miles)
   └─ ijl15.dll(stub) → iloveaki.dat (JPEG)
   [anti-cheat stack patched out in the single-machine path]
```

The engine is a **COM-plugin architecture**: every engine DLL exports
`DllGetClassObject`; the EXE (through PCOM's `PcCreateObject`) activates
implementations by GUID (Shape2D's RTTI shows the COM template
`CWzShape2D<&GUID_...>` pairs) — matching the Wizet-era plugin design.
