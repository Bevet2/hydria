import { inferArtifactIntent } from "../../services/artifacts/generationIntentService.js";

export function resolveArtifactIntent(prompt, attachments = []) {
  return inferArtifactIntent(prompt, attachments);
}
