# T084 — Foothold Loader Write Path (Static Forensics)

Round: t084 (2026-11-15). Binary identity as above. Evidence: `forensics/T084-EV67-FOOTHOLD-WRITER.txt`, `forensics/T084-EV66-ROPE-LOADER.txt`, `forensics/T084-EV68-FIELD-OBJECT.txt`.

Related: G40, P3-03, C-067, C-068, C-070.

---

## 1. Verdict

**CONFIRMED — the foothold loader write-side is now directly instruction-proven** (this was G40's `fh loader write-side (WZ->object field mapping direct proof)` item). C-068's layout graduates from read-side cross-verification to **write-side direct proof**, with ONE label correction (`+0x1C/+0x20`, see §4; correction claim C-080).

## 2. The load pipeline (single function 0xA4D303 = field #1 create + WZ collision load)

```
enumeration: [0xAFE264] enumerator; per child node:
  [ebp-0x3C] = 0xA70518(outer node name)   ; LAYER   (int)
  [ebp-0x48] = 0xA70518(mid node name)     ; PLATFORM(int)
  [ebp-0x78] = 0xA70518(inner node name)   ; FOOTHOLD ID (0 if name non-numeric -> skip 0xA4E432)
  props: 0x82E -> [ebp-0x84]  = x1
         0x830 -> [ebp-0x54]  = y1
         0x82F -> [ebp-0x50]  = x2
         0x831 -> [ebp-0x74]  = y2
         0xADC,0xADD,0x1161   -> piece sub-object fields (0x58-pool alloc, 0xA4F36C init;
                                  two values encrypted-double-scaled via 0x6A05FF*[0xAFEF10] at piece+0x18/+0x24,
                                  one int via 0x630025 at piece+0x30)
         0x6C1 -> [ebp-0x10]  = link A (0x6C1/0x6C2 = the prev/next pair; per-member order DERIVED)
         0x6C2 -> edi         = link B

0xA4E974  fh = alloc(0x58, pool 0xBE1DE0)
0xA4E9AC  0xA4F4B6(fh, id, x1, y1, x2, y2, layer, platform, link0x6C1, link0x6C2, piece)
0xA4E9C0  0xA500CE(field+0x7C, &[ebp-0x64])      ; read key via the +0x7C subobject
0xA4E9E4  0xA513F6(field+0x90 hashmap, &key, &[ebp-0x78])   ; INSERT by id
0xA4E9FF  0xA4FFCD(field+0x44 collection, ...)    ; INSERT into spatial collection
0xA4EA04.. [field+0x34]-based max-id bookkeeping
```

## 3. The record writer 0xA4F4B6 (ret 0x28 — 10 stack args)

```
memset(fh, 0, 0xC); [fh] = 0xAFE3F0 (pre-init vtable)
arg1  -> [fh+0x48]   id        (dword; from node-name int)
arg2  -> [fh+0x0C]   x1        (prop 0x82E)
arg3  -> [fh+0x10]   y1        (prop 0x830)
arg4  -> [fh+0x14]   x2        (prop 0x82F)
arg5  -> [fh+0x18]   y2        (prop 0x831)
arg6  -> [fh+0x1C]   layer     (node-name int)
arg7  -> [fh+0x20]   platform  (node-name int)
arg8  -> [fh+0x4C]   link      (prop 0x6C1 member)
arg9  -> [fh+0x50]   link      (prop 0x6C2 member)
arg10 -> [fh+0x28]   piece     (refcounted: [0xAFE1BC](arg10+4) AddRef)

(Arg numbering = physical stack order arg1=[ebp+8]…arg10=[ebp+0x2C], confirmed by the independent reviewer (D2): prop 0x6C1 lands at +0x4C and 0x6C2 at +0x50; the piece is arg10. WHICH of {0x6C1, 0x6C2} is "prev" vs "next" remains DERIVED.)
[fh] = 0xB0DDA4 (final vtable)
call 0xA4F54A(fh):  dx = [fh+0x14]-[fh+0x0C]            ; x2-x1
                    dy = [fh+0x18]-[fh+0x10]            ; y2-y1
                    [fh+0x40] = sqrt(dx*dx+dy*dy)       ; 0xA71204
                    [fh+0x30] = dx/len                  ; unit dir 1 (double)
                    [fh+0x38] = dy/len                  ; unit dir 2 (double)
```

Read-side agreement (independent cross-check):

- `+0xC/+0x10` = anchor (n1/n2) used by 0x9BC89F's `t = (src - F.n)/F.m` — anchor is (x1,y1) ✓ (C-063).
- `+0x30/+0x38` = direction doubles — **C-068's "unit-direction candidate (DERIVED)" label is now PROVEN** (writer computes exactly dx/len, dy/len).
- `+0x40` = len — **"DERIVED label; loader write-side not directly read" resolved**: len IS computed at load by 0xA4F54A (not a raw WZ field).
- `+0x48` word id — proven as the full dword node-name int (C-068 said word; the id is stored/used as dword in 0x6B87D1's `mov edi,[eax+0x48]`; the record word truncation happens later at record+0xC).
- `+0x4C/+0x50` prev/next links — written from WZ properties {0x6C1, 0x6C2}; WHICH of the two ids is "prev" vs "next" remains DERIVED (string ids 1729/1730 not present in the partial string table; direction decidable later by FSDB connectivity vs 0x9BF1FA's transfer semantics).

## 4. Label correction to C-068 (chain: C-080)

C-068 labeled `+0x1C/+0x20` as "x2/y2 (hint source)". The writer proves `+0x1C/+0x20 = (layer, platform)` (node-name ints), while x2/y2 live at `+0x14/+0x18`. Consequently `[M+0x130]/[M+0x134]` = current standing (layer, platform) — see T084-LADDER-ROPE-FORK-ANALYSIS.md §6. Numeric facts of C-068 are unchanged; the label correction follows the C-072 precedent.

## 5. Failure / empty paths

- Non-numeric or missing node name → `0xA70518` yields 0 → the 0xA4E432 guard aborts that node's registration (id 0 never inserted).
- Property read failure → `0x4029B7` HRESULT check + `0xA6EF01` error report (the standard assert-report family), loop continues.
- Alloc failure → `0x402D66` returns 0 → the 0xA4E989 `je` skips the insert (fh row dropped).
- Empty WZ section → count 0 → 0xA51577 rope table stays NULL; `0x9BCC9A`/`0xA4FC6F` null-guard returns 0 (matches their `test edx,edx; je` paths).

## 6. Four-stage data separation (per P4 requirement)

1. **Raw FSDB/WZ**: layer/platform/id/x1/y1/x2/y2/prev/next (+ rope x/y1/y2/l/uf/page/id).
2. **Loader intermediates**: stack locals per node (props read via 0x7A48D0/0x406368/0x415344; names via 0xA70518).
3. **Runtime objects**: the 0x58-byte fh record (vtable 0xB0DDA4; +0x30/+0x38/+0x40 derived) and the 0x1C-stride rope record.
4. **Query-side data**: field+0x90 hashmap (by id), field+0x44 spatial collection (swept box 0x5114AA), field+0xA8 rope table (index).

## 7. Ledger deltas

- NEW C-080 (fh loader write-side full mapping + C-068 label correction + derived-field proof) — EV-67, grade A (link-name order DERIVED).
- G40: `fh loader write-side (WZ->object field mapping direct proof)` item CLOSED; remaining G40 items unchanged (slot3 variants 0x9C5B8A/0x9CCAA8 body diffs now PARTIALLY covered by EV-68's wrapper window but full diff still open; shoe +0x198/DEC slots unchanged).
- P3-03 minimum_next_work updated (write-side done; slot3-variant diff remains).
