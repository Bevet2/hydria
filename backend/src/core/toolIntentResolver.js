import { detectTooling } from "../../services/tools/toolRouter.js";

export function resolveToolIntent(prompt, classification, attachments = []) {
  return detectTooling(prompt, classification, attachments);
}
