// Root Hostra installation binding for the canonical Base Subsystem.
//
// Hostra and Node import this file directly. PWA publication does not ship
// this shim: the bundle builder emits a self-contained executable for the
// logical module subsystems/base.mjs from systems/base/subsystem.mjs.
export { default } from "../systems/base/subsystem.mjs";
