import { buildCleanLimitationNote } from "./userFacingFormatter.js";

function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function detectLanguage(prompt = "") {
  return /\b(le|la|les|des|une|un|pour|avec|sans|quel|quelle|compare|cree|propose|analyse|backend|frontend|dashboard)\b/.test(
    normalizeText(prompt)
  )
    ? "fr"
    : "en";
}

function truncate(value = "", maxChars = 220) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxChars) {
    return text;
  }

  return `${text.slice(0, maxChars - 3)}...`;
}

function toFrenchDomainPhrase(value = "") {
  const normalized = normalizeText(value);
  if (normalized.includes("route and business logic are separated")) {
    return "separation nette entre routes, controllers et services";
  }
  if (normalized.includes("authentication concerns are isolated")) {
    return "module d'authentification isole avec middleware et logique utilisateur dediee";
  }
  if (normalized.includes("ui code is organized into pages, components, layouts")) {
    return "organisation frontend par pages, composants, layouts et hooks";
  }
  if (normalized.includes("apps, packages, or libs are split")) {
    return "separation claire entre applications, packages ou librairies";
  }
  if (normalized.includes("the repository includes explicit tests")) {
    return "presence de tests explicites comme garde-fou qualite";
  }
  if (normalized.includes("documentation is separated")) {
    return "documentation separee pour faciliter l'onboarding et la maintenance";
  }
  if (normalized.includes("github-specific concerns are isolated")) {
    return "isolation claire des integrations GitHub";
  }
  if (normalized.includes("agent-related concerns are separated")) {
    return "separation claire entre coeur agentique, outils et integrations";
  }
  if (normalized.includes("dedicated auth or user boundary")) {
    return "separation claire autour de l'authentification et des utilisateurs";
  }
  if (normalized.includes("layered backend structure")) {
    return "structure backend par couches";
  }
  if (normalized.includes("frontend split into pages/components/layouts")) {
    return "separation frontend entre pages, composants et layouts";
  }
  if (normalized.includes("separate documentation surface")) {
    return "documentation distincte";
  }

  return value;
}

function toFrenchLearningLine(value = "") {
  const normalized = normalizeText(value);
  if (normalized.includes("route and business logic are separated")) {
    return "la separation routes / controllers / services reste un pattern fiable pour garder un backend maintenable";
  }
  if (normalized.includes("github-specific concerns are isolated")) {
    return "isoler les integrations GitHub et leur logique d'automatisation simplifie fortement la maintenance";
  }
  if (normalized.includes("execution flow knowledge -> research_agent -> llm")) {
    return "sur ce type de tache, la sequence connaissance -> recherche -> synthese fonctionne bien";
  }
  if (normalized.includes("execution flow knowledge -> git_agent -> research_agent -> llm")) {
    return "sur ce type de tache, la combinaison connaissance -> recherche GitHub -> synthese produit une recommandation exploitable";
  }
  if (normalized.includes("worked best with a staged flow using knowledge, git_agent, research_agent, llm")) {
    return "un flux progressif connaissance -> GitHub -> recherche -> synthese donne de meilleurs resultats qu'une simple reponse brute";
  }
  if (normalized.includes("worked best with a staged flow using knowledge, git_agent, research_agent")) {
    return "un flux progressif connaissance -> GitHub -> recherche donne de meilleurs resultats qu'une simple reponse brute";
  }
  if (normalized.includes("worked best with a staged flow using knowledge, git_agent")) {
    return "le couplage connaissance + GitHub est utile quand il faut recommander une structure concrete";
  }
  if (normalized.includes("worked best with a staged flow using knowledge, research_agent, llm")) {
    return "un flux progressif connaissance -> recherche -> synthese donne de meilleurs resultats qu'une simple reponse brute";
  }
  if (normalized.includes("usable build result")) {
    return "ce pattern de construction a deja produit un resultat exploitable";
  }
  if (normalized.includes("usable compare result")) {
    return "ce pattern de comparaison a deja produit une recommandation exploitable";
  }

  return value;
}

function findGitResult(toolResults = []) {
  return toolResults.find(
    (result) => result?.providerId === "git_agent" || result?.sourceName === "Git Agent"
  ) || null;
}

function findResearchResult(toolResults = []) {
  return toolResults.find(
    (result) => result?.providerId === "research_agent" || result?.sourceName === "Research Agent"
  ) || null;
}

function collectRepoPatterns(gitResult = null) {
  return (gitResult?.normalized?.patterns || []).slice(0, 4);
}

function collectRepos(gitResult = null) {
  return (gitResult?.normalized?.repositories || []).slice(0, 3);
}

function isBuildLikePrompt(prompt = "", classification = "", domain = "") {
  const normalized = normalizeText(prompt);
  return classification === "coding" ||
    /\b(create|build|cree|propose|scaffold|implement|api|backend|frontend|dashboard|auth|jwt|architecture)\b/.test(normalized) ||
    ["coding", "reasoning"].includes(domain);
}

function isRepoComparePrompt(prompt = "", classification = "") {
  return classification === "compare" || /\b(compare|comparaison|vs|versus)\b/.test(normalizeText(prompt));
}

function isBackendAuthPrompt(prompt = "") {
  const normalized = normalizeText(prompt);
  return /\b(auth|authentication|jwt|signup|login|signin|token|refresh token)\b/.test(normalized) &&
    /\b(node|express|backend|api)\b/.test(normalized);
}

function isFrontendDashboardPrompt(prompt = "") {
  return /\b(react|frontend|ui|dashboard|admin|layout|component)\b/.test(normalizeText(prompt));
}

function buildRepoRecommendationLine(repo = {}, language = "fr") {
  const architecture = language === "fr"
    ? toFrenchDomainPhrase(repo.architecture?.summary || "structure modulaire")
    : repo.architecture?.summary || "modular structure";
  return language === "fr"
    ? `${repo.fullName} est le point de depart le plus convaincant, surtout pour sa ${architecture}.`
    : `${repo.fullName} is the most convincing starting point, especially because of its ${architecture}.`;
}

function buildPatternBullets(patterns = [], language = "fr") {
  return patterns.slice(0, 3).map((pattern) =>
    language === "fr"
      ? `- ${toFrenchDomainPhrase(pattern.description)}`
      : `- ${pattern.description}`
  );
}

function buildLearningBullets(learnings = [], language = "fr") {
  return (learnings || []).slice(0, 2).map((item) =>
    language === "fr"
      ? `- ${toFrenchLearningLine(item.description)}`
      : `- ${item.description}`
  );
}

function buildBackendAuthSolution({ prompt, repos, patterns, learnings, language }) {
  const bestRepo = repos[0];
  const repoLine = bestRepo ? buildRepoRecommendationLine(bestRepo, language) : "";
  const structureLines = [
    "- `src/app.js` ou `src/server.js` pour le bootstrap",
    "- `src/routes/auth.routes.js` pour les endpoints signup/login",
    "- `src/controllers/auth.controller.js` pour la couche HTTP",
    "- `src/services/auth.service.js` pour la logique JWT, hash, login/signup",
    "- `src/middlewares/auth.middleware.js` pour proteger les routes",
    "- `src/validators/auth.schemas.js` pour la validation d'entree",
    "- `src/repositories/user.repository.js` si tu veux isoler l'acces donnees",
    "- `tests/auth/*.test.js` pour les cas signup/login et middleware"
  ];
  const reasons = [
    "- la separation routes / controllers / services revient dans les repos les plus utiles",
    "- l'authentification reste isolee, donc plus facile a faire evoluer",
    "- la validation et les tests reduisent les regressions sur les flux sensibles"
  ];
  const improvements = [
    "- ajouter refresh token + rotation si tu prevois de vraies sessions longues",
    "- centraliser les erreurs et la validation d'environnement",
    "- ajouter rate limiting et journalisation de securite sur login/signup"
  ];

  return [
    "Ce que je te recommande",
    "- partir sur une API Express structuree par couches, avec auth middleware, validation d'entree et tests autour des flux signup/login",
    "Architecture recommandee",
    ...structureLines,
    "Pourquoi ce choix",
    ...reasons,
    repoLine ? "Bonnes pratiques observees" : "",
    repoLine || "",
    ...buildPatternBullets(patterns, language),
    ...(learnings?.length ? ["Apprentissages deja valides", ...buildLearningBullets(learnings, language)] : []),
    "Amelioration proposee",
    ...improvements,
    "Prochaine etape",
    "- Je peux ensuite te scaffold le squelette des fichiers ou te generer directement le code signup/login."
  ]
    .filter(Boolean)
    .join("\n");
}

function buildFrontendDashboardSolution({ repos, patterns, learnings, language }) {
  const bestRepo = repos[0];
  return [
    "Ce que je te recommande",
    "- partir sur un dashboard React organise par features, avec un layout admin central et une couche API separee du rendu",
    "Architecture recommandee",
    "- `src/app/router` pour les routes et guards",
    "- `src/layouts/AdminLayout` pour la coque globale",
    "- `src/features/*` par domaine fonctionnel",
    "- `src/components/ui` pour les composants partages",
    "- `src/services/api` pour les appels HTTP",
    "- `src/hooks` pour la logique reutilisable",
    "- `src/pages` uniquement pour l'assemblage d'ecran",
    "Pourquoi ce choix",
    "- la separation par features garde le dashboard evolutif",
    "- le layout et les composants UI partages evitent la duplication",
    "- les appels API restent decouples du rendu",
    bestRepo ? "Base de reference retenue" : "",
    bestRepo ? `- ${buildRepoRecommendationLine(bestRepo, language)}` : "",
    ...buildPatternBullets(patterns, language),
    ...(learnings?.length ? ["Apprentissages deja valides", ...buildLearningBullets(learnings, language)] : []),
    "Amelioration proposee",
    "- prevoir un dossier `permissions` ou `access-control` si l'admin dashboard devient multi-role",
    "Prochaine etape",
    "- Je peux te proposer le squelette exact des dossiers et composants."
  ]
    .filter(Boolean)
    .join("\n");
}

function buildRepoCompareSolution({ repos, patterns, prompt, language }) {
  const [first, second] = repos;
  if (!first) {
    return "";
  }

  const recommendation =
    language === "fr"
      ? `Je prendrais ${first.fullName} comme base.` 
      : `I would start from ${first.fullName}.`;
  const why = [
    first.architecture?.summary
      ? `- structure plus claire: ${toFrenchDomainPhrase(first.architecture.summary)}`
      : "",
    first.keyFiles?.length ? `- fichiers structurants presentes: ${first.keyFiles.slice(0, 4).join(", ")}` : "",
    second?.fullName ? `- ${second.fullName} reste interessant, mais je le garderais plutot comme source d'idees complementaires.` : ""
  ].filter(Boolean);

  return [
    "Recommandation finale",
    recommendation,
    "Pourquoi je le retiens",
    ...why,
    patterns.length ? "Patterns a reutiliser" : "",
    ...buildPatternBullets(patterns, language),
    "Comment l'appliquer a ton cas",
    language === "fr"
      ? `- garde la structure generale de ${first.fullName}, mais adapte les modules exacts a ${truncate(prompt, 120)}`
      : `- keep the overall structure from ${first.fullName}, but adapt the concrete modules to ${truncate(prompt, 120)}`
  ]
    .filter(Boolean)
    .join("\n");
}

function buildGitHydriaSolution({ repos, patterns, learnings, language }) {
  const bestRepo = repos[0];
  return [
    "Ce que je retiens",
    bestRepo ? `- ${buildRepoRecommendationLine(bestRepo, language)}` : "",
    ...buildPatternBullets(patterns, language),
    "Recommendation pour Hydria",
    "- garder une separation nette entre integrations GitHub, analyse de repo, ranking et presentation finale",
    "- reutiliser les patterns detectes comme support de decision, pas comme reponse brute",
    ...(learnings?.length ? ["Apprentissages deja valides", ...buildLearningBullets(learnings, language)] : []),
    "Application concrete",
    "- pour Hydria, le plus utile est de transformer la recherche GitHub en architecture et recommandations exploitables, pas en simple liste de repos"
  ]
    .filter(Boolean)
    .join("\n");
}

function buildGenericResearchDecision({ repos, patterns, learnings, language }) {
  const bestRepo = repos[0];
  return [
    "Recommandation finale",
    bestRepo ? `- ${buildRepoRecommendationLine(bestRepo, language)}` : "- Je retiens surtout les patterns communs aux meilleurs repos.",
    "Ce que je retiens vraiment",
    ...buildPatternBullets(patterns, language),
    ...(learnings?.length ? ["Apprentissages deja valides", ...buildLearningBullets(learnings, language)] : []),
    "Comment l'appliquer",
    "- je te recommande de reprendre la structure, pas de copier un repo tel quel"
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildSolutionSynthesis({ baseAnswer = "", context = {}, synthesis = {} } = {}) {
  const gitResult = findGitResult(context.toolResults || []);
  const researchResult = findResearchResult(context.toolResults || []);
  const repos = collectRepos(gitResult);
  const patterns = collectRepoPatterns(gitResult);
  const learnings = context.reusedLearnings || [];
  const prompt = context.prompt || "";
  const language = detectLanguage(prompt);

  if (!gitResult && !researchResult) {
    return "";
  }

  if (isRepoComparePrompt(prompt, context.classification)) {
    if (repos.length) {
      return buildRepoCompareSolution({ repos, patterns, prompt, language });
    }

    return baseAnswer || "";
  }

  if (isBuildLikePrompt(prompt, context.classification, context.domainProfile?.id)) {
    if (isBackendAuthPrompt(prompt)) {
      return buildBackendAuthSolution({ prompt, repos, patterns, learnings, language });
    }
    if (isFrontendDashboardPrompt(prompt)) {
      return buildFrontendDashboardSolution({ repos, patterns, learnings, language });
    }
  }

  if (
    context.domainProfile?.id === "github_research" &&
    /\b(hydria|agent|github agent|orchestrator)\b/i.test(prompt)
  ) {
    return buildGitHydriaSolution({ repos, patterns, learnings, language });
  }

  if (context.domainProfile?.id === "github_research" || gitResult) {
    return buildGenericResearchDecision({ repos, patterns, learnings, language });
  }

  return baseAnswer || "";
}

export function buildSolutionLimitNote(context = {}) {
  const gitResult = findGitResult(context.toolResults || []);
  if (!gitResult) {
    return "";
  }

  const hasPartialGithubMetadata = (gitResult.summaryText || "").includes("metadonnees GitHub partielles") ||
    (gitResult.raw?.errors || []).some((error) => /rate limit|metadata|fallback/i.test(String(error)));
  const hasFallback = Boolean(gitResult.normalized?.fallbackUsed);

  return buildCleanLimitationNote({
    language: detectLanguage(context.prompt),
    hasPartialGithubMetadata,
    hasFallback
  });
}

export default {
  buildSolutionSynthesis,
  buildSolutionLimitNote
};
