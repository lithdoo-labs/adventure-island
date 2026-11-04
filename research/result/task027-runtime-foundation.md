# Task 027 — Runtime foundation rebuild

## 1. What was rebuilt (Phase A)

| Layer | Action | Identity preserved |
| --- | --- | --- |
| Docker container `task024-qemu` (26 h uptime) | `docker restart` (fresh PID namespace); later full WSL2 reset via `wsl --shutdown` + `docker start` | container filesystem holds `/vm` (qcow2, client.img, xfer images) — intact, hashes reverified |
| QEMU process | fresh `qemu-system-i386` per run (each run ends with guest `shutdown`, so every run now starts from a fresh QEMU + `loadvm`) | same command line as Task 025/026 (documented below) |
| Transfer disk | **fresh `xfer3.img`**: 128 MB zeroed file, MBR copied from xfer2 (sector 2049 partition start), FAT via `mformat`, minimal staging only | old xfer2 (hot-plug-mutated) retired from use |
| Snapshot | `win7x86-clean` (2026-10-13 01:51:24) — qemu-img verified unchanged | exact Task 025 snapshot |
| Client disk | `/vm/client.img` unchanged; canonical SHA reverified in every guest run (`hash-maplestory.txt`) | 5d280cf1… |

QEMU command line (unchanged, recorded):

```text
/usr/libexec/qemu-system-i386 -name win7x86 -machine pc,accel=tcg -m 2048 -smp 2 \
  -cpu coreduo -drive win7x86.qcow2 (ide0) + install ISO (ide1, cd) + answer ISO (ide2, cd) \
  -boot c -nic none -vga std -display none -usb -device usb-tablet -S \
  -monitor unix:/vm/qemu.monitor -serial file:/vm/serial-x86.log -daemonize
```

QEMU 7.2.22 (Debian), TCG, `-cpu coreduo`, 2048 MB, 2 vCPU, USB hub at
port 2 with client.img @2.1 and xfer3.img @2.2 (client-first, 2 s apart =
Task 025 success topology). Guest networking disconnected throughout.

## 2. Run matrix (this session)

| run | foundation | client | outcome | iloveaki |
| --- | --- | --- | --- | --- |
| T27F1 | fresh container + fresh QEMU + fresh xfer3 | F: | **F:-spin** (CPU 318.9 s/390 s linear, WS 5176 KB const, 25 threads, 16 modules frozen, no window; observer completed full 480 s window) | no |
| T27F2a | (aborted — QEMU had exited with the guest shutdown after F1; manual loadvm silently failed) | – | infrastructure lesson → orchestrator now ensures fresh QEMU | n/a |
| T27F2 | same container, fresh QEMU #2 | F: | **F:-spin** (CPU 263 s/330 s linear, WS 5160 KB, 25 threads) | no |
| T27F3 | **full WSL2 hypervisor reset** (`wsl --shutdown`) + fresh container start + fresh QEMU + xfer3 | G: (mount race flipped) | **G:-spin** (CPU 304 s/390 s linear, WS 4964 KB, 25 threads, `aki=False`) | no |

## 3. Assessment

- **Reproducible**: the spin outcome is produced on demand by the rebuilt
  foundation with the exact historical signature — including after the
  deepest ordinary-workflow reset (full WSL2 hypervisor VM recreation).
  This satisfies R0's "reproduce a known historical outcome" (the spin is
  the currently-dominant historical outcome class) and completes the
  infrastructure falsification ladder: container uptime, QEMU process
  lifetime, transfer-image state, and hypervisor-VM state are now all
  excluded as the gate's input.
- **Not reproducible**: the iloveaki gate — 0/3 (plus Task 026's 0/8 and
  C2). Recorded as **Stop C at the deepest level** (B27-1). The one
  environment dimension ordinary workflow cannot rebuild from scratch:
  the Windows host itself (uptime, timer state, Docker Desktop version
  behavior, hardware timing) — outside this campaign's allowed scope.
- Mechanism candidate from the static side: the T027 replay shows the
  post-probe path centers on a `winmm` + `timeGetTime` timing/behavior
  phase at exactly the point where every observed guest module timeline
  freezes — consistent with an environmental-timing threshold whose input
  shifted between the Task 025 success window and everything after.

## 4. Artifacts

- `result/task027-foundation-runs.csv` (per-run rows)
- `.work/task-027/vm-rebuild/t027-vm.sh` (container helper; xfer3 variant)
- `.work/task-027/host/t027-run.ps1` + `t027-shot.ps1` (orchestrator; ensures fresh QEMU)
