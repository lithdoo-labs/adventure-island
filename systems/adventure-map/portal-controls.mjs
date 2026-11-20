import { movementIntentFromHeld, movementIntentFromHeldForState } from "./movement-intent.mjs";

/**
 * Up press from controls.event. common-controls delivers controls.state (with up
 * already in held) before controls.event down/up; only repeat suppresses edge.
 */
export function controlsUpEdgeFromEvent(event) {
  if (!event || event.action !== "down") return false;
  if (event.button !== "up") return false;
  if (event.repeat === true) return false;
  return true;
}

export { movementIntentFromHeldForState };

/**
 * Movement intent without treating Up as jump when portal edge consumed this tick.
 * @param {ReadonlyArray<string>} held
 * @param {boolean} portalConsumedUp
 */
export function movementIntentAfterPortal(held, portalConsumedUp) {
  const base = movementIntentFromHeld(held);
  if (!portalConsumedUp) return base;
  return Object.freeze({
    ...base,
    jump: false,
  });
}