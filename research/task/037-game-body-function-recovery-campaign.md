# Task 037 — Game-Body Function-Level Recovery Campaign

## Objective

Continue from Task 036: the game body is recovered (10,330,112-byte
materialized image at base 0x400000, protocol-verified) but unread.
This campaign reads it — the first function-level analysis of the
CMS079 client's own game code:

```
F0 image normalization — memory-image form: section map, import
   reconstruction (in-memory IAT -> DLL!export via the 84-image census
   + the Task-027 guest DLL set; the original INT may survive in-image)
F1 function census — prologue-scan function boundaries, string table,
   anchor-xref database (every 032/033 protocol anchor -> its code)
F2 codec/socket cluster — the CClientSocket family: packet-header
   construction (0x4F00/0xB0FF words), IV rolling, AES-OFB + shuffle
   use, the send/recv path, socket lifecycle
F3 login cluster — the packet builders around the proven push sites
   (CHARLIST 0x45EC75 / PLAYER_LOGGEDIN 0x45EDDB / CHAR_SELECT
   0x7B3713 / the LOGIN_PASSWORD/SERVERLIST sites): CLogin's send
   functions and their callers
F4 dispatch discovery — the s2c handler table (indexed dispatch on
   the renumbered opcodes)
F5 CSecurity characterization — the client's own anti-tamper module
   (13 RTTI classes), via TD xrefs
F6 naming + integration — two-evidence naming ledger (protocol
   semantics + v95 structure + in-image evidence); update the client
   architecture with REAL addresses
```

All work is static analysis of our own authorized capture (`.work/
task-036/game-image-unpacked.bin`); nothing binary committed.

## Milestones

- **F0** imports resolved (or provably absent) for the whole image
- **F1** function census + anchor xref database delivered
- **F2** codec cluster decoded to method level (the send path named)
- **F3** login cluster decoded (builders + call graph to UI/login flow)
- **F4** dispatch table located and mapped (or its absence honestly
  recorded with the evidence)
- **F5** CSecurity mapped (classes -> code regions -> behavior class)
- **F6** naming ledger + updated architecture docs

## Main Work

Tooling: extend `.work/task-035/disasm_helper.py` to a memory-image
mode (RVA == carved offset; IAT = runtime VAs annotated via the image
census + guest DLL export tables).

### 1. F0 — normalization

- Parse the carved PE headers; record section map + entry point.
- Locate the import directory (original descriptors may be intact);
  for each IAT slot compare runtime VA vs INT names; resolve every
  runtime entry via census-DLL export tables (guestdll set).
- Output `result/task037-imports.csv`.

### 2. F1 — census

- Prologue scan (`55 8b ec`, `8b ff 55 8b ec`, hot-patch `mov edi,edi`)
  + call-target collection → function list with extents.
- String census (ASCII + GBK + UTF-16LE) with xrefs.
- Anchor DB: for every protocol constant (opcodes, IV seed, FUNNY
  tables, header words, hello prefix) → xref sites.
- Output `result/task037-function-census.csv` (summary stats + key
  functions; full list stays in .work).

### 3. F2 — codec/socket cluster

- Disassemble around the FUNNY tables (0x7A0630/0x7D4130) and IV seed
  (0x659092): find the cipher init + the header-build + the IV-roll
  functions; link to ws2_32 send/recv call sites (IAT-resolved).
- Name the CClientSocket-family methods with the v95 correlation
  (SendPacket/OnRead/OnPacket), two-evidence rule.

### 4. F3 — login cluster

- Disassemble the builders at/near the proven push sites; recover the
  COutPacket-style construction, the caller chain up to the login UI
  flow; correlate with the 033 client-behavior spec rows.

### 5. F4 — dispatch

- Hunt the s2c switch/jump-table: constant-indexed indirect branches
  matching the renumbered s2c values; or the opcode→handler map in
  .data. Record evidence either way.

### 6. F5 — CSecurity

- RTTI TD xrefs → constructors → module extent; classify behavior
  (string tables, API usage) — the anti-tamper layer that HShield
  complements.

### 7. F6 — ledger + docs

- `result/task037-naming.csv`; update the architecture summary with
  in-image RVAs.

## Restrictions (inherited + specific)

- Static analysis only; no VM runs needed this task (the capture is
  the corpus); if a re-capture is ever needed, the 036 method applies.
- Nothing binary committed; findings/CSV/scripts only.
- v95 correlation = names/structure only, labeled.
- Honest reporting for F4/F5 boundaries.

## Operational machinery (inherited)

Sync gate; `.work/task-037/` scratch; mandatory reading: Task 036
results (esp. materialization-record), `task033-protocol-chain.md`,
`task035-client-behavior-spec.md`, `.work/task-035/disasm_helper.py`;
time budget 8-16 h (F0 10%, F1 20%, F2 25%, F3 20%, F4 10%, F5 10%,
F6 5%); stop conditions A-D; commit message `Complete Task 037
game-body function recovery campaign`; never force push.

## Final Report

`result/37-game-body-function-recovery.md` + milestones/blockers/
timeline. Must state: census coverage; the codec cluster's decoded
shape; the login cluster's call graph; dispatch verdict; CSecurity
map; naming coverage; strongest finding / uncertainty / blocker; next
direction.

The most important question Task 037 must answer:

```
"Can the recovered game body be read to method level at its anchor
clusters — codec, login, dispatch, security — turning the protocol
layer's semantics into named client code and completing the project's
original goal of parsing the client's game logic?"
```
