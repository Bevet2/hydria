export function normalizeMarketResult(api, raw, context = {}) {
  if (api.id === "finance_stooq") {
    const line = String(raw || "").trim().split(/\r?\n/)[0] || "";
    const [pair, date, time, open, high, low, close, volume] = line.split(",");
    const symbol = String(pair || context.symbol || "")
      .replace(/\.US$/i, "")
      .trim();
    const normalized = {
      symbol: symbol || context.symbol,
      price: Number(close),
      open: Number(open),
      high: Number(high),
      low: Number(low),
      volume: volume ? Number(volume) : null,
      asOfDate: date || null,
      asOfTime: time || null
    };

    return {
      sourceType: "api",
      sourceName: api.name,
      capability: context.capability,
      raw,
      normalized,
      summaryText: `${normalized.symbol} is at ${normalized.price || "n/a"} on ${api.name}${normalized.asOfDate ? ` (${normalized.asOfDate})` : ""}.`
    };
  }

  if (api.id === "crypto_binance") {
    const normalized = {
      asset: context.assetSymbol,
      pair: raw.symbol,
      priceUsd: Number(raw.price)
    };

    return {
      sourceType: "api",
      sourceName: api.name,
      capability: context.capability,
      raw,
      normalized,
      summaryText: `${normalized.asset} is trading around $${normalized.priceUsd.toFixed(2)} on ${api.name}.`
    };
  }

  if (api.id === "crypto_coincap") {
    const data = raw.data || {};
    const normalized = {
      asset: context.assetSymbol,
      pair: data.symbol,
      priceUsd: Number(data.priceUsd)
    };

    return {
      sourceType: "api",
      sourceName: api.name,
      capability: context.capability,
      raw,
      normalized,
      summaryText: `${normalized.asset} is trading around $${normalized.priceUsd.toFixed(2)} on ${api.name}.`
    };
  }

  if (api.id === "finance_alpha_vantage") {
    const quote = raw["Global Quote"] || {};
    const normalized = {
      symbol: quote["01. symbol"] || context.symbol,
      price: Number(quote["05. price"]),
      changePercent: quote["10. change percent"] || null,
      volume: quote["06. volume"] || null
    };

    return {
      sourceType: "api",
      sourceName: api.name,
      capability: context.capability,
      raw,
      normalized,
      summaryText: `${normalized.symbol} is at ${normalized.price || "n/a"} with change ${normalized.changePercent || "n/a"}.`
    };
  }

  return null;
}
