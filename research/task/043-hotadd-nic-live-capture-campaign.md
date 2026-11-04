# Task 043 — Hot-Add-NIC Live-Capture Campaign (the object population)

## Objective

The 041/042 chain defined this precisely: materialization needs the
no-NIC phase; connectivity needs a NIC. Task 043 separates them IN
TIME:

```
loadvm (NO nic) -> observer launches the client with argv
   10.0.2.2 9555 -> PCA + modal clicked (authorized)
 -> spin ~4 min (materialization; the 036 timing evidence)
 -> monitor: netdev_add user,id=n0 + device_add e1000,netdev=n0
    (the NIC hot-appears; Win7 PnP loads e1000; DHCP via SLIRP)
 -> the unpacked client's retrying connect finds the network
 -> server hello fires (the LIVE signal)
 -> the login screen: type the seeded account via sendkey
    (fl1234/123456) + Enter -> LOGIN_PASSWORD -> the burst
 -> CWvsContext/identity objects POPULATE
 -> capture at the live moment; carve the 041 target list
```

## Milestones

- **H1** no-NIC launch + modal clicked + materialization window
- **H2** NIC hot-added (device_add) — guest adapter up
- **H3** the client CONNECTS (server hello) — game logic live
- **H4** login typed; the burst observed server-side
- **H5** capture + carve: the populated object atlas (the 041 targets)

## Restrictions (inherited, unchanged)

Our own offline VM; SLIRP host-internal; authorized capture; no
patching/debugger; nothing binary committed.

## Operational machinery (inherited)

`.work/task-043/`; stop A-D; commit `Complete Task 043 hot-add-nic
live-capture campaign`; never force push.
