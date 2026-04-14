import { BaseAgent } from "./BaseAgent.js";
import GitHubClient from "../integrations/github/github.client.js";
import {
  buildRepositorySearchFilters,
  normalizeGitHubQuery,
  searchCode,
  searchRepositories
} from "../integrations/github/github.search.js";
import {
  cloneRepository,
  getFileContent,
  getRepoStructure,
  searchLocalRepositoryCode
} from "../integrations/github/github.repo.js";
import {
  analyzeLocalRepository,
  analyzeRepository as analyzeRemoteRepository
} from "../integrations/github/github.analysis.js";
import {
  rankRepositoryCandidates,
  rerankRepositoryAnalyses
} from "../integrations/github/github.ranking.js";
import { buildPatternSummary } from "../integrations/github/repoPatternExtractor.js";
import { presentGitHubResearch } from "../integrations/github/githubResearchPresenter.js";
import { detectGitHubNeed } from "../integrations/github/github.intent.js";
import {
  buildLearningGuidance,
  summarizeLearningUsage
} from "../learning/learning.reuse.js";
import { extractLearningFromTask } from "../learning/learning.extractor.js";

function truncate(value = "", maxChars = 220) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxChars) {
    return text;
  }

  return `${text.slice(0, maxChars - 3)}...`;
}

function buildConfidence(analyses = [], errors = []) {
  if (!analyses.length) {
    return "low";
  }

  const highCount = analyses.filter((analysis) => analysis.confidence === "high").length;
  if (highCount >= 2 && !errors.length) {
    return "high";
  }

  if (highCount >= 1 || analyses.length >= 2) {
    return "medium";
  }

  return "low";
}

function summarizeAnalyzedRepo(analysis = {}) {
  return {
    fullName: analysis.repository.fullName,
    description: analysis.repository.description || "",
    language: analysis.repository.language,
    stars: analysis.repository.stars,
    ranking: analysis.ranking,
    confidence: analysis.confidence,
    analysisMode: analysis.analysisMode || "api",
    stack: analysis.stack,
    architecture: analysis.architecture,
    keyFiles: analysis.summary?.keyFiles || [],
    importantPaths: analysis.summary?.importantPaths || [],
    patterns: analysis.patterns || [],
    limits: analysis.limits || []
  };
}

function mergeGitHubFilters(baseFilters = {}, explicitFilters = {}) {
  return {
    ...baseFilters,
    language: explicitFilters.language || baseFilters.language || "",
    minStars:
      explicitFilters.minStars && explicitFilters.minStars > 0
        ? explicitFilters.minStars
        : baseFilters.minStars || 0,
    updatedWithinDays:
      explicitFilters.updatedWithinDays && explicitFilters.updatedWithinDays > 0
        ? explicitFilters.updatedWithinDays
        : baseFilters.updatedWithinDays || 0
  };
}

function normalizeToolSummary({ rankedAnalyses = [], patternSummary = [], codeMatches = [], repoSearch = {}, errors = [] }) {
  return {
    query: repoSearch.queryInfo?.primaryQuery || "",
    filters: repoSearch.filters || {},
    fallbackUsed: Boolean(repoSearch.fallbackUsed),
    repositories: rankedAnalyses.slice(0, 3).map(summarizeAnalyzedRepo),
    patterns: patternSummary,
    codeMatches: codeMatches.slice(0, 6),
    confidence: buildConfidence(rankedAnalyses, errors),
    errors
  };
}

function selectAnalysisTargets(initialRanking = [], maxAnalyzedRepos = 3) {
  return initialRanking.slice(0, Math.max(maxAnalyzedRepos + 1, maxAnalyzedRepos));
}

export class GitAgent extends BaseAgent {
  constructor({ config, brainProvider }) {
    super({
      id: "git_agent",
      label: "Git Agent",
      role: "github repository search and implementation pattern analysis"
    });

    this.config = config;
    this.brainProvider = brainProvider;
    this.client = new GitHubClient({
      apiBaseUrl: config.github.apiBaseUrl,
      token: config.github.token
    });
  }

  async findRelevantRepos(task, filters = {}) {
    const taskPrompt = typeof task === "string" ? task : task?.prompt || task?.query || "";
    return searchRepositories(
      this.client,
      {
        prompt: taskPrompt,
        query: typeof task === "string" ? task : task?.query || taskPrompt,
        filters
      },
      filters
    );
  }

  async analyzeRepoStructure(repo) {
    return getRepoStructure(this.client, repo);
  }

  async ensureLocalClone(repo, localPath = "") {
    return this.cloneRepo(repo, localPath);
  }

  async analyzeRepository(repo, taskContext = {}) {
    try {
      return await analyzeRemoteRepository(this.client, repo, taskContext);
    } catch (error) {
      const cloneResult = await this.ensureLocalClone(repo);
      if (!cloneResult.success) {
        throw new Error(
          `GitHub API analysis failed (${error.message}) and local clone fallback also failed (${cloneResult.stderr || cloneResult.error || "unknown clone error"})`
        );
      }

      const localAnalysis = await analyzeLocalRepository(
        cloneResult.localPath,
        cloneResult.repository,
        taskContext
      );
      localAnalysis.limits = [
        ...(localAnalysis.limits || []),
        `fallback_reason:${error.message}`
      ];
      return localAnalysis;
    }
  }

  async locateCode(query, repo = "", filters = {}) {
    if (!query) {
      return {
        totalCount: 0,
        items: [],
        errors: []
      };
    }

    const codeResult = await searchCode(this.client, query, {
      perPage: this.config.github.maxCodeResults,
      repo,
      ...filters
    });

    if (codeResult.items?.length || !repo) {
      return codeResult;
    }

    const cloneResult = await this.ensureLocalClone(repo);
    if (!cloneResult.success) {
      return codeResult;
    }

    return searchLocalRepositoryCode(cloneResult.localPath, query, {
      repo,
      limit: this.config.github.maxCodeResults
    });
  }

  async readRepoFile(repo, filePath) {
    return getFileContent(this.client, repo, filePath);
  }

  async cloneRepo(repo, localPath = "") {
    return cloneRepository(this.client, repo, this.config.github.cloneRoot, {
      localPath
    });
  }

  async execute({ prompt, filters = {}, repo = "", action = "", existingLearnings = [] } = {}) {
    const detected = detectGitHubNeed(prompt || "") || {
      action: action || "search",
      repoRef: repo,
      query: prompt || repo,
      filters
    };
    const queryInfo = normalizeGitHubQuery(prompt || detected.query || repo);
    const effectiveFilters = mergeGitHubFilters(
      buildRepositorySearchFilters({
        prompt: prompt || detected.query || repo,
        filters: {
          ...detected.filters,
          ...filters
        }
      }),
      {
        ...detected.filters,
        ...filters
      }
    );
    const errors = [];

    if (detected.action === "clone" && detected.repoRef) {
      const cloneResult = await this.cloneRepo(detected.repoRef);
      return {
        providerId: this.id,
        sourceType: "tool",
        sourceName: "Git Agent",
        capability: "github_clone",
        raw: cloneResult,
        normalized: cloneResult,
        summaryText: cloneResult.success
          ? `Repository cloned: ${cloneResult.repository.fullName} -> ${cloneResult.localPath}`
          : `Repository clone failed for ${detected.repoRef}: ${cloneResult.stderr || cloneResult.stdout || "unknown error"}`,
        artifacts: []
      };
    }

    let repoSearch;
    if (detected.repoRef && detected.action === "analyze") {
      repoSearch = {
        totalCount: 1,
        items: [],
        queryInfo,
        filters: effectiveFilters,
        fallbackUsed: false,
        errors: []
      };
    } else {
      repoSearch = await this.findRelevantRepos(
        {
          prompt: prompt || detected.query,
          query: detected.query || queryInfo.primaryQuery
        },
        effectiveFilters
      );
      errors.push(...(repoSearch.errors || []).map((item) => item.message || String(item)));
    }

    const initialRanking = rankRepositoryCandidates(repoSearch.items || [], {
      prompt,
      queryInfo: repoSearch.queryInfo || queryInfo,
      filters: repoSearch.filters || effectiveFilters,
      learnings: existingLearnings
    });

    const candidatesToAnalyze = selectAnalysisTargets(
      initialRanking,
      this.config.github.maxAnalyzedRepos
    );

    if (detected.repoRef && !candidatesToAnalyze.some((entry) => entry.repository.fullName === detected.repoRef)) {
      candidatesToAnalyze.unshift({
        repository: {
          fullName: detected.repoRef,
          name: detected.repoRef.split("/").pop() || detected.repoRef,
          owner: detected.repoRef.split("/")[0] || "",
          language: effectiveFilters.language || "",
          stars: 0,
          description: "",
          updatedAt: null,
          archived: false,
          topics: []
        },
        score: 0,
        reasons: ["direct repository reference"],
        signals: {}
      });
    }

    const repoAnalyses = [];

    for (const rankedEntry of candidatesToAnalyze) {
      try {
        const analysis = await this.analyzeRepository(rankedEntry.repository.fullName, {
          prompt,
          queryInfo
        });
        repoAnalyses.push(analysis);
      } catch (error) {
        errors.push(`analysis:${rankedEntry.repository.fullName}:${error.message}`);
      }
    }

    const rankedAnalyses = rerankRepositoryAnalyses(repoAnalyses, {
      prompt,
      queryInfo: repoSearch.queryInfo || queryInfo,
      filters: repoSearch.filters || effectiveFilters,
      learnings: existingLearnings
    }).slice(0, this.config.github.maxAnalyzedRepos);

    const patternSummary = buildPatternSummary(
      rankedAnalyses.flatMap((analysis) => analysis.patterns || [])
    );
    const codeMatches = [];
    const codeQuery = detected.codeQuery || queryInfo.codeQuery;

    if (codeQuery) {
      for (const analysis of rankedAnalyses.slice(0, 2)) {
        const codeSearch = await this.locateCode(codeQuery, analysis.repository.fullName, {
          language: effectiveFilters.language
        });
        codeMatches.push(
          ...(codeSearch.items || []).slice(0, 2).map((item) => ({
            ...item,
            repository: item.repository?.fullName
              ? item.repository
              : {
                  fullName: analysis.repository.fullName,
                  owner: analysis.repository.owner,
                  name: analysis.repository.name
                }
          }))
        );
        errors.push(...(codeSearch.errors || []).map((item) => item.message || String(item)));
      }
    }

    const summaryText = presentGitHubResearch({
      prompt,
      queryInfo: repoSearch.queryInfo || queryInfo,
      filters: repoSearch.filters || effectiveFilters,
      rankedAnalyses,
      patternSummary,
      codeMatches,
      learningGuidance: buildLearningGuidance(existingLearnings, {
        domain: "github_research",
        projectType: "external"
      }),
      reusedLearnings: summarizeLearningUsage(existingLearnings),
      searchMeta: {
        fallbackUsed: repoSearch.fallbackUsed,
        totalCount: repoSearch.totalCount
      },
      errors
    });

    const learningCandidates = extractLearningFromTask(
      {
        normalized: normalizeToolSummary({
          rankedAnalyses,
          patternSummary,
          codeMatches,
          repoSearch,
          errors
        })
      },
      {
        kind: "github_research",
        prompt,
        classification: "github_research",
        domain: "github_research",
        repo: rankedAnalyses[0]?.repository?.fullName || "",
        projectType: "external"
      }
    );

    return {
      providerId: this.id,
      sourceType: "tool",
      sourceName: "Git Agent",
      capability: "github_research",
      raw: {
        prompt,
        detected,
        repoSearch,
        initialRanking,
        rankedAnalyses,
        patternSummary,
        codeMatches,
        errors
      },
      normalized: normalizeToolSummary({
        rankedAnalyses,
        patternSummary,
        codeMatches,
        repoSearch,
        errors
      }),
      summaryText,
      artifacts: [],
      learningCandidates,
      reusedLearnings: summarizeLearningUsage(existingLearnings)
    };
  }
}

export default GitAgent;
