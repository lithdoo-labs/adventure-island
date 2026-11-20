import assert from "node:assert/strict";
import test from "node:test";
import { BUSINESS_TICK_MS } from "../movement-sim.mjs";
import { MAX_CATCH_UP_TICKS, planSchedulerDrain, SCHEDULER_PURGE_DIAGNOSTIC } from "../simulation-scheduler.mjs";

test("planSchedulerDrain runs at most eight ticks and discards surplus", () => {
  const first = planSchedulerDrain(BUSINESS_TICK_MS * 20, 0);
  assert.equal(first.ticksToRun, MAX_CATCH_UP_TICKS);
  assert.equal(first.discardedTicks, 12);
  assert.equal(first.diagnostic.code, SCHEDULER_PURGE_DIAGNOSTIC);
  assert.equal(first.diagnostic.discardedTicks, 12);
});

test("partial quantum is retained across drains", () => {
  const plan = planSchedulerDrain(25, 10);
  assert.equal(plan.ticksToRun, 1);
  assert.equal(plan.discardedTicks, 0);
  assert.ok(plan.nextAccumulatorMs > 0 && plan.nextAccumulatorMs < BUSINESS_TICK_MS);
});