# systems/loomrealm-smoke

The no-op **smoke Subsystem** shared by the empty LoomRealm application
scaffold (`apps/pwa` and `apps/hostra`), plus the headless smoke validation
suite for that scaffold.

## Why this exists

A LoomRealm Game Package must declare at least one Subsystem, and both platform
launch compositions must bind every declared Subsystem to a module inside the
installation root. The smallest valid topology for the empty application is
therefore a single generic no-op Subsystem bound under the key `smoke`. It
contains no CMS-specific behavior and holds no persistent product state: every
Frame completes immediately with the same frozen value.

## Layout

| File | Purpose |
|---|---|
| `subsystem.mjs` | The shared no-op Subsystem (dependency-free, default-exports a `SubsystemDefinitionFactory`). |
| `test/smoke.test.mjs` | Headless smoke validation for the whole scaffold (see below). |

## Subsystem ABI alignment

The module keeps the exact Subsystem module ABI required by the pinned
`loom-realm` submodule (`c5217e47be5a43f974e9e6ce82230077fb639c39`,
`packages/subsystem/src/model.ts`): a default-exported factory returning a
definition whose `frame()` returns a frozen `{ type: "completed", value }`
FrameOutcome. The pinned Hostra e2e test
(`packages/game-launcher-hostra/test/e2e.test.mjs`) launches exactly such
dependency-free modules, and PWA executable graph rules
(`buildPwaExecutableIndexV1`) require published executable modules to import
only relative modules that stay inside the installation — so the module is
authored dependency-free, is itself a valid PWA executable (empty import
graph), and is importable from a bare checkout without building the submodule.
When the submodule has been built, the test suite additionally cross-checks the
module against the real `@loomrealm/subsystem` SDK helpers.

## PWA publication contract

The installation-root shims (`apps/pwa/subsystems/smoke.mjs` and
`apps/hostra/subsystems/smoke.mjs`) re-export this shared implementation so
both platform entries point at one implementation. Hostra and repo-local Node
consumers import the shims directly. PWA publication must publish this file's
source as the executable for the logical module `subsystems/smoke.mjs` (the
shim's own `../../../` specifier escapes the PWA logical root and is rejected
by `buildPwaExecutableIndexV1`); the deep layer of the test suite pins both
sides of this contract. This mirrors `examples/PokeMan`, whose PWA publication
substitutes bundled, dependency-free artifacts for its source subsystem files.

## Running the validation

From the repository root:

```bash
node --test systems/loomrealm-smoke/test/smoke.test.mjs
# or equivalently
npm test --prefix systems/loomrealm-smoke
```

The suite is deterministic and needs no network, browser, server, or client
data. If the `loom-realm` submodule has been built in place
(`npm install && npm run build:packages` inside `loom-realm/`), the same
command additionally validates the scaffold through the real pinned LoomRealm
APIs and boots the empty application through real Main + Hostra hosting.
Without a built submodule those three deep cases report themselves as skipped
with the reason `loom-realm packages are not built` — they are never counted
as passed.
