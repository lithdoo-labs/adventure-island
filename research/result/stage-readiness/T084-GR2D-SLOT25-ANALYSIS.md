# T084 — Gr2D slot25 Object Identity (Static Forensics)

Round: t084 (2026-11-15). Evidence: `forensics/T084-EV72-GR2D-CLUSTER-SLOT25.txt` (Gr2D_DX8.dll, PE model, ImageBase 0x50400000; file `.work/task-001/extracted/冒险岛online/Gr2D_DX8.dll`, hash in file header).

Related: G24, G27, P1-09, C-007, C-022, C-053, C-074, C-075, C-077.

---

## 1. Verdict

**PARTIALLY CONFIRMED — the static slot25 candidate set is now fully enumerated and BOTH known candidates fail the production-path consistency test.** The object identity question (G24/G27) remains RUNTIME-BOUND; this round adds the missing second candidate and tightens the constraint.

## 2. The two static Gr2D slot25 (+0x64) bodies

| vtable | slot25 | body | semantics |
|---|---|---|---|
| 0x5042D140 (40-slot layer table, C-005/C-022) | 0x50403FBE | `mov eax,[esp+4]; mov ecx,[esp+8]; mov [eax+0xCC],ecx; xor eax,eax; ret 8` | trivial property setter — **never writes any out slot** (C-053/EV-42, unchanged) |
| **0x5042D204-cluster OUTER** (C-077 group; ctor 0x504013E3) | **0x50404E85** | `mov eax,[esp+8]; test; je E_POINTER; mov edx,[esp+4]; xor ecx,ecx; cmp [edx+0x78],ecx; setne cl; mov [eax],ecx; xor eax,eax; ret 8` | **out-writing boolean getter**: `*arg2 = ([this+0x78] != 0) ? 1 : 0` |

Cluster companions (same dump): inner 0x5042D224 slot25 = 0x5040418C (large body, VARIANT marshalling over `[this+0x90]`/`[this+0x128]`); mid 0x5042D210 slot25 = 0x50403FBE-type pair member 0x50403FBE/0x50403FD1 family; 0x50404EA7 = boolean-state setter companion of 0x50404E85 (compares desired vs `[this+0x78]`, calls 0x50403D25 on change).

## 3. The constraint test (why runtime binding is still required)

0x427EB3 (C-007) marshals two VARIANTs and calls `[[0xBE2788]+0x64](...)`, then **writes the post-slot25 dword to *arg1** (EV-34). The EXE tile path then treats that out value as an object pointer: `0x666FAC: mov eax,[ebp-0x10]; cmp eax,ebx; call [[eax]+8]` (Release) — reachable after C-074's 0x404BA3 re-init.

- Candidate 1 (trivial setter) never writes the out ⇒ out retains stale/indeterminate content ⇒ **rejected** (C-053, unchanged).
- Candidate 2 (boolean getter) writes a **0/1** ⇒ the 0x666FAC `call [[1]+8]` would fault ⇒ **also rejected for the same production path** (new).

Conclusion: the runtime `[0xBE2788]` object's slot25 must be a put-with-object-out not present in either statically-known Gr2D vtable (or the [0xBE2788] binding is to a runtime-constructed table). G24/G27 stay OPEN-RUNTIME; the T082 §4 minimal capture spec (bp 0x666F77 single dword) remains the closing action and is now BETTER motivated: it discriminates among three named possibilities instead of two.

## 4. Registration/lifecycle notes (bounded)

- The [0xBE2788] global is created once by initializer 0xA00E5E via factory 0xA0449B from IID E576EA33 (C-004) — no per-scene re-registration sites exist (census of `[0xBE2788]` writes: initializer only; all other refs are reads with E_POINTER smart-guards, e.g. 0x43E3DC inside the 0x43E3A6 PUT wrapper).
- Scene switching does not rebind [0xBE2788]; slot45 calls (`[eax+0xB4]`) always go through the same global (C-075 unchanged).

## 5. Ledger deltas

- NEW C-082 (second slot25 candidate + dual rejection constraint) — EV-72, grade A (bounded negative).
- G24/G27: verified_scope extended (candidate set enumerated; boolean-out rejection); status unchanged (OPEN-RUNTIME / PARTIAL-STATIC).

---

## 6. t084.1 CORRECTION (2026-11-15, round `research/t084-1-slot25-scope-reconciliation`)

> The §1/§3 conclusions above are **corrected in part by C-086/C-087 (t084.1)**. This section is appended, not retro-edited; see `T084-1-SLOT25-SCOPE-RECONCILIATION.md` for the full round report.

1. **The "candidate set fully enumerated / BOTH fail" verdict is WITHDRAWN.** The third candidate named in §2 — inner `0x5042D224` slot25 = `0x5040418C` — was never analyzed in t084 and is in fact the ONLY candidate satisfying the production path: the production call site `0x427EB3` pushes exactly 15 dwords (this + five dwords + two by-value VARIANTs + `VARIANT*` out), and `0x5040418C` is a `ret 0x3C` (15-dword) method whose E_POINTER-guarded arg15 out slot is written at `0x504045CB` with a wrapped **object pointer** — exactly the put-with-object-out that §3 declared "absent from both static tables". The static tables contained it all along.
2. **The §4 gloss "slot45 calls (`[eax+0xB4]`) always go through the same global" is WRONG per C-075/EV-59 re-reading.** The slot45 call at `0x666F7D` is invoked on `esi` = the value returned by `0x42944A(&[ebp-0x10])` — a null-assert getter returning the **slot25 RESULT object**, not the `[0xBE2788]` global. The global-bound claim conflated the two receivers. (C-075's own claim text never said the receiver was the global; this report's gloss did.)
3. **§2's "VARIANT marshalling over `[this+0x90]`/`[this+0x128]`" is half wrong.** `0x5040418C` touches only `[this+0x90]` (E_FAIL device guard; the field is produced by inner slot3 `0x504030D3` device init, i.e. the initializer's `[[0xBE2788]+0xC](0x320,0x258)` call). `[this+0x128]` belongs to the sibling slots 26/27/28 (`0x50404ECA`/`0x50404EE9`/`0x50404F05`, a node-collection family), not to slot25.
4. **EV-72 data status (t084.1, reviewer-confirmed — supersedes this section's earlier draft note):** every dword printed in EV-72 is **byte-accurate** against the raw image; there is no off-by-one value error. The real defect was interpretive: the three "tables" are overlapping windows over one contiguous dword block, producing **phantom slot25s** — `0x5042D204` is a 3-entry IUnknown table (so "outer slot25" never existed; `[0x5042D268]` is inner slot17), `0x5042D210`/`0x5042D140` are 5-entry thunk tables (so "mid slot25" and the t081 "layer-table 0x5042D140 slot25" never existed; `[0x5042D274]` is inner slot20 and `[0x5042D1A4]` is T154 slot20). A **second long table `0x5042D154`** (class-2, ctor fragment `0x50401295`, QI `0x504013CA` walking the **shared** intmap `0x5042D1E0`) has its own slot25 `@0x5042D1B8` = **the same `0x5040418C`**, making the C-086 production match class-invariant. Authoritative re-dumps: EV-75.
5. **[0xBE2788] identity (C-087):** factory `[0xBE1FB0]` = PCOM.dll!`PcCreateObject`; IID E576EA33 bytes are single-occurrence and identical in EXE `0xBA0570` and Gr2D `0x50435120`; Gr2D QI(E576EA33) returns a **long-table interface pointer** — class-1 inner (vtable `0x5042D224`) or class-2 primary (vtable `0x5042D154`), both sharing slot25 = `0x5040418C`, slot3 = `0x504030D3`, slot20 = `0x50403FBE`; the initializer's slot3(800,600)/slot20(0xFF000000) calls are only compatible with a long-table vtable. Runtime confirmation via the PCOM-registry capture remains open (G24 now verifies this named prediction).

Updated ledger pointers: C-082 (corrected, exhaustion withdrawn), C-086 (production slot25 resolution, CLOSED-STATIC), C-087 (identity chain, PARTIAL-STATIC), G24 redefined, G27 CLOSED-STATIC, G38 wording tightened (C-083).
