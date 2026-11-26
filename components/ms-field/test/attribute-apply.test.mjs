import assert from "node:assert/strict";
import test from "node:test";
import { MsMapBatch } from "../src/elements.mjs";

test("an unchanged field attribute does not schedule another apply", () => {
  const element = new MsMapBatch();
  let scheduled = 0;
  element._scheduleApply = () => {
    scheduled += 1;
  };
  element.attributeChangedCallback("stack-rank", null, "2");
  assert.equal(element._attrsSeen, true);
  assert.equal(scheduled, 1);
  element.attributeChangedCallback("stack-rank", "2", "2");
  element.attributeChangedCallback("visible", "true", "true");
  assert.equal(scheduled, 1);
  element.attributeChangedCallback("visible", "true", "false");
  assert.equal(scheduled, 2);
});
