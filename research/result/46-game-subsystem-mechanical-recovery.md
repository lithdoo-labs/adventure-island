# Task 046 — Game Subsystem Mechanical Recovery Master Campaign (Final Report)

RUN DATE 2026-10-16 · STARTING_HEAD `4b2eb8a02b36041d8a7884a248fc42b772b8c4ef`
· canonical client SHA-256 `5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d`
(unchanged, never patched)

## 0. Highest milestone: M5 + M7 (seven dossiers + 27 flows)

M0 ✓, M1 ✓, M2 ✓, M3 partial (207/486 senders), M4 partial (65 class
candidates, mostly low-confidence), **M5 ✓ (all seven + two shared)**,
M6 partial (~35 high-confidence names, 504 classified, 94 handler
semantics), **M7 ✓ (27 pseudocode flows)**, M8 partial.

## 1. Baseline → Final

| Metric | Baseline | Final | Target | Met |
| --- | --- | --- | --- | --- |
| Function candidates | 0 | 51,200 | — | ✓ (index) |
| Subsystem-classified | 332 | 504 | ≥350 | ✓ |
| Semantically named (high+) | ~24 | ~35 | ≥120 | ✗ |
| Class/object candidates | 0 | 65 | ≥40 | ✓ (count) / ✗ (confidence) |
| Handlers with semantics | 0 | 94/107 | ≥70 | ✓ |
| Senders named | 178 | 207/486 | ≥350 | ✗ |
| Packet builder functions | 0 | 376 | — | ✓ |
| Pseudocode flows | 0 | 27 | ≥25 | ✓ |
| Reference correlations | 0 | 12 | — | ✓ |

## 2. Subsystem reports

### UI
- **Classes**: KeymapTable (confirmed); 28 vtable candidates (low)
- **Functions**: KEYMAP handler family (4 confirmed); FACE_EXPRESSION/USE_ITEMEFFECT senders
- **Flows**: keymap update, expression, char-change refresh (3)
- **Gap**: individual window classes unnamed (vtable candidates need ctor correlation)

### Character/User
- **Classes**: CWvsContext (confirmed, 24-method vtable); CUser (implied)
- **Fields**: CharacterId +0x205C; grade +0x2080; spawn-identity +0x2084; char-changed +0x2F60
- **Flows**: warp identity update, spawn is-it-me, AP distribution, char info (4)
- **Gap**: full CUser layout; HP/MP/EXP update handler internals

### Field/Map
- **Classes**: CField (implied via dispatcher); portal state
- **Functions**: WARP_TO_MAP handler (confirmed); CHANGE_MAP/CHANNEL senders
- **Flows**: map transition (confirmed both directions); inner portal; channel change (3)
- **Gap**: CField object layout; portal collision detection; map object lifecycle

### Mob/Combat
- **Classes**: CMob (implied); DamageResult
- **Functions**: 6 attack/damage senders (all c2s live-named)
- **Flows**: close-range attack, take damage, ranged/magic attack, Aran combo (4)
- **Gap**: mob object layout; s2c damage handler; critical display

### Skill/Buff
- **Classes**: SkillTable (implied); BuffState; SkillMacro
- **Functions**: 7 skill-related senders (all c2s live-named)
- **Flows**: SP distribution, skill activation, buff lifecycle, debuff cancel (4)
- **Gap**: skill WZ loading; cooldown timer; buff stacking

### Quest/NPC
- **Classes**: NPCDialog state; QuestState; NPCShop
- **Functions**: 6 NPC/quest senders (all c2s live-named)
- **Flows**: NPC dialog state machine, quest update, NPC shop (3)
- **Gap**: quest condition checking; dialog UI; storage flows

### Cash Shop
- **Classes**: CashShop context (implied)
- **Functions**: 5 cash-shop senders (c2s live-named)
- **Flows**: enter cash shop (end-to-end confirmed); purchase (2)
- **Gap**: cash-shop UI overlay; full port-8600 phase; return flow

### Inventory (shared)
- **Classes**: InventoryContainer; ItemSlot
- **Functions**: 17 inventory senders (all c2s live-named)
- **Flows**: item move, use item, meso drop, scroll upgrade (4)
- **Gap**: slot count management; equipment stat display

### Social (shared)
- **Classes**: Party state; Guild; BuddyList
- **Functions**: 16+ social senders (all c2s live-named)
- **Flows**: general chat, party create/invite, whisper (3)
- **Gap**: party/guild UI; messenger; family tree

## 3. Top 20 newly recovered high-confidence functions/classes

1. `CWvsContext` singleton @ [0xBD9028] → static 0x7E2E90 (vtable 0x70D3C8, 24 methods)
2. `WARP_TO_MAP_handler` @ 0x37E72F (CharacterId write confirmed)
3. `SPAWN_PLAYER_handler` @ 0x57F6C0 (is-it-me identity check)
4. `KeymapTable_walker_89x5` @ 0x1B9F47 (89×5B iteration confirmed)
5. `KEYMAP_handler` @ 0x1B9E4F (89-key format)
6. `WriteHeader` @ 0x661F (967 call sites; the packet-builder universal entry)
7. `COutPacket_ctor` @ 0x2F5E40 (the builder allocation)
8. `encrypt_full` @ 0x6591EA (two-stage: header + body)
9. `decrypt_full` @ 0x65922E (mirror)
10. `IV_roll_call_site` @ 0x95F0D (4-byte header IV rotation)
11. `Phase_OnPacket` @ 0x95F83 (three-way routing: inline + range + delegate)
12. `Range_OnPacket` @ 0x610CE0 (97-slot jump table @ 0x7111A1)
13. `CLogin_state_machine` @ ~0x45EB00 ([+0x64] state / [+0x68] substate)
14. `CSecurity_threat_detected_throw` (RTTI-confirmed class)
15. `CSecurity_key_crypt_init_failed_throw` (RTTI-confirmed class)
16. `CSecurity_family` (10 RTTI classes in-image, throw-site + ctor clusters mapped)
17. `CClientSocket::Connect` @ 0x947EA (non-blocking + 5000ms deadline)
18. `CClientSocket::Send_Flush` @ 0x95D5C (queue + cipher roll)
19. `CClientSocket::ProcessRecv_pump` @ 0x9583A (1460-chunk recv loop)
20. `funny_shit` @ 0x6590BD (byte transform + rol32(block,3))

## 4. Top 20 unresolved high-value hotspots

1. The body-crypt call site (the chunked AES transform for packet bodies)
2. The AES key derivation path (the key never appears in standard form)
3. CUser object layout (only accessible via CWvsContext fields)
4. CField object layout (the game's map container)
5. CMob object layout (mob lifecycle: spawn/update/remove)
6. Individual UI window classes (28 unnamed vtable candidates)
7. The full s2c opcode enumeration (only 18 of ~200+ named)
8. ~279 unnamed sender sites (opcodes through registers/parameters)
9. The login-band dispatcher (confirmed separate from field, not yet located)
10. Map-data WZ loading bridge (how the client loads map resources)
11. Portal collision detection (client-side movement physics)
12. Buff stacking/override logic
13. Skill cooldown timer implementation
14. Quest condition checking (client-side progress tracking)
15. NPC dialog UI rendering
16. Cash shop overlay UI
17. The delegate object [0xBDF54C] and its phase-injection mechanism
18. Equipment stat calculation display
19. Party/guild member update handlers (s2c side)
20. The cipher objects' exact construction (compact-AES key setup)

## 5. Has the static corpus reached its natural boundary?

**Partially yes.** The 036 capture is from the protector-era spin —
the code is fully materialized and readable, but the game state was
never populated (041's finding). This means:
- **Static code analysis**: still productive (the code is all there)
- **Live object state**: impossible from this corpus (all zeros)
- **The 97-handler semantic summaries**: limited by the s2c opcode
  names (only 18 of ~200+ observed) — the server JAR can fill this
- **Sender provenance**: the remaining 279 need inter-procedural
  dataflow, not more pattern matching

**The dominant next step** is (a) the server JAR's outgoing-packet
name enumeration (fills the s2c names → completes the handler map)
and (b) a richer later-phase capture (fills object state). The static
code itself has not hit a wall — it's the SEMANTIC evidence (names,
state, references) that needs supplementation.

## 6. FINAL_COMMIT / push

See git log. All artifacts committed and pushed.
