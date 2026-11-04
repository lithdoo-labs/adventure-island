# Task 053 Final Report — Post-Login Capture Attempt

## Verdict: **Blocked** (protector anti-analysis boundary; materialization capture achieved)

## Approaches Tried (all documented with evidence)

| # | Method | Result | Evidence |
|---|---|---|---|
| 1 | PCI e1000 NIC (standard) | Client dies silently | No process, no window, no HShield connection |
| 2 | USB-net NIC | Same death | Same pattern |
| 3 | Custom MAC (Realtek OUI) | Same death | Same pattern |
| 4 | No NIC + hot-add after materialization | Session dies before reliable detection | Vision saw login screen, not game window |
| 5 | No NIC (materialization only) | **26 S-box anchors materialized** | 1.74GB ELF capture |

## Key Achievement: Materialization Capture

Despite the connection blocker, we captured the client at the moment of
materialization (Themida unpacking complete, cipher tables computed):

- **26 S-box anchors** in the game process (vs 0 in pre-login 036 capture)
- **0 AES-256 key schedules** — proving the schedule is handshake-dependent
- **Table @0xBD4130 = zero** — the custom rolling cipher table is also
  connection-dependent

## Architecture Insight: Protector Detection Point

The protector's NIC check occurs in this window:
```
Client launch
  -> PCA dialog (dismissable)
  -> iloveaki modal (dismissable)
  -> Materialization begins (AES S-box tables computed HERE)
  -> NIC CHECK (if adapter present: TERMINATE SESSION)  ← protector gate
  -> Game window shows (login screen)
  -> Server connection (AES key schedule populated HERE)
  -> Handshake → cipher fully initialized
```

Without NIC: steps up to "Game window shows" complete (26 S-boxes appear),
but the connection never happens (no cipher keys).
With NIC: the process terminates at the NIC check (before materialization).

## Honest Conclusion

The post-login capture (with populated AES schedule + cipher table) requires
bypassing the protector's anti-analysis detection, which is outside the
authorized technique set (no client patching, no anti-debug bypass).

The Task 053 materialization capture + Task 052 static analysis together
provide:
- Complete pump architecture (0x95E7E chain, wire-word validation)
- Complete wire protocol (c2s/s2c schemas from Tasks 048-050)
- 26 S-box proof of client AES table computation
- Precise characterization of when each crypto component initializes

## Artifacts

- .work/task-053/captures/t053-mat.elf (1.74 GB)
- result/task053-materialization-capture.md
- scripts/t053_vm_control.py, t053_capture_analyze.py
- Vision-driven orchestration scripts (.work/task-053/visor.py etc.)
