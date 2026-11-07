// Root Hostra installation binding for the canonical Adventure Map Subsystem.
//
// Hostra and Node import this file directly. PWA publication does not ship
// this shim: the bundle builder emits a self-contained executable for the
// logical module subsystems/adventure-map.mjs.
export { default } from "../systems/adventure-map/subsystem.mjs";
