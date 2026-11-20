/** Controls held state → deterministic movement intent (no DOM). */

/**
 * @param {ReadonlyArray<string>} held button ids currently down
 */
function verticalHeld(buttons) {
  const up = buttons.has("up");
  const down = buttons.has("down");
  return Object.freeze({ up, down });
}

/** Held state before controls.event — Up must not pre-latch jump (portal uses event). */
export function movementIntentFromHeldForState(held = []) {
  const buttons = new Set(Array.isArray(held) ? held : []);
  const left = buttons.has("left");
  const right = buttons.has("right");
  const jump = buttons.has("jump") || buttons.has("south");
  const { up, down } = verticalHeld(buttons);
  let facing = null;
  if (left !== right) facing = left ? "left" : "right";
  return Object.freeze({ left, right, jump, up, down, facing });
}

export function movementIntentFromHeld(held = []) {
  const buttons = new Set(Array.isArray(held) ? held : []);
  const left = buttons.has("left");
  const right = buttons.has("right");
  const jump = buttons.has("up") || buttons.has("jump") || buttons.has("south");
  const { up, down } = verticalHeld(buttons);
  let facing = null;
  if (left !== right) facing = left ? "left" : "right";
  return Object.freeze({ left, right, jump, up, down, facing });
}
