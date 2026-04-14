import { runDiagnostics } from "../../services/tools/diagnosticsToolService.js";
import { BaseTool } from "./BaseTool.js";

export class DiagnosticsTool extends BaseTool {
  constructor() {
    super({
      id: "diagnostics_runner",
      label: "Diagnostics Runner",
      description: "Runs allowed local diagnostics against the project.",
      permissions: ["workspace:read", "shell:run"]
    });
  }

  async execute({ prompt }) {
    return runDiagnostics(prompt);
  }
}

export default DiagnosticsTool;
