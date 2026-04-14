import { inspectWorkspace } from "../../services/tools/workspaceInspectorService.js";
import { BaseTool } from "./BaseTool.js";

export class WorkspaceInspectTool extends BaseTool {
  constructor() {
    super({
      id: "workspace_inspector",
      label: "Workspace Inspector",
      description: "Inspects the local workspace and relevant files.",
      permissions: ["workspace:read"]
    });
  }

  async execute({ prompt }) {
    return inspectWorkspace(prompt);
  }
}

export default WorkspaceInspectTool;
