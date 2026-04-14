function truncate(text, length = 180) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (clean.length <= length) {
    return clean;
  }

  return `${clean.slice(0, length - 1)}…`;
}

export function normalizeContentResult(api, raw, context = {}) {
  if (api.id === "geocoding_open_meteo") {
    const result = raw.results?.[0] || null;
    const normalized = result
      ? {
          name: [result.name, result.admin1, result.country].filter(Boolean).join(", "),
          latitude: result.latitude,
          longitude: result.longitude,
          country: result.country || null
        }
      : null;

    return {
      sourceType: "api",
      sourceName: api.name,
      capability: context.capability,
      raw,
      normalized,
      summaryText: normalized
        ? `${normalized.name}: ${normalized.latitude}, ${normalized.longitude}`
        : "No location found."
    };
  }

  if (api.id === "maps_nominatim") {
    const result = Array.isArray(raw) ? raw[0] : null;
    const normalized = result
      ? {
          name: result.display_name,
          latitude: Number(result.lat),
          longitude: Number(result.lon)
        }
      : null;

    return {
      sourceType: "api",
      sourceName: api.name,
      capability: context.capability,
      raw,
      normalized,
      summaryText: normalized
        ? `${normalized.name}: ${normalized.latitude}, ${normalized.longitude}`
        : "No location found."
    };
  }

  if (api.id === "news_gnews") {
    const articles = (raw.articles || []).slice(0, 5).map((article) => ({
      title: article.title,
      source: article.source?.name,
      url: article.url
    }));

    return {
      sourceType: "api",
      sourceName: api.name,
      capability: context.capability,
      raw,
      normalized: { topic: context.topic, articles },
      summaryText: articles.length
        ? articles.map((article) => `${article.title} (${article.source || "unknown source"})`).join(" | ")
        : "No articles found."
    };
  }

  if (api.id === "news_hackernews") {
    const articles = (raw.hits || []).slice(0, 5).map((article) => ({
      title: article.title,
      source: "Hacker News",
      url: article.url || article.story_url
    }));

    return {
      sourceType: "api",
      sourceName: api.name,
      capability: context.capability,
      raw,
      normalized: { topic: context.topic, articles },
      summaryText: articles.length
        ? articles.map((article) => `${article.title} (${article.source})`).join(" | ")
        : "No articles found."
    };
  }

  if (api.id === "search_duckduckgo") {
    const relatedTopics = Array.isArray(raw.RelatedTopics) ? raw.RelatedTopics : [];
    const normalized = {
      query: context.query,
      abstract: raw.AbstractText || "",
      heading: raw.Heading || "",
      relatedTopics: relatedTopics
        .flatMap((topic) => (topic.Topics ? topic.Topics : [topic]))
        .slice(0, 5)
        .map((topic) => ({
          text: truncate(topic.Text),
          url: topic.FirstURL
        }))
    };

    return {
      sourceType: "api",
      sourceName: api.name,
      capability: context.capability,
      raw,
      normalized,
      summaryText:
        normalized.abstract ||
        normalized.relatedTopics.map((topic) => topic.text).join(" | ") ||
        "No instant answer found."
    };
  }

  if (api.id === "translation_mymemory") {
    const translatedText = raw.responseData?.translatedText || "";
    const normalized = {
      sourceLanguage: context.sourceLanguage,
      targetLanguage: context.targetLanguage,
      translatedText
    };

    return {
      sourceType: "api",
      sourceName: api.name,
      capability: context.capability,
      raw,
      normalized,
      summaryText: translatedText || "No translation available."
    };
  }

  if (api.id === "movies_omdb") {
    const movies = (raw.Search || []).slice(0, 5).map((movie) => ({
      title: movie.Title,
      year: movie.Year,
      imdbId: movie.imdbID
    }));

    return {
      sourceType: "api",
      sourceName: api.name,
      capability: context.capability,
      raw,
      normalized: { query: context.query, movies },
      summaryText: movies.length
        ? movies.map((movie) => `${movie.title} (${movie.year})`).join(" | ")
        : raw.Error || "No movie found."
    };
  }

  if (api.id === "sports_thesportsdb") {
    const events = (raw.event || raw.events || []).slice(0, 5).map((event) => ({
      event: event.strEvent,
      league: event.strLeague,
      date: event.dateEvent,
      score:
        event.intHomeScore && event.intAwayScore
          ? `${event.intHomeScore}-${event.intAwayScore}`
          : "scheduled"
    }));

    return {
      sourceType: "api",
      sourceName: api.name,
      capability: context.capability,
      raw,
      normalized: { team: context.team, events },
      summaryText: events.length
        ? events.map((event) => `${event.event} (${event.score})`).join(" | ")
        : "No sports data found."
    };
  }

  if (api.id === "musicbrainz_search") {
    const artists = (raw.artists || []).slice(0, 5).map((artist) => ({
      name: artist.name,
      country: artist.country || null,
      score: artist.score || null
    }));

    return {
      sourceType: "api",
      sourceName: api.name,
      capability: context.capability,
      raw,
      normalized: { query: context.query, artists },
      summaryText: artists.length
        ? artists.map((artist) => `${artist.name}${artist.country ? ` (${artist.country})` : ""}`).join(" | ")
        : "No artist found."
    };
  }

  if (api.id === "public_worldbank") {
    return {
      sourceType: "api",
      sourceName: api.name,
      capability: context.capability,
      raw,
      normalized: { data: raw },
      summaryText: "World Bank data retrieved."
    };
  }

  if (api.id === "huggingface_models") {
    const models = (Array.isArray(raw) ? raw : []).slice(0, 5).map((model) => ({
      id: model.id,
      downloads: model.downloads
    }));

    return {
      sourceType: "api",
      sourceName: api.name,
      capability: context.capability,
      raw,
      normalized: { query: context.query, models },
      summaryText: models.length
        ? models.map((model) => `${model.id} (${model.downloads || 0} downloads)`).join(" | ")
        : "No model found."
    };
  }

  if (api.id === "stackexchange_search") {
    const items = (raw.items || []).slice(0, 5).map((item) => ({
      title: item.title,
      score: item.score,
      link: item.link
    }));

    return {
      sourceType: "api",
      sourceName: api.name,
      capability: context.capability,
      raw,
      normalized: { query: context.query, items },
      summaryText: items.length
        ? items.map((item) => `${item.title} (score ${item.score})`).join(" | ")
        : "No result found."
    };
  }

  if (api.id === "dummyjson_products") {
    const products = (raw.products || []).slice(0, 5).map((product) => ({
      title: product.title,
      price: product.price
    }));

    return {
      sourceType: "api",
      sourceName: api.name,
      capability: context.capability,
      raw,
      normalized: { query: context.query, products },
      summaryText: products.length
        ? products.map((product) => `${product.title} ($${product.price})`).join(" | ")
        : "No product found."
    };
  }

  if (api.id === "jina_reader") {
    const text = typeof raw === "string" ? truncate(raw, 300) : "Readable content retrieved.";

    return {
      sourceType: "api",
      sourceName: api.name,
      capability: context.capability,
      raw,
      normalized: { text },
      summaryText: text
    };
  }

  return null;
}

