const titleCaseWords = (value = "") =>
  String(value || "").replace(/\b\w/g, (char) => char.toUpperCase());

const DATASET_FAMILY_STRUCTURE_LABELS = Object.freeze({
  hr: {
    fileLabel: "People table",
    outlineLabel: "Fields",
    blockLabel: "People rows",
    editorLabel: "Edit people"
  },
  finance: {
    fileLabel: "Budget table",
    outlineLabel: "Fields",
    blockLabel: "Budget rows",
    editorLabel: "Edit budget"
  },
  crm_sales: {
    fileLabel: "Pipeline table",
    outlineLabel: "Fields",
    blockLabel: "Lead rows",
    editorLabel: "Edit pipeline"
  },
  knowledge_graph: {
    fileLabel: "Graph table",
    outlineLabel: "Fields",
    blockLabel: "Entity rows",
    editorLabel: "Edit graph"
  }
});

const WORKSPACE_TYPE_STRUCTURE_LABELS = Object.freeze({
  document: {
    fileLabel: "Document",
    outlineLabel: "Sections",
    blockLabel: "Focus area",
    editorLabel: "Edit document",
    sectionRootLabel: "Whole document",
    sectionRootMeta: "Edit the full source at once",
    sectionItemMeta: "Section",
    blockRootLabel: "Selected section",
    blockRootMeta: "Edit the section as one unit",
    blockItemMeta: "Detail",
    emptyBlockText: "Pick a section above to focus a tighter passage."
  },
  development: {
    fileLabel: "Code file",
    outlineLabel: "Modules",
    blockLabel: "Code blocks",
    editorLabel: "Edit code",
    sectionRootLabel: "Whole file",
    sectionRootMeta: "Edit the full source at once",
    sectionItemMeta: "Module",
    blockRootLabel: "Selected file",
    blockRootMeta: "Edit a focused source block",
    blockItemMeta: "Block",
    emptyBlockText: "Pick a code block above to focus one part of the file."
  },
  presentation: {
    fileLabel: "Deck",
    outlineLabel: "Slides",
    blockLabel: "Focus area",
    editorLabel: "Edit slide",
    sectionRootLabel: "Whole deck",
    sectionRootMeta: "Edit the full deck source",
    sectionItemMeta: "Slide",
    blockRootLabel: "Selected slide",
    blockRootMeta: "Edit the full slide at once",
    blockItemMeta: "Talking point",
    emptyBlockText: "Pick a slide above to focus a tighter message."
  },
  dashboard: {
    fileLabel: "Dashboard file",
    outlineLabel: "Views",
    blockLabel: "Widgets",
    editorLabel: "Edit dashboard",
    sectionRootLabel: "Whole dashboard",
    sectionRootMeta: "Edit the dashboard model",
    sectionItemMeta: "Dashboard view",
    blockRootLabel: "Selected dashboard",
    blockRootMeta: "Edit the full dashboard at once",
    blockItemMeta: "Widget",
    emptyBlockText: "Pick a dashboard view above to focus one widget."
  },
  workflow: {
    fileLabel: "Workflow file",
    outlineLabel: "Steps",
    blockLabel: "Connections",
    editorLabel: "Edit workflow",
    sectionRootLabel: "Whole workflow",
    sectionRootMeta: "Edit the full automation model",
    sectionItemMeta: "Step",
    blockRootLabel: "Selected flow",
    blockRootMeta: "Edit the current workflow at once",
    blockItemMeta: "Connection",
    emptyBlockText: "Pick a step above to focus a branch or connection."
  },
  design: {
    fileLabel: "Design file",
    outlineLabel: "Frames",
    blockLabel: "Blocks",
    editorLabel: "Edit design",
    sectionRootLabel: "Whole design",
    sectionRootMeta: "Edit the full design model",
    sectionItemMeta: "Frame",
    blockRootLabel: "Selected frame",
    blockRootMeta: "Edit the full frame at once",
    blockItemMeta: "Block",
    emptyBlockText: "Pick a frame above to focus a smaller layout block."
  },
  appConfig: {
    fileLabel: "Builder file",
    outlineLabel: "Views",
    blockLabel: "Panels",
    editorLabel: "Build app",
    sectionRootLabel: "Whole app",
    sectionRootMeta: "Edit the full app blueprint",
    sectionItemMeta: "View",
    blockRootLabel: "Selected view",
    blockRootMeta: "Edit the full view at once",
    blockItemMeta: "Panel",
    emptyBlockText: "Pick a view above to focus a smaller area."
  }
});

const WORKSPACE_FAMILY_STRUCTURE_LABELS = Object.freeze({
  document_knowledge: {
    fileLabel: "Document",
    outlineLabel: "Sections",
    blockLabel: "Focus area",
    editorLabel: "Edit document",
    sectionItemMeta: "Section",
    blockItemMeta: "Detail"
  },
  development: {
    fileLabel: "Code file",
    outlineLabel: "Modules",
    blockLabel: "Focus area",
    editorLabel: "Edit code",
    sectionItemMeta: "Module",
    blockItemMeta: "Code block"
  },
  project_management: {
    fileLabel: "Project file",
    outlineLabel: "Tracks",
    blockLabel: "Focus area",
    editorLabel: "Edit project",
    sectionItemMeta: "Track",
    blockItemMeta: "Work item"
  },
  file_storage: {
    fileLabel: "Storage file",
    outlineLabel: "Folders",
    blockLabel: "Assets",
    editorLabel: "Edit storage",
    sectionItemMeta: "Folder group",
    blockItemMeta: "Asset rule"
  },
  strategy_planning: {
    fileLabel: "Plan",
    outlineLabel: "Themes",
    blockLabel: "Arguments",
    editorLabel: "Edit plan",
    sectionItemMeta: "Theme",
    blockItemMeta: "Point"
  },
  finance: {
    fileLabel: "Finance file",
    outlineLabel: "Sections",
    blockLabel: "Focus area",
    editorLabel: "Edit finance",
    sectionItemMeta: "Finance section",
    blockItemMeta: "Line"
  },
  hr: {
    fileLabel: "People file",
    outlineLabel: "Sections",
    blockLabel: "Policies",
    editorLabel: "Edit HR",
    sectionItemMeta: "People section",
    blockItemMeta: "HR detail"
  },
  testing_qa: {
    fileLabel: "QA file",
    outlineLabel: "Scenarios",
    blockLabel: "Checks",
    editorLabel: "Edit QA",
    sectionItemMeta: "Scenario",
    blockItemMeta: "Check"
  },
  knowledge_graph: {
    fileLabel: "Graph file",
    outlineLabel: "Entities",
    blockLabel: "Relations",
    editorLabel: "Edit structure",
    sectionItemMeta: "Entity group",
    blockItemMeta: "Relation"
  },
  web_cms: {
    fileLabel: "Site file",
    outlineLabel: "Pages",
    blockLabel: "Content blocks",
    editorLabel: "Edit site",
    sectionItemMeta: "Page",
    blockItemMeta: "Content block"
  }
});

export function createWorkspaceStructureLabels({ familyId = "", workspaceType = "" } = {}) {
  if (workspaceType === "dataset") {
    const current = DATASET_FAMILY_STRUCTURE_LABELS[familyId] || {};
    return {
      fileLabel: current.fileLabel || "Table",
      outlineLabel: "Columns",
      blockLabel: current.blockLabel || "Rows",
      editorLabel: current.editorLabel || "Edit table",
      sectionRootLabel: "Whole table",
      sectionRootMeta: "Edit the full grid at once",
      sectionItemMeta: current.outlineLabel || "Column view",
      blockRootLabel: "Selected column set",
      blockRootMeta: "Edit the visible table at once",
      blockItemMeta: current.blockLabel ? titleCaseWords(current.blockLabel) : "Row snapshot",
      emptyBlockText: "Pick a data view above to focus a smaller slice."
    };
  }

  if (WORKSPACE_TYPE_STRUCTURE_LABELS[workspaceType]) {
    return { ...WORKSPACE_TYPE_STRUCTURE_LABELS[workspaceType] };
  }

  const current = WORKSPACE_FAMILY_STRUCTURE_LABELS[familyId] || {};
  return {
    fileLabel: current.fileLabel || "Open",
    outlineLabel: current.outlineLabel || "Outline",
    blockLabel: current.blockLabel || "Focus area",
    editorLabel: current.editorLabel || "Edit",
    sectionRootLabel: "Everything",
    sectionRootMeta: "Edit the whole page",
    sectionItemMeta: current.sectionItemMeta || "Part",
    blockRootLabel: "Selected part",
    blockRootMeta: "Edit the whole part at once",
    blockItemMeta: current.blockItemMeta || "Focus area",
    emptyBlockText: "Pick a part above to focus a smaller piece."
  };
}
