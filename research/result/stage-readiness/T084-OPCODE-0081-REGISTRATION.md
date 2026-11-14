# T084 — Opcode 0x0081 (WARP_TO_MAP) Registration & Dispatch (Static Forensics)

Round: t084 (2026-11-15). Binary identity as above. Evidence: `forensics/T084-EV70-OPCODE-0081.txt`.

Related: G38 (D'), P4-04, C-055, C-062, C-064, C-066.

---

## 1. Verdict

**PARTIALLY CONFIRMED.** The handler-side chain is now closed end-to-end at instruction level (handler body, its sole caller, its position inside the handler-vtable family, and its internal ordering relative to map load and the arrival write). The **byte-level registration of opcode 0x0081 to this handler** remains statically invisible (dynamic registration), and this round adds a *hard negative*: a **different, disjoint 0x81 dispatch exists** (channel context), proving the opcode number is context-bound — a plain "0x81 ⇒ WARP" byte binding cannot exist in this image.

## 2. The handler chain (CONFIRMED)

```
0x533EA4  handler-base vtable slot0 (33-vtable family 0xB01308..0xB02730; primary 0xB01414)
   ...
0x533FF1    call 0x97EBC9                    ; the ONLY direct E8 caller (census: 1 site)
0x97EBC9  (this=handler esi, arg1=packet, arg2=map-ref)
   0x429BE1/0x429825/0xA1195C              ; stream/map resolution helpers
   0x97EBFE  eax = alloc(0x3048, pool 0xBE1DE0)   ; new field object
   0x97EC1F  0x94FDB4(newField, [arg2])           ; FULL NEW-MAP LOAD
              (-> field #1 [0xBDD498]; physics, footholds, ropes, portals, VR fold)
   0x97EC2F  0x980A8C(handler+4, newField, 0)     ; ATTACH / activate
   0x97EC37  mov ecx,[esi+8]
             call 0x9507F0                         ; ARRIVAL WRITE (C-055/EV-36:
                                                    ;  PortalRecord x/y, Y-10, 0x9BC622(…,arg7=0),
                                                    ;  map-bounds clamp from the NEW field, velocity zero)
   ret 8
```

Ordering consequence (static instruction order): **new-map collision/bounds/VR data exist BEFORE the arrival position write**; the clamp values `[M+0x138..0x144]` (copied by 0x9BC602 from `[0xBDD498]+0x24`) are the NEW map's. No camera refresh and no user tick/draw run inside the handler (they run on the frame-loop slots 12/14; see T084-CAMERA-CALLGRAPH.md §5).

## 3. The registration question (OPEN-STATIC, sharpened)

- No `imm 0x81` reference binds to 0x533EA4/0x97EBC9 or to the handler vtables (census: the only `sub eax,0x81` site is 0x77E6F3, see §4; `cmp eax,0x81` sites 0x5414A1/0x75A0AB are unrelated comparisons).
- The handler family's construction path (who allocates the 33 objects and installs the vtables) was not traced this round; previous rounds (C-066) already showed these vtables carry no immediate registration references.
- **New hard negative (opcode collision):** `0x77E6F3` dispatches `0x81/0x82/0x83` in the **channel/login context** (`sub eax,0x81; je 0x77E720 -> 0x77E72F…`; siblings `0x77FC9E`, `0x77F209`; the enclosing class's vtable slot17 = 0x77E6D4 per the 0xB01414 dump). Therefore opcode numbers are **context-dependent** (per-connection-state handler objects), and the game-server 0x81→map-transition binding is established by runtime registration data, not by a static byte comparison on this path.

## 4. Distinctions enforced (per task §P5)

| layer | status |
|---|---|
| Protocol semantics (0x81 = WARP_TO_MAP) | corpus A-grade (C-046/EV-32), unchanged |
| Message dispatch (byte→handler routing) | NOT statically provable; context-dependent registration (this round's collision proof) |
| Handler invocation (0x533EA4→0x97EBC9) | CONFIRMED (single E8 site) |
| Map-state transition (load→attach→arrival write) | CONFIRMED (instruction order) |

## 5. Ledger deltas

- NEW C-083 (0x97EBC9 body/order + sole caller + 0x81 collision at 0x77E6F3) — EV-70, grade A for the chain; the byte-binding part stays inside C-066's open clause.
- G38 unresolved_scope updated: "0x81→0x97EBC9 vtable→opcode registration mechanism" now annotated with the collision finding (registration is context-dependent; static byte binding does not exist).
- P4-04 optional-next-work updated accordingly.

---

## 6. t084.1 WORDING TIGHTENING (2026-11-15, round `research/t084-1-slot25-scope-reconciliation`)

> Appended, not retro-edited; see `T084-1-SLOT25-SCOPE-RECONCILIATION.md` §C-083.

Two §1/§3 phrasings overstated what the collision proves, and the C-083 row has been tightened accordingly:

1. **"opcode numbers are context-dependent (per-handler-object registration)"** — the parenthetical mechanism claim is WITHDRAWN. The `0x77E6F3` collision demonstrates only that the *number* `0x81` is reused across disjoint dispatch contexts (channel 0x81/0x82/0x83 vs the game-server handler family); it says nothing about by which mechanism (dynamic registration, load-time table, or an unexamined static structure) the map-transition context binds its handlers.
2. **"the game-server 0x81→map-transition binding is established by runtime registration data"** — downgraded to: no byte-level binding was found **in the examined static patterns** (sub/cmp imm `0x81` census: only `0x77E6F3`; cmp sites `0x5414A1`/`0x75A0AB` unrelated; the 33 handler-family dword dumps carry no registration references); the actual binding/registration mechanism remains **UNVERIFIED** — not proven dynamic. C-066's open clause stands unchanged.

The confirmed part of §2 (handler chain: alloc → full new-map load `0x94FDB4` → attach `0x980A8C` → arrival write `0x9507F0`, sole caller `0x533FF1` in handler slot0) is unaffected by this tightening.
