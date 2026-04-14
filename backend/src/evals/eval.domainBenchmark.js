import fs from "node:fs";
import path from "node:path";

function ensureDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function round(value) {
  return Number(Number(value || 0).toFixed(2));
}

export const DEFAULT_DOMAIN_SUITE = {
  simple_chat: [
    "salut",
    "explique simplement ce qu est hydria"
  ],
  data_lookup: [
    "quel temps fait il a paris",
    "traduis hello world en espagnol"
  ],
  compare: [
    "compare sqlite et postgresql pour une app locale",
    "compare react et vue pour un petit produit saas"
  ],
  coding_ui: [
    "inspect le rendu de localhost:3001 et trouve les bugs visibles",
    "debug le projet hydria et trouve les points fragiles du routeur"
  ],
  github_research: [
    "trouve une bonne architecture node express auth",
    "cherche un repo react admin dashboard propre",
    "analyse un repo utile pour un agent github",
    "compare 2 repos backend simples"
  ],
  project_delivery: [
    "fais le scaffold d'une API backend Node.js avec Express et JWT"
  ],
  browser_runtime: [
    "ouvre http://localhost:3001 et liste les liens principaux visibles"
  ]
};

function summarizeDomain(entries = []) {
  const total = entries.length || 1;
  const succeeded = entries.filter((entry) => entry.success).length;
  const avgScore =
    entries.reduce((sum, entry) => sum + Number(entry.criticScore || 0), 0) / total;
  const avgDurationMs =
    entries.reduce((sum, entry) => sum + Number(entry.durationMs || 0), 0) / total;

  return {
    count: entries.length,
    successRate: round((succeeded / total) * 100),
    avgScore: round(avgScore),
    avgDurationMs: round(avgDurationMs)
  };
}

function compareRuns(previous = null, current = null) {
  if (!previous || !current) {
    return null;
  }

  const domains = new Set([
    ...Object.keys(previous.byDomain || {}),
    ...Object.keys(current.byDomain || {})
  ]);

  const deltas = {};

  for (const domain of domains) {
    const prev = previous.byDomain?.[domain];
    const curr = current.byDomain?.[domain];
    if (!prev || !curr) {
      continue;
    }

    deltas[domain] = {
      scoreDelta: round(curr.avgScore - prev.avgScore),
      durationDeltaMs: round(curr.avgDurationMs - prev.avgDurationMs),
      successRateDelta: round(curr.successRate - prev.successRate)
    };
  }

  return deltas;
}

function groupByDomain(entries = []) {
  const grouped = {};
  for (const entry of entries) {
    if (!grouped[entry.domain]) {
      grouped[entry.domain] = [];
    }
    grouped[entry.domain].push(entry);
  }
  return grouped;
}

export class DomainBenchmarkRunner {
  constructor({
    outputDir,
    brain,
    createUser,
    suite = DEFAULT_DOMAIN_SUITE
  }) {
    this.outputDir = outputDir;
    this.brain = brain;
    this.createUser = createUser;
    this.suite = suite;
    ensureDirectory(path.join(outputDir, "domain-benchmark-latest.json"));
  }

  loadLatestRun() {
    const latestPath = path.join(this.outputDir, "domain-benchmark-latest.json");
    if (!fs.existsSync(latestPath)) {
      return null;
    }

    try {
      return JSON.parse(fs.readFileSync(latestPath, "utf8"));
    } catch {
      return null;
    }
  }

  saveRun(run) {
    const latestPath = path.join(this.outputDir, "domain-benchmark-latest.json");
    const timestampedPath = path.join(
      this.outputDir,
      `domain-benchmark-${run.timestamp.replace(/[:.]/g, "-")}.json`
    );
    fs.writeFileSync(latestPath, JSON.stringify(run, null, 2));
    fs.writeFileSync(timestampedPath, JSON.stringify(run, null, 2));
    return {
      latestPath,
      timestampedPath
    };
  }

  async run() {
    const previousRun = this.loadLatestRun();
    const results = [];

    for (const [domain, prompts] of Object.entries(this.suite)) {
      for (const prompt of prompts) {
        const user = this.createUser(`benchmark-${domain}`);
        const startedAt = Date.now();
        const response = await this.brain.processChat({
          userId: user.id,
          prompt
        });
        results.push({
          domain,
          prompt,
          success: Boolean(response.success),
          classification: response.classification,
          criticScore: Number(response.eval?.score || 0),
          durationMs: Date.now() - startedAt,
          modelsUsed: response.modelsUsed || [],
          apisUsed: response.apisUsed || [],
          toolsUsed: response.toolsUsed || [],
          strategy: response.strategy || "",
          finalAnswerPreview: String(response.finalAnswer || "").slice(0, 220)
        });
      }
    }

    const grouped = groupByDomain(results);
    const byDomain = Object.fromEntries(
      Object.entries(grouped).map(([domain, entries]) => [domain, summarizeDomain(entries)])
    );
    const overall = summarizeDomain(results);
    const run = {
      timestamp: new Date().toISOString(),
      overall,
      byDomain,
      deltasVsPrevious: compareRuns(previousRun, {
        byDomain
      }),
      results
    };
    const saved = this.saveRun(run);

    return {
      ...run,
      files: saved
    };
  }
}

export default {
  DomainBenchmarkRunner,
  DEFAULT_DOMAIN_SUITE
};
