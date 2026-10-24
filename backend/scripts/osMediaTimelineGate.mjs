import assert from "node:assert/strict";
import {
  createMediaTimeline,
  appendMediaClip,
  moveMediaClip,
  editMediaClip,
  removeMediaClip,
  calculateMediaDuration,
  parseMediaTimeline
} from "../../frontend/components/mediaStudioModel.js";

for (const kind of ["video", "audio"]) {
  const initial = createMediaTimeline(kind, `Test ${kind}`);
  assert.equal(initial.kind, `hydria-${kind}-timeline`);
  assert.deepEqual(initial.clips, []);
  const added = appendMediaClip(initial, { title: "Intro", durationSeconds: 4, script: "Bonjour" });
  assert.equal(added.clips.length, 1);
  assert.equal(initial.clips.length, 0, "Mutations must not change the existing persisted model");
  const withSecond = appendMediaClip(added, { title: "Final", durationSeconds: 6 });
  assert.equal(calculateMediaDuration(withSecond), 10);
  const moved = moveMediaClip(withSecond, withSecond.clips[1].id, -1);
  assert.equal(moved.clips[0].title, "Final");
  const edited = editMediaClip(moved, moved.clips[0].id, { title: "Fin", durationSeconds: 2.5 });
  assert.equal(edited.clips[0].title, "Fin");
  assert.equal(calculateMediaDuration(edited), 6.5);
  const removed = removeMediaClip(edited, edited.clips[0].id);
  assert.equal(removed.clips.length, 1);
  assert.throws(() => appendMediaClip(initial, { durationSeconds: -1 }), /duration/i);
  assert.throws(() => editMediaClip(added, added.clips[0].id, { durationSeconds: Number.POSITIVE_INFINITY }), /duration/i);
  assert.throws(() => appendMediaClip(initial, { title: "x".repeat(500) }), /title/i);
  assert.equal(moveMediaClip(added, added.clips[0].id, -1), added, "Out-of-bounds moves are no-ops");
  assert.equal(parseMediaTimeline(JSON.stringify({ ...initial, clips: [null] })), null,
    "Malformed saved clips must not crash the studio");
  assert.equal(parseMediaTimeline(JSON.stringify({ ...initial, clips: [{ id: "x", title: "bad", durationSeconds: -6 }] })), null,
    "Negative saved clip durations must be rejected");
}
console.log("Audio/video timeline operations verified.");
