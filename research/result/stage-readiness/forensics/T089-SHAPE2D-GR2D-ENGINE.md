# T089 — Shape2D/Gr2D Animation & Parallax Engine: CMS079 Originals (G36/G39/G37)

**Round**: t089 (2026-11-16). Lead-agent derivation; blind-reviewer corroboration where noted.
**Sources**: EXE (sha d4a67597…31718); Shape2D.dll 1.0.0.1 (sha 9802bacc…c8111b, ImageBase 0x51400000);
Gr2D_DX8.dll (sha ad67b9a0…6a25d1, ImageBase 0x50400000). PE section mapping for both DLLs.
**External candidates (level B)**: OpenMS GMS083 citations (docs.openms.dev, read 2026-11-16):
`0x0043F768` (delay default 0x78), Gr2D `0x5040ABEF`/`0x5040B9E7`/`0x5040A949`/`0x5040DA7C`,
Shape2D `0x5140847D`/`0x514085B3`/`0x5140828F`/`0x51408D23`/`0x51408E33`, vtable `0x5140C0FC`,
repeat via `0x0063C212`, portal family via `0x00712313`-family, `repeat ∈ {−1,−2,≥0}` semantics.

The two DLLs are DIFFERENT builds from GMS083's (hashes differ); every match below was
verified from CMS079 bytes at the CMS079 addresses, several of which coincide with the
GMS083 citations.

---

## 1. Namespace name decryptions (C-103 cipher; table 0xBA7B04)

T089-NAMESPACE-ID-NAMES.txt / T089-NAMESPACE-BULK.txt prove (static):

| id | name | role |
|---|---|---|
| 0x54B | `front` | G35 branch flag (see T089-G35-BACKGROUND-KEY.md) |
| 0x543/0x544 | `bS` / `Map/Back/` | back-set / path |
| 0x545/0x546/0x547/0x548/0x549/0x54A | `rx`/`ry`/`cx`/`cy`/`ani`/`a` | back attributes |
| 0x54D/0x54C/0x54E | `back/%d` / `back%d` / `ani/%d` | record paths |
| 0x331/0x332/0x323/0x324 | `x`/`y`/`z0`/`z1` | coords / per-frame part depths |
| 0x1581 / 0xBF0 | `type` / `flow` | mode selectors (C-048/C-049) |
| 0x54F..0x553 | `moveType`/`moveR`/`moveW`/`moveH`/`moveP` | auto-move attrs (C-059) |
| **0x155D / 0x1550 / 0x1551** | **`delay` / `a0` / `a1`** | frame timing triple (closes G36 §11.3) |
| **0x8D4** | **`repeat`** | playback mode |
| 0x1061 | `repeatStartIndex` | (present in pool) |
| **0x601/0x602/0x603** | `pv` / `Map/MapHelper.img` / `game` | portal graphics |
| **0xF7D/0xF7E/0xF7F** | `portalStart` / `portalContinue` / `portalExit` | portal actions |
| 0x656 | `Map/MapHelper.img/portal/game/pg` | editor art (no artwork supplied) |
| 0x53B / 0x53A | `once` / `blend` | obj attributes |

CMS079's id space genuinely differs from GMS083's (e.g. GMS083 delay id 0x15F8 has NO
record here; 0x5CE/0x5CF are Mob paths, not foothold/ladderRope) — ids were never ported.

## 2. Frame property converter 0x43EC69 (EXE)

```
0043EC79 6a78      push 0x78            ; DEFAULT 120
0043EC81 685d1500  push 0x155d          ; 'delay'
          ... 0x7A48D0/0x406368/0x414A49/0x404BA3/0x40263B/0x403AC7/0x415344
0043ECFA 6aff      push -1              ; default -1
0043ED02 68501500  push 0x1550          ; 'a0'
0043ED7C           push 0x1551          ; 'a1' (default -1)
0043EDF6/0043EE74  push 0x323/0x324     ; 'z0'/'z1'
0043EF67  e8…      call 0x427de0        ; -> vtable slot +0x104 creator
```

Reads delay (default **120 = 0x78**; phase-2 D2: this default holds at the frame-converter
and tiler sites — 18 of the 36 `push 0x155D` sites; other consumers pass explicit defaults
150/60/180/1000 or variable defaults), a0/a1 (default −1), z0/z1, then delivers six
variants through **`0x427DE0` = `call [ecx+0x104]`** (the per-frame record creator;
same slot used by the G36 tiler per-child creation — shared engine).

**18 `push 0x78`+`push 0x155D` sites image-wide** (T089-G39-DELAY-SITES.txt /
T089-G39-DELAY-DEFAULT.txt), including the tiler's own per-child read at 0x66ABC5-0x66ABCD
and the frame converter 0x43EC69 — the 120 default governs the frame-converter/tiler
family (the remaining 18 delay sites carry explicit or variable defaults; see phase-2 D2).

## 3. Gr2D frame-record writer 0x5040ABE6 (CMS079; GMS083 cite 0x5040ABEF)

Function at **0x5040ABE6** (SEH prolog; misalignment artifact in T089-DLL-CROSSVERSION-PROBES.txt
corrected in T089-GR2D-FRAME-REGION.txt):

```
5040ACCB  cmp word [ebp+0x10], cx(=3=VT_I4)   ; delay variant typed?
5040ACD2  jne -> or eax,-1                     ; else -1
5040ACE3  mov [rec+0x0C], eax                  ; DELAY at +0x0C
5040ACE6/0x5040ACF7  a0 -> [rec+0x10]          ; A0 at +0x10 (VT_I4/-1)
5040AD07  a1 -> [rec+0x14]                     ; A1 at +0x14
5040AD1E/0x5040AD35  z-pair -> [rec+0x18]/[rec+0x1C] (bool-normalized)
          serial: inc [esi+0xD0] on insertion; list ops at [esi+0x9C]/[esi+0xBC]
```

Structure-equal to the GMS083 description (delay@+0x0C, a0@+0x10, a1@+0x14, −1 = omit).

## 4. Gr2D timeline accumulator (inside the function containing 0x5040B9E7)

```
; loop-period pre-pass (signed):
5040BC54  add edi,[eax+0xC]        ; sum frame delays over suffix
5040BC59  mov eax,edi; imul eax,[ebp-0x1C]; cdq
5040BC60  mov ecx,0x3E8; idiv ecx  ; totalPeriod = Σdelay·scale/1000 (SIGNED)
; per-frame accumulation (unsigned):
5040BCC7  mov eax,[esi+0xC]        ; frame delay
5040BCCA  imul eax,[ebp-0x1C]      ; × animationScale
5040BCD0  mov ecx,0x3E8; div ecx   ; UNSIGNED /1000
5040BCDD  add [ebp+8],eax          ; end-timestamp += delay·scale/1000
; event record: {+0 vt=6, +0xC frame, +0x10 end-ts, +0x14 loopPeriod|−1, +0x18.. a0/a1/z0/z1}
; mode gates: test byte [ebp+0xC],0x20 (loop) at 0x5040BC02; 0x10 (one-shot) at 0x5040BD39
```

**`frameDelay × animationScale / 1000` accumulated into end timestamps** — the GMS083
algorithm, byte-proven in CMS079. The mode flag comes from the mode selector **0x50403ECA**
(`[this+0x2C]`: 0x17→mode 0x10, 0x16→mode 0x20, else 0).

## 5. Delay unit and clocks

- Shape2D Vector2D slot **+0x58 (0x514076CC) = GetGlobalTick**: `out = [0x51411C34]`.
  Slot **+0x5C (0x514076E8) = SetGlobalTick**, monotonic (rejects regression with
  0x80070057). EXE wrapper `0x43715C` reads it (the C-060 "slot58" layer read).
- C-060's scroll phase `slot58 + 20000/|rate|` is therefore `globalTick + 20000/|rate|`
  — delivered as `V{VT_I4, sum}` with `V{VT_I4, 0x10000000}` into the second `+0x90`
  call: the auto-scroll passes the computed value as the Set-interpolation time
  parameter (C-108's VT_I4 duration/time form). *(Phase-2 D15: reading the value as
  an "end time on the tick timeline" is CORRELATIVE — the pending-list walker body
  that consumes start-tick vs value is undecoded statically; C-108's "duration"
  wording is retained.)* At the mechanism level this matches OpenMS GMS083
  "schedules movement to the base coordinate after trunc(20000/abs(speed))
  milliseconds".
- With /1000 scale conversion proven in the accumulator, delay values are
  millisecond-class integers on the same tick timeline (animationScale default itself
  remains runtime-bound — see Residual).

## 6. `repeat` semantics (EXE 0x66F890)

`repeat` (id 0x8D4) is read by the Obj loader **0x66885B** (the same function computing the
C-002 obj key at 0x6688C4 — structural counterpart of GMS083 0x0063C212) into an out-slot;
the registration dispatcher **0x66F890** triages:

| repeat value | mode pushed | call | semantics |
|---|---|---|---|
| ≥ 0 | **0x20** | `[obj.vtable+0x110](obj, mode, V{VT_I4,repeat}, …)` | loop; value = repeating-suffix start (cf. `repeatStartIndex` id) |
| −1 | **0** | same slot, default VT_ERROR variants | plain single registration |
| −2 | **0x10** | same slot, after `0x443717(obj)` gate + extra property read (0x402C26) | one-shot variant |
| other | — | no registration | |

The 0x20/0x10 mode constants flow to the Gr2D mode gates (§4). This is the CMS079-original
proof of GMS083's "−1/−2 one-shot; nonnegative = repeating suffix" triage.

## 7. Portal animation family (G39)

- Ids: `pv`=0x601, `Map/MapHelper.img`=0x602, `game`=0x603, `portalStart`=0xF7D,
  `portalContinue`=0xF7E, `portalExit`=0xF7F (T089-G39-PORTAL-IDS.txt; sites at
  0x71AExx/0x71B0xx/0x71B3xx = MapHelper mount & game read; 0x71BAE3/0x71BDA9/0x71B81C =
  Start/Continue/Exit selectors — the CMS079 counterparts of the GMS083 0x00712xxx family).
- 13-map FSDB HelperFrame (map.helper.jsonl): **pv = 8 frames; ph/default/portalStart = 4,
  portalContinue = 7, portalExit = 3** — frame counts identical to GMS083's documented
  8 / 4+7+3 split. With the frame-converter-family 120-ms default (§2): pv loop = 960 ms, Start = 480 ms,
  Exit = 360 ms whenever per-frame delays are absent; per-frame explicit delays are not
  present in FSDB (WZ-side; residual).
- Loop registration: pv/Continue-family playback uses the mode-0x20 path (§6) — the same
  "looping artwork" mode as GMS083's portal animation calls.

## 8. Parallax attach + evaluator (Shape2D; closes G36's +0x98 residual)

**Attach 0x5140847D** (ret 0x18; args (this, source, denomX, denomY, numX, numY)):
validates source; allocates record (pool [0x51411C74]); initializer 0x5140857F writes
vtables 0x5140D920/0x5140D91C/0x5140D92C and zeroes {+8 src, +0xC X0, +0x10 Y0,
+0x14 Dx, +0x18 Dy, +0x1C Wx, +0x20 Wy}; then
`0x51405CD9(src) → [rec+0xC] = sourceX_now` and `0x51405D00(src) → [rec+0x10] = sourceY_now`
(**attachment baseline snapshot**), `[rec+0x14/0x18] = 100/100` denominators,
`[rec+0x1C/0x20] = rx/ry` numerators; installs the record via 0x514072CF + 0x5140833B
(the same pending-evaluator list as the Set interpolation family — EV-95).

**Evaluator 0x514085B3** (ret 0xC):

```
eax = 0x51405CD9([rec+8]);  eax -= [rec+0xC];  eax *= [rec+0x1C]
cdq; idiv [rec+0x14];  [edi+0] += eax          ; localX += trunc((Xnow−X0)·Wx/Dx)
eax = 0x51405D00([rec+8]);  eax -= [rec+0x10]; eax *= [rec+0x20]
cdq; idiv [rec+0x18];  [edi+4] += eax          ; localY += trunc((Ynow−Y0)·Wy/Dy)
```

**`local += trunc((source_now − source_attach) · num / den)` with signed idiv truncation** —
instruction-identical to the GMS083 contract. The loader's scroll-branch calls
(C-048/C-060 sites, byte-re-confirmed by the blind reviewer) pass
`(origin, 100, 100, 0, ry+100)` / `(origin, 100, 100, rx+100, 0)` — auto-scroll axes
clear the source parent and use ratio+100 forms exactly as documented for GMS083 types 4–7.

Receiver identity: the blind reviewer verified the scroll-branch `+0x90/+0x98` receivers
are statically the **shared 0x31D CWzVector2D** (main vtable **0x5140C2F0**; slot +0x90 =
0x5140828F numeric Set per EV-95, slot +0x98 = 0x5140847D attach; the parallel table
0x5140C0FC carries the same pair at +0x90/+0x98 — both Shape2D vector-family tables share
the layout, so the conclusion is table-invariant).

## 9. Camera filter family (G10; details in T089-G10-FILTER-*.txt)

Vector2D slot **+0xA8 (0x51408C9A)** = filter commit: looks up evaluator id **0x1E0000**
via 0x51408C44; on miss creates the record from template {0x5140D968/0x5140D964/0x5140D974}
(method **0x51408D23** at data 0x5140D970); `[rec+8] = coefficient arg`; installs it.
Slot **+0xA4 (0x51408BED)** = filter query (out = [rec+8]-anchored read).

**0x51408D23** (record method): first commit with commit-flag **snaps** history
(fild target → double history X/Y at +0x10/+0x18, time +0x20, armed flag +0xC);
afterwards per axis: D = target − history; direction via `fcom [0x5140D8C8]` (0.0);
residual via **0x51408E33**; output = D−residual (sign-directed), round-clamped
±0.5 ([0x5140D8D0]/[0x5140D8D8]), committed to int via 0x5140ADFE; commit-flag updates
history and time.

**0x51408E33** (residual): `|D| fcom [0x5140D978]` — **deadband constant = 28.0**;
inside → |D| returned unchanged (no approach); outside →
`residual = max(0, (coef·1000)·|D| / (elapsed·|D| + coef·1000))` where coef = [rec+8]
(`imul eax,eax,0x3E8` materializes coef·1000) and elapsed = now − [rec+0x20].

EXE integration: exactly **3 `call [vector+0xA8]` sites** — **0x43787D** inside
**0x437717** (`push 0x64` = **coefficient 100**), 0x942DF7 (containing SEH function
**0x942AC5**), 0x94A796 (containing SEH function **0x94A2AE**); all three error-tagged
with IID 0xBA0500 (Shape2D#Vector2D).
**0x437717** *(phase-2 D1 corrected chain)*: runs on the **global `[0xBDD460]` object**
(caller 0x95098C-0x950993: `0x43291A` = `mov eax,[0xBDD460]; ret` — a getter, NOT a
creator; the existing `[user+0xF28]` container is read, stashed and AddRef'd (vt+4)
as arg1 at 0x950970-85; no F28 write-back in this window). Inside: resolve `0x31D`
via `0x447891` = the **C-106 shared-SINGLETON Vector2D chain (the camera object
itself)** → `+0x64` attach to the F28-container arg → **`+0x90` Set(0, −0x32)** →
**`+0xA8` filter commit(100)** → attach into the renderer origin (`0x4371B1` on
[0xBE2788]); `ret 4`. The arming therefore lands the smooth filter **on the shared
camera vector**, with the user-container target at **(0, −0x32) = (0, −50)** — matching
the GMS083 `(x, y−50)` local-user camera-target candidate.

## 10. Verdicts and residual

| finding | grade |
|---|---|
| delay id/default/unit triple (0x155D/120-at-converter-family/scale-per-1000) | DIRECT-INSTRUCTION (EXE+Gr2D) |
| a0/a1/z0/z1 ids + defaults −1 | DIRECT-INSTRUCTION |
| Gr2D record layout delay@+0x0C,a0@+0x10,a1@+0x14 + serial-on-insert | DIRECT-INSTRUCTION |
| accumulator Σ delay·scale/1000 → end timestamps; mode gates 0x20/0x10 | DIRECT-INSTRUCTION |
| repeat triage ≥0/−1/−2 → modes 0x20/0/0x10 | DIRECT-INSTRUCTION |
| GetGlobalTick/SetGlobalTick ([0x51411C34]) | DIRECT-INSTRUCTION (slots +0x58/+0x5C) |
| scroll phase = +0x90 time-parameter globalTick+20000/|rate| (end-time reading correlative; phase-2 D15) | DIRECT-INSTRUCTION (delivery) + CORRELATIVE (walker) |
| parallax attach/evaluator incl. baseline snapshot + idiv trunc | DIRECT-INSTRUCTION (Shape2D) |
| portal ids + FSDB frame counts 8 / 4+7+3 | NAME-PROOF + FSDB |
| camera filter 28-px deadband / coef 100 / snap / residual formula | DIRECT-INSTRUCTION (Shape2D + 3 EXE sites) |
| per-frame explicit delay values (WZ), animationScale default, first-frame absolute offsets (attach baseline), +0x9C (0x514086B3) variant semantics | OPEN (documented) |

These close G36's "+0x90/+0x98 method bodies" and "string names" residuals and most of
G39's "delay unit/accumulation/loop/portal timing"; G37's per-child animation rides the
same proven engine (0x427DE0 slot+0x104 delivery + 0x66F890 registration), leaving only
per-frame draw bodies runtime-bound.
