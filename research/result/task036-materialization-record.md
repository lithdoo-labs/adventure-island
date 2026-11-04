# Task 036 — Materialization capture & reconstruction method (reproducibility record)

All commands run from the repo root unless noted. Everything below is
project-owned method; no third-party forensic tooling used.

## 1. VM bring-up (A)

```text
docker exec task024-qemu sh /vm/t025-vm.sh qemu-start     # QEMU 7.2, -nic none, monitor unix:/vm/qemu.monitor
docker exec task024-qemu sh /vm/t025-vm.sh loadvm         # snapshot win7x86-clean
staging: .work/task-036/stage.py  (T036GO/T036OBS + scripts/maple079_postmodal_observe.ps1 -> xfer FAT via mcopy)
launch:  .work/task-036/launch.py (win+r -> cmd -> for %d in (...) T036GO.CMD -> alt-y)
observe: guest observer (026 postmodal, A2 mode) — PCA click + iloveaki modal OK click (authorized) + 300 s sampling
```

## 2. Capture (C) — host side only

```text
monitor: stop                                  # freeze
monitor: dump-guest-memory /tmp/t036-mem.elf   # 2.0 GiB physical ELF
docker cp -> .work/task-036/captures/t036-mem.elf
```

## 3. Marker scan (M4)

In-container (grep does the byte interpretation; `$'..'` is NOT
dash-compatible — use `grep -aobP '\x13\x00..'`):

markers (Tasks 002/032/033): IV seed F25350C6 ×5 · FUNNY_BYTES prefix
×2 · ZtlTaskMemAllocImp ×2 · WS2_32.dll (sanity) ⇒ MATERIALIZED.
NOTE: grep offsets are ELF FILE offsets — convert to physical via the
PT_LOAD map before any page-table reasoning.

## 4. Reconstruction (M5)

1. Parse ELF64 PT_LOADs → (file off ↔ physical) map.
2. PDPT enumeration: every 4 KB page whose first 4 u64s have ≥2 present
   entries pointing to plausible page dirs (107 703 candidates).
3. Strict DTB identification: walk each candidate's user half (PAE);
   require the marker physical page mapped AND ≥5 PE images AND
   ≥3000 pages. Winner: DTB 0x3F6EC000 (6896 pages, 84 PE images).
   (Marker-page sharing across DTBs = shared memory; the strict score
   disambiguates.)
4. Image census at 4 KB alignment (EXEs are not 64K-aligned!) with
   correct header slices (a 12-byte slice for an 8-byte unpack silently
   eats everything — fixed).
5. The game module: va 0x400000, SizeOfImage 0x9DA000 → carve page by
   page through the VA→PA map (10 330 112 bytes, 1 page missing).

## 5. Verification (M5 → protocol closure)

FUNNY_BYTES 256/256 ×2 (RVA 0x7A0630/0x7D4130) · IV seed ×5
(0x659092) · renumbered-opcode pushes incl. the login cluster
(CHARLIST 0x45EC75 / PLAYER_LOGGEDIN 0x45EDDB / CHAR_SELECT 0x7B3713)
· WS2_32 import · 13 RTTI classes (CSecurity* family, CMSException,
CPatchException, ZException…).

## 6. Preserved evidence (all in .work/task-036/, never committed)

`captures/t036-mem.elf` (2.0 GiB) · `game-image-unpacked.bin` (10.3 MB)
· `proc-vamap.csv` (6896 pages) · `image-list.txt` (84 images) ·
`out/` (observer outputs incl. proc.csv, aki.txt, module-first-seen)
