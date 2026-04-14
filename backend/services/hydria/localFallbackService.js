function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function detectLanguage(prompt = "", preferencesUsed = {}, memoryUsed = []) {
  const preferredLanguage = normalizeText(
    preferencesUsed.preferred_language || preferencesUsed.language || ""
  );

  if (/fr|francais|français/.test(preferredLanguage)) {
    return "fr";
  }

  if (/en|english|anglais/.test(preferredLanguage)) {
    return "en";
  }

  const memoryLanguage = memoryUsed.find(
    (memory) =>
      /preferred language|langue preferee|langue préférée/i.test(memory.content || "") &&
      /(francais|français|english|anglais|fr\b|en\b)/i.test(memory.content || "")
  );

  if (memoryLanguage) {
    return /(francais|français|fr\b)/i.test(memoryLanguage.content || "")
      ? "fr"
      : "en";
  }

  return /\b(le|la|les|des|une|un|pour|avec|sans|salut|bonjour|bonsoir|merci|peux|comment|cours|action|traduis|traduction|idee|idees|projet)\b/.test(
    normalizeText(prompt)
  )
    ? "fr"
    : "en";
}

function collectErrorMessages(artifacts = []) {
  const messages = [];

  for (const artifact of artifacts || []) {
    if (artifact?.error) {
      messages.push(String(artifact.error));
    }

    for (const attempt of artifact?.attempts || []) {
      if (attempt?.error) {
        messages.push(String(attempt.error));
      }
    }
  }

  return messages;
}

function detectFailureMode(artifacts = []) {
  const errors = collectErrorMessages(artifacts);
  const normalized = normalizeText(errors.join("\n"));

  return {
    isRateLimited: /rate limit exceeded|free-models-per-day|quota/.test(normalized),
    isNotConfigured: /not configured|set openrouter_api_key|no llm provider is configured/.test(
      normalized
    ),
    isProviderError: /provider returned error|all configured openrouter models failed|all configured llm providers failed/.test(
      normalized
    ),
    rawErrors: errors
  };
}

function isGreeting(prompt = "") {
  return /^(salut|bonjour|bonsoir|coucou|hello|hi|hey)\b/.test(
    normalizeText(prompt).trim()
  );
}

function isThanks(prompt = "") {
  return /\b(merci|thanks|thank you)\b/.test(normalizeText(prompt));
}

function isCapabilitiesPrompt(prompt = "") {
  return /\b(que peux[- ]?tu faire|what can you do|help|aide|capabilities|fonctionnalites|fonctionnalités)\b/.test(
    normalizeText(prompt)
  );
}

function isPreferenceAckPrompt(prompt = "") {
  return /\b(j'aime|je prefere|retiens|remember|reponses courtes|concis|precis)\b/.test(
    normalizeText(prompt)
  );
}

function isSelfIntroPrompt(prompt = "") {
  return /\b(presente toi|presente-toi|qui es tu|who are you|introduis toi)\b/.test(
    normalizeText(prompt)
  );
}

function buildAvailabilityLine(language, failureMode) {
  if (failureMode.isRateLimited) {
    return language === "fr"
      ? "Le quota LLM distant est atteint pour le moment, donc je bascule en mode local degrade."
      : "The remote LLM quota is currently exhausted, so I am switching to a degraded local mode.";
  }

  if (failureMode.isNotConfigured) {
    return language === "fr"
      ? "Aucun provider LLM n'est configure pour le moment, donc je bascule en mode local degrade."
      : "No LLM provider is configured right now, so I am switching to a degraded local mode.";
  }

  if (failureMode.isProviderError) {
    return language === "fr"
      ? "Le provider modele a echoue pour cette requete, donc je bascule en mode local degrade."
      : "The model provider failed for this request, so I am switching to a degraded local mode.";
  }

  return language === "fr"
    ? "Je n'ai pas de synthese modele exploitable pour cette requete, donc je bascule en mode local degrade."
    : "I do not have a usable model synthesis for this request, so I am switching to a degraded local mode.";
}

function buildMissingInputFallback(language, context = {}) {
  const apiNeed = context.plan?.apiNeed;

  if (!apiNeed) {
    return "";
  }

  if (apiNeed.category === "weather" && !apiNeed.location) {
    return language === "fr"
      ? "Je peux donner la meteo en temps reel, mais il me faut une ville. Donnez-moi simplement une ville comme `Paris` ou `Lyon`."
      : "I can provide the live weather, but I need a city first. Just send a city such as `Paris` or `Lyon`.";
  }

  if (apiNeed.category === "finance" && !apiNeed.symbol) {
    return language === "fr"
      ? "Je peux recuperer un cours de bourse, mais il me faut un symbole comme `AAPL`, `TSLA` ou `MSFT`."
      : "I can fetch a stock quote, but I need a ticker such as `AAPL`, `TSLA`, or `MSFT`.";
  }

  if (apiNeed.category === "translation" && !apiNeed.targetLanguage) {
    return language === "fr"
      ? "Je peux traduire, mais il me faut la langue cible."
      : "I can translate, but I need the target language.";
  }

  return "";
}

function buildCapabilityLine(language, context) {
  const capabilityTokens = [];

  if (context.attachments?.length) {
    capabilityTokens.push(language === "fr" ? "fichiers joints" : "attachments");
  } else {
    capabilityTokens.push(language === "fr" ? "analyse de fichiers" : "file analysis");
  }

  capabilityTokens.push(language === "fr" ? "lecture d'URL" : "URL reading");
  capabilityTokens.push(language === "fr" ? "recherche web" : "web search");
  capabilityTokens.push(language === "fr" ? "APIs externes" : "external APIs");
  capabilityTokens.push(language === "fr" ? "outils locaux" : "local tools");
  capabilityTokens.push(language === "fr" ? "generation de documents" : "document generation");

  return language === "fr"
    ? `Je peux quand meme aider avec ${capabilityTokens.join(", ")}.`
    : `I can still help with ${capabilityTokens.join(", ")}.`;
}

function buildGreetingFallback(language, context, failureMode) {
  return language === "fr"
    ? "Bonjour. Donnez-moi une tache concrete et je m'en charge."
    : "Hello. Give me a concrete task and I will handle it.";
}

function buildCapabilitiesFallback(language, context, failureMode) {
  return [
    buildCapabilityLine(language, context),
    language === "fr"
      ? "Exemples: resume un PDF, lis cette URL, cherche une info recente, compare deux options, inspecte le projet, cree un document."
      : "Examples: summarize a PDF, read this URL, search recent information, compare two options, inspect the project, create a document."
  ].join(" ");
}

function buildThanksFallback(language, failureMode) {
  return language === "fr" ? "Avec plaisir." : "You're welcome.";
}

function buildPreferenceAckFallback(language) {
  return language === "fr"
    ? "C'est note. Je resterai court et precis."
    : "Noted. I will stay short and precise.";
}

function buildSelfIntroFallback(language) {
  return language === "fr"
    ? "Je suis Hydria, un orchestrateur local qui combine LLM, web, APIs, fichiers et outils."
    : "I am Hydria, a local orchestrator that combines LLMs, web, APIs, files, and tools.";
}

function extractBrainstormTopic(prompt = "") {
  const cleaned = String(prompt || "")
    .replace(/\b(donne moi|donne-moi|generate|genere|genere moi|propose|brainstorm|liste|list|idea|ideas|idees|idées|side projects?|projets?|a lancer|à lancer|en solo|solo)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || (normalizeText(prompt).includes("ia") ? "projets IA" : "ce sujet");
}

function extractRequestedCount(prompt = "", fallback = 5) {
  const match = String(prompt || "").match(/\b([3-9]|10)\b/);
  return match ? Number(match[1]) : fallback;
}

function buildBrainstormFallback(language, context = {}, failureMode) {
  const topic = extractBrainstormTopic(context.prompt);
  const count = Math.min(6, Math.max(3, extractRequestedCount(context.prompt, 5)));
  const normalizedTopic = normalizeText(topic);
  const isAiTopic = /\b(ai|ia|agent|rag|llm|automation)\b/.test(normalizedTopic);

  const ideas = isAiTopic
    ? [
        language === "fr"
          ? `Assistant vertical: un copilote specialise sur un metier precis avec base documentaire locale.`
          : `Vertical assistant: a specialized copilot for one profession with a local knowledge base.`,
        language === "fr"
          ? `Audit automatique: un outil qui verifie prompts, sorties et sources pour detecter les faiblesses d'un workflow IA.`
          : `Automatic audit: a tool that checks prompts, outputs, and sources to detect weak points in an AI workflow.`,
        language === "fr"
          ? `Veille assistee: un agent qui surveille un domaine, resume les nouveautes et propose des actions concretes.`
          : `Assisted monitoring: an agent that tracks a domain, summarizes updates, and suggests concrete actions.`,
        language === "fr"
          ? `Generateur de livrables: un service qui transforme notes ou specs en PDF, slides, ou tableaux exploitables.`
          : `Deliverable generator: a service that turns notes or specs into usable PDFs, slides, or tables.`,
        language === "fr"
          ? `Tableau de bord d'evaluation: une app qui compare plusieurs modeles gratuits sur un jeu de prompts metier.`
          : `Evaluation dashboard: an app that compares multiple free models on a business prompt set.`,
        language === "fr"
          ? `Agent d'automatisation personnelle: un orchestrateur local pour mails, docs, et petites taches repetitives.`
          : `Personal automation agent: a local orchestrator for email, docs, and repetitive micro-tasks.`
      ]
    : [
        language === "fr"
          ? `Outil niche: une version tres specialisee pour un seul cas d'usage sur ${topic}.`
          : `Niche tool: a highly specialized version for a single use case around ${topic}.`,
        language === "fr"
          ? `Tableau de bord: une app qui suit les indicateurs, tendances ou resultats lies a ${topic}.`
          : `Dashboard: an app that tracks metrics, trends, or outcomes related to ${topic}.`,
        language === "fr"
          ? `Assistant de production: un copilote qui accelere les taches repetitives autour de ${topic}.`
          : `Production assistant: a copilot that speeds up repetitive work around ${topic}.`,
        language === "fr"
          ? `Bibliotheque de templates: un produit simple qui fournit schemas, workflows ou documents reutilisables pour ${topic}.`
          : `Template library: a simple product providing reusable schemas, workflows, or documents for ${topic}.`,
        language === "fr"
          ? `Service d'analyse: un outil qui prend des donnees ou contenus sur ${topic} et renvoie une synthese actionnable.`
          : `Analysis service: a tool that ingests data or content on ${topic} and returns an actionable synthesis.`,
        language === "fr"
          ? `Comparateur intelligent: un produit qui evalue plusieurs options ou scenarios sur ${topic}.`
          : `Smart comparator: a product that evaluates multiple options or scenarios for ${topic}.`
      ];

  const selectedIdeas = ideas.slice(0, count).map((idea, index) =>
    language === "fr" ? `${index + 1}. ${idea}` : `${index + 1}. ${idea}`
  );

  return [
    buildAvailabilityLine(language, failureMode),
    language === "fr"
      ? `Je propose quand meme une premiere liste exploitable pour ${topic} :`
      : `I can still propose an initial workable list for ${topic}:`,
    ...selectedIdeas,
    language === "fr"
      ? "Priorite: commence par l'idee la plus simple a distribuer seul avec un retour utilisateur rapide."
      : "Priority: start with the simplest idea you can ship alone and validate quickly."
  ].join("\n");
}

function buildCompareFallback(language, context = {}, failureMode) {
  const normalized = normalizeText(context.prompt);

  if (/\bsqlite\b/.test(normalized) && /\bpostgres(?:ql)?\b/.test(normalized)) {
    return [
      buildAvailabilityLine(language, failureMode),
      language === "fr"
        ? "Recommandation: SQLite pour une app locale simple ou mono-utilisateur; PostgreSQL si vous anticipez multi-utilisateur, requetes complexes ou evolution serveur."
        : "Recommendation: SQLite for a simple local or single-user app; PostgreSQL if you expect multi-user access, heavier queries, or a server roadmap.",
      language === "fr"
        ? "Comparaison: SQLite est plus simple a embarquer et maintenir; PostgreSQL est plus robuste pour concurrence, permissions et modelisation avancee."
        : "Comparison: SQLite is simpler to embed and maintain; PostgreSQL is stronger for concurrency, permissions, and advanced modeling.",
      language === "fr"
        ? "Critere cle: si la base reste locale et legere, SQLite suffit largement."
        : "Key criterion: if the database stays local and lightweight, SQLite is usually enough."
    ].join("\n");
  }

  return [
    buildAvailabilityLine(language, failureMode),
    language === "fr"
      ? "Je n'ai pas de synthese modele fiable pour cette comparaison, mais je peux la traiter proprement si vous ajoutez une source, une URL, un fichier ou si vous reformulez les deux options a comparer."
      : "I do not have a reliable model synthesis for this comparison, but I can still handle it properly if you add a source, a URL, a file, or restate the two options clearly."
  ].join(" ");
}

function buildReasoningFallback(language, context = {}, failureMode) {
  const normalized = normalizeText(context.prompt);

  if (/\bsaas\b/.test(normalized) && /\b60 jours\b/.test(normalized) && /\b3000\b/.test(normalized)) {
    return [
      language === "fr" ? "Recommandation" : "Recommendation",
      language === "fr"
        ? "Lance un micro-SaaS B2B sur un seul workflow a forte valeur, avec un MVP etroit, des APIs existantes et 3 a 5 pilotes payants vises avant J60."
        : "Launch a narrow B2B micro-SaaS around a single high-value workflow, using existing APIs and aiming for 3 to 5 paying pilots before day 60.",
      language === "fr" ? "Pourquoi" : "Why",
      language === "fr"
        ? "- 60 jours et 3000 euros imposent un scope tres serre.\n- Le vrai risque n'est pas le modele, mais la vente, l'integration et la fiabilite du workflow."
        : "- 60 days and 3000 euros force a very tight scope.\n- The real risk is not the model itself, but sales, integration, and workflow reliability.",
      language === "fr" ? "Risques ou compromis" : "Risks or tradeoffs",
      language === "fr"
        ? "- Dette technique acceptee pour aller vite.\n- Acquisition manuelle obligatoire au debut.\n- Eviter les cas d'usage regules tant que la fiabilite n'est pas prouvee."
        : "- You accept technical debt to move fast.\n- Manual acquisition is required at the start.\n- Avoid regulated use cases until reliability is proven.",
      language === "fr" ? "Prochaines etapes" : "Next steps",
      language === "fr"
        ? "- Choisir un seul cas d'usage cette semaine.\n- Construire un MVP en 30 jours.\n- Consacrer les 30 jours suivants aux pilotes, au pricing et aux corrections."
        : "- Pick one use case this week.\n- Build the MVP within 30 days.\n- Spend the next 30 days on pilots, pricing, and corrections."
    ].join("\n");
  }

  return [
    buildAvailabilityLine(language, failureMode),
    language === "fr"
      ? "Je n'ai pas de synthese modele fiable pour ce raisonnement, mais je peux encore produire une recommandation exploitable si vous ajoutez le contexte, les contraintes et le resultat attendu."
      : "I do not have a reliable model synthesis for this reasoning task, but I can still produce a usable recommendation if you add context, constraints, and the expected outcome."
  ].join(" ");
}

function buildGeneralFallback(language, context, failureMode) {
  const guidance =
    language === "fr"
      ? "Essaie une demande plus concrete, ou ajoute des fichiers, une URL, une recherche web ou une tache outillee."
      : "Try a more concrete request, or add files, a URL, a web search, or a tool-backed task.";

  return [
    buildAvailabilityLine(language, failureMode),
    buildCapabilityLine(language, context),
    guidance
  ].join(" ");
}

export function buildLocalFallbackAnswer(context = {}) {
  const language = detectLanguage(
    context.prompt,
    context.preferencesUsed,
    context.memoryUsed
  );
  const failureMode = detectFailureMode(context.artifacts);
  const missingInputFallback = buildMissingInputFallback(language, context);

  if (missingInputFallback) {
    return missingInputFallback;
  }

  if (context.classification === "simple_chat") {
    if (isGreeting(context.prompt)) {
      return buildGreetingFallback(language, context, failureMode);
    }

    if (isCapabilitiesPrompt(context.prompt)) {
      return buildCapabilitiesFallback(language, context, failureMode);
    }

    if (isThanks(context.prompt)) {
      return buildThanksFallback(language, failureMode);
    }

    if (isPreferenceAckPrompt(context.prompt)) {
      return buildPreferenceAckFallback(language);
    }

    if (isSelfIntroPrompt(context.prompt)) {
      return buildSelfIntroFallback(language);
    }
  }

  if (context.classification === "brainstorm") {
    return buildBrainstormFallback(language, context, failureMode);
  }

  if (context.classification === "compare") {
    return buildCompareFallback(language, context, failureMode);
  }

  if (context.classification === "complex_reasoning") {
    return buildReasoningFallback(language, context, failureMode);
  }

  if (failureMode.isRateLimited || failureMode.isNotConfigured || failureMode.isProviderError) {
    return buildGeneralFallback(language, context, failureMode);
  }

  return "";
}
