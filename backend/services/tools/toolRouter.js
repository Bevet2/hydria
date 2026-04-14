import { detectToolNeed } from "./toolIntentService.js";
import { inspectWorkspace } from "./workspaceInspectorService.js";
import { runDiagnostics } from "./diagnosticsToolService.js";
import { inspectPreview } from "./previewToolService.js";

export function detectTooling(prompt, classification, attachments = []) {
  return detectToolNeed(prompt, classification, attachments);
}

export async function resolveToolStep(step, { prompt, classification, attachments = [] }) {
  const toolNeed = detectToolNeed(prompt, classification, attachments);

  switch (step.toolId) {
    case "workspace_inspector":
      return inspectWorkspace(prompt, toolNeed);
    case "diagnostics_runner":
      return runDiagnostics(prompt, toolNeed);
    case "preview_inspector":
      return inspectPreview(prompt, toolNeed);
    default:
      return {
        providerId: step.toolId,
        sourceType: "tool",
        sourceName: step.toolId,
        capability: step.capability || "tool",
        raw: {},
        normalized: {},
        summaryText: `Unknown tool step: ${step.toolId}`
      };
  }
}
