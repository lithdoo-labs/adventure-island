import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildCanonicalAdventureAvatarContent } from "../../../scripts/pwa/read-adventure-fsdb.mjs";
import { projectAvatarFromPlan } from "../src/plan-projection.mjs";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

test("plan projection emits ms-avatar with ms-action children", async () => {
  const { plan } = await buildCanonicalAdventureAvatarContent({ gameRoot: repoRoot });
  const avatar = projectAvatarFromPlan(plan, { locomotion: "stand", facing: "right" });
  assert.equal(avatar.tag, "ms-avatar");
  assert.equal(avatar.attrs.action, "stand1");
  assert.deepEqual(Object.keys(avatar.data.appearance).sort(), ["zOrder"]);
  assert.ok(avatar.children.length >= 3);
  assert.ok(avatar.children.every((child) => child.tag === "ms-action"));
  const names = avatar.children.map((child) => child.attrs.name).sort();
  assert.deepEqual(names, ["jump", "stand1", "walk1"]);
});