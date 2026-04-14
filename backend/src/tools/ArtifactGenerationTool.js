import { generateDocumentArtifact } from "../../services/artifacts/documentOrchestrator.js";
import { BaseTool } from "./BaseTool.js";

export class ArtifactGenerationTool extends BaseTool {
  constructor() {
    super({
      id: "artifact_generator",
      label: "Artifact Generator",
      description: "Generates documents and local artifacts from the current request.",
      permissions: ["artifact:write"]
    });
  }

  async execute({
    userId,
    conversationId,
    prompt,
    attachments = [],
    plan,
    project = null,
    activeWorkObject = null,
    activeWorkObjectContent = ""
  }) {
    const artifactResult = await generateDocumentArtifact({
      userId,
      conversationId,
      prompt,
      attachments,
      plan,
      project,
      activeWorkObject,
      activeWorkObjectContent,
      seedDocument:
        activeWorkObject &&
        ["document", "presentation", "dataset", "dashboard", "workflow", "design", "benchmark", "campaign", "image", "audio", "video"].includes(activeWorkObject.objectKind)
          ? {
              title: activeWorkObject.title,
              format: activeWorkObject.metadata?.sourceFormat || "md",
              kind: activeWorkObject.objectKind,
              content: activeWorkObjectContent,
              spec: activeWorkObject.metadata?.spec || null
            }
          : null
    });

    return {
      providerId: this.id,
      sourceType: "tool",
      sourceName: "Artifact Generator",
      capability: "artifact_generation",
      raw: artifactResult,
      normalized: {
        finalAnswer: artifactResult.finalAnswer,
        formats:
          artifactResult.artifacts
            ?.map((artifact) => artifact.format)
            .filter(Boolean) || [],
        sourceDocument: artifactResult.sourceDocument || null
      },
      summaryText: artifactResult.finalAnswer,
      artifacts: artifactResult.artifacts || [],
      artifactResult
    };
  }
}

export default ArtifactGenerationTool;
