import {
  buildHydriaCapabilitiesAnswer,
  buildHydriaIdentityAnswer,
  detectHydriaLanguage,
  isHydriaCapabilitiesPrompt,
  isHydriaIdentityPrompt
} from "./hydriaProfile.js";

function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isGreeting(prompt = "") {
  return /^(salut|bonjour|bonsoir|hello|hi|hey)\b/.test(normalizeText(prompt));
}

function isThanks(prompt = "") {
  return /\b(merci|thanks|thank you)\b/.test(normalizeText(prompt));
}

function isSelfIntroPrompt(prompt = "") {
  return /\b(presente toi|presente-toi|qui es tu|who are you|introduis toi)\b/.test(
    normalizeText(prompt)
  );
}

function isHowItWorksPrompt(prompt = "") {
  return /\b(comment tu fonctionnes|comment ca marche|how do you work|how it works|comment fonctionne hydria)\b/.test(
    normalizeText(prompt)
  );
}

function buildGreeting(language) {
  return language === "fr"
    ? "Bonjour. Je suis Hydria. Donnez-moi votre demande, et je choisis le chemin le plus utile entre modele local, API, web, fichiers et outils."
    : "Hello. I am Hydria. Give me the task, and I will choose the most useful path across local models, APIs, web, files, and tools.";
}

function buildThanks(language) {
  return language === "fr" ? "Avec plaisir." : "You're welcome.";
}

function buildHowItWorks(language) {
  return language === "fr"
    ? "Hydria fonctionne comme un orchestrateur. J'analyse la demande, je choisis si je dois utiliser un modele, une API, le web, un fichier ou un outil local, puis je produis la meilleure reponse possible avec memoire et verification."
    : "Hydria works as an orchestrator. I analyze the request, decide whether to use a model, an API, the web, a file, or a local tool, then synthesize the best answer I can with memory and verification.";
}

export function resolveGroundedSimpleChatResponse({
  prompt,
  classification
} = {}) {
  if (classification !== "simple_chat") {
    return null;
  }

  const language = detectHydriaLanguage(prompt);

  if (isHydriaIdentityPrompt(prompt) || isSelfIntroPrompt(prompt)) {
    return {
      reason: "hydria_identity_grounding",
      answer: buildHydriaIdentityAnswer(language)
    };
  }

  if (isHydriaCapabilitiesPrompt(prompt)) {
    return {
      reason: "hydria_capabilities_grounding",
      answer: buildHydriaCapabilitiesAnswer(language)
    };
  }

  if (isHowItWorksPrompt(prompt)) {
    return {
      reason: "hydria_workflow_grounding",
      answer: buildHowItWorks(language)
    };
  }

  if (isGreeting(prompt)) {
    return {
      reason: "hydria_greeting_grounding",
      answer: buildGreeting(language)
    };
  }

  if (isThanks(prompt)) {
    return {
      reason: "hydria_thanks_grounding",
      answer: buildThanks(language)
    };
  }

  return null;
}

export default {
  resolveGroundedSimpleChatResponse
};
