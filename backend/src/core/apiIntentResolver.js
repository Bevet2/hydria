import { detectApiNeed } from "../../services/apis/apiRouter.js";

export function resolveApiIntent(prompt, options = {}) {
  return detectApiNeed(prompt, options);
}
