import { GitHubClientError } from "./github.client.js";
import { discoverRepositoriesViaWeb } from "./github.discovery.js";
import { buildRepositorySearchFilters, normalizeGitHubQuery } from "./github.query.js";
import { normalizeCodeResult, normalizeRepository } from "./github.types.js";

function isoDateDaysAgo(days = 0) {
  if (!days) {
    return "";
  }

  const date = new Date(Date.now() - days * 86400000);
  return date.toISOString().slice(0, 10);
}

function uniqBy(items = [], iteratee) {
  const seen = new Set();
  const unique = [];

  for (const item of items) {
    const key = iteratee(item);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(item);
  }

  return unique;
}

function buildRepoQuery(query, filters = {}) {
  const parts = [String(query || "").trim()].filter(Boolean);

  if (filters.language) {
    parts.push(`language:${filters.language}`);
  }

  if (filters.minStars) {
    parts.push(`stars:>=${filters.minStars}`);
  }

  if (filters.archived === false) {
    parts.push("archived:false");
  }

  if (filters.updatedWithinDays) {
    parts.push(`pushed:>=${isoDateDaysAgo(filters.updatedWithinDays)}`);
  }

  return parts.join(" ").trim();
}

function normalizeSearchError(error) {
  if (error instanceof GitHubClientError) {
    return {
      message: error.message,
      status: error.status,
      isRateLimit: error.isRateLimit,
      rateLimitRemaining: error.rateLimitRemaining,
      rateLimitResetAt: error.rateLimitResetAt
    };
  }

  return {
    message: error.message || String(error)
  };
}

async function runRepositorySearch(client, query, filters = {}) {
  const data = await client.request("/search/repositories", {
    searchParams: {
      q: buildRepoQuery(query, filters),
      sort: filters.sort || "stars",
      order: filters.order || "desc",
      per_page: filters.perPage || 8
    }
  });

  return {
    query,
    totalCount: Number(data.total_count || 0),
    items: (data.items || []).map(normalizeRepository)
  };
}

export async function searchRepositories(client, task, filters = {}) {
  const queryInfo =
    typeof task === "string"
      ? normalizeGitHubQuery(task)
      : {
          ...normalizeGitHubQuery(task?.prompt || task?.query || ""),
          ...(task || {})
        };
  const effectiveFilters = {
    ...buildRepositorySearchFilters({
      prompt: task?.prompt || task?.query || task || "",
      filters
    }),
    ...filters
  };
  const variants = uniqBy(
    [queryInfo.primaryQuery, ...(queryInfo.fallbackQueries || [])].filter(Boolean),
    (item) => item
  );
  const collected = [];
  const errors = [];
  let fallbackUsed = false;
  let rateLimited = false;

  for (const [index, variant] of variants.entries()) {
    try {
      const result = await runRepositorySearch(client, variant, effectiveFilters);
      collected.push(...result.items);
      if (index > 0 && result.items.length) {
        fallbackUsed = true;
      }
      if (collected.length >= effectiveFilters.perPage) {
        break;
      }
    } catch (error) {
      errors.push(normalizeSearchError(error));
      if (error instanceof GitHubClientError && error.isRateLimit) {
        rateLimited = true;
        break;
      }
    }
  }

  if (
    !rateLimited &&
    collected.length < Math.min(3, effectiveFilters.perPage) &&
    effectiveFilters.minStars > 0
  ) {
    fallbackUsed = true;
    try {
      const relaxed = await runRepositorySearch(client, queryInfo.primaryQuery, {
        ...effectiveFilters,
        minStars: Math.max(0, Math.floor(effectiveFilters.minStars / 2)),
        updatedWithinDays: 0
      });
      collected.push(...relaxed.items);
    } catch (error) {
      errors.push(normalizeSearchError(error));
    }
  }

  let items = uniqBy(collected, (repo) => repo.fullName).slice(0, effectiveFilters.perPage);

  if (items.length < Math.min(3, effectiveFilters.perPage)) {
    const webFallback = await discoverRepositoriesViaWeb(queryInfo, effectiveFilters, {
      maxResults: effectiveFilters.perPage
    });
    items = uniqBy([...items, ...(webFallback.items || [])], (repo) => repo.fullName).slice(
      0,
      effectiveFilters.perPage
    );
    fallbackUsed = fallbackUsed || webFallback.fallbackUsed || Boolean(webFallback.items?.length);
    errors.push(...(webFallback.errors || []));
  }

  return {
    totalCount: items.length,
    items,
    queryInfo,
    filters: effectiveFilters,
    fallbackUsed,
    errors,
    rateLimited
  };
}

export async function searchCode(client, query, filters = {}) {
  const qualifiedQuery = [
    String(query || "").trim(),
    filters.repo ? `repo:${filters.repo}` : "",
    filters.language ? `language:${filters.language}` : ""
  ]
    .filter(Boolean)
    .join(" ");

  try {
    const data = await client.request("/search/code", {
      searchParams: {
        q: qualifiedQuery,
        per_page: filters.perPage || 8
      }
    });

    return {
      totalCount: Number(data.total_count || 0),
      items: (data.items || []).map(normalizeCodeResult),
      query: qualifiedQuery,
      errors: []
    };
  } catch (error) {
    return {
      totalCount: 0,
      items: [],
      query: qualifiedQuery,
      errors: [normalizeSearchError(error)]
    };
  }
}

export { normalizeGitHubQuery, buildRepositorySearchFilters };
