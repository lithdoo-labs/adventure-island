# T084 — Ladder / Rope Type Fork Analysis (Static Forensics)

Round: t084 (2026-11-15). Binary identity as in T084-CAMERA-CALLGRAPH.md. Evidence: `forensics/T084-EV64-SLOT13-FORK.txt`, `forensics/T084-EV65-RECORD-ID-SIGN.txt`, `forensics/T084-EV66-ROPE-LOADER.txt`, `forensics/T084-EV67-FOOTHOLD-WRITER.txt`, `forensics/T084-EV68-FIELD-OBJECT.txt`.

Related: G41, P3-13, C-056, C-069..C-073, C-068.

---

## 1. Verdict

**CONFIRMED (fork located, instruction-level).** The Ladder/Rope behavioral fork is **not** a flag branch on a type bit. It is the **sign convention of the standing-context record id**:

- **foothold context id = +[fh+0x48]** (positive),
- **rope context id = −(word)** (negative; the rope's 1-based table index negated),

consumed at **0x9BCA6F** (physics-family vtable **slot 13**, uniform across all 8 per-state tables at `[vt+0x34]` — dword sites 0xB0C4CC/0xB0C694/0xB0C794/0xB0C8A4/0xB0C9A4/0xB0CAA4/0xB0CBA4/0xB0CCAC).

The candidate addresses from G41 resolve as:

| candidate | resolution |
|---|---|
| **0x9BCA6F** | **CONFIRMED = the fork site** (id-sign consumer; also installs [M+0x130/0x134] hints and the rope handle) |
| **0x9BCC9A** | **CONFIRMED = the negative-id branch target** (rope-by-index lookup) |
| **0x517DA8** | **REFUTED as a fork site** — it is the *foothold-by-id* hash-map lookup (field+0x90, thiscall, id→fh object); it never sees ropes |

## 2. The fork instructions (0x9BCA6F, extent 0x9BCA6F–0x9BCC97, ret 0xC)

```
0x9BCAE5  call 0x6B8A18(M+0x19C, &x,&y,&vx,&vy, &id16, &M+0x148, &flags)
          ; record walker: id16 <- record word +0xC ; flags |= 1<<kind ; M+0x148 <- record byte +0xA
0x9BCBA6  shr eax,0x11 ; and eax,1 ; [M+0x16C] = (kind==0x11)   ; M+0x170 = old value
0x9BCBAE  cmp word [ebp-4], di(0)        ; id16 sign test
0x9BCBBA    jg -> 0x9BCBBC               ; POSITIVE id
0x9BCBBC      movsx eax,word [ebp-4]
              mov ecx,[0xBDD498]         ; field object
              push eax
              call 0x517DA8              ; foothold-by-id (hash map at field+0x90)
0x9BCBD2    cmp word [ebp-4], di
0x9BCBD6    jge -> 0x9BCBEC              ; NEGATIVE id
0x9BCBD8      movsx eax,word [ebp-4]
              mov ecx,[0xBDD498]
              neg eax
              push eax
              call 0x9BCC9A              ; rope-by-index (field+0xA8 table)
```

- 0x517DA8 body: `this+0x90` container → `0x51847B` find (hash = key % [map+8], bucket chain, node {next@+4, key@+8, value@+0xC}); returns the fh object or 0.
- 0x9BCC9A body: `index=[esp+4]; cmp 1; jb → 0; edx=[ecx+0xA8]; count=[edx−4]; cmp; jae → 0; imul eax,eax,0x1C; add eax,edx; ret 4` — i.e. `&ropeTable[index]`, index ≥ 1, stride 0x1C, count header at −4.

After the fork (context install, both branches):

- foothold branch (0x9BCBF8): if `esi != [M+0x110]`: `[M+0x118]=0; [M+0x114]=esi; [M+0x110]=esi; [M+0x130]=[esi+0x1C]; [M+0x134]=[esi+0x20];` notify `[[M+0x14]vt+8](M)`.
- rope branch (0x9BCC49): if `edi != 0x4B6ABE(M+0x124,[M+0x12C])`: `[M+0x118]=0; 0x9BFD85(M+0x124, edi) -> [M+0x12C]; [M+0x130]=[edi+0x18]; [M+0x134]=0;` notify `[[M+0x14]vt+8](M)`.

## 3. Id provenance (0x6B87D1 record setter — the sign is CREATED here)

```
0x6B87E6  arg2(foothold ptr) != 0 -> edi = [eax+0x48]        ; +id (dword; writer 0xA4F4B6 stores node-name int)
0x6B87EB  elif arg4(word ptr) != 0 -> di = *arg4 ; neg di    ; -id  (rope word negated)
0x6B87FA  else edi = 0
```

The record layout (`0x6B8A18` outs): `{kind byte @+0, x @+2, y @+4, v1 @+6, v2 @+8, flagsA byte @+0xA, id word @+0xC, roll word @+0x10}`. Kinds 0x11/0xF bypass the id install; kind 3 sets mirror-copy bit; kind 0xB (0x11-family notify from 0x965A09) feeds this container via 0x53E95D.

## 4. Rope loader write-side (0xA4F091 loop; closes the G41/G40 loader question for ropes)

Field-load 0xA4D303 (creates field #1 `[0xBDD498]`):

```
0xA4EFCE  eax = 0x409FFD(...)            ; rope count
0xA4EFE5  0xA51577(field+0xA8, count+1, &flag)   ; table alloc: count header + (count+1)*0x1C slots, 1-based
edi = 1
loop 0xA4F091..0xA4F2EE (stride += 0x1C, edi++ while edi <= count):
  [rec+0x00] = edi                       ; 1-BASED INDEX (== FSDB rope `id`)
  prop 0x832 -> 0x415344 -> neg/sbb/neg  -> [rec+0x04] = 0/1   ; l  (boolean-normalized)
  prop 0x833 -> 0x415344 -> neg/sbb/neg  -> [rec+0x08] = 0/1   ; uf (boolean-normalized)
  prop 0x331 -> 0x415344                 -> [rec+0x0C] = int   ; x  (0x331 is the same id used for tile x-int, EV-34/C-074)
  prop 0x830 -> 0x415344                 -> [rec+0x10] = int   ; y1 (top)
  prop 0x831 -> 0x415344                 -> [rec+0x14] = int   ; y2 (bottom)
  prop 0x627 -> 0x415344                 -> [rec+0x18] = int   ; page
```

FSDB cross-check: rope records `{"x","y1","y2","l","uf","page","id"}` — 7 fields ↔ 7 dwords; all 16 records (EV-63) carry the seven fields; index base 1 matches `[rec+0]` and `0x9BCC9A`'s `index>=1` guard. Property-id consistency: `0x830/0x831` appear as (y1,y2) in BOTH the rope loop and the foothold loop (see T084-FOOTHOLD-LOADER-WRITE-PATH.md), mutually confirming the name binding.

## 5. Where `l` and `uf` are consumed

- **uf** (`[rope+8]`): consumed in the climb endpoint clamp (C-056/C-072, unchanged: `y < top -> top−5` iff `[edi+8]≠0`, re-read top otherwise; window re-dumped in EV-68).
- **l** (`[rope+4]`): **NO static consumer exists.** Complete census of rope-record readers:
  - spatial query 0xA4FC6F (+0x8/+0xC/+0x10/+0x14 reads; none at +4),
  - the six grab sites 0x9D4473/0x9D45C3/0x9D4739/0x9D7D4F/0x9D7E9F/0x9D8015 (no `[reg+4]` read on the record),
  - climb body 0x9D80EC–0x9D8217 (reads +8/+0x10/+0x14 only),
  - slot13 0x9BCA6F (reads [edi+0x18] only),
  - slot1 wrapper 0x9CBE4F inline re-lookup at 0x9CC077-0x9CC09F (reads [rec+0] only);
  - the only loader of property 0x832 is 0xA4F0A5 (store-only).
- **Conclusion:** in this client image the ladder/rope type bit is loaded but does not drive any movement/collision/input/presentation branch reachable statically. The behavioral difference (if any at runtime) is either absent in CMS079's movement code or lives outside the rope-record paths. `l` therefore does NOT implement the fork; the sign convention does.

## 6. G41 "hint tension" — RESOLVED STATICALLY (with a C-068 label correction)

The loader write-side (foothold path, see T084-FOOTHOLD-LOADER-WRITE-PATH.md) proves:

- `fh+0x1C = int(outer WZ node name)` = **layer**, `fh+0x20 = int(inner node name)` = **platform** (both via `0xA70518` name→int; EV-67 windows 0xA4E1BA/0xA4E2E3/0xA4E413).
- Therefore the slot13/slot1 copies `[M+0x130]=[ctx+0x1C]`, `[M+0x134]=[ctx+0x20]` install **(layer, platform)** — NOT "(x2,y2) hint" as C-068's label said. The rope branch installs `([rope+0x18], 0)` = **(page, 0)** — page is the rope's layer analog.
- The t082 "compact-rope-record vs slot5-hint-read tension" dissolves: both writers are now instruction-bound, and they are consistent — `0x9BC622`'s arg7-copy and `0x9BFB52`'s arg1-copy move the same (layer,platform) pair that the loader wrote. **The runtime dump of [M+0x130/0x134] is no longer required to settle hint semantics** (it remains useful only as general corroboration).
- **CORRECTION (label-level, chain to C-068):** `+0x1C/+0x20 = layer/platform` (was "x2/y2 (hint source)"); the true geometry pair x2/y2 lives at `+0x14/+0x18` (proven by the writer and by the derived `dx=[+0x14]−[+0xC]`, `dy=[+0x18]−[+0x10]`). C-068's layout claim is otherwise confirmed and now write-side proven (see C-080).

## 7. Field-object structure (context for the tables)

Field #1 ctor 0xA4D393 (vtable 0xB0DD98, stored to `[0xBDD498]`): `+0x24` map bounds (±0x7FFFFFFF/0x80000000 via `[0xBE16BC]`), `+0x44` spatial collection (swept query 0x5114AA via 0xA4F6F1), `+0x7C` hit-record subobject (vtable 0xB00D88), `+0x90` id-hashmap (997 buckets, vtable 0xB0DD9C, insert 0xA513F6, find 0x517DA8/0x51847B), `+0xA8` rope table (NULL until 0xA51577). Second instance ctor 0xA546BF (vtable 0xB0DE10, global `[0xBE65F8]`, scene+0x34).

## 8. Ledger deltas

- NEW C-078 (fork at slot13 + rope-by-index 0x9BCC9A + 0x517DA8 refutation) — EV-64/65, grade A.
- NEW C-079 (rope loader write-side; l unconsumed census) — EV-66/68, grade A.
- NEW C-080 §labels (C-068 correction: layer/platform at +0x1C/+0x20; write-side of the fh record) — EV-67.
- G41: fork + hint semantics closed statically; remaining open = up+down simultaneous input layer + general runtime corroboration; status PARTIAL-STATIC (scope narrowed).
- P3-13/P3-14 matrix rows updated.
