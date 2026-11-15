# T086.1 Independent Reviewer Report (round T086.1, STRICT-STATIC-ONLY)

Reviewer: independent subagent, blind-first protocol. All derivations below were
produced with my own scripts in `C:\Users\lithd\AppData\Local\Temp\opencode\t0861-reviewer\`
(capstone 5.x, javap JDK 25, git, zipfile) BEFORE reading any main-agent
T086.1 evidence/claim text. The main agent's materials were read only where the
review instructions direct (after each blind derivation), and are marked as such.

Binary identities verified before use (all match the task pins):
- `.work/task-036/game-image-unpacked.bin` sha256 `d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718`
- `.work/task-063/server079.jar` sha256 `49382081ff5525380bc6024f61859d2e08c2983b0faca2554061c6d1218cf360`
- Gr2D context only: `Gr2D_DX8.dll` sha256 `ad67b9a08a0a360e9a31f0274d29b8cb9839d95d691762961454c806ef6a25d1`
Re-hashed again at review end: unchanged. `git status --short`: all modifications
and untracked files are under `research/` only.

---

## R1 (G08 radix) — blind derivation first

My own capstone disassembly of VA 0x9363D9..0x936417 (0x93E7F2..0x93E840,
0x93EF0D..0x93EF30, 0x93E840..0x93E930 for the dec sites):

```
L   = [this+0xF28]
A   = (L != 0) ? L - 0xC : 0            ; neg/sbb/and null-guard
g   = [A+0x130]  (layer)
m   = [A+0x134]  (zM)
f   = [A+0x18]    (flag dword)
K   = 10*(3000*g - m) + ((f!=0)?7:2) - 0x3FFF8ADA
```
(`and eax,5; inc; inc` yields 7 when flag!=0, else 2; `lea edx,[edx+edx*4]`
then `*2` in the final lea is the ×10.)

- lea at 0x936409: bytes `8D 84 50 26 75 00 C0`; **disp32 raw bytes `26 75 00 C0`**
  = 0xC0007526 = **signed −1073711834**.
  Decomposition: −1073711834 = **−(2^30 − 29990)** = −2^30 + 0x7526. **N = 30**
  (N=31 would need B = 1073771814 > 2^30, not a natural constant; and 2^31 =
  0x80000000 ≠ 0x40000000).
- K(layer=0, group=0, flag=0) = 2 − 1073711834 = **−1073711832** (0xC0007528)
- K(layer=0, group=0, flag=1) = 7 − 1073711834 = **−1073711827** (0xC000752D)
- Key-minus-one: **yes** — `lea edi, [eax+ecx*2-0x3FFF8ADA]` sites at
  0x93E82A / 0x93E909 / 0x93EF0D each followed by **`dec edi`** at
  **0x93E87C / 0x93E926 / 0x93EF2A** respectively (I verified edi is not
  recomputed between each lea and its dec), then `push edi` into the
  0x439AAD/0x43286E-family wrappers.

### Comparison with main agent (read after)
- claims.csv C-099 / gaps.csv G08: formula
  `key = 10*(layer*3000 − zM) − 0x40000000 + 29990 + (2 + 5*(flag!=0))` —
  **identical to mine** ((f?7:2) = 2+5*(f!=0); −0x3FFF8ADA = −2^30+29990).
- Anchors −1073711832 / −1073711827 — **match my computation exactly**.
- "-2^31 prose was wrong, true base −2^30" — **AGREE** (N=30 decomposition
  exact, B=29990=0x7526).
- key-1 via `dec edi` at 0x93E87C/0x93E926/0x93EF2A — **AGREE** (all three
  verified, including the third lea at 0x93EF0D).
- forensics/T0861-G08-KEY-CONSTANT-AUDIT.txt disassembly of 0x9363D9..0x93641C
  matches my bytes instruction-for-instruction; disp32 decomposition text
  identical.

**Verdict R1: AGREE (fully verified).**

---

## R2 (G17 ExternalCodeTableGetter) — blind derivation first

My own `javap -p -c` on classes extracted from the jar (javap transcript + my
emulation scripts in temp dir).

### (a) getValue(String, T[], short) two-token semantics — my reading
```
s = props.getProperty(name); if (s == null || s.length() <= 0) return def;
t = s.trim(); parts = t.split(" ");
if (parts.length == 2):
    base = valueOf(parts[0], values).getValue()   // scan array, Enum.name().equals
    if (base == def):                             // def = -2 from populateValues
        base = this.getValue(parts[0], values, def)   // RECURSIVE properties resolve
    tok = parts[1]
else: tok = parts[0]
return (short)(Short.parseShort(tok[2:],16) + base)  if tok starts "0x" and len>2
return (short)(Short.parseShort(tok)      + base)  otherwise
```
**YES**, the two-token relative form `BASENAME offset` is supported. The base is
the **current value of the enum constant whose name() equals parts[0]** (valueOf
linear scan over the array; NPE if absent); when that current value still equals
the default (−2), it **recursively resolves the base name against the same
properties** and uses that. Offsets are decimal or `0x`-hex; result is short sum.

### (b) Declaration ordinals (from `<clinit>` `bipush <ordinal>` immediates)
The compiler emits the ordinal explicitly: `bipush 38` before
SHOW_ITEM_GAIN_INCHAT's `<init>`, `bipush 39` before DOJO_WARP_UP's. So
**SHOW_ITEM_GAIN_INCHAT = ordinal 38, DOJO_WARP_UP = ordinal 39** (of 115 send
constants): **SHOW_ITEM_GAIN_INCHAT is declared first**, immediately before
DOJO_WARP_UP. (RecvPacketOpcode: 114 constants.)

### (c) DOJO_WARP_UP value after populateValues
populateValues iterates declaration order with def = −2. SHOW_ITEM_GAIN_INCHAT
(38) is processed first → `0xD0` = 208. DOJO_WARP_UP (39) = property
`"SHOW_ITEM_GAIN_INCHAT 1"` → base = 208 (≠ −2, no recursion) → 1 + 208 =
**209 = 0x00D1**.

### (d) My join of research/result/protocol-opcodes.csv (442 rows) vs jar properties
Bytecode-faithful emulation (declaration order, def −2, recursive base),
properties parsed by me from the jar:
- rows whose name is an enum member: **329 direct single-token matches**
  (this includes the 2 explicit-0xFF rows PIN_OPERATION/ALL_CHARLIST),
  **1 two-token row (DOJO_WARP_UP → 0xD1, CSV says 0x00D1 — match)**,
  **76 default 0xFFFE (name absent from properties, emulates to −2, CSV −2)**,
  **0 conflicts**.
- **36 rows** are property keys that are **not members of the v079 enums**
  (CSV notes column says exactly that); 9 of them have value 0xFF.
- Reconciliation to the main agent's buckets (355 direct + 11 explicit-0xFF +
  76 FFFE = 442): my 329−2(in-enum 0xFF)=327, +1 two-token, +27 non-enum
  non-FF = 355 direct; 2 in-enum + 9 non-enum = 11 explicit-0xFF; **fully
  reconciled arithmetically**.

### Client-dispatch switch 0xA10CE3 (my own disassembly + my join)
I verified the switch head myself:
`mov edx,[ebp+8]; lea eax,[edx-0x20]; cmp eax,0x60; ja 0xA11184;
jmp dword ptr [eax*4+0xA111A1]` — ids **0x20..0x80** (97 entries).
Using the EV-84 names column from
forensics/T086-G17-CLIENT-DISPATCH-0xA10CE3.txt (per review instructions) and
my own parsing of both properties files:
- 97 ids: 62 real names, 28 UNKNOWN, 7 blank, 5 default (0x2E/0x38/0x39/0x3D/0x75
  → stub 0xA11184 — matches my `ja` target).
- **recvops: 62/62 names present as keys, and all 62 property VALUES equal the
  switch ids (62 aligned, 0 misaligned).**
- **sendops: 15/62 names exist as keys, but 0/62 have sendops value == switch id**
  (the 15 are cross-namespace name collisions with different values, e.g.
  CHANGE_CHANNEL send=0x13 vs id 0x22).
- Names absent from sendops entirely (key+enum): **47/62**.
- Ids with no sendops entry of that value: **39/97 of all ids; 35/92 of
  non-default ("handled") ids**.

### Comparison with main agent (read after)
- C-095 falsification / G17 verified_scope / T0861-G17-PROPERTY-RESOLUTION.txt:
  two-token form supported, base = enum current value with recursive resolve at
  def(−2), decl indices 38/39, DOJO_WARP_UP = 0x00D1, 355+11+76, zero conflicts,
  sendops 0/62, 35 handled ids without sendops meaning — **ALL AGREE with my
  derivation** (their own PROPERTY-RESOLUTION §6 says "match recvops: 62").
- **Count nit**: C-095/G17/T086-report erratum §11.3 say "recvops **61/62**",
  while their own evidence file and my join give **62/62** (I could not
  reproduce a 61st-case miss; possibly a dropped case in their join, e.g. the
  lowercase `quest_KJ`). Direction/conclusion unaffected. → discrepancy #2
  (non-blocking).
- The NEW claim "switch name space aligned with recvops rather than sendops" —
  **CONFIRMED independently** (62/62 value-aligned to recvops vs 0/62 to sendops).
- The public-ms079/Afauria comparisons (366/366 identical; 15 conflicts) require
  external repository fetches — **not independently re-verified** in this review
  (out of static scope; noted, not disputed).

**Verdict R2: AGREE, with one count-consistency nit (61/62 vs 62/62).**

---

## R3 (Evidence hashes) — blind computation first

Six files (my own hashing; `git cat-file blob HEAD:<path>` for blob bytes):

| file | raw sha256 (worktree, CRLF) | CRLF→LF sha256 | HEAD blob sha256 | ledger (evidence.csv) |
|---|---|---|---|---|
| T086-EV82-NODE-CLASS-INSERT-COMPARATOR.txt | 5a62eb9d…c084e0 | f68f7fe9…ba45e | f68f7fe9…ba45e | f68f7fe9…ba45e |
| T086-G17-OPCODE-PROVENANCE.csv | 8091001d…50c08 | e69ea638…d9469 | e69ea638…d9469 | e69ea638…d9469 |
| T086-G17-CLIENT-DISPATCH-0xA10CE3.txt | 10702934…c7e0a | d4957926…25678 | d4957926…25678 | d4957926…25678 |
| T086-G08-KEY-SITES-DISASM.txt | 6b2278b4…6cab2 | bfb10bb9…8705 | bfb10bb9…8705 | bfb10bb9…8705 |
| T086-G09-ZMAP-SMAP.txt | 2c0b3716…55ff1 | 1673db10…0da2 | 1673db10…0da2 | 1673db10…0da2 |
| T086-G10-SLOT15-CALLER-WINDOWS.txt | 676076b4…ee2d9 | 76284498…73802 | 76284498…73802 | 76284498…73802 |

- Raw ≠ normalized for all six (worktree is CRLF); **normalized == blob for all
  six** ✓; **ledger == normalized for all six** ✓ (i.e., ledger now pins the
  git-blob-equivalent bytes).

### My audit of ALL evidence rows (my rule: text → CRLF→LF, binary → raw)
88 evidence rows: **both(raw==norm==ledger) = 20; raw-only = 58; norm-only = 6
(the six T086 text files); neither = 0** among hash-bearing single-file rows.
Non-hash rows: EV-05 / EV-28 / EV-32 are descriptive multi-file corpus rows
(file not on disk — pre-existing convention), and EV-15's `source_sha256` is the
literal placeholder `(in-repo csv)` (also pre-existing in `HEAD`, not a T086.1
regression; the validator skips it via its hex64 filter). No loud failure
warranted against T086.1 state. The 58 raw-only rows are exactly the
binary rows (`.bin` / Gr2D `.dll`) — i.e., binaries are NOT normalized.

### Comparison with main agent (read after)
- `research/scripts/evidence_canonical.py`: rule = "text iff decodes UTF-8 AND
  no NUL byte → CRLF→LF; else raw" — **implemented as documented**, and my
  binary-protection test: `b"\x00\x01\x0d\x0a"` → `is_text=False` → hashed RAW
  (not normalized) ✓.
- `validate_reverse_engineering.py::check_evidence_sha_match` (check 17a) uses
  `canonical_sha256` — consistent with the documented rule; binary rows
  therefore protected. Skips `(in-repo`/`multi`/`corpus` source_file rows and
  non-hex64 sha fields (EV-15).
- `forensics/T0861-EVIDENCE-BYTE-HASH-AUDIT.csv`: all six old→new records
  verified against `git show HEAD:research/source-of-truth/evidence.csv`
  (EV-82..EV-87 in HEAD carry exactly the six `old_crlf_sha256` values = my raw
  hashes) and my computation (new = my normalized hashes). All six records'
  `equals_git_blob=yes` claims confirmed by my blob hashing.

**Verdict R3: AGREE (rule as documented; binaries protected; six records exact).**

---

## R4 (G10 camera) — blind derivation first

My blind notes were written to my temp dir (R4-BLIND-NOTES.md) before reading
T0861-G10-CAMERA-STATIC-SLICES.txt. Key results:

### (a) slot15 @ 0x53471A (thiscall, ret 8)
- `esi = this+0x1CC`; early-out via 0x444866(this+0x1CC, 0).
- Persistent reads: `ecx=[0xBDD6F4]; 0x48AEC3(ecx, &[ebp-0x14])` → holder;
  `X0 = 0x404B07([holder])`, `Y0 = 0x404B2E([holder2])`; and the same two
  getters on `[this+0x1CC]` → X1/Y1. (I later verified 0x48AEC3's body myself:
  `out=[this+0xD4]`, conditional AddRef `call [vt+4]`, ret 4 — confirming the
  "[fieldctx+0xD4] offset object" reading; 0x404B07/0x404B2E are vtable slot 4/5
  calls (+0x20/+0x28) with HRESULT guard.)
- Args [ebp+8]=x, [ebp+0xC]=y are tested against a rectangle:
  `X1+(3−X0) ≤ x ≤ X1+([this+0x1D0]−X0)+5` and
  `Y1+(5−Y0) ≤ y ≤ Y1+([this+0x1D4]−Y0)+5` (margins 3/5/5/5, world bounds
  [this+0x1D0]/[this+0x1D4]).
- Hit: `0x8EE9E7(this+0x218, X1+([this+0x1D0]−X0)+0xA, y, [this+0x6FC])`;
  miss: `0x8EE966(this+0x218)`.
- **Tail**: `ecx=[0xBDD490]; if ≠0: push [ebp+0xC]; push [ebp+8];
  call 0x953B3D` (returns its eax), else return 1 → **forwards (x,y) to
  0x953B3D with this=[0xBDD490] when [0xBDD490]≠0.**

### (b) E8 census in 0x401000..0xA80000 (mine)
- **0x5CB0E0: 1 caller = 0x9EC9EB** (inside 0x9EC989)
- **0x5CABE1: 3 callers = 0x80EF7C, 0x9E6C3A, 0x9EC937**
- **0x9EC924: 24 callers** (list recorded)
- **0x9EC989: 2 callers = 0x4BEDE7, 0x5F1C7D** (matches the claimed addresses)
- 0x53471A: **0 direct E8 callers**; 0x5348C5: **1 direct E8 caller = 0x9EDA8B**
- 0x5CB0E0 body: **clamp present** — x to [0, 0x320=800], y to [0, 0x258=600];
  when [this+0xC]≠0: **[this+0x938]=x', [this+0x93C]=y'**, then 0x5CA91A(this,x',y');
  else 0x5CA91A first + dynamic fallback pair [0xBE1754]/[0xBE1750].
- 0x9EC989: if [0xBDD838]==0 ret; if flag≠0 and [this+0xD4]≠0:
  x −= 0x404B07([this+0xD4]); y −= 0x404B2E([this+0xD4]); then
  `ecx=[0xBDD838]; 0x5CB0E0(x,y)`.

### (c) The two callers of 0x9EC989 and their helpers
- 0x4BEDB2-region fn: `0x4BEE19(&rect, n)` then vtable+0x2C/+0x30 getters,
  `+0x22` margins, `0x9EC989(this=[0xBDD6F4], x, y, flag=0)`.
  **0x4BEE19 = grid computation**: `x1=((n%10)%2)*206+2`, `y1=((n%10)/2)*81+2`,
  `x2=x1+200`, `y2=y1+80` (2×5 grid, 200×80 cells).
- 0x5F1C40-region fn: same template with **0x5F1C88 = grid computation**:
  `y1=20*(n%16)+1`, `x1=2`, `y2=y1+20`, `x2=502` (16-row list, 20px rows).
  Both are **UI-grid placement templates** → confirmed.

### (d) Adversarial searches
1. **Writers of [reg+0x938]/[reg+0x93C]** (mod=10 disp32 forms; SIB forms:
   NONE found in band):
   +0x938 stores at **0x5CB122 (in 0x5CB0E0)** AND **0x5CB71F (in 0x5CB573)**;
   +0x93C stores at **0x5CB128 (in 0x5CB0E0)** AND **0x5CB713 (in 0x5CB573)**;
   CMP at 0x5CB705/0x5CB70B; loads at 0x5CABEC/0x5CABF8, 0x5CB7BE, 0x5CB85C,
   0x5CB868, 0x5CB8E6, 0x5CB908, 0x5CB984, 0x5CB990; LEA at 0x5CA76B (same
   class), and 0x7860BE / 0x78F3E0 / 0x79028E.
   **COUNTEREXAMPLE FOUND**: the function at **0x5CB573** (per-frame update;
   head `edi=[this+0xC]`, je end) computes
   `newX = [this+0x938] + ([this+0x970]+5)*axisX/10`,
   `newY = [this+0x93C] + ([this+0x970]+5)*axisY/10` (axes from an input-state
   object via vtable+0x24 on [this+0xC]; [this+0x970] itself derived as
   `(cfg+1)*250` clamped to [250,1000] at 0x5CB4DE..0x5CB4FC), **clamps to the
   same [0,800]×[0,600]** (0x5CB67E..0x5CB6A3), and **writes
   [this+0x938]@0x5CB71F / [this+0x93C]@0x5CB713** (change-gated by
   cmp/jne at 0x5CB703/0x5CB70B), then calls 0x5CC30A([this+0x9BC]) and
   0x5CA91A(this,…). Same class as 0x5CB0E0 ([this+0xC] flag, 0x5CA91A,
   +0x938/+0x93C). **Instance identity confirmed**: 0x5CB573 is reached from
   dispatcher 0x5CAB38 (case 1 → `call 0x5CB573` at 0x5CAB4E), and 0x5CAB38 is
   called at **0x9FEE24 with `mov ecx,[0xBDD838]`** — i.e., on the SAME
   singleton. The path is additionally gated by a runtime object
   ([0xBE2788] → 0x5CD092 must return ≠0), but it is a statically reachable,
   non-UI, input/velocity-driven writer of the same persistent fields.
   The other +0x93C-only stores (0x6DEC68, 0x7860D9, 0x78F3ED, 0x79029B) are a
   different struct family (`lea edx,[esi+0x938]; call 0x79A8FC; mov
   [esi+0x93C],eax`) — not counterexamples.
2. Direct E8 callers: **0x53471A → 0; 0x5348C5 → exactly 1 (0x9EDA8B)**.
   slot15 0x53471A also appears as an address constant **33×** in
   0xB012B4..0xB026DC (vtable-region; slot 15 ⇒ byte offset 0x3C).
3. `call [reg+0x3C]`: my corrected scan finds **exactly 28 sites** in the band
   (26 `[eax+0x3C]`, 2 `[edx+0x3C]` at 0x9E2670/0x9E4032; all disp8; 0 SIB, 0
   disp32). Shallow receiver provenance: every receiver is a vtable pointer of
   a member object (`[esi]`/`[ecx]`/`[edi]`/`[ebx]`/`[esi-4]`-style loads);
   **none provably scene-family from static shallow tracing** (I found no
   counterexample to the main agent's negative claim, and cannot strengthen it
   to a positive identification either).

### Comparison with main agent (read after: T0861-G10-CAMERA-STATIC-SLICES.txt, C-102/C-101)
Agreements (all verified against my independent decode):
- slot15 full decode incl. margins 3/5/5/5, bounds +0x1D0/+0x1D4, 0x8EE9E7/0x8EE966
  pair, tail-forward to 0x953B3D([0xBDD490], x, y) — **AGREE**.
- 0x48AEC3 = member getter `out=[this+0xD4]` (+AddRef, ret 4); 0x404B07/0x404B2E
  = COM slot 4/5 — **AGREE** (verified bodies myself).
- 0x5348C5 thunk → 0x9535F1 with exactly one E8 caller 0x9EDA8B — **AGREE**.
- 0x953B3D: camera-get 0x9EC924([0xBDD6F4], &pair, 1), lookup 0x97FE3A,
  `[eax+0x6C]` gate, 0x8EE9E7(user+0x2990, x+0x14, y+0x14, …) — **AGREE**
  (spot-verified). 0x9535F1: writes **[user+0x2ED4]/[user+0x2ED8]** — **AGREE**
  (spot-verified).
- Singleton architecture: 0x5CABE1 read ([+0xC] gate, fallback
  [0xBE1768]/[0xBE1764]), 0x5CB0E0 write (clamp 0x320/0x258, store
  +0x938/+0x93C, fallback [0xBE1754]/[0xBE1750]), wrappers 0x9EC924
  (add offset) / 0x9EC989 (subtract offset when flag) — **AGREE**.
- All four E8 census counts (1 / 3 / 24 / 2) and producer addresses 0x4BEDE7,
  0x5F1C7D; grid helpers 206/81/200/80 and /16 base (2,502); +0x22 margins;
  flag=0 — **AGREE**.
- 28 `call [reg+0x3C]` sites, no scene-family receiver — **AGREE** (count
  exact; negative consistent with my shallow provenance).

**DISAGREEMENT (the one substantive finding of this review)**:
- Forensics §4 "**written ONLY through 0x5CB0E0**", §6/§7 "single-funnel
  clamped writer", C-101 t086.1 note "single-funnel clamped writer 0x5CB0E0",
  G10 verified_scope "persistent position +0x938/+0x93C … **written ONLY via
  0x5CB0E0**" — **FALSE as stated**: 0x5CB573 (via dispatcher 0x5CAB38 with
  this=[0xBDD838], called at 0x9FEE24) writes the same fields at
  0x5CB71F/0x5CB713 under the same [this+0xC] gate and the same 800×600 clamp.
  Note their E8 censuses themselves are correct — 0x5CB573 is not an E8 caller
  of 0x5CB0E0/0x9EC989; the error is the exclusivity claim about *field writes*
  (and their falsification criterion "a non-UI producer of 0x9EC989" would not
  have caught it).
- Consequently the bounded conclusion "with current evidence [0xBDD838]
  behaves as a UI/window placement anchor … both producers are UI grids …
  NOT yet the world-follow camera" is **incomplete**: there exists a non-UI,
  input/velocity-driven per-frame writer of the singleton position (a scroll/
  follow-style update: `pos += (speed+5)*axis/10`, speed family [250,1000]),
  gated by the runtime [0xBE2788] object. The G10 status PARTIAL-STATIC itself
  remains justified — indeed strengthened — but the verified_scope text and the
  "UI-anchor" leaning must be corrected, and 0x5CB573 is a concrete static
  candidate for the follow/scroll loop that C-028/G10 say was not found.

**Verdict R4: PARTIAL — everything verified except the "+0x938/+0x93C written
ONLY via 0x5CB0E0 / single-funnel" exclusivity claim, which is refuted by
0x5CB573 (0x5CB71F/0x5CB713). → discrepancy #1 (BLOCKING).**

---

## R5 (Ledger & stage boundary)

- **(a) G10 OPEN-RUNTIME → PARTIAL-STATIC**: the upgrade itself is justified by
  static evidence I independently verified (slot15 consumption chain, singleton
  read/write/offset architecture, producer funnel, censuses) — if anything the
  static picture is *stronger* than the ledger says (0x5CB573). However the
  verified_scope text carries the false "written ONLY via 0x5CB0E0" statement
  (discrepancy #1). Keep PARTIAL-STATIC; correct the text.
- **(b) Status enums**: claims.csv statuses observed {BLOCKED, CLOSED-STATIC,
  OPEN-RUNTIME, OPEN-STATIC, PARTIAL-STATIC, SUPERSEDED}; gaps.csv {CLOSED-STATIC,
  OPEN-STATIC, PARTIAL-STATIC, SUPERSEDED} — **all legal**; no report-level
  labels in enum columns. The single "UNRESOLVED-VERSION-AUTHORITY" occurrence in
  gaps.csv sits in G17's `unresolved_scope` prose (descriptive), not `status`. PASS.
- **(c) C-028**: remains OPEN-RUNTIME, "follow/deadzone/world-to-screen formulas"
  not claimed recovered, falsification unchanged. PASS. (Note: my R4 finding
  shows a candidate follow-style loop at 0x5CB573 exists statically — C-028
  staying OPEN-RUNTIME is conservative and honest, but the next round should
  evaluate 0x5CB573 before any runtime capture.)
- **(d) No silent rewrite**: T086-STATIC-GAP-CLOSURE-REPORT.md retains the
  original body (still contains 7× "2^31") and appends "## 11. T086.1 勘误附录
  （本节由 T086.1 轮追加，原文以上未改动）" covering the radix, the DOJO
  withdrawal, and the client-adjudication narrowing. The ACTIVE
  P0-P4-READINESS-REPORT.md radix line carries the inline marker
  "（C-099；t086.1 勘误：原文误写 2^31，0x40000000=2^30，数值/字节编码不变）"
  — in-place correction with marker, matching the stated precedent. PASS.
- **(e) Commands** (real exit codes):
  - `python research/scripts/generate_cleanroom_deliverables.py` → **EXIT=0**
    (gap stats {CLOSED-STATIC 25, PARTIAL-STATIC 9, OPEN-STATIC 6, SUPERSEDED 1};
    claims=102 gaps=41 evidence=88 retracted=10)
  - `python research/scripts/validate_reverse_engineering.py` → **PASS,
    0 errors / 0 warnings, EXIT=0**
  - `python -m unittest discover -s research/tests -q` → **69 tests, OK,
    EXIT=0** (benign ResourceWarnings only)
- **(f) Hygiene**: `git status --short` lists modifications/untracked files
  **only under `research/`** (14 modified, 11 untracked, all research/); the
  three binary sha256s re-verified unchanged after all runs.

---

## Discrepancy list

1. **BLOCKING** — "persistent position +0x938/+0x93C written ONLY via/through
   0x5CB0E0 / single-funnel clamped writer" (gaps.csv G10 `verified_scope`;
   claims.csv C-101 t086.1 note; claims.csv C-102 §(2) implication;
   forensics/T0861-G10-CAMERA-STATIC-SLICES.txt §4 line "written ONLY through
   0x5CB0E0", §6/§7 "single-funnel").
   Counter-evidence: 0x5CB573 — reached from dispatcher 0x5CAB38 (case 1,
   `call 0x5CB573` at 0x5CAB4E; dispatcher invoked at 0x9FEE24 with
   `mov ecx,[0xBDD838]`) — writes `[this+0x938]` at **0x5CB71F** and
   `[this+0x93C]` at **0x5CB713** (same [this+0xC] gate, same [0,800]×[0,600]
   clamp at 0x5CB67E..0x5CB6A3, change-gated at 0x5CB703/0x5CB70B), computing
   `pos += ([this+0x970]+5)*axis/10` (input axes via vtable+0x24 on
   [this+0xC]; speed [this+0x970] ∈ [250,1000] from 0x5CB4DE..0x5CB4FC), then
   calling 0x5CC30A([this+0x9BC]) and 0x5CA91A(this,…) — an input-driven
   per-frame position update on the SAME singleton, i.e., a non-UI writer and a
   concrete static candidate for the scroll/follow loop.
   Required disposition: correct G10 `verified_scope` and C-102 (and C-101's
   "single-funnel" phrasing) to record the second writer; add 0x5CB573 to the
   G10 next-action list (identify its role vs C-028; note its runtime gate
   [0xBE2788]→0x5CD092); soften the "[0xBDD838] = UI/window placement anchor"
   leaning accordingly. G10 status PARTIAL-STATIC may stand.
2. **NON-BLOCKING** — "recvops 61/62" in C-095 falsification, G17
   verified_scope, and T086 report erratum §11.3, vs **62/62** in their own
   forensics/T0861-G17-PROPERTY-RESOLUTION.txt §6 and in my independent join
   (62/62 names, 62/62 value-aligned, 0 misaligned). Likely one case dropped in
   their ledger-text join (e.g. lowercase `quest_KJ`). Disposition: unify to
   62/62 in the three ledger/report texts.
3. **NON-BLOCKING (observation, not disputed)** — C-095/G17 statements that the
   jar properties are value-identical to public ms079 (366/366) and conflict
   with Afauria on 15 names rely on external public-repository fetches not in
   this repo; this reviewer did not re-fetch them (out of strict-static scope).
   Marked unverified-by-reviewer.
4. **NON-BLOCKING (pre-existing, not introduced by T086.1)** — EV-15's
   `source_sha256` field is the placeholder `(in-repo csv)` (also in HEAD), so
   one ledger row carries no verifiable hash; the validator's hex64 filter
   skips it. Recommend a follow-up to give EV-15 a real canonical hash.

---

## Final verdict

**ACCEPT-WITH-CORRECTIONS**

R1 (G08 radix): AGREE — base −2^30 (N=30, B=29990), anchors −1073711832/
−1073711827, key−1 sites, all byte-exact. R2 (G17): AGREE — two-token form,
ordinals 38/39, DOJO_WARP_UP=0xD1, 442-row join reconciles (355+11+76, 0
conflicts), dispatch namespace = recvops (62/62 value-aligned vs sendops 0/62,
35/92 handled ids without sendops meaning), with the 61/62-vs-62/62 count nit.
R3 (hashes): AGREE — canonical rule implemented as documented, binaries
protected (NUL-byte test passed), normalized==blob for all six, audit CSV's six
old→new records exact. R4 (G10): one substantive refutation — the "+0x938/+0x93C
written ONLY via 0x5CB0E0" exclusivity claim is false (0x5CB573 second writer on
the same singleton with the same clamp), affecting G10 verified_scope wording
and the "UI-anchor" leaning; status PARTIAL-STATIC itself stands. R5: ledger
hygiene, erratum discipline, exit codes (0/0/0), and repo scope all PASS.
