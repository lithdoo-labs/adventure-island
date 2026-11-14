# T084 — Stack-Package Remaining Static Questions (G07/G01/G33)

Round: t084 (2026-11-15). Binary identity as above. Evidence: `forensics/T084-EV71-STACK-PACKAGE.txt`.

Related: G01, G07, G33, P1-10, C-017, C-019, C-074, C-075.

---

## 1. Verdict

**STATIC-EXHAUSTED for the four named callees — NEGATIVE result.** The four stack-package callees left unread in G07 ("0x43286E/0x44484B/0x429411/0x43E3A6 not fully read") are now fully read. **None contains comparison, ordering, or insertion logic.** The comparator hypothesis for this family is closed negatively at the EXE level; the ordering container's final receiver remains the runtime slot25 body (G24/G27 dependency).

## 2. The four bodies

| function | full body summary | classification |
|---|---|---|
| **0x43286E** (0x43286E–0x432888, ret 4) | `this->[0]=0; if (arg1==0) assert E_POINTER; return this` | null-assert constructor — no data flow beyond the guard |
| **0x44484B** (0x44484B–0x444863, ret 4) | `this->[0] = *[arg1]; if (ptr) ptr->vt[1](ptr)` (AddRef) | attach-with-AddRef smart-pointer helper |
| **0x429411** (0x429411–0x429429, ret 4) | byte-for-byte same pattern as 0x44484B (`mov esi,ecx; mov eax,[arg]; mov [esi],eax; je; mov ecx,[eax]; push eax; call [ecx+4]; ret 4`) | identical attach-with-AddRef twin (code duplication, not a second behavior) |
| **0x43E3A6** (0x43E3A6–0x43E46B+) | SEH frame; builds two VARIANTs (0x40318F VT_ERROR-missing init from 0xBE7330; 0x4031B5); asserts `[0xBE2788]`; pushes 9 args; **calls 0x427EB3** (the universal property PUT, C-007); VARIANT cleanup (0x4029B7/0x414A1D); optional 0x411FE1 VT_UNKNOWN pack | property-PUT wrapper (a sibling 0x427EB3 caller) — terminates in vtable slot25, i.e. the same runtime-bound endpoint as the tile path |

## 3. Parameter/stack-layout facts recorded (per task P6)

- Convention: all four are cdecl (`ret 4` / plain ret with esp cleanup by caller); 0x43E3A6 is frame-based with FS:[0] SEH and `[ebp-4]` state counters (0x1..0x9 unwind states) — consistent with the EV-19 channel description.
- Side effects: only the AddRef/Release pair (0x44484B/0x429411) and the slot25 PUT (0x43E3A6); no return value beyond the this/success echo.
- 0x429411's usage at 0x6662C8/0x6662D7 (map-load) is the temporary-stack attach of the WZ node holder — confirming C-074's stack-slot-reuse model (esp-temp slots written at `mov [ebp-0x20],esp` sites).

## 4. Consequences for the equal-key question (G33/G01)

- With the EXE-side package callees excluded, the "comparator possibly inside stack-package callees" hypothesis (C-019) has **no remaining static territory in the EXE**: the final ordering behavior is decided by the runtime slot25 receiver (put-with-object-out / keyed registration per C-075) or by later traversal.
- G33 (equal-key stability) remains OPEN-STATIC with the fallback (runtime draw capture) unchanged; C-075's insert-with-key reading is further supported (0x43E3A6 shows yet another keyed PUT into the same endpoint).

## 5. Ledger deltas

- NEW C-085 (four stack-package callees fully read; no comparator/order logic; negative result) — EV-71, grade A.
- G07: verified_scope extended (the four named bodies read; classification above); status stays OPEN-STATIC only insofar as "DLL comparator body" is concerned — the G07 question text is EXE-package-scoped and is now answered negatively, so G07 moves to **SUPERSEDED-by-evidence**? — no: per ledger discipline the status becomes CLOSED-STATIC **for the EXE stack-package callee question**, while the original "DLL comparator body" phrasing refers to the same unreachable endpoint as G24/G27. Recorded as PARTIAL-STATIC with the narrowed remainder (see gaps.csv).
