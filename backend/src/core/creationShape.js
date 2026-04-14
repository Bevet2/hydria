import { normalizePromptText } from "./promptNormalization.js";
import { resolveWorkspaceFamily } from "../workspaces/workspaceRegistry.js";

function normalizeText(value = "") {
  return normalizePromptText(value);
}

function has(pattern, text = "") {
  return pattern.test(text);
}

const SHAPE_METADATA = {
  project: {
    family: "project",
    label: "project",
    executable: true
  },
  app: {
    family: "project",
    label: "app",
    executable: true
  },
  code_project: {
    family: "project",
    label: "code project",
    executable: true
  },
  spreadsheet: {
    family: "artifact",
    label: "spreadsheet",
    executable: false
  },
  dataset: {
    family: "artifact",
    label: "data",
    executable: false
  },
  presentation: {
    family: "artifact",
    label: "presentation",
    executable: false
  },
  document: {
    family: "artifact",
    label: "document",
    executable: false
  },
  dashboard: {
    family: "artifact",
    label: "dashboard",
    executable: false
  },
  benchmark: {
    family: "artifact",
    label: "benchmark",
    executable: false
  },
  campaign: {
    family: "artifact",
    label: "campaign",
    executable: false
  },
  workflow: {
    family: "artifact",
    label: "workflow",
    executable: false
  },
  design: {
    family: "artifact",
    label: "design",
    executable: false
  },
  image: {
    family: "artifact",
    label: "image",
    executable: false
  },
  audio: {
    family: "artifact",
    label: "audio",
    executable: false
  },
  video: {
    family: "artifact",
    label: "video",
    executable: false
  },
  unknown: {
    family: "unknown",
    label: "unknown",
    executable: false
  }
};

function finalizeRequestedShape(result = {}, prompt = "", normalizedPrompt = "") {
  const workspaceFamily = resolveWorkspaceFamily({
    prompt: prompt || normalizedPrompt,
    shape: result.shape || "unknown"
  });
  const preferredShape = workspaceFamily?.preferredShape || "";
  const shouldRefineShape =
    preferredShape &&
    (result.shape === "unknown" ||
      (result.shape === "project" &&
        !["project_management", "strategy_planning", "file_storage"].includes(
          workspaceFamily?.id || ""
        )));
  const resolvedShape = shouldRefineShape ? preferredShape : result.shape;
  const shapeMetadata = SHAPE_METADATA[resolvedShape] || SHAPE_METADATA.unknown;

  return {
    ...result,
    shape: resolvedShape,
    family: shapeMetadata.family,
    label: shapeMetadata.label,
    executable: shapeMetadata.executable,
    workspaceFamilyId: workspaceFamily?.id || "",
    workspaceFamilyLabel: workspaceFamily?.label || "",
    workspaceFamilyResolution: workspaceFamily?.resolution || "default"
  };
}

export function resolveRequestedShape(prompt = "") {
  const normalized = normalizeText(prompt);
  const finalize = (result) => finalizeRequestedShape(result, prompt, normalized);
  const explicitAppSignal = has(
    /\b(app|application|site|tool|widget|interface|ui|web app)\b/,
    normalized
  );
  const explicitArtifactSignal = has(
    /\b(document|rapport|report|brief|memo|guide|wiki|knowledge base|note taking system|outline builder|mindmap|dashboard|analytics|visualisation|visualization|data viz|chart|charts|kpi|reporting|workflow|automation|n8n|figma|wireframe|design system|ui builder|layout editor|spreadsheet|excel|tableur|worksheet|workbook|sheet|csv|xlsx|presentation|slides?|deck|powerpoint|pitch deck|diaporama|business plan|plan d'affaires|plan d affaires|benchmark|competitive analysis|analyse concurrentielle|campaign|campagne|launch plan|go to market|go-to-market|image|visual|poster|banner|illustration|audio|music|soundtrack|voice ?over|podcast|video|trailer|storyboard|clip)\b/,
    normalized
  );
  const explicitProjectSignal = has(
    /\b(project|projet|workspace|experience|systeme|system|plateforme|platform)\b/,
    normalized
  );

  if (
    has(
      /\b(transforme|transform|convertis|convert|turn)\b.+\b(en|into)\b.+\b(project|projet|workspace|systeme|system|platform|plateforme)\b/,
      normalized
    )
  ) {
    return finalize({
      shape: "project",
      family: "project",
      label: "project",
      executable: true
    });
  }

  if (
    has(
      /\b(transforme|transform|convertis|convert|turn)\b.+\b(en|into)\b.+\b(app|application|site|tool|widget|interface|ui)\b/,
      normalized
    )
  ) {
    return finalize({
      shape: "app",
      family: "project",
      label: "app",
      executable: true
    });
  }

  if (
    has(
      /\b(transforme|transform|convertis|convert|turn)\b.+\b(en|into)\b.+\b(presentation|slides?|deck|powerpoint|diaporama)\b/,
      normalized
    )
  ) {
    return finalize({
      shape: "presentation",
      family: "artifact",
      label: "presentation",
      executable: false
    });
  }

  if (
    has(
      /\b(transforme|transform|convertis|convert|turn)\b.+\b(en|into)\b.+\b(dashboard|analytics|workflow|wireframe|design|spreadsheet|excel|tableur|dataset)\b/,
      normalized
    )
  ) {
    if (/\bworkflow\b/.test(normalized)) {
      return finalize({ shape: "workflow", family: "artifact", label: "workflow", executable: false });
    }
    if (/\b(wireframe|design)\b/.test(normalized)) {
      return finalize({ shape: "design", family: "artifact", label: "design", executable: false });
    }
    if (/\b(spreadsheet|excel|tableur|dataset)\b/.test(normalized)) {
      return finalize({ shape: "spreadsheet", family: "artifact", label: "spreadsheet", executable: false });
    }
    return finalize({ shape: "dashboard", family: "artifact", label: "dashboard", executable: false });
  }

  if (
    has(
      /\b(transforme|transform|convertis|convert|turn)\b.+\b(en|into)\b.+\b(benchmark|competitive analysis|analyse concurrentielle|campaign|campagne|launch plan|go to market|image|visual|poster|banner|illustration|audio|music|soundtrack|voice ?over|podcast|video|trailer|storyboard|clip)\b/,
      normalized
    )
  ) {
    if (/\b(benchmark|competitive analysis|analyse concurrentielle)\b/.test(normalized)) {
      return finalize({ shape: "benchmark", family: "artifact", label: "benchmark", executable: false });
    }
    if (/\b(campaign|campagne|launch plan|go to market|go-to-market)\b/.test(normalized)) {
      return finalize({ shape: "campaign", family: "artifact", label: "campaign", executable: false });
    }
    if (/\b(image|visual|poster|banner|illustration)\b/.test(normalized)) {
      return finalize({ shape: "image", family: "artifact", label: "image", executable: false });
    }
    if (/\b(audio|music|soundtrack|voice ?over|podcast)\b/.test(normalized)) {
      return finalize({ shape: "audio", family: "artifact", label: "audio", executable: false });
    }
    return finalize({ shape: "video", family: "artifact", label: "video", executable: false });
  }

  if (
    explicitProjectSignal &&
    !explicitArtifactSignal &&
    !explicitAppSignal &&
    !has(
      /\b(document|rapport|report|brief|memo|guide|wiki|knowledge base|note taking system|outline builder|mindmap)\b/,
      normalized
    )
  ) {
    return finalize({
      shape: "project",
      family: "project",
      label: "project",
      executable: true
    });
  }

  if (
    explicitAppSignal &&
    !has(
      /\b(document editor|notion|google docs|wiki builder|knowledge base|note taking system|prompt composer|presentation|slides?|deck|powerpoint|spreadsheet|excel|tableur|document|rapport|report|brief|benchmark|competitive analysis|analyse concurrentielle|campaign|campagne|image|visual|poster|banner|illustration|audio|music|soundtrack|voice ?over|podcast|video|trailer|storyboard|clip)\b/,
      normalized
    )
  ) {
    return finalize({
      shape: "app",
      family: "project",
      label: "app",
      executable: true
    });
  }

  if (
    has(
      /\b(dashboard|analytics|visualisation|visualization|data viz|chart|charts|kpi|reporting|power bi|tableau software|tableau bi|data visualization|analytics explorer)\b/,
      normalized
    )
  ) {
    return finalize({
      shape: "dashboard",
      family: "artifact",
      label: "dashboard",
      executable: false
    });
  }

  if (
    has(
      /\b(benchmark|competitive analysis|analyse concurrentielle|benchmark concurrentiel|competitor map|market scan)\b/,
      normalized
    )
  ) {
    return finalize({
      shape: "benchmark",
      family: "artifact",
      label: "benchmark",
      executable: false
    });
  }

  if (
    has(
      /\b(campaign|campagne|launch plan|go to market|go-to-market|marketing campaign|content campaign)\b/,
      normalized
    )
  ) {
    return finalize({
      shape: "campaign",
      family: "artifact",
      label: "campaign",
      executable: false
    });
  }

  if (
    has(
      /\b(workflow|automation|n8n|pipeline builder|scheduled jobs?|event driven|orchestration|kanban automation|agent builder|multi-agent orchestration|workflow automation|automation engine|scheduled job|event-driven actions?)\b/,
      normalized
    )
  ) {
    return finalize({
      shape: "workflow",
      family: "artifact",
      label: "workflow",
      executable: false
    });
  }

  if (
    has(
      /\b(figma|wireframe|design system|ui builder|layout editor|wireframes?|mockup|mock-up|design|wireframe tool|layout tool|ui surface)\b/,
      normalized
    )
  ) {
    return finalize({
      shape: "design",
      family: "artifact",
      label: "design",
      executable: false
    });
  }

  if (
    has(
      /\b(image|visual|poster|banner|illustration|cover art|hero image|thumbnail)\b/,
      normalized
    )
  ) {
    return finalize({
      shape: "image",
      family: "artifact",
      label: "image",
      executable: false
    });
  }

  if (
    has(
      /\b(audio|music|soundtrack|voice ?over|voiceover|podcast|audio editor|music generator|voice synthesis)\b/,
      normalized
    )
  ) {
    return finalize({
      shape: "audio",
      family: "artifact",
      label: "audio",
      executable: false
    });
  }

  if (
    has(
      /\b(video|trailer|storyboard|clip|video editor|animation|pitch video|demo video)\b/,
      normalized
    )
  ) {
    return finalize({
      shape: "video",
      family: "artifact",
      label: "video",
      executable: false
    });
  }

  if (
    has(
      /\b(excel|spreadsheet|tableur|worksheet|workbook|google sheets|sheet|feuille|colonnes?|lignes?|cellules?|csv|xlsx|grille de donnees?|data grid|sql editor|etl|pipeline builder)\b/,
      normalized
    )
  ) {
    return finalize({
      shape: "spreadsheet",
      family: "artifact",
      label: "spreadsheet",
      executable: false
    });
  }

  if (
    has(
      /\b(presentation|slides?|slide deck|deck|powerpoint|pptx?|pitch deck|diaporama|gamma|storytelling tool)\b/,
      normalized
    )
  ) {
    return finalize({
      shape: "presentation",
      family: "artifact",
      label: "presentation",
      executable: false
    });
  }

  if (
    has(
      /\b(business plan|plan d'affaires|plan d affaires|document|rapport|report|brief|memo|guide|wiki|knowledge base|note|notes|outline|mindmap|mind map|notion|google docs|prompt composer|knowledge base|note taking|outline builder)\b/,
      normalized
    )
  ) {
    return finalize({
      shape: "document",
      family: "artifact",
      label: "document",
      executable: false
    });
  }

  if (
    has(
      /\b(sql|dataset|data|dashboard|analytics|visualisation|visualization|etl|pipeline|database|data grid)\b/,
      normalized
    )
  ) {
    return finalize({
      shape: "dataset",
      family: "artifact",
      label: "data",
      executable: false
    });
  }

  if (
    has(
      /\b(api|backend|frontend|auth|jwt|express|node|react|script runner|workflow|automation|terminal|code editor|app builder|vs code|debug console|automation engine|backend runner|deploy|hosting)\b/,
      normalized
    )
  ) {
    return finalize({
      shape: "code_project",
      family: "project",
      label: "code project",
      executable: true
    });
  }

  if (
    has(
      /\b(project|projet|workspace|experience|systeme|system|plateforme|platform|project manager|task manager|roadmap|kanban|timeline|resource planner|collaboration)\b/,
      normalized
    )
  ) {
    return finalize({
      shape: "project",
      family: "project",
      label: "project",
      executable: true
    });
  }

  if (
    has(
      /\b(app|application|site|tool|widget|dashboard|interface|ui|web app)\b/,
      normalized
    )
  ) {
    return finalize({
      shape: "app",
      family: "project",
      label: "app",
      executable: true
    });
  }

  return finalize({
    shape: "unknown",
    family: "unknown",
    label: "unknown",
    executable: false
  });
}

export default {
  resolveRequestedShape
};
