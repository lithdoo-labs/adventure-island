// Minimal no-op LoomRealm Subsystem for the empty adventure-island application.
//
// LoomRealm's Subsystem module ABI (pinned submodule c5217e47,
// packages/subsystem/src/model.ts) requires a default-exported
// `SubsystemDefinitionFactory`: a function of one SubsystemScope that returns a
// definition with a `frame(frame)` handler returning a FrameOutcome. The pinned
// Hostra e2e test (packages/game-launcher-hostra/test/e2e.test.mjs) launches
// exactly such dependency-free modules, and the PWA executable graph rules
// (packages/game-launcher-pwa/src/index.ts, buildPwaExecutableIndexV1) require
// published executable modules to import only relative modules that stay
// inside the installation, i.e. no bare `@loomrealm/*` imports and no `../..`
// escape from the logical root.
//
// This module therefore stays dependency-free and importable from a bare
// checkout without building the submodule, while keeping the exact ABI shape.
// It is itself a valid PWA executable (its import graph is empty), so PWA
// publication can use this file's source directly as the executable for the
// logical module `subsystems/smoke.mjs`, the same way examples/PokeMan
// publishes bundled dependency-free artifacts instead of its source files.

/** Subsystem key this module is bound to by apps/pwa and apps/hostra. */
export const SMOKE_SUBSYSTEM_KEY = "smoke";

/** Deterministic Frame value reported by every completed smoke Frame. */
export const SMOKE_FRAME_VALUE = Object.freeze({
  status: "ok",
  subsystem: SMOKE_SUBSYSTEM_KEY,
});

/** Same frozen shape as `completed()` from @loomrealm/subsystem. */
function completed(value) {
  return Object.freeze({ type: "completed", value });
}

/**
 * The no-op smoke Subsystem. It uses no scope capability, holds no state, and
 * completes every Frame with `SMOKE_FRAME_VALUE`, proving the Game Package can
 * boot through a real Subsystem without any gameplay.
 */
export default function defineSmokeSubsystem() {
  return {
    frame() {
      return completed(SMOKE_FRAME_VALUE);
    },
  };
}
