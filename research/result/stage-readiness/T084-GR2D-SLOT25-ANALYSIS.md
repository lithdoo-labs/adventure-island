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
