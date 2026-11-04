# Task 034 — Client Game-Logic Architecture Census Campaign

## Objective

Continue from Task 033 (protocol layer complete) back to the CLIENT side.

The project's remaining open client-side goal is the **game logic code
architecture** (README goal 5). Task 031 proved the main-EXE protector
route offline-closed (Stop C three-sided), so the game body inside the VM
cannot be reached by faithful replay. But the architecture AROUND it is
reachable and only baselined (Task 026: 59 RTTI classes / 70 vtables /
115 functions across 10 Wizet DLLs, M3 "defensible static boundary"):

```
complete module census (20+ PE modules; the 026 baseline covered 10)
 -> FULL RTTI/vtable census on every statically-readable game module
    (every class, inheritance chains, every vtable, export surface)
 -> protocol-anchor binary search: the now-complete wire-format constants
    (AES key / IV table / IV seed / version words 0x4F00·0xB0FF / the
    RENUMBERED opcodes 0x01·0x02·0x09·0x0A·0x0B / hello prefix / GBK
    server strings) across every module AND the statically-present EXE
    regions — locating or excluding the client codec & login logic in
    reachable code
 -> cross-module architecture: which module imports which, startup
    order (launcher chain: ASPLnchr/单机登陆器 → MapleStory.exe), the
    Wizet engine layering
 -> naming with the two-evidence rule (v95 reference + protocol
    semantics + strings)
 -> the architecture document: a layered map of the whole client —
    engine (proven per-module) / framework (proven) / game body
    (protected; structure documented as reference-derived and clearly
    separated)
```

Every claim tagged: `proven-in-module` / `reference-derived` /
`unreachable(EXE-VM)`.

## Milestones

- **G0** module census — every PE in the client folder classified
  (Wizet engine / repack-custom / 3rd-party / stub), protection status,
  RTTI availability
- **G1** full class census — complete RTTI/vtable extraction from every
  statically-readable game module (supersedes the 026 baseline; target:
  every class with inheritance chain + vtable)
- **G2** protocol-anchor search — the wire-format constants located or
  excluded per module (binary anchors from Tasks 002/032/033)
- **G3** cross-module architecture — import/export dependency graph +
  launcher/startup chain + Wizet engine layering
- **G4** two-evidence naming — classes/functions named via v95 +
  protocol semantics (extends 026's ≥25 anchors)
- **G5** architecture document — the layered client map with the honest
  boundary (EXE game body: reference-derived structure only)

Honesty rules inherited: no inflated claims; reference material is
names/structure only; artifacts only when reached; the protected client
is never run in this task (static analysis only).

## Main Work

### 1. Module census (G0)

- Parse every PE in `.work/task-001/extracted/冒险岛online/` (and
  HShield/redist subfolders): machine, sections (names/entropy/flags),
  imports, exports, TLS, presence of RTTI (.?AV strings), themida/ASPack
  signatures, debug directory (PDB paths — 026 used this on ijl15).
- Classify: Wizet engine (Canvas/Gr2D_DX8/NameSpace/PCOM/ResMan/Shape2D/
  Sound_DX8/WzMss/WzFlashRenderer), repack-custom (ZLZ, ijl15 stub,
  iloveaki.dat), 3rd-party (SkinH_EL, mss32, aossdk, pg, v3hunt, suipre,
  bz32ex), launchers (ASPLnchr, Patcher, Setup, HS修正工具,
  单机登陆器.bat).

Create: `result/task034-module-census.csv`

### 2. Full class census (G1)

- For every statically-readable game module: extract ALL RTTI type
  descriptors (.?AV names), reconstruct inheritance (TypeDescriptor →
  BaseClass chains), link every CompleteObjectLocator → vtable, count
  slots, record constructor candidates and key virtuals (extending the
  026 method to completeness).
- Include WzFlashRenderer.dll and ZLZ.dll (026 gave ZLZ only 1 row).

Create: `result/task034-class-census.csv` (full), summarized in the report.

### 3. Protocol-anchor search (G2)

Binary-search every module and the statically-present EXE sections for:
- the AES key dword array `13 00 00 00 08 00 00 00 06 00 00 00 B4 00
  00 00 …` and IV-table prefix `EC 3F 77 A4 45 D0 71 BF B7 98 20 FC 4B
  E9 B3 E1` and IV seed `F2 53 50 C6` (Task-002 seeds)
- version words `00 4F` / `FF B0` near shuffle-code patterns; the hello
  prefix `0D 00 4F 00 00 00 46 72 7A`
- the renumbered login opcode words `01 00 / 02 00 / 09 00 / 0A 00 /
  0B 00` in push/mov contexts
- GBK strings from the recovered flows (欢迎来到怀旧岛, the channel names),
  `9555`, `7575`, `127.0.0.1`, the server-host strings
- Negative results are ARCHITECTURE FACTS (codec lives in the protected
  EXE) — record per-module hit/miss.

Create: `result/task034-anchor-search.csv`

### 4. Cross-module architecture (G3)

- Import graph among client modules (who loads whom, at what depth);
  export surfaces of the engine DLLs (the API the EXE calls).
- Launcher chain: 单机登陆器.bat → ? ; ASPLnchr.exe statics; how
  MapleStory.exe is expected to start (command line/IP config in the
  bat/config files).
- Wizet engine layering from the census (render: Gr2D/Canvas/Shape2D/
  WzFlashRenderer; audio: Sound_DX8/WzMss(+mss32); resources:
  ResMan/NameSpace; framework: PCOM).

Create: `result/task034-module-graph.md`

### 5. Two-evidence naming (G4)

- Correlate census classes with `reference/maplestory-symbols`
  (client structs + seeds CSV) and with the recovered protocol flows
  (which class must consume which packet family).
- Update the seeds CSV statuses where a match is now supported by
  binary anchors (or record "no reachable CMS079 counterpart — EXE").

Create: `result/task034-naming.csv`

### 6. Architecture document (G5)

Create: `result/task034-client-architecture.md` — the layered map:
launcher chain → EXE shell (protected; VM boundary facts from 027-031)
→ engine DLL layers (proven classes/exports per module) → game body
(reference-derived structure: CWvsApp/CClientSocket/CLogin/CField/CUser
families; which protocol flows each handles, tied to the 033 chain).

## Restrictions (inherited + task-specific)

- **Static analysis only**: the protected client is NOT run, NOT
  debugged, NOT dumped in this task (all 027-031 constraints stand).
- No committing of any original client binary/WZ/DLL — only normalized
  text/CSV findings and project-owned scripts.
- Reference material: names/structure only; never addresses copied into
  CMS079 conclusions; every reference-derived row labeled.
- Loopback server work only if a live check is ever needed (not
  expected — this task is static).

## Operational machinery (inherited)

Sync gate (clean tree, ff-only, STARTING_HEAD); `.work/task-034/`
scratch; mandatory reading: `result/26-game-runtime-recovery-campaign.md`,
`result/task026-class-map.csv`, `result/task026-function-map.csv`,
`result/task033-protocol-chain.md`, `result/task033-opcodes` tables,
`reference/maplestory-symbols/**`; time budget 8-16 h (G0 10%, G1 30%,
G2 20%, G3 10%, G4 10%, G5 10%, buffer 10%); stop conditions A-D as
before; commit message `Complete Task 034 client game-logic architecture
census campaign`; never force push.

## Final Report

Create `result/34-client-architecture-census.md` +
`task034-milestones.csv`, `task034-blockers.csv`,
`task034-progression-timeline.csv`. The report must state: census
coverage; the anchor-search verdict (where the codec lives); the layered
architecture; naming coverage; strongest finding / uncertainty /
blocker; next direction.

The most important question Task 034 must answer:

```
"Can the client's game-logic architecture be COMPLETELY mapped from the
reachable modules — engine layering proven, protocol anchors placed or
provably excluded, and the protected game body's structure documented
from reference — giving the project the full architecture picture with
every claim's evidence class explicit?"
```
