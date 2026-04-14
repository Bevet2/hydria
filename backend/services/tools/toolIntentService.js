import config from "../../config/hydria.config.js";

function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function extractUrls(prompt = "") {
  const matches = String(prompt || "").match(/https?:\/\/[^\s<>"'`]+/gi) || [];
  return [...new Set(matches.map((url) => url.replace(/[),.;!?]+$/, "")))];
}

export function detectToolNeed(prompt = "", classification = "", attachments = []) {
  if (!config.tools.enabled) {
    return null;
  }

  const normalized = normalizeText(prompt);
  const urls = extractUrls(prompt);
  const codingTask = classification === "coding";
  const githubResearchSignal =
    /\b(github|search github|cherche sur github|repo public|open source|starter|boilerplate|template)\b/.test(
      normalized
    ) ||
    (/(\brepo\b|\brepository\b|\brepositories\b)/.test(normalized) &&
      !/\b(current app|this app|ce projet|le projet|projet hydria|workspace|codebase|dans le projet|dans le code)\b/.test(
        normalized
      ));
  const projectInspectionSignal =
    /\b(inspect|inspecte|inspection|audit|review|analyse|analyze|risque|risques|risk|architecture)\b/.test(
      normalized
    );
  const explicitProjectSignal =
    /\b(codebase|repo|repository|project|workspace|current app|this app|ce projet|le projet|projet hydria|code du projet|dans le projet|dans le code|ce fichier|this file|this component|ce composant|this page|cette page)\b/.test(
      normalized
    ) || (/\bprojet\b/.test(normalized) && projectInspectionSignal);
  const effectiveProjectSignal = explicitProjectSignal && !githubResearchSignal;
  const rawDiagnosticsSignal =
    /\b(bug|bugs|error|errors|failing|failed|failure|stacktrace|stack trace|exception|traceback|lint|test|tests|build|compile|warning|warn|logs|console|debug|audit|inspect|risk|risque|risques)\b/.test(
      normalized
    );
  const diagnosticsSignal =
    rawDiagnosticsSignal &&
    (codingTask ||
      effectiveProjectSignal ||
      /\b(code|repo|repository|workspace|project|projet|bug|error|debug|build|test|lint|console|logs)\b/.test(
        normalized
      ));
  const previewSignal =
    /\b(render|rendu|ui|ux|page|screen|screenshot|layout|frontend|style|css|visual|affichage|preview|localhost)\b/.test(
      normalized
    ) || urls.some((url) => /localhost|127\.0\.0\.1/i.test(url));
  const projectContextSignal =
    effectiveProjectSignal ||
    (codingTask && (attachments.length > 0 || diagnosticsSignal || previewSignal));

  return {
    useTools: projectContextSignal || diagnosticsSignal || previewSignal,
    workspaceInspect: projectContextSignal,
    diagnostics: diagnosticsSignal,
    preview: previewSignal,
    urls,
    hasAttachments: attachments.length > 0
  };
}
