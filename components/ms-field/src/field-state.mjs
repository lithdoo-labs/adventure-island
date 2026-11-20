/** Field authority seed for M3+; Movement/Camera tick owned by adventure-map Subsystem (M5). */

export const FIELD_MAP_222000000 = "222000000";

export const FIELD_SPAWN_222000000 = Object.freeze({
  worldX: -92,
  worldY: 294,
  layer: 0,
  zM: 0,
  controllerFlag: 0,
});

/**
 * @param {object} [overrides]
 * @returns {Readonly<object>}
 */
export function createStaticFieldState(overrides = {}) {
  const mapId = overrides.mapId ?? FIELD_MAP_222000000;
  const player = Object.freeze({
    nodeKey: "player:adventure",
    facing: "right",
    locomotion: "stand",
    ...FIELD_SPAWN_222000000,
    ...(overrides.player ?? {}),
  });
  return Object.freeze({
    mapId,
    player,
    movement: Object.freeze({
      mode: "stand",
      grounded: true,
      velocityX: 0,
      velocityY: 0,
      contact: null,
      tickIndex: 0,
      simulationTimeMs: 0,
      ...(overrides.movement ?? {}),
    }),
    camera: Object.freeze({
      intent: "viewport-clamp",
      ...(overrides.camera ?? {}),
    }),
    portalTravel: Object.freeze({
      phase: "idle",
      activeToken: 0,
      sceneEpoch: 0,
      crossMap: false,
      ...(overrides.portalTravel ?? {}),
    }),
  });
}