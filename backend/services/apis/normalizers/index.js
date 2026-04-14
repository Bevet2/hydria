import { normalizeContentResult } from "./contentNormalizer.js";
import { normalizeGenericResult } from "./genericNormalizer.js";
import { normalizeMarketResult } from "./marketNormalizer.js";
import { normalizeWeatherResult } from "./weatherNormalizer.js";

export function normalizeApiResult(api, raw, context = {}) {
  if (api.category === "weather") {
    return normalizeWeatherResult(api, raw, context);
  }

  if (api.category === "crypto" || api.category === "finance") {
    return normalizeMarketResult(api, raw, context) || normalizeGenericResult(api, raw, context);
  }

  return normalizeContentResult(api, raw, context) || normalizeGenericResult(api, raw, context);
}

