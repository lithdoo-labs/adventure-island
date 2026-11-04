# Task 036 — Game-body materialization capture (A+B+C) — final report

RUN DATE 2026-10-14 · STARTING_HEAD `4b56204941a53b8442e90722c91bc14ed61de2f5`
· canonical client sample `5d280cf1…` unchanged on disk (the client was
NEVER patched, NEVER debugged guest-side, NEVER exposed to any network).

## 0. Task 036 complete?

**YES — the campaign-defining milestone is achieved: the game body is
recovered.** All of A (gate retry + natural run), C (authorized
materialization capture) and B (reconstruction framing) delivered.

## 1. The authorization (recorded for the ledger)

The dump prohibition inherited from Tasks 026/027 was research hygiene,
not a legal analysis. The user explicitly lifted it on 2026-10-14 for
this campaign, scoped as: offline QEMU VM (`-nic none`, no public
network at any point), the project's own sample, capture taken from the
QEMU HOST side (monitor `stop` + `dump-guest-memory`) — a channel with
ZERO guest-visible surface (no debugger, no anti-debug interaction, no
bypass — the guest cannot observe it). Patching and guest-side
debugging remain prohibited and were never used. Captures and derived
binaries stay in `.work/task-036/` (never committed).

## 2. A — the VM gate reopened, and M2 finally happened

- The QEMU/Docker infrastructure (`task024-qemu`, `win7x86.qcow2`,
  snapshot `win7x86-clean`) was UP again (the 026-era regression gone).
- Natural run reproduced and completed: A2 launch
  (`"F:\MapleStory.exe" 127.0.0.1 9555`) → PCA click → **iloveaki modal
  at 01:58:37 → authorized OK click at 01:58:38** (the 026 M2 that was
  blocked for two campaigns) → **300 s of post-modal sampling**.
- **Post-modal state measured**: the game process never exits; WS grows
  7.9 → 16.4 MB right after the click, then a steady 100 %-core CPU
  burn with stable memory and 26 threads — the "spin" is real work.
  (`.work/task-036/out/proc.csv`)

## 3. C — the capture and reconstruction pipeline

```text
QEMU monitor (host side): stop → dump-guest-memory → 2.0 GiB ELF
 → marker scan (in-container grep -P): IV seed ×5, FUNNY_BYTES ×2,
   ZtlTaskMemAllocImp ×2  ⇒ MATERIALIZED
 → memory forensics (project scripts):
     PT_LOAD phys map → PDPT enumeration → strict DTB identification
     (marker page AND 84 MZ images AND ≥3000 pages) → DTB 0x3F6EC000
   (three DTBs share the marker page — shared memory; the strict score
     picked the game process)
 → PAE page-table walk → 6896 user pages → VA→PA map
 → image census: 84 PE images; THE GAME at va 0x400000
 → carve: 10,330,112 bytes, 1 missing page
     (.work/task-036/game-image-unpacked.bin — not committed)
```

Two forensic pitfalls were hit and fixed en route (grep offsets are ELF
file offsets not physical; `struct.unpack` slice-length silently
swallowed the image enumeration) — recorded in the timeline.

## 4. The recovered image — verification against the protocol layer

The carved image is the **Themida-decrypted original module in memory**:
original section layout (first section 7.9 MB at RVA 0x1000, entropy
6.54 = real x86 code) plus residual Themida sections
(`tpuaozxc/jtrppsow/uvrwsdpb`).

Every independent anchor from the recovered protocol layer is present:

| anchor | presence in image |
| --- | --- |
| FUNNY_BYTES 256-byte codec table | **256/256, twice** (RVA 0x7A0630, 0x7D4130) |
| IV seed F25350C6 | 5 dwords (first RVA 0x659092) |
| renumbered opcodes (c2s pushes) | LOGIN_PASSWORD 6+, SERVERLIST 6+, CHARLIST 0x45EC75, CHAR_SELECT 0x7B3713, **PLAYER_LOGGEDIN 0x45EDDB — adjacent to CHARLIST: the login send-function cluster** |
| WS2_32 import | present (unpacked import table) |
| exports | ZtlTaskMemAllocImp et al. in-image |
| RTTI | 13 classes: **CSecurity\* family** (ThreatDetected, KeyCryptInitFailed, ClearFailed, InitFailed, UpdateFailed, …), CMSException, CPatchException, CDisconnectException, CTerminateException, ZException, _com_error |

This is not protector residue — it is the game's own code, speaking
exactly the protocol recovered in Tasks 032/033.

## 5. B — reconstruction framing (the seed of the next campaign)

With the image in hand, the reference reconstruction (v95 + protocol)
now has binary ground truth to anchor against: the login send cluster
(~RVA 0x45EC00), the codec region (~RVA 0x650000-0x7D5000), the
CSecurity module (new discovery — the client's own anti-tamper layer,
complementing HShield), and the full 10.3 MB of code for the
function-by-function campaign that follows.

## 6. Strongest finding / uncertainty / blocker

- **Strongest finding**: the game body is recovered and
  protocol-verified. The three-campaign boundary (027-031) was about
  OFFLINE replay; the authorized host-side capture of our own offline
  VM run closes it cleanly.
- **Strongest uncertainty**: the image is a RUNTIME snapshot — parts of
  the original code may be re-encrypted or context-dependent at other
  execution phases (the tpuaozxc section remains encrypted); the 1
  missing page.
- **Blocker**: none — the follow-up (per-function recovery of the 10.3
  MB body: codec, dispatch, CLogin/CField handlers, CSecurity) is the
  natural Task 037.

## 7. Artifacts

`result/36-game-body-materialization-campaign.md` (this file),
`task036-milestones.csv`, `task036-blockers.csv`,
`task036-progression-timeline.csv`, `result/task036-materialization-record.md`
(the capture/reconstruction method, for reproducibility).
Binaries (dump, image) intentionally NOT committed (`.work/` only).
