export function normalizeGenericResult(api, raw, context = {}) {
  return {
    sourceType: "api",
    sourceName: api.name,
    capability: context.capability || api.capabilities[0],
    raw,
    normalized: raw,
    summaryText: `${api.name} responded successfully.`
  };
}

