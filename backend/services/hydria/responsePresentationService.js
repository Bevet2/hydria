function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function detectLanguage(prompt = "", preferencesUsed = {}, routingResolution = {}) {
  const preferredLanguage = normalizeText(
    preferencesUsed.preferred_language || preferencesUsed.language || ""
  );

  if (/fr|francais/.test(preferredLanguage)) {
    return "fr";
  }

  if (/en|english|anglais/.test(preferredLanguage)) {
    return "en";
  }

  const combinedPrompt = `${routingResolution.previousPrompt || ""} ${prompt}`.trim();

  return /\b(le|la|les|des|une|un|pour|avec|sans|bonjour|salut|merci|quel|temps|meteo|aujourd'hui|prix|compare|resume|cours|action|traduis|traduction|idee|idees|projet|alors|et|fais)\b/.test(
    normalizeText(combinedPrompt)
  )
    ? "fr"
    : "en";
}

function wantsBullets(preferencesUsed = {}, prompt = "") {
  const preference = normalizeText(preferencesUsed.response_format || "");
  const normalizedPrompt = normalizeText(prompt);
  return /bullet|liste|list|points/.test(preference) || /\b(liste|points|bullet)\b/.test(normalizedPrompt);
}

const webStopwords = new Set([
  "about",
  "avec",
  "avoir",
  "best",
  "build",
  "building",
  "dans",
  "data",
  "dans",
  "des",
  "elle",
  "elles",
  "entre",
  "font",
  "from",
  "have",
  "here",
  "into",
  "leurs",
  "more",
  "most",
  "nous",
  "pour",
  "plus",
  "this",
  "that",
  "their",
  "these",
  "they",
  "them",
  "using",
  "with",
  "your",
  "what",
  "when",
  "which",
  "where",
  "while",
  "comment",
  "entre",
  "quel",
  "quelle",
  "quelles",
  "quels",
  "cette",
  "cet",
  "ceux",
  "cela",
  "comme",
  "pourquoi",
  "resume",
  "search",
  "local",
  "agent",
  "agents",
  "multi",
  "multiagent",
  "orchestration",
  "best",
  "practices"
]);

function truncate(value = "", maxChars = 220) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxChars) {
    return text;
  }

  return `${text.slice(0, maxChars - 3)}...`;
}

function cleanWebText(value = "") {
  return String(value || "")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/https?:\/\/[^\s)]+/g, " ")
    .replace(/[#>*_`|]+/g, " ")
    .replace(/\b(table of contents|open side menu|skip to content|brand logo|image \d+|open menu)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeKeywords(value = "") {
  return normalizeText(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4)
    .filter((token) => !webStopwords.has(token));
}

function buildSourceTitleLine(items = [], language = "fr") {
  const titles = [...new Set(items.map((item) => cleanWebText(item.title || "")).filter(Boolean))]
    .slice(0, 3)
    .map((title) => truncate(title, 72));

  if (!titles.length) {
    return "";
  }

  return language === "fr"
    ? `Pages retenues : ${titles.join(" | ")}.`
    : `Selected pages: ${titles.join(" | ")}.`;
}

function splitWebSegments(text = "") {
  return cleanWebText(text)
    .split(/\n+|(?<=[.!?])\s+/)
    .map((segment) => cleanWebText(segment))
    .filter(Boolean);
}

function scoreWebSegment(segment = "", promptTokens = []) {
  const normalized = normalizeText(segment);
  const tokens = new Set(tokenizeKeywords(segment));
  let score = 0;

  for (const token of promptTokens) {
    if (tokens.has(token)) {
      score += 4;
    }
  }

  if (/(should|must|important|avoid|pattern|state|handoff|workflow|recommend|coordination|monitor|fault|reliab|observab|memory|routing|synthes)/i.test(normalized)) {
    score += 3;
  }

  if (segment.length >= 70 && segment.length <= 190) {
    score += 2;
  }

  if (!/[a-z0-9]{4}/i.test(segment)) {
    score -= 4;
  }

  return score;
}

function buildWebTakeaways(primary = {}, context = {}, language = "fr") {
  const promptTokens = tokenizeKeywords(
    context.plan?.webNeed?.query || context.prompt || ""
  );
  const segments = [];

  for (const page of primary.pages || []) {
    for (const segment of splitWebSegments(page.text || page.excerpt || "")) {
      if (segment.length < 60) {
        continue;
      }

      segments.push({
        text: truncate(segment, 190),
        sourceTitle: cleanWebText(page.title || primary.sourceName || "page"),
        score: scoreWebSegment(segment, promptTokens)
      });
    }
  }

  for (const result of primary.searchResults || []) {
    const snippet = cleanWebText(result.snippet || "");
    if (!snippet || snippet.length < 50) {
      continue;
    }

    segments.push({
      text: truncate(snippet, 180),
      sourceTitle: cleanWebText(result.title || primary.sourceName || "result"),
      score: scoreWebSegment(snippet, promptTokens)
    });
  }

  const ranked = segments
    .sort((left, right) => right.score - left.score)
    .filter((segment, index, all) =>
      all.findIndex((item) => normalizeText(item.text) === normalizeText(segment.text)) === index
    );

  const selected = [];
  const seenSources = new Set();

  for (const segment of ranked) {
    if (selected.length >= 3) {
      break;
    }

    if (!seenSources.has(segment.sourceTitle) || selected.length < 2) {
      selected.push(segment);
      seenSources.add(segment.sourceTitle);
    }
  }

  if (!selected.length) {
    return "";
  }

  const intro =
    language === "fr"
      ? "J'ai consolide les points qui reviennent le plus :"
      : "I consolidated the points that come up most often:";
  const lines = selected.map((segment) => `- ${segment.text}`);
  const sourceLine = buildSourceTitleLine(
    selected.map((segment) => ({ title: segment.sourceTitle })),
    language
  );

  return [intro, ...lines, sourceLine].filter(Boolean).join("\n");
}

function extractCompareOptions(prompt = "") {
  const firstLine = String(prompt || "").split(/\n+/)[0] || "";
  const compareMatch = cleanWebText(firstLine).match(
    /(?:compare|comparaison entre)\s+(.+?)(?:\b(?:for|pour|donne|recommande|which|quel)\b|[.?!]|$)/i
  );
  const rawSpan = compareMatch?.[1] || "";

  if (!rawSpan) {
    return [];
  }

  return rawSpan
    .split(/\s*(?:,|\/|\bvs\.?\b|\bversus\b|\bet\b|\band\b)\s*/i)
    .map((part) =>
      cleanWebText(part)
        .replace(/\b(ce choix|this choice|un mvp saas|mvp saas|mvp|saas)\b/gi, "")
        .trim()
    )
    .filter((part) => part.length >= 2)
    .slice(0, 4);
}

function detectCompareFocus(prompt = "") {
  const normalized = normalizeText(prompt);

  if (/\b(vitesse|rapidite|speed|faster|fastest|time to market|productiv|vite|rapid)\b/.test(normalized)) {
    return "speed";
  }

  if (/\b(performance|perf|bundle|latence|latency|compile|compiled)\b/.test(normalized)) {
    return "performance";
  }

  if (/\b(pourquoi|why)\b/.test(normalized)) {
    return "why";
  }

  if (/\b(mvp|saas|mainten|maintenance|recrut|hiring|ecosystem|ecosysteme|community|scal)\b/.test(normalized)) {
    return "mvp";
  }

  return "default";
}

function collectCompareSegments(primary = {}) {
  const segments = [];

  for (const page of primary.pages || []) {
    for (const segment of splitWebSegments(page.text || page.excerpt || "")) {
      if (segment.length >= 60) {
        segments.push(segment);
      }
    }
  }

  for (const result of primary.searchResults || []) {
    const snippet = cleanWebText(result.snippet || "");
    if (snippet.length >= 50) {
      segments.push(snippet);
    }
  }

  return segments;
}

function extractOptionWindows(segment = "", option = "") {
  const normalizedSegment = normalizeText(segment);
  const optionKey = normalizeText(option);
  const windows = [];
  let startIndex = normalizedSegment.indexOf(optionKey);

  while (startIndex >= 0) {
    const start = Math.max(0, startIndex - 90);
    const end = Math.min(segment.length, startIndex + option.length + 130);
    windows.push(segment.slice(start, end));
    startIndex = normalizedSegment.indexOf(optionKey, startIndex + optionKey.length);
  }

  return windows.length ? windows : [segment];
}

function analyzeCompareOption(option = "", segments = [], focus = "default") {
  const evidence = [];

  for (const segment of segments) {
    if (!normalizeText(segment).includes(normalizeText(option))) {
      continue;
    }

    for (const windowText of extractOptionWindows(segment, option)) {
      const normalized = normalizeText(windowText);
      let score = 1;
      const traits = [];

      if (/(easy|simple|simpler|rapid|fast|faster|productiv|learning curve|facile|rapide|vite|courbe d'apprentissage)/i.test(normalized)) {
        score += focus === "speed" ? 4 : 2;
        traits.push("ease");
      }

      if (/(ecosystem|community|libraries|adoption|mature|popular|recruit|hiring|large|widely used|production|eprouve|eprouvee)/i.test(normalized)) {
        score += ["mvp", "why", "default"].includes(focus) ? 4 : 2;
        traits.push("ecosystem");
      }

      if (/(performance|performant|compiled|compile|bundle|lightweight|virtual dom|dom virtuel)/i.test(normalized)) {
        score += focus === "performance" ? 4 : 2;
        traits.push("performance");
      }

      if (/(boilerplate|configuration|configurer|choices|choice overload|fragmented|complex|complexe|hooks|setup|overhead)/i.test(normalized)) {
        score -= focus === "speed" ? 4 : 2;
        traits.push("friction");
      }

      if (/(limited ecosystem|smaller ecosystem|smaller community|less mature|jeune|restreint|moins mature)/i.test(normalized)) {
        score -= 2;
        traits.push("risk");
      }

      evidence.push({
        text: truncate(windowText, 170),
        score,
        traits
      });
    }
  }

  const rankedEvidence = evidence
    .sort((left, right) => right.score - left.score)
    .slice(0, 2);
  const totalScore = rankedEvidence.reduce((sum, item) => sum + item.score, 0);
  const traits = [...new Set(rankedEvidence.flatMap((item) => item.traits))];

  return {
    option,
    score: totalScore,
    traits,
    evidence: rankedEvidence
  };
}

function buildCompareOptionLine(analysis, language = "fr") {
  const parts = [];

  if (analysis.traits.includes("ease")) {
    parts.push(language === "fr" ? "bonne vitesse de prise en main" : "fast to start with");
  }

  if (analysis.traits.includes("ecosystem")) {
    parts.push(language === "fr" ? "ecosysteme plus mature" : "more mature ecosystem");
  }

  if (analysis.traits.includes("performance")) {
    parts.push(language === "fr" ? "profil performance solide" : "strong performance profile");
  }

  if (analysis.traits.includes("friction")) {
    parts.push(language === "fr" ? "plus de friction de setup" : "more setup friction");
  }

  if (analysis.traits.includes("risk")) {
    parts.push(language === "fr" ? "ecosysteme plus limite" : "more limited ecosystem");
  }

  const summary = parts.length
    ? parts.join(", ")
    : analysis.evidence[0]?.text || (language === "fr" ? "preuves web disponibles mais diffuses" : "web evidence is available but diffuse");

  return `- ${analysis.option}: ${summary}`;
}

function scoreCompareRecommendation(analysis, focus = "default") {
  const traits = new Set(analysis.traits);

  if (focus === "speed") {
    return (
      (traits.has("ease") ? 8 : 0) +
      (traits.has("performance") ? 2 : 0) +
      (traits.has("ecosystem") ? 1 : 0) -
      (traits.has("friction") ? 6 : 0) -
      (traits.has("risk") ? 2 : 0)
    );
  }

  if (focus === "performance") {
    return (
      (traits.has("performance") ? 8 : 0) +
      (traits.has("ease") ? 2 : 0) +
      (traits.has("ecosystem") ? 1 : 0) -
      (traits.has("risk") ? 2 : 0)
    );
  }

  return (
    (traits.has("ecosystem") ? 6 : 0) +
    (traits.has("ease") ? 3 : 0) +
    (traits.has("performance") ? 2 : 0) -
    (traits.has("friction") ? 2 : 0) -
    (traits.has("risk") ? 2 : 0)
  );
}

function buildCompareCriteriaLine(focus = "default", language = "fr") {
  if (focus === "speed") {
    return language === "fr"
      ? "Critere cle: privilegie la prise en main, le faible boilerplate et la rapidite de prototypage."
      : "Key criterion: prioritize onboarding speed, low boilerplate, and fast prototyping.";
  }

  if (focus === "performance") {
    return language === "fr"
      ? "Critere cle: privilegie le runtime, la taille du bundle et le cout de rendu."
      : "Key criterion: prioritize runtime efficiency, bundle size, and rendering cost.";
  }

  return language === "fr"
    ? "Critere cle: privilegie l'equilibre entre ecosysteme, vitesse de livraison et risque long terme."
    : "Key criterion: prioritize the balance between ecosystem strength, delivery speed, and long-term risk.";
}

function buildWebCompareAnswer(primary = {}, context = {}, language = "fr") {
  const options = extractCompareOptions(context.prompt);
  if (options.length < 2) {
    return "";
  }

  const focus = detectCompareFocus(context.prompt);
  const analyses = options
    .map((option) => analyzeCompareOption(option, collectCompareSegments(primary), focus))
    .filter((analysis) => analysis.score > 0);

  if (!analyses.length) {
    return "";
  }

  const ranked = analyses.sort(
    (left, right) =>
      scoreCompareRecommendation(right, focus) - scoreCompareRecommendation(left, focus) ||
      right.score - left.score
  );
  const recommended = ranked[0];
  const recommendationLine =
    focus === "speed"
      ? language === "fr"
        ? `Pour la vitesse de dev max, ${recommended.option} ressort comme le meilleur compromis dans les sources consultees.`
        : `For maximum development speed, ${recommended.option} stands out as the best tradeoff in the consulted sources.`
      : language === "fr"
        ? `${recommended.option} ressort comme la recommandation la plus robuste dans les sources consultees.`
        : `${recommended.option} emerges as the most robust recommendation in the consulted sources.`;

  return [
    language === "fr" ? "Recommandation" : "Recommendation",
    recommendationLine,
    language === "fr" ? "Comparaison" : "Comparison",
    ...ranked.map((analysis) => buildCompareOptionLine(analysis, language)),
    language === "fr" ? "Criteres de decision" : "Decision criteria",
    `- ${buildCompareCriteriaLine(focus, language)}`,
    buildSourceTitleLine(
      [
        ...(primary.pages || []).map((page) => ({ title: page.title })),
        ...(primary.searchResults || []).map((item) => ({ title: item.title }))
      ],
      language
    )
  ]
    .filter(Boolean)
    .join("\n");
}

function formatNumber(value, language, options = {}) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "n/a";
  }

  const formatter = new Intl.NumberFormat(language === "fr" ? "fr-FR" : "en-US", {
    maximumFractionDigits: options.maximumFractionDigits ?? 1,
    minimumFractionDigits: options.minimumFractionDigits ?? 0
  });

  return formatter.format(Number(value));
}

function formatTemperature(value, language) {
  return `${formatNumber(value, language)} C`;
}

function formatWind(value, language) {
  return `${formatNumber(value, language)} km/h`;
}

function weatherLabelToFrench(value = "") {
  const map = {
    "Clear sky": "ciel degage",
    "Mainly clear": "temps plutot degage",
    "Partly cloudy": "temps partiellement nuageux",
    Overcast: "ciel couvert",
    Fog: "brouillard",
    "Depositing rime fog": "brouillard givrant",
    "Light drizzle": "bruine faible",
    Drizzle: "bruine",
    "Dense drizzle": "bruine dense",
    "Slight rain": "pluie faible",
    Rain: "pluie",
    "Heavy rain": "forte pluie",
    "Slight snow": "neige faible",
    Snow: "neige",
    "Heavy snow": "fortes chutes de neige",
    "Rain showers": "averses",
    "Strong rain showers": "fortes averses",
    Thunderstorm: "orage"
  };

  return map[value] || value.toLowerCase() || "conditions variables";
}

function formatWeatherLabel(value = "", language = "en") {
  return language === "fr" ? weatherLabelToFrench(value) : value || "variable conditions";
}

function buildSourceLine(sourceNames = [], language = "fr") {
  if (!sourceNames.length) {
    return "";
  }

  const uniqueNames = [...new Set(sourceNames.filter(Boolean))];
  return language === "fr"
    ? `Source : ${uniqueNames.join(", ")}.`
    : `Source: ${uniqueNames.join(", ")}.`;
}

function findFollowUpAction(context = {}, domains = []) {
  const actions = context.followUpActions || [];
  if (!actions.length) {
    return null;
  }

  if (!domains.length) {
    return actions.find((action) => action.assistantCue) || actions[0];
  }

  return (
    actions.find((action) => domains.includes(action.domain) && action.assistantCue) ||
    actions.find((action) => domains.includes(action.domain)) ||
    null
  );
}

function buildFollowUpSuggestion(context = {}, language = "fr", domains = []) {
  const action = findFollowUpAction(context, domains);
  if (!action?.assistantCue) {
    return "";
  }

  return language === "fr" ? action.assistantCue.fr || "" : action.assistantCue.en || "";
}

function renderWeatherAnswer(result, context, language) {
  const current = result.normalized?.current || {};
  const forecast = result.normalized?.forecast || [];
  const location = result.normalized?.location || result.sourceName || "Unknown location";
  const weatherText = formatWeatherLabel(current.weatherText, language);

  if (result.capability === "forecast" && forecast.length) {
    const intro =
      language === "fr"
        ? `Voici la tendance meteo pour ${location}. En ce moment, il fait ${formatTemperature(current.temperatureC, language)} avec ${weatherText}.`
        : `Here is the weather trend for ${location}. Right now it is ${formatTemperature(current.temperatureC, language)} with ${weatherText}.`;

    const lines = forecast.slice(0, 3).map((day) =>
      language === "fr"
        ? `- ${day.date} : ${formatWeatherLabel(day.weatherText, language)}, ${formatTemperature(day.minTempC, language)} a ${formatTemperature(day.maxTempC, language)}${day.precipitationProbability !== null ? `, pluie ${formatNumber(day.precipitationProbability, language)} %` : ""}`
        : `- ${day.date}: ${formatWeatherLabel(day.weatherText, language)}, ${formatTemperature(day.minTempC, language)} to ${formatTemperature(day.maxTempC, language)}${day.precipitationProbability !== null ? `, rain ${formatNumber(day.precipitationProbability, language)}%` : ""}`
    );

    return [intro, ...lines, buildSourceLine([result.sourceName], language)]
      .filter(Boolean)
      .join("\n");
  }

  const firstSentence =
    language === "fr"
      ? `A ${location}, il fait actuellement ${formatTemperature(current.temperatureC, language)} avec ${weatherText}.`
      : `In ${location}, it is currently ${formatTemperature(current.temperatureC, language)} with ${weatherText}.`;
  const details = [];

  if (current.apparentTemperatureC !== null && current.apparentTemperatureC !== undefined) {
    details.push(
      language === "fr"
        ? `Ressenti autour de ${formatTemperature(current.apparentTemperatureC, language)}`
        : `Feels like ${formatTemperature(current.apparentTemperatureC, language)}`
    );
  }

  if (current.windSpeedKmh !== null && current.windSpeedKmh !== undefined) {
    details.push(
      language === "fr"
        ? `vent autour de ${formatWind(current.windSpeedKmh, language)}`
        : `wind around ${formatWind(current.windSpeedKmh, language)}`
    );
  }

  if (
    current.precipitationMm !== null &&
    current.precipitationMm !== undefined &&
    Number(current.precipitationMm) > 0
  ) {
    details.push(
      language === "fr"
        ? `precipitations ${formatNumber(current.precipitationMm, language)} mm`
        : `precipitation ${formatNumber(current.precipitationMm, language)} mm`
    );
  }

  const detailSentence = details.length ? `${details.join(", ")}.` : "";
  const suggestion = buildFollowUpSuggestion(context, language, ["weather"]);

  return [firstSentence, detailSentence, buildSourceLine([result.sourceName], language), suggestion]
    .filter(Boolean)
    .join(" ");
}

function renderMarketAnswer(result, context, language) {
  const normalized = result.normalized || {};
  const suggestion = buildFollowUpSuggestion(context, language, ["market", "finance", "crypto"]);
  const wantsAnalysis = context.classification === "hybrid_task";

  if (result.capability === "price_lookup") {
    const asset = normalized.asset || normalized.pair || "asset";
    const directLine =
      language === "fr"
        ? `${asset} se traite actuellement autour de ${formatNumber(normalized.priceUsd, language, { maximumFractionDigits: 2 })} $.`
        : `${asset} is currently trading around $${formatNumber(normalized.priceUsd, language, { maximumFractionDigits: 2 })}.`;

    if (!wantsAnalysis) {
      return [directLine, buildSourceLine([result.sourceName], language), suggestion]
        .filter(Boolean)
        .join(" ");
    }

    return [
      language === "fr" ? "**Reponse directe**" : "**Direct answer**",
      directLine,
      language === "fr" ? "**Preuves**" : "**Evidence**",
      `- ${buildSourceLine([result.sourceName], language).replace(/[.]+$/, "")}`,
      `- ${language === "fr" ? "Prix spot" : "Spot price"}: ${formatNumber(normalized.priceUsd, language, { maximumFractionDigits: 2 })} $`,
      language === "fr" ? "**Analyse**" : "**Analysis**",
      language === "fr"
        ? `Avec ce seul prix instantane, la lecture reste descriptive: on sait ou l'actif se traite maintenant, mais pas sa tendance ni son momentum.`
        : `With a single spot price, the reading stays descriptive: it tells us where the asset is trading now, but not its trend or momentum.`,
      language === "fr" ? "**Limites**" : "**Caveats**",
      language === "fr"
        ? "- Sans variation 24h, volume, historique ou contexte macro, on ne peut pas conclure a une tendance."
        : "- Without 24h change, volume, history, or macro context, no trend conclusion can be drawn.",
      buildSourceLine([result.sourceName], language)
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (result.capability === "quote") {
    const directLine =
      language === "fr"
        ? `${normalized.symbol || "Le titre"} cote actuellement ${formatNumber(normalized.price, language, { maximumFractionDigits: 2 })}${normalized.changePercent ? ` (${normalized.changePercent})` : ""}.`
        : `${normalized.symbol || "The stock"} is currently at ${formatNumber(normalized.price, language, { maximumFractionDigits: 2 })}${normalized.changePercent ? ` (${normalized.changePercent})` : ""}.`;

    if (!wantsAnalysis) {
      return [directLine, buildSourceLine([result.sourceName], language), suggestion]
        .filter(Boolean)
        .join(" ");
    }

    const evidenceLines = [
      `- ${language === "fr" ? "Cours" : "Price"}: ${formatNumber(normalized.price, language, { maximumFractionDigits: 2 })}`,
      normalized.open
        ? `- ${language === "fr" ? "Ouverture" : "Open"}: ${formatNumber(normalized.open, language, { maximumFractionDigits: 2 })}`
        : "",
      normalized.high
        ? `- ${language === "fr" ? "Plus haut" : "High"}: ${formatNumber(normalized.high, language, { maximumFractionDigits: 2 })}`
        : "",
      normalized.low
        ? `- ${language === "fr" ? "Plus bas" : "Low"}: ${formatNumber(normalized.low, language, { maximumFractionDigits: 2 })}`
        : "",
      normalized.volume
        ? `- ${language === "fr" ? "Volume" : "Volume"}: ${formatNumber(normalized.volume, language, { maximumFractionDigits: 0 })}`
        : "",
      buildSourceLine([result.sourceName], language).replace(/[.]+$/, "")
    ].filter(Boolean);

    const analysisLines = normalized.high && normalized.low
      ? [
          language === "fr"
            ? `La seance reste encadree entre ${formatNumber(normalized.low, language, { maximumFractionDigits: 2 })} et ${formatNumber(normalized.high, language, { maximumFractionDigits: 2 })}, ce qui donne surtout un point de situation court terme.`
            : `The session remains bounded between ${formatNumber(normalized.low, language, { maximumFractionDigits: 2 })} and ${formatNumber(normalized.high, language, { maximumFractionDigits: 2 })}, which mainly provides a short-term snapshot.`,
          language === "fr"
            ? "Sans historique multi-jours, tendance, news ou contexte de valorisation, on ne peut pas conclure a une direction durable."
            : "Without multi-day history, news, or valuation context, no durable directional conclusion can be drawn."
        ]
      : [
          language === "fr"
            ? "Avec cette seule cotation, la lecture reste descriptive: elle donne un niveau de prix mais pas une conviction de tendance."
            : "With a single quote, the reading stays descriptive: it gives a price level but not a trend conviction."
        ];

    return [
      language === "fr" ? "**Reponse directe**" : "**Direct answer**",
      directLine,
      language === "fr" ? "**Preuves**" : "**Evidence**",
      ...evidenceLines,
      language === "fr" ? "**Analyse**" : "**Analysis**",
      ...analysisLines.map((line) => `- ${line}`),
      language === "fr" ? "**Limites**" : "**Caveats**",
      language === "fr"
        ? "- Ajoutez variation 24h, volume moyen, news ou historique pour une analyse plus solide."
        : "- Add 24h change, average volume, news, or price history for a stronger analysis.",
      buildSourceLine([result.sourceName], language)
    ]
      .filter(Boolean)
      .join("\n");
  }

  return "";
}

function renderContentApiAnswer(result, context, language, bulletMode = false) {
  const normalized = result.normalized || {};

  if (result.capability === "latest_news") {
    const articles = normalized.articles || [];
    if (!articles.length) {
      return language === "fr" ? "Aucun article pertinent n'a ete trouve." : "No relevant article was found.";
    }

    const intro =
      language === "fr"
        ? `Voici les principaux titres${normalized.topic ? ` sur ${normalized.topic}` : ""} :`
        : `Here are the top headlines${normalized.topic ? ` on ${normalized.topic}` : ""}:`;
    const lines = articles.slice(0, 4).map((article) =>
      bulletMode
        ? `- ${article.title}${article.source ? ` (${article.source})` : ""}`
        : `${article.title}${article.source ? ` (${article.source})` : ""}`
    );

    return [
      intro,
      ...lines,
      buildSourceLine([result.sourceName], language),
      buildFollowUpSuggestion(context, language, ["news"])
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (result.capability === "translate_text") {
    return [
      language === "fr"
        ? `Traduction (${normalized.targetLanguage || "cible"}) : ${normalized.translatedText || ""}`
        : `Translation (${normalized.targetLanguage || "target"}): ${normalized.translatedText || ""}`,
      buildSourceLine([result.sourceName], language)
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (result.capability === "geocode") {
    return [
      language === "fr"
        ? `${normalized.name || "Le lieu"} se situe autour de ${formatNumber(normalized.latitude, language, { maximumFractionDigits: 4 })}, ${formatNumber(normalized.longitude, language, { maximumFractionDigits: 4 })}.`
        : `${normalized.name || "The place"} is located around ${formatNumber(normalized.latitude, language, { maximumFractionDigits: 4 })}, ${formatNumber(normalized.longitude, language, { maximumFractionDigits: 4 })}.`,
      buildSourceLine([result.sourceName], language)
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (result.capability === "movie_search") {
    const movies = normalized.movies || [];
    if (!movies.length) {
      return language === "fr" ? "Aucun film pertinent n'a ete trouve." : "No relevant movie was found.";
    }

    return [
      language === "fr" ? "Voici les resultats les plus probables :" : "Here are the most likely results:",
      ...movies.slice(0, 4).map((movie) => `- ${movie.title}${movie.year ? ` (${movie.year})` : ""}`),
      buildSourceLine([result.sourceName], language)
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (result.capability === "scores") {
    const events = normalized.events || [];
    if (!events.length) {
      return language === "fr" ? "Aucun score recent n'a ete trouve." : "No recent score was found.";
    }

    return [
      language === "fr" ? "Voici les matchs trouves :" : "Here are the matches found:",
      ...events.slice(0, 4).map((event) => `- ${event.event} : ${event.score}`),
      buildSourceLine([result.sourceName], language)
    ]
      .filter(Boolean)
      .join("\n");
  }

  return result.summaryText || "";
}

function renderWebAnswer(webResults = [], context, language, bulletMode = false) {
  if (!webResults.length) {
    return "";
  }

  const primary = webResults[0];
  const pages = primary.pages || [];
  const searchResults = primary.searchResults || [];
  const suggestion = buildFollowUpSuggestion(context, language, ["web"]);

  if (context.classification === "compare") {
    const compareAnswer = buildWebCompareAnswer(primary, context, language);
    if (compareAnswer) {
      return [compareAnswer, suggestion].filter(Boolean).join("\n");
    }
  }

  if (pages.length) {
    const takeawaySummary = buildWebTakeaways(primary, context, language);
    if (takeawaySummary && ["summarize", "compare", "hybrid_task"].includes(context.classification)) {
      return [takeawaySummary, suggestion].filter(Boolean).join("\n");
    }

    const intro =
      language === "fr"
        ? "J'ai lu les pages les plus pertinentes et voici l'essentiel :"
        : "I read the most relevant pages and here is the key information:";
    const lines = pages.slice(0, 3).map((page) =>
      bulletMode
        ? `- ${page.title}: ${truncate(page.excerpt, 220)}`
        : `${page.title}: ${truncate(page.excerpt, 220)}`
    );
    const sourceLine = buildSourceLine(
      pages.map((page) => page.providerId || page.url || primary.sourceName),
      language
    );

    return [intro, ...lines, sourceLine, suggestion].filter(Boolean).join("\n");
  }

  if (searchResults.length) {
    const takeawaySummary = buildWebTakeaways(primary, context, language);
    if (takeawaySummary && ["summarize", "compare", "hybrid_task"].includes(context.classification)) {
      return [takeawaySummary, suggestion].filter(Boolean).join("\n");
    }

    const intro =
      language === "fr"
        ? "Voici les resultats web les plus utiles :"
        : "Here are the most useful web results:";
    const lines = searchResults.slice(0, 4).map((result) =>
      bulletMode
        ? `- ${result.title}: ${truncate(result.snippet || result.url, 200)}`
        : `${result.title}: ${truncate(result.snippet || result.url, 200)}`
    );
    return [intro, ...lines, buildSourceLine([primary.sourceName], language), suggestion]
      .filter(Boolean)
      .join("\n");
  }

  return primary.summaryText || "";
}

function buildCodingAuditToolAnswer(toolResults = [], language = "fr") {
  const workspace = toolResults.find((result) => result.capability === "workspace_inspect");
  if (!workspace) {
    return "";
  }

  const diagnostics = toolResults.find((result) => result.capability === "run_diagnostics");
  const relevantFiles = workspace.normalized?.relevantFiles || [];
  const reports = diagnostics?.normalized?.reports || [];
  const hasRoutingSpread =
    relevantFiles.some((file) => /classifier\.js$/i.test(file)) &&
    relevantFiles.some((file) => /conversationIntentService\.js$/i.test(file)) &&
    relevantFiles.some((file) => /followUpActionService\.js$/i.test(file));
  const hasLimitedAutomation = !reports.some((report) => report.kind === "npm_script");
  const hasConfigSprawl =
    relevantFiles.some((file) => /hydria\.config\.js$/i.test(file)) &&
    relevantFiles.some((file) => /HydriaBrain\.js$/i.test(file));

  const findings = [];

  if (hasRoutingSpread) {
    findings.push({
      diagnosis:
        language === "fr"
          ? "La logique de routage est eparpillee entre `classifier.js`, `conversationIntentService.js` et `followUpActionService.js`, ce qui augmente le risque de regressions comportementales et de regles contradictoires."
          : "Routing logic is spread across `classifier.js`, `conversationIntentService.js`, and `followUpActionService.js`, which increases the risk of behavioral regressions and contradictory rules.",
      fix:
        language === "fr"
          ? "Centraliser les intentions, slots et follow-ups dans un schema unique, puis couvrir ce schema avec des tests d'integration conversationnels."
          : "Centralize intents, slots, and follow-ups into a single schema, then cover that schema with conversational integration tests."
    });
  }

  if (hasLimitedAutomation) {
    findings.push({
      diagnosis:
        language === "fr"
          ? "Le filet de securite de qualite est faible: les diagnostics disponibles n'ont execute que des verifications syntaxiques, sans `lint`, `test` ou `build` reproductibles depuis `package.json`."
          : "The quality safety net is weak: the available diagnostics only executed syntax checks, with no reproducible `lint`, `test`, or `build` scripts from `package.json`.",
      fix:
        language === "fr"
          ? "Ajouter des scripts `lint`, `test` et un mini banc de tests API/chat, puis les executer automatiquement avant chaque release."
          : "Add `lint`, `test`, and a small API/chat regression suite, then run them automatically before each release."
    });
  }

  if (hasConfigSprawl) {
    findings.push({
      diagnosis:
        language === "fr"
          ? "La surface de configuration et d'orchestration est large (`hydria.config.js`, `HydriaBrain.js`, providers, tools), mais les garde-fous de validation au demarrage restent limites. Une incoherence de config peut passer en production sous forme de fallback silencieux."
          : "The configuration and orchestration surface is large (`hydria.config.js`, `HydriaBrain.js`, providers, tools), but startup validation remains limited. A config mismatch can reach production as a silent fallback.",
      fix:
        language === "fr"
          ? "Ajouter une validation de configuration au boot, avec rapport clair sur les providers, tools et routes desactives, puis des tests de sante par capacite."
          : "Add startup configuration validation with a clear report on providers, tools, and disabled routes, then add per-capability health checks."
    });
  }

  if (!findings.length) {
    return "";
  }

  const selected = findings.slice(0, 3);

  return [
    language === "fr" ? "Diagnostic" : "Diagnosis",
    ...selected.map((item, index) => `${index + 1}. ${item.diagnosis}`),
    language === "fr" ? "Correction concrete" : "Concrete fix",
    ...selected.map((item, index) => `${index + 1}. ${item.fix}`),
    language === "fr"
      ? "Verification"
      : "Verification",
    language === "fr"
      ? "- Rejouer une batterie de scenarios conversationnels et outilles sur chaque modification du routeur."
      : "- Replay a battery of conversational and tool-backed scenarios after every router change."
  ].join("\n");
}

function buildUiDebugToolAnswer(toolResults = [], language = "fr") {
  const workspace = toolResults.find((result) => result.capability === "workspace_inspect");
  const diagnostics = toolResults.find((result) => result.capability === "run_diagnostics");
  const preview = toolResults.find(
    (result) =>
      result.capability === "inspect_preview" ||
      String(result.capability || "").startsWith("browser_")
  );

  if (!preview && !diagnostics) {
    return "";
  }

  const previewRaw = preview?.raw || {};
  const previewNormalized = preview?.normalized || {};
  const visibleContent = truncate(
    previewNormalized.excerpt || previewRaw.text || "",
    220
  );
  const links = (previewRaw.links || previewNormalized.links || []).slice(0, 5);
  const reports = diagnostics?.normalized?.reports || [];
  const failedReports = reports.filter((report) => report.success === false).slice(0, 3);
  const relevantFiles = (workspace?.normalized?.relevantFiles || []).slice(0, 5);

  const sections = [];

  sections.push(language === "fr" ? "Etat observe" : "Observed state");
  if (previewNormalized.url || previewRaw.url) {
    sections.push(
      language === "fr"
        ? `- URL: ${previewNormalized.url || previewRaw.url}`
        : `- URL: ${previewNormalized.url || previewRaw.url}`
    );
  }
  if (previewNormalized.title || previewRaw.title) {
    sections.push(
      language === "fr"
        ? `- Titre: ${previewNormalized.title || previewRaw.title}`
        : `- Title: ${previewNormalized.title || previewRaw.title}`
    );
  }
  if (visibleContent) {
    sections.push(
      language === "fr"
        ? `- Contenu visible: ${visibleContent}`
        : `- Visible content: ${visibleContent}`
    );
  }
  if (links.length) {
    sections.push(language === "fr" ? "- Liens visibles:" : "- Visible links:");
    sections.push(...links.map((link) => `  ${link.text || link.href} -> ${link.href}`));
  }

  if (relevantFiles.length) {
    sections.push(language === "fr" ? "Fichiers probablement impliques" : "Likely involved files");
    sections.push(...relevantFiles.map((file) => `- ${file}`));
  }

  if (failedReports.length) {
    sections.push(language === "fr" ? "Diagnostics utiles" : "Useful diagnostics");
    sections.push(
      ...failedReports.map((report) => {
        const label =
          report.kind === "npm_script"
            ? `npm run ${report.scriptName}`
            : `node --check ${report.file}`;
        const detail = truncate(report.stderr || report.stdout || "", 160);
        return `- ${label}${detail ? ` | ${detail}` : ""}`;
      })
    );
  } else if (diagnostics) {
    sections.push(language === "fr" ? "Diagnostics utiles" : "Useful diagnostics");
    sections.push(
      language === "fr"
        ? "- Aucun echec bloquant remonte par les diagnostics disponibles."
        : "- No blocking failure surfaced in the available diagnostics."
    );
  }

  sections.push(language === "fr" ? "Prochaine action recommandee" : "Recommended next action");
  if (failedReports.length) {
    sections.push(
      language === "fr"
        ? "- Corriger d'abord les erreurs de diagnostic visibles, puis rejouer l'inspection UI."
        : "- Fix the visible diagnostic failures first, then replay the UI inspection."
    );
  } else if (relevantFiles.length) {
    sections.push(
      language === "fr"
        ? `- Verifier d'abord ${relevantFiles[0]} puis rejouer la capture de preview.`
        : `- Review ${relevantFiles[0]} first, then replay the preview capture.`
    );
  } else {
    sections.push(
      language === "fr"
        ? "- Rejouer une capture preview apres la prochaine modification UI."
        : "- Replay a preview capture after the next UI change."
    );
  }

  return sections.filter(Boolean).join("\n");
}

function buildBrowserToolAnswer(toolResults = [], language = "fr") {
  const browserResult = toolResults.find(
    (result) =>
      result.capability === "inspect_preview" ||
      String(result.capability || "").startsWith("browser_")
  );

  if (!browserResult) {
    return "";
  }

  const raw = browserResult.raw || {};
  const normalized = browserResult.normalized || {};
  const links = raw.links || normalized.links || [];
  const controls = raw.controls || normalized.controls || [];
  const intro =
    language === "fr"
      ? `J'ai inspecte ${normalized.url || raw.url || "la page demandee"}.`
      : `I inspected ${normalized.url || raw.url || "the requested page"}.`;
  const titleLine =
    normalized.title || raw.title
      ? language === "fr"
        ? `Titre: ${normalized.title || raw.title}`
        : `Title: ${normalized.title || raw.title}`
      : "";
  const excerptLine =
    normalized.excerpt || raw.text
      ? language === "fr"
        ? `Contenu visible: ${truncate(normalized.excerpt || raw.text, 260)}`
        : `Visible content: ${truncate(normalized.excerpt || raw.text, 260)}`
      : "";
  const linkLines = links
    .slice(0, 6)
    .map((link) =>
      language === "fr"
        ? `- ${link.text || link.href} -> ${link.href}`
        : `- ${link.text || link.href} -> ${link.href}`
    );
  const controlLines = controls
    .slice(0, 6)
    .map((control) =>
      language === "fr"
        ? `- ${control.text} [${control.tag}]`
        : `- ${control.text} [${control.tag}]`
    );

  return [
    intro,
    titleLine,
    excerptLine,
    linkLines.length ? (language === "fr" ? "Liens principaux" : "Main links") : "",
    ...linkLines
    ,
    !linkLines.length && controlLines.length
      ? (language === "fr" ? "Aucun lien visible detecte. Controles visibles" : "No visible links detected. Visible controls")
      : "",
    ...(!linkLines.length ? controlLines : []),
    !linkLines.length && !controlLines.length
      ? (language === "fr"
        ? "Aucun lien visible detecte sur la page inspectee."
        : "No visible links were detected on the inspected page.")
      : ""
  ]
    .filter(Boolean)
    .join("\n");
}

function isUiBrowserPrompt(prompt = "") {
  return /\b(ui|ux|render|rendu|preview|screen|page|browser|localhost|visible|liens?|links?|screenshot|capture|frontend|affichage)\b/i.test(
    normalizeText(prompt)
  );
}

function renderToolAnswer(toolResults = [], context, language) {
  if (!toolResults.length) {
    return "";
  }

  if (
    context.classification === "coding" &&
    /\b(ui|ux|render|rendu|preview|screen|page|browser|localhost|visible|affichage|layout|css|frontend)\b/i.test(
      normalizeText(context.prompt)
    )
  ) {
    const uiDebugAnswer = buildUiDebugToolAnswer(toolResults, language);
    if (uiDebugAnswer) {
      return uiDebugAnswer;
    }
  }

  const browserAnswer = buildBrowserToolAnswer(toolResults, language);
  if (browserAnswer && isUiBrowserPrompt(context.prompt)) {
    return browserAnswer;
  }

  if (
    context.classification === "coding" &&
    /\b(risque|risques|risk|audit|inspect|debug|fragile|fragiles|points faibles|weak points|routeur|router)\b/i.test(normalizeText(context.prompt))
  ) {
    const auditAnswer = buildCodingAuditToolAnswer(toolResults, language);
    if (auditAnswer) {
      return auditAnswer;
    }
  }

  const primary = toolResults[0];
  return [
    language === "fr"
      ? `J'ai utilise ${primary.sourceName} pour obtenir le contexte principal.`
      : `I used ${primary.sourceName} to gather the main context.`,
    primary.summaryText
  ]
    .filter(Boolean)
    .join("\n");
}

function renderApiAnswer(apiResults = [], context, language) {
  if (!apiResults.length) {
    return "";
  }

  const primary = apiResults[0];

  if (primary.sourceName?.toLowerCase().includes("weather")) {
    return renderWeatherAnswer(primary, context, language);
  }

  if (["price_lookup", "quote"].includes(primary.capability)) {
    return renderMarketAnswer(primary, context, language);
  }

  return renderContentApiAnswer(
    primary,
    context,
    language,
    wantsBullets(context.preferencesUsed, context.prompt)
  );
}

export function buildPresentedAnswer(context = {}) {
  const language = detectLanguage(
    context.prompt,
    context.preferencesUsed,
    context.routingResolution
  );

  return (
    renderApiAnswer(context.apiResults || [], context, language) ||
    renderWebAnswer(
      context.webResults || [],
      context,
      language,
      wantsBullets(context.preferencesUsed, context.prompt)
    ) ||
    renderToolAnswer(context.toolResults || [], context, language) ||
    ""
  );
}

export function appendShortSourceNote(answer = "", context = {}) {
  const language = detectLanguage(
    context.prompt,
    context.preferencesUsed,
    context.routingResolution
  );
  const sources = [
    ...(context.apiResults || []).map((result) => result.sourceName),
    ...(context.webResults || []).map((result) => result.sourceName),
    ...(context.toolResults || []).map((result) => result.sourceName)
  ].filter(Boolean);

  const sourceLine = buildSourceLine(sources, language);
  if (!sourceLine) {
    return answer;
  }

  if (normalizeText(answer).includes(normalizeText(sourceLine))) {
    return answer;
  }

  return `${String(answer || "").trim()}\n\n${sourceLine}`.trim();
}

export function shouldPreferPresentedAnswer(context = {}) {
  const normalizedPrompt = normalizeText(context.prompt);
  const hasBrowserTool = (context.toolResults || []).some(
    (result) =>
      result.capability === "inspect_preview" ||
      String(result.capability || "").startsWith("browser_")
  );

  if (hasBrowserTool) {
    return true;
  }

  if (context.classification !== "data_lookup") {
    return false;
  }

  if (!context.apiResults?.length) {
    return false;
  }

  if (
    /\b(analyse|analyze|analysis|pourquoi|why|compare|compar|resume|summarize|detail|detaill|explain|explique|table|tableau|liste|list|bullet)\b/.test(
      normalizedPrompt
    )
  ) {
    return false;
  }

  return String(context.prompt || "").trim().length <= 140;
}
