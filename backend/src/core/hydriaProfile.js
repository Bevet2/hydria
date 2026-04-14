export const HYDRIA_PROFILE = {
  name: "Hydria",
  shortLabel: "local AI orchestrator",
  descriptionFr:
    "Hydria est un orchestrateur IA local, modulaire et free-first. Il combine des modeles locaux ou open-source, des APIs externes, une memoire persistante, une couche connaissance, des outils d'execution et des agents specialises pour planifier, agir, critiquer et memoriser.",
  descriptionEn:
    "Hydria is a local, modular, free-first AI orchestrator. It combines local or open-source models, external APIs, persistent memory, a knowledge layer, execution tools, and specialized agents to plan, act, critique, and remember.",
  capabilitiesFr: [
    "discussion generale et reponses hybrides",
    "recherche web et lecture d'URL",
    "analyse de fichiers et de code",
    "outils locaux et runtime navigateur",
    "generation de documents et artifacts",
    "memoire conversationnelle et connaissance locale",
    "GitHub search et analyse de repositories"
  ],
  capabilitiesEn: [
    "general chat and hybrid answers",
    "web search and URL reading",
    "file and code analysis",
    "local tools and browser runtime",
    "document and artifact generation",
    "conversational memory and local knowledge",
    "GitHub search and repository analysis"
  ]
};

export function detectHydriaLanguage(prompt = "") {
  return /\b(le|la|les|des|une|un|bonjour|salut|merci|peux|comment|qu est|qu'est|explique|presente|fonctionnalites|capacites)\b/i.test(
    String(prompt || "")
  )
    ? "fr"
    : "en";
}

export function isHydriaIdentityPrompt(prompt = "") {
  const normalized = String(prompt || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return (
    /\bhydria\b/.test(normalized) &&
    /\b(what is|what's|who are you|who is|explain|present|introduce|c'est quoi|qu est|qu'est|explique|presente|presente toi|presente-toi|qui es tu|qui est)\b/.test(
      normalized
    )
  );
}

export function isHydriaCapabilitiesPrompt(prompt = "") {
  const normalized = String(prompt || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return /\b(capabilities|features|help|can do|what can you do|fonctionnalites|capacites|que peux tu faire|que peux-tu faire|a quoi sers tu|a quoi sert hydria)\b/.test(
    normalized
  );
}

export function buildHydriaIdentityAnswer(language = "fr") {
  if (language === "fr") {
    return [
      HYDRIA_PROFILE.descriptionFr,
      `Concretement, Hydria sait gerer ${HYDRIA_PROFILE.capabilitiesFr.slice(0, 5).join(", ")}.`,
      "Son objectif est de choisir le bon chemin entre modele, API, web, fichiers et outils pour repondre proprement a la demande."
    ].join(" ");
  }

  return [
    HYDRIA_PROFILE.descriptionEn,
    `In practice, Hydria handles ${HYDRIA_PROFILE.capabilitiesEn.slice(0, 5).join(", ")}.`,
    "Its goal is to choose the right path across models, APIs, web, files, and tools to answer the request cleanly."
  ].join(" ");
}

export function buildHydriaCapabilitiesAnswer(language = "fr") {
  const capabilities =
    language === "fr" ? HYDRIA_PROFILE.capabilitiesFr : HYDRIA_PROFILE.capabilitiesEn;

  const intro =
    language === "fr"
      ? "Hydria peut notamment vous aider sur ces axes :"
      : "Hydria can help across these areas:";

  const outro =
    language === "fr"
      ? "Ensuite, je choisis automatiquement le chemin le plus pertinent entre runtime, web, API, LLM local et generation."
      : "I then automatically choose the most relevant path across runtime, web, APIs, local LLMs, and generation.";

  return [intro, ...capabilities.map((item) => `- ${item}`), outro].join("\n");
}
