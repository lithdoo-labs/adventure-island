# R13/G07/G27 — tile dispatch stack & 0x427EB3 out-semantics — targeted static forensics V2

**Round**: t080 (2026-11-13). **Lead agent derivation** (pending independent review).
**Source**: EXE unpacked image SHA-256 `d4a67597…31718` + Gr2D_DX8.dll SHA-256 `ad67b9a0…a25d1` (both verified).

## 1. 0x427EB3 complete semantics (this session, raw bytes 0x427EB3–0x427F0D)

Frame: `esi = arg8`; push `&[ebp+0x24]` (OUT-for-callee); copy arg8 variant (16B) to stack; copy arg7 variant (16B); push arg2..arg6; push this; `call [vtable+0x64]` (slot25) with stack `(this, a2,a3,a4,a5,a6, V(arg7), V(arg8), VARIANT* out=&arg8slot)`; then:

```
0x427F01  eax = [ebp+8]          ; arg1
0x427F04  ecx = [ebp+0x24]       ; arg8 slot AFTER the callee ran
0x427F09  mov [eax], ecx         ; *arg1 = post-call arg8-slot dword
0x427F0D  ret 0x20
```

**NEW FACT (resolves the direction of G27's contradiction)**: arg1 is an OUT pointer. The out value = whatever slot25 left at offset 0 of the out slot (or the original arg8 value if slot25 never writes it). C-007/EV-03 documented the slot25 call and marshaling but NOT the `*arg1` write-back — this round adds it.

## 2. Gr2D static slot25 — re-verified from DLL bytes

- vtable `0x5042D140` = exactly **40 slots** (0x00–0x9C); the ATL intmap adjoins at +0xA0 (`{iid=0x50435120, 0, 1}, {0x50435110, 0, 1}, {0,0,0}`) — C-005 structure re-confirmed.
- slot25 (+0x64) = `0x50403FBE` = `mov eax,[esp+4]; mov ecx,[esp+8]; mov [eax+0xCC],ecx; xor eax,eax; ret 8` — EV-11 byte-exact match re-confirmed.
- Under this body the out is NEVER written ⇒ *out = arg8 (caller's variant pointer) ⇒ downstream `mov eax,[obj]` reads the VT tag (0x0A for the missing-variant) and faults at `call [vt-tag+0xB4/0x104/0xC8]`.

## 3. The tile path push reconstruction (0x666E8C–0x666ED5) — EV-16 refined

```
0x666E8C  V{VT_ERROR, DISP_E_PARAMNOTFOUND} at [ebp-0x48]        (0x40318F, data 0xBE7330)
0x666E99  0x411FE1(&[ebp-0x38], [ebp-0x14], 1)                   (EV-02: packs V{vt=0xD, layer-object}, AddRef)
0x666EBC  ecx = [0xBE2788]
          push &[ebp-0x48]   ; arg8 = missing-variant
          push &[ebp-0x38]   ; arg7 = V{VT_UNKNOWN, layer}
          push ebx ×3        ; args 4-6 = 0
          push edi           ; arg3 = int of property id 0x332 ('y') (@0x666E1E — reviewer-corrected)
          push [ebp-0x20]    ; arg2 = int of property id 0x331 ('x') (@0x666DC9 — reviewer-corrected)
          push &[ebp-0x10]   ; arg1 = OUT
0x666ED5  call 0x427EB3
...
0x666F5D  (tile key imul chain — EV-01, unchanged)
0x666F6F  0x42944A(ecx=&[ebp-0x10]) → eax = [[ebp-0x10]]   (attach: null-check + deref, ret)
0x666F79  esi = eax; eax = [esi]
0x66F7D   push edi(key); push esi; call [eax+0xB4]          (slot45 of the OUT object's class)

(arg2/arg3 are the tile's WZ x/y property ints — the earlier "name/key-property" labels were wrong; order and positions were right. Reviewer also flagged a `[ebp-0x20]` int-vs-Release anomaly at 0x666DC9/0x666FAC for next-round follow-up.)
```

- The strict-static contradiction reproduces exactly as EV-16 documented — **and is now explained rather than merely observed**: under the static Gr2D slot25 body, *out = &[ebp-0x48] and `[[ebp-0x10]] = 0x0A` faults. Since tile registration demonstrably works in production, the runtime [0xBE2788] object's slot25 must be a **put-with-object-out** writing an object pointer at out offset 0 (i.e. the runtime vtable binding differs from the static 0x2D140 table, or the factory wraps).
- Constraint sharpened for G24: the runtime dump must show `[ebp-0x10]` (tile) / `[ebp+0xC]` (tiler) = a heap object pointer whose vtable's slot +0xB4 / (+0xC8/+0x104/…) are real methods. A single dword dump at bp 0x666F77 (ESI) settles which.

## 4. 0x42944A semantics (raw bytes) — for the R13 record

`esi=ecx; cmp [esi],0 → E_POINTER; eax=[esi]; ret` — one-level deref of a smart-pointer slot; NOT an attach/AddRef (no refcount call). EV-19's "attach+AddRef" label for this family is imprecise for this member (0x429411-family next members differ); flagged for the Reviewer.

## 5. [ebp-0x10] last-write audit (tile path)

Within 0x666C0D..0x667052 the only writer of `[ebp-0x10]` is the 0x427EB3 out (0x666ED1 passes its address; nothing else stores to it before 0x666F6F); `[ebp-0x10]` is later Released via `call [[ebp-0x10]+8]` at 0x667000 — i.e. it must hold a refcounted object pointer at runtime, reinforcing §3's constraint. No local-variable reuse or SEH overwrite occurs in the window (SEH state bytes only guard scope indices).

## 6. Verdicts

| item | verdict |
|---|---|
| 0x427EB3 arg1 = OUT pointer; out = post-slot25 arg8-slot dword | DIRECT-INSTRUCTION (new) |
| tile-path 0x427EB3 arg list (name, key-property, 0,0,0, V{layer}, V{missing}) | DIRECT-INSTRUCTION (new) |
| G27's "arg-order contradiction" reframed to "runtime out-write binding" | DERIVED-FROM-INSTRUCTION |
| G24's [eax+0xB4] = slot45 of out-object class; concrete class runtime-only | UNCHANGED (OPEN-RUNTIME), now with sharper dump target |
| equal-key/comparator semantics | UNCHANGED (G01/G07/G33 open) |
