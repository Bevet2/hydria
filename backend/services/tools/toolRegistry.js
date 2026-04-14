export const TOOL_REGISTRY = [
  {
    id: "workspace_inspector",
    name: "Workspace Inspector",
    category: "codebase",
    capabilities: ["workspace_inspect"],
    description: "Scans the local workspace, identifies relevant files, and extracts grounded snippets."
  },
  {
    id: "diagnostics_runner",
    name: "Diagnostics Runner",
    category: "diagnostics",
    capabilities: ["run_diagnostics"],
    description: "Runs safe local diagnostics such as build, lint, test, or syntax checks."
  },
  {
    id: "preview_inspector",
    name: "Preview Inspector",
    category: "preview",
    capabilities: ["inspect_preview"],
    description: "Reads a local or remote preview URL and can capture a screenshot when available."
  }
];

export function listToolRegistry() {
  return TOOL_REGISTRY.map((tool) => ({
    ...tool,
    enabled: true
  }));
}
