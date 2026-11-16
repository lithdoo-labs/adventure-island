# T090 — G39 Animation Timeline Closure (WZ Side + Engine Semantics)

Round t090 (2026-11-16). Inputs: original CMS079 `Map.wz`
(SHA-256 `9e0d2a0fcecac2c99ee3cb15b03c41b5617d7d0637b55fb132f0eeed27155f69`,
796 MiB, from the `.work/task-001/extracted/冒险岛online/` client folder — the
same physical sample family as the EXE/DLLs; read-only via the repo-local
wz-python reader, region 'EMS'), plus the sha-pinned EXE / Gr2D / Shape2D.

---

## 1. What was still open after T089 (G39)

| Residual (gaps.csv) | Status this round |
|---|---|
| per-frame EXPLICIT delay values (WZ-side; absent from static FSDB) | **CLOSED** — full census from the original WZ (§2) |
| animationScale default value | **CLOSED** — default 1000, byte-proven (§3) |
| per-consumer default table for the 18 non-120 sites | **CLOSED** — all 36 sites decoded (§4) |
| resource-level portal durations beyond the default-120 computation | **MATERIALLY ADVANCED** — original portal frames carry NO delay; durations stay default-based with the consumer default still unlocated (§5) |

## 2. Original-WZ frame census (T090-G39-WZ-FRAME-CENSUS.csv)

4,347 frame rows over the 13 target maps (back ani=0/ani=1, obj layers 0–7)
plus the MapHelper portal family; 475 distinct resources; 1 missing resource
(`Back/…/back/…` referenced by **222000001** but absent from this WZ build — recorded, not
fabricated [t090 phase-3 D2: attribution corrected from the census CSV; the
original prose said 222000000]).

| consumer | frames | explicit delay | top explicit values |
|---|---:|---:|---|
| back ani=1 | 526 | 334 | 3000×60, 1000×42, 3400×36, 3200×30, 3600×26 … |
| obj | 3,540 | 2,114 | 190×284, 200×265, 170×258, 180×248, 165×215, 205×196, 3000×99 … |
| back ani=0 (static, single canvas) | 190 | 0 (n/a — not animated) | — |
| portal/game | 91 | 2 | 1500×2 (only `psh/1/portalStart/0` and `psh/1/portalExit/0`, with a0/a1 fades) |

- **35 distinct explicit delay values** (100 … 4000). The value 120 is just one
  of them — normalizing every frame to 120 ms is REFUTED by the resource data.
- **329 multi-frame animated resources**: 99 all-frames-explicit,
  **225 with NO explicit delay on any frame** (they genuinely rely on the
  consumer default), 5 partially explicit (mixed within one frameset —
  e.g. `Obj/acc5.img/aquaRoad/waterdrop/1` = 205/1700).
- a0/a1 appear on 456 frames (alpha fades); z0/z1 never appear in this corpus.

## 3. animationScale default (byte-proven)

- The timeline accumulator is Gr2D **0x5040B9DE** = the **[vt+0x110]** slot of
  the node-class primary vtable **0x5042E3F0** (0x5042E3F0 + 0x110 = 0x5042E500
  holds the dword 0x5040B9DE; single occurrence in the DLL). This is the SAME
  slot the EXE animation registrations call (`call [eax+0x110]` at 0x66A136 and
  the 0x66F890 repeat triage) — registration and timeline are one engine.
- Head: `0x504027BB(out=[ebp-0x1C], VARIANT=[ebp+0x10], 0x3E8)`; the coercion's
  fast path (VT_EMPTY/VT_ERROR → `*out = arg3`) at **0x5040283D** stores the
  **default 1000**. [ebp+0x10] is the V3 argument of the [vt+0x110] call.
- Every classified registration site passes V{VT_ERROR,missing} (C-060/C-108),
  so the **effective animationScale = 1000** and the per-frame advance is
  `delay·1000/1000 = delay` in global-tick units.
- Unsigned per-frame div at 0x5040BCD0 (`div 0x3E8`); total loop period
  SIGNED `idiv 0x3E8` at 0x5040BC60 — confirmed and modeled.

## 4. Complete 36-site delay-consumer default matrix (T090-G39-DEFAULT-CONSUMER-MATRIX.csv)

Every `push 0x155D` site's seeding default decoded from the stack-seed idiom
(`push DEFAULT; push reg; mov eax,esp; … push 0x155D; push eax; call 0x7A48D0`;
`mov eax,esp` = `8B C4`):

| default | sites | addresses |
|---|---:|---|
| **120** | 18 | 0x40BD68 0x40CC44 0x40DB86 0x40E29A 0x4110EC 0x41457A **0x43EC81 (frame converter)** 0x48A2F5 0x48D0CB 0x4CBD08 0x4CBDF9 0x651365 **0x66ABCD (tiler per-child)** 0x875013 0x89F581 0x987581 0x988B20 0x9892D9 |
| **150** | 2 | 0x406EDC 0x4071E3 |
| **60** | 2 | 0x40811B 0x40907F |
| **180** | 3 | 0x40EE4B 0x40F595 0x410832 |
| **1000** | 2 | 0x5FA885 0x9420D6 |
| **register-seeded (variable)** | 9 | eax: 0x408D66 0x409C9C 0x45377E; ebx: 0x69834A 0x6985F7 **0x71A72A (portal flat reader — proven 0)** 0x76AF9B; edi: 0x6913CF; ecx: 0x989C69 |

- **0x71A72A resolved**: containing function 0x71A203 (portal-graphics family
  reader: ids tm 0x5FF / tn 0x600 / pv 0x601 / Map/MapHelper.img 0x602 / game
  0x603 / hideTooltip 0xD86 / onlyOnce 0xF50 / delay 0x155D → record fields,
  delay at rec+0x2C); `xor ebx,ebx` at 0x71A21C with no rewrite before the
  site → **the portal FLAT-record delay default is 0**.
- The other 8 register seeds are documented as variable (dataflow not pinned
  this round — honest boundary).

## 5. Portal family (T090-G39-PORTAL-DURATIONS.csv)

Original WZ structure (verified):

- `MapHelper.img/portal/game/pv` — **8 frames, delay ABSENT on all** (origin only).
- `portal/game/ph/default/{portalStart, portalContinue, portalExit}` —
  **4 / 7 / 3 frames, delay ABSENT on all** (matches the FSDB counts and the
  GMS083-documented 8 / 4+7+3 split).
- `portal/game/psh` — `default` mirrors ph (4/7/3); frame `1` carries the only
  explicit timing: `portalStart/0 {a0=0, a1=200, delay=1500}` and
  `portalExit/0 {a0=255, a1=0, delay=1500}` (alpha fade-ins/outs); frames
  `2`/`3` have no delays.

Duration scenarios (timeline model, scale=1000): default-120 column reproduces
the T089 figures **pv 960 / Start 480 / Continue 840 / Exit 360 ms**; with the
flat-record default 0 the same frames collapse to 0 — **the two defaults are
DIFFERENT dataflows**: rec+0x2C (flat, default 0) vs the per-frame consumer
read (site unlocated for the portal family — the portal loaders register via
0x43E3A6→slot25 and do NOT call the 0x43EC69 frame converter or 0x427DE0; the
portal band 0x71A000–0x71C000 contains no 0x43EC69/0x427DE0/0x155D-per-frame
read other than the flat 0x71A72A). Resolving which default governs the
per-frame portal timing requires the runtime draw path — **documented residual**.

## 6. Numeric model (t090_wp1d_timeline_model.py)

Implements the proven semantics in 32-bit arithmetic: explicit/missing delay,
consumer defaults (0/60/120/150/180/1000/variable), scale (default 1000 and
non-multiples), repeat triage (≥0 loop-suffix / −1 mode 0 / −2 one-shot), mode
gates 0x20/0x10, unsigned per-frame div vs signed total idiv, and 32-bit
wrap-around. Covered by `test_t090_round.py`.

## 7. G39 status decision

The four T089 residuals: three CLOSED by original evidence (explicit WZ delays;
animationScale default 1000; complete default matrix), one MATERIALLY ADVANCED
(portal durations — original frames proven delay-less, flat default proven 0,
per-frame consumer default still unlocated). Because the per-frame portal
default is not yet byte-pinned and 8 register-seeded defaults stay variable,
**G39 remains PARTIAL-STATIC** (narrowed; no closure-by-approximation).
