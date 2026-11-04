// Repository-root installation binding for the shared no-op smoke Subsystem.
//
// The logical module bound by the root launch.pwa.json / launch.hostra.json
// must resolve to a regular .mjs file inside the canonical installation root
// (the repository root), while the shared implementation stays in
// systems/loomrealm-smoke/ so the root, apps/pwa, and apps/hostra entries all
// represent the same empty application without duplicating the Smoke
// implementation. Hostra-side and repo-local Node consumers import this file
// directly and the relative specifier below resolves inside the repository
// checkout.
//
// PWA publication note: the PWA executable graph
// (packages/game-launcher-pwa/src/index.ts, buildPwaExecutableIndexV1) only
// accepts relative imports that stay inside the installation's logical root
// and resolves the whole graph from the published executable set alone. This
// shim re-exports ../systems/loomrealm-smoke/subsystem.mjs, which the launch
// manifests do not declare as a logical module, so this shim's source is NOT
// what gets published: publishing it alone is rejected by the pinned walker
// (and the apps/* shims' deeper ../../.. escapes are rejected outright as
// SUBSYSTEM_MODULE_OUTSIDE_INSTALLATION). The executable published for the
// logical module `subsystems/smoke.mjs` must be the dependency-free shared
// implementation (empty import graph) or a future built self-contained
// bundle — the same way examples/PokeMan publishes bundled dependency-free
// artifacts instead of its source subsystems. test/game-entry.test.mjs pins
// this contract. See docs/game-entry.md for the responsibility split.
export * from "../systems/loomrealm-smoke/subsystem.mjs";
export { default } from "../systems/loomrealm-smoke/subsystem.mjs";
