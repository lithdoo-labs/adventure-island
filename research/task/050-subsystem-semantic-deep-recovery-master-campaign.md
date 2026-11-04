# Task 050 — Unified Subsystem Semantic Deep-Recovery Master Campaign

## 0. Mission

Task 050 is the single canonical long-running semantic-recovery campaign for the CMS079 `MapleStory.exe` gameplay body.

This document supersedes every earlier Task-050 subtask specification, including the former handler-decode mini-campaign. There must be exactly one Task 050 specification in `task/` after this merge.

The project has already crossed the architectural boundaries that used to dominate the work:

- the main game body is available as an offline recovered analysis corpus;
- socket/connect/handshake/send/receive logic is identified;
- packet codec primitives are identified;
- the three-layer inbound dispatch architecture is mapped;
- c2s naming is mature;
- the complete server-side s2c wire-name table is recovered;
- range and field dispatch bands are mapped;
- Task 046 built a first mechanical subsystem atlas;
- Tasks 047–049 closed most opcode/dispatcher naming gaps;
- an initial Task-050 pass built a useful static database and handler-decode checkpoint, but did **not** satisfy the original deep-semantic completion criteria.

The remaining job is not primarily to find more addresses.

The remaining job is to convert existing routing/name knowledge into an evidence-backed semantic reconstruction:

```text
known packet / handler / sender
    ↓
true leaf function
    ↓
function-body behavior
    ↓
object/class owner
    ↓
semantic fields and layouts
    ↓
ctor/dtor/vtable relationships
    ↓
packet schema
    ↓
state transition
    ↓
resource/WZ dependency
    ↓
cross-subsystem calls
    ↓
equivalent pseudocode
    ↓
coherent subsystem model
```

This is one giant campaign. Do not split Character, Field, Mob, Skill, Quest, NPC, Inventory, UI, Social, Login, Cash Shop, sender provenance, handler decode, state-machine recovery, or class recovery into new task numbers.

Target autonomous run budget:

```text
30–60 actual hours
```

The campaign may use checkpoint commits, but it remains Task 050 until a valid stop condition is met.

---

# 1. Single-task rule — non-negotiable

During Task 050 execution you MUST NOT create, rename, or number any new task specification.

Forbidden during this campaign:

```text
task/050-*.md          # any additional Task 050 spec
task/051-*.md          # or later task spec
task/<new-number>-*.md
```

If a subproblem would normally deserve a new task, record it in:

```text
result/task050-blockers.csv
result/task050-hotspots.csv
```

or a Task-050 checkpoint result, then continue this campaign.

Creating a new `task/*.md` file during Task 050 is an execution-protocol violation.

The former handler-decode mini-campaign is absorbed into §16–§18 below and must not exist as a second Task 050 specification.

---

# 2. Scope

Primary main-EXE gameplay subsystems:

1. Character / User / `CWvsContext`;
2. Field / Map / Stage / Portal;
3. Mob / Combat / Damage;
4. Skill / Buff / Debuff / Cooldown;
5. Quest / NPC / Dialog / Shop / Storage;
6. Inventory / Item / Equipment / Meso;
7. UI / gameplay windows / controls;
8. Social / Party / Guild / Buddy / Chat / Messenger;
9. Login / World / Channel / Character Select / migration;
10. Cash Shop / MTS / transfer phases.

Cross-cutting concerns:

- packet readers/writers;
- handler ownership;
- sender/builder provenance;
- globals/singletons;
- object lifecycle;
- vtables;
- constructor/destructor families;
- semantic field inference;
- state machines;
- WZ/resource usage;
- update/tick loops;
- input/event routing;
- reference-version structural correlation.

Not a primary goal:

- protector/VM work;
- compatibility-environment experimentation;
- support-DLL symbol expansion for its own sake;
- broad opcode enumeration already solved by Tasks 047–049;
- another shallow 50k-function census.

---

# 3. Safety and analysis boundary

This campaign is an offline/static semantic-recovery effort over the already authorized local analysis corpus and committed normalized artifacts.

Allowed:

- static disassembly/decompilation;
- control/data-flow analysis;
- xref/callgraph analysis;
- static packet-reader/writer analysis;
- class/vtable/ctor/dtor inference;
- WZ/resource-model correlation;
- server-source/protocol correlation;
- repository reference-version correlation;
- project-owned analysis scripts;
- normalized CSV/Markdown/pseudocode outputs.

Do not:

- add protector bypass work;
- patch client conditionals or checks;
- force client code paths;
- inject hooks/code;
- fake runtime state;
- commit proprietary executable images, raw captures, recovered binary code, or large third-party binary corpora.

When evidence is insufficient, record the gap rather than inventing certainty.

---

# 4. Repository synchronization gate

Run first:

```text
git status --short
git branch --show-current
git remote -v
git rev-parse HEAD
```

If tracked/uncommitted user work exists:

- stop;
- report the paths;
- do not overwrite them.

Do not automatically use:

```text
git stash
git reset
git restore
git checkout -- .
git rebase
```

If clean:

```text
git fetch origin
git switch main      # if needed
git pull --ff-only origin main
git rev-parse HEAD
```

Record synchronized SHA as `STARTING_HEAD`.

Re-read this exact file from disk after synchronization.

---

# 5. Canonical corpus gate

When the original client is locally available, verify:

```text
MapleStory.exe SHA-256
5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d
```

Use the already recovered Task-036 game-body analysis corpus where locally available.

Do not regenerate or commit proprietary binaries just to satisfy this task.

If full static bytes are missing:

- continue only from committed normalized evidence where valid;
- mark binary-dependent phases blocked;
- do not infer function bodies from addresses alone.

Maintain:

```text
result/task050-preflight.md
```

with corpus identity, local tool versions, relevant corpus paths, reference bundles, and `STARTING_HEAD`.

---

# 6. Mandatory prior artifacts

At minimum read the latest committed versions of:

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
result/41-object-model-deep-dive.md
result/44-live-session-full-atlas.md
result/task044-handler-map.csv
result/45-grand-static-campaign.md

result/46-game-subsystem-mechanical-recovery.md
result/task046-coverage.csv
result/task046-handler-semantics.csv
result/task046-sender-provenance.csv
result/task046-packet-builders.csv
result/task046-class-map.csv
result/task046-vtable-map.csv
result/task046-field-map.csv
result/task046-call-edges.csv
result/task046-equivalent-pseudocode.md

result/47-s2c-enumeration.md
result/48-s2c-renumbering-decode.md
result/task048-s2c-wire-complete.csv
result/task048-handler-complete-map.csv
result/49-field-band-closure-atlas.md
result/task049-complete-s2c-dispatch-map.csv

result/50-handler-decode-naming.md
result/task050-handler-deep-decode.csv
result/task050-sub-dispatcher-analysis.csv
result/50-subsystem-semantic-deep-recovery.md
result/task050-function-map.csv
result/task050-field-facts.csv
result/task050-inbound-handler-semantics.csv
result/task050-packet-schemas.csv
result/task050-behavior-flows.md
result/task050-coverage.csv
result/task050-subsystem-coverage.csv
```

The existing Task-050 outputs are a **checkpoint**, not authoritative proof that later milestones were reached. Audit their metric definitions before reusing counts.

Useful context where needed:

```text
result/19-wizet-dlls.md
result/20-wz-inventory.md
result/23-wz-library-cross-validation.md
result/01-server-baseline.md
result/02-runtime-network-bootstrap.md
```

Repository v95/reference material is a hypothesis generator only.

```text
reference symbol/structure = useful evidence
reference absolute address = never authoritative for CMS079
```

---

# 7. Current checkpoint — facts to audit, not completion claims

The first Task-050 pass produced a useful database and handler checkpoint. Expect approximately:

```text
51,200   function candidates
146,375  direct call edges
10,922   raw field-access observations
1,061    functions assigned some subsystem label
699      functions touching the CWvsContext singleton
207/486  sender sites classified/named at previous depth
207      mapped s2c entries
85       s2c entries with some packet-reader semantics in handler-decode checkpoint
38       high-confidence handler-decode labels in that checkpoint
126      sub-dispatcher call targets across 11 decoded sub-dispatchers
28       behavior/pseudocode flows in the first final report
```

These numbers MUST be audited under the strict definitions below.

In particular:

- `10,922 raw field-access observations` are **not** 10,922 semantic fields;
- touching `CWvsContext` does **not** automatically make a function Character-owned;
- a `WriteHeader` observation alone is **not** an outbound packet schema;
- a sub-dispatcher RVA is **not** a leaf-handler body summary;
- an opcode name alone is **not** semantic function recovery.

Create or refresh:

```text
result/task050-baseline.csv
```

with current metric, source, recomputation method, and confidence.

---

# 8. Evidence model

Every semantic claim uses:

```text
confirmed
high
medium
low
unknown
```

Evidence-family tags:

```text
IMG       direct CMS079 main-image code
PKT       packet read/write sequence
S2C       server→client wire-name correlation
C2S       client→server wire-name correlation
SRV       server implementation semantics
WZ        WZ/resource evidence
RTTI      runtime type information
VTBL      vtable structure
CTOR      constructor evidence
DTOR      destructor evidence
FIELD     semantic field evidence
GLOBAL    global/singleton evidence
CALL      caller/callee topology
STR       strings
REF       reference-version structural correlation
IMPORT    import/API semantics
FLOW      agreement with broader behavioral flow
```

High-confidence semantic naming normally requires at least two independent evidence families.

Repeated weak evidence from the same family does not become independent proof.

---

# 9. Naming policy

Use original-like names only when evidence supports them.

Examples:

```text
CUser::OnMove                  # only with strong structural evidence
CUser::HandleMovePacket        # semantic name when class is strong, exact source name not proven
PlayerLike_HandleMove_A3xxxx   # provisional when owner is uncertain
```

Every semantic map should include:

```text
name_kind = original-like / semantic / provisional / unknown
```

Do not copy v95 addresses into CMS079.

---

# 10. Immutable metric definitions

These definitions are mandatory and MUST NOT be reinterpreted in the final report.

## 10.1 Raw field-access observation

A static access such as:

```text
[ecx+0x20]
[esi+0x58]
```

with no proven object/meaning.

It may be indexed, but it does **not** count as a semantic field fact.

Metric:

```text
raw_field_access_observations
```

## 10.2 Semantic field fact

Counts toward object-model/field milestones only when all are present:

```text
owner object/class identified at medium+ confidence
offset known
access size known or bounded
at least one semantic evidence source
provenance/evidence recorded
```

Strong example:

```text
CWvsContext +0x205C
u32 CharacterId
written by WARP_TO_MAP
read by local-player identity logic
```

Metric:

```text
semantic_field_facts
high_semantic_field_facts
```

## 10.3 Packet-header observation

Evidence only that a builder writes an opcode/header.

Example:

```text
WriteHeader(PARTY_OPERATION)
```

This is **not** a packet schema.

Metric:

```text
packet_header_observations
```

## 10.4 Minimal packet schema

Must contain:

```text
opcode/name
+ at least one payload read/write field
+ wire order/type
```

## 10.5 Structured packet schema

Must contain either:

```text
opcode/name + >=2 payload fields
```

or at least one proven:

```text
conditional field
loop/list
nested structure
mask-driven schema
```

Only minimal or structured schemas count toward S5.

## 10.6 Handler body summary

Must identify a **leaf handler or proven inline leaf path** and contain at least one body-level semantic fact beyond the packet name, such as:

```text
ordered packet reads
object/global field mutation
state change
allocation/lifecycle call
resource/UI side effect
outgoing response
```

A dispatcher label alone does not count.

## 10.7 Subsystem classification

A central singleton touch alone is insufficient.

In particular:

```text
accesses CWvsContext
```

is a clustering signal, not proof of `character` ownership.

To classify a CWvsContext-touching function into Character, require at least one additional character-specific family:

```text
packet semantics
character-specific field
class/vtable ownership
resource/string evidence
known character caller/callee
reference structural match
```

Otherwise prefer:

```text
shared-context
cross-subsystem
unknown
```

## 10.8 High-confidence semantic function

Requires:

- a reliable function/leaf boundary;
- a non-trivial behavior statement;
- at least two independent evidence families;
- no unresolved contradiction that changes the claimed role.

A packet name copied onto a dispatcher target is not enough.

---

# 11. Immutable milestones S0–S10

The milestone IDs, names, and meanings below are immutable.

The agent MUST NOT rename, repurpose, or reinterpret them.

If a milestone is not reached, report `partial`, `blocked`, or `not-reached`.

## S0 — Baseline reproduced

Tasks 046–049 plus existing Task-050 checkpoint counts are loaded, audited, and normalized under §10 definitions.

## S1 — Deep-analysis database built

Reusable database/index covers function candidates/boundaries, callgraph, imports, globals, strings, raw field accesses, packet readers/writers, handler routes, sender sites, vtable/ctor evidence, resource strings, and subsystem features.

## S2 — Inbound semantic closure materially advanced

Reached only if:

```text
>=140 distinct inbound leaf handler sites
```

have body-level semantic summaries under §10.6.

## S3 — Sender provenance materially advanced

Reached only if both:

```text
>=400 / 486 sender sites classified
>=325 / 486 packet-named or strongly role-named
```

Stretch:

```text
>=450 / 486 classified
```

## S4 — Object-model confidence materially advanced

Reached only if the campaign establishes approximately:

```text
>=80 class/object families at medium+
>=50 class/object families at high/confirmed
>=60 vtables assigned to semantic owners
>=250 semantic field facts
```

Raw field-access observations do not count.

## S5 — Packet schemas reconstructed

Reached only if:

```text
>=120 inbound minimal/structured packet schemas
>=120 outbound minimal/structured packet schemas
```

Header-only rows do not count.

## S6 — State machines recovered

Reached only if:

```text
>=20 evidence-backed state machines
```

with owner/state field or state source, values/branches, transition conditions, and side effects.

## S7 — Equivalent pseudocode baseline

Reached only if:

```text
>=80 non-trivial evidence-backed functions/flows
```

Trivial wrappers do not count.

## S8 — High-confidence semantic naming baseline

Reached only if both:

```text
>=180 high/confirmed main-EXE semantic functions
>=700 main-EXE functions validly classified under §10.7
```

## S9 — Cross-subsystem semantic atlas

Reached only when the major gameplay architecture can be navigated through packet→leaf function→object/class→field/state/resource links without repeatedly returning to raw address-only census data.

## S10 — Practical source-reconstruction baseline

Reached only when at least five major subsystems have sufficiently deep object/field/method/state/schema models to sketch useful equivalent class interfaces and core behavior in C++-like form.

---

# 12. Non-negotiable completion gate

A final status claiming strong completion is valid only if ALL of the following are true:

1. S0–S10 are reported using the exact immutable meanings from §11.
2. `result/task050-artifact-manifest.csv` exists and audits every required artifact.
3. Every unconditional required artifact is present and materially populated, or explicitly blocked with evidence.
4. `result/task050-coverage.csv` uses the metric definitions in §10.
5. Raw field accesses are not counted as semantic fields.
6. Header-only observations are not counted as packet schemas.
7. CWvsContext access alone is not counted as Character subsystem proof.
8. Any Stop B claim satisfies §13 and §43.
9. No new `task/*.md` specification was created during the campaign.
10. The final report distinguishes campaign termination from milestone completion.

If these gates are not satisfied, final verdict must be one of:

```text
PARTIAL
TIME-BUDGET EXHAUSTED
CORPUS-BOUNDARY BLOCKED
MISSING-CORPUS BLOCKED
```

Do not call the semantic campaign strongly complete merely because a final commit exists.

---

# 13. Runtime budget / early-stop hardening

Target budget:

```text
30–60 actual hours
```

Do not claim Stop D before 30 actual hours of high-value work.

Do not claim Stop B merely because automation finished quickly.

Before either Stop B or Stop D, the mandatory analytical passes in §14 must have been attempted.

If execution ends before 30 hours for another reason, the report must say `PARTIAL` or the relevant blocked state.

Checkpoint commits do not end the task.

---

# 14. Mandatory analytical passes before completion/boundary claims

All of these must be materially attempted:

1. baseline/metric audit;
2. leaf-handler recovery across every major dispatcher family;
3. interprocedural sender provenance;
4. packet-builder payload recovery;
5. ctor/vtable/class-owner correlation;
6. semantic field promotion;
7. state-machine extraction;
8. WZ/resource correlation;
9. all ten major subsystem dossiers;
10. static-solvable vs populated-state-required blocker classification.

A report that skips one of these may still be a useful checkpoint, but is not a full Task-050 completion.

---

# 15. Recommended work loop

Repeat autonomously:

```text
1. choose the highest-value unresolved semantic anchor
2. inspect direct code
3. establish true leaf/function boundary
4. collect packet/call/global/field/string/resource evidence
5. compare server/reference behavior
6. build provisional semantic model
7. validate with an independent evidence family
8. update normalized maps
9. identify reusable pattern
10. automate if useful
11. batch-apply
12. manually audit samples
13. promote confidence only when justified
14. move to next subsystem/hotspot
```

Do not ask the user which function to analyze next.

---

# 16. Mandatory handler-closure phase — absorbed former mini-campaign

The former handler-decode Task-050 mini-campaign is now an internal mandatory phase.

Starting evidence includes:

```text
207 mapped s2c entries
85 entries with some reader semantics in the previous checkpoint
38 high-confidence checkpoint labels
11 decoded sub-dispatchers
126 sub-dispatcher call targets
```

These are starting points, not closure.

For every important inbound packet:

```text
wire opcode
→ dispatcher
→ band
→ sub-dispatcher
→ leaf target
→ ordered reader sequence
→ object/global reads/writes
→ calls
→ branches
→ state/resource/UI effects
```

Do not count a common sub-dispatcher as dozens of leaf handlers.

Priority groups:

```text
0x20–0x80      inventory/stats/buff/social/UI
0x87–0x9F      chat/map effects/clock/boat/UI
0xA2–0xED      player/pet/summon/combat/quest
0xEE–0x103     monster lifecycle/status
0x104–0x10C    NPC lifecycle
0x10D–0x10F    hired merchant
0x110–0x111    map item/drop
0x115–0x116    mist
0x11C–0x11F    reactor
0x145          NPC dialog
0x146–0x147    NPC shop
0x16F–0x171    keymap/auto-pot
phase/login    login/world/character selection
```

Refresh:

```text
result/task050-inbound-handler-semantics.csv
```

and preserve true leaf provenance.

---

# 17. Packet-reader semantic extraction

For each leaf handler capture where feasible:

```text
packet read order
reader type
conditional fields
loop/list counts
mask-driven reads
object/global destination
semantic field candidate
callee effects
error/ignore conditions
response packets
```

Use server packet construction only as a cross-check.

Client reads remain primary evidence for what the client actually consumes.

---

# 18. Inbound packet schemas

Create/refresh:

```text
result/task050-packet-schemas.csv
result/task050-packet-schemas.md
```

Required fields should distinguish:

```text
header-observation
minimal-schema
structured-schema
```

Suggested schema columns:

```text
direction
opcode
packet_name
schema_level
field_index
wire_order
wire_type
semantic_name
condition
consumer_or_producer
confidence
evidence
notes
```

Unknown semantic fields remain `unknown_N`.

Do not promote server-only fields without confirming the client read/write path.

---

# 19. Sender provenance — interprocedural, not immediate-only

Baseline is approximately:

```text
207 / 486 sender sites classified
```

The remaining sites require backward value provenance through:

```text
push/pop
mov/lea
stack arguments
thiscall ECX
fastcall ECX/EDX
register copies
locals
wrapper parameters
simple arithmetic
branch merges
small lookup tables
object fields
```

Track symbolic expressions where a numeric opcode cannot be proven:

```text
opcode = arg1
opcode = caller.arg2
opcode = table[state]
opcode = this->mode ? A : B
```

Create/refresh:

```text
result/task050-sender-provenance.csv
result/task050-sender-coverage.md
```

Do not guess numeric opcodes.

---

# 20. Packet-builder semantics

Task 046 identified hundreds of builder-like functions.

Upgrade `contains WriteHeader` into:

```text
packet name/opcode
builder arguments
ordered payload writes
conditional writes
strings
object fields serialized
loops/lists
nested structures
builder-only vs builder+send vs builder+state
```

Create:

```text
result/task050-builder-semantics.csv
```

A header-only builder does not satisfy schema recovery.

---

# 21. Function boundary refinement

The ~51,200 candidate count is an index, not 51,200 proven business methods.

Assign boundary confidence:

```text
high
medium
low
```

Classify kinds:

```text
real-function
thunk
wrapper
virtual-method
packet-handler
packet-builder
constructor
destructor
state-transition
allocator/helper
unknown
```

Use direct call targets, vtables, jump targets, code gaps, tail calls, known handlers, and reference structure.

Create:

```text
result/task050-function-boundaries.csv
```

---

# 22. Global/singleton map

Build/refine:

```text
result/task050-global-map.csv
```

For each important global track:

```text
readers
writers
initializers
cleanup
packet handlers
subsystem neighborhoods
reference analogs
semantic confidence
```

Do not force a name when only singleton-like behavior is proven.

Central shared globals must not contaminate subsystem classification.

---

# 23. Ctor / dtor / vtable recovery

Use:

```text
mov [this], vtable
allocator → ctor
base ctor
field initialization
ctor → global store
release/dtor/delete
vtable slot call topology
```

For each candidate:

```text
vtable RVA
slot count
method RVAs
shared/unique slots
ctor candidates
dtor candidates
owner candidates
subsystem
RTTI/reference evidence
confidence
```

Create:

```text
result/task050-vtable-map.csv
result/task050-ctor-dtor-map.csv
```

The goal is confidence promotion, not a larger anonymous-vtable census.

---

# 24. Semantic field promotion

Keep raw access observations separately from semantic field facts.

Recommended files:

```text
.work/task-050/db/raw-field-accesses.csv
result/task050-field-facts.csv
```

`result/task050-field-facts.csv` contains **semantic facts only** under §10.2.

Recommended columns:

```text
owner_candidate
offset_hex
size
semantic_name
confidence
read_functions
write_functions
packet_sources
packet_sinks
comparison_constants
resource_consumers
reference_field
evidence
notes
```

Promote fields using packet writes/reads, repeated owner aliases, comparison semantics, UI/resource consumers, and reference structure.

---

# 25. Object layouts and class map

Create/refresh:

```text
result/task050-class-map.csv
result/task050-object-layouts.md
```

Each important object layout states:

```text
identity confidence
minimum size
known offsets
unknown gaps
vtable
ctor/dtor anchors
method anchors
packet handlers/senders
reference correlation
```

Never fabricate contiguous layouts from isolated offsets.

---

# 26. State-machine extraction

Create:

```text
result/task050-state-machines.csv
result/task050-state-machines.md
```

Find state variables through:

```text
switch([obj+offset])
cmp [obj+offset], const
write const to same field
branch families keyed by same field
packet/UI methods sharing state field
```

For each state machine require:

```text
owner/state source
state field or equivalent
known values
entry functions
transition conditions
side effects
packets in/out
UI/resource effects
confidence
```

Priority candidates:

- CLogin state/substate;
- field/map transition;
- user lifecycle;
- mob lifecycle;
- buff lifecycle;
- NPC dialog;
- shop/storage;
- quest presentation;
- cash-shop/MTS transition;
- party/guild flows;
- UI window lifecycle.

---

# 27. WZ/resource correlation

Create:

```text
result/task050-resource-links.csv
```

Correlate functions/classes with:

```text
Map
Mob
Npc
Skill
Item
Effect
String
UI
Canvas
NameSpace
ResMan
```

using path strings, ID→path construction, property names, animation names, localized text, and support-DLL call sequences.

The goal is semantic naming, not more WZ-format research.

---

# 28. Reference-version correlation

Create:

```text
result/task050-reference-correlation.csv
```

Compare CMS079 candidates with reference symbols using:

```text
unique strings
call topology
packet semantics
field patterns
vtable shape
switch shape
resource path
constants
object lifecycle
```

Record both accepted and rejected correlations.

Never copy reference absolute addresses.

---

# 29. Character / User / CWvsContext deep dive

Create:

```text
result/task050-character-user.md
```

Priorities:

```text
UPDATE_STATS
LEVEL_UPDATE
JOB_UPDATE
UPDATE_SKILLS
TEMP_STATS
TEMP_STATS_RESET
WARP_TO_MAP
SPAWN_PLAYER
REMOVE_PLAYER_FROM_MAP
UPDATE_CHAR_LOOK
CHAR_INFO
FACIAL_EXPRESSION
attack/damage actions
```

Recover:

- CWvsContext vs local-user vs remote-user responsibilities;
- identity fields;
- stat masks and destinations;
- appearance state;
- migration/change flags;
- local-vs-remote branches;
- derived recalculation/UI refresh calls;
- sender links.

Do not classify every CWvsContext user as Character automatically.

Target multiple deep flows, not just packet-name summaries.

---

# 30. Field / Map / Stage deep dive

Create:

```text
result/task050-field-map.md
```

Priorities:

```text
WARP_TO_MAP
CHANGE_MAP
CHANGE_CHANNEL
CURRENT_MAP_WARP
SPAWN_PORTAL
SPAWN_DOOR
REMOVE_DOOR
MAP_EFFECT
CLOCK
BOSS_ENV
BOAT_EFFECT
BOAT_HIDE
MOVE_PLATFORM
```

Recover:

- old-field teardown;
- new-field construction;
- map identity;
- WZ map-resource bridge;
- portal state;
- field object registration;
- player placement;
- Stage/Field relationships;
- transition state machine.

---

# 31. Mob / Combat deep dive

Create:

```text
result/task050-mob-combat.md
```

Inbound priorities:

```text
SPAWN_MONSTER
SPAWN_MONSTER_CONTROL
KILL_MONSTER
MOVE_MONSTER
MOVE_MONSTER_RESPONSE
DAMAGE_MONSTER
APPLY_MONSTER_STATUS
CANCEL_MONSTER_STATUS
SHOW_MONSTER_HP
```

Outbound priorities:

```text
CLOSE_RANGE_ATTACK
RANGED_ATTACK
MAGIC_ATTACK
TAKE_DAMAGE
SPECIAL_MOVE
PASSIVE_ENERGY
```

Recover CMob-like object fields, object/template IDs, movement, controller state, HP/display state, status masks, damage representation, registration/removal, and effects/UI calls.

---

# 32. Skill / Buff / Debuff deep dive

Create:

```text
result/task050-skill-buff.md
```

Analyze:

```text
UPDATE_SKILLS
GIVE_BUFF
CANCEL_BUFF
TEMP_STATS
TEMP_STATS_RESET
SKILL_USE_RESULT
SKILL_EFFECT
CANCEL_SKILL_EFFECT
COOLDOWN
SKILL_MACRO
DISTRIBUTE_SP
SPECIAL_MOVE
```

Recover skill IDs/levels, WZ skill lookup, buff masks, values, duration, source skill, timer integration, icon/UI updates, cooldowns, and macro layout.

---

# 33. Quest / NPC / Dialog / Shop / Storage deep dive

Create:

```text
result/task050-quest-npc.md
```

Analyze inbound/outbound NPC, dialog, quest, shop, and storage packets.

Recover:

- NPC object identity/template/position/control;
- dialog message types and responses;
- quest IDs/status/progress;
- shop entry parsing;
- storage flows;
- UI/state relationships.

---

# 34. Inventory / Item / Equipment deep dive

Create:

```text
result/task050-inventory-item.md
```

Analyze item modification, slot update, sort/gather, mount, skill-book, cash item, item move/use, scroll, meso, pet food, and equipment-related flows.

Recover:

- inventory type/container;
- slot representation;
- item identity/quantity;
- equip vs stackable structures;
- add/remove/update/move operations;
- serialization;
- UI refresh paths;
- local action → sender → result flow.

---

# 35. UI deep dive

Create:

```text
result/task050-ui.md
result/task050-ui-classes.csv
```

Promote existing anonymous/low-confidence UI candidates through:

```text
ctor/vtable writes
resource paths
packet handlers
button callbacks
show/hide calls
parent-child creation
reference structure
```

Prioritize login, character select, status, inventory/equipment, skills, quests, keymap, chat, social windows, NPC dialog/shop/storage, cash shop, and system messages.

For each useful UI family recover open/show, close/hide, event callbacks, packet sender, packet-driven refresh, resources, important fields, and confidence.

---

# 36. Social deep dive

Create:

```text
result/task050-social.md
```

Analyze Party, Guild, Alliance, Buddy, Multichat, Whisper, BBS, Messenger, Family, General Chat, and Party Chat.

Recover member-entry models, invite/result state, chat routing, UI refresh, packet schemas, and separation between wire DTO-like data and persistent client models.

---

# 37. Login / World / Channel deep dive

Create:

```text
result/task050-login-world-channel.md
```

Seed:

```text
CLogin ~0x45EB00
[this+0x64] state
[this+0x68] substate
```

Recover state values/transitions, server list, world/channel selection, character list/create/delete/select, server-IP/migration, field transition, and error UI paths.

Connect phase s2c packets to c2s login builders.

Produce a coherent login→character-select→field state graph where evidence permits.

---

# 38. Cash Shop / MTS deep dive

Create:

```text
result/task050-cashshop-mts.md
```

Analyze CS/MTS open, CHAR_CASH, cash effects, enter/return transitions, cash-item representation, UI creation, packet schemas, and relationship to inventory/state.

Separate proven CMS079 behavior from expected MapleStory architecture.

---

# 39. Pet / Summon / Reactor / Drop / map-object families

Create:

```text
result/task050-map-object-families.md
```

Analyze Pet, Summon, Reactor, Drop/MapItem, Mist, Door, and related lifecycle handlers.

Look for shared field-object interfaces and common vtable slot topology across:

```text
User-like
Mob-like
Npc-like
Pet-like
Summoned-like
Reactor-like
Drop-like
```

Treat exact source names as hypotheses unless structurally supported.

---

# 40. Update loops and input/action routing

Create where evidence warrants:

```text
result/task050-update-loops.md
result/task050-input-action-flows.csv
```

Find periodic update families through timers, field-object iteration, UI updates, animation/tick logic, skill cooldowns, and state polling.

Connect UI/input events to gameplay actions and packet builders where possible:

```text
inventory action → item sender
skill hotkey → skill sender
NPC click → NPC_TALK
portal action → CHANGE_MAP
chat submit → chat sender
```

---

# 41. Semantic call graph and clustering

Create:

```text
result/task050-call-edges.csv
result/task050-clusters.csv
```

Use callgraph/global/field/string/resource/vtable/packet features to cluster unknown code around trusted seeds.

Clustering prioritizes manual review; it must not automatically create high-confidence names.

Track direct vs virtual vs wrapper vs reference-projected edges separately.

---

# 42. Equivalent pseudocode and class interfaces

Create/refresh:

```text
result/task050-behavior-flows.md
result/task050-class-interfaces.md
```

Conditional subsystem pseudocode files may be created when materially populated.

Every pseudocode block must be labeled as semantic reconstruction, not original source, and should cite relevant RVAs/functions and confidence.

Strong pseudocode includes object/field/state/packet/resource semantics, not just renamed assembly.

---

# 43. Stop conditions

Do not stop because:

- one function is hard;
- one class lacks RTTI;
- one sender slice fails;
- one subsystem plateaus;
- a reference match is rejected;
- a checkpoint commit exists.

Valid stops:

## Stop A — Strong completion

S8/S9 reached and most major subsystems have useful deep models, while the Completion Gate passes.

## Stop B — Verified practical static-corpus boundary

May be claimed only after **all mandatory passes in §14** were materially attempted.

Additionally, for each major subsystem, classify unresolved high-value questions into:

```text
static-solvable
populated-state-required
genuinely-unknown
```

For every `populated-state-required` category provide at least one concrete example showing why static code and current normalized artifacts cannot answer it.

The statement “the capture is pre-login” alone is insufficient for Stop B.

If leaf-handler recovery, sender provenance, class/field promotion, state-machine extraction, or resource correlation still has obvious static work, do not claim Stop B.

## Stop C — Missing corpus

Required recovered-image bytes are unavailable and normalized artifacts are insufficient for the remaining deep analyses.

## Stop D — Time budget

At least 30 actual hours of high-value work elapsed and the campaign leaves durable maps/scripts plus precise continuation.

---

# 44. Coverage metrics

Maintain:

```text
result/task050-coverage.csv
```

Required metrics include at least:

```text
function_candidates
reliable_function_boundaries
subsystem_classified_functions
medium_semantic_functions
high_semantic_functions
class_object_candidates
medium_classes
high_classes
assigned_vtables
raw_field_access_observations
semantic_field_facts
high_semantic_field_facts
inbound_packet_names
inbound_leaf_handlers_located
inbound_handler_body_summaries
packet_header_observations_inbound
inbound_minimal_schemas
inbound_structured_schemas
sender_sites_total
sender_sites_classified
sender_sites_packet_named
packet_header_observations_outbound
builder_functions_total
builder_functions_semantically_summarized
outbound_minimal_schemas
outbound_structured_schemas
state_machines
resource_links
reference_correlations
pseudocode_functions_flows
```

For every metric preserve:

```text
baseline
current
preferred_target
how_counted
```

No percentage without a meaningful denominator.

---

# 45. Per-subsystem coverage

Maintain:

```text
result/task050-subsystem-coverage.csv
```

Suggested columns:

```text
subsystem
classified_functions
high_semantic_functions
medium_classes
high_classes
semantic_fields
inbound_leaf_handlers
outbound_senders
minimal_schemas
structured_schemas
state_machines
pseudocode_flows
resource_links
largest_gap
confidence
```

This file should become the best future basis for answering “how much of the client is reversed?”.

---

# 46. Artifact manifest — mandatory

Create:

```text
result/task050-artifact-manifest.csv
```

Columns:

```text
artifact
requirement
exists
nonempty
row_count_or_size
quality_gate
quality_gate_passed
blocked_reason
notes
```

Before final reporting, compute:

```text
required_artifacts
present_artifacts
missing_artifacts
quality_passed_artifacts
blocked_artifacts
```

If an unconditional required artifact is missing without a documented blocker, the final verdict cannot be strong completion.

---

# 47. Required durable artifacts

Unconditional core artifacts:

```text
result/50-subsystem-semantic-deep-recovery.md
result/task050-preflight.md
result/task050-baseline.csv
result/task050-milestones.csv
result/task050-blockers.csv
result/task050-coverage.csv
result/task050-subsystem-coverage.csv
result/task050-artifact-manifest.csv
result/task050-packet-master.csv
result/task050-conflicts.csv
result/task050-function-map.csv
result/task050-function-boundaries.csv
result/task050-call-edges.csv
result/task050-inbound-handler-semantics.csv
result/task050-packet-schemas.csv
result/task050-packet-schemas.md
result/task050-sender-provenance.csv
result/task050-sender-coverage.md
result/task050-builder-semantics.csv
result/task050-global-map.csv
result/task050-vtable-map.csv
result/task050-ctor-dtor-map.csv
result/task050-field-facts.csv
result/task050-class-map.csv
result/task050-object-layouts.md
result/task050-state-machines.csv
result/task050-state-machines.md
result/task050-resource-links.csv
result/task050-reference-correlation.csv
result/task050-confidence-promotions.csv
result/task050-hotspots.csv
result/task050-behavior-flows.md
result/task050-class-interfaces.md
```

Required subsystem dossiers:

```text
result/task050-character-user.md
result/task050-field-map.md
result/task050-mob-combat.md
result/task050-skill-buff.md
result/task050-quest-npc.md
result/task050-inventory-item.md
result/task050-ui.md
result/task050-social.md
result/task050-login-world-channel.md
result/task050-cashshop-mts.md
result/task050-map-object-families.md
```

Conditional artifacts should be created only when materially populated.

Do not make empty files to satisfy the manifest.

---

# 48. Milestone ledger

Maintain:

```text
result/task050-milestones.csv
```

Columns:

```text
milestone
immutable_definition
status
evidence
artifact
confidence
notes
```

Allowed statuses:

```text
not-started
in-progress
partial
reached
blocked
not-applicable
```

The milestone names and meanings come directly from §11 and may not be redefined.

---

# 49. Blocker ledger

Maintain:

```text
result/task050-blockers.csv
```

Columns:

```text
blocker_id
subsystem
stage
symptom
evidence
attempted_methods
why_unresolved
static_or_runtime_dependency
next_safe_option
```

Record a blocker once, then move to another productive branch unless it blocks the entire campaign.

---

# 50. Confidence promotion ledger

Maintain:

```text
result/task050-confidence-promotions.csv
```

Track important promotions:

```text
entity
old_confidence
new_confidence
new_evidence
conflicts_resolved
notes
```

A major success is converting important low/medium candidates into high-confidence entities, not just adding more anonymous rows.

---

# 51. Suggested first continuation block

Do not restart from zero. Audit the current Task-050 checkpoint and continue.

A productive opening sequence:

```text
Hour 0–2
- sync and reread this unified spec
- audit existing Task050 artifacts against §10 definitions
- rebuild baseline and artifact manifest
- separate raw field accesses from semantic field facts
- separate header observations from real schemas
- correct CWvsContext over-classification

Hour 2–6
- finish true leaf-handler extraction for range/field/sub-dispatch families
- promote 85 checkpoint reader-semantic entries into real body summaries
- recover phase/login leaf routing

Hour 6–12
- interprocedural sender-provenance proof + batch pass
- payload-builder schemas
- first semantic field promotion pass
- ctor/vtable/object-owner correlation
```

Continue after 12 hours; this is not an endpoint.

---

# 52. Suggested second continuation block

Prioritize:

```text
sender provenance batch closure
class/vtable promotion
semantic field facts
state-machine extraction
Character / Field / Mob / Skill dossiers
resource/WZ links
UI class ownership
```

Checkpoint if useful, then continue.

---

# 53. Suggested later hours

Shift from census to closure:

```text
raw field access → semantic owned field
common dispatcher → true leaf handler
header observation → payload schema
anonymous vtable → owner class
state writes → explicit state machine
cluster label → high-confidence semantic function
packet flow → class method/interface
```

Favor entities that unlock many neighbors.

---

# 54. Tooling policy

Reusable project-owned scripts may live in `scripts/`.

Validate automated inference against trusted anchors such as:

```text
CClientSocket::Connect
CClientSocket::ProcessRecv
WARP_TO_MAP handler
SPAWN_PLAYER handler
KEYMAP handler
WriteHeader
CLogin state region
known CWvsContext fields
```

Measure false positives before batch promotion.

Do not auto-promote high-confidence names from an unvalidated heuristic.

Large indexes/databases stay under:

```text
.work/task-050/
```

---

# 55. Checkpoint policy

Permitted checkpoint commit themes:

```text
Task 050 checkpoint metric audit
Task 050 checkpoint handler closure
Task 050 checkpoint sender provenance
Task 050 checkpoint object model
Task 050 checkpoint subsystem dossiers
```

After a checkpoint, continue Task 050.

Do not create another task spec.

---

# 56. Final-report requirements

Final report:

```text
result/50-subsystem-semantic-deep-recovery.md
```

Must include:

```text
STARTING_HEAD
FINAL_COMMIT
push status
checkpoint commits
actual elapsed work time
final verdict
S0–S10 exact statuses
```

Include baseline→final metrics using §10/§44 definitions.

For each major subsystem report:

- important classes/objects;
- high-confidence methods;
- semantic fields/layout;
- inbound leaf handlers;
- outbound senders;
- packet schemas;
- state machines;
- WZ/resource links;
- representative pseudocode;
- largest unresolved gap.

Also include:

```text
Top 30 newly recovered semantic functions/methods
Top 20 newly recovered classes/objects
Top 30 strongest semantic field facts
Top 20 state-machine discoveries
Top 30 unresolved semantic hotspots
```

Answer precisely:

```text
What remains statically solvable?
What genuinely requires populated later-phase state?
What is genuinely unknown?
```

---

# 57. Final commit wording

Use commit wording that matches the actual verdict.

Only if the Completion Gate passes and strong completion is justified:

```text
Complete Task 050 subsystem semantic deep recovery master campaign
```

If the run is useful but partial:

```text
Advance Task 050 subsystem semantic deep recovery campaign
```

If a verified corpus boundary is reached:

```text
Conclude Task 050 at verified static corpus boundary
```

Do not use `Complete Task 050` merely because the current run ended.

Before every commit:

```text
git status --short
git diff
git diff --cached
```

Never force push.

If remote advanced:

- fetch;
- report divergence;
- do not rewrite history automatically.

---

# 58. Commit hygiene

Never commit:

```text
.raw/
.work/
original EXE/DLL/DAT/WZ
recovered executable image
raw memory captures
large disassembler databases
bulk binary blobs
third-party binary/source corpora
```

Allowed:

```text
project-owned reusable scripts
normalized CSV
Markdown reports
semantic maps
state graphs
pseudocode reconstructions
```

---

# 59. Acceptance principle

Task 050 is successful when the project moves from:

```text
“We know the packet names and where major code lives.”
```

into:

```text
“We can explain how the major CMS079 client subsystems parse data,
represent state, mutate objects, transition states, use resources,
emit actions, and interact through evidence-backed classes, fields,
methods, packet schemas, and equivalent pseudocode.”
```

Database size is not semantic recovery.

Opcode naming is not semantic recovery.

A central singleton cluster is not class ownership.

A raw offset is not a semantic field.

A `WriteHeader` row is not a packet schema.

A sub-dispatcher address is not a leaf-handler explanation.

Those distinctions are the acceptance standard for the remainder of Task 050.
