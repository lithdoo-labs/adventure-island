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
  assert.ok(avatar.children.length >= 4);
  assert.ok(avatar.children.every((child) => child.tag === "ms-action"));
  const names = avatar.children.map((child) => child.attrs.name).sort();
  assert.deepEqual(names, ["fly", "jump", "ladder", "prone", "rope", "stand1", "walk1"]);
  const prone = avatar.children.find((child) => child.attrs.name === "prone");
  assert.equal(prone.data.clip.playback.mode, "loop");
  const rope = avatar.children.find((child) => child.attrs.name === "rope");
  assert.equal(rope.data.clip.playback.mode, "loop");
  assert.deepEqual(rope.data.clip.frames.map((frame) => frame.durationMs), [250, 250]);
  const ladder = avatar.children.find((child) => child.attrs.name === "ladder");
  assert.equal(ladder.data.clip.playback.mode, "loop");
  assert.deepEqual(ladder.data.clip.frames.map((frame) => frame.durationMs), [250, 250]);
  const fly = avatar.children.find((child) => child.attrs.name === "fly");
  assert.equal(fly.data.clip.playback.mode, "loop");
  assert.deepEqual(fly.data.clip.frames.map((frame) => frame.durationMs), [300, 300]);
});
