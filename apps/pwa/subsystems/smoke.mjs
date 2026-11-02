// PWA installation-root binding for the shared no-op smoke Subsystem.
//
// The logical module bound by launch.pwa.json must live inside the PWA
// installation root (apps/pwa), while the shared implementation stays in
// systems/loomrealm-smoke/ so both platform entries represent the same empty
// application. Hostra-side and repo-local Node consumers import this file
// directly and the relative specifier below resolves inside the repository
// checkout.
//
// PWA publication note: the PWA executable graph
// (packages/game-launcher-pwa/src/index.ts, buildPwaExecutableIndexV1) only
// accepts imports that stay inside the installation's logical root, so this
// shim's own source is NOT what gets published. The executable published for
// the logical module `subsystems/smoke.mjs` is the dependency-free shared
// implementation (empty import graph) — the same way examples/PokeMan
// publishes bundled dependency-free artifacts instead of its source
// subsystems. systems/loomrealm-smoke/test/smoke.test.mjs pins this contract.
export * from "../../../systems/loomrealm-smoke/subsystem.mjs";
export { default } from "../../../systems/loomrealm-smoke/subsystem.mjs";
