# Task 038 — Game-Body Cipher, Dispatch & Security Decode Campaign

## Objective

Continue from Task 037 (game body recovered; socket layer core decoded;
Stop D on budget). This campaign reads the body's three remaining core
clusters — the cipher, the receive/dispatch path, and the security
module — completing the CClientSocket family and opening the handler
map:

```
G1 cipher decode  — the object at [socket+0x54]: vtable -> methods ->
   encrypt/decrypt/IV-roll; 0x49682C (queue+cipher roll); FUNNY-table
   xrefs (0x7A0630/0x7D4130); the AES-key construction in code;
   cross-validated against scripts/maple079_packet.py (two-way proof)
G2 receive path   — the owners of recv@0x94994/0x95A72 -> buffering ->
   decode -> handoff (OnRead/OnPacket shape)
G3 s2c dispatch   — locate the opcode dispatch: the renumbered s2c
   values (0x00/0x09/0x0A/0x0B/0x41/0x81/0xA2/0x16F...) as comparison/
   jump-table constants -> the handler switch
G4 packet builders — isolate where wire opcodes are encoded (the
   COutPacket family; fixes B37-3: the state-constant misread)
G5 CSecurity      — the 13 RTTI TDs' xrefs -> the anti-tamper module's
   code regions and behavior class
G6 naming ledger  — two-evidence naming (in-image + protocol + v95),
   integration into the architecture docs
```

Corpus: the Task-036 authorized capture (10.3 MB image + 2 GB dump),
static analysis only, nothing binary committed.

## Milestones

- **G1** cipher family named and algorithm-matched (the campaign's head)
- **G2** receive path decoded to the dispatch handoff
- **G3** dispatch located (or its shape honestly recorded)
- **G4** wire-opcode encoding sites isolated
- **G5** CSecurity mapped
- **G6** naming ledger + updated docs

## Main Work

### 1. G1 — cipher

- Find the cipher ctor: writers of [socket+0x54]; capture the vtable.
- Disassemble each vtable method; identify:
  - the AES-key init (search code building the 0x13/0x08/0x06/0xB4/0x1B/
    0x0F/0x33/0x52 dword chain),
  - the shuffle (loops over the FUNNY table),
  - the header build (0x4F00/0xB0FF immediates),
  - the IV roll (4-byte shifts/xors).
- Disassemble 0x49682C (the queue-cipher roll on full send).
- Reimplement-verify: match every step against maple079_packet.py's
  proven codec — any divergence is either a finding or an error to fix.

### 2. G2 — receive path

- Owners of the two recv sites; the WSA event/select wait loop; the
  length-prefix extraction; the decode call; the handoff target.

### 3. G3 — dispatch

- Distinctive immediates hunt: cmp/sub/switch constants matching the
  proven s2c values; jump tables in .data (indexed indirection);
  record the handler RVAs for the login-zone opcodes we can name from
  the 033 chain.

### 4. G4 — builders

- 0x402D66-family packet objects; find the opcode write (Encode1/2/4
  style) by tracing a known build (e.g., the handshake's version write
  at 0x95CC2-0x95D13).

### 5. G5 — CSecurity

- The 13 TD addresses; xref sites (inline-compare style); ctor/vtable;
  strings/API usage around them; classify the anti-tamper behavior.

## Restrictions (inherited)

Static analysis of our authorized capture only; nothing binary
committed; v95 = names/structure only, labeled; honest boundaries for
G3/G5 if not reached.

## Operational machinery (inherited)

Sync gate; `.work/task-038/` scratch; mandatory reading: Task 036/037
results, `scripts/maple079_packet.py`, `.work/task-035/disasm_helper.py`;
time budget 8-16 h (G1 30%, G2 15%, G3 20%, G4 10%, G5 15%, G6 10%);
stop conditions A-D; commit message `Complete Task 038 game-body cipher
dispatch security decode campaign`; never force push.

## Final Report

`result/38-game-body-cipher-dispatch-security.md` + milestones/blockers/
timeline. Must state: the cipher family's decoded shape and its
match/mismatch against the proven codec; the receive path; the dispatch
verdict; builder encoding sites; CSecurity map; naming coverage;
strongest finding / uncertainty / blocker; next direction.

The most important question Task 038 must answer:

```
"Does the client's cipher decode to exactly the codec the project
already proved on the wire — and does the dispatch table open the
handler map that turns 10 MB of code into named game logic?"
```
