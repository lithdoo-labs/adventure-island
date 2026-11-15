# T088.1 INDEPENDENT REVIEWER - BLIND PHASE / ADVERSARIAL RE-REVIEW / FINAL RE-VERIFICATION

Reviewer: independent read-only sub-agent (session ses_e1fee5980ffeKvycp0mbkPx0Gi), own temp dir, own capstone scripts. Repo files audited at pinned SHA 60f1ee92 via git show during the blind phase; the working tree was NOT read until Phase 2 (after the lead declared the fix set complete). The text below is the reviewer's own record, committed verbatim by the lead.

---

# PHASE 1 - BLIND NOTES (verbatim, written BEFORE any T088.1 fix was visible)

# T088.1 — Independent Static Evidence Reviewer — BLIND NOTES

Reviewer: T088.1 subagent (blind phase; lead's T088.1 conclusions NOT consulted — they did not
exist when this audit started; the only committed inputs read were the T088 baseline artifacts
pinned at the audit SHA).

- Audit target (pinned tree): git SHA `60f1ee92e34e3de636619e595fc87d954e162407`
  (repo `C:\Users\lithd\Documents\GitHub\adventure-island`, branch design/adventure-field-map-scene).
  All repo text read via `git -C <repo> show 60f1ee92...:<path>` (raw blob bytes, dumped to
  `pinned\*.raw` in this temp dir). Working tree NOT modified (read-only audit).
- Binaries (read directly from working tree, SHA-256 independently recomputed 2026-11-16):
  - EXE `.work/task-036/game-image-unpacked.bin`
    `d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718` — VERIFIED (10,330,112 bytes)
  - Shape2D.dll `9802baccd787543221391b4b902ce199e99fb2cde6a4edadc2f4972490c8111b` — VERIFIED
  - PCOM.dll `cf3807f3107152d3b305bfc84be36d58b62306c94f60133c8e80fd17f9d9e54b` — VERIFIED
    (Shape2D/PCOM loaded only for hashing; no instruction claims made against them in this audit.)
- Tools: Python 3.14.4, capstone 5.0.7 (available; all x86-32 decoding via capstone CS_MODE_32).
- Image geometry used throughout: VA = file offset + 0x400000; .text band = file offsets
  0x1000..0x7EA000 (VA 0x401000..0xBEA000); image VA extent ends at 0x400000+0x9DA000 = 0xDDA000.

Verdict summary (detail per task below):
- B1 CONFIRMED DEFECT: census `create_call_va` column is systematically true-VA + 0x400000 (all 76 rows).
- B2 CONFIRMED: 4 empty rows; reasons decoded (3 use 0x31D as an integer id-range endpoint, 1 consumed beyond window).
- B3 CONFIRMED CORRECT in committed CSV: real arg2/out-slot at 0x69213A is `[ebp-0x10]` (row already right; `edi` is arg3).
- B4 CONFIRMED: 63 push + 17 mov = 80 sites; all 80 are true instruction starts (seed cross-validation).
- B5 CONFIRMED + EXTENDED: 33 family tables; ONLY base table 0xB01278 occurs in .text — 6 instruction-level
  imm32 refs, of which 4 are installs (0x52F1BC, 0x52F1CF, 0xA0B39E, 0xA0BB2A); the committed narrative
  lists only 3 (misses 0x52F1BC). wp4's install-search regex is PROVABLY VACUOUS.
- B6 CONFIRMED + CORRECTED: true +0x1CC census = 31 mov/lea and **10** direct writers (committed: 30 and 9);
  missed writer = 0x952ECE `mov [ebx+0x1cc],eax`. The "no writer installs a family vtable" negative HOLDS
  for all 10 writers (whole-text granularity), but is vacuous per-writer for 0x60088A (fn unresolved).
- B7 RESOLVED: true mov/lea = 31; committed md "30" undercounts (wp4 probe defect); EV-97's "31" is right,
  but EV-97/T088-report "9 writers" is wrong (10).
- B8 CONFIRMED: stale numbers persist as CURRENT text in readiness report line 104 (2/10/2/25 and
  35/39 "33 default + 2 VT_EMPTY"), T088 report §2.2 (10/2), EV-93 interpretation tail ("= 35/39
  immediate-class"), G10 unresolved_scope ("33 family vtables have no imm32 code ref"), EV-97/report
  ("9 direct writers" — should be 10).
- B9 CONFIRMED: C-103 and C-028 still assert the falsified "world-space"/"only place a deadzone could live"
  reading without superseded markers; C-103's promised T088 revision (erratum note + EV-93/94 refs) is ABSENT
  from the committed ledger; C-106 reasoning contains a verbatim DUPLICATED sentence.
- B10 ALL MATCH: 4 evidence hashes + 2 companion hashes reproduce exactly (CRLF→LF canonical rule).

---

## B1 — census `create_call_va` VA-vs-offset discipline

**Method.** Read the committed generator `research/scripts/t088_wp1_id31d_census.py` at the pinned
SHA. `decode_attach` (lines 89-117) disassembles `img[resolve_off:resolve_off+0x90]` with capstone
base `resolve_off + BASE` and returns `insns[call_idx].address` — **already a VA**. Its own comment
(lines 92-94) says: "capstone addresses are already VAs … — do NOT add BASE again". But the CSV
writer (line 249) formats `f"{call_off + BASE:#010x}"`, adding BASE a second time. Independently:
for every census row I re-derived the true call by linear capstone decode from the resolve site
itself (identical window semantics to the committed script) and verified the E8 rel32 arithmetic
byte-explicitly (`img[tva]==0xE8`, `tva+5+rel32 == 0x447891`).

**Evidence (sample; full table in `b1_b4_census.py` output).**

| resolve VA | bytes at true call | true call VA | committed CSV | committed−0x400000 == true? | E8 check |
|---|---|---|---|---|---|
| 0x00437732 | `e838010100` | 0x437754 | 0x00837754 | YES | E8 rel32 → 0x447891 OK |
| 0x0069213A | `e82d57dbff` | 0x69215F | 0x00A9215F | YES | OK |
| 0x009EC4D3 | `e89eb3a5ff` | 0x9EC4EE | 0x00DEC4EE | YES | OK |
| 0x00438986 | `e8e4ee0000` | 0x4389A8 | 0x008389A8 | YES | OK |
| 0x00450339 | `e83175ffff` | 0x45035B | 0x0085035B | YES | OK |
| 0x004B3744 | `e81f41f9ff` | 0x4B376D | 0x008B376D | YES | OK |
| 0x005CA68E | `e8dbd1e7ff` | 0x5CA6B1 | 0x009CA6B1 | YES | OK |
| 0x0066C04D | `e81db8ddff` | 0x66C06F | 0x00A6C06F | YES | OK |
| 0x006ED6C2 | `e8a9a1d5ff` | 0x6ED6E3 | 0x00AED6E3 | YES | OK |
| 0x00741DD8 | `e8925ad0ff` | 0x741DFA | 0x00B41DFA | YES | OK |
| 0x0093CBBE | `e8afacb0ff` | 0x93CBDD | 0x00D3CBDD | YES | OK |
| 0x00945AEB | `e87c1db0ff` | 0x945B10 | 0x00D45B10 | YES | OK |
| 0x00986875 | `e8d80facff` | 0x9868B4 | 0x00D868B4 | YES | OK |

**Systematic pattern:** ALL 76 non-empty rows mismatch by exactly `delta=+0x400000` (delta histogram:
`{'delta=+0x400000': 76}`). No other delta; no row where the CSV is empty but a true call exists; no
row whose committed value is a true VA. Consequence: committed values are non-addresses; at least one
(0x00DDAB02 for resolve 0x009DAAE0) exceeds the image VA extent (image ends 0xDDA000). **Count of
non-empty create_call_va rows = 76** (80 rows − 4 empties, see B2).

**Conclusion.** The committed census CSV's `create_call_va` column is wrong in every non-empty row
by a uniform +0x400000. The T088 lead-closure record (T088-REVIEWER-INDEPENDENT.md item 2) claims
"C2 … Fixed; 11 sites re-derived at correct VAs" — the committed baseline contradicts this: 0 of 76
rows were fixed at the pinned SHA. (EV-93 does not quote any specific wrong VA, so the EV row itself
is not numerically false; the CSV it hashes is.)

**Reproduction.** `python b1_b4_census.py` (this dir) — prints the delta histogram, the sample table,
and B2/B3/B4 outputs below.

## B2 — empty `create_call_va` rows

**Method.** For each of the 4 rows with empty create_call_va, linearly disassembled the full
0x90-byte window from the resolve site and enumerated every `call`; then decoded an extended window
(0x60-0x300 bytes) to characterize what consumes the 0x31D immediate.

**Rows and reasons:**

1. `0x0073E40A` (`mov esi, 0x31d`, fn 0x73D83C) — no 0x447891 call in window.
   `00473E40A be1d030000 mov esi,0x31d; 00473E40F 2b75e8 sub esi,[ebp-0x18]` …
   `00473E41B e81819d0ff call 0x43fd38` (id-base virtual `[eax+0xB8]`, HRESULT-checked, error IID
   0xBA0510) … `00473E420 8bce mov ecx,esi; 00473E425 2bc8 sub ecx,eax` … `00473E440 51 push ecx`
   … `00473E445 ff9090000000 call [eax+0x90]` (HRESULT-checked, error path pushes IID 0xBA0500).
   => 0x31D is consumed as an **integer namespace-id-range endpoint** (`0x31D − other`), passed as an
   argument to a slot+0x90 virtual on another object; NOT a resolve feeding 0x447891.
2. `0x0093A0A1` (`mov ecx, 0x31d`, fn 0x93A008) — **zero calls of any kind** in the 0x90 window.
   `00493A0A1 b91d030000 mov ecx,0x31d` is immediately followed by `jg 0x93A5B0` / `je 0x93A612`
   (flags from a preceding `cmp esi, …` — an id-dispatch switch). Fall-through redefines ecx at
   `0x0093A14D mov ecx, ebx` without using 0x31D; the taken targets (0x93A5B0: another cmp-chain;
   0x93A612: arithmetic on [ebp+0x10]) show no immediate ecx(0x31D) consumption in their heads. The
   containing function DOES contain exactly one `call 0x447891` at **0x93A7AA** (byte-verified), but
   it is 0x109 bytes beyond the 0x90 window and no static dataflow ties it to the 0x93A0A1 immediate.
   => id consumed beyond window / as switch data: census `none-within-0x90` is accurate; ultimate
   consumer statically undetermined in this round.
3. `0x00A197DD` (`mov ecx, 0x31d`, fn 0xA192A6) — same id-delta shape as (1):
   `004A197C6 e89765a2ff call 0x43fd62; 004A197CB 83c003 add eax,3; 004A197D3 e86065a2ff call 0x43fd38`
   … `004A197DD b91d030000 mov ecx,0x31d; 004A197E2 2bc8 sub ecx,eax` … `004A197FB 51 push ecx` …
   `004A19800 ff9090000000 call [eax+0x90]` (error path IID 0xBA0500). => integer id-range endpoint;
   the adjacent slot90 site 0xA19800 is a create-family virtual on ANOTHER object ([esi]'s vtable),
   not a Vector2D Set created from this site. (The classification row for slot90 0xA19800 exists as
   INCONCLUSIVE — noted for B8 context.)
4. `0x00A19D57` (`mov ecx, 0x31d`, fn 0xA192A6) — byte-identical pattern to (3):
   `004A19D57 b91d030000; 004A19D5C 2bc8` … `004A19D75 51 push ecx; 004A19D7A ff9090000000 call [eax+0x90]`.

**Conclusion.** Exactly 4 empty rows, all `mov r32, imm32` form; none is a lost Vector2D create —
3 consume 0x31D as an integer (id arithmetic), 1 as out-of-window switch data. The census's
`none-within-0x90` label is factually accurate for all four. (Corollary: C-106's phrasing "every one
of the 80 EXE resolve sites aliases THE ONE shared CWzVector2D" overreaches for these 4 sites — they
do not create anything; the singleton logic itself is unaffected for the 76 creating sites.)

**Reproduction.** `python b2_empty_rows.py`, `python b2_wide.py`.

## B3 — 0x69213A attach expression

**Method.** Direct capstone decode of file bytes at VA window 0x692140..0x692170.

```
00692140  c745fc01000000   mov dword ptr [ebp - 4], 1
00692147  e884271100       call 0x7a48d0          ; id->name record
0069214C  8bc8             mov ecx, eax
0069214E  e8f941d7ff       call 0x40634c
00692153  8b00             mov eax, dword ptr [eax]
00692155  57               push edi               ; ARG3 (extra)
00692156  8d4df0           lea ecx, [ebp - 0x10]
00692159  51               push ecx               ; ARG2 (&out-slot = [ebp-0x10])
0069215A  50               push eax               ; ARG1 (name record)
0069215B  c645fc02         mov byte ptr [ebp - 4], 2
0069215F  e82d57dbff       call 0x447891          ; PcCreateObject wrapper
00692164  8b45e8           mov eax, dword ptr [ebp - 0x18]
00692167  83c40c           add esp, 0xc
```

**Conclusion.** The real arg2/out-slot of the 0x447891 call is **[ebp-0x10]** (via
`lea ecx,[ebp-0x10]; push ecx`); `push edi` at 0x692155 is arg3 (extra). The committed census row
(resolve_va 0x0069213A, create_call_va 0x00A9215F [true 0x69215F], attach `[ebp - 0x10]`) states the
correct attach target — the T088-reviewer "C3" fix IS reflected in the committed CSV. (The committed
create_call_va for this row is still +0x400000 — see B1.)

**Reproduction.** `python b1_b4_census.py` (B3 section prints the window).

## B4 — full independent resolve census

**Method.** Byte-regex over .text (file offsets 0x1000..0x7EA000):
`push 0x31D` = `68 1D 03 00 00`; `mov r32,0x31D` = `B8+r 1D 03 00 00`. Instruction-start
cross-validation: for each site, seeded capstone decodes from every offset in [site−16, site−1] and
counted seeds whose decode chain lands exactly on the site with the expected mnemonic/operand.

**Evidence.** push = **63**, mov = **17**, total = **80**; push∩mov overlap = ∅.
Seed-vote histogram across all 80 sites: {5:5, 6:3, 7:4, 8:12, 9:7, 10:6, 11:9, 12:11, 13:9, 14:6,
15:4, 16:4} — every site validated by ≥5 independent seeds; **0 sites with zero validating seeds**
(i.e., every byte match is also a true instruction start under multi-seed decoding).

**Conclusion.** The committed counts (63 push + 17 mov = 80; EV-93, C-106, readiness report) are
CONFIRMED. Spot-checks at 0x437732, 0x69213A, 0x9EC4D3 decode as genuine `push 0x31d` /
`push 0x31d` / `push 0x31d` at the exact byte offsets.

**Reproduction.** `python b1_b4_census.py` (B4 section).

## B5 — slot15 family vtables and their imm32 code references

**Method.** Reproduced the committed derivation rule exactly (scan VAs 0xB01278..0xB02730 step 4
for dword == 0x53471A; family start = hit − 0x3C). Then, for EACH of the 33 starts, searched ALL of
.text for its 4 LE bytes and classified every occurrence: decoded-instruction imm32 (probe seeds
hit−11..hit, require the covering instruction to END at hit+4, len ≥ 5) vs raw byte-slice.

**Evidence — family starts (33, first/last):**
`0xb01278 0xb01308 0xb01390 0xb01414 0xb0149c 0xb01528 0xb015ac 0xb01630 0xb016b4 0xb01738
0xb017bc 0xb01840 0xb018c4 0xb01948 0xb019cc 0xb01a50 0xb01ad4 0xb01ca0 0xb01d30 0xb01dc0
0xb01e80 0xb01f10 0xb01fb8 0xb020cc 0xb02168 0xb021f8 0xb02288 0xb02318 0xb023a8 0xb024e8
0xb02580 0xb02610 0xb026a0` — count 33, range 0xB01278..0xB026A0 (matches committed md header).
(Base table slot0 = 0x52F1CC; last table slot0 = 0x5348E8 — both plausible code pointers.)

**Evidence — .text imm32 occurrences:** ONLY the base table 0xB01278 occurs at all. The other 32
tables have ZERO raw-byte occurrences anywhere in .text. 0xB01278 has 7 raw occurrences; 6 decode
as instruction-level immediates:

| VA | bytes | instruction | kind |
|---|---|---|---|
| 0x52EEF1 | `be7812b000` | `mov esi, 0xb01278` | register LOAD (table ptr as value; then stored to [ebp−0x3C] local) |
| 0x52F1BC | `c7017812b000` | `mov dword ptr [ecx], 0xb01278` | **INSTALL** (own thunk entry; followed by `jmp 0x52F37F`) |
| 0x52F1CF | `c7067812b000` | `mov dword ptr [esi], 0xb01278` | **INSTALL** (inside thunk 0x52F1CC `push esi; mov esi,ecx; mov [esi],0xB01278; call 0x52F37F`) |
| 0x8DC052 | `be7812b000` | `mov esi, 0xb01278` | register LOAD (context byte-identical to 0x52EEF1) |
| 0xA0B39E | `c7007812b000` | `mov dword ptr [eax], 0xb01278` | **INSTALL** (inline ctor; NOT followed by call 0x52F37F) |
| 0xA0BB2A | `c7017812b000` | `mov dword ptr [ecx], 0xb01278` | **INSTALL** (followed by `call 0x52F37F`) |
| 0xBE62E4 | `…01 00 00 00 78 12 b0 00 00…` | none | RAW byte-slice — sits inside a data blob (surrounded by 00/01 words) at the .text tail; not code |

True-stream verification for 0x52F1BC (the contested one) — linear decode from 0x52F1A8:
`0052F1AD mov ecx,0xbdeacc; 0052F1B2 jmp 0x4063b5; 0052F1B7 jmp 0x52f20f; 0052F1BC mov [ecx],0xb01278;
0052F1C2 jmp 0x52f37f; 0052F1C7 jmp 0x52f28b; 0052F1CC push esi; …` — a thunk table; **0x52F1BC is a
real, reachable install entry**, not an alignment artifact.

**Conclusion (installs of the base table).** There are **FOUR** install instructions:
0x52F1BC (`mov [ecx],0xB01278`), 0x52F1CF (`mov [esi],0xB01278`), 0xA0B39E (`mov [eax],0xB01278`),
0xA0BB2A (`mov [ecx],0xB01278`); plus two non-install register loads (0x52EEF1, 0x8DC052) and one
data occurrence (0xBE62E4). The committed T088 texts are each PARTIALLY wrong:
- Lead closure / BOUNDS md / EV-97 narrative: "0xB01278 IS installed at least at 0x52F1CF / 0xA0B39E
  / 0xA0BB2A" — omits the fourth real install **0x52F1BC** (and the two register loads).
- T088-REVIEWER-INDEPENDENT.md C7: "four imm32 installs (0x52F1BC, 0x52F1D1, 0xA0B3A0, 0xA0BB2C)" —
  0x52F1D1/0xA0B3A0/0xA0BB2C are the imm32 BYTE positions (insn start + 2), not instruction VAs;
  only 0x52F1BC is an instruction VA in that list.
- The derived 32 tables genuinely have no imm32 code ref (my independent whole-text scan) — so the
  corrected bounded statement is "the 32 NON-BASE tables have no imm32 code reference", which is what
  the T088 report §5 and EV-97 now say; G10 (see B8) still says 33.

**wp4 install-search regex analysis (committed t088_wp4_scene_portal.py line 110).**
`re.finditer(rb".\xb0\x00\x00", blob)` then `struct.unpack("<I", blob[m.start():m.start()+4])`:
a match is (any-byte, 0xB0, 0x00, 0x00) so the unpacked value is always `0x0000B0XX` ∈ [0xB000,
0xB0FF] (and matches whose leading byte is 0x0A are silently skipped — `.` excludes newline; the
leading byte is the LOW byte so this only drops XX=…-adjacent shapes, immaterial here). The
subsequent range test `fam_starts[0] <= val <= fam_starts[-1]+0x300` compares against
[0xB01278, 0xB029A0] — **no possible unpacked value can ever pass** (max 0xB0FF < 0xB01278). It
cannot match 0x00B01278 under any alignment: the intended dword's bytes are `78 12 b0 00`; the
regex requires the two bytes AFTER 0xB0 to be `00 00`, which is false for every family value
(0x00B0XXXX has one zero byte after 0xB0 only when XXXX's high byte is 0x00 — i.e. only values
0xB000..0xB0FF — precisely the vacuous set). Emulating the committed loop over the 8 non-None writer
function blobs yields 2 regex matches, values 0xB086/0xB0BE, both rejected. **Therefore every
`family-vtable-installs=[]` line printed by the committed wp4 is a structural vacuity, not a
negative finding** — the script could never have reported an install. (The per-writer negative
conclusion is nevertheless TRUE — established independently above and in B6.)

**Reproduction.** `python b5_b7_scene.py` (family starts, imm32 refs, regex emulation).

## B6 — the direct +0x1CC writers and their containing functions

**Method.** My own encoding-complete census: all raw `cc 01 00 00` occurrences in .text (120),
token-exact 0x1cc match (regex `(?<![\da-fA-F])0x1cc(?![\da-fA-F])` on capstone op_str, so garbage
displacements like 0x1CCBE/0x1CC83 cannot match), multi-seed voting (seeds hit−15..hit), window
hit+14 (wider than wp4's hit+4, so instructions with trailing immediates decode). Function
attribution: my own census (51200 starts: `55 8b ec` / `8b ff 55 8b ec` prologues + E8 targets)
cross-checked against the committed seh_start heuristic (B8 imm32 → E8 0xA6FC7C, fallback prologue,
back=0x1500).

**Evidence — counts.** Distinct true 0x1CC-referencing instructions: 72 (mov 35, lea 21, add 10,
push 4, sub 2; includes 9 `mov r32, 0x1cc` immediate forms and ~20 register-destination READS).
- **mov+lea references (memory-displacement semantics): 21 lea + 10 mem-destination mov = 31.**
- **Direct `mov [reg+0x1cc], reg` writers: 10** —
  0x60088A `mov [eax+0x1cc],esi` · 0x67B139 `mov [esi+0x1cc],edi` · 0x6D429C `mov [esi+0x1cc],edi`
  · 0x703819 `mov [esi+0x1cc],edi` · 0x71FAA1 `mov [esi+0x1cc],edi` · 0x79293F `mov [esi+0x1cc],eax`
  · 0x793570 `mov [esi+0x1cc],edi` · 0x7C939A `mov [esi+0x1cc],eax` · **0x952ECE
  `mov [ebx+0x1cc],eax`** · 0xA029BA `mov [esi+0x1cc],ebx`.
- The committed wp4 census (exact re-run of its algorithm reproduces its output verbatim:
  total=74, mov/lea=30, writers=9, identical addresses) MISSES 0x952ECE. Mechanism (byte-traced):
  for the raw occurrence whose cc belongs to `0x00952ECE 8983cc010000`, the wp4 probe's FIRST seed
  (0x952EC9) desyncs into garbage `0x00952ECD add byte ptr [ecx+0x1cc83], cl`, whose op_str
  CONTAINS the substring "0x1cc"; wp4's substring test + first-start-wins bias records the garbage
  and stops, so the real writer at seed 0x952ECE is never examined. 0x952ECE is real: the region is
  a field-copy loop `mov eax,[esi+0x1c8]; mov [ebx+0x1c8],eax; mov eax,[esi+0x1cc];
  mov [ebx+0x1cc],eax; mov eax,[esi+0x1d0]; …` (linear decode 0x952EBC..0x952EEC).
  Also note wp4's crossing test `ins.address + len > off2 + 2` compares a VA against a file offset
  (units mix) and is therefore trivially true for every instruction — harmless for its output but
  another latent defect.

**Evidence — containing functions + family installs.**

| writer | my census fn | committed seh fn | verdict on boundary | family imm32 install in fn? |
|---|---|---|---|---|
| 0x60088A | 0x6006AD (E8-target label; head decodes mid-instruction → NOT a real prologue) | **None** | UNRESOLVED (see below) | none anywhere near (whole-text scan) |
| 0x67B139 | 0x67B0DE | 0x67B0DE | HEURISTIC (agree) | no |
| 0x6D429C | 0x6D4235 | 0x6D4235 | HEURISTIC (agree) | no |
| 0x703819 | 0x7037AF | 0x7037AF | HEURISTIC (agree) | no |
| 0x71FAA1 | 0x71F9EB | 0x71F9EB | HEURISTIC (agree) | no |
| 0x79293F | 0x79240D — FALSE start (decodes `xchg al,ah…` garbage; E8-target false positive) | **0x791FE9** (real `push ebp; mov ebp,esp` + SEH) | HEURISTIC (committed value right; my census wrong) | no |
| 0x793570 | 0x793045 | 0x793045 | HEURISTIC (agree) | no |
| 0x7C939A | 0x7C8BEB (earlier SEH fn; 0x7C8E9F not in my prologue/E8 census) | **0x7C8E9F** (real SEH fn `mov eax,0xac7593; call 0xa6fc7c`) | HEURISTIC (committed value better) | no |
| 0x952ECE (NEW) | 0x952A57 | 0x952A57 (seh_start also finds it) | HEURISTIC (agree) | no |
| 0xA029BA | 0xA0276F | 0xA0276F | HEURISTIC (agree) | no |

**0x60088A backwards analysis.** Within 0x3000 bytes back there is NO `55 8b ec` prologue except
0x5FD9B1 (0x2ED9 back) and NO SEH `B8 imm; E8→0xA6FC7C` install later than 0x5FEE30 (0x1A5A back —
beyond wp4's 0x1500 back-window, explaining its "fn None"). Linear decode 0x6006AD..0x6008A0
contains zero ret/leave boundaries; 0x6006AD has exactly one E8 caller (0x5FE6C0) but its "head" is
mid-instruction garbage, so it is an internal label, not a function start. Statically determinable
facts: the writer follows `0x00600885 e815fd0000 call 0x61059f` (eax = returned object) and writes
esi into [eax+0x1cc]; the enclosing function's start is NOT determinable by either heuristic — the
true boundary is UNRESOLVED (either a function starting at/after the 0x5FEE30 SEH frame with a
>0x1A5A-byte body, or an unusual-prologue function in 0x5FEE30..0x60088A).

**PROVEN vs HEURISTIC.** No writer's function boundary is PROVEN (both methods are heuristics:
E8-target/prologue censuses admit false starts, and seh_start assumes the nearest SEH frame or
prologue is the boundary). 7/10 have cross-method agreement; 0x79293F/0x7C939A resolved in favor of
the SEH anchor; 0x60088A unresolved. **Implication:** a "no family-vtable install in the containing
function" negative, argued at function granularity alone, is only as strong as the boundary — for
0x60088A it is VACUOUS (there is no identified function). HOWEVER, my B5 whole-text result makes the
per-function question moot: the ONLY family imm32 references in the entire .text are at
0x52EEF1/0x52F1BC/0x52F1CF/0x8DC052/0xA0B39E/0xA0BB2A (+data 0xBE62E4) — none lies within any
plausible containing function of any of the 10 writers (nearest: 0xA0B39E/0xA0BB2A vs writer
0xA029BA's fn 0xA0276F..0xA02B82 — outside). So the committed bounded negative ("none of the direct
writers installs a slot15-family vtable") SURVIVES — but its committed SCOPE is wrong: it is stated
over 9 writers and 30 mov/lea sites; the true figures are 10 writers and 31 mov/lea sites.

**Reproduction.** `python b6_v2_census.py`, `python wp4_exact_replication.py`, `python b6_functions.py`.

## B7 — "30" vs "31" mov/lea discrepancy

**Method/Result.** Under a clearly stated scanning rule — *every distinct decoded instruction in
.text whose op_str contains the exact token 0x1cc as a displacement, mnemonic ∈ {mov, lea}, mov
restricted to memory-destination forms* — the count is **31** (21 lea + 10 mem-dest mov). The
committed forensics md's "mov/lea subset: 30" undercounts by exactly the missed writer 0x952ECE;
EV-97's address field and the T088 report §5 ("mov/lea 31 处") carry the correct 31 — so the md, its
own EV-97 hash source, is the odd one out. The off-by-one is NOT a counting convention difference
(e.g. it is not the `lea esi,[ebx+esi*4+0x1cc]` SIB form, which wp4 does catch): it is a probe
defect (first-seed garbage shadowing, see B6). Conversely EV-97/report's "9 direct +0x1CC writers"
is the stale/incorrect side of the same defect — the true writer count is **10**.

**Reproduction.** diff of `wp4_exact_replication.py` output vs `b6_v2_census.py` output.

## B8 — classification/variant consistency + stale-number census

**Method.** Recounted the committed classification CSV programmatically; then grepped ALL pinned
T088 artifacts (report, readiness report, matrix, EV/claims/gaps CSVs, forensics mds, wp0 script)
for the stale patterns.

**Committed CSV recount (CONFIRMED internally consistent):** 39 rows; buckets
CONFIRMED-CAMERA-WRITER=2, CONFIRMED-SHARED-WRITE-CONTEXT-UI=12, RECEIVER-OTHER=0, INCONCLUSIVE=25;
38 unique slot90 sites (0x6BE6F4 twice: resolve path + getter path); variant3_4 uniform
`default(VT_ERROR,missing)` 39/39. (Also re-verified EV-93's "501 call [reg+0x90] encodings":
exact replication of scan_slot90 = 501. ✓)

**Stale numbers still presented as CURRENT conclusions (file + line + quote):**

1. `research/result/stage-readiness/P0-P4-READINESS-REPORT.md` line 104 (the t088 summary paragraph —
   the canonical readiness narrative):
   "39 个 slot+0x90 候选逐项分类（2 CONFIRMED-CAMERA-WRITER / 10 CONFIRMED-SHARED-WRITE-CONTEXT-UI / 2 RECEIVER-OTHER / 25 INCONCLUSIVE）"
   — stale 10/2 (CSV truth: 12/0; the paragraph even cites the C1-reclassified numbers elsewhere).
   Same line: "（35/39 立即类：33 默认构造器 + 2 清空槽 VT_EMPTY）" — stale "35/39 immediate-class"
   and "33 default + 2 VT_EMPTY" (C4's corrected fact: 39/39 uniform default V{VT_ERROR,missing},
   the 2 cleared slots are re-templated; stated correctly in the T088 report §2.2 tail and EV-93).
2. `research/result/stage-readiness/T088-CAMERA-CADENCE-WRITER-CLOSURE-REPORT.md` §2.2 lines 74-75:
   "| CONFIRMED-SHARED-WRITE-CONTEXT-UI | 10 |" and "| RECEIVER-OTHER | 2 | 0x4B3BC5/0x4B3DAD（接收者非共享对象；T087-reviewer 判定复核确认）|"
   — contradicts the same report's own executive summary (line 25: 12/0/25 with "reviewer C1 将
   0x4B3BC5/0x4B3DAD 重分类为共享写") and the committed CSV.
3. `research/source-of-truth/evidence.csv` EV-93 (interpretation tail):
   "…39/39 default V{VT_ERROR,missing} — C4: the two cleared slots are re-templated from 0xBE7330) = 35/39 immediate-class)"
   — the trailing "= 35/39 immediate-class" is a stale remnant contradicting the same sentence.
4. `research/source-of-truth/gaps.csv` G10 unresolved_scope:
   "33 family vtables have no imm32 code ref — indirect construction path unpinned" — stated as a
   CURRENT residual AFTER the T088 C7 correction withdrew exactly this claim for the base table
   (EV-97 and T088 report §5 say withdrawn; my B5 shows the correct statement is "the 32 non-base
   tables"). The "33" is wrong as written.
5. `research/source-of-truth/evidence.csv` EV-97 (address field) and T088 report line 132:
   "31 +0x1CC mov/lea sites; 9 direct +0x1CC writers" / "mov/lea 31 处、直接写 9 处" — the 31 is
   CORRECT (the BOUNDS md's 30 is wrong), but the "9 writers" is wrong: true count 10 (0x952ECE
   missed by the wp4 probe; B6/B7). The bounded negative "none of the NINE direct writers installs…"
   (BOUNDS md §2, EV-97, report §5, G10-adjacent text) therefore under-scopes the writer set.
6. Generator provenance: `research/scripts/t088_wp0_ledger_fixes.py` lines 72 (writes the 2/10/2/25
   string into the readiness report), 112 ("31 +0x1CC mov/lea sites"), 118 ("the 33 family tables
   have no imm32 code reference — installer …"), 261 (writes G10's "33 family vtables have no imm32
   code ref") — the stale strings are script-injected, so they are reproducible artifacts, not typos.

**Also:** T088 report §6 promises "修订：C-103（写入者集合读法勘误注记 + EV-93/94 引用）" — the
committed C-103 row contains NO erratum note and its evidence_refs are still `EV-89;EV-90` (see B9).
Report-vs-ledger inconsistency.

**Conclusion.** The classification CSV and EV-93's headline counts are correct; the readiness report
paragraph, T088 report §2.2 table, EV-93's tail, G10's unresolved_scope, and the writer-count 9 are
stale/incorrect in the committed baseline.

## B9 — C-028 / C-103 / C-106 historical-conclusion hygiene

**C-103** (`claims.csv`, status CLOSED-STATIC, evidence_refs EV-89;EV-90 — NO t088 marker anywhere
in the row). Current-active claim text still asserts:
- "…FIELD writers 0x9E6D18 (record pair +0x38/+0x3C) and 0x9F1ADF (packed 16:16 dword: low word x, high word y)…"
- "BOUNDED: follow cadence/deadzone of the two field writers (the only place a deadzone could live) NOT decoded…"
The T088 round's own C-107 states this reading was falsified ("corrects the T087 reading of funnel
writers #6/#7 as world-space gameplay writers"; #6/#7 are cursor-mode, PtInRect/lParam client-space)
and the T088 report §6 claims C-103 was revised with an erratum note + EV-93/94 refs — **neither is
present in the committed row**. C-107's `supersedes` field is "(none)", so no formal supersession
link exists either. => The falsified "world-space player-coordinate writers" and "deadzone can only
live upstream of the two field writers" conclusions remain live, unmarked text in the canonical
ledger at the pinned SHA.

**C-028** (status PARTIAL-STATIC). reasoning field concatenates "t087 (C-103/EV-89/EV-90): … a
7-site writer census incl. two field-family world-space writers (0x9E6D18 record pair, 0x9F1ADF
packed 16:16); … STILL OPEN: follow cadence/deadzone (the upstream gating of the two field writers —
the only place a deadzone could live — not decoded) …" with "t088 (…): the write machinery is
event-driven … the cadence/deadzone residual is now bounded to the [F28+0x14] target semantics and
the 25 INCONCLUSIVE census sites." The round prefixes give implicit history, but the phrases
"world-space writers" and "the only place a deadzone could live" are NEVER marked superseded, and
the t088 appendix does not retract them — a reader of the active field still gets the falsified
world-space framing as T087-segment fact. (T088's own C-107/G10 say #6/#7 are cursor-mode and the
deadzone residual is [F28+0x14]+INCONCLUSIVE-bodies, not "the upstream gating of the two field
writers".)

**C-106** (status CLOSED-STATIC). Data-quality defect — the reasoning field contains a verbatim
DUPLICATED sentence (pasted twice, back to back):
"t088-reviewer C1 reinforcement: the 0x4B3BC5/0x4B3DAD receivers are in-function resolve+0x447891
creates (out-slots [ebp-0x1C]@0x4B3764/[ebp-0x14]@0x4B3824) — two more confirmed shared writes;
reviewer additionally proved [0xBE1FB0]=GetProcAddress(\"PcCreateObject\") via resolver 0x79C52F."
(appears at reasoning positions ~2 and ~3; byte-identical). No other C-106 defect found: its 63/17
counts, alias list, and IID claims match my independent B4/B1/B3 derivations.

## B10 — hash chain

**Method.** Recomputed canonical SHA-256 (T086.1 rule per `research/scripts/evidence_canonical.py`
at the pinned SHA: text ⟺ UTF-8-decodable ∧ no NUL ⇒ CRLF→LF; else raw) over the pinned blobs
(`git show` raw bytes; dumps are already LF).

| artifact | canonical sha256 (mine) | recorded in | match |
|---|---|---|---|
| T088-VECTOR2D-ID31D-RESOLVE-CENSUS.csv (5768 B) | `7534683672805f69d1f77bdb68eff400cb5c4bc394af5c1bda92de77051a085e` | EV-93 source_sha256 | ✅ |
| T088-DIRECT-SLOT90-WRITER-CLASSIFICATION.csv (8228 B) | `2f5c550e303495909336471fbc8d1445a5492ae8fc7b258ea2362cd6706abe4c` | EV-93 interpretation companion | ✅ |
| T088-CAMERA-BOUNDS-SCENE-PORTAL.md (8487 B) | `f5ad994a376978efbf01c563da5fd44bebd56cab872bd92ff907a225fbcb2bd5` | EV-97 source_sha256 | ✅ |
| T088-FIELD-9E6CA4-CFG.txt (35156 B) | `25cb66a7fa8b21af3b07df64f7797b1489bc2a2c184b6fc48c30b355c5cc6bc6` | EV-94 source_sha256 | ✅ |
| T088-PACKED-COORD-WRITER-CALLGRAPH.txt | `ad04fcb08f8fb6d26eb0431e59b8418d35d50f3d0328e3856ce353c33c4c6ecd` | EV-94 interpretation companion | ✅ |

**Conclusion.** The evidence hash chain is INTACT — every recorded hash reproduces from the pinned
tree. All defects found in this audit are content defects inside correctly-hashed artifacts (which
the hashes faithfully pin).

---

## Things I could NOT verify (with reasons)

1. Whether the 0x31D immediate at 0x93A0A1 ever reaches a create call (its consumer lies beyond any
   statically justifiable window; the in-function create at 0x93A7AA cannot be tied to it by static
   dataflow alone).
2. The true function start containing writer 0x60088A (no prologue/SEH anchor within ±0x3000
   resolves it; needs a full CFG/xref reconstruction beyond this audit's scope).
3. Whether the classification rows whose receiver_push is `unknown` (0x43F17B, 0x4401F3 wait —
   those show unknown in `receiver_push` for 5 rows) decode differently under a wider pre-window —
   the committed classifier used a 0x34-byte tail window; I did not re-derive each of the 25
   INCONCLUSIVE receivers this round (out of audit scope; no contradiction found in spot checks).
4. Shape2D/PCOM-side claims of C-106/EV-95 (factory record+0x10 singleton walk, IID equality) —
   binaries hash-verified only; no instruction-level re-derivation was in my task list (B1-B10).

## Reproduction index (all in C:\Users\lithd\AppData\Local\Temp\opencode\t0881-reviewer\)

- `b1_b4_census.py` — B1 delta table/sample, B2 empty-row windows, B3 window, B4 counts+votes.
- `b2_empty_rows.py`, `b2_wide.py` — B2 deep dives (0x43FD38 helper, 0x93A0A1 wide scan).
- `b5_b7_scene.py` — B5 family starts, imm32 refs, wp4 regex emulation; first-gen B6 (superseded).
- `b6_v2_census.py` — token-exact 31/10 census (authoritative for B6/B7).
- `wp4_exact_replication.py` — byte-exact re-run of committed wp4 section 2 (74/30/9 reproduction).
- `b6_functions.py` — writer→function attribution, 0x60088A backwards analysis.
- `pinned\*.raw` — raw blobs of every audited file at SHA 60f1ee92 (canonical-hash inputs).

---

# PHASE 2 - ADVERSARIAL RE-REVIEW (verbatim, authored after the lead declared the fix set complete)

# T088.1 — Phase 2 Adversarial Re-Review Report

Reviewer: T088.1 independent sub-agent (same session as Phase 1; blind notes at
`T0881-BLIND-NOTES.md`). Date: 2026-11-16. Repo read-only throughout (only
`git status`/`git rev-parse` and file READS; my own runs executed with
`PYTHONDONTWRITEBYTECODE=1` and in temp scaffolds; no `__pycache__` created —
verified via `git status --porcelain`).

Binaries re-verified before use: EXE sha256
`d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718` ✓ (HEAD still
`60f1ee92`, working tree carries the uncommitted T088.1 fix set — audited as-is).

Working-tree snapshot hashed to `wt\*.wt` (28 files); all canonical hashing per
`evidence_canonical.py` (CRLF→LF for text).

---

## Q1 — are all 76 non-empty create_call_va rows now TRUE VAs? **PASS**

Method: my own independent verifier (`q1_verify_all.py`) over ALL 80 rows (not a
sample): linear capstone decode from each resolve site → first `call 0x447891`;
byte-check `img[cva]==0xE8`, `cva+5+rel32==0x447891`; compare to CSV.

- rows=80, non-empty=76; **mismatches: 0**; **rows still at true+0x400000: 0**.
- Fresh 16-row sample with explicit E8 proof (incl. the three mandated):
  `0x437732→0x00437754 (e838010100)`, `0x69213A→0x0069215F (e82d57dbff)`,
  `0x9EC4D3→0x009EC4EE (e89eb3a5ff)`, plus 0x438D04→0x438D26, 0x443C62→0x443C8D,
  0x450806→0x45082A, 0x50E901→0x50E923, 0x57024F→0x570271, 0x5CA68E→0x5CA6B1,
  0x69103F→0x691063, 0x6ED885→0x6ED8B2, 0x7AD0BF→0x7AD0E6, 0x936EF9→0x936F1B,
  0x94A6A2→0x94A6C4, 0x96D4AD→0x96D4D9, 0x9DAAE0→0x9DAB02 — every one an E8
  rel32 to 0x447891 and equal to my independent decode.
- Committed `T0881-VA-CALLSITE-VERIFICATION.csv`: 80 rows, 76 PASS + 4
  PASS(no-call) — my scaffold run of `t0881_census_verifier.py` reproduces it
  byte-identically (sha `14093089…`).

## Q2 — generator-produced, not hand-edited? **PASS (executed)**

I copied the working-tree generator into a temp scaffold
(`scaffold\research\scripts\t088_wp1_id31d_census.py` + real binary) and ran it:
output printed `create calls byte-verified against 0x447891: 76`, and BOTH
written CSVs are **byte-identical to the working tree** (census CSV canonical
sha `69f18c64aece419ead6246faf688ce91ecb3c651cfff7273b0039d38010e3559`;
classification CSV `2f5c550e303495909336471fbc8d1445a5492ae8fc7b258ea2362cd6706abe4c`
— the baseline hash, confirming byte-identical-to-baseline as claimed).
alias_kind machine buckets = **12 persistent-field / 60 stack-slot / 4 register /
4 imm32-operand** (matches); 4 empty-row reason strings match my Phase-1
independent characterizations (3× arithmetic id-range operand, 1× dispatch
chain). Also verified the logical fix: `main()` now formats `f"{call_va:#010x}"`
(line 318) and `verify_create_call` (246-257) fails closed.

## Q3 — any surviving VA/RVA/offset confusion? **PASS (no survivor found)**

Audited every `+ BASE` / address column in `t088_wp1_id31d_census.py`,
`t0881_census_verifier.py`, `t088_wp4_scene_portal.py`, and the printed outputs:
- wp1/verifier: BASE added only to file offsets (`off + BASE`, `fn + BASE`,
  `s + BASE`); `verify_create_call` band check `BASE+CODE_START <= va < BASE+CODE_END` ✓.
- wp4: `imm32_census`/`ref_1cc_census` compare capstone VAs against `p + BASE`
  (VA) ✓; `seh_anchor`/`prev_prologue` convert `w − BASE` → file offsets and
  return `i + BASE` ✓; §2d distance print `nearest`/`w` are both VAs, `dist` is
  a VA-VA delta ✓ — the lead's admitted transient +BASE bug in this print is
  gone (distances: 0xD16BB, 0x14BF6A, …, min 0x89E4 — all plausible VA deltas).
- The OLD wp4 units defect (VA vs file-offset compare, always-true) is
  documented in the script header and coverage md §1 and is gone from the code.
- CSV columns: `resolve_va`/`function_start`/`create_call_va` all true VAs
  (Q1); `slot90_va` VAs (classification CSV unchanged); md listings all VA-form
  with correct bytes (`c7017812b000` etc. re-verified at file offsets).

## Q4 — rebuilt scanner finds the known positives? **PASS (tested, not just reasoned)**

- Scaffold re-run of wp4 reproduces the working-tree BOUNDS md byte-identically
  (sha `76e93033…`), printing: refs=49, lea=21, mov_write=10, mov_read=17,
  family tables=33, base installs `0x52f1bc/0x52f1cf/0xa0b39e/0xa0bb2a`,
  verdicts 10×CENSUS-FN-BOUNDED-NEGATIVE.
- Base table 0xB01278: **4 INSTALL** {0x52F1BC, 0x52F1CF, 0xA0B39E, 0xA0BB2A}
  + **2 LOAD** {0x52EEF1, 0x8DC052} + **1 DATA** {0xBE62E4} — exactly my
  Phase-1 independent derivation; the other **32 tables: zero byte occurrences**.
- Positive-control abort PROVEN BOTH WAYS in a tampered scaffold:
  (a) expectation reduced to `(0x52F1BC,)` → `exit 1`, "POSITIVE CONTROL FAILED:
  base-table installs […] != expected […]"; (b) scanner blinded
  (`imm_ok = False and …`) → `exit 1`, "installs [] != expected". The control
  genuinely fires on scanner regression (Q4's "verify the generator aborts").

## Q5 — ten-writer negative boundaries genuinely closed? **PASS (with one wording nit, D5/D6 below)**

- Conservative window = earliest of {census, SEH-anchor, prev-prologue}, hi =
  next census start; my Phase-1 findings (0x79240D/0x7C8BEB false starts,
  0x6006AD mid-instruction label with single caller 0x5FE6C0, fallback
  0x5FD9B1) are adopted and printed per writer. All 10 windows contain no
  install; whole-text distances (min 0x89E4 at 0xA029BA↔0xA0B39E) corroborate.
- Adversarial closure of the 0x89E4 residual (my addition, closes coverage-md
  §4's "residual assumption"): between the writer's window end 0xA02B82 and the
  install 0xA0B39E there are **8 genuine `55 8b ec` prologues (first 0xA03F2D)
  and 430 E8 call targets**, and the install itself sits in its own census
  function **0xA0AF3A..0xA0B692** — no containing function of 0xA029BA can span
  the gap. The negative is airtight for imm32 installs.
- Remaining uncovered forms are explicitly declared (coverage §4, BOUNDS §2d):
  indirect/register-mediated installs (the 2 LOAD sites prove the path exists),
  callee/SEH/thunk installs, derived-table non-imm32 construction, and the
  +0x1CC member's class identity. Byte-accuracy of §2d/§4/coverage checked
  line-by-line against the binary — no inaccurate claim found.
- Nits (non-blocking): (D5) "orders of magnitude beyond any plausible function
  extent" overstates the 0x89E4 case (~35KB, same order as the largest observed
  functions) — the barrier proof above, not the distance rhetoric, closes it;
  (D6) coverage §2.5 claims per-writer provenance records "prologue vs
  E8-target" kind, which the 2d listing does not actually print (it prints the
  three candidates + which was earliest); (D7) BOUNDS §2d prose names
  "0x791FE9" as the SEH anchor for 0x79293F while the listing's seh-anchor
  column (back=0x4000) reports the earlier 0x78FA4C — both are stated as
  conservative-widening, so no conclusion changes.

## Q6 — unconsidered immediate encodings / indirect installs? **PASS (none missed)**

- PUSH imm of a family address: none (all 7 byte occurrences of 0xB01278
  classify as 4 INSTALL/2 LOAD/1 DATA; 32 derived tables have zero byte
  occurrences, so no push/other-imm form can exist for them either).
- Family address as MEM-disp32: my whole-band scan returned 2 apparent hits —
  `fstp [esi+0xB01278]` at 0x52EEF0/0x8DC051 — both are **misaligned-decode
  artifacts** of my quick probe (true stream: `xor ebx,ebx; mov esi,0xB01278`);
  the rebuilt census correctly ignores them (IMM-operand requirement). No
  genuine MEM-disp occurrences.
- Alias installs of the base table beyond the 6 imm32 sites: the 2 LOAD sites
  ARE register-mediated alias installs — byte-verified chain
  `mov esi,0xB01278; …; mov [ebp-0x3C],esi; lea ecx,[ebp-0x3C]; call 0x52F37F`
  at 0x52EEF1-0x52EF0F and 0x8DC052-0x8DC070 (each followed by a SECOND
  `call 0x52F37F` on a [0xBD9028]+0x3454 object at 0x52EF25/0x8DC086 — the md's
  claim is accurate and arguably understated). Further non-imm32 alias paths
  are declared uncovered (coverage §4).
- DATA occurrence 0xBE62E4 identified: it lies in the tail of the first PE
  section (unnamed, VA 0x401000..0xBEA000) inside a mostly-zeroed dword array
  sprinkled with vtable pointers — 0xBE62E0=1, **0xBE62E4=0x00B01278**,
  0xBE6300=0x00B0D3D4 (the sibling embedded table installed at 0xA0B3BF),
  0xBE6314=0x00B07748 — consistent with **static/pre-constructed object
  instances (or a pointer array) in image data, not code**. No instruction in
  .text carries 0xBE62E0/E4/0xBE6300/0xBE6314/0xBE62C0 as imm32 or disp32, so
  nothing in the code band dereferences this region directly — the "DATA, no
  instruction boundary" classification stands. (Caveat already covered by
  coverage §4: a runtime-computed alias copy from such a static instance would
  be an indirect install the census cannot see.)

## Q7 — 39/39 consistency + layering? **PASS**

"39/39 default V{VT_ERROR,missing}" now consistent and current in:
classification CSV (39/39, machine), EV-93 interpretation ("39/39 default …;
the T088-era '33 default + 2 VT_EMPTY / 35/39 immediate-class' bucketing is
revoked. SEMANTIC LAYERING …default parameters do NOT auto-upgrade their
classification"), readiness L104 (corrected + 勘误 marker), T088 report §2.2
(L78-83: 39/39 + "T088 版本 EV-93/Readiness 残留的「33 默认 + 2 清空槽
VT_EMPTY」「35/39 立即类」分桶已被 reviewer C4 与 t088.1 全量撤销").
Residual occurrences of "35/39 立即类"/"33 默认 + 2 VT_EMPTY" exist ONLY inside
explicit erratum/historical markers (readiness L104, T088 report L82-83), in
defect descriptions (T0881 corrections report, register, coverage), in the
preserved T088 historical reviewer file, or in assertNotIn tests. The 25-INCONCLUSIVE
layering is explicit and non-upgradable (EV-93 SEMANTIC LAYERING +
corrections-report §F2 four propositions; "仅 14/39" = 2 CAMERA + 12 SHARED-UI,
consistent). No current-text stale bucket remains.

## Q8 — C1 reclassifications in ALL authoritative summaries? **PASS**

- T088 report §2.2 L74: "| CONFIRMED-SHARED-WRITE-CONTEXT-UI | 12 | …含
  t088-reviewer C1 重分类的 0x4B3BC5/0x4B3DAD（接收者=函数内 0x31D
  解析+0x447891 直建共享对象，out-slot [ebp−0x1C]@0x4B3764 / [ebp−0x14]…）|";
  L75: "| RECEIVER-OTHER | 0 | 该类别经 C-106 单例闭包 + reviewer C1 字节复核后取消…|".
- Readiness L104: "2 CONFIRMED-CAMERA-WRITER / 12 CONFIRMED-SHARED-WRITE-CONTEXT-UI /
  0 RECEIVER-OTHER / 25 INCONCLUSIVE；t088.1 勘误：…reviewer C1 重分类
  0x4B3BC5/0x4B3DAD 已并入".
- EV-93: "12 CONFIRMED-SHARED-WRITE-CONTEXT-UI (t088-reviewer C1 reclassified
  0x4B3BC5/0x4B3DAD), 0 RECEIVER-OTHER".
- Matrix P2-05 (unmodified this round): "…39 候选分类：2 CONFIRMED-CAMERA-WRITER
  （fieldctx ctor 初始 + 0x93CB27 焦点写入者）、12 CONFIRMED-SHARED-WRITE-CONTEXT-UI、
  0 RECEIVER-OTHER、25 INCONCLUSIVE".
All four agree with the classification CSV (2/12/0/25).

## Q9 — C-028/C-103/G10 current fields; C-106 dedupe; refs? **PASS except D1/D3**

- C-028 reasoning: "[T087 HISTORICAL READING, superseded by C-107/EV-94 in t088:
  …were then read as 'field-family world-space writers' and as 'the only place
  a deadzone could live' — both are now PROVEN cursor-mode…]" + "[the t087
  'STILL OPEN…' item is CLOSED as mis-scoped…]" — unambiguous markers; the
  stale phrases survive only inside them. evidence_refs extended
  EV-21;EV-89;EV-90;**EV-94;EV-95;EV-96** ✓.
- C-103 claim: "[T087 historical labels 'FIELD writers' — superseded by the
  t088 revision recorded in `address`…]"; address column opens with "t088
  REVISION of the writer-set reading (C-107/EV-94): … CURSOR-mode writers …
  NOT world-space gameplay writers"; the proven identity/transform sentences
  are explicitly retained. **BUT (D1):** evidence_refs is still `EV-89;EV-90`;
  the promised EV-93/EV-94 were appended to **binary_identity** (now
  "EV-89;EV-90;EV-93;EV-94", replacing "unpack079") — wrong column, and the
  corrections report §F4/§5 + CR-T0881-21 assert the refs were added to
  evidence_refs. Validator passes because it does not enforce column semantics.
- C-106: duplicated sentence removed (count("t088-reviewer C1 reinforcement")==1,
  guarded by test) with an explicit "[t088.1: this sentence was accidentally
  duplicated…]" note; precision note for the 4 non-resolve sites present.
- G10: unresolved_scope/blocker/next_action rewritten correctly (TEN writers,
  base-chain located, 32 derived zero-imm32, member identity residual, T089
  WP3 entry). **(D3, minor):** verified_scope still says "aliases ALL 80
  resolve sites to ONE CWzVector2D" — same 80-site overreach also retained in
  readiness L104 ("全部 80 个解析点混叠同一"), T088 report L25, and matrix
  P2-05's t088 segment — contradicting C-106's own precision note and the
  census's "imm32-operand (not a resolve)" labels. Summaries-only; C-106 (the
  authority) is precise. Recommend a one-line t088.1 note in G10/RR104 or fold
  into T089.

## Q10 — rebuildable from the same inputs? **PASS**

- canonical_sha256(census CSV) = `69f18c64…e3559` == EV-93 source_sha256 ✓
  (and == my fresh generator run's output, byte-identical).
- canonical_sha256(BOUNDS md) = `76e93033…c17ff` == EV-97 source_sha256 ✓
  (== my fresh wp4 scaffold run).
- classification CSV sha still `2f5c550e…be4c` (byte-identical to baseline;
  git status confirms unmodified) and still referenced by EV-93 ✓.
- Clean-room: CLAIM-CONSISTENCY-REGISTER / EVIDENCE-INDEX / GAP-REGISTER are
  byte-identical (SHA equality) to source-of-truth claims/evidence/gaps ✓;
  test_cleanroom_synced_to_source_of_truth (incl. ISSUE-CROSSWALK) passes.
- Fresh executions (read-only, PYTHONDONTWRITEBYTECODE=1):
  `python -m unittest research.tests.test_t0881_round` → **39/39 OK, exit 0**
  (committed T0881-UNITTEST-LOG.txt records the full discover run 146/146 OK
  with ResourceWarnings — consistent; I did not re-run full discover to keep
  the tree untouched). `python research/scripts/validate_reverse_engineering.py`
  → **PASS 0 errors / 0 warnings, exit 0**, claims=109/gaps=41/evidence=97 —
  matches T0881-VALIDATOR-LOG.txt.
- wp0 historical script: neutralized with `[t088.1-corrected …]` markers +
  "DO NOT re-run" header (6 marker lines verified).
- Committed reviewer file `T0881-REVIEWER-INDEPENDENT.md` = my Phase-1 blind
  notes VERBATIM under a phase header; no pre-written phase-2 verdicts.

## Test-file honesty — **PASS (substantive)**

39 tests counted. Real semantics, not string-presence theatre: byte-level E8
target verification against the pinned binary per row (test_every_call_byte_
verified_e8_to_0x447891), VA-band check, mandated sample rows, empty-row
reason assertions, scanner re-derivation by importing wp4 and re-running
family_tables/imm32_census/ref_1cc_census on the image (writers/lea counts
re-derived, not read from the md), hash chain via canonical_sha256 vs
EV-93..97, clean-room byte compare, ledger counts, marker-window logic for
stale strings (stale bucket must sit within 勘误/撤销/残留/HISTORICAL/t088.1
window). Weak spot (cosmetic): test_no_double_base_residual's
`recorded−0x400000 != resolve_va` is near-tautological, but the band check in
test_nonempty_calls_in_image_va_band is the real guard.

## Correction-register accuracy (21 rows) — **2 inaccurate rows, 1 superseded description**

- **CR-T0881-09 (wrong hash):** decisive_evidence says "EV-93 source_sha256
  updated to ea831781…" — `ea831781` matches NO working-tree artifact; the
  actual EV-93 hash is `69f18c64…` (CR-T0881-18 records the correct one).
  Stale intermediate value. Non-blocking; fix the string.
- **CR-T0881-21 (overstated):** "evidence_refs extended: C-103 +EV-93;EV-94"
  — C-103's evidence_refs were NOT extended (refs landed in binary_identity;
  see D1). The C-028 half of the row IS correct.
- **CR-T0881-12 (superseded description):** correction_after describes the
  window as "0x6006AD..0x603102", but the final regenerated md uses the
  conservative earliest-start window 0x5FD9B1..0x603102 (per CR-T0881-19).
  Register-internal sequencing nit only.
- All other rows verified accurate against the artifacts (CR-01..08, 10, 11,
  13, 14, 15, 16, 17, 18, 19, 20).

---

# Differences found (original | mine | evidence | file+line | impact | blocking?)

**D1. C-103 evidence_refs not extended; refs in wrong column.**
- Original (lead): "evidence_refs extended: C-103 +EV-93;EV-94" (corrections
  report §F4 L96-97, §5 L199; CR-T0881-21).
- Mine: claims.csv C-103 `evidence_refs` = `EV-89;EV-90` (unchanged from
  baseline); `binary_identity` = `EV-89;EV-90;EV-93;EV-94` (baseline value
  "unpack079" overwritten with evidence IDs).
- Evidence: CSV row dump (columns 6/7 of the C-103 row).
- File+line: research/source-of-truth/claims.csv, C-103 row;
  T0881-EVIDENCE-INTEGRITY-CORRECTIONS-REPORT.md L96-97/L199;
  forensics/T0881-CORRECTION-REGISTER.csv CR-T0881-21.
- Reproduction: `python -c "import csv;print([ (r['evidence_refs'],r['binary_identity']) for r in csv.DictReader(open('research/source-of-truth/claims.csv',encoding='utf-8')) if r['claim_id']=='C-103'])"`.
- Impact: the T088 §6 promise remains half-unfulfilled in the authoritative
  column; binary_identity column corrupted (loses "unpack079"); validator
  blind to it. **BLOCKING: YES (must fix before commit — one-cell ledger fix
  + report/register line corrections; no reverse-engineering conclusion affected).**

**D2. CR-T0881-09 cites a non-existent hash `ea831781`.**
- Original: "EV-93 source_sha256 updated to ea831781…".
- Mine: actual and correct committed hash is `69f18c64…` (verified against the
  CSV artifact); `ea831781` occurs nowhere else in the tree.
- File+line: forensics/T0881-CORRECTION-REGISTER.csv, CR-T0881-09
  decisive_evidence.
- Impact: register accuracy only (the ledger hash itself is correct).
  **BLOCKING: NO.**

**D3. "ALL 80 resolve sites alias the shared object" retained in four summary surfaces.**
- Original (T088 wording, kept as current text in): G10 verified_scope;
  readiness L104; T088 report exec WP1 row L25; matrix P2-05
  evidence_grade_and_type.
- Mine: per C-106's own t088.1 precision note and the census's labels, 4 of
  the 80 sites (0x73E40A/0xA197DD/0xA19D57/0x93A0A1) perform no create and are
  not resolves; the closure applies to the 76 creating sites.
- Evidence: census rows (alias_kind="imm32-operand (not a resolve)"); C-106
  reasoning; CR-T0881-20.
- Impact: summary-level inconsistency with the corrected authority; no
  conclusion flips (the 4 sites were never evidence for the singleton).
  **BLOCKING: NO (recommended: one-line t088.1-corrected note in G10/RR104).**

**D4. CR-T0881-12's window description superseded by CR-T0881-19.**
- Original: "census fn 0x6006AD … window 0x6006AD..0x603102".
- Mine: final md 2d uses conservative window 0x5FD9B1..0x603102
  (start=prev-prologue); 0x6006AD documented as a mid-instruction label.
- Impact: register sequencing only. **BLOCKING: NO.**

**D5. "orders of magnitude beyond any plausible function extent" overstates the 0x89E4 minimum gap.**
- Original: BOUNDS §2d prose (L215-218) / coverage §3.
- Mine: 0x89E4 ≈ 35KB is same-order as the largest observed functions; the
  claim as phrased is weaker than needed for writer 0xA029BA. The conclusion
  is nevertheless airtight: 8 genuine prologues (first 0xA03F2D) + 430 E8
  targets lie between 0xA02B82 and 0xA0B39E, and the install sits in its own
  census function 0xA0AF3A — no containing function can span the gap.
- Impact: rhetorical; my barrier proof should be added. **BLOCKING: NO.**

**D6. Coverage md §2.5 over-describes the per-writer provenance output.**
- Original: "Per-writer provenance records whether the start is a prologue
  (strong) or an E8-target…".
- Mine: the 2d listing records the three candidates and the earliest-chosen
  source, but not prologue-vs-E8-target kind per candidate.
- Impact: documentation nit. **BLOCKING: NO.**

**D7. BOUNDS §2d prose names 0x791FE9 as "the SEH anchor" for 0x79293F while the listing's seh-anchor column reports 0x78FA4C (back=0x4000 reaches an earlier frame).**
- Both presented as conservative widening; no conclusion changes.
  **BLOCKING: NO.**

---

# VERDICT: **ACCEPT-WITH-CORRECTIONS**

The T088.1 fix set is real, generator-rooted, byte-verified, positively
controlled, honestly tested, and reproduces byte-identically from the pinned
inputs. Every substantive Phase-1 finding was adopted and correctly
implemented (76 true VAs; 4+2 base-table sites incl. the previously missed
0x52F1BC; 10 writers / 31 mov/lea with 0x952ECE; stale-bucket and historical
markers; C-106 dedupe; hash chain intact and updated).

**Blocking items (1):**
1. **D1** — fix C-103 `evidence_refs` to `EV-89;EV-90;EV-93;EV-94`, restore
   `binary_identity` to `unpack079`, and correct the matching claims in the
   corrections report (§F4/§5) and CR-T0881-21 (also fix D2's `ea831781` →
   `69f18c64…` while touching the register).

Non-blocking recommended: D3 (one-line 76-vs-80 precision note in G10
verified_scope / readiness t088 paragraph), D4-D7 (register/md wording).

---

# PHASE 3a - PRE-COMMIT RE-VERIFICATION (verbatim; all D1-D7 dispositions verified, global gates re-run by reviewer)

# T088.1 — Phase 3a Pre-Commit Re-Verification Notes

Reviewer: T088.1 independent sub-agent. Date: 2026-11-16. Read-only on the repo
(all runs with `PYTHONDONTWRITEBYTECODE=1`; outputs in temp; `git status`
confirms no `__pycache__`/`.pyc` created). HEAD still `60f1ee92` (pre-commit);
final working tree snapshotted to `wt3\*.wt3`.

EXE sha256 re-verified at run start: `d4a67597…a31718` ✓.

## Disposition verification

**D1 (was BLOCKING) — PASS.**
- claims.csv C-103: `evidence_refs = "EV-89;EV-90;EV-93;EV-94"` ✓;
  `binary_identity = "unpack079+Shape2D.dll"` ✓ — byte-equal to the value at
  `5f30b7a8` (verified via `git show 5f30b7a8:research/source-of-truth/claims.csv`;
  note 60f1ee92 had degraded it to "unpack079", so the fix restored the fuller
  parent-commit value — an improvement).
- `t0881_ledger_fixes.py`: the C-103 fix (lines 226-235) now sits INSIDE the
  live `elif cid == "C-103":` branch of the main claims loop (same branch as
  the historical markers), with fail-closed anchors on BOTH cells
  ("ABORT: C-103 evidence_refs/binary_identity anchor mismatch"). The dead
  elif is gone. CR-T0881-22 documents this (including "re-run atomically from
  reset").

**D2 — PASS.** CR-T0881-09 `correction_after` now cites "EV-93 source_sha256
updated to 69f18c64... (final hash incl. the CR-T0881-18 alias_kind fix)".
`ea831781` appears NOWHERE in the register (string search) — orphan hash
eradicated.

**D3 — PASS (all four locations).**
- gaps.csv G10 verified_scope: "aliases ALL CREATING resolve sites to ONE
  CWzVector2D (t088.1 precision: 76 of the 80 regex sites actually call
  0x447891; the other 4 are imm32-operand non-resolves — 3 id-range
  endpoints + 1 dispatch-chain data…)".
- Readiness L104: "…（63 push+17 mov；12 处持久别名；t088.1 精确注记：其中 4 个
  mov 站点为 imm32 操作数非解析点，别名闭包适用于 76 个真实创建站点）".
- T088 report L25 (exec WP1 cell): "…全部 80 个解析点（63 push + 17 mov）混叠同一
  CWzVector2D（主虚表 0x5140C2F0，x/y 整型 +0x1C/+0x20；t088.1 精确注记：80 个
  正则站点中 4 个 mov 形态为 imm32 操作数非解析点——3 个 id 区间端点 + 1 个
  分发链数据——别名闭包适用于 76 个真实创建站点…）" (inline-annotated, same
  convention as the readiness paragraph; note "3 id-range + 1 dispatch"
  matches my B2 byte findings).
- Matrix P2-05 evidence_grade_and_type: "…（t088.1 精确注记：80 个正则站点中
  4 个 mov 形态为 imm32 操作数非解析点，闭包适用于 76 个真实创建站点）…".

**D4 — PASS.** CR-T0881-12 correction_after now reads: "bounded via
conservative windows (superseded the initial census-only window
0x6006AD..0x603102 of this row's first draft; final = earliest-start window
0x5FD9B1..0x603102 per CR-T0881-19); …".

**D5 — PASS.**
- EV-97 hash chain: my fresh canonical_sha256 of the regenerated BOUNDS md =
  `d4a9cdcf9795f83b3eae0ddc357207fc58ba009318445a245d5122d708bc86cf` ==
  evidence.csv EV-97 source_sha256 ✓ (hash updated after regeneration).
- Barrier fact present and accurate in BOTH files, matching my Phase-2
  derivation byte-for-byte in substance: BOUNDS §2d L212-217 ("between writer
  0xA029BA's window end (0xA02B82) and the nearest install 0xA0B39E lie 8
  further genuine prologues (first 0xA03F2D), 430 in-window E8 call targets,
  and the install's own containing function — NO single function can span the
  gap, so the negative does not rest on a size plausibility argument") and the
  BOUNDED-NEGATIVE restatement L245-248; coverage md §3 L95-99. "orders of
  magnitude" is gone from both files (string search: 0 hits).
- Substance unchanged: §2 census numbers 49/21/10/17(+1 other)/31 intact
  (L46-50); POSITIVE CONTROL line with the 4 installs intact (L79); verdict
  "10/10 … CENSUS-FN-BOUNDED-NEGATIVE; 0/10 …; 0/10 …" intact (L236); all ten
  writer windows unchanged (spot-checked 0x60088A 0x5FD9B1..0x603102,
  0xA029BA 0xA02357..0xA02B82, 0x79293F 0x78FA4C..0x792A78, 0x7C939A
  0x7C6D3D..0x7C93DA); §2b/§2c install census unchanged (4 INSTALL + 2 LOAD +
  1 DATA; 32 derived zero).

**D6 — PASS.** Coverage §2 item 5 now reads: "…plus an SEH-ctor anchor scan
and a nearest-preceding-prologue scan as alternative candidate starts. Scan
window = [earliest candidate start, next census start). The 2d listing prints
all three candidates and the chosen (earliest) start for each writer." — this
matches exactly what §2d prints; the prologue-vs-E8-target over-description
is gone.

**D7 — PASS.** §2d prose now says "…the reviewer's true earlier starts are
0x791FE9/0x7C8E9F) and 0x60088A's census start 0x6006AD decodes
mid-instruction … (Note: the 0x4000-back SEH scan anchors 0x78FA4C/0x7C8E9F
can sit in the ADJACENT function — earliest-start conservatism accepts that;
it only widens the scanned region, which is safe for a negative claim.)" —
reviewer-true-starts vs scan-anchor distinction made. (Footnote, non-issue:
listing 0x7C8E9F as one of the anchors that "can sit in the ADJACENT
function" is over-cautious — it is the genuine containing SEH fn start for
0x7C939A — but as a possibility statement it only errs conservative.)

## Global integrity (all fresh runs by me)

- `python research/scripts/validate_reverse_engineering.py` → PASS,
  0 errors / 0 warnings, exit 0; Claims 109 / Gaps 41 / Evidence 97 —
  byte-consistent with committed `T0881-VALIDATOR-LOG.txt`.
- `python -m unittest discover -s research/tests -q` → **Ran 146 tests, OK,
  exit 0** — matches committed `T0881-UNITTEST-LOG.txt` (146/146 OK; timing
  differs 7.9s vs 8.0s — immaterial).
- `T0881-CLEANROOM-LOG.txt` consistent; and I re-verified sync directly:
  CLAIM-CONSISTENCY-REGISTER == claims.csv, EVIDENCE-INDEX == evidence.csv,
  GAP-REGISTER == gaps.csv (CRLF-normalized byte equality).
- Hash chain intact and current: census CSV `69f18c64…` (= EV-93, unchanged
  since Phase 2); classification CSV `2f5c550e…` (= EV-93 companion,
  byte-identical to T088 baseline); BOUNDS md `d4a9cdcf…` (= updated EV-97).
- Ledger counts independently recounted: claims 109 / evidence 97 / gaps 41 ✓.
- `git status --porcelain`: every modified/untracked path is under
  `research/` — **no file outside research/ is touched**; no pycache/pyc.
- Register now has **24 rows** (21 + CR-T0881-22/23/24 documenting the
  phase-2 dispositions D1, D3, D5/D7) — an improvement; all three new rows
  verified accurate.

## New findings

None blocking. Two footnotes recorded above (0x7C8E9F over-caution in D7
prose; T088 report L25 keeps the original T088 phrase inline but with the
immediate t088.1 precision note, consistent with the readiness/matrix
convention — acceptable). No new stale numbers, no new VA/offset confusion,
no hash mismatches introduced by the D1-D7 edits (marker-window regression
tests passed in the 146-test run).

## Pre-commit verdict: **ACCEPT**

All seven dispositions correctly applied and independently verified; global
integrity green (validator 0/0, tests 146/146, logs match fresh runs,
clean-room synced, hash chain current, counts 109/97/41, repo changes
confined to research/). Ready to commit and push; I stand by for the Phase-3b
remote-tree read-back.

---

# PHASE 3b - POST-PUSH REMOTE READ-BACK

(pending: to be recorded by the lead from the reviewer session after the fast-forward push; the final remote SHA must match the tree audited above.)
