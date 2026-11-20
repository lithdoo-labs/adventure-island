/**
 * Wall-clock scheduler: fixed BUSINESS_TICK_MS with per-frame catch-up cap.
 * PRODUCT-DECISION: at most MAX_CATCH_UP_TICKS per drain; excess ticks discarded.
 */
import { BUSINESS_TICK_MS } from "./movement-sim.mjs";

export const MAX_CATCH_UP_TICKS = 8;
export const SCHEDULER_PURGE_DIAGNOSTIC = "SIMULATION_BACKLOG_DISCARDED";

/**
 * @param {number} elapsedMs wall time since last drain
 * @param {number} accumulatorMs leftover partial quantum
 */
export function planSchedulerDrain(elapsedMs, accumulatorMs = 0) {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) throw new TypeError("elapsedMs must be a non-negative finite number");
  if (!Number.isFinite(accumulatorMs) || accumulatorMs < 0) throw new TypeError("accumulatorMs must be non-negative");
  const total = accumulatorMs + elapsedMs;
  const quanta = Math.floor(total / BUSINESS_TICK_MS);
  const nextAccumulator = total - quanta * BUSINESS_TICK_MS;
  const ticksToRun = Math.min(quanta, MAX_CATCH_UP_TICKS);
  const discardedTicks = quanta - ticksToRun;
  return Object.freeze({
    ticksToRun,
    discardedTicks,
    nextAccumulatorMs: nextAccumulator,
    diagnostic: discardedTicks > 0
      ? Object.freeze({ code: SCHEDULER_PURGE_DIAGNOSTIC, discardedTicks })
      : null,
  });
}