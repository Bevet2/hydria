function uniqueStrings(values = []) {
  return [...new Set((values || []).map((value) => String(value || "").trim()).filter(Boolean))];
}

function compactSurfaceIds(workObject = {}) {
  return uniqueStrings(
    (workObject.surfaceModel?.availableSurfaces || []).map((surface) => surface.id)
  );
}

function inferRelationType({
  sourceWorkObject = null,
  targetWorkObject = null
} = {}) {
  const sourceKind = sourceWorkObject?.objectKind || sourceWorkObject?.kind || "";
  const targetKind = targetWorkObject?.objectKind || targetWorkObject?.kind || "";

  if (!sourceKind || !targetKind) {
    return "derived_from";
  }

  if (sourceKind === targetKind) {
    return "variant_of";
  }

  if (sourceKind === "project") {
    return "derived_from_project";
  }

  if (targetKind === "presentation" || targetKind === "video" || targetKind === "campaign") {
    return "derived_for_communication";
  }

  if (targetKind === "dashboard" || targetKind === "benchmark") {
    return "derived_for_analysis";
  }

  return "derived_from";
}

export function buildProjectGraph({ project = null, workObjects = [] } = {}) {
  const nodes = [];
  const edges = [];
  const workspaceFamilies = uniqueStrings([
    ...(project?.workspaceFamilies || []),
    ...workObjects.map((item) => item.workspaceFamilyId || item.metadata?.workspaceFamilyId || "")
  ]);

  if (project?.id) {
    nodes.push({
      id: project.id,
      type: "project",
      label: project.name || "Hydria project",
      workspaceFamilies,
      dimensions: project.dimensions || [],
      activeWorkObjectId: project.activeWorkObjectId || ""
    });
  }

  for (const workObject of workObjects) {
    const workspaceFamilyId =
      workObject.workspaceFamilyId ||
      workObject.metadata?.workspaceFamilyId ||
      "";
    nodes.push({
      id: workObject.id,
      type: "work_object",
      objectKind: workObject.objectKind || workObject.kind || "",
      label: workObject.title || workObject.primaryFile || workObject.id,
      workspaceFamilyId,
      workspaceFamilyLabel:
        workObject.workspaceFamilyLabel ||
        workObject.metadata?.workspaceFamilyLabel ||
        "",
      primaryFile: workObject.primaryFile || "",
      defaultSurface: workObject.defaultSurface || workObject.surfaceModel?.defaultSurface || "",
      surfaces: compactSurfaceIds(workObject),
      status: workObject.status || ""
    });

    if (project?.id) {
      edges.push({
        id: `${project.id}->${workObject.id}:contains`,
        from: project.id,
        to: workObject.id,
        type: "contains"
      });
    }

    if (workspaceFamilyId) {
      edges.push({
        id: `${workObject.id}->${workspaceFamilyId}:workspace`,
        from: workObject.id,
        to: workspaceFamilyId,
        type: "opens_in_workspace"
      });
    }
  }

  const workObjectById = new Map(workObjects.map((item) => [item.id, item]));
  for (const workObject of workObjects) {
    const sourceWorkObjectId =
      workObject.links?.sourceWorkObjectId ||
      workObject.metadata?.sourceWorkObjectId ||
      "";
    if (!sourceWorkObjectId) {
      continue;
    }

    const sourceWorkObject = workObjectById.get(sourceWorkObjectId) || null;
    edges.push({
      id: `${sourceWorkObjectId}->${workObject.id}:derived`,
      from: sourceWorkObjectId,
      to: workObject.id,
      type: inferRelationType({
        sourceWorkObject,
        targetWorkObject: workObject
      })
    });
  }

  if (project?.activeWorkObjectId) {
    edges.push({
      id: `${project.id}->${project.activeWorkObjectId}:active`,
      from: project.id,
      to: project.activeWorkObjectId,
      type: "active_on"
    });
  }

  return {
    nodes,
    edges,
    workspaceFamilies
  };
}

export function resolveWorkspaceRouting({
  prompt = "",
  intentProfile = null,
  executionIntent = null,
  environmentPlan = null,
  activeProject = null,
  activeWorkObject = null
} = {}) {
  const requestedFamilyId =
    environmentPlan?.workspaceFamilyId ||
    intentProfile?.workspaceFamily?.id ||
    intentProfile?.requestedShape?.workspaceFamilyId ||
    "";
  const currentFamilyId =
    activeWorkObject?.workspaceFamilyId ||
    activeWorkObject?.metadata?.workspaceFamilyId ||
    "";
  const actionMode = intentProfile?.actionMode || "ask";
  const action = executionIntent?.action || "none";
  const explicitNewEnvironment = Boolean(intentProfile?.explicitNewEnvironment);

  let routeMode = "create";
  let reason = "fresh_workspace_request";

  if (action === "environment_update" && activeWorkObject) {
    routeMode = "continue_object";
    reason = "update_current_object";
  } else if (action === "environment_transform" && activeWorkObject) {
    routeMode = "transform_object";
    reason = "transform_current_object";
  } else if (
    activeProject?.id &&
    activeWorkObject &&
    requestedFamilyId &&
    currentFamilyId &&
    requestedFamilyId !== currentFamilyId &&
    !explicitNewEnvironment
  ) {
    routeMode = "derive_project_sibling";
    reason = "derive_new_object_inside_project";
  } else if (
    activeProject?.id &&
    requestedFamilyId &&
    !explicitNewEnvironment &&
    (environmentPlan?.continuityMode === "project_first" || actionMode === "modify")
  ) {
    routeMode = "extend_project";
    reason = "project_first_workspace_extension";
  }

  return {
    routeMode,
    reason,
    requestedWorkspaceFamilyId: requestedFamilyId,
    currentWorkspaceFamilyId: currentFamilyId,
    targetProjectId: activeProject?.id || activeWorkObject?.projectId || "",
    sourceWorkObjectId:
      routeMode === "derive_project_sibling" || routeMode === "transform_object"
        ? activeWorkObject?.id || ""
        : "",
    continueCurrentObject: routeMode === "continue_object",
    createSiblingObject: routeMode === "derive_project_sibling",
    transformCurrentObject: routeMode === "transform_object",
    extendCurrentProject: routeMode === "extend_project"
  };
}

export default {
  buildProjectGraph,
  resolveWorkspaceRouting
};
