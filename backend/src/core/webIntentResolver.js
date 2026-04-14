import { detectWebNeed } from "../../services/web/webIntentService.js";

export function resolveWebIntent(prompt, apiNeed = null) {
  return detectWebNeed(prompt, apiNeed);
}
