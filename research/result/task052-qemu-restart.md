# Task 052 Phase E: QEMU Restart — Dynamic Line Back Online

## Achieved (all verified live)

1. **Container restarted**: `task024-qemu` (was Exited 255) → Up.
2. **QEMU relaunched WITH user-mode networking** — the decisive change:
   - old: `-nic none` (the 042 F:/G: fork's no-NIC branch; also why the
     guest client could never reach a server)
   - new: `-nic user` → e1000 + 10.0.2.0/24, host = 10.0.2.2
3. **Snapshot restored & running**: `win7x86-clean` loaded, VM status running.
4. **Both branches preserved**: savevm `win7x86-clean-nicprep` (pre-NIC state)
   and `win7x86-nic-running` (with-NIC running state).
5. Screenshots: T052-restored.ppm, T052-nic-running.ppm.

## Remaining to a post-login capture (the actual B44-1 rebuild)

- guest DHCP pickup (expected automatic for e1000)
- host server stack start (MySQL + JAR; scripts exist in task-033 lineage)
- client server-address config -> 10.0.2.2 (in-guest edit via xfer)
- login orchestration (typed credentials or baked autounattend)
- capture-at-login via the authorized host-side dump path (036 lineage)

## Verdict

Phase E criterion ("container restarted + guest state verified; outcome
documented") **MET with the infrastructure advanced further than minimum**:
the WITH-NIC branch is now live and snapshotted, removing the historical
no-network blocker that made in-guest login impossible.
