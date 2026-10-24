// Pure transformations of the saved Hydria audio/video edit decision list.
// Media assets and rendered files are separate deliverables: this model stores
// timings, narration and editorial intent, not a fabricated MP4/audio result.
const MAX_CLIPS = 500;
const MAX_DURATION_SECONDS = 6 * 60 * 60;
const MAX_TEXT = 4000;

function clipText(value, field, max = MAX_TEXT) {
  if (typeof value !== "string" || value.length > max) {
    throw new RangeError(`${field} must be text of at most ${max} characters`);
  }
  return value;
}

function clipDuration(value) {
  const duration = Number(value);
  if (!Number.isFinite(duration) || duration < 0.1 || duration > MAX_DURATION_SECONDS) {
    throw new RangeError("Clip duration must be between 0.1 seconds and six hours");
  }
  return Math.round(duration * 100) / 100;
}

function assertTimeline(model) {
  if (!model || !["hydria-audio-timeline", "hydria-video-timeline"].includes(model.kind) ||
      !Array.isArray(model.clips) || model.clips.length > MAX_CLIPS ||
      !model.clips.every((clip) => clip && typeof clip.id === "string" && clip.id.length > 0 &&
        typeof clip.title === "string" && clip.title.length <= 120 &&
        Number.isFinite(Number(clip.durationSeconds)) &&
        Number(clip.durationSeconds) >= 0.1 && Number(clip.durationSeconds) <= MAX_DURATION_SECONDS &&
        ["script", "visual", "voiceover"].every((field) =>
          clip[field] == null || (typeof clip[field] === "string" && clip[field].length <= MAX_TEXT)))) {
    throw new TypeError("Invalid Hydria media timeline");
  }
  return model;
}

export function createMediaTimeline(kind = "video", title = "Nouveau projet") {
  if (!["video", "audio"].includes(kind)) throw new TypeError("Unknown media timeline kind");
  return { kind: `hydria-${kind}-timeline`, version: 1, title: String(title).slice(0, 200), clips: [] };
}

export function parseMediaTimeline(content = "") {
  try {
    return assertTimeline(JSON.parse(content));
  } catch {
    return null;
  }
}

export function appendMediaClip(model, input = {}) {
  assertTimeline(model);
  if (model.clips.length >= MAX_CLIPS) throw new RangeError("Timeline clip limit reached");
  const clip = {
    id: globalThis.crypto.randomUUID(),
    title: clipText(input.title ?? "Nouveau segment", "Clip title", 120),
    durationSeconds: clipDuration(input.durationSeconds ?? 5),
    script: clipText(input.script ?? "", "Script"),
    visual: clipText(input.visual ?? "", "Visual direction"),
    voiceover: clipText(input.voiceover ?? "", "Voiceover")
  };
  return { ...model, clips: [...model.clips, clip] };
}

export function editMediaClip(model, clipId, patch = {}) {
  assertTimeline(model);
  const index = model.clips.findIndex((clip) => clip.id === clipId);
  if (index < 0) return model;
  const next = { ...model.clips[index] };
  for (const field of ["title", "script", "visual", "voiceover"]) {
    if (Object.hasOwn(patch, field)) next[field] = clipText(patch[field], field, field === "title" ? 120 : MAX_TEXT);
  }
  if (Object.hasOwn(patch, "durationSeconds")) next.durationSeconds = clipDuration(patch.durationSeconds);
  return { ...model, clips: model.clips.map((clip, i) => i === index ? next : clip) };
}

export function moveMediaClip(model, clipId, direction = 0) {
  assertTimeline(model);
  const index = model.clips.findIndex((clip) => clip.id === clipId);
  const nextIndex = index + Number(direction);
  if (index < 0 || !Number.isInteger(nextIndex) || nextIndex < 0 || nextIndex >= model.clips.length) return model;
  const clips = [...model.clips];
  [clips[index], clips[nextIndex]] = [clips[nextIndex], clips[index]];
  return { ...model, clips };
}

export function removeMediaClip(model, clipId) {
  assertTimeline(model);
  if (!model.clips.some((clip) => clip.id === clipId)) return model;
  return { ...model, clips: model.clips.filter((clip) => clip.id !== clipId) };
}

export function calculateMediaDuration(model) {
  assertTimeline(model);
  return Math.round(model.clips.reduce((total, clip) => total + Number(clip.durationSeconds || 0), 0) * 100) / 100;
}
