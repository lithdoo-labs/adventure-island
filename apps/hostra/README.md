# apps/hostra — Hostra entry of the empty LoomRealm test application

This directory is the Hostra **installation root** for the empty test
application. It contains no gameplay: it only proves that this repository can
define a LoomRealm Game Package and start it through the Hostra
launch-composition model used by `loom-realm/examples/PokeMan`.

| File | Purpose |
|---|---|
| `game.json` | Game Entry V1 — declares the single `smoke` subsystem with a `null` initial input. |
| `launch.hostra.json` | Hostra launch composition — binds `smoke` to the logical module `subsystems/smoke.mjs`. |
| `subsystems/smoke.mjs` | Installation-root shim re-exporting `systems/loomrealm-smoke/subsystem.mjs`. |

`apps/pwa` declares the same application for the PWA platform; both entries
share the identical Game Entry and the same shared subsystem implementation, so
they are one empty test application with two platform entries, not two
applications.

## Validation

```bash
node --test systems/loomrealm-smoke/test/smoke.test.mjs
```

When the `loom-realm` submodule has been built in place, the same command also
boots this installation through real Main + Hostra hosting
(`prepareHostraGame` + `runMain`) until the initial Frame completes.

See `result/loomrealm-empty-app.md` for the full scaffold documentation.
