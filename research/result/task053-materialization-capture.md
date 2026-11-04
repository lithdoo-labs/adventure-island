
# Task 053: Post-Materialization Capture Analysis

## Capture Details
- File: t053-mat.elf (1.74 GB)
- Environment: -nic none (036-proven materialization environment)
- Trigger: client launch -> PCA -> iloveaki OK -> 280s wait -> dump
- Guest state at dump: login screen (session died during materialization)

## Results

| Metric | 036 pre-login | t053-mat | Delta |
|---|---|---|---|
| S-box anchors in game process | 0 | 26 | +26 |
| AES-256 schedules | 0 | 0 | 0 |
| Table @0xBD4130 | zero | zero | — |

## Interpretation

The 26 S-box anchors prove the client's AES tables are computed during
materialization (unpacking). However:
- The AES key schedule requires a server handshake to populate
- The custom cipher table (0xBD4130) is also handshake-dependent
- The session died (login screen) before/at the point where connection
  would have occurred

## Blocker: NIC-Dependent Protector Kill

Evidence chain:
1. With -nic user: client launches but dies silently (no window, no process)
2. With -nic none: client materializes (26 S-boxes prove it) but can't
   connect (no network)
3. The protector checks for network adapters and terminates in their
   presence before the cipher initializes

This re-confirms and refines B44-1: the protector's NIC check happens
AFTER the AES tables are computed but BEFORE the handshake completes.

## Next Steps (for Task 054)

Option A (NIC hot-add after materialization):
- Boot with -nic none
- Wait for materialization (26 S-boxes present)
- Hot-add NIC (044 proved this works: netdev_add + device_add)
- Client may then connect to 10.0.2.2:7575
- Capture after handshake

Option B (USB NIC instead of PCI):
- Some protectors only check PCI NICs
- Add USB ethernet adapter instead

Option C (MAC address spoofing):
- The protector may check for specific MAC OUIs
- Use -netdev user with a custom MAC

The capture and its analysis are committed as Task 053 results.
