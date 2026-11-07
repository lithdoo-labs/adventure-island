/**
 * Root installation binding for the `base` Subsystem (Hostra / Node
 * consumers). A thin re-export shim only: the single business implementation
 * lives in systems/base/subsystem.mjs.
 *
 * PWA publication contract (test/game-entry.test.mjs): this shim source is
 * never published as the PWA executable — the builder publishes the
 * esbuild-bundled self-contained implementation built from
 * systems/base/subsystem.mjs under the logical module `subsystems/base.mjs`.
 */
export * from "../systems/base/subsystem.mjs";
export { default } from "../systems/base/subsystem.mjs";
