/**
 * Base Subsystem — the canonical initial Subsystem of Adventure Island.
 *
 * Base owns exactly one LoomRealm Controls Producer: it creates a single
 * RenderDomain hosting the `game-controls-input` element (registered by the
 * pinned `@loomrealm-game/common-controls` classic browser script), keeps it
 * alive while the child `adventure-map` Frame is active, and closes it in a
 * `finally` when that Frame ends, fails, or is cancelled. The Frame params are
 * forwarded to the child verbatim — Base never assumes the game boots with a
 * `null` input forever.
 *
 * Base deliberately does NOT mount `game-keyboard-input` / `game-gamepad-input`
 * (the raw device channels): the unified controls channel would then receive
 * the same physical press twice.
 *
 * Base never interprets input, never touches the DOM, never manages the actor,
 * and never reads Content — those belong to `adventure-map` and `cms-actor`.
 */
import { defineSubsystem } from "@loomrealm/subsystem";

/** Logical Subsystem key this module implements (game.json / launch.*.json). */
export const BASE_SUBSYSTEM_KEY = "base";

/** Subsystem key of the single child Frame Base activates. */
export const BASE_CHILD_SUBSYSTEM_KEY = "adventure-map";

/** RenderNode key/tag of the single Controls Producer component. */
export const BASE_CONTROLS_INPUT_KEY = "game-controls-input";

/**
 * The input RenderDomain uses `zIndex: 0`, matching the PokeMan Base
 * convention: an invisible capture component needs no extra stacking layer.
 */
export default defineSubsystem((scope) => ({
  async frame(frame) {
    const controls = scope.createRenderDomain({
      zIndex: 0,
      roots: [{
        key: BASE_CONTROLS_INPUT_KEY,
        tag: BASE_CONTROLS_INPUT_KEY,
        attrs: {},
        data: {},
        children: [],
      }],
    });
    try {
      return await frame.call(BASE_CHILD_SUBSYSTEM_KEY, frame.params);
    } finally {
      controls.close();
    }
  },
}));
