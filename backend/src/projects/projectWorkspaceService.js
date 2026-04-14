function compactProject(project = {}, workObjects = []) {
  return {
    id: project.id,
    name: project.name,
    type: project.type,
    status: project.status,
    currentVersion: project.currentVersion,
    qualityScore: project.qualityScore || 0,
    workspacePath: project.workspacePath,
    dimensions: project.dimensions || [],
    internalCapabilities: project.internalCapabilities || [],
    globalProject: project.globalProject || null,
    activeWorkObjectId: project.activeWorkObjectId || workObjects[0]?.id || "",
    workObjectIds: project.workObjectIds || workObjects.map((item) => item.id),
    workObjectCount: workObjects.length,
    workspaceFamilies: project.workspaceFamilies || project.graph?.workspaceFamilies || [],
    graph: project.graph || { nodes: [], edges: [], workspaceFamilies: [] },
    deliveryStatus: project.deliveryStatus || null,
    exportArtifact: project.exportArtifact || null,
    lastCommand: project.lastCommand || "",
    lastUpdatedAt: project.lastUpdatedAt,
    metadata: {
      conversationId: project.metadata?.conversationId || null,
      userId: project.metadata?.userId || null
    }
  };
}

function buildNavigator(project = {}, workObjects = []) {
  const surfaces = project.globalProject?.editableSurfaces || [];
  const dimensions = project.globalProject?.dimensions || project.dimensions || [];
  const objectSurfaceTypes = [
    ...new Set(
      workObjects.flatMap((item) =>
        (item.surfaceModel?.availableSurfaces || []).map((surface) => surface.id)
      )
    )
  ];

  return {
    dimensions,
    editableSurfaces: surfaces,
    workspaceSurfaces: objectSurfaceTypes,
    workObjects: workObjects.map((item) => ({
      id: item.id,
      title: item.title,
      kind: item.objectKind || item.kind,
      workspaceFamilyId: item.workspaceFamilyId || "",
      workspaceFamilyLabel: item.workspaceFamilyLabel || "",
      status: item.status,
      primaryFile: item.primaryFile,
      surfaceModel: item.surfaceModel || null,
      editableFiles: item.editableFiles || [],
      nextActionHint: item.nextActionHint || "",
      export: item.export || null
    }))
  };
}

export class ProjectWorkspaceService {
  constructor({ projectStore, workObjectService }) {
    this.projectStore = projectStore;
    this.workObjectService = workObjectService;
  }

  listProjects({ userId = null, conversationId = null, limit = 50 } = {}) {
    const projects = this.projectStore.listProjects({
      userId,
      conversationId,
      limit: Math.max(limit, 200)
    });

    return projects
      .map((project) => {
        const workObjects = this.workObjectService.listForProject({
          projectId: project.id,
          userId
        });
        return compactProject(project, workObjects);
      })
      .filter((project) =>
        userId
          ? project.workObjectCount > 0 ||
            (project.workObjectIds?.length || 0) > 0 ||
            Number(project.metadata?.userId || 0) === Number(userId)
          : true
      )
      .slice(0, limit);
  }

  getWorkspace(projectId, { userId = null } = {}) {
    const project = this.projectStore.getProject(String(projectId || ""));
    if (!project) {
      return null;
    }

    const workObjects = this.workObjectService.listForProject({
      projectId: project.id,
      userId
    });

    if (userId && !workObjects.length && Number(project.metadata?.userId || 0) !== Number(userId)) {
      return null;
    }

    const activeWorkObject =
      workObjects.find((item) => item.id === project.activeWorkObjectId) ||
      workObjects[0] ||
      null;

    return {
      project: compactProject(project, workObjects),
      activeWorkObjectId: activeWorkObject?.id || "",
      workObjects,
      navigator: buildNavigator(project, workObjects)
    };
  }
}

export default ProjectWorkspaceService;
