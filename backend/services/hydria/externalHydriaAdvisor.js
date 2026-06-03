import config from "../../config/hydria.config.js";
import { askExternalHydriaCore } from "./externalHydriaApiClient.js";

const GENERIC_FAILURE_PATTERN =
  /je n[' ]ai pas reussi|je n'ai pas reussi|reformule la question|failed to generate|could not generate/i;

function compact(value = "", maxChars = 900) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length <= maxChars ? text : `${text.slice(0, maxChars - 1).trim()}...`;
}

function listAttachmentSummary(attachments = []) {
  return attachments.slice(0, 6).map((attachment) => ({
    name: attachment.originalName || attachment.filename || attachment.name || "attachment",
    kind: attachment.kind || attachment.type || attachment.mimeType || "unknown",
    extractedChars: String(attachment.text || attachment.content || "").length,
    preview: compact(attachment.text || attachment.content || "", 360)
  }));
}

function summarizeWorkObject(activeWorkObject, activeWorkObjectContent) {
  if (!activeWorkObject) {
    return null;
  }

  return {
    id: activeWorkObject.id || "",
    title: activeWorkObject.title || "",
    kind: activeWorkObject.objectKind || "",
    primaryFile: activeWorkObject.primaryFile || "",
    sourceFormat: activeWorkObject.metadata?.sourceFormat || "",
    contentPreview: compact(activeWorkObjectContent || "", 900)
  };
}

function buildSystemPrompt() {
  return [
    "You are Hydria Core advising Hydria OS before local artifact generation.",
    "Hydria OS, not you, creates and edits files locally after your advice.",
    "Do not claim that you generated, saved, uploaded, opened, or edited a file.",
    "Return concise operational advice for the local artifact pipeline.",
    "Focus on structure, data shape, fields, sections, sheet columns, slide flow, dashboard widgets, workflow stages, or design frames.",
    "Avoid generic explanations. Prefer directly usable implementation guidance.",
    "If the context is insufficient, state the missing input in one short sentence."
  ].join("\n");
}

function buildQuestion({
  prompt,
  intent,
  plan,
  project,
  activeWorkObject,
  activeWorkObjectContent,
  attachments
}) {
  const payload = {
    userRequest: compact(prompt, 1200),
    localHydriaCapabilities: {
      artifactFormats: ["docx", "pdf", "pptx", "xlsx", "csv", "html", "md", "txt", "json", "svg"],
      workObjects: [
        "document",
        "presentation",
        "dataset",
        "dashboard",
        "workflow",
        "design",
        "benchmark",
        "campaign",
        "project",
        "app"
      ],
      pipeline: [
        "infer artifact intent",
        "build compact spec",
        "draft Markdown or structured JSON source",
        "render local file",
        "register the result as a workspace work object"
      ]
    },
    inferredArtifact: {
      title: intent?.title || "",
      format: intent?.format || "",
      documentType: intent?.documentType || ""
    },
    localPlan: {
      objective: plan?.objective || "",
      taskPack: plan?.taskPack?.id || plan?.taskPack || "",
      steps: (plan?.steps || []).slice(0, 8).map((step) => ({
        id: step.id || "",
        type: step.type || "",
        purpose: step.purpose || "",
        capability: step.capability || "",
        format: step.format || ""
      }))
    },
    project: project
      ? {
          id: project.id || "",
          name: project.name || "",
          status: project.status || "",
          summary: compact(project.summary || project.globalProject?.summary || "", 500)
        }
      : null,
    activeWorkObject: summarizeWorkObject(activeWorkObject, activeWorkObjectContent),
    attachments: listAttachmentSummary(attachments)
  };

  return [
    "Hydria OS needs artifact advice for this request.",
    "Return one compact answer with:",
    "1. recommended artifact shape",
    "2. sections/sheets/slides/frames/stages",
    "3. fields or data columns when relevant",
    "4. risks or missing inputs",
    "",
    "Context JSON:",
    JSON.stringify(payload, null, 2)
  ].join("\n");
}

function extractAnswer(result) {
  return compact(
    result?.answer ||
      result?.display?.primaryText ||
      result?.result?.answer ||
      result?.message ||
      "",
    1600
  );
}

export async function getExternalArtifactAdvice({
  prompt,
  intent,
  plan,
  project = null,
  activeWorkObject = null,
  activeWorkObjectContent = "",
  attachments = []
} = {}) {
  if (
    !config.externalHydria.enabled ||
    !config.externalHydria.advisorEnabled ||
    !prompt
  ) {
    return {
      used: false,
      skippedReason: "not_configured"
    };
  }

  try {
    const result = await askExternalHydriaCore({
      system: buildSystemPrompt(),
      question: buildQuestion({
        prompt,
        intent,
        plan,
        project,
        activeWorkObject,
        activeWorkObjectContent,
        attachments
      }),
      timeoutMs: config.externalHydria.advisorTimeoutMs
    });
    const answer = extractAnswer(result);

    if (!answer || GENERIC_FAILURE_PATTERN.test(answer)) {
      return {
        used: false,
        skippedReason: "low_quality",
        raw: result
      };
    }

    return {
      used: true,
      providerId: "hydria_core_vps",
      sourceName: "Hydria Core VPS",
      capability: "artifact_context_advice",
      summaryText: answer,
      raw: result
    };
  } catch (error) {
    return {
      used: false,
      skippedReason: error.name === "ExternalServiceError" ? "remote_error" : "error",
      error: error.message
    };
  }
}

export default {
  getExternalArtifactAdvice
};
