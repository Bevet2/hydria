import { listEnabledApis } from "../apis/apiCatalogService.js";

const pricingRank = {
  free: 0,
  freemium: 1,
  paid: 2
};

export function isApiConfigured(api) {
  if (!api || api.authType === "none") {
    return true;
  }

  if (!api.envKey) {
    return false;
  }

  return Boolean(process.env[api.envKey]);
}

function rankApi(left, right) {
  const leftConfigured = isApiConfigured(left) ? 0 : 1;
  const rightConfigured = isApiConfigured(right) ? 0 : 1;

  if (leftConfigured !== rightConfigured) {
    return leftConfigured - rightConfigured;
  }

  const leftPrice = pricingRank[left.pricing] ?? 9;
  const rightPrice = pricingRank[right.pricing] ?? 9;

  if (leftPrice !== rightPrice) {
    return leftPrice - rightPrice;
  }

  return (left.priority || 99) - (right.priority || 99);
}

export function getApisByCapability(capability, { category } = {}) {
  return listEnabledApis()
    .filter((api) => api.capabilities.includes(capability))
    .filter((api) => (category ? api.category === category : true))
    .sort(rankApi);
}

export function getPublicApiRegistry() {
  return listEnabledApis()
    .sort(rankApi)
    .map((api) => ({
      id: api.id,
      name: api.name,
      category: api.category,
      description: api.description,
      pricing: api.pricing,
      capabilities: api.capabilities,
      priority: api.priority,
      enabled: api.enabled !== false,
      configured: isApiConfigured(api),
      authType: api.authType
    }));
}

