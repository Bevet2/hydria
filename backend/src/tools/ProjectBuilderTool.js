import { BaseTool } from "./BaseTool.js";

export class ProjectBuilderTool extends BaseTool {
  constructor({ projectBuilder }) {
    super({
      id: "project_builder",
      label: "Project Builder",
      description: "Creates a real local project scaffold inside the runtime sandbox.",
      permissions: ["project:write"]
    });

    this.projectBuilder = projectBuilder;
  }

  async execute({
    project = null,
    prompt = "",
    executionIntent = null,
    conversationId = null,
    userId = null,
    sessionId = null,
    globalProjectContext = null,
    activeWorkObject = null,
    activeWorkObjectContent = "",
    supportContext = null
  } = {}) {
    if (!this.projectBuilder || !project) {
      return {
        success: false,
        providerId: this.id,
        sourceType: "tool",
        sourceName: "Project Builder",
        capability: "project_scaffold",
        raw: {
          error: "missing_project_context"
        },
        normalized: {},
        summaryText: "Project Builder missing project context.",
        artifacts: []
      };
    }

    const result = await this.projectBuilder.executeDelivery({
      project,
      prompt,
      executionIntent,
      conversationId,
      userId,
      sessionId,
      globalProjectContext,
      activeWorkObject,
      activeWorkObjectContent,
      supportContext
    });

    return {
      success: true,
      providerId: this.id,
      sourceType: "tool",
      sourceName: "Project Builder",
      capability: "project_scaffold",
      raw: result,
      normalized: {
        action: result.action,
        projectName: result.projectName,
        workspacePath: result.workspacePath,
        createdFiles: result.createdFiles,
        mainFiles: result.mainFiles,
        mainStructure: result.mainStructure,
        nextCommands: result.nextCommands,
        nextCommand: result.nextCommand,
        manifestPath: result.manifestPath,
        deliveryManifestPath: result.deliveryManifestPath,
        globalProject: result.globalProject || null,
        templateId: result.templateId,
        exportArtifactId: result.exportArtifactId,
        exportDownloadUrl: result.exportDownloadUrl,
        exportFilename: result.exportFilename,
        delivery: result.delivery,
        finalAnswer: result.finalAnswer
      },
      summaryText: result.finalAnswer,
      artifacts: result.artifacts || []
    };
  }
}

export default ProjectBuilderTool;
