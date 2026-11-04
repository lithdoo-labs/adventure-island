// Hostra installation-root binding for the shared no-op smoke Subsystem.
//
// The logical module bound by launch.hostra.json must resolve to a regular
// .mjs file inside the Hostra installation root (apps/hostra); the shared
// implementation stays in systems/loomrealm-smoke/ so both platform entries
// represent the same empty application. The Hostra runner imports this file
// in Node and the relative specifier below resolves inside the repository
// checkout.
export * from "../../../systems/loomrealm-smoke/subsystem.mjs";
export { default } from "../../../systems/loomrealm-smoke/subsystem.mjs";
