# Task 046 — Game Subsystem Mechanical Recovery Master Campaign

## 0. Mission

Task 046 is a single, long-running **static game-logic recovery campaign** over the already recovered CMS079 `MapleStory.exe` game body and the repository’s normalized analysis artifacts.

The objective is to replace ad-hoc function-by-function reverse engineering with a reusable mechanical pipeline that continuously produces:

```text
function candidates
→ call/xref neighborhoods
→ packet handler / sender relationships
→ globals / fields / vtables / classes
→ subsystem classification
→ confidence-scored semantic names
→ equivalent pseudocode and state-machine summaries
```

This is intentionally one large campaign. Do not split UI, character, field, mob, skill, quest, cash shop, inventory, social, or login into separate tasks. Continue across subsystems until the run budget is exhausted or the preferred completion milestone is reached.

Recommended autonomous run budget:

```text
16–30 hours
```

The seven required core subsystems are:

1. UI / gameplay windows;
2. character / user / context;
3. field / map / stage transitions;
4. mob / combat;
5. skills / buffs / debuffs;
6. quests / NPC interaction;
7. cash shop / transfer.

Shared supporting subsystems should be recovered in the same campaign:

- inventory / item / equipment;
- party / guild / buddy / chat / messenger;
- login / world / channel transitions;
- packet / network core only where it directly supports the subsystem work.

The campaign must focus on **main-EXE gameplay semantics**. Support-DLL inventories and protector research are not the goal.

---

# 1. Repository synchronization

Run:

```text
git status --short
git branch --show-current
git remote -v
git rev-parse HEAD
```

If tracked changes exist, stop and report the repository-state blocker.

Do not automatically stash, reset, restore, rebase, or overwrite local work.

If clean:

```text
git fetch origin
git switch main          # if needed
git pull --ff-only origin main
git rev-parse HEAD
```

Record the synchronized SHA as `STARTING_HEAD`.

Re-read this file after synchronization.

---

# 2. Canonical analysis corpus

Use the already recovered local analysis corpus and the committed normalized results from Tasks 036–045.

Revalidate the on-disk client identity when available:

```text
MapleStory.exe SHA-256
5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d
```

The recovered static analysis image and any large local indexes remain local scratch. Do not commit proprietary binaries or bulk decoded images.

If the recovered image is not locally available, do not fabricate analysis from addresses alone. Work only from committed normalized evidence that genuinely supports the requested conclusion, and record the missing-corpus blocker.

Create:

```text
result/task046-preflight.md
```

with the exact corpus and tool versions used.

---

# 3. Mandatory reading

Read the latest versions of at least:

```text
README.md

result/36-game-body-materialization-campaign.md
result/task036-materialization-record.md

result/37-game-body-function-recovery.md
result/task037-imports.csv

result/38-game-body-cipher-dispatch-security.md

result/40-game-logic-full-decode-master-campaign.md
result/task040-game-logic-map.csv
result/task040-channel-opcodes.csv
result/task040-s2c-observed.csv

result/41-object-model-deep-dive.md

result/44-live-session-full-atlas.md
result/task044-handler-map.csv

result/45-grand-static-campaign.md
```

Also read the mature resource/protocol context when useful:

```text
result/19-wizet-dlls.md
result/20-wz-inventory.md
result/23-wz-library-cross-validation.md
result/01-server-baseline.md
result/02-runtime-network-bootstrap.md
```

Read the repository’s v95/reference symbol material as a **structural naming reference only**. Never copy addresses from another version into CMS079.

---

# 4. Starting baseline to verify

Regenerate these counts from current artifacts rather than trusting this task text blindly:

- roughly 97 range-table handlers, roughly 95 already named;
- roughly 486 sender sites, roughly 178 already named/classified;
- roughly 967 `WriteHeader` sites in the packet-builder census;
- roughly 137 live-enumerated c2s opcode names;
- current trusted anchors include `CClientSocket`, `CLogin`, `CWvsContext`, `CSecurity`, packet reader/writer families, receive/dispatch functions, and several packet-semantic handlers.

Create a baseline table in:

```text
result/task046-coverage.csv
```

Do not report a percentage where the denominator is unknown. Prefer explicit counts and denominator confidence.

---

# 5. Naming confidence policy

Every semantic row must have one of:

```text
confirmed
high
medium
low
unknown
```

Use `confirmed` only when evidence is exceptionally strong.

Use `high` when at least two independent evidence families agree, for example:

- packet semantics + field behavior;
- RTTI + vtable/callgraph;
- unique string + structural reference match;
- WZ/resource path + resource-call sequence;
- packet builder + subsystem caller context.

Use `medium` for one strong clue plus contextual support.

Use `low` only for clustering/provisional roles.

If the original class/function name is not justified, prefer precise provisional names such as:

```text
FieldLike_OnWarp_37E72F
Inventory_HandleItemMove_632C39
QuestLike_UpdateState_63E59F
```

Do not use raw byte similarity alone for high-confidence naming.

---

# 6. Milestones

## M0 — Baseline reproduced

Current artifacts, counts, known anchors, and analysis corpus are verified.

## M1 — Mechanical index built

A reusable main-image index exists for:

- function candidates;
- direct calls;
- import calls;
- strings/xrefs;
- globals;
- RTTI;
- vtables;
- switch/jump tables;
- packet reader/writer calls;
- known handlers;
- known sender/builder sites.

## M2 — Subsystem classification baseline

At least 70% of already-known game-side handlers/functions are assigned to a subsystem with evidence and confidence.

## M3 — Sender recovery materially advanced

Target:

```text
>=350 / 486 sender sites classified or named
```

Symbolic opcode provenance counts as useful recovery when a numeric opcode cannot yet be proven.

## M4 — Object/class atlas expanded

Target:

```text
>=40 high-confidence main-EXE class/object/vtable anchors
```

or an equivalent evidence-backed atlas spanning all seven required subsystems.

## M5 — Seven subsystem dossiers complete

Every required subsystem has functions, objects, fields, packet links, call/state flow, pseudocode, and unresolved gaps documented.

## M6 — Large-scale function-semantics baseline

Preferred target:

```text
>=120 high-confidence semantic main-EXE function names
and
>=350 subsystem-classified main-EXE functions
```

Counts are targets, not permission to invent names.

## M7 — Cross-subsystem behavioral atlas

At least 25 representative end-to-end flows are reconstructed.

## M8 — Equivalent client-logic baseline

The resulting atlas is coherent enough to navigate the major client architecture and the seven required gameplay subsystems without repeatedly returning to raw disassembly.

---

# 7. Phase A — Build reusable static indexes

Before deep manual naming, create or extend reusable project-owned tooling under `scripts/`.

Suggested capabilities:

```text
image/function census
call/xref index
string xref index
RTTI/vtable census
switch/jump-table extraction
packet-reader/writer call indexing
sender opcode provenance
subsystem clustering
```

Prefer extending existing scripts over duplicating functionality.

Suggested script names, if no equivalent already exists:

```text
scripts/maple079_function_census.py
scripts/maple079_xref_index.py
scripts/maple079_vtable_census.py
scripts/maple079_packet_provenance.py
scripts/maple079_subsystem_cluster.py
```

Large raw indexes belong in:

```text
.work/task-046/
```

Commit only normalized summaries and reusable scripts.

Generate:

```text
result/task046-index-summary.md
result/task046-function-census.csv
```

Function-boundary uncertainty must be preserved explicitly.

---

# 8. Phase B — Seed expansion

Load all trusted main-EXE anchors from Tasks 037–045 into one seed ledger.

At minimum include:

```text
CClientSocket family
CLogin family
CWvsContext family
CSecurity family
CInPacket readers
COutPacket / WriteHeader
receive pump
phase dispatcher
field dispatcher
range dispatcher
handler map
sender census
known WARP / SPAWN / KEYMAP semantics
```

For each seed, automatically expand a bounded neighborhood:

```text
callers depth 1–2
callees depth 1–2
shared globals
shared vtable/object refs
shared strings
shared packet readers/writers
```

Generate:

```text
result/task046-seed-expansion.csv
```

---

# 9. Phase C — Subsystem classification

Use evidence propagation to classify functions/objects into:

```text
ui
character-user-context
field-map-stage
mob-combat
skill-buff-debuff
quest-npc
cashshop-transfer
inventory-item-equipment
social-party-guild-chat
login-world-channel
network-packet-core
resource-wz
render-audio
security-exception
shared-runtime
unknown
```

Useful evidence:

- opcode/handler semantics;
- caller/callee neighborhoods;
- globals and singleton access;
- strings and WZ paths;
- RTTI/vtable families;
- packet read/write shapes;
- reference-version structural matches;
- support-DLL calls used as context.

Generate:

```text
result/task046-subsystem-classification.csv
result/task046-subsystem-overview.md
```

For each subsystem report:

```text
functions discovered
functions classified
confirmed/high names
medium names
unknowns
classes/objects
handlers
senders
```

---

# 10. Phase D — Handler semantic extraction

Task 044 already maps most range-table handlers. Go beyond labels and summarize behavior.

For every reachable handler, extract where feasible:

```text
opcode / label
handler RVA
packet reads in order
important branches
object/global reads
object/global writes
important calls
UI/resource effects
outgoing packet side effects
likely owner object/class
confidence
```

Use the already identified packet-reader family and recover additional readers only when evidence supports them.

Generate:

```text
result/task046-handler-semantics.csv
```

Target:

```text
>=70 handlers with non-trivial semantic summaries
preferred: all 97
```

---

# 11. Phase E — Sender / packet-builder provenance

This is a priority mechanical pass.

Starting from the existing sender census and `WriteHeader` family, recover the opcode source through bounded backward dataflow.

Recognize common forms:

```text
immediate
stack local
function parameter
register copy
wrapper parameter
object field
small lookup table
branch merge
```

For each sender record:

```text
site RVA
containing function
opcode value or symbolic source
provenance chain
packet name if proven
payload writer sequence
caller subsystem
confidence
```

Generate:

```text
result/task046-sender-provenance.csv
result/task046-packet-builders.csv
```

Target >=350/486 classified/named senders.

Do not guess a numeric opcode where only symbolic provenance is known.

---

# 12. Phase F — RTTI / vtable / class / field recovery

Mechanically recover:

- RTTI descriptors;
- vtable candidates;
- constructor-like vtable writes;
- destructor/delete patterns;
- singleton/global object pointers;
- static in-image objects;
- repeated field-offset clusters;
- handler objects referenced by dispatcher singletons;
- shared short-thunk families.

For each candidate record:

```text
class/object id
provisional name
confidence
RTTI evidence
vtable RVA and slot count
constructor candidates
destructor candidates
singleton/global
size lower bound
known fields
important methods
handlers
senders
subsystem
reference candidate
conflicts
```

Generate:

```text
result/task046-class-map.csv
result/task046-vtable-map.csv
result/task046-field-map.csv
```

---

# 13. Required subsystem dossier — UI

Create:

```text
result/task046-ui.md
```

Recover gameplay-facing UI semantics, prioritizing:

- common window/control families;
- inventory/equipment/skill/quest/chat/NPC/cash-shop windows;
- open/close/show/hide transitions;
- event/button handlers;
- UI-to-packet-builder links;
- packet-handler-to-UI-update links;
- text/resource bindings;
- shared vtables.

Use strings, WZ paths, packet semantics, resource calls, vtable families, and reference structures as evidence.

Deliver at least 5 representative UI flows in equivalent pseudocode.

---

# 14. Required subsystem dossier — Character / user / context

Create:

```text
result/task046-character-user.md
```

Expand the known `CWvsContext` and user/character families:

- identity/state fields;
- character spawn/update;
- local-vs-remote identity decisions;
- HP/MP/AP/SP/EXP/level-like state where proven;
- equipment/inventory-facing state;
- character-change/migration flags;
- relevant singleton/object relationships;
- outgoing character actions;
- incoming character update handlers.

Seed from known WARP/SPAWN/AP/SP and character-info flows.

Include representative pseudocode for at least 4 character-state flows.

---

# 15. Required subsystem dossier — Field / map / stage

Create:

```text
result/task046-field-map.md
```

Recover:

- field/stage object candidates;
- map-change/channel-change flows;
- portal/inner-portal logic;
- map/field state storage;
- field entry/leave handlers;
- WZ map/resource loading bridges;
- field dispatcher ownership;
- object insertion/removal relationships where visible.

Seed from map/channel/portal packet families and existing field dispatcher anchors.

Recover at least one complete map-transition flow.

---

# 16. Required subsystem dossier — Mob / combat

Create:

```text
result/task046-mob-combat.md
```

Recover:

- mob object/class candidates;
- spawn/remove/update logic;
- close/ranged/magic attack builders;
- damage intake paths;
- target ID / result parsing;
- mob state/HP updates where proven;
- combat effect bridges;
- summon-related paths where they cluster naturally.

Seed from known attack/damage packet families.

Deliver at least 4 representative combat flows.

---

# 17. Required subsystem dossier — Skill / buff / debuff

Create:

```text
result/task046-skill-buff.md
```

Recover:

- skill ID handling;
- SP distribution;
- skill activation / special move;
- buff apply/cancel/update;
- debuff cancellation;
- skill effects and cooldown-like state where proven;
- skill WZ/resource lookups;
- macro handling;
- relevant UI update methods.

Seed from `DISTRIBUTE_SP`, `SPECIAL_MOVE`, `CANCEL_BUFF`, `SKILL_EFFECT`, `CANCEL_DEBUFF`, `SKILL_MACRO`, `USE_SKILL_BOOK`, and related handlers/senders.

---

# 18. Required subsystem dossier — Quest / NPC

Create:

```text
result/task046-quest-npc.md
```

Recover:

- NPC talk and continued-dialog state;
- NPC shop flows;
- storage flows where they share infrastructure;
- quest action builders/handlers;
- quest-state fields and updates;
- dialog/UI linkage;
- inventory/reward cross-links.

Seed from `NPC_TALK`, `NPC_TALK_MORE`, `NPC_SHOP`, `STORAGE`, `QUEST_ACTION` and related functions.

Deliver at least one dialog-state flow and one quest-state-update flow.

---

# 19. Required subsystem dossier — Cash shop / transfer

Create:

```text
result/task046-cashshop.md
```

Recover:

- enter-cash-shop client action;
- stage/world transition logic;
- cash-shop object/UI candidates;
- cash-item and merchant/item-store interactions that cluster with it;
- packet builder/handler boundaries;
- return/exit flow where visible;
- shared shop abstractions.

The emphasis is main-EXE client behavior, not re-documenting server ports.

Produce an end-to-end enter-cash-shop flow as far as static evidence permits.

---

# 20. Shared subsystem dossier — Inventory / item / equipment

Create:

```text
result/task046-inventory-item.md
```

Seed from item sort/gather/move/use, cash item, skill book, scroll, maker, pet food, mount food and related packet families.

Recover:

- inventory/container candidates;
- slot/tab semantics;
- item ID / quantity accesses;
- move/use/equip-like transitions where proven;
- UI integration;
- packet builders;
- item WZ lookups.

This dossier should support UI, character, quest, shop, and combat recovery.

---

# 21. Optional-but-high-value dossier — Social systems

If time permits create:

```text
result/task046-social.md
```

Seed from chat, whisper, messenger, party, guild, buddy, note, fame and related flows.

Recover object families, UI integration, packet builders, incoming updates, and shared identity fields where practical.

---

# 22. Call-edge and state-machine atlas

Generate:

```text
result/task046-call-edges.csv
result/task046-state-machines.md
```

Each edge should include:

```text
caller
callee
subsystem
evidence
packet relationship if relevant
object/global context
confidence
```

State-machine summaries should include as far as supported:

```text
login/world/channel
field transition
NPC dialog
cash-shop transition
selected UI lifecycle
selected skill/buff lifecycle
```

Keep projected structural hypotheses separate from confirmed/high edges.

---

# 23. Equivalent pseudocode

Create:

```text
result/task046-equivalent-pseudocode.md
```

Do not paste raw decompiler output.

Write compact equivalent pseudocode for at least 25 representative flows across all required subsystems.

Each block should cite relevant RVAs/objects and confidence and use explicit unknown placeholders when behavior is unresolved.

---

# 24. Reference correlation at scale

Use v95/reference material aggressively but carefully.

Record:

```text
cms079 function/object
reference version
reference symbol/class
match features
conflicts
accepted/rejected
confidence
```

Strong features include:

- unique strings;
- vtable shape;
- RTTI relationships;
- callgraph neighborhood;
- packet semantics;
- field-access patterns;
- WZ/resource paths;
- unusual constants;
- switch structure.

Generate:

```text
result/task046-reference-correlation.csv
```

Never transfer reference-version addresses into CMS079.

---

# 25. Coverage ledger

Maintain throughout the campaign:

```text
result/task046-coverage.csv
```

Track at least:

```text
main-EXE function candidates
subsystem-classified functions
semantically named functions
class/object candidates
vtable candidates
known fields
dispatch handlers
handlers with semantic summaries
sender sites
sender sites with opcode provenance
packet builders
pseudocode flows
accepted/rejected reference correlations
```

For each metric include:

```text
baseline
current
confirmed
high
medium
low
unresolved
notes
```

---

# 26. Recommended time allocation

For a 16–30 hour run:

```text
preflight/index                    10–15%
handler semantics                  10–15%
sender provenance                  15–20%
class/vtable/field recovery         15–20%
seven core subsystem dossiers       30–40%
consolidation/pseudocode/coverage   10–15%
```

Subsystem priority:

```text
1. character + field + inventory shared state
2. packet-backed UI
3. mob/combat + skills
4. quest/NPC
5. cash shop
6. social extras
```

Do not spend the campaign rebuilding old environment/protector investigations.

---

# 27. Autonomous working policy

The agent may autonomously:

- create scratch indexes and analysis scripts under `.work/task-046/`;
- promote reusable project-owned scripts to `scripts/`;
- run large static scans;
- use Capstone/pefile/Ghidra/IDA/radare2 offline;
- change subsystem order based on information density;
- correct old labels when new evidence disproves them, preserving provenance;
- make checkpoint commits when needed, but continue the same Task 046 campaign rather than stopping after each checkpoint.

Do not stop because one function, class, sender, or subsystem remains difficult. Switch to another high-value branch and continue.

---

# 28. Quality controls

Before accepting a generated naming batch:

1. manually inspect at least 10 sampled rows;
2. verify RVA/VA discipline consistently;
3. re-check the known image-base subtraction hazard;
4. verify packet direction/context;
5. keep support-DLL functions out of main-EXE counts;
6. mark reference-version names as correlations until independently supported;
7. avoid double-counting wrappers/thunks as high-level behavior;
8. ensure confidence reflects evidence;
9. preserve correction provenance;
10. keep bulk binary-derived data out of git.

---

# 29. Required outputs

Expected core outputs:

```text
result/46-game-subsystem-mechanical-recovery.md
result/task046-preflight.md
result/task046-milestones.csv
result/task046-blockers.csv
result/task046-coverage.csv

result/task046-index-summary.md
result/task046-function-census.csv
result/task046-seed-expansion.csv
result/task046-subsystem-classification.csv
result/task046-subsystem-overview.md

result/task046-handler-semantics.csv
result/task046-sender-provenance.csv
result/task046-packet-builders.csv

result/task046-class-map.csv
result/task046-vtable-map.csv
result/task046-field-map.csv
result/task046-reference-correlation.csv

result/task046-call-edges.csv
result/task046-state-machines.md
result/task046-equivalent-pseudocode.md

result/task046-ui.md
result/task046-character-user.md
result/task046-field-map.md
result/task046-mob-combat.md
result/task046-skill-buff.md
result/task046-quest-npc.md
result/task046-cashshop.md
result/task046-inventory-item.md
```

If reached:

```text
result/task046-social.md
result/task046-login-world-channel.md
result/task046-unknown-hotspots.csv
```

Do not create empty placeholder files for genuinely unreachable phases.

---

# 30. Blocker ledger

Maintain:

```text
result/task046-blockers.csv
```

Fields:

```text
blocker_id
subsystem
stage
symptom
evidence
attempted_methods
why_unresolved
next_safe_option
needs_richer_corpus
```

Once a blocker is well characterized, do not repeatedly spend hours rediscovering it.

---

# 31. Stop conditions

Stop only under one of these conditions:

### Stop A — preferred

M8 reached: all seven required subsystems have coherent architecture/behavior dossiers and the mechanical pipeline is reusable.

### Stop B

M6/M7 reached and the remaining important unknowns clearly require a richer analysis corpus rather than more work on the current static image.

### Stop C

The recovered-image corpus required for honest execution is unavailable.

### Stop D

The 16–30 hour high-value budget is exhausted, with deterministic continuation artifacts and coverage metrics committed.

A single unresolved subsystem is not a stop condition.

---

# 32. Final report

`result/46-game-subsystem-mechanical-recovery.md` must contain:

```text
STARTING_HEAD
FINAL_COMMIT
push status
canonical sample hash
analysis corpus identity
highest milestone M0–M8
```

Report baseline → final counts for:

```text
function candidates
semantically named main-EXE functions
subsystem-classified functions
classes/objects
vtables
fields
handlers with semantics
senders classified/named
packet builders
pseudocode flows
```

For each required subsystem report:

```text
most important classes/objects
most important functions
packet links
state fields
representative flow
confidence
major unresolved gap
```

Also report:

- top 20 newly recovered high-confidence functions/classes;
- top 20 unresolved high-value hotspots;
- sender census final state;
- handler-semantic final state;
- strongest accepted reference correlations;
- important rejected correlations;
- whether the current static corpus has reached its natural information boundary;
- whether a richer later-phase corpus is the dominant next step.

---

# 33. Commit / push discipline

Before committing:

```text
git status --short
git diff
git diff --cached
```

Never commit local proprietary binaries, recovered executable images, large analysis databases, or bulk raw traces. Commit normalized results and project-owned scripts only.

Recommended final commit:

```text
Complete Task 046 game subsystem mechanical recovery master campaign
```

Record:

```text
git rev-parse HEAD
```

as `FINAL_COMMIT`, then:

```text
git push origin main
```

Never force push.

If `origin/main` advances during the campaign, fetch and report divergence rather than rewriting history automatically.

---

# 34. Practical success target

A strong Task 046 completion should resemble:

```text
reusable static index                  yes
handler semantic summaries             most/all 97
sender census                          materially beyond 178/486; target >=350/486
main-EXE semantic function names        >=120 high-confidence preferred
subsystem-classified functions          >=350 preferred
class/object atlas                      dozens of high-confidence anchors
seven required subsystem dossiers       all delivered
representative pseudocode flows         >=25
coverage ledger                         complete and honest
unknown hotspots                        explicitly prioritized
```

Evidence quality always overrides target counts.

The desired end state is that future work no longer asks:

```text
“Where is the UI / character / map / mob / skill / quest / cash-shop logic?”
```

Instead it should ask:

```text
“Which remaining rows in the subsystem atlas are unresolved, and what evidence would resolve them?”
```

That transition is the purpose of Task 046.
