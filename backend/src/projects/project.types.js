export function normalizeProject(project = {}) {
  return {
    id: String(project.id || "").trim(),
    name: String(project.name || "hydria-project").trim(),
    type: String(project.type || "internal").trim().toLowerCase(),
    status: String(project.status || "draft").trim().toLowerCase(),
    currentVersion: String(project.currentVersion || "0.1.0").trim(),
    workspacePath: String(project.workspacePath || "").trim(),
    dimensions: Array.isArray(project.dimensions)
      ? [...new Set(project.dimensions.map((item) => String(item || "").trim()).filter(Boolean))]
      : [],
    internalCapabilities: Array.isArray(project.internalCapabilities)
      ? [...new Set(project.internalCapabilities.map((item) => String(item || "").trim()).filter(Boolean))]
      : [],
    globalProject: project.globalProject || null,
    history: Array.isArray(project.history) ? project.history : [],
    activeWorkObjectId: String(project.activeWorkObjectId || "").trim(),
    workObjectIds: Array.isArray(project.workObjectIds)
      ? [...new Set(project.workObjectIds.map((item) => String(item || "").trim()).filter(Boolean))]
      : [],
    workspaceFamilies: Array.isArray(project.workspaceFamilies)
      ? [...new Set(project.workspaceFamilies.map((item) => String(item || "").trim()).filter(Boolean))]
      : [],
    artifactIds: Array.isArray(project.artifactIds)
      ? [...new Set(project.artifactIds.map((item) => String(item || "").trim()).filter(Boolean))]
      : [],
    learningsLinked: Array.isArray(project.learningsLinked) ? project.learningsLinked : [],
    tasksHistory: Array.isArray(project.tasksHistory) ? project.tasksHistory : [],
    qualityScore: Number(project.qualityScore || 0),
    deliveryStatus: project.deliveryStatus || {
      scaffold: "pending",
      install: "pending",
      run: "pending",
      validation: "pending",
      export: "pending",
      deliver: "pending"
    },
    logs: project.logs || {
      install: "",
      run: ""
    },
    errors: Array.isArray(project.errors) ? project.errors : [],
    corrections: Array.isArray(project.corrections) ? project.corrections : [],
    exportArtifact: project.exportArtifact || null,
    graph: project.graph || {
      nodes: [],
      edges: [],
      workspaceFamilies: []
    },
    lastCommand: String(project.lastCommand || "").trim(),
    metadata: project.metadata || {},
    createdAt: String(project.createdAt || new Date().toISOString()),
    lastUpdatedAt: String(project.lastUpdatedAt || new Date().toISOString())
  };
}

export default {
  normalizeProject
};
