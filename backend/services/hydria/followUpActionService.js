function cleanText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function uniqueActions(actions = []) {
  const seen = new Set();
  return actions.filter((action) => {
    const key = `${action.kind}:${action.id}:${action.resolvedPrompt || action.templatePrompt || ""}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function buildDirectAction({
  id,
  domain,
  label,
  resolvedPrompt,
  assistantCueFr,
  assistantCueEn,
  meta = {}
}) {
  if (!resolvedPrompt) {
    return null;
  }

  return {
    id,
    kind: "direct_prompt",
    domain,
    label,
    resolvedPrompt,
    assistantCue: {
      fr: assistantCueFr || "",
      en: assistantCueEn || ""
    },
    ...meta
  };
}

function buildSlotAction({
  id,
  domain,
  label,
  slot,
  slotType,
  templatePrompt,
  inputHint,
  exampleValues = []
}) {
  if (!slot || !templatePrompt) {
    return null;
  }

  return {
    id,
    kind: "slot_fill",
    domain,
    label,
    slot,
    slotType: slotType || slot,
    templatePrompt,
    inputHint: inputHint || "",
    exampleValues
  };
}

function buildWeatherLocationAction(plan) {
  if (plan?.apiNeed?.category !== "weather" || plan.apiNeed.location) {
    return null;
  }

  return buildSlotAction({
    id: "weather_location_needed",
    domain: "weather",
    label: "Provide a city for weather",
    slot: "location",
    slotType: "location",
    templatePrompt: "meteo {{location}}",
    inputHint: "city",
    exampleValues: ["Paris", "Lyon", "Marseille"]
  });
}

function buildFinanceSymbolAction(plan) {
  if (plan?.apiNeed?.category !== "finance" || plan.apiNeed.symbol) {
    return null;
  }

  return buildSlotAction({
    id: "finance_symbol_needed",
    domain: "finance",
    label: "Provide a ticker symbol",
    slot: "symbol",
    slotType: "symbol",
    templatePrompt: "cours de l action {{symbol}}",
    inputHint: "ticker",
    exampleValues: ["AAPL", "TSLA", "MSFT"]
  });
}

function buildWeatherForecastAction(apiResults = [], plan = null) {
  if (plan?.apiNeed?.category === "weather" && plan.apiNeed.capability === "forecast") {
    return null;
  }

  const weatherResult = apiResults.find(
    (result) => result.capability === "current_weather" && result.normalized?.location
  );

  if (!weatherResult) {
    return null;
  }

  const location = cleanText(weatherResult.normalized.location.split(",")[0]);
  if (!location) {
    return null;
  }

  return buildDirectAction({
    id: "weather_forecast_offer",
    domain: "weather",
    label: `Get forecast for ${location}`,
    resolvedPrompt: `prevision meteo ${location}`,
    assistantCueFr:
      "Si vous voulez, je peux aussi donner la prevision detaillee sur les prochaines heures ou les prochains jours.",
    assistantCueEn:
      "If you want, I can also provide a more detailed forecast for the next hours or days.",
    meta: {
      sourceLocation: weatherResult.normalized.location
    }
  });
}

function buildWeatherLocationSwitchAction(apiResults = []) {
  const weatherResult = apiResults.find(
    (result) =>
      result.normalized?.location &&
      (result.domain === "weather" ||
        String(result.sourceName || "").toLowerCase().includes("weather"))
  );

  if (!weatherResult) {
    return null;
  }

  return buildSlotAction({
    id: "weather_location_switch",
    domain: "weather",
    label: "Switch to another city",
    slot: "location",
    slotType: "location",
    templatePrompt: "meteo {{location}}",
    inputHint: "city",
    exampleValues: ["Lyon", "Marseille", "Toulouse"]
  });
}

function buildMarketAnalysisAction(apiResults = [], plan = null) {
  const marketResult = apiResults.find((result) =>
    ["price_lookup", "quote"].includes(result.capability)
  );

  if (!marketResult) {
    return null;
  }

  const alreadyAnalytical =
    plan?.classification === "hybrid_task" || plan?.classification === "complex_reasoning";

  if (alreadyAnalytical) {
    return null;
  }

  if (marketResult.capability === "price_lookup" && marketResult.normalized?.asset) {
    const asset = cleanText(marketResult.normalized.asset);
    return buildDirectAction({
      id: "market_analysis_offer",
      domain: "market",
      label: `Analyze ${asset}`,
      resolvedPrompt: `analyse rapide du prix de ${asset}`,
      assistantCueFr:
        "Si vous voulez, je peux aussi faire une lecture rapide de ce chiffre et des points de contexte.",
      assistantCueEn:
        "If you want, I can also provide a quick reading of this figure and the surrounding context."
    });
  }

  if (marketResult.capability === "quote" && marketResult.normalized?.symbol) {
    const symbol = cleanText(marketResult.normalized.symbol);
    return buildDirectAction({
      id: "market_analysis_offer",
      domain: "market",
      label: `Analyze ${symbol}`,
      resolvedPrompt: `analyse rapide de l action ${symbol}`,
      assistantCueFr:
        "Si vous voulez, je peux aussi faire une lecture rapide de ce cours et des points de contexte.",
      assistantCueEn:
        "If you want, I can also provide a quick reading of this quote and the surrounding context."
    });
  }

  return null;
}

function buildCryptoAssetSwitchAction(apiResults = []) {
  const marketResult = apiResults.find((result) => result.capability === "price_lookup");

  if (!marketResult) {
    return null;
  }

  return buildSlotAction({
    id: "crypto_asset_switch",
    domain: "crypto",
    label: "Switch to another asset",
    slot: "symbol",
    slotType: "symbol",
    templatePrompt: "prix de {{symbol}}",
    inputHint: "asset",
    exampleValues: ["BTC", "ETH", "SOL"]
  });
}

function buildFinanceSymbolSwitchAction(apiResults = []) {
  const marketResult = apiResults.find((result) => result.capability === "quote");

  if (!marketResult) {
    return null;
  }

  return buildSlotAction({
    id: "finance_symbol_switch",
    domain: "finance",
    label: "Switch to another ticker",
    slot: "symbol",
    slotType: "symbol",
    templatePrompt: "cours de l action {{symbol}}",
    inputHint: "ticker",
    exampleValues: ["AAPL", "TSLA", "MSFT"]
  });
}

function buildTranslationLanguageSwitchAction(plan = null) {
  if (plan?.apiNeed?.category !== "translation" || !plan.apiNeed.text) {
    return null;
  }

  return buildSlotAction({
    id: "translation_language_switch",
    domain: "translation",
    label: "Translate the same text to another language",
    slot: "language",
    slotType: "language",
    templatePrompt: `traduis ${cleanText(plan.apiNeed.text)} en {{language}}`,
    inputHint: "language",
    exampleValues: ["allemand", "anglais", "italien"]
  });
}

function buildNewsSummaryAction(apiResults = [], plan = null) {
  const newsResult = apiResults.find(
    (result) =>
      result.capability === "latest_news" &&
      Array.isArray(result.normalized?.articles) &&
      result.normalized.articles.length
  );

  if (!newsResult) {
    return null;
  }

  const alreadySummarized =
    plan?.classification === "summarize" || plan?.classification === "hybrid_task";
  if (alreadySummarized) {
    return null;
  }

  const topic = cleanText(newsResult.normalized?.topic || "");
  const resolvedPrompt = topic
    ? `resume les actualites sur ${topic}`
    : "resume les actualites recentes";

  return buildDirectAction({
    id: "news_summary_offer",
    domain: "news",
    label: topic ? `Summarize news on ${topic}` : "Summarize the latest news",
    resolvedPrompt,
    assistantCueFr: "Si vous voulez, je peux aussi faire une synthese rapide de ces actualites.",
    assistantCueEn: "If you want, I can also produce a short synthesis of these news items."
  });
}

function buildWebSynthesisAction(webResults = [], plan = null) {
  const webResult = webResults.find(
    (result) =>
      (Array.isArray(result.pages) && result.pages.length) ||
      (Array.isArray(result.searchResults) && result.searchResults.length)
  );

  if (!webResult || !plan?.webNeed?.query) {
    return null;
  }

  const alreadySynthesized =
    plan.classification === "summarize" ||
    plan.classification === "compare" ||
    plan.classification === "complex_reasoning";

  if (alreadySynthesized) {
    return null;
  }

  const query = cleanText(plan.webNeed.query);
  if (!query) {
    return null;
  }

  return buildDirectAction({
    id: "web_synthesis_offer",
    domain: "web",
    label: `Synthesize web results for ${query}`,
    resolvedPrompt: `resume la recherche web sur ${query}`,
    assistantCueFr:
      "Si vous voulez, je peux aussi synthetiser ces resultats web et degager l essentiel.",
    assistantCueEn:
      "If you want, I can also synthesize these web results and extract the essentials."
  });
}

export function buildFollowUpActions({
  plan,
  apiResults = [],
  webResults = []
}) {
  return uniqueActions(
    [
      buildWeatherLocationAction(plan),
      buildFinanceSymbolAction(plan),
      buildWeatherLocationSwitchAction(apiResults),
      buildCryptoAssetSwitchAction(apiResults),
      buildFinanceSymbolSwitchAction(apiResults),
      buildTranslationLanguageSwitchAction(plan),
      buildWeatherForecastAction(apiResults, plan),
      buildMarketAnalysisAction(apiResults, plan),
      buildNewsSummaryAction(apiResults, plan),
      buildWebSynthesisAction(webResults, plan)
    ].filter(Boolean)
  );
}
