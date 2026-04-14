import { resolveWorkspaceFamily } from "../workspaces/workspaceRegistry.js";

export function inferEnvironmentObjectKind(shape = "unknown") {
  const normalizedShape = String(shape || "").trim().toLowerCase();

  if (["spreadsheet", "dataset"].includes(normalizedShape)) {
    return "dataset";
  }
  if (normalizedShape === "presentation") {
    return "presentation";
  }
  if (normalizedShape === "document") {
    return "document";
  }
  if (normalizedShape === "dashboard") {
    return "dashboard";
  }
  if (normalizedShape === "benchmark") {
    return "benchmark";
  }
  if (normalizedShape === "campaign") {
    return "campaign";
  }
  if (normalizedShape === "workflow") {
    return "workflow";
  }
  if (normalizedShape === "design") {
    return "design";
  }
  if (normalizedShape === "image") {
    return "image";
  }
  if (normalizedShape === "audio") {
    return "audio";
  }
  if (normalizedShape === "video") {
    return "video";
  }
  if (["app", "code_project", "project"].includes(normalizedShape)) {
    return "project";
  }

  return "document";
}

function createEnvironmentBlueprint(id, options = {}) {
  return {
    id,
    label: options.label || id,
    objectKind: options.objectKind || "document",
    surfaces: options.surfaces || ["preview", "edit", "structure"],
    defaultSurface: options.defaultSurface || options.surfaces?.[0] || "preview",
    runtimeMode: options.runtimeMode || "rendered",
    shouldCreateProject: Boolean(options.shouldCreateProject),
    shouldCreateWorkObject: options.shouldCreateWorkObject !== false,
    cloneTarget: options.cloneTarget || id,
    capabilityFamilies: options.capabilityFamilies || [],
    continuityMode: options.continuityMode || "object_first",
    workspaceFamilyId: options.workspaceFamilyId || "",
    workspaceFamilyLabel: options.workspaceFamilyLabel || ""
  };
}

function resolveBlueprintByShape(shape = "unknown") {
  const normalizedShape = String(shape || "").trim().toLowerCase();

  if (normalizedShape === "spreadsheet" || normalizedShape === "dataset") {
    return createEnvironmentBlueprint("spreadsheet", {
      label: "Spreadsheet Environment",
      objectKind: "dataset",
      surfaces: ["data", "edit", "structure"],
      defaultSurface: "data",
      runtimeMode: "interactive",
      cloneTarget: "excel-like spreadsheet",
      capabilityFamilies: ["creation", "data_analysis"],
      continuityMode: "object_first"
    });
  }

  if (normalizedShape === "presentation") {
    return createEnvironmentBlueprint("presentation", {
      label: "Presentation Environment",
      objectKind: "presentation",
      surfaces: ["presentation", "edit", "structure"],
      defaultSurface: "presentation",
      runtimeMode: "rendered",
      cloneTarget: "gamma-like presentation",
      capabilityFamilies: ["creation", "presentation"],
      continuityMode: "object_first"
    });
  }

  if (normalizedShape === "dashboard") {
    return createEnvironmentBlueprint("dashboard", {
      label: "Dashboard Environment",
      objectKind: "dashboard",
      surfaces: ["dashboard", "data", "edit", "structure"],
      defaultSurface: "dashboard",
      runtimeMode: "interactive",
      cloneTarget: "analytics dashboard",
      capabilityFamilies: ["data_analysis", "visualization"],
      continuityMode: "object_first"
    });
  }

  if (normalizedShape === "benchmark") {
    return createEnvironmentBlueprint("benchmark", {
      label: "Benchmark Environment",
      objectKind: "benchmark",
      surfaces: ["benchmark", "data", "edit", "structure"],
      defaultSurface: "benchmark",
      runtimeMode: "rendered",
      cloneTarget: "benchmark workspace",
      capabilityFamilies: ["research", "analysis", "strategy"],
      continuityMode: "project_first"
    });
  }

  if (normalizedShape === "campaign") {
    return createEnvironmentBlueprint("campaign", {
      label: "Campaign Environment",
      objectKind: "campaign",
      surfaces: ["campaign", "preview", "edit", "structure"],
      defaultSurface: "campaign",
      runtimeMode: "rendered",
      cloneTarget: "campaign builder",
      capabilityFamilies: ["creation", "narrative", "marketing"],
      continuityMode: "project_first"
    });
  }

  if (normalizedShape === "workflow") {
    return createEnvironmentBlueprint("workflow", {
      label: "Workflow Environment",
      objectKind: "workflow",
      surfaces: ["workflow", "edit", "structure"],
      defaultSurface: "workflow",
      runtimeMode: "interactive",
      cloneTarget: "n8n-like workflow",
      capabilityFamilies: ["automation", "agents"],
      continuityMode: "object_first"
    });
  }

  if (normalizedShape === "design") {
    return createEnvironmentBlueprint("design", {
      label: "Design Environment",
      objectKind: "design",
      surfaces: ["design", "edit", "structure"],
      defaultSurface: "design",
      runtimeMode: "interactive",
      cloneTarget: "figma-like wireframe",
      capabilityFamilies: ["design", "visual"],
      continuityMode: "object_first"
    });
  }

  if (normalizedShape === "image") {
    return createEnvironmentBlueprint("image", {
      label: "Image Environment",
      objectKind: "image",
      surfaces: ["media", "preview", "edit", "structure"],
      defaultSurface: "media",
      runtimeMode: "rendered",
      cloneTarget: "visual asset",
      capabilityFamilies: ["visual", "creative"],
      continuityMode: "project_first"
    });
  }

  if (normalizedShape === "audio") {
    return createEnvironmentBlueprint("audio", {
      label: "Audio Environment",
      objectKind: "audio",
      surfaces: ["preview", "edit", "structure"],
      defaultSurface: "preview",
      runtimeMode: "rendered",
      cloneTarget: "audio production brief",
      capabilityFamilies: ["audio", "creative"],
      continuityMode: "project_first"
    });
  }

  if (normalizedShape === "video") {
    return createEnvironmentBlueprint("video", {
      label: "Video Environment",
      objectKind: "video",
      surfaces: ["preview", "edit", "structure"],
      defaultSurface: "preview",
      runtimeMode: "rendered",
      cloneTarget: "video production brief",
      capabilityFamilies: ["video", "creative", "narrative"],
      continuityMode: "project_first"
    });
  }

  if (normalizedShape === "document") {
    return createEnvironmentBlueprint("document", {
      label: "Document Environment",
      objectKind: "document",
      surfaces: ["preview", "edit", "structure"],
      defaultSurface: "preview",
      runtimeMode: "rendered",
      cloneTarget: "notion-like document",
      capabilityFamilies: ["creation", "knowledge"],
      continuityMode: "object_first"
    });
  }

  if (normalizedShape === "app" || normalizedShape === "code_project") {
    return createEnvironmentBlueprint("app_builder", {
      label: "App Environment",
      objectKind: "project",
      surfaces: ["live", "edit", "structure"],
      defaultSurface: "live",
      runtimeMode: "live_runtime",
      shouldCreateProject: true,
      cloneTarget: "app builder",
      capabilityFamilies: ["development", "logic", "web"],
      continuityMode: "project_first"
    });
  }

  if (normalizedShape === "project") {
    return createEnvironmentBlueprint("global_project", {
      label: "Project Environment",
      objectKind: "project",
      surfaces: ["overview", "edit", "structure"],
      defaultSurface: "overview",
      runtimeMode: "hybrid",
      shouldCreateProject: true,
      cloneTarget: "global project workspace",
      capabilityFamilies: ["project", "organization"],
      continuityMode: "project_first"
    });
  }

  return createEnvironmentBlueprint("generic_workspace", {
    label: "Generic Workspace",
    objectKind: "document",
    surfaces: ["preview", "edit", "structure"],
    defaultSurface: "preview",
    runtimeMode: "rendered",
    cloneTarget: "generic editable workspace",
    capabilityFamilies: ["creation"],
    continuityMode: "object_first"
  });
}

export function planEnvironment({
  intentProfile = null,
  classification = "simple_chat",
  projectContext = null,
  activeWorkObject = null,
  globalProjectContext = null
} = {}) {
  const shape = intentProfile?.requestedShape?.shape || "unknown";
  const workspaceFamily = resolveWorkspaceFamily({
    prompt: intentProfile?.normalizedPrompt || intentProfile?.prompt || "",
    shape,
    objectKind: activeWorkObject?.objectKind || activeWorkObject?.kind || "",
    entryPath: activeWorkObject?.primaryFile || activeWorkObject?.activeEntryPath || "",
    workspaceFamilyId:
      intentProfile?.requestedShape?.workspaceFamilyId ||
      activeWorkObject?.metadata?.workspaceFamilyId ||
      activeWorkObject?.workspaceFamilyId ||
      ""
  });
  const blueprint = resolveBlueprintByShape(shape);
  const continueCurrentObject =
    Boolean(activeWorkObject) &&
    !intentProfile?.explicitNewEnvironment &&
    (intentProfile?.actionMode === "modify" || intentProfile?.continuationSignals);
  const surfaces = [...new Set([
    ...(blueprint.surfaces || []),
    ...(workspaceFamily?.defaultSurfaces || [])
  ])];
  const defaultSurface =
    (blueprint.surfaces || []).includes(blueprint.defaultSurface)
      ? blueprint.defaultSurface
      : workspaceFamily?.defaultSurface || blueprint.defaultSurface;
  const capabilityFamilies = [
    ...new Set([
      ...(workspaceFamily?.capabilityFamilies || []),
      ...(blueprint.capabilityFamilies || [])
    ])
  ];

  const environment = {
    ...blueprint,
    surfaces,
    defaultSurface,
    capabilityFamilies,
    workspaceFamilyId: workspaceFamily?.id || blueprint.workspaceFamilyId || "",
    workspaceFamilyLabel: workspaceFamily?.label || blueprint.workspaceFamilyLabel || "",
    workspaceFamilyDescription: workspaceFamily?.description || "",
    classification,
    requestedShape: shape,
    actionMode: intentProfile?.actionMode || "ask",
    userExpertise: intentProfile?.userExpertise || "intermediate",
    continueCurrentObject,
    continueCurrentProject:
      Boolean(projectContext?.linkedProjectId) ||
      (blueprint.shouldCreateProject && !intentProfile?.explicitNewEnvironment),
    projectLinked: Boolean(projectContext?.isProjectTask || blueprint.shouldCreateProject),
    hiddenConstraints: intentProfile?.hiddenConstraints || [],
    impliedNeeds: intentProfile?.impliedNeeds || [],
    globalProjectDimensions: globalProjectContext?.dimensions || [],
    summary: continueCurrentObject
      ? `Continue the current ${activeWorkObject?.objectKind || blueprint.objectKind} inside the ${String(
          workspaceFamily?.label || blueprint.label
        ).toLowerCase()}.`
      : `Create a ${String(
          workspaceFamily?.label || blueprint.label
        ).toLowerCase()} with ${surfaces.join(", ")} surfaces and ${blueprint.runtimeMode} runtime.`
  };

  return environment;
}

export default {
  inferEnvironmentObjectKind,
  planEnvironment
};
