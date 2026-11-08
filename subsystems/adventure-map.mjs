/**
 * Root installation binding for the `adventure-map` Subsystem (Hostra / Node
 * consumers). A thin re-export shim only: the single business implementation
 * lives in systems/adventure-map/subsystem.mjs.
 *
 * PWA publication contract (test/game-entry.test.mjs): this shim source is
 * never published as the PWA executable — the builder publishes the
 * esbuild-bundled self-contained implementation built from
 * systems/adventure-map/subsystem.mjs under the logical module
 * `subsystems/adventure-map.mjs`.
 */
export * from "../systems/adventure-map/subsystem.mjs";
export { default } from "../systems/adventure-map/subsystem.mjs";
