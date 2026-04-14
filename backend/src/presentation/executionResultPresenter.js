function findProjectBuilderResult(toolResults = []) {
  return (
    (toolResults || []).find((result) => result?.capability === "project_scaffold") || null
  );
}

function findArtifactGeneratorResult(toolResults = []) {
  return (
    (toolResults || []).find(
      (result) =>
        result?.providerId === "artifact_generator" ||
        result?.capability === "artifact_generation"
    ) || null
  );
}

function formatStructureLine(file = "") {
  if (/routes\//i.test(file)) {
    return `- routes -> ${file}`;
  }
  if (/controllers\//i.test(file)) {
    return `- controllers -> ${file}`;
  }
  if (/services\//i.test(file)) {
    return `- services -> ${file}`;
  }
  if (/middlewares\//i.test(file)) {
    return `- middlewares -> ${file}`;
  }
  if (/validators\//i.test(file)) {
    return `- validation -> ${file}`;
  }
  if (/repositories\//i.test(file)) {
    return `- repository -> ${file}`;
  }

  return `- ${file}`;
}

export function buildExecutionResultAnswer({ context = {} } = {}) {
  const projectResult = findProjectBuilderResult(context.toolResults || []);
  if (!projectResult?.normalized) {
    const artifactResult = findArtifactGeneratorResult(context.toolResults || []);
    const sourceDocument =
      artifactResult?.artifactResult?.sourceDocument ||
      artifactResult?.normalized?.sourceDocument ||
      null;
    const artifact =
      (artifactResult?.artifacts || []).find((item) => item?.type === "generated_file") ||
      null;

    if (!artifact?.id || !sourceDocument?.content) {
      return "";
    }

    const kind = String(sourceDocument.kind || "document").toLowerCase();
    const title = sourceDocument.title || artifact.title || "Hydria object";
    const filename = sourceDocument.filename || artifact.filename || "";
    const format = String(sourceDocument.format || artifact.format || "").toUpperCase();
    const surfaceHint =
      kind === "dataset"
        ? "La surface data est prete avec des lignes et colonnes manipulables."
        : kind === "presentation"
          ? "La presentation est prete slide par slide."
          : kind === "dashboard"
            ? "Le dashboard est pret avec ses widgets, ses filtres et sa table."
            : kind === "workflow"
              ? "Le workflow est pret avec ses etapes et ses liens."
              : kind === "design"
                ? "Le wireframe est pret avec ses frames et ses blocs."
                : "Le document est pret a etre modifie.";
    const nextStep =
      kind === "dataset"
        ? "- Ouvre la grille et modifie les cellules directement."
        : kind === "presentation"
          ? "- Ouvre les slides et ajuste le contenu slide par slide."
          : kind === "dashboard"
            ? "- Ouvre le dashboard et ajuste les KPI, charts ou filtres."
            : kind === "workflow"
              ? "- Ouvre le workflow et ajuste les etapes ou les connexions."
              : kind === "design"
                ? "- Ouvre le wireframe et ajuste les frames ou les blocs."
                : "- Ouvre le contenu et modifie les sections directement.";

    return [
      `J'ai cree ${title}.`,
      "Objet",
      `- type -> ${kind}`,
      filename ? `- fichier principal -> ${filename}` : "",
      format ? `- format source -> ${format}` : "",
      artifact.downloadUrl ? "Export" : "",
      artifact.downloadUrl ? `- ${artifact.filename || filename} -> ${artifact.downloadUrl}` : "",
      "Workspace",
      `- ${surfaceHint}`,
      "Prochaine etape",
      nextStep
    ]
      .filter(Boolean)
      .join("\n");
  }

  const {
    projectName,
    workspacePath,
    createdFiles = [],
    mainFiles = [],
    mainStructure = [],
    nextCommands = [],
    nextCommand = "",
    manifestPath,
    deliveryManifestPath,
    exportDownloadUrl = "",
    exportFilename = "",
    delivery = {},
    globalProject = null
  } = projectResult.normalized;
  const structureLines = ((mainFiles && mainFiles.length ? mainFiles : mainStructure) || [])
    .slice(0, 8)
    .map((file) => formatStructureLine(file));
  const corrections = delivery.correctionsApplied || [];
  const installStatus = delivery.install?.status || "skipped";
  const runStatus = delivery.run?.status || "skipped";
  const validationStatus = delivery.validation?.status || "skipped";
  const commandToShow = nextCommand || nextCommands?.[0] || "";
  const dimensions = globalProject?.dimensions || [];
  const capabilities = globalProject?.selectedCapabilities || [];

  return [
    `J'ai cree le projet ${projectName || "hydria-project"}.`,
    globalProject?.summary || "",
    "Statut",
    `- install -> ${installStatus}`,
    `- run -> ${runStatus}`,
    `- validation -> ${validationStatus}`,
    "Projet",
    `- ${workspacePath}`,
    exportDownloadUrl ? "Export" : "",
    exportDownloadUrl ? `- ${exportFilename || "project.zip"} -> ${exportDownloadUrl}` : "",
    createdFiles.length ? "Fichiers generes" : "",
    ...createdFiles.slice(0, 10).map((file) => `- ${file}`),
    structureLines.length ? "Fichiers cles" : "",
    ...structureLines,
    dimensions.length ? "Dimensions" : "",
    ...dimensions.slice(0, 8).map((dimension) => `- ${dimension}`),
    capabilities.length ? "Capacites internes" : "",
    ...capabilities.slice(0, 3).map((capability) => `- ${capability.label}`),
    corrections.length ? "Corrections appliquees" : "",
    ...corrections.slice(0, 5).map((fix) => `- ${fix.summary || fix}`),
    manifestPath || deliveryManifestPath ? "Manifests" : "",
    manifestPath ? `- ${manifestPath}` : "",
    deliveryManifestPath ? `- ${deliveryManifestPath}` : "",
    commandToShow ? "Prochaine commande" : "",
    commandToShow ? `- ${commandToShow}` : ""
  ]
    .filter(Boolean)
    .join("\n");
}

export default {
  buildExecutionResultAnswer
};
