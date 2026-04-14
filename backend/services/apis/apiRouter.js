import { AppError, ExternalServiceError } from "../../utils/errors.js";
import { requestJson } from "./genericApiClient.js";
import { normalizeApiResult } from "./normalizers/index.js";
import { getApisByCapability } from "../registry/apiRegistry.js";

const cryptoAliases = {
  btc: { symbol: "BTC", slug: "bitcoin" },
  bitcoin: { symbol: "BTC", slug: "bitcoin" },
  eth: { symbol: "ETH", slug: "ethereum" },
  ethereum: { symbol: "ETH", slug: "ethereum" },
  sol: { symbol: "SOL", slug: "solana" },
  solana: { symbol: "SOL", slug: "solana" },
  bnb: { symbol: "BNB", slug: "binance-coin" },
  xrp: { symbol: "XRP", slug: "xrp" },
  doge: { symbol: "DOGE", slug: "dogecoin" }
};

const languageAliases = {
  fr: "fr",
  francais: "fr",
  français: "fr",
  french: "fr",
  en: "en",
  anglais: "en",
  english: "en",
  es: "es",
  espagnol: "es",
  espagnole: "es",
  spanish: "es",
  de: "de",
  allemand: "de",
  german: "de",
  it: "it",
  italien: "it",
  italian: "it",
  pt: "pt",
  portugais: "pt",
  portuguese: "pt"
};

const tickerStopwords = new Set([
  "AVEC",
  "QUEL",
  "QUELS",
  "QUELLE",
  "QUELLES",
  "COURS",
  "ACTION",
  "ACTIONS",
  "STOCK",
  "SHARE",
  "QUOTE",
  "PRIX",
  "PRICE",
  "DONNE",
  "MOI",
  "EST",
  "LE",
  "LA",
  "DE",
  "DU",
  "DES",
  "UNE",
  "UN",
  "ET",
  "POUR"
]);

function hasFinanceSignals(prompt) {
  return /(stock|share|quote|ticker|nasdaq|nyse|bourse|cotation|cours de l[' ]action|cours action|prix de l[' ]action|prix action|cours boursier|market cap)/i.test(
    prompt
  );
}

function hasTickerWithFinanceCue(prompt) {
  return /\b[A-Z]{2,5}\b/.test(prompt) && /\b(stock|share|action|quote|ticker|bourse|cours)\b/i.test(prompt);
}

function normalizeInput(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function cleanEntity(value) {
  return String(value || "")
    .replace(/[?.!,;]+$/g, "")
    .trim();
}

function normalizeLocationCandidate(value) {
  const candidate = cleanEntity(
    String(value || "")
      .replace(/\b(?:aujourd'hui|today|tomorrow|demain|this week|cette semaine|maintenant|now)\b/gi, "")
      .trim()
  );

  if (!candidate) {
    return "";
  }

  if (/^(fait il|fait-il|il|la|le|les|temps|weather|forecast)$/i.test(candidate)) {
    return "";
  }

  return candidate;
}

function extractLocation(prompt) {
  const prepMatch = prompt.match(/\b(?:a|in|for)\b\s+([\p{L}0-9' -]{2,})(?:\?|$)/iu);
  const match =
    prepMatch ||
    prompt.match(/(?:meteo|weather|forecast|temperature)\s+([\p{L}0-9' -]{2,})(?:\?|$)/iu);

  if (!match) {
    return "";
  }

  return normalizeLocationCandidate(match[1]);
}

function extractTopic(prompt, keywords) {
  const lower = prompt.toLowerCase();
  for (const keyword of keywords) {
    const index = lower.indexOf(keyword);
    if (index >= 0) {
      return cleanEntity(prompt.slice(index + keyword.length).trim()) || "general";
    }
  }

  return "general";
}

function extractTicker(prompt) {
  const upperMatch = prompt.match(/\b[A-Z]{2,5}\b/);
  if (upperMatch && !tickerStopwords.has(upperMatch[0])) {
    return upperMatch[0];
  }

  const candidates = prompt.match(/\b([A-Za-z]{2,5})\b/g) || [];
  const ticker = candidates
    .map((candidate) => candidate.toUpperCase())
    .find((candidate) => !tickerStopwords.has(candidate));

  return ticker || "";
}

function detectCrypto(prompt) {
  const lower = prompt.toLowerCase();
  for (const [alias, value] of Object.entries(cryptoAliases)) {
    if (lower.includes(alias)) {
      return value;
    }
  }

  return null;
}

function inferSourceLanguage(text = "") {
  const sample = cleanEntity(text).toLowerCase();

  if (!sample) {
    return "en";
  }

  if (/[àâçéèêëîïôùûüÿœ]/i.test(sample) || /\b(le|la|les|des|une|un|bonjour|merci|comment|avec|sans|pour)\b/.test(sample)) {
    return "fr";
  }

  if (/[ñ¿¡]/i.test(sample) || /\b(hola|gracias|como|para|con|sin|usted|buenos)\b/.test(sample)) {
    return "es";
  }

  if (/\b(hello|world|thanks|please|with|without|for|how|today|good|morning)\b/.test(sample)) {
    return "en";
  }

  return "en";
}

function normalizeLanguageCode(value = "") {
  const normalized = cleanEntity(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return languageAliases[normalized] || normalized || "";
}

function extractTranslation(prompt) {
  const match = prompt.match(/(?:traduis|translate)\s+["']?(.+?)["']?\s+(?:en|to)\s+([\p{L}-]+)/iu);
  if (!match) {
    return null;
  }

  return {
    text: cleanEntity(match[1]),
    targetLanguage: normalizeLanguageCode(match[2]),
    sourceLanguage: inferSourceLanguage(match[1])
  };
}

function extractMovieQuery(prompt) {
  const match = prompt.match(/(?:film|movie|imdb|cinema)\s+(.+)/i);
  return match ? cleanEntity(match[1]) : "";
}

function extractTeam(prompt) {
  const match = prompt.match(/(?:score|scores|result|resultat|match)\s+(?:de|for)?\s*([\p{L}0-9 .'-]{2,})/iu);
  return match ? cleanEntity(match[1]) : "";
}

export function detectApiNeed(prompt) {
  const normalizedPrompt = normalizeInput(prompt);

  if (
    /(meteo|weather|forecast|temperature|pluie|wind|vent|quel temps|temps qu'il fait|temps fait il|\btemps\b)/i.test(normalizedPrompt)
  ) {
    const capability = /(forecast|prevision|demain|tomorrow|semaine|week)/i.test(normalizedPrompt)
      ? "forecast"
      : "current_weather";

    return {
      routeKey: `weather/${capability === "forecast" ? "forecast" : "current"}`,
      category: "weather",
      capability,
      location: extractLocation(normalizedPrompt)
    };
  }

  if (
    /(crypto|bitcoin|btc|ethereum|eth|solana|sol|doge|prix du|price of)/i.test(normalizedPrompt)
  ) {
    const asset = detectCrypto(normalizedPrompt) || cryptoAliases.bitcoin;
    return {
      routeKey: "crypto/price",
      category: "crypto",
      capability: "price_lookup",
      assetSymbol: asset.symbol,
      assetSlug: asset.slug
    };
  }

  if (hasFinanceSignals(normalizedPrompt) || hasTickerWithFinanceCue(prompt)) {
    return {
      routeKey: "finance/quote",
      category: "finance",
      capability: "quote",
      symbol: extractTicker(prompt)
    };
  }

  if (/(actualite|actualites|news|headline|headlines|latest news)/i.test(normalizedPrompt)) {
    return {
      routeKey: "news/latest",
      category: "news",
      capability: "latest_news",
      topic: extractTopic(normalizedPrompt, ["actualite", "actualites", "news", "headline", "headlines"])
    };
  }

  if (/(traduis|translate)/i.test(normalizedPrompt)) {
    const translation = extractTranslation(prompt);
    if (translation) {
      return {
        routeKey: "translation/text",
        category: "translation",
        capability: "translate_text",
        ...translation
      };
    }
  }

  if (/(ou est|where is|coordinates|coordonnees|geocode|latitude|longitude)/i.test(normalizedPrompt)) {
    return {
      routeKey: "maps/geocode",
      category: "geocoding",
      capability: "geocode",
      location: extractTopic(normalizedPrompt, ["ou est", "where is", "geocode"])
    };
  }

  if (/(film|movie|imdb|cinema)/i.test(normalizedPrompt)) {
    return {
      routeKey: "movies/search",
      category: "movies",
      capability: "movie_search",
      query: extractMovieQuery(normalizedPrompt)
    };
  }

  if (/(score|scores|result|resultat|match)/i.test(normalizedPrompt)) {
    return {
      routeKey: "sports/scores",
      category: "sports",
      capability: "scores",
      team: extractTeam(normalizedPrompt)
    };
  }

  if (/(cherche|search|look up|recherche|who is|what is|qui est|qu'est-ce que)/i.test(normalizedPrompt)) {
    return {
      routeKey: "search/web",
      category: "search",
      capability: "web_search",
      query: cleanEntity(normalizedPrompt)
    };
  }

  return null;
}

async function resolveGeocode(location) {
  if (!location) {
    throw new AppError("A location is required for this request", 400);
  }

  const providers = getApisByCapability("geocode");
  const attempts = [];

  for (const provider of providers) {
    try {
      const raw =
        provider.id === "geocoding_open_meteo"
          ? await requestJson(provider, {
              params: {
                name: location,
                count: 1,
                language: "en",
                format: "json"
              }
            })
          : await requestJson(provider, {
              params: {
                q: location,
                format: "jsonv2",
                limit: 1
              },
              headers: {
                "Accept-Language": "en"
              }
            });

      const normalized = normalizeApiResult(provider, raw, {
        capability: "geocode"
      });

      if (normalized.normalized?.latitude && normalized.normalized?.longitude) {
        return normalized;
      }
    } catch (error) {
      attempts.push({ provider: provider.id, error: error.message });
    }
  }

  throw new ExternalServiceError(
    `Unable to geocode location "${location}"`,
    "geocode",
    502,
    attempts
  );
}

async function executeWeatherRequest(api, apiNeed) {
  const geocoded = await resolveGeocode(apiNeed.location);
  const location = geocoded.normalized;
  const params =
    apiNeed.capability === "forecast"
      ? {
          latitude: location.latitude,
          longitude: location.longitude,
          current: "temperature_2m,apparent_temperature,weather_code,wind_speed_10m",
          daily:
            "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
          forecast_days: 3,
          timezone: "auto"
        }
      : {
          latitude: location.latitude,
          longitude: location.longitude,
          current:
            "temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m",
          timezone: "auto"
        };

  const raw = await requestJson(api, { params });
  return normalizeApiResult(api, raw, {
    capability: apiNeed.capability,
    locationName: location.name,
    latitude: location.latitude,
    longitude: location.longitude
  });
}

async function executeCryptoRequest(api, apiNeed) {
  if (api.id === "crypto_binance") {
    const raw = await requestJson(api, {
      path: "/ticker/price",
      params: {
        symbol: `${apiNeed.assetSymbol}USDT`
      }
    });

    return normalizeApiResult(api, raw, {
      capability: apiNeed.capability,
      assetSymbol: apiNeed.assetSymbol
    });
  }

  if (api.id === "crypto_coincap") {
    const raw = await requestJson(api, {
      path: `/assets/${apiNeed.assetSlug}`
    });

    return normalizeApiResult(api, raw, {
      capability: apiNeed.capability,
      assetSymbol: apiNeed.assetSymbol
    });
  }

  throw new AppError(`Unsupported crypto provider ${api.id}`, 500);
}

async function executeFinanceRequest(api, apiNeed) {
  if (api.id === "finance_stooq") {
    const raw = await requestJson(api, {
      params: {
        s: `${String(apiNeed.symbol || "").toLowerCase()}.us`,
        i: "d"
      }
    });

    return normalizeApiResult(api, raw, {
      capability: apiNeed.capability,
      symbol: apiNeed.symbol
    });
  }

  const raw = await requestJson(api, {
    params: {
      function: "GLOBAL_QUOTE",
      symbol: apiNeed.symbol
    }
  });

  return normalizeApiResult(api, raw, {
    capability: apiNeed.capability,
    symbol: apiNeed.symbol
  });
}

async function executeNewsRequest(api, apiNeed) {
  const raw =
    api.id === "news_gnews"
      ? await requestJson(api, {
          path: "/search",
          params: {
            q: apiNeed.topic || "technology",
            lang: "en",
            max: 5
          }
        })
      : await requestJson(api, {
          path: "/search_by_date",
          params: {
            query: apiNeed.topic || "technology",
            tags: "story",
            hitsPerPage: 5
          }
        });

  return normalizeApiResult(api, raw, {
    capability: apiNeed.capability,
    topic: apiNeed.topic
  });
}

async function executeSearchRequest(api, apiNeed) {
  const raw = await requestJson(api, {
    params: {
      q: apiNeed.query,
      format: "json",
      no_html: 1,
      no_redirect: 1,
      skip_disambig: 1
    }
  });

  return normalizeApiResult(api, raw, {
    capability: apiNeed.capability,
    query: apiNeed.query
  });
}

async function executeTranslationRequest(api, apiNeed) {
  const raw = await requestJson(api, {
    path: "/get",
    params: {
      q: apiNeed.text,
      langpair: `${apiNeed.sourceLanguage || "auto"}|${apiNeed.targetLanguage}`
    }
  });

  return normalizeApiResult(api, raw, {
    capability: apiNeed.capability,
    sourceLanguage: apiNeed.sourceLanguage,
    targetLanguage: apiNeed.targetLanguage
  });
}

async function executeMovieRequest(api, apiNeed) {
  const raw = await requestJson(api, {
    params: {
      s: apiNeed.query
    }
  });

  return normalizeApiResult(api, raw, {
    capability: apiNeed.capability,
    query: apiNeed.query
  });
}

async function executeSportsRequest(api, apiNeed) {
  const apiKey = process.env[api.envKey] || "123";
  const raw = await requestJson(api, {
    path: `/${apiKey}/searchevents.php`,
    params: {
      e: apiNeed.team || ""
    }
  });

  return normalizeApiResult(api, raw, {
    capability: apiNeed.capability,
    team: apiNeed.team
  });
}

async function executeGeocodeRequest(api, apiNeed) {
  const raw =
    api.id === "geocoding_open_meteo"
      ? await requestJson(api, {
          params: {
            name: apiNeed.location,
            count: 1,
            language: "en",
            format: "json"
          }
        })
      : await requestJson(api, {
          params: {
            q: apiNeed.location,
            format: "jsonv2",
            limit: 1
          }
        });

  return normalizeApiResult(api, raw, {
    capability: apiNeed.capability
  });
}

async function executeApiCandidate(api, apiNeed) {
  switch (apiNeed.category) {
    case "weather":
      return executeWeatherRequest(api, apiNeed);
    case "crypto":
      return executeCryptoRequest(api, apiNeed);
    case "finance":
      return executeFinanceRequest(api, apiNeed);
    case "news":
      return executeNewsRequest(api, apiNeed);
    case "search":
      return executeSearchRequest(api, apiNeed);
    case "translation":
      return executeTranslationRequest(api, apiNeed);
    case "movies":
      return executeMovieRequest(api, apiNeed);
    case "sports":
      return executeSportsRequest(api, apiNeed);
    case "geocoding":
      return executeGeocodeRequest(api, apiNeed);
    default:
      throw new AppError(`Unsupported API category ${apiNeed.category}`, 500);
  }
}

export async function resolve(prompt, classification, apiNeed = null) {
  const requestedNeed = apiNeed || detectApiNeed(prompt);

  if (!requestedNeed) {
    return {
      success: false,
      error: "No external API requirement detected."
    };
  }

  const providers = getApisByCapability(requestedNeed.capability, {
    category: requestedNeed.category
  });

  if (!providers.length) {
    return {
      success: false,
      error: `No provider available for ${requestedNeed.capability}.`,
      apiNeed: requestedNeed
    };
  }

  const attempts = [];

  for (const provider of providers) {
    try {
      const result = await executeApiCandidate(provider, requestedNeed);

      return {
        success: true,
        providerId: provider.id,
        sourceType: result.sourceType,
        sourceName: result.sourceName,
        capability: result.capability,
        raw: result.raw,
        normalized: result.normalized,
        summaryText: result.summaryText,
        apiNeed: requestedNeed,
        attempts
      };
    } catch (error) {
      attempts.push({
        provider: provider.id,
        error: error.message
      });
    }
  }

  return {
    success: false,
    error: `All providers failed for ${requestedNeed.routeKey}.`,
    apiNeed: requestedNeed,
    attempts
  };
}
