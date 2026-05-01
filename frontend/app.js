import { renderChatMessage } from "./components/chatMessage.js";
import { renderRunDetails } from "./components/detailsPanel.js";
import {
  applyWorkspaceBlockEdit,
  applyWorkspaceSectionEdit,
  deriveWorkspaceBlocks,
  deriveWorkspaceSections,
  matchesWorkspaceDimension,
  renderProjectCards,
  renderWorkspaceBreadcrumb,
  renderWorkspaceBlockList,
  renderWorkspaceDimensionNav,
  renderWorkspaceObjectList,
  renderWorkspaceProjectMap,
  renderWorkspacePreview,
  renderWorkspaceSurfaceNav,
  renderWorkspaceSectionList
} from "./components/workspacePanel.js";
import { apiClient } from "./services/apiClient.js";
import { sessionStore } from "./services/sessionStore.js";

const state = {
  config: null,
  users: [],
  conversations: [],
  messages: [],
  preferences: {},
  lastRun: null,
  loading: false,
  pendingAttachments: [],
  currentUserId: null,
  currentConversationId: null,
  projects: [],
  currentProjectId: null,
  currentWorkspace: null,
  workObjects: [],
  currentWorkObjectId: null,
  currentWorkObject: null,
  currentWorkObjectFile: "",
  currentSections: [],
  currentSectionId: "",
  currentBlocks: [],
  currentBlockId: "",
  currentStructuredItemId: "",
  currentStructuredSubItemId: "",
  currentPreviewFilter: "",
  currentDimension: "",
  currentSurfaceId: "",
  currentRuntimeSession: null,
  currentRuntimePatch: null,
  liveRuntimeDraft: "",
  workspaceMode: "view",
  copilotOpen: false,
  editorDirty: false,
  editorDraft: "",
  editorDraftKey: "",
  autoSaveHandle: null,
  autoSaving: false,
  liveDraftRefreshHandle: null,
  runtimeSyncHandle: null,
  runtimeSyncRequestId: 0,
  documentProjectContextVisible: true,
  ready: false,
  bootPromise: null
};

const el = {};

function cache() {
  [
    "status-text",
    "provider-pill",
    "strategy-pill",
    "copilot-toggle-button",
    "assistant-dock",
    "assistant-status-text",
    "assistant-role-heading",
    "assistant-helper-text",
    "workspace-save-button",
    "user-count",
    "user-select",
    "new-user-input",
    "create-user-button",
    "conversation-list",
    "conversation-header-title",
    "new-conversation-button",
    "clear-conversation-button",
    "project-count",
    "new-project-button",
    "project-list",
    "work-object-count",
    "work-object-list",
    "chat-thread",
    "copilot-panel",
    "chat-form",
    "prompt-input",
    "send-button",
    "active-work-object-badge",
    "loader",
    "attachment-input",
    "clear-attachments-button",
    "attachment-list",
    "save-preferences-button",
    "pref-language",
    "pref-tone",
    "pref-format",
    "run-details",
    "work-object-kind",
    "workspace-panel-root",
    "workspace-launcher",
    "workspace-layout",
    "workspace-switcher",
    "workspace-context-label",
    "workspace-title",
    "workspace-subtitle",
    "workspace-operating-strip",
    "workspace-operating-mode",
    "workspace-operating-role",
    "workspace-operating-risk",
    "workspace-mode-nav",
    "workspace-project-context-toggle",
    "workspace-view-status",
    "work-object-empty",
    "workspace-project-badge",
    "workspace-project-meta",
    "workspace-dimensions",
    "workspace-breadcrumb",
    "workspace-project-map",
    "workspace-action-guide",
    "workspace-action-guide-title",
    "workspace-action-guide-text",
    "workspace-action-guide-steps",
    "workspace-edit-now-button",
    "workspace-ask-hydria-button",
    "workspace-save-now-button",
    "workspace-dimension-nav",
    "workspace-surface-nav",
    "workspace-object-list",
    "workspace-file-label",
    "workspace-outline-label",
    "workspace-block-label",
    "workspace-section-list",
    "workspace-block-list",
    "workspace-preview",
    "work-object-meta",
    "work-object-file-select",
    "workspace-editor-label",
    "workspace-structured-editor",
    "work-object-editor",
    "save-work-object-button",
    "work-object-improve-prompt",
    "improve-work-object-button",
    "detail-classification",
    "detail-strategy",
    "detail-task-pack",
    "detail-routing",
    "detail-follow-ups",
    "detail-judge",
    "detail-models",
    "detail-apis",
    "detail-tools",
    "detail-memory",
    "detail-plan",
    "detail-candidates",
    "detail-sources",
    "detail-attachments",
    "detail-evidence",
    "detail-delivery",
    "detail-artifacts",
    "detail-duration"
  ].forEach((id) => {
    el[id] = document.getElementById(id);
  });

  el.details = {
    classification: el["detail-classification"],
    strategy: el["detail-strategy"],
    taskPack: el["detail-task-pack"],
    routing: el["detail-routing"],
    followUps: el["detail-follow-ups"],
    judge: el["detail-judge"],
    models: el["detail-models"],
    apis: el["detail-apis"],
    tools: el["detail-tools"],
    memory: el["detail-memory"],
    plan: el["detail-plan"],
    candidates: el["detail-candidates"],
    sources: el["detail-sources"],
    attachments: el["detail-attachments"],
    evidence: el["detail-evidence"],
    delivery: el["detail-delivery"],
    artifacts: el["detail-artifacts"],
    duration: el["detail-duration"]
  };
}

function setStatus(text) {
  el["status-text"].textContent = text;
  if (el["assistant-status-text"]) {
    el["assistant-status-text"].textContent = text;
  }
}

function setInteractiveEnabled(flag) {
  [
    "prompt-input",
    "send-button",
    "new-conversation-button",
    "new-project-button",
    "clear-conversation-button"
  ].forEach((id) => {
    if (el[id]) {
      el[id].disabled = !flag;
    }
  });
}

function focusPromptComposer() {
  setCopilotOpen(true);
  window.requestAnimationFrame(() => {
    el["prompt-input"]?.focus();
  });
}

function focusWorkspaceEditor() {
  if (state.workspaceMode !== "edit") {
    setWorkspaceMode("edit");
    renderWorkspace();
  }
  window.requestAnimationFrame(() => {
    const structuredTarget =
      el["workspace-structured-editor"] && !el["workspace-structured-editor"].classList.contains("hidden")
        ? el["workspace-structured-editor"].querySelector(
            'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled])'
          )
        : null;
    (structuredTarget || el["work-object-editor"])?.focus();
  });
}

async function ensureConversationForWorkspace() {
  if (state.currentConversationId) {
    return state.currentConversationId;
  }
  if (!state.currentUserId) {
    throw new Error("No active user");
  }
  const created = await apiClient.createConversation(
    state.currentUserId,
    "Workspace"
  );
  state.currentConversationId = created.conversation?.id || null;
  await loadConversations();
  return state.currentConversationId;
}

async function createBlankWorkspace(kind, familyId, label) {
  if (!state.currentUserId) {
    throw new Error("No active user");
  }
  await ensureConversationForWorkspace();
  const payload = await apiClient.createWorkObject({
    kind,
    title: label ? `New ${label}` : `New ${kind}`,
    userId: state.currentUserId,
    conversationId: state.currentConversationId,
    workspaceFamilyId: familyId || ""
  });
  const workObject = payload.workObject;
  if (!workObject?.id) {
    throw new Error("Work object creation failed");
  }
  state.workObjects = [workObject, ...state.workObjects.filter((item) => item.id !== workObject.id)];
  await selectWorkObject(workObject.id, workObject.primaryFile || workObject.primaryEntry?.path || "");
}

function workspaceSwitcherItems() {
  return [
    { kind: "document", family: "document_knowledge", label: "Docs" },
    { kind: "dataset", family: "data_spreadsheet", label: "Sheets" },
    { kind: "presentation", family: "presentation", label: "Slides" },
    { kind: "dashboard", family: "analytics_dashboard", label: "Dashboard" },
    { kind: "workflow", family: "workflow_automation", label: "Automation" },
    { kind: "project", family: "app_builder", label: "App Builder" },
    { kind: "design", family: "design", label: "Whiteboard" },
    { kind: "code", family: "development", label: "Code Studio" }
  ];
}

function filteredConversations() {
  if (!state.currentProjectId) {
    return state.conversations;
  }
  const ids = sessionStore.getProjectConversations(state.currentProjectId);
  if (!ids.length) {
    return [];
  }
  return ids
    .map((id) => state.conversations.find((conversation) => String(conversation.id) === String(id)))
    .filter(Boolean);
}

async function waitForBoot() {
  if (state.ready || !state.bootPromise) {
    return;
  }

  await state.bootPromise;
}

function setLoading(flag) {
  state.loading = flag;
  el.loader.classList.toggle("hidden", !flag);
  el["prompt-input"].disabled = flag;
}

function formatBytes(bytes = 0) {
  return bytes < 1024 ?`${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

function currentContent() {
  return state.currentWorkObject?.file?.content || state.currentWorkObject?.content || "";
}

function currentSection() {
  return state.currentSections.find((section) => section.id === state.currentSectionId) || null;
}

function currentBlock() {
  return state.currentBlocks.find((block) => block.id === state.currentBlockId) || null;
}

function currentScopeLabel() {
  if (isPresentationWorkspace() && currentSection()) {
    return currentSection().title;
  }
  if (isDatasetWorkspace()) {
    return state.currentWorkObjectFile ?friendlyFileLabel(state.currentWorkObjectFile) : "Table";
  }
  if (isAppConfigWorkspace()) {
    return "App builder";
  }
  if (currentBlock()) {
    return `${currentBlock().title}`;
  }
  if (currentSection()) {
    return `${currentSection().title}`;
  }
  return state.currentWorkObjectFile ?`${state.currentWorkObjectFile}` : "Nothing selected";
}

function currentWorkspaceActionGuide() {
  if (isDatasetWorkspace()) {
    return {
      title: "Edit directly in preview",
      text: "Click a cell or a column name in the table preview, change it, then let Hydria continue from the same sheet.",
      editLabel: "Edit table",
      steps: ["1 Click a cell", "2 Type your change", "3 Saved automatically"]
    };
  }

  if (isPresentationWorkspace()) {
    return {
      title: "Edit the active slide directly",
      text: "Click the slide title or text in preview, rewrite it there, then ask Hydria to sharpen the story or visuals.",
      editLabel: "Edit slide",
      steps: ["1 Pick a slide", "2 Click the text", "3 Saved automatically"]
    };
  }

  if (isDocumentWorkspace()) {
    return {
      title: "Edit the page directly",
      text: "Click a heading, paragraph or list item in preview, change it there, then ask Hydria to continue from the same page.",
      editLabel: "Edit page",
      steps: ["1 Click the text", "2 Rewrite it", "3 Saved automatically"]
    };
  }

  if (isDashboardWorkspace()) {
    return {
      title: "Tune the dashboard directly",
      text: "Choose a widget or chart, adjust the KPIs and filters here, then ask Hydria for stronger signals or a better report structure.",
      editLabel: "Edit dashboard",
      steps: ["1 Pick a widget", "2 Adjust metrics", "3 Saved automatically"]
    };
  }

  if (isWorkflowWorkspace()) {
    return {
      title: "Refine the workflow directly",
      text: "Pick a step or connection, change the run logic here, then ask Hydria to add automations or simplify the flow.",
      editLabel: "Edit workflow",
      steps: ["1 Pick a step", "2 Change the flow", "3 Saved automatically"]
    };
  }

  if (isDesignWorkspace()) {
    return {
      title: "Adjust the design directly",
      text: "Pick a frame or block, move the layout here, then ask Hydria to upgrade the direction or add missing screens.",
      editLabel: "Edit design",
      steps: ["1 Pick a frame", "2 Adjust the layout", "3 Saved automatically"]
    };
  }

  if (isDevelopmentWorkspace()) {
    return {
      title: "Edit the code directly",
      text: "Pick a file or block, edit the source here, then ask Hydria to refactor, debug or extend the current project.",
      editLabel: "Edit code",
      steps: ["1 Pick a file", "2 Change the code", "3 Saved automatically"]
    };
  }

  if (isAppConfigWorkspace()) {
    return {
      title: "Build the app directly",
      text: "Pick a view, shape the builder config here, then ask Hydria to add new screens, logic or product flows.",
      editLabel: "Build app",
      steps: ["1 Pick a view", "2 Shape the app", "3 Saved automatically"]
    };
  }

  return {
    title: "Modify this directly",
    text: "Pick what you want to change, edit it here, or ask Hydria to continue the current project.",
    editLabel: "Modify now",
    steps: ["1 Pick a part", "2 Edit it here", "3 Saved automatically"]
  };
}

function currentEditorBaseline() {
  if (usesWholeFileStructuredEditing()) {
    return currentContent();
  }
  if (currentBlock()) {
    return currentBlock().block;
  }
  if (currentSection()) {
    return currentSection().block;
  }
  return currentContent();
}

function currentEditorKey() {
  if (usesWholeFileStructuredEditing()) {
    return currentStructuredDraftKey();
  }
  return [
    state.currentWorkObjectId || "",
    state.currentWorkObjectFile || "",
    state.currentSectionId || "",
    state.currentBlockId || ""
  ].join("::");
}

function currentDraftContent() {
  if (usesWholeFileStructuredEditing()) {
    if (state.editorDirty && state.editorDraftKey === currentEditorKey()) {
      return state.editorDraft;
    }
    return currentContent();
  }

  if (!(state.editorDirty && state.editorDraftKey === currentEditorKey())) {
    return currentContent();
  }

  if (currentBlock()) {
    return applyWorkspaceBlockEdit(
      currentContent(),
      state.currentWorkObjectFile,
      state.currentSectionId,
      state.currentBlockId,
      state.editorDraft,
      state.currentSections
    );
  }

  if (currentSection()) {
    return applyWorkspaceSectionEdit(
      currentContent(),
      state.currentWorkObjectFile,
      state.currentSectionId,
      state.editorDraft
    );
  }

  return state.editorDraft;
}

function syncPreviewInlineDraft(nextValue = "") {
  syncEditorDraft(nextValue, {
    forceEditMode: false,
    refreshWorkspace: false,
    suppressPreviewRefresh:
      (
        currentWorkspaceFamilyId() === "document_knowledge" ||
        isDatasetWorkspace()
      ) &&
      state.currentSurfaceId !== "edit"
  });
}

function updateDocumentPreviewInline(nextMarkdown = "") {
  syncPreviewInlineDraft(String(nextMarkdown || "").trim());
}

function updatePresentationPreviewInline(slideId = "", payload = {}) {
  const slide = state.currentSections.find((section) => section.id === slideId) || currentSection();
  if (slideId) {
    state.currentSectionId = slideId;
  }
  state.currentBlockId = "";
  const nextTitle =
    String(payload.title || slide?.title || "Slide").replace(/^slide\s+\d+\s*-\s*/i, "").trim() ||
    "Slide";
  const nextBody = normalizeEditorText(payload.body || "").trim();
  const nextBlock = nextBody ? `## ${nextTitle}\n\n${nextBody}` : `## ${nextTitle}`;
  syncPreviewInlineDraft(nextBlock);
}

function updateSpreadsheetHeaderFromPreview(columnIndex = 0, value = "") {
  const model = deriveSpreadsheetDraft(currentDraftContent());
  model.columns[columnIndex] = String(value || "").trim() || `Column ${columnIndex + 1}`;
  updateSpreadsheetDraftFromPreview(model);
}

function updateSpreadsheetCellFromPreview(rowIndex = 0, columnIndex = 0, value = "") {
  const model = deriveSpreadsheetDraft(currentDraftContent());
  if (!model.rows[rowIndex]) {
    model.rows[rowIndex] = Array.from({ length: model.columns.length }, () => "");
  }
  model.rows[rowIndex][columnIndex] = String(value || "");
  updateSpreadsheetDraftFromPreview(model);
}

function updateSpreadsheetDraftFromPreview(model = {}, options = {}) {
  syncEditorDraft(buildSpreadsheetContent(model), {
    forceEditMode: false,
    refreshWorkspace: Boolean(options.refreshWorkspace),
    suppressPreviewRefresh:
      Boolean(options.suppressPreviewRefresh) ||
      (
        isDatasetWorkspace() &&
        state.currentSurfaceId !== "edit" &&
        !options.refreshWorkspace
      )
  });
}

function friendlyFileLabel(filePath = "") {
  const normalized = String(filePath || "").replace(/\\/g, "/");
  if (!normalized) {
    return "";
  }

  const parts = normalized.split("/").filter(Boolean);
  if (parts.length <= 1) {
    return normalized;
  }

  return `${parts[parts.length - 2]} / ${parts[parts.length - 1]}`;
}

function friendlyWorkspaceFamilyLabel(value = "") {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }

  if (/[A-Z&]/.test(normalized) || normalized.includes(" / ")) {
    return normalized;
  }

  return normalized
    .split("_")
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function currentEnvironmentPlan() {
  const canUseLastRun =
    state.lastRun && Number(state.lastRun.conversationId || 0) === Number(state.currentConversationId || 0);
  return (
    state.currentWorkObject?.environmentPlan ||
    state.currentWorkspace?.project?.metadata?.environmentPlan ||
    (canUseLastRun ?state.lastRun?.environmentPlan : null) ||
    null
  );
}

function currentUsageScenario() {
  const canUseLastRun =
    state.lastRun && Number(state.lastRun.conversationId || 0) === Number(state.currentConversationId || 0);
  return (
    currentEnvironmentPlan()?.usageScenario ||
    state.currentWorkObject?.usageScenarioSimulation?.primaryScenario ||
    state.currentWorkspace?.project?.metadata?.usageScenarioSimulation?.primaryScenario ||
    (canUseLastRun ?state.lastRun?.usageScenarioSimulation?.primaryScenario : null) ||
    null
  );
}

function currentImpactOutcome() {
  const canUseLastRun =
    state.lastRun && Number(state.lastRun.conversationId || 0) === Number(state.currentConversationId || 0);
  return (
    currentEnvironmentPlan()?.impactOutcome ||
    state.currentWorkObject?.impactSimulation?.primaryOutcome ||
    state.currentWorkspace?.project?.metadata?.impactSimulation?.primaryOutcome ||
    (canUseLastRun ?state.lastRun?.impactSimulation?.primaryOutcome : null) ||
    null
  );
}

function currentWorkspaceLens() {
  const workObject = state.currentWorkObject;
  const project = state.currentWorkspace?.project || null;
  const kind = currentObjectKind() || (project ? "project" : "creation");
  const fileLabel = state.currentWorkObjectFile ? friendlyFileLabel(state.currentWorkObjectFile) : "";
  const workspaceFamilyId =
    workObject?.workspaceFamilyId ||
    currentEnvironmentPlan()?.workspaceFamilyId ||
    "";
  const title = workObject?.title || project?.name || "Hydria";
  const workspaceFamilyLabel =
    workObject?.workspaceFamilyLabel ||
    currentEnvironmentPlan()?.workspaceFamilyLabel ||
    "";
  const workspaceFamilyDescription =
    workObject?.workspaceFamilyDescription ||
    currentEnvironmentPlan()?.workspaceFamilyDescription ||
    "";

  const kindMap = {
    app: {
      label: "App",
      subtitle: "Use the app, edit it directly, then ask Hydria to extend or fix it.",
      helper: "Ask Hydria to add screens, flows, content or fixes to this app.",
      promptPlaceholder: "Ex: add a planner page, improve the recipe flow, fix the weekly view.",
      nextStep: "Next: add a view, flow or fix",
      priority: "delivery_first",
      scope: project?.name ? `Project · ${project.name}` : "Interactive app"
    },
    project: {
      label: "Project",
      subtitle: "This project groups what you have created so far and keeps it evolving in one place.",
      helper: "Ask Hydria to add a new surface, continue the project or transform what is open.",
      promptPlaceholder: "Ex: add a dashboard, create a presentation, extend the current app.",
      nextStep: "Next: extend the project",
      priority: "iteration_first",
      scope: project?.name ? `Project · ${project.name}` : "Project workspace"
    },
    dashboard: {
      label: "Dashboard",
      subtitle: "Operate the dashboard directly here, then ask Hydria to add metrics, views or filters.",
      helper: "Ask Hydria to add KPIs, views, filters or a new analytics panel to this dashboard.",
      promptPlaceholder: "Ex: add a churn KPI, add a weekly report view, keep the existing table.",
      nextStep: "Next: add metrics, views or filters",
      priority: "operations_first",
      scope: project?.name ? `Project · ${project.name}` : "Standalone dashboard"
    },
    benchmark: {
      label: "Benchmark",
      subtitle: "Keep the competitive picture in the same project, then ask Hydria to refine the criteria, competitors or recommendations.",
      helper: "Ask Hydria to sharpen the benchmark, add proof, or derive a presentation or campaign from it.",
      promptPlaceholder: "Ex: add two stronger competitors, strengthen the recommendations, turn this into slides.",
      nextStep: "Next: refine the benchmark or derive another asset",
      priority: "review_first",
      scope: project?.name ? `Project · ${project.name}` : "Benchmark"
    },
    campaign: {
      label: "Campaign",
      subtitle: "Shape the launch plan here, then ask Hydria to improve channels, assets or rollout.",
      helper: "Ask Hydria to add launch assets, sharpen the promise, or derive a teaser video from this campaign.",
      promptPlaceholder: "Ex: add a launch email, tighten the promise, create a teaser video from this campaign.",
      nextStep: "Next: improve channels, assets or rollout",
      priority: "review_first",
      scope: project?.name ? `Project · ${project.name}` : "Campaign"
    },
    workflow: {
      label: "Workflow",
      subtitle: "Move through the flow visually, then ask Hydria to add steps, links or automations.",
      helper: "Ask Hydria to add a step, automate a branch or simplify the current workflow.",
      promptPlaceholder: "Ex: add an approval step, connect publish after review, simplify this flow.",
      nextStep: "Next: add a step or automation",
      priority: "operations_first",
      scope: project?.name ? `Project · ${project.name}` : "Automation workflow"
    },
    design: {
      label: "Design",
      subtitle: "Work on the layout directly here, then ask Hydria to improve the wireframe or add screens.",
      helper: "Ask Hydria to improve the layout, add a frame or restructure the current design.",
      promptPlaceholder: "Ex: add a mobile frame, clean the hero layout, make this more premium.",
      nextStep: "Next: improve layout or frames",
      priority: "iteration_first",
      scope: project?.name ? `Project · ${project.name}` : "Wireframe design"
    },
    presentation: {
      label: "Presentation",
      subtitle: "Review the slides here, then ask Hydria to sharpen the narrative or add missing slides.",
      helper: "Ask Hydria to improve the pitch, rewrite a slide or add a stronger closing section.",
      promptPlaceholder: "Ex: make slide 2 stronger, add investor traction, shorten the opening.",
      nextStep: "Next: improve slides or story",
      priority: "review_first",
      scope: project?.name ? `Project · ${project.name}` : "Slide deck"
    },
    dataset: {
      label: "Spreadsheet",
      subtitle: "Edit the table directly here, then ask Hydria to add columns, summaries or transformations.",
      helper: "Ask Hydria to add columns, clean the data, compute totals or restructure the table.",
      promptPlaceholder: "Ex: add a total column, group values, clean this table and keep the rows.",
      nextStep: "Next: edit cells or transform data",
      priority: "iteration_first",
      scope: project?.name ? `Project · ${project.name}` : "Data table"
    },
    image: {
      label: "Image",
      subtitle: "Review the visual inside the project, then ask Hydria to regenerate or refine the brief.",
      helper: "Ask Hydria to change the direction, keep the same concept, or generate a cleaner visual.",
      promptPlaceholder: "Ex: make this more premium, keep the same idea, generate a cleaner variant.",
      nextStep: "Next: refine the visual",
      priority: "review_first",
      scope: project?.name ? `Project · ${project.name}` : "Visual asset"
    },
    audio: {
      label: "Audio",
      subtitle: "Keep the audio brief linked to the project, then ask Hydria to refine the script or cues.",
      helper: "Ask Hydria to change the voice, tighten the hook, or prepare a shorter cut.",
      promptPlaceholder: "Ex: make the hook shorter, keep the tone, add a stronger closing cue.",
      nextStep: "Next: refine the script or delivery",
      priority: "review_first",
      scope: project?.name ? `Project · ${project.name}` : "Audio brief"
    },
    video: {
      label: "Video",
      subtitle: "Keep the storyboard in the project, then ask Hydria to refine scenes, timing or on-screen text.",
      helper: "Ask Hydria to improve the hook, tighten the scenes, or turn the current app into a launch video.",
      promptPlaceholder: "Ex: make scene 2 clearer, keep it under 60 seconds, add a stronger close.",
      nextStep: "Next: refine scenes or storyboard",
      priority: "review_first",
      scope: project?.name ? `Project · ${project.name}` : "Video brief"
    },
    document: {
      label: "Document",
      subtitle: "Read and edit the document here, then ask Hydria to improve a section or transform it.",
      helper: "Ask Hydria to rewrite, strengthen or transform the current document.",
      promptPlaceholder: "Ex: improve the executive summary, make this clearer, turn this into slides.",
      nextStep: "Next: improve or transform the document",
      priority: "review_first",
      scope: project?.name ? `Project · ${project.name}` : "Structured document"
    },
    creation: {
      label: "Workspace",
      subtitle: "Create something and it will open here immediately.",
      helper: "Tell Hydria what to create. It will open the result here automatically.",
      promptPlaceholder: "Ex: crée une application de cuisine, fais un excel, fais une présentation.",
      nextStep: "Next: create something",
      scope: "Nothing open yet"
    }
  };

  const familyMap = {
    document_knowledge: {
      label: "Knowledge",
      subtitle: "Write, structure and connect knowledge directly in the project.",
      helper: "Ask Hydria to write, summarize, restructure or turn this knowledge into another project asset.",
      promptPlaceholder: "Ex: write a clearer spec, turn this into a wiki page, add an SOP from this document.",
      nextStep: "Next: write, structure or derive",
      priority: "review_first"
    },
    data_spreadsheet: {
      label: "Data",
      subtitle: "Work directly on the table, calculations and reporting logic here.",
      helper: "Ask Hydria to clean rows, add columns, compute summaries or derive a dashboard from this data.",
      promptPlaceholder: "Ex: add a margin column, clean duplicates, build a dashboard from this table.",
      nextStep: "Next: compute, clean or derive",
      priority: "iteration_first"
    },
    analytics_dashboard: {
      label: "Analytics",
      subtitle: "Operate KPIs, filters and views directly in the current analytics surface.",
      helper: "Ask Hydria to add charts, KPIs, comparisons or a decision view for this project.",
      promptPlaceholder: "Ex: add weekly retention, compare by segment, add an executive summary view.",
      nextStep: "Next: add signal or decision support",
      priority: "operations_first"
    },
    development: {
      label: "Development",
      subtitle: "Build, inspect and evolve code directly in the current project workspace.",
      helper: "Ask Hydria to add files, refactor, debug or extend the current codebase.",
      promptPlaceholder: "Ex: add auth, fix the API route, generate tests for this module.",
      nextStep: "Next: build, fix or extend",
      priority: "delivery_first"
    },
    app_builder: {
      label: "App Builder",
      subtitle: "Shape the product directly in live preview and keep extending the current app.",
      helper: "Ask Hydria to add views, flows, business logic or CRUD surfaces to the current app.",
      promptPlaceholder: "Ex: add a settings screen, create an onboarding flow, add CRUD for users.",
      nextStep: "Next: extend the app",
      priority: "delivery_first"
    },
    design: {
      label: "Design",
      subtitle: "Structure screens, flows and layout decisions directly in the design workspace.",
      helper: "Ask Hydria to improve hierarchy, add frames, tighten UX or derive screens from the app.",
      promptPlaceholder: "Ex: make the onboarding cleaner, add a mobile frame, align the hierarchy.",
      nextStep: "Next: refine layout or UX",
      priority: "iteration_first"
    },
    presentation: {
      label: "Presentation",
      subtitle: "Turn the current project into a stronger deck with a clearer story and proof.",
      helper: "Ask Hydria to sharpen the narrative, add slides, simplify the flow or derive slides from the app.",
      promptPlaceholder: "Ex: add investor proof, rewrite slide 2, turn the app flow into 3 clearer slides.",
      nextStep: "Next: sharpen story or proof",
      priority: "review_first"
    },
    project_management: {
      label: "Project Management",
      subtitle: "Keep roadmap, tasks and project continuity visible in one place.",
      helper: "Ask Hydria to add roadmap items, milestones, owners or a delivery plan.",
      promptPlaceholder: "Ex: add a 6-month roadmap, create milestones, turn this into a kanban.",
      nextStep: "Next: plan work or milestones",
      priority: "iteration_first"
    },
    strategy_planning: {
      label: "Strategy",
      subtitle: "Clarify direction, positioning and the next major choices for the project.",
      helper: "Ask Hydria to compare options, structure strategy, build a plan or challenge the current direction.",
      promptPlaceholder: "Ex: compare two launch options, build a GTM plan, structure the strategic narrative.",
      nextStep: "Next: decide or plan",
      priority: "review_first"
    },
    workflow_automation: {
      label: "Workflow",
      subtitle: "Build automations and operating flows directly in the current project.",
      helper: "Ask Hydria to add nodes, conditions, outputs or integrations to the current workflow.",
      promptPlaceholder: "Ex: add approval before publish, connect email after validation, simplify this flow.",
      nextStep: "Next: automate or simplify",
      priority: "operations_first"
    },
    ai_agent: {
      label: "AI / Agent",
      subtitle: "Coordinate copilots, automation and delegated work inside the same project.",
      helper: "Ask Hydria to create a specialist agent, add a review loop or automate a recurring cognitive task.",
      promptPlaceholder: "Ex: create a QA copilot, add a research agent, automate project follow-up.",
      nextStep: "Next: delegate or automate",
      priority: "iteration_first"
    },
    crm_sales: {
      label: "CRM & Sales",
      subtitle: "Track pipeline, leads and follow-up directly in the project workspace.",
      helper: "Ask Hydria to add a pipeline stage, lead view, sales dashboard or follow-up workflow.",
      promptPlaceholder: "Ex: add a pipeline view, create a lead score table, build a sales dashboard.",
      nextStep: "Next: track pipeline or follow-up",
      priority: "operations_first"
    },
    operations: {
      label: "Operations",
      subtitle: "Run the current operating system with clear queues, ownership and next actions.",
      helper: "Ask Hydria to add queues, operating dashboards, workflows or status views for this system.",
      promptPlaceholder: "Ex: add an incident queue, build an ops dashboard, create an intake workflow.",
      nextStep: "Next: operate or automate",
      priority: "operations_first"
    },
    finance: {
      label: "Finance",
      subtitle: "Work on budgets, reporting and finance workflows directly in the current project.",
      helper: "Ask Hydria to add forecasts, reporting views, controls or investor-facing finance assets.",
      promptPlaceholder: "Ex: add a monthly cash view, build a forecast, derive investor finance slides.",
      nextStep: "Next: report, plan or forecast",
      priority: "iteration_first"
    },
    hr: {
      label: "HR",
      subtitle: "Structure recruiting, team tracking and people workflows in one project.",
      helper: "Ask Hydria to add hiring stages, role scorecards, onboarding docs or staffing dashboards.",
      promptPlaceholder: "Ex: add a hiring pipeline, create onboarding docs, build a staffing dashboard.",
      nextStep: "Next: recruit or organize",
      priority: "iteration_first"
    },
    file_storage: {
      label: "Files",
      subtitle: "Keep project files, assets and references connected to the current work.",
      helper: "Ask Hydria to organize files, summarize assets, or connect the current project to references.",
      promptPlaceholder: "Ex: organize these files, attach a reference repo, summarize the uploaded assets.",
      nextStep: "Next: organize or connect",
      priority: "focus"
    },
    testing_qa: {
      label: "Testing",
      subtitle: "Check quality, scenarios and reliability inside the current project.",
      helper: "Ask Hydria to add test cases, QA scenarios, edge cases or validation flows.",
      promptPlaceholder: "Ex: add QA scenarios, generate test cases, validate edge cases for this app.",
      nextStep: "Next: validate or test",
      priority: "operations_first"
    },
    web_cms: {
      label: "Web & CMS",
      subtitle: "Shape pages, publishing flow and site content directly in the workspace.",
      helper: "Ask Hydria to add pages, CMS structure, publishing rules or landing content.",
      promptPlaceholder: "Ex: create a landing page, add CMS collections, build a content workflow.",
      nextStep: "Next: publish or structure content",
      priority: "delivery_first"
    },
    media: {
      label: "Media",
      subtitle: "Keep visual storytelling and content production linked to the same project.",
      helper: "Ask Hydria to derive visuals, campaign assets, storyboards or launch media from this project.",
      promptPlaceholder: "Ex: create a hero visual, derive a campaign asset, build a launch storyboard.",
      nextStep: "Next: produce or refine media",
      priority: "review_first"
    },
    audio: {
      label: "Audio",
      subtitle: "Keep voice, soundtrack and audio direction connected to the project.",
      helper: "Ask Hydria to refine script, pacing, cues or derive an audio asset from the current project.",
      promptPlaceholder: "Ex: tighten the voiceover, add cues, derive a 30-second audio version.",
      nextStep: "Next: script or score",
      priority: "review_first"
    },
    integration_api: {
      label: "Integrations",
      subtitle: "Connect APIs, services and back-office systems inside the same project.",
      helper: "Ask Hydria to add an API route, connector, payload map or integration workflow.",
      promptPlaceholder: "Ex: connect Stripe, add a webhook flow, map this payload to the CRM.",
      nextStep: "Next: connect or automate",
      priority: "operations_first"
    },
    knowledge_graph: {
      label: "Knowledge Graph",
      subtitle: "Structure entities, relationships and project memory in one connected system.",
      helper: "Ask Hydria to define entities, relations, schemas or derive structure from the current project.",
      promptPlaceholder: "Ex: map the entities, add relationships, build a graph from this knowledge base.",
      nextStep: "Next: connect or structure",
      priority: "iteration_first"
    }
  };

  const current = kindMap[kind] || kindMap.project;
  const familyCurrent = familyMap[workspaceFamilyId] || null;
  const effectiveLabel = workspaceFamilyLabel || familyCurrent?.label || current.label;
  const effectiveSubtitle = workspaceFamilyDescription || familyCurrent?.subtitle || current.subtitle;
  const effectiveScope =
    workspaceFamilyLabel && project?.name
      ? `${workspaceFamilyLabel} · ${project.name}`
      : workspaceFamilyLabel
        ? workspaceFamilyLabel
        : current.scope;

  return {
    kind,
    kindLabel: effectiveLabel,
    priorityLabel: effectiveLabel,
    prioritySubtitle: effectiveSubtitle,
    priority: familyCurrent?.priority || current.priority || "focus",
    promptPlaceholder: familyCurrent?.promptPlaceholder || current.promptPlaceholder,
    assistantTitle: "Hydria",
    assistantHelper: familyCurrent?.helper || current.helper,
    assistantStatus: workObject ? `Working on ${title}` : "Ready to create something new.",
    scopeLabel: fileLabel ? `${effectiveScope} · ${fileLabel}` : effectiveScope,
    nextStep: familyCurrent?.nextStep || current.nextStep,
    riskPosture: fileLabel || familyCurrent?.nextStep || current.nextStep,
    assistantRole: kind,
    interactionMode: kind,
    impactOutcome: null,
    usageScenario: null
  };
}

function currentWorkspaceStructureLabels() {
  const familyId =
    state.currentWorkObject?.workspaceFamilyId ||
    currentEnvironmentPlan()?.workspaceFamilyId ||
    "";

  if (isDatasetWorkspace()) {
    const datasetFamilyMap = {
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
    };
    const datasetCurrent = datasetFamilyMap[familyId] || {};
    return {
      fileLabel: datasetCurrent.fileLabel || "Table",
      outlineLabel: "Columns",
      blockLabel: datasetCurrent.blockLabel || "Rows",
      editorLabel: datasetCurrent.editorLabel || "Edit table",
      sectionRootLabel: "Whole table",
      sectionRootMeta: "Edit the full grid at once",
      sectionItemMeta: datasetCurrent.outlineLabel || "Column view",
      blockRootLabel: "Selected column set",
      blockRootMeta: "Edit the visible table at once",
      blockItemMeta: datasetCurrent.blockLabel ? datasetCurrent.blockLabel.replace(/\b\w/g, (char) => char.toUpperCase()) : "Row snapshot",
      emptyBlockText: "Pick a data view above to focus a smaller slice."
    };
  }

  if (isDocumentWorkspace()) {
    return {
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
    };
  }

  if (isDevelopmentWorkspace()) {
    return {
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
    };
  }

  if (isPresentationWorkspace()) {
    return {
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
    };
  }

  if (isDashboardWorkspace()) {
    return {
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
    };
  }

  if (isWorkflowWorkspace()) {
    return {
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
    };
  }

  if (isDesignWorkspace()) {
    return {
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
    };
  }

  if (isAppConfigWorkspace()) {
    return {
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
    };
  }

  const familyMap = {
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
  };

  const current = familyMap[familyId] || {};
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

function friendlyWorkspaceSubtitle(project = null, workObject = null, workspaceLens = null) {
  const candidates = [workObject?.summary, project?.globalProject?.summary]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  const usable = candidates.find(
    (value) => !/(dimensions?|capacites?|global project|aucune capacite|internal capabilities)/i.test(value)
  );
  if (usable) {
    return usable;
  }

  if (workspaceLens?.prioritySubtitle) {
    return workspaceLens.prioritySubtitle;
  }

  if (project || workObject?.objectKind === "project" || workObject?.kind === "project") {
    return "Preview the result, make focused edits, and keep improving the project here.";
  }

  if (workObject) {
    return "See it, adjust it, and save when it feels right.";
  }

  return "Open a project to start creating visually.";
}

function preferredOpenPath(workObject = null) {
  if (!workObject) {
    return "";
  }

  if (workObject.surfaceModel?.defaultSurface === "live" && workObject.surfaceModel?.runtimeEntryPath) {
    return workObject.surfaceModel.runtimeEntryPath;
  }

  return workObject.primaryFile || "";
}

function getEditableFiles(workObject = null) {
  if (!workObject) {
    return [];
  }

  const entryFiles = Array.isArray(workObject.entries)
    ?workObject.entries.filter((entry) => entry.editable).map((entry) => entry.path)
    : [];
  const editableFiles = Array.isArray(workObject.editableFiles) ?workObject.editableFiles : [];

  return [...new Set([...editableFiles, ...entryFiles, workObject.primaryFile].filter(Boolean))];
}

function getFilteredEditableFiles(workObject = null, dimension = "") {
  const files = getEditableFiles(workObject);
  if (!dimension) {
    return files;
  }

  const filtered = files.filter((filePath) => matchesWorkspaceDimension(filePath, dimension));
  return filtered.length ?filtered : files;
}

function currentSurfaceModel() {
  return state.currentWorkObject?.surfaceModel || null;
}

function currentSurfaces() {
  return currentSurfaceModel()?.availableSurfaces || [];
}

function preferredSurfaceForLens(workObject = null) {
  const surfaces = (workObject?.surfaceModel?.availableSurfaces || []).map((surface) => surface.id);
  const defaultSurface = workObject?.surfaceModel?.defaultSurface || surfaces[0] || "";
  const { priority = "focus" } = currentWorkspaceLens();

  if (!surfaces.length) {
    return defaultSurface;
  }

  if (priority === "delivery_first") {
    return ["live", "preview", "app", defaultSurface].find((surface) => surfaces.includes(surface)) || defaultSurface;
  }

  if (priority === "review_first") {
    return ["presentation", "benchmark", "campaign", "preview", "overview", defaultSurface].find((surface) => surfaces.includes(surface)) || defaultSurface;
  }

  if (priority === "operations_first") {
    return ["dashboard", "workflow", "benchmark", "campaign", "data", "preview", defaultSurface].find((surface) => surfaces.includes(surface)) || defaultSurface;
  }

  if (priority === "iteration_first") {
    return ["preview", "dashboard", "workflow", "design", "benchmark", "campaign", "media", "data", defaultSurface].find((surface) => surfaces.includes(surface)) || defaultSurface;
  }

  return defaultSurface;
}

function normalizeEditorText(value = "") {
  return String(value || "").replace(/\r\n/g, "\n");
}

function isCsvLikePath(filePath = "") {
  return /\.(csv|tsv)$/i.test(String(filePath || ""));
}

function isMarkdownLikePath(filePath = "") {
  return /\.(md|markdown|txt)$/i.test(String(filePath || ""));
}

function isDocumentLikePath(filePath = "") {
  return /\.(md|markdown|txt|html?)$/i.test(String(filePath || ""));
}

function isCodeLikePath(filePath = "") {
  return /(^|\/)(package\.json|tsconfig\.json|vite\.config\.(js|ts)|next\.config\.(js|ts|mjs)|server\.js|app\.js|index\.(js|ts|tsx|jsx))$/i.test(
    String(filePath || "")
  ) || /\.(js|mjs|cjs|ts|tsx|jsx|css|html|yml|yaml)$/i.test(String(filePath || ""));
}

function currentObjectKind() {
  return state.currentWorkObject?.objectKind || state.currentWorkObject?.kind || "";
}

function currentWorkspaceFamilyId() {
  return (
    state.currentWorkObject?.workspaceFamilyId ||
    currentEnvironmentPlan()?.workspaceFamilyId ||
    ""
  );
}

function currentDocumentWorkspaceProfile() {
  const familyId = currentWorkspaceFamilyId();
  const profileMap = {
    document_knowledge: {
      workspaceLabel: "Knowledge workspace",
      heroCopy: "Capture decisions, structure knowledge and keep reusable context connected to the project.",
      sectionPanelTitle: "Pages",
      sectionPanelHint: "Navigate the knowledge base page by page.",
      detailPanelTitle: "Notes",
      detailPanelHint: "Focus a smaller passage before asking Hydria to synthesize or derive.",
      propertyPanelTitle: "Knowledge posture",
      propertyPanelHint: "Keep source, page role and current focus visible.",
      linkedPanelTitle: "Linked knowledge",
      linkedPanelHint: "Surface related pages and the next useful artifacts."
    },
    project_management: {
      workspaceLabel: "Project management workspace",
      heroCopy: "Track workstreams, decisions and next actions like a live delivery board, not a static brief.",
      sectionPanelTitle: "Workstreams",
      sectionPanelHint: "Move through the current project track by track.",
      detailPanelTitle: "Work items",
      detailPanelHint: "Focus the current action or dependency before updating the rest.",
      propertyPanelTitle: "Project posture",
      propertyPanelHint: "Keep scope, owner and current track visible.",
      linkedPanelTitle: "Linked work",
      linkedPanelHint: "Surface related objects and next operational artifacts."
    },
    strategy_planning: {
      workspaceLabel: "Strategy workspace",
      heroCopy: "Shape hypotheses, decisions and priorities like a planning board, not a plain memo.",
      sectionPanelTitle: "Themes",
      sectionPanelHint: "Navigate strategic themes and planning arcs.",
      detailPanelTitle: "Arguments",
      detailPanelHint: "Refine one position, risk or decision at a time.",
      propertyPanelTitle: "Strategy posture",
      propertyPanelHint: "Keep objective, current thesis and source visible.",
      linkedPanelTitle: "Strategic derivatives",
      linkedPanelHint: "Surface the next deck, roadmap or execution artifact."
    },
    file_storage: {
      workspaceLabel: "Storage workspace",
      heroCopy: "Organize folders, file groups and storage rules like a drive index, not like generic prose.",
      sectionPanelTitle: "Folders",
      sectionPanelHint: "Navigate storage areas and folder groups.",
      detailPanelTitle: "Assets",
      detailPanelHint: "Focus a file group, retention rule or access note.",
      propertyPanelTitle: "Storage posture",
      propertyPanelHint: "Keep source path, ownership and storage rules visible.",
      linkedPanelTitle: "Linked storage",
      linkedPanelHint: "Surface files, destinations and derivative indexes."
    },
    testing_qa: {
      workspaceLabel: "QA workspace",
      heroCopy: "Organize test suites, scenarios and checks like a QA runbook, not a generic note.",
      sectionPanelTitle: "Suites",
      sectionPanelHint: "Move through suites and test flows.",
      detailPanelTitle: "Checks",
      detailPanelHint: "Focus one scenario or defect path at a time.",
      propertyPanelTitle: "QA posture",
      propertyPanelHint: "Keep current suite, source and coverage posture visible.",
      linkedPanelTitle: "Linked checks",
      linkedPanelHint: "Surface regressions, test assets and next validations."
    },
    web_cms: {
      workspaceLabel: "Web & CMS workspace",
      heroCopy: "Shape page inventory, site structure and publishing logic like a CMS planning surface.",
      sectionPanelTitle: "Pages",
      sectionPanelHint: "Navigate site areas and page groups.",
      detailPanelTitle: "Page details",
      detailPanelHint: "Focus a page block, publishing note or content gap.",
      propertyPanelTitle: "CMS posture",
      propertyPanelHint: "Keep current page, source and publishing role visible.",
      linkedPanelTitle: "Linked pages",
      linkedPanelHint: "Surface page derivatives, assets and related site objects."
    }
  };

  return profileMap[familyId] || {
    workspaceLabel: "Document workspace",
    heroCopy: "Shape the page like a real document workspace, then tighten one passage at a time.",
    sectionPanelTitle: "Outline",
    sectionPanelHint: "Move section by section through the current document.",
    detailPanelTitle: "Focus areas",
    detailPanelHint: "Use a smaller edit box when you want to adjust a precise passage.",
    propertyPanelTitle: "Page properties",
    propertyPanelHint: "Keep the page summary, source file and current section posture visible.",
    linkedPanelTitle: "Linked knowledge",
    linkedPanelHint: "Surface the pages, references and next artifacts this document can spawn."
  };
}

function currentDatasetWorkspaceProfile() {
  const familyId = currentWorkspaceFamilyId();
  const profileMap = {
    data_spreadsheet: {
      workspaceLabel: "Spreadsheet workspace",
      heroCopy: "Work directly in the grid, keep the shape of the sheet visible and extract signals without leaving the table.",
      sheetName: "Sheet 1",
      tabs: ["Grid", "Formula", "Summary"],
      sheetPanelTitle: "Sheets",
      sheetPanelHint: "Treat the current table like the primary sheet inside a spreadsheet workspace.",
      profilePanelTitle: "Data profile",
      profilePanelHint: "Keep the sheet shape visible while you work like in a real spreadsheet.",
      selectionPanelTitle: "Selection",
      selectionPanelHint: "Keep a formula-bar style focus on the current sheet even before cell-level selection.",
      computedPanelTitle: "Computed signals",
      computedPanelHint: "Expose the first useful calculations the current sheet already supports."
    },
    hr: {
      workspaceLabel: "HR workspace",
      heroCopy: "Track people, roles and status like an HR operations board, not a neutral spreadsheet.",
      sheetName: "Employees",
      tabs: ["People", "Status", "Summary"],
      sheetPanelTitle: "Employee views",
      sheetPanelHint: "Keep headcount and people segments visible while you edit the roster.",
      profilePanelTitle: "People profile",
      profilePanelHint: "Read the roster like an HR tracker with status and ownership in view.",
      selectionPanelTitle: "Current roster",
      selectionPanelHint: "Keep the visible employee slice anchored while you edit.",
      computedPanelTitle: "Headcount signals",
      computedPanelHint: "Expose the most useful people metrics from the current roster."
    },
    finance: {
      workspaceLabel: "Finance workspace",
      heroCopy: "Track budgets, categories and totals like a finance sheet, not a generic grid.",
      sheetName: "Budget",
      tabs: ["Budget", "Totals", "Summary"],
      sheetPanelTitle: "Budget sheets",
      sheetPanelHint: "Keep the main budget grid visible while you reshape the model.",
      profilePanelTitle: "Budget profile",
      profilePanelHint: "Read the grid like a finance tracker with coverage and numeric posture.",
      selectionPanelTitle: "Current range",
      selectionPanelHint: "Keep the visible budget range anchored while you edit.",
      computedPanelTitle: "Finance signals",
      computedPanelHint: "Expose totals, averages and the main numeric drivers."
    },
    crm_sales: {
      workspaceLabel: "CRM workspace",
      heroCopy: "Track leads, pipeline and next actions like a CRM board, not a plain sheet.",
      sheetName: "Pipeline",
      tabs: ["Pipeline", "Forecast", "Summary"],
      sheetPanelTitle: "Pipeline views",
      sheetPanelHint: "Keep stages and ownership visible while you update the pipeline.",
      profilePanelTitle: "Pipeline profile",
      profilePanelHint: "Read the table like a sales pipeline with stage posture and coverage.",
      selectionPanelTitle: "Current pipeline",
      selectionPanelHint: "Keep the active pipeline range in view while you edit.",
      computedPanelTitle: "Sales signals",
      computedPanelHint: "Expose stage totals, follow-up load and simple forecasting cues."
    },
    knowledge_graph: {
      workspaceLabel: "Knowledge graph workspace",
      heroCopy: "Shape entities and relations like a structured graph table, not a generic sheet.",
      sheetName: "Entities",
      tabs: ["Entities", "Relations", "Summary"],
      sheetPanelTitle: "Graph views",
      sheetPanelHint: "Keep entities and their relation structure visible while you edit.",
      profilePanelTitle: "Graph profile",
      profilePanelHint: "Read the sheet like a graph schema with structure and density in view.",
      selectionPanelTitle: "Current graph slice",
      selectionPanelHint: "Keep the visible entity range anchored while you edit.",
      computedPanelTitle: "Structure signals",
      computedPanelHint: "Expose the first useful density and relation cues from the graph."
    }
  };

  return profileMap[familyId] || profileMap.data_spreadsheet;
}

function isDatasetWorkspace() {
  return currentObjectKind() === "dataset" && isCsvLikePath(state.currentWorkObjectFile);
}

function isPresentationWorkspace() {
  return currentObjectKind() === "presentation" && isMarkdownLikePath(state.currentWorkObjectFile);
}

function isDashboardWorkspace() {
  return currentObjectKind() === "dashboard" && /\.json$/i.test(String(state.currentWorkObjectFile || ""));
}

function isWorkflowWorkspace() {
  return currentObjectKind() === "workflow" && /\.json$/i.test(String(state.currentWorkObjectFile || ""));
}

function isDesignWorkspace() {
  return currentObjectKind() === "design" && /\.json$/i.test(String(state.currentWorkObjectFile || ""));
}

function isAppConfigWorkspace() {
  return (
    currentObjectKind() === "project" &&
    /(^|\/)app\.config\.json$/i.test(String(state.currentWorkObjectFile || "")) &&
    Boolean(state.currentWorkObject?.surfaceModel?.runtimeCapable)
  );
}

function isDocumentWorkspace() {
  return (
    !isPresentationWorkspace() &&
    isDocumentLikePath(state.currentWorkObjectFile) &&
    [
      "document",
      "project"
    ].includes(currentObjectKind()) ||
    (
      !isPresentationWorkspace() &&
      isDocumentLikePath(state.currentWorkObjectFile) &&
      [
        "document_knowledge",
        "project_management",
        "strategy_planning",
        "finance",
        "hr",
        "knowledge_graph"
      ].includes(currentWorkspaceFamilyId())
    )
  );
}

function isDevelopmentWorkspace() {
  if (
    isDatasetWorkspace() ||
    isPresentationWorkspace() ||
    isDashboardWorkspace() ||
    isWorkflowWorkspace() ||
    isDesignWorkspace() ||
    isAppConfigWorkspace()
  ) {
    return false;
  }

  return (
    isCodeLikePath(state.currentWorkObjectFile) &&
    [
      "development",
      "integration_api",
      "testing_qa"
    ].includes(currentWorkspaceFamilyId())
  );
}

function usesWholeFileStructuredEditing() {
  return (
    isDocumentWorkspace() ||
    isDevelopmentWorkspace() ||
    isDatasetWorkspace() ||
    isPresentationWorkspace() ||
    isAppConfigWorkspace() ||
    isDashboardWorkspace() ||
    isWorkflowWorkspace() ||
    isDesignWorkspace()
  );
}

function currentStructuredDraftKey() {
  return `${state.currentWorkObjectId || ""}::${state.currentWorkObjectFile || ""}::structured`;
}

function countWords(value = "") {
  const matches = normalizeEditorText(value).match(/\b[\p{L}\p{N}_'-]+\b/gu);
  return matches ? matches.length : 0;
}

function estimateReadMinutes(words = 0) {
  return Math.max(1, Math.ceil(Number(words || 0) / 180));
}

function listCountFromDocument(value = "") {
  return normalizeEditorText(value)
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .filter((block) => {
      const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
      return lines.length && lines.every((line) => /^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line));
    }).length;
}

function inferCodeLanguageLabel(filePath = "") {
  const normalized = String(filePath || "").toLowerCase();
  if (/(^|\/)package\.json$/.test(normalized)) {
    return "Package manifest";
  }
  if (/\.tsx?$/.test(normalized)) {
    return "TypeScript";
  }
  if (/\.jsx?$/.test(normalized)) {
    return "JavaScript";
  }
  if (/\.css$/.test(normalized)) {
    return "CSS";
  }
  if (/\.html$/.test(normalized)) {
    return "HTML";
  }
  if (/\.ya?ml$/.test(normalized)) {
    return "YAML";
  }
  return "Code";
}

function codeBlockSeedForPath(filePath = "") {
  const normalized = String(filePath || "").toLowerCase();
  if (/\.css$/.test(normalized)) {
    return ".new-block {\n  display: block;\n}";
  }
  if (/\.html$/.test(normalized)) {
    return "<section class=\"new-block\">\n  <h2>New block</h2>\n  <p>Add content here.</p>\n</section>";
  }
  if (/\.ya?ml$/.test(normalized)) {
    return "new_block:\n  description: Add details here";
  }
  return "function newBlock() {\n  return \"Add logic here.\";\n}";
}

function createStructuredInsightGrid(items = []) {
  const visibleItems = items.filter((item) => item && item.value !== undefined && item.value !== null && String(item.value).trim());
  if (!visibleItems.length) {
    return null;
  }

  const grid = document.createElement("div");
  grid.className = "workspace-editor-insight-grid";
  visibleItems.forEach((item) => {
    const card = document.createElement("div");
    card.className = "workspace-editor-insight-card";

    const label = document.createElement("span");
    label.className = "tiny";
    label.textContent = item.label;

    const value = document.createElement("strong");
    value.textContent = String(item.value);

    card.append(label, value);

    if (item.meta) {
      const meta = document.createElement("p");
      meta.className = "workspace-editor-insight-meta";
      meta.textContent = item.meta;
      card.appendChild(meta);
    }

    grid.appendChild(card);
  });
  return grid;
}

function createEditorPanel(title = "", description = "") {
  const panel = document.createElement("section");
  panel.className = "workspace-editor-panel";

  const header = document.createElement("div");
  header.className = "workspace-editor-panel-header";

  const heading = document.createElement("strong");
  heading.textContent = title;
  header.appendChild(heading);

  if (description) {
    const meta = document.createElement("span");
    meta.className = "tiny";
    meta.textContent = description;
    header.appendChild(meta);
  }

  const body = document.createElement("div");
  body.className = "workspace-editor-panel-body";
  panel.append(header, body);
  return { panel, body };
}

function createEditorMiniList(items = [], activeId = "", { emptyLabel = "Nothing here yet.", onSelect = null } = {}) {
  const list = document.createElement("div");
  list.className = "workspace-mini-list";

  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "tiny muted";
    empty.textContent = emptyLabel;
    list.appendChild(empty);
    return list;
  }

  items.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `workspace-mini-list-item${item.id === activeId ? " active" : ""}`;

    const title = document.createElement("strong");
    title.textContent = item.title || "Untitled";
    button.appendChild(title);

    if (item.meta) {
      const meta = document.createElement("span");
      meta.className = "tiny";
      meta.textContent = item.meta;
      button.appendChild(meta);
    }

    if (onSelect) {
      button.addEventListener("click", () => onSelect(item));
    } else {
      button.disabled = true;
    }

    list.appendChild(button);
  });

  return list;
}

function buildMarkdownSectionBlock(section = null, nextTitle = "", nextBody = "") {
  const level = Math.max(1, Math.min(3, Number(section?.level || 2)));
  const heading = `${"#".repeat(level)} ${String(nextTitle || "Untitled section").trim()}`;
  const body = normalizeEditorText(nextBody).trim();
  return body ? `${heading}\n\n${body}` : heading;
}

function csvEscapeCell(value = "") {
  const normalized = String(value || "");
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}

function parseCsvMatrix(content = "") {
  const text = normalizeEditorText(content);
  if (!text.trim()) {
    return [];
  }

  const rows = [];
  let row = [];
  let Cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        Cell += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(Cell);
      Cell = "";
      continue;
    }

    if (char === "\n" && !inQuotes) {
      row.push(Cell);
      rows.push(row);
      row = [];
      Cell = "";
      continue;
    }

    Cell += char;
  }

  row.push(Cell);
  rows.push(row);
  return rows.filter((Cells) => Cells.some((value) => String(value || "").trim().length));
}

function serializeCsvMatrix(rows = []) {
  return (rows || [])
    .map((row) => (row || []).map((Cell) => csvEscapeCell(Cell)).join(","))
    .join("\n");
}

function normalizeSpreadsheetDataValidationRule(rule = {}) {
  if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
    return null;
  }
  const rawType = String(rule.type || rule.kind || "list").trim();
  const type = rawType.toLowerCase() === "textlength" ? "textLength" : rawType.toLowerCase();
  if (!["list", "whole", "decimal", "date", "textLength"].includes(type)) {
    return null;
  }
  const operator = ["between", "notBetween", "equal", "notEqual", "greaterThan", "lessThan", "greaterOrEqual", "lessOrEqual"]
    .includes(String(rule.operator || "between"))
    ? String(rule.operator || "between")
    : "between";
  return {
    type,
    operator,
    allowBlank: rule.allowBlank !== false,
    showDropdown: rule.showDropdown !== false,
    source: String(rule.source || rule.values || ""),
    minimum: String(rule.minimum ?? rule.min ?? ""),
    maximum: String(rule.maximum ?? rule.max ?? ""),
    message: String(rule.message || rule.error || "")
  };
}

function normalizeSpreadsheetDataValidations(validations = {}) {
  if (!validations || typeof validations !== "object" || Array.isArray(validations)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(validations)
      .map(([key, value]) => [String(key), normalizeSpreadsheetDataValidationRule(value)])
      .filter(([, value]) => Boolean(value))
  );
}

const SPREADSHEET_BUILTIN_FORMULA_NAMES = new Set([
  "ABS",
  "AND",
  "AVERAGE",
  "AVERAGEIF",
  "AVERAGEIFS",
  "AVG",
  "CONCAT",
  "COUNT",
  "COUNTA",
  "COUNTBLANK",
  "COUNTIF",
  "COUNTIFS",
  "DATE",
  "FILTER",
  "FALSE",
  "IF",
  "IFERROR",
  "INDEX",
  "LEFT",
  "LEN",
  "LOWER",
  "MATCH",
  "MAX",
  "MID",
  "MIN",
  "MEDIAN",
  "NOT",
  "NOW",
  "OR",
  "PRODUCT",
  "RIGHT",
  "ROUND",
  "ROUNDDOWN",
  "ROUNDUP",
  "SORT",
  "SUBTOTAL",
  "SUM",
  "SUMIF",
  "SUMIFS",
  "TEXT",
  "TODAY",
  "TRIM",
  "TRUE",
  "UNIQUE",
  "UPPER",
  "VALUE",
  "VLOOKUP",
  "XLOOKUP"
]);

function isSpreadsheetDefinedNameValid(name = "") {
  const text = String(name || "").trim();
  if (!/^[A-Za-z_][A-Za-z0-9_.]*$/.test(text)) {
    return false;
  }
  if (/^\$?[A-Z]+\$?\d+$/i.test(text) || /^\$?[A-Z]+\$?\d+:\$?[A-Z]+\$?\d+$/i.test(text)) {
    return false;
  }
  return !SPREADSHEET_BUILTIN_FORMULA_NAMES.has(text.toUpperCase());
}

function normalizeSpreadsheetNamedRange(namedRange = {}, index = 0) {
  if (!namedRange || typeof namedRange !== "object" || Array.isArray(namedRange)) {
    return null;
  }
  const name = String(namedRange.name || namedRange.label || "").trim();
  const range = String(namedRange.range || namedRange.ref || namedRange.address || "")
    .trim()
    .replace(/^=/, "");
  if (!isSpreadsheetDefinedNameValid(name) || !range) {
    return null;
  }
  const sheetId = String(namedRange.sheetId || namedRange.sheet || "").trim();
  return {
    id: String(namedRange.id || `named-range-${index + 1}`),
    name,
    range,
    sheetId,
    scope: String(namedRange.scope || (sheetId ? "sheet" : "workbook")),
    comment: String(namedRange.comment || namedRange.description || "")
  };
}

function normalizeSpreadsheetNamedRanges(namedRanges = []) {
  if (!Array.isArray(namedRanges)) {
    return [];
  }
  const seen = new Set();
  return namedRanges
    .map((namedRange, index) => normalizeSpreadsheetNamedRange(namedRange, index))
    .filter((namedRange) => {
      if (!namedRange) {
        return false;
      }
      const key = `${namedRange.sheetId || "workbook"}:${namedRange.name.toLowerCase()}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

const SPREADSHEET_TABLE_STYLES = ["blue", "green", "orange", "purple", "gray"];
const SPREADSHEET_TABLE_TOTAL_FUNCTIONS = new Set(["sum", "average", "count", "min", "max", "none"]);

function normalizeSpreadsheetColor(value = "") {
  const text = String(value || "").trim();
  const match = text.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) {
    return "";
  }
  const hex = match[1].length === 3
    ? match[1].split("").map((char) => `${char}${char}`).join("")
    : match[1];
  return `#${hex.toLowerCase()}`;
}

function normalizeSpreadsheetConditionalFormatRule(rule = {}, index = 0) {
  if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
    return null;
  }
  const type = String(rule.type || rule.kind || "greaterThan").trim();
  if (!["greaterThan", "lessThan", "between", "equal", "textContains", "duplicate"].includes(type)) {
    return null;
  }
  const range = String(rule.range || rule.ref || "").trim();
  if (!range) {
    return null;
  }
  return {
    id: String(rule.id || `conditional-format-${index + 1}`),
    type,
    range,
    value1: String(rule.value1 ?? rule.value ?? ""),
    value2: String(rule.value2 ?? ""),
    fillColor: normalizeSpreadsheetColor(rule.fillColor || rule.color || "") || "#fff2cc",
    textColor: normalizeSpreadsheetColor(rule.textColor || "") || "#202124",
    bold: Boolean(rule.bold),
    label: String(rule.label || "")
  };
}

function normalizeSpreadsheetConditionalFormats(rules = []) {
  if (!Array.isArray(rules)) {
    return [];
  }
  return rules
    .map((rule, index) => normalizeSpreadsheetConditionalFormatRule(rule, index))
    .filter(Boolean);
}

function normalizeSpreadsheetModel(model = {}) {
  const normalizeSheet = (sheet = {}, index = 0) => {
    const columns = Array.isArray(sheet.columns) && sheet.columns.length
      ? sheet.columns.map((value) => String(value || ""))
      : ["Column 1", "Column 2", "Column 3"];
    const width = columns.length;
    const rows = (Array.isArray(sheet.rows) && sheet.rows.length ? sheet.rows : [["", "", ""]]).map((row) =>
      Array.from({ length: width }, (_, columnIndex) => String(row?.[columnIndex] || ""))
    );
    return {
      id: String(sheet.id || `sheet-${index + 1}`),
      name: String(sheet.name || `Sheet ${index + 1}`),
      columns,
      rows,
      columnWidths:
        sheet.columnWidths && typeof sheet.columnWidths === "object" && !Array.isArray(sheet.columnWidths)
          ? { ...sheet.columnWidths }
          : {},
      rowHeights:
        sheet.rowHeights && typeof sheet.rowHeights === "object" && !Array.isArray(sheet.rowHeights)
          ? { ...sheet.rowHeights }
          : {},
      merges: Array.isArray(sheet.merges)
        ? sheet.merges
            .filter(
              (merge) =>
                merge &&
                Number.isInteger(merge.startRowIndex) &&
                Number.isInteger(merge.startColumnIndex) &&
                Number.isInteger(merge.rowSpan) &&
                Number.isInteger(merge.columnSpan) &&
                merge.rowSpan > 0 &&
                merge.columnSpan > 0
            )
            .map((merge) => ({
              startRowIndex: Number(merge.startRowIndex),
              startColumnIndex: Number(merge.startColumnIndex),
              rowSpan: Number(merge.rowSpan),
              columnSpan: Number(merge.columnSpan)
            }))
        : [],
      cellFormats:
        sheet.cellFormats && typeof sheet.cellFormats === "object" && !Array.isArray(sheet.cellFormats)
          ? { ...sheet.cellFormats }
          : {},
      cellNotes:
        sheet.cellNotes && typeof sheet.cellNotes === "object" && !Array.isArray(sheet.cellNotes)
          ? { ...sheet.cellNotes }
          : {},
      dataValidations: normalizeSpreadsheetDataValidations(sheet.dataValidations || sheet.validations),
      conditionalFormats: normalizeSpreadsheetConditionalFormats(sheet.conditionalFormats || sheet.conditionalFormatting),
      tables: Array.isArray(sheet.tables)
        ? sheet.tables
            .filter((table) => table && typeof table === "object")
            .map((table, tableIndex) => {
              const startRowIndex = Math.max(0, Number(table.startRowIndex ?? table.minRow ?? 0));
              const endRowIndex = Math.max(startRowIndex, Number(table.endRowIndex ?? table.maxRow ?? startRowIndex));
              const startColumnIndex = Math.max(0, Number(table.startColumnIndex ?? table.minColumn ?? 0));
              const endColumnIndex = Math.max(startColumnIndex, Number(table.endColumnIndex ?? table.maxColumn ?? startColumnIndex));
              return {
                id: String(table.id || `sheet-table-${tableIndex + 1}`),
                name: String(table.name || table.title || `Table${tableIndex + 1}`),
                startRowIndex,
                endRowIndex,
                startColumnIndex,
                endColumnIndex,
                style: SPREADSHEET_TABLE_STYLES.includes(String(table.style || "").toLowerCase())
                  ? String(table.style || "").toLowerCase()
                  : "blue",
                showHeaderRow: table.showHeaderRow !== false,
                showBandedRows: table.showBandedRows !== false,
                showBandedColumns: Boolean(table.showBandedColumns),
                showFirstColumn: Boolean(table.showFirstColumn),
                showLastColumn: Boolean(table.showLastColumn),
                showFilterButtons: table.showFilterButtons !== false,
                showTotalRow: Boolean(table.showTotalRow),
                totalFunctions:
                  table.totalFunctions && typeof table.totalFunctions === "object" && !Array.isArray(table.totalFunctions)
                    ? Object.fromEntries(
                        Object.entries(table.totalFunctions).map(([key, value]) => [
                          String(key),
                          SPREADSHEET_TABLE_TOTAL_FUNCTIONS.has(String(value || "").toLowerCase())
                            ? String(value || "").toLowerCase()
                            : "sum"
                        ])
                      )
                    : {}
              };
            })
        : [],
      pivotTables: Array.isArray(sheet.pivotTables)
        ? sheet.pivotTables
            .filter((pivotTable) => pivotTable && typeof pivotTable === "object")
            .map((pivotTable, pivotIndex) => ({
              id: String(pivotTable.id || `sheet-pivot-${pivotIndex + 1}`),
              name: String(pivotTable.name || pivotTable.title || `PivotTable${pivotIndex + 1}`),
              sourceSheetId: String(pivotTable.sourceSheetId || pivotTable.sheetId || ""),
              sourceTableId: String(pivotTable.sourceTableId || pivotTable.tableId || ""),
              sourceRange: String(pivotTable.sourceRange || pivotTable.range || ""),
              renderedRange: String(pivotTable.renderedRange || ""),
              rowField: String(pivotTable.rowField || ""),
              columnField: String(pivotTable.columnField || ""),
              valueField: String(pivotTable.valueField || ""),
              aggregate: String(pivotTable.aggregate || pivotTable.summary || "sum"),
              anchorRowIndex: Math.max(0, Number(pivotTable.anchorRowIndex ?? pivotTable.rowIndex ?? 0)),
              anchorColumnIndex: Math.max(0, Number(pivotTable.anchorColumnIndex ?? pivotTable.columnIndex ?? 0)),
              lastRefreshedAt: String(pivotTable.lastRefreshedAt || "")
            }))
        : [],
      charts: Array.isArray(sheet.charts)
        ? sheet.charts
            .filter((chart) => chart && typeof chart === "object")
            .map((chart, chartIndex) => ({
              id: String(chart.id || `sheet-chart-${chartIndex + 1}`),
              title: String(chart.title || `Chart ${chartIndex + 1}`),
              kind: String(chart.kind || "column"),
              range: String(chart.range || ""),
              seriesName: String(chart.seriesName || chart.series || ""),
              secondarySeriesName: String(chart.secondarySeriesName || chart.secondarySeries || ""),
              x: Math.max(16, Number(chart.x ?? chart.left ?? 212) || 212),
              y: Math.max(16, Number(chart.y ?? chart.top ?? 52) || 52),
              width: Math.max(280, Number(chart.width || 432) || 432),
              height: Math.max(180, Number(chart.height || 284) || 284),
              showLegend: chart.showLegend !== false,
              points: Array.isArray(chart.points)
                ? chart.points.map((point, pointIndex) => ({
                    label: String(point?.label || point?.name || `Point ${pointIndex + 1}`),
                    value: String(point?.value ?? point?.y ?? ""),
                    xValue: String(point?.xValue ?? point?.x ?? ""),
                    yValue: String(point?.yValue ?? point?.y ?? point?.value ?? ""),
                    sizeValue: String(point?.sizeValue ?? point?.size ?? point?.z ?? ""),
                    secondaryValue: String(point?.secondaryValue ?? point?.secondary ?? "")
                  }))
                : []
            }))
        : [],
      sparklines:
        sheet.sparklines && typeof sheet.sparklines === "object" && !Array.isArray(sheet.sparklines)
          ? { ...sheet.sparklines }
          : {},
      slicers: Array.isArray(sheet.slicers)
        ? sheet.slicers
            .filter((slicer) => slicer && typeof slicer === "object")
            .map((slicer, slicerIndex) => ({
              id: String(slicer.id || `sheet-slicer-${slicerIndex + 1}`),
              title: String(slicer.title || slicer.label || `Slicer ${slicerIndex + 1}`),
              columnIndex: Math.max(0, Number(slicer.columnIndex || 0)),
              selectedValue: String(slicer.selectedValue || "")
            }))
        : [],
      filterQuery: String(sheet.filterQuery || ""),
      filterColumnIndex: Number.isInteger(sheet.filterColumnIndex) ? Number(sheet.filterColumnIndex) : -1,
      tableFilters:
        sheet.tableFilters && typeof sheet.tableFilters === "object" && !Array.isArray(sheet.tableFilters)
          ? Object.fromEntries(
              Object.entries(sheet.tableFilters)
                .filter(([, filter]) => filter && typeof filter === "object" && !Array.isArray(filter))
                .map(([key, filter]) => [
                  String(key),
                  {
                    query: String(filter.query || ""),
                    active: Boolean(filter.active),
                    selectedValues: Array.isArray(filter.selectedValues)
                      ? Array.from(new Set(filter.selectedValues.map((value) => String(value ?? ""))))
                      : []
                  }
                ])
            )
          : {},
      sort:
        sheet.sort && Number.isInteger(sheet.sort.columnIndex)
          ? {
              columnIndex: Number(sheet.sort.columnIndex),
              direction: sheet.sort.direction === "desc" ? "desc" : "asc"
            }
          : null,
      hidden: Boolean(sheet.hidden),
      protected: Boolean(sheet.protected),
      protectedRanges: Array.isArray(sheet.protectedRanges)
        ? sheet.protectedRanges
            .filter((range) => range && typeof range === "object")
            .map((range, rangeIndex) => ({
              id: String(range.id || `protected-range-${rangeIndex + 1}`),
              startRowIndex: Math.max(0, Number(range.startRowIndex ?? range.minRow ?? 0)),
              endRowIndex: Math.max(0, Number(range.endRowIndex ?? range.maxRow ?? range.startRowIndex ?? range.minRow ?? 0)),
              startColumnIndex: Math.max(0, Number(range.startColumnIndex ?? range.minColumn ?? 0)),
              endColumnIndex: Math.max(0, Number(range.endColumnIndex ?? range.maxColumn ?? range.startColumnIndex ?? range.minColumn ?? 0)),
              label: String(range.label || "")
            }))
        : [],
      zoomLevel: Math.max(0.5, Math.min(2, Number(sheet.zoomLevel || 1) || 1)),
      showGridlines: sheet.showGridlines !== false,
      frozenRows: Math.max(0, Number(sheet.frozenRows || 0)),
      frozenColumns: Math.max(0, Number(sheet.frozenColumns || 0))
    };
  };

  const sheets = Array.isArray(model.sheets) && model.sheets.length
    ? model.sheets.map((sheet, index) => normalizeSheet(sheet, index))
    : [normalizeSheet(model, 0)];
  const activeSheetId = sheets.some((sheet) => sheet.id === model.activeSheetId)
    ? model.activeSheetId
    : sheets[0].id;
  const activeSheet = sheets.find((sheet) => sheet.id === activeSheetId) || sheets[0];
  const validSheetIds = new Set(sheets.map((sheet) => sheet.id));
  const namedRanges = normalizeSpreadsheetNamedRanges(model.namedRanges || model.names).filter(
    (namedRange) => !namedRange.sheetId || validSheetIds.has(namedRange.sheetId)
  );

  return {
    kind: "hydria-sheet",
    version: 1,
    ...model,
    namedRanges,
    sheets,
    activeSheetId,
    activeSheet,
    columns: activeSheet.columns,
    rows: activeSheet.rows
  };
}

function deriveSpreadsheetDraft(content = "") {
  const raw = normalizeEditorText(content).trim();
  if (raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && (parsed.kind === "hydria-sheet" || Array.isArray(parsed.sheets))) {
        return normalizeSpreadsheetModel(parsed);
      }
    } catch {
      // Fallback to CSV parsing below.
    }
  }

  const rows = parseCsvMatrix(content);
  if (!rows.length) {
    return normalizeSpreadsheetModel({
      sheets: [
        {
          id: "sheet-1",
          name: "Sheet 1",
          columns: ["Column 1", "Column 2", "Column 3"],
          rows: [["", "", ""]]
        }
      ]
    });
  }

  const [header = [], ...body] = rows;
  const width = Math.max(header.length || 0, ...body.map((row) => row.length), 1);
  return normalizeSpreadsheetModel({
    sheets: [
      {
        id: "sheet-1",
        name: "Sheet 1",
        columns: Array.from({ length: width }, (_, index) => header[index] || `Column ${index + 1}`),
        rows: (body.length ? body : [[""]]).map((row) =>
          Array.from({ length: width }, (_, index) => row[index] || "")
        )
      }
    ]
  });
}

function buildSpreadsheetContent(model = {}) {
  const safeColumns = ((model.columns && model.columns.length) ? model.columns : ["Column 1"]).map((value) => String(value || ""));
  const width = safeColumns.length;
  const safeRows = ((model.rows && model.rows.length) ? model.rows : [[""]]).map((row) =>
    Array.from({ length: width }, (_, index) => String(row[index] || ""))
  );

  if (model && Array.isArray(model.sheets)) {
    const normalized = normalizeSpreadsheetModel(model);
    const payload = {
      kind: "hydria-sheet",
      version: 1,
      activeSheetId: normalized.activeSheetId,
      namedRanges: normalized.namedRanges,
      sheets: normalized.sheets.map((sheet) => ({
        id: sheet.id,
        name: sheet.name,
        columns: sheet.columns,
        rows: sheet.rows,
        columnWidths: sheet.columnWidths,
        rowHeights: sheet.rowHeights,
        merges: sheet.merges,
        cellFormats: sheet.cellFormats,
        cellNotes: sheet.cellNotes,
        dataValidations: sheet.dataValidations,
        conditionalFormats: sheet.conditionalFormats,
        tables: sheet.tables,
        pivotTables: sheet.pivotTables,
        charts: sheet.charts,
        sparklines: sheet.sparklines,
        slicers: sheet.slicers,
        filterQuery: sheet.filterQuery,
        filterColumnIndex: sheet.filterColumnIndex,
        tableFilters: sheet.tableFilters,
        sort: sheet.sort,
        hidden: sheet.hidden,
        protected: sheet.protected,
        protectedRanges: sheet.protectedRanges,
        zoomLevel: sheet.zoomLevel,
        showGridlines: sheet.showGridlines,
        frozenRows: sheet.frozenRows,
        frozenColumns: sheet.frozenColumns
      }))
    };
    return JSON.stringify(payload, null, 2);
  }

  try {
    const currentModel = normalizeSpreadsheetModel(deriveSpreadsheetDraft(currentDraftContent()));
    const currentActiveSheet =
      currentModel.sheets.find((sheet) => sheet.id === currentModel.activeSheetId) || currentModel.sheets[0];
    if (
      currentModel.sheets.length > 1 ||
      Object.keys(currentActiveSheet.columnWidths || {}).length ||
      Object.keys(currentActiveSheet.rowHeights || {}).length ||
      (currentActiveSheet.merges || []).length ||
      Object.keys(currentActiveSheet.cellFormats || {}).length ||
      Object.keys(currentActiveSheet.dataValidations || {}).length ||
      (currentActiveSheet.conditionalFormats || []).length ||
      (currentModel.namedRanges || []).length ||
      (currentActiveSheet.tables || []).length ||
      (currentActiveSheet.pivotTables || []).length ||
      Object.keys(currentActiveSheet.tableFilters || {}).length ||
      currentActiveSheet.filterQuery ||
      currentActiveSheet.frozenRows ||
      currentActiveSheet.frozenColumns
    ) {
      currentActiveSheet.columns = safeColumns;
      currentActiveSheet.rows = safeRows;
      return buildSpreadsheetContent(currentModel);
    }
  } catch {
    // Fall back to CSV serialization below.
  }

  return serializeCsvMatrix([safeColumns, ...safeRows]);
}

function isPresentationSection(section = null) {
  return Boolean(section && section.id !== "whole-file" && Number(section.level || 0) >= 2);
}

function derivePresentationDeck(content = "", fallbackTitle = "Untitled presentation") {
  const text = normalizeEditorText(content);
  const lines = text.split("\n");
  const titleLine = lines.find((line) => /^#\s+/.test(line.trim()));
  const deckTitle = titleLine ?titleLine.trim().replace(/^#\s+/, "") : fallbackTitle;
  const sections = [];
  let current = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (/^##\s+/.test(line.trim())) {
      if (current) {
        sections.push(current);
      }
      const rawTitle = line.trim().replace(/^##\s+/, "");
      current = {
        title: rawTitle.replace(/^slide\s+\d+\s*-\s*/i, "").trim() || rawTitle,
        bodyLines: []
      };
      continue;
    }

    if (current) {
      current.bodyLines.push(rawLine);
    }
  }

  if (current) {
    sections.push(current);
  }

  const slides = sections.length
    ?sections.map((slide, index) => ({
        id: `slide-${index + 1}`,
        title: slide.title || `Slide ${index + 1}`,
        body: slide.bodyLines.join("\n").trim()
      }))
    : [
        {
          id: "slide-1",
          title: "Slide 1",
          body: "Add the main message here."
        }
      ];

  return {
    title: deckTitle,
    slides
  };
}

function deriveAppConfigDraft(content = "", fallbackTitle = "Hydria App") {
  try {
    const parsed = JSON.parse(normalizeEditorText(content) || "{}");
    const pages = Array.isArray(parsed.pages) ?parsed.pages : [];
    return {
      title: String(parsed.title || fallbackTitle),
      eyebrow: String(parsed.eyebrow || "App"),
      subtitle: String(parsed.subtitle || ""),
      accentTitle: String(parsed.accentTitle || "Use this app directly inside Hydria."),
      pages: pages.map((page, index) => ({
        id: String(page?.id || `page-${index + 1}`),
        label: String(page?.label || page?.title || `Page ${index + 1}`),
        title: String(page?.title || `Page ${index + 1}`),
        intro: String(page?.intro || ""),
        cards: Array.isArray(page?.cards)
          ?page.cards.map((card) => ({
              title: String(card?.title || ""),
              meta: String(card?.meta || ""),
              text: String(card?.text || "")
            }))
          : [],
        table: page?.table && Array.isArray(page.table.headers)
          ?{
              headers: page.table.headers.map((Cell) => String(Cell || "")),
              rows: Array.isArray(page.table.rows)
                ?page.table.rows.map((row) => (Array.isArray(row) ?row.map((Cell) => String(Cell || "")) : []))
                : []
            }
          : null,
        checklist: Array.isArray(page?.checklist) ?page.checklist.map((item) => String(item || "")) : []
      }))
    };
  } catch {
    return {
      title: fallbackTitle,
      eyebrow: "App",
      subtitle: "",
      accentTitle: "Use this app directly inside Hydria.",
      pages: [
        {
          id: "overview",
          label: "Overview",
          title: "Overview",
          intro: "Add the first page here.",
          cards: [
            { title: "Value", meta: "Primary", text: "Describe the main user value." }
          ],
          table: null,
          checklist: []
        }
      ]
    };
  }
}

function buildAppConfigContent(config = {}) {
  return JSON.stringify(
    {
      title: String(config.title || "Hydria App"),
      eyebrow: String(config.eyebrow || "App"),
      subtitle: String(config.subtitle || ""),
      accentTitle: String(config.accentTitle || "Use this app directly inside Hydria."),
      pages: (config.pages || []).map((page, index) => ({
        id: String(page.id || `page-${index + 1}`),
        label: String(page.label || page.title || `Page ${index + 1}`),
        title: String(page.title || `Page ${index + 1}`),
        intro: String(page.intro || ""),
        ...(page.cards?.length
          ?{
              cards: page.cards.map((card) => ({
                title: String(card.title || ""),
                meta: String(card.meta || ""),
                text: String(card.text || "")
              }))
            }
          : {}),
        ...(page.table?.headers?.length
          ?{
              table: {
                headers: page.table.headers.map((Cell) => String(Cell || "")),
                rows: (page.table.rows || []).map((row) =>
                  Array.isArray(row) ?row.map((Cell) => String(Cell || "")) : []
                )
              }
            }
          : {}),
        ...(page.checklist?.length
          ?{
              checklist: page.checklist.map((item) => String(item || ""))
            }
          : {})
      }))
    },
    null,
    2
  );
}

function deriveDashboardDraft(content = "", fallbackTitle = "Hydria Dashboard") {
  try {
    const parsed = JSON.parse(normalizeEditorText(content) || "{}");
    return {
      title: String(parsed.title || fallbackTitle),
      summary: String(parsed.summary || ""),
      filters: Array.isArray(parsed.filters) ? parsed.filters.map((item) => String(item || "")) : [],
      widgets: Array.isArray(parsed.widgets)
        ? parsed.widgets.map((widget, index) => ({
            id: String(widget?.id || `widget-${index + 1}`),
            title: String(widget?.title || `Widget ${index + 1}`),
            type: String(widget?.type || "summary"),
            size: String(widget?.size || "medium"),
            summary: String(widget?.summary || "")
          }))
        : [
            {
              id: "widget-1",
              title: "Summary card",
              type: "summary",
              size: "medium",
              summary: "Highlight the main takeaway."
            },
            {
              id: "widget-2",
              title: "Alert panel",
              type: "alert",
              size: "small",
              summary: "Show the one thing that needs attention."
            }
          ],
      metrics: Array.isArray(parsed.metrics)
        ? parsed.metrics.map((metric) => ({
            label: String(metric?.label || ""),
            value: String(metric?.value || ""),
            delta: String(metric?.delta || "")
          }))
        : [{ label: "Main KPI", value: "", delta: "" }],
      charts: Array.isArray(parsed.charts)
        ? parsed.charts.map((chart) => ({
            title: String(chart?.title || ""),
            kind: String(chart?.kind || "line"),
            points: Array.isArray(chart?.points)
              ? chart.points.map((point) => ({
                  label: String(point?.label || ""),
                  value: String(point?.value || "")
                }))
              : []
          }))
        : [{ title: "Trend", kind: "line", points: [{ label: "P1", value: "" }, { label: "P2", value: "" }] }],
      table: parsed.table && Array.isArray(parsed.table.columns)
        ? {
            columns: parsed.table.columns.map((item) => String(item || "")),
            rows: Array.isArray(parsed.table.rows)
              ? parsed.table.rows.map((row) => (Array.isArray(row) ? row.map((item) => String(item || "")) : []))
              : []
          }
        : { columns: ["Segment", "Value", "Note"], rows: [["Main", "", ""]] }
    };
  } catch {
    return {
      title: fallbackTitle,
      summary: "",
      filters: [],
      widgets: [
        {
          id: "widget-1",
          title: "Summary card",
          type: "summary",
          size: "medium",
          summary: "Highlight the main takeaway."
        },
        {
          id: "widget-2",
          title: "Alert panel",
          type: "alert",
          size: "small",
          summary: "Show the one thing that needs attention."
        }
      ],
      metrics: [{ label: "Main KPI", value: "", delta: "" }],
      charts: [{ title: "Trend", kind: "line", points: [{ label: "P1", value: "" }, { label: "P2", value: "" }] }],
      table: { columns: ["Segment", "Value", "Note"], rows: [["Main", "", ""]] }
    };
  }
}

function buildDashboardContent(model = {}) {
  return JSON.stringify(
    {
      title: String(model.title || "Hydria Dashboard"),
      summary: String(model.summary || ""),
      filters: (model.filters || []).map((item) => String(item || "")).filter(Boolean),
      widgets: (model.widgets || []).map((widget, index) => ({
        id: String(widget.id || `widget-${index + 1}`),
        title: String(widget.title || `Widget ${index + 1}`),
        type: String(widget.type || "summary"),
        size: String(widget.size || "medium"),
        summary: String(widget.summary || "")
      })),
      metrics: (model.metrics || []).map((metric) => ({
        label: String(metric.label || ""),
        value: String(metric.value || ""),
        delta: String(metric.delta || "")
      })),
      charts: (model.charts || []).map((chart) => ({
        title: String(chart.title || ""),
        kind: String(chart.kind || "line"),
        points: (chart.points || []).map((point) => ({
          label: String(point.label || ""),
          value: String(point.value || "")
        }))
      })),
      table: {
        columns: (model.table?.columns || []).map((item) => String(item || "")),
        rows: (model.table?.rows || []).map((row) => (Array.isArray(row) ? row.map((item) => String(item || "")) : []))
      }
    },
    null,
    2
  );
}

function buildSequentialWorkflowLinks(stages = [], existingLinks = []) {
  const linkMap = new Map(
    (existingLinks || []).map((link) => [`${link.from}::${link.to}`, String(link.label || "Next")])
  );

  return (stages || []).slice(0, -1).map((stage, index) => {
    const from = String(stage.id || `step-${index + 1}`);
    const to = String(stages[index + 1]?.id || "");
    return {
      id: `link-${index + 1}`,
      from,
      to,
      label: linkMap.get(`${from}::${to}`) || "Next"
    };
  });
}

function defaultWorkflowStagePosition(index = 0) {
  const column = index % 3;
  const row = Math.floor(index / 3);
  return {
    x: 48 + column * 240,
    y: 42 + row * 164
  };
}

function deriveWorkflowDraft(content = "", fallbackTitle = "Hydria Workflow") {
  try {
    const parsed = JSON.parse(normalizeEditorText(content) || "{}");
    const stages = Array.isArray(parsed.stages)
      ? parsed.stages.map((stage, index) => ({
          id: String(stage?.id || `step-${index + 1}`),
          label: String(stage?.label || `Step ${index + 1}`),
          owner: String(stage?.owner || ""),
          note: String(stage?.note || ""),
          x: Number.isFinite(Number(stage?.x)) ? Number(stage.x) : defaultWorkflowStagePosition(index).x,
          y: Number.isFinite(Number(stage?.y)) ? Number(stage.y) : defaultWorkflowStagePosition(index).y
        }))
      : [{ id: "step-1", label: "Step 1", owner: "Hydria", note: "", ...defaultWorkflowStagePosition(0) }];

    return {
      title: String(parsed.title || fallbackTitle),
      objective: String(parsed.objective || ""),
      trigger: String(parsed.trigger || ""),
      stages,
      links: Array.isArray(parsed.links) && parsed.links.length
        ? parsed.links.map((link, index) => ({
            id: String(link?.id || `link-${index + 1}`),
            from: String(link?.from || ""),
            to: String(link?.to || ""),
            label: String(link?.label || "")
          }))
        : buildSequentialWorkflowLinks(stages),
      automations: Array.isArray(parsed.automations) ? parsed.automations.map((item) => String(item || "")) : [],
      outputs: Array.isArray(parsed.outputs) ? parsed.outputs.map((item) => String(item || "")) : []
    };
  } catch {
    return {
      title: fallbackTitle,
      objective: "",
      trigger: "",
      stages: [{ id: "step-1", label: "Step 1", owner: "Hydria", note: "", ...defaultWorkflowStagePosition(0) }],
      links: [],
      automations: [],
      outputs: []
    };
  }
}

function buildWorkflowContent(model = {}) {
  return JSON.stringify(
    {
      title: String(model.title || "Hydria Workflow"),
      objective: String(model.objective || ""),
      trigger: String(model.trigger || ""),
      stages: (model.stages || []).map((stage, index) => ({
        id: String(stage.id || `step-${index + 1}`),
        label: String(stage.label || `Step ${index + 1}`),
        owner: String(stage.owner || ""),
        note: String(stage.note || ""),
        x: Number.isFinite(Number(stage.x)) ? Number(stage.x) : defaultWorkflowStagePosition(index).x,
        y: Number.isFinite(Number(stage.y)) ? Number(stage.y) : defaultWorkflowStagePosition(index).y
      })),
      links: (model.links || []).map((link, index) => ({
        id: String(link.id || `link-${index + 1}`),
        from: String(link.from || ""),
        to: String(link.to || ""),
        label: String(link.label || "")
      })),
      automations: (model.automations || []).map((item) => String(item || "")).filter(Boolean),
      outputs: (model.outputs || []).map((item) => String(item || "")).filter(Boolean)
    },
    null,
    2
  );
}

function defaultDesignBlockLayout(index = 0) {
  const presets = [
    { x: 18, y: 18, w: 160, h: 36 },
    { x: 18, y: 66, w: 228, h: 82 },
    { x: 18, y: 160, w: 108, h: 24 },
    { x: 140, y: 160, w: 106, h: 24 },
    { x: 18, y: 198, w: 128, h: 30 }
  ];
  const base = presets[index] || { x: 18, y: 18 + index * 42, w: 188, h: 28 };
  return { ...base };
}

function normalizeDesignBlocks(blocks = []) {
  return (Array.isArray(blocks) ? blocks : []).map((block, index) => {
    const layout = defaultDesignBlockLayout(index);
    if (block && typeof block === "object" && !Array.isArray(block)) {
      return {
        id: String(block.id || `block-${index + 1}`),
        label: String(block.label || block.name || `Block ${index + 1}`),
        x: Number.isFinite(Number(block.x)) ? Number(block.x) : layout.x,
        y: Number.isFinite(Number(block.y)) ? Number(block.y) : layout.y,
        w: Number.isFinite(Number(block.w)) ? Number(block.w) : layout.w,
        h: Number.isFinite(Number(block.h)) ? Number(block.h) : layout.h
      };
    }

    return {
      id: `block-${index + 1}`,
      label: String(block || `Block ${index + 1}`),
      ...layout
    };
  });
}

function deriveDesignDraft(content = "", fallbackTitle = "Hydria Design") {
  try {
    const parsed = JSON.parse(normalizeEditorText(content) || "{}");
    return {
      title: String(parsed.title || fallbackTitle),
      brief: String(parsed.brief || ""),
      palette: Array.isArray(parsed.palette)
        ? parsed.palette.map((token) => ({
            name: String(token?.name || ""),
            value: String(token?.value || "")
          }))
        : [{ name: "Primary", value: "#2B7281" }],
      frames: Array.isArray(parsed.frames)
        ? parsed.frames.map((frame, index) => ({
            id: String(frame?.id || `frame-${index + 1}`),
            name: String(frame?.name || `Frame ${index + 1}`),
            goal: String(frame?.goal || ""),
            blocks: Array.isArray(frame?.blocks)
              ? normalizeDesignBlocks(frame.blocks)
              : normalizeDesignBlocks(["Header", "Hero", "Content", "CTA"])
          }))
        : [{ id: "frame-1", name: "Main frame", goal: "", blocks: normalizeDesignBlocks(["Header", "Hero", "Content", "CTA"]) }],
      components: Array.isArray(parsed.components) ? parsed.components.map((item) => String(item || "")) : []
    };
  } catch {
    return {
      title: fallbackTitle,
      brief: "",
      palette: [{ name: "Primary", value: "#2B7281" }],
      frames: [{ id: "frame-1", name: "Main frame", goal: "", blocks: normalizeDesignBlocks(["Header", "Hero", "Content", "CTA"]) }],
      components: []
    };
  }
}

function buildDesignContent(model = {}) {
  return JSON.stringify(
    {
      title: String(model.title || "Hydria Design"),
      brief: String(model.brief || ""),
      palette: (model.palette || []).map((token) => ({
        name: String(token.name || ""),
        value: String(token.value || "")
      })),
      frames: (model.frames || []).map((frame, index) => ({
        id: String(frame.id || `frame-${index + 1}`),
        name: String(frame.name || `Frame ${index + 1}`),
        goal: String(frame.goal || ""),
        blocks: normalizeDesignBlocks(frame.blocks || []).map((block, blockIndex) => ({
          id: String(block.id || `block-${blockIndex + 1}`),
          label: String(block.label || `Block ${blockIndex + 1}`),
          x: Number.isFinite(Number(block.x)) ? Number(block.x) : defaultDesignBlockLayout(blockIndex).x,
          y: Number.isFinite(Number(block.y)) ? Number(block.y) : defaultDesignBlockLayout(blockIndex).y,
          w: Number.isFinite(Number(block.w)) ? Number(block.w) : defaultDesignBlockLayout(blockIndex).w,
          h: Number.isFinite(Number(block.h)) ? Number(block.h) : defaultDesignBlockLayout(blockIndex).h
        }))
      })),
      components: (model.components || []).map((item) => String(item || "")).filter(Boolean)
    },
    null,
    2
  );
}

function moveItemInArray(items = [], fromIndex = 0, toIndex = 0) {
  const list = Array.isArray(items) ? [...items] : [];
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= list.length ||
    toIndex >= list.length ||
    fromIndex === toIndex
  ) {
    return list;
  }

  const [moved] = list.splice(fromIndex, 1);
  list.splice(toIndex, 0, moved);
  return list;
}

function focusStructuredEditor(itemId = "", subItemId = "") {
  state.currentStructuredItemId = itemId || "";
  state.currentStructuredSubItemId = subItemId || "";
  if (state.workspaceMode !== "edit") {
    setWorkspaceMode("edit");
  }
  renderWorkspace();
}

function toggleDashboardPreviewFilter(filter = "") {
  const normalized = String(filter || "").trim();
  state.currentPreviewFilter = state.currentPreviewFilter === normalized ? "" : normalized;
  refreshPreviewPane();
}

function focusDashboardChart(chartKey = "") {
  focusStructuredEditor(chartKey, state.currentStructuredSubItemId || "");
}

function focusDashboardWidget(widgetId = "") {
  focusStructuredEditor(state.currentStructuredItemId || "chart-1", widgetId);
}

function moveDashboardWidget(widgetId = "", direction = 0) {
  const model = deriveDashboardDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Dashboard");
  const currentIndex = model.widgets.findIndex((widget) => widget.id === widgetId);
  const nextIndex = currentIndex + Number(direction || 0);
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= model.widgets.length) {
    return;
  }

  model.widgets = moveItemInArray(model.widgets, currentIndex, nextIndex);
  state.currentStructuredSubItemId = model.widgets[nextIndex]?.id || "";
  syncEditorDraft(buildDashboardContent(model), { refreshWorkspace: true });
}

function moveDashboardWidgetTo(widgetId = "", targetWidgetId = "") {
  const model = deriveDashboardDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Dashboard");
  const currentIndex = model.widgets.findIndex((widget) => widget.id === widgetId);
  const targetIndex = model.widgets.findIndex((widget) => widget.id === targetWidgetId);
  if (currentIndex < 0 || targetIndex < 0 || currentIndex === targetIndex) {
    return;
  }

  model.widgets = moveItemInArray(model.widgets, currentIndex, targetIndex);
  state.currentStructuredSubItemId = model.widgets[targetIndex]?.id || "";
  syncEditorDraft(buildDashboardContent(model), { refreshWorkspace: true });
}

function resizeDashboardWidget(widgetId = "", direction = 0) {
  const model = deriveDashboardDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Dashboard");
  const currentIndex = model.widgets.findIndex((widget) => widget.id === widgetId);
  if (currentIndex < 0) {
    return;
  }

  const widget = model.widgets[currentIndex];
  const currentSize = String(widget.size || "medium");
  const variants = ["small", "medium", "large"];
  const currentVariantIndex = Math.max(0, variants.indexOf(currentSize));
  const nextIndex = Math.min(Math.max(0, currentVariantIndex + Number(direction || 0)), variants.length - 1);
  model.widgets[currentIndex] = {
    ...widget,
    size: variants[nextIndex]
  };
  state.currentStructuredSubItemId = widget.id;
  syncEditorDraft(buildDashboardContent(model), { refreshWorkspace: true });
}

function focusWorkflowStage(stageId = "") {
  focusStructuredEditor(stageId, "");
}

function focusPresentationSlide(sectionId = "") {
  state.currentSectionId = String(sectionId || "");
  state.currentBlockId = "";
  renderWorkspace();
}

function moveWorkflowStage(stageId = "", direction = 0) {
  const model = deriveWorkflowDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Workflow");
  const currentIndex = model.stages.findIndex((stage) => stage.id === stageId);
  const nextIndex = currentIndex + Number(direction || 0);
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= model.stages.length) {
    return;
  }

  model.stages = moveItemInArray(model.stages, currentIndex, nextIndex);
  model.links = buildSequentialWorkflowLinks(model.stages, model.links);
  state.currentStructuredItemId = model.stages[nextIndex]?.id || "";
  state.currentStructuredSubItemId = "";
  syncEditorDraft(buildWorkflowContent(model), { refreshWorkspace: true });
}

function focusWorkflowLink(linkId = "") {
  focusStructuredEditor(state.currentStructuredItemId || "", linkId);
}

function updateWorkflowStagePosition(stageId = "", x = 0, y = 0) {
  const model = deriveWorkflowDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Workflow");
  const nextX = Math.max(16, Math.round(Number(x) || 0));
  const nextY = Math.max(16, Math.round(Number(y) || 0));
  model.stages = model.stages.map((stage) =>
    stage.id === stageId ? { ...stage, x: nextX, y: nextY } : stage
  );
  state.currentStructuredItemId = stageId;
  syncEditorDraft(buildWorkflowContent(model), { refreshWorkspace: true });
}

function createWorkflowLink(fromStageId = "", toStageId = "") {
  if (!fromStageId || !toStageId || fromStageId === toStageId) {
    return;
  }

  const model = deriveWorkflowDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Workflow");
  const existingIndex = model.links.findIndex((link) => link.from === fromStageId && link.to === toStageId);
  if (existingIndex >= 0) {
    state.currentStructuredSubItemId = model.links[existingIndex].id;
    syncEditorDraft(buildWorkflowContent(model), { refreshWorkspace: true });
    return;
  }

  model.links.push({
    id: `link-${model.links.length + 1}`,
    from: fromStageId,
    to: toStageId,
    label: "Custom link"
  });
  state.currentStructuredSubItemId = model.links[model.links.length - 1]?.id || "";
  syncEditorDraft(buildWorkflowContent(model), { refreshWorkspace: true });
}

function removeWorkflowLink(linkId = "") {
  const model = deriveWorkflowDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Workflow");
  const nextLinks = model.links.filter((link) => link.id !== linkId);
  if (nextLinks.length === model.links.length) {
    return;
  }

  model.links = nextLinks;
  state.currentStructuredSubItemId = nextLinks[0]?.id || "";
  syncEditorDraft(buildWorkflowContent(model), { refreshWorkspace: true });
}

function focusDesignFrame(frameId = "") {
  focusStructuredEditor(frameId, "");
}

function focusDesignBlock(frameId = "", blockRef = "") {
  const blockId = typeof blockRef === "number" ? `block-${Number(blockRef || 0) + 1}` : String(blockRef || "");
  focusStructuredEditor(frameId, blockId);
}

function moveDesignBlock(frameId = "", blockRef = "", direction = 0) {
  const model = deriveDesignDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Design");
  const frameIndex = model.frames.findIndex((frame) => frame.id === frameId);
  if (frameIndex < 0) {
    return;
  }

  const blocks = Array.isArray(model.frames[frameIndex].blocks) ? [...model.frames[frameIndex].blocks] : [];
  const currentIndex =
    typeof blockRef === "number"
      ? Number(blockRef || 0)
      : blocks.findIndex((block) => block.id === String(blockRef || ""));
  const nextBlockIndex = currentIndex + Number(direction || 0);
  if (nextBlockIndex < 0 || nextBlockIndex >= blocks.length) {
    return;
  }

  model.frames[frameIndex] = {
    ...model.frames[frameIndex],
    blocks: moveItemInArray(blocks, currentIndex, nextBlockIndex)
  };
  state.currentStructuredItemId = frameId;
  state.currentStructuredSubItemId = model.frames[frameIndex].blocks[nextBlockIndex]?.id || "";
  syncEditorDraft(buildDesignContent(model), { refreshWorkspace: true });
}

function updateDesignBlockPosition(frameId = "", blockId = "", x = 0, y = 0) {
  const model = deriveDesignDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Design");
  const frameIndex = model.frames.findIndex((frame) => frame.id === frameId);
  if (frameIndex < 0) {
    return;
  }

  const nextX = Math.max(8, Math.round(Number(x) || 0));
  const nextY = Math.max(8, Math.round(Number(y) || 0));
  model.frames = model.frames.map((frame, index) => {
    if (index !== frameIndex) {
      return frame;
    }
    return {
      ...frame,
      blocks: (frame.blocks || []).map((block) =>
        block.id === blockId ? { ...block, x: nextX, y: nextY } : block
      )
    };
  });
  state.currentStructuredItemId = frameId;
  state.currentStructuredSubItemId = blockId;
  syncEditorDraft(buildDesignContent(model), { refreshWorkspace: true });
}

function resizeDesignBlock(frameId = "", blockId = "", widthDelta = 0, heightDelta = 0) {
  const model = deriveDesignDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Design");
  const frameIndex = model.frames.findIndex((frame) => frame.id === frameId);
  if (frameIndex < 0) {
    return;
  }

  model.frames = model.frames.map((frame, index) => {
    if (index !== frameIndex) {
      return frame;
    }
    return {
      ...frame,
      blocks: (frame.blocks || []).map((block) =>
        block.id === blockId
          ? {
              ...block,
              w: Math.max(80, (Number(block.w) || 160) + Number(widthDelta || 0)),
              h: Math.max(24, (Number(block.h) || 36) + Number(heightDelta || 0))
            }
          : block
      )
    };
  });

  state.currentStructuredItemId = frameId;
  state.currentStructuredSubItemId = blockId;
  syncEditorDraft(buildDesignContent(model), { refreshWorkspace: true });
}

function buildPresentationContent({ title = "Untitled presentation", slides = [] } = {}) {
  const safeSlides = slides.length
    ?slides
    : [
        {
          title: "Slide 1",
          body: "Add the first key message here."
        }
      ];

  return [
    `# ${String(title || "Untitled presentation").trim()}`,
    "",
    ...safeSlides.flatMap((slide, index) => [
      `## Slide ${index + 1} - ${String(slide.title || "Untitled slide").trim()}`,
      String(slide.body || "").trim() || "Add the main point here.",
      ""
    ])
  ]
    .join("\n")
    .trim();
}

function contentForStructureNavigation() {
  if (usesWholeFileStructuredEditing() && state.editorDirty && state.editorDraftKey === currentEditorKey()) {
    return state.editorDraft;
  }
  return currentContent();
}

function currentRuntimeSourcePaths() {
  return state.currentRuntimeSession?.context?.sourceOfTruthPaths || [];
}

function isRuntimeTrackedFile(filePath = state.currentWorkObjectFile) {
  const normalizedFilePath = String(filePath || "");
  return currentRuntimeSourcePaths().some((path) => String(path || "") === normalizedFilePath);
}

function setWorkspaceMode(mode = "view") {
  state.workspaceMode = ["view", "edit"].includes(mode) ?mode : "view";
}

function setCopilotOpen(flag) {
  state.copilotOpen = Boolean(flag);
  el["assistant-dock"]?.classList.toggle("hidden", !state.copilotOpen);
  el["copilot-panel"]?.classList.toggle("hidden", !state.copilotOpen);
  if (el["copilot-toggle-button"]) {
    el["copilot-toggle-button"].textContent = "Hydria";
  }
}

function friendlySurfaceLabel(surfaceId = "", surfaceModel = null) {
  const runtimeCapable = Boolean(surfaceModel?.runtimeCapable);
  switch (surfaceId) {
    case "live":
      return "Live preview";
    case "dashboard":
      return "Dashboard";
    case "workflow":
      return "Workflow";
    case "design":
      return "Design";
    case "app":
      return runtimeCapable ?"Static preview" : "Preview";
    case "preview":
      return "Preview";
    case "overview":
      return "Overview";
    case "structure":
      return "Outline";
    case "data":
      return "Data";
    case "code":
      return "Code";
    case "media":
      return "Media";
    case "edit":
      return "Edit";
    default:
      return surfaceId || "Preview";
  }
}

function currentPreviewSummary() {
  const surfaceModel = currentSurfaceModel();
  const activeSurface = state.currentSurfaceId || surfaceModel?.defaultSurface || "preview";
  const base = friendlySurfaceLabel(activeSurface, surfaceModel);

  if (state.autoSaving) {
    return activeSurface === "live" ?"Live preview - saving" : `${base} - saving`;
  }

  if (activeSurface === "live") {
    if (!state.currentRuntimeSession && surfaceModel?.runtimeCapable) {
      return "Live preview - starting";
    }
    if (state.editorDirty && isEditingRuntimeSource()) {
      return "Live preview - modified";
    }
    if (state.currentRuntimeSession?.status === "modified") {
      return "Live preview - modified";
    }
    return "Live preview - saved";
  }

  if (state.editorDirty) {
    return `${base} - unsaved changes`;
  }

  return base;
}

function renderWorkspaceModeNav() {
  const container = el["workspace-mode-nav"];
  if (!container) {
    return;
  }

  container.innerHTML = "";
  const modes = [
    { id: "view", label: "Preview" },
    { id: "edit", label: "Modify" }
  ];

  for (const mode of modes) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `workspace-mode-button${state.workspaceMode === mode.id ?" active" : ""}`;
    button.textContent = mode.label;
    button.addEventListener("click", async () => {
      if (
        mode.id === "edit" &&
        state.currentWorkObjectId &&
        state.currentWorkObject?.surfaceModel?.runtimeCapable &&
        !isAppConfigWorkspace()
      ) {
        const editableFiles = getEditableFiles(state.currentWorkObject);
        const builderPath = editableFiles.find((filePath) => /(^|\/)app\.config\.json$/i.test(filePath));
        if (builderPath) {
          await selectWorkObject(state.currentWorkObjectId, builderPath, {
            syncProject: false,
            preserveDimension: true,
            preserveSurface: true,
            preserveRuntimeSession: true,
            preserveMode: true
          });
        }
      }

      setWorkspaceMode(mode.id);
      renderWorkspace();
      if (mode.id === "edit") {
        focusWorkspaceEditor();
      }
    });
    container.appendChild(button);
  }
}

function isEditingRuntimeSource() {
  return state.currentSurfaceId === "live" && isRuntimeTrackedFile();
}

function clearRuntimeSyncTimer() {
  if (state.runtimeSyncHandle) {
    window.clearTimeout(state.runtimeSyncHandle);
    state.runtimeSyncHandle = null;
  }
}

function clearAutoSaveTimer() {
  if (state.autoSaveHandle) {
    window.clearTimeout(state.autoSaveHandle);
    state.autoSaveHandle = null;
  }
}

function clearRuntimeSessionState(clearSession = true) {
  clearRuntimeSyncTimer();
  state.runtimeSyncRequestId = 0;
  state.currentRuntimePatch = null;
  if (clearSession) {
    state.currentRuntimeSession = null;
  }
}

function currentEditorInputValue() {
  if (state.editorDirty && state.editorDraftKey === currentEditorKey()) {
    return state.editorDraft;
  }
  return el["work-object-editor"]?.value || "";
}

function isInlineDocumentPreviewEditingActive() {
  if (
    currentWorkspaceFamilyId() !== "document_knowledge" ||
    state.currentSurfaceId === "edit"
  ) {
    return false;
  }

  const preview = el["workspace-preview"];
  if (!preview) {
    return false;
  }

  const activeElement = document.activeElement;
  if (activeElement && preview.contains(activeElement)) {
    return true;
  }

  const selectionAnchor = document.getSelection()?.anchorNode;
  const selectionElement =
    selectionAnchor?.nodeType === Node.TEXT_NODE
      ? selectionAnchor.parentElement
      : selectionAnchor;

  return Boolean(selectionElement && preview.contains(selectionElement));
}

function isInlineDatasetPreviewEditingActive() {
  if (!isDatasetWorkspace() || state.currentSurfaceId === "edit") {
    return false;
  }

  const preview = el["workspace-preview"];
  if (!preview) {
    return false;
  }

  const activeElement = document.activeElement;
  return Boolean(activeElement && preview.contains(activeElement));
}

function isInlinePreviewEditingActive() {
  return isInlineDocumentPreviewEditingActive() || isInlineDatasetPreviewEditingActive();
}

function resolvePromptTargetPath() {
  if (!state.currentWorkObject) {
    return "";
  }

  const editableFiles = getEditableFiles(state.currentWorkObject);
  const builderPath = editableFiles.find((filePath) => /(^|\/)app\.config\.json$/i.test(filePath));

  if (
    state.currentWorkObject.objectKind === "project" &&
    state.currentWorkObject.surfaceModel?.runtimeCapable &&
    builderPath
  ) {
    return builderPath;
  }

  return state.currentWorkObjectFile || preferredOpenPath(state.currentWorkObject) || builderPath || "";
}

async function flushPendingWorkObjectChanges() {
  if (!state.currentWorkObjectId || !state.currentWorkObjectFile || !state.editorDirty) {
    clearAutoSaveTimer();
    return;
  }

  clearAutoSaveTimer();
  await saveWorkObjectChanges({
    silent: true,
    source: "autosave"
  });
}

function scheduleAutoSave() {
  clearAutoSaveTimer();

  if (
    !state.editorDirty ||
    !state.currentWorkObjectId ||
    !state.currentWorkObjectFile ||
    state.loading
  ) {
    return;
  }

  state.autoSaveHandle = window.setTimeout(() => {
    saveWorkObjectChanges({
      silent: true,
      source: "autosave"
    }).catch(handleError);
  }, 900);
}

function syncEditorDraft(nextValue = "", options = {}) {
  const {
    forceEditMode = true,
    refreshWorkspace = false,
    suppressPreviewRefresh = false
  } = options;

  const normalized = String(nextValue || "");
  state.editorDirty = normalized !== currentEditorBaseline();
  state.editorDraft = normalized;
  state.editorDraftKey = currentEditorKey();
  if (el["work-object-editor"]) {
    el["work-object-editor"].value = normalized;
  }

  if (forceEditMode && state.workspaceMode !== "edit") {
    setWorkspaceMode("edit");
  }

  if (state.liveDraftRefreshHandle) {
    window.clearTimeout(state.liveDraftRefreshHandle);
  }

  state.liveRuntimeDraft = "";
  state.liveDraftRefreshHandle = window.setTimeout(() => {
    if (suppressPreviewRefresh) {
      // Rich document inline editing already mutated the live DOM.
    } else if (isEditingRuntimeSource()) {
      scheduleRuntimeDraftSync();
    } else {
      refreshPreviewPane();
    }
    state.liveDraftRefreshHandle = null;
    if (el["workspace-view-status"]) {
      el["workspace-view-status"].textContent = currentPreviewSummary();
    }
    if (el["workspace-save-button"]) {
      el["workspace-save-button"].disabled = !state.editorDirty;
      el["workspace-save-button"].textContent = state.editorDirty ?"Save" : "Saved";
    }
  }, 120);

  scheduleAutoSave();

  if (refreshWorkspace) {
    renderWorkspace();
  } else if (el["workspace-view-status"]) {
    el["workspace-view-status"].textContent = currentPreviewSummary();
  }
}

async function ensureRuntimeSessionForWorkObject(workObject = null) {
  if (!workObject?.surfaceModel?.runtimeCapable || !state.currentUserId) {
    state.currentRuntimeSession = null;
    return null;
  }

  const payload = await apiClient.ensureRuntimeSession(workObject.id, {
    userId: state.currentUserId,
    conversationId: state.currentConversationId,
    entryPath: workObject.surfaceModel?.runtimeEntryPath || state.currentWorkObjectFile || ""
  });
  state.currentRuntimeSession = payload.runtimeSession || null;
  return state.currentRuntimeSession;
}

async function refreshRuntimeSession() {
  if (!state.currentRuntimeSession?.id || !state.currentWorkObjectId) {
    return null;
  }

  const payload = await apiClient.getRuntimeSession(state.currentWorkObjectId, {
    sessionId: state.currentRuntimeSession.id
  });
  state.currentRuntimeSession = payload.runtimeSession || state.currentRuntimeSession;
  return state.currentRuntimeSession;
}

function scheduleRuntimeDraftSync() {
  if (!state.currentWorkObjectId || !state.currentRuntimeSession?.id || !isRuntimeTrackedFile()) {
    return;
  }

  clearRuntimeSyncTimer();
  const requestId = state.runtimeSyncRequestId + 1;
  state.runtimeSyncRequestId = requestId;
  state.runtimeSyncHandle = window.setTimeout(async () => {
    try {
      const payload = await apiClient.updateRuntimeSession(state.currentWorkObjectId, {
        sessionId: state.currentRuntimeSession.id,
        entryPath: state.currentWorkObjectFile,
        content: currentDraftContent()
      });

      if (state.runtimeSyncRequestId !== requestId) {
        return;
      }

      state.currentRuntimeSession = payload.runtimeSession || state.currentRuntimeSession;
      state.currentRuntimePatch = {
        sessionId: state.currentRuntimeSession?.id || "",
        runtimeVersion: payload.runtimeSession?.runtimeVersion || 0,
        entryPath: state.currentWorkObjectFile || "",
        content: currentDraftContent()
      };
      refreshPreviewPane();
      if (el["workspace-view-status"]) {
        el["workspace-view-status"].textContent = currentPreviewSummary();
      }
    } catch (error) {
      console.error(error);
      setStatus(error.message || "Unable to sync the live preview.");
    } finally {
      if (state.runtimeSyncRequestId === requestId) {
        state.runtimeSyncHandle = null;
      }
    }
  }, 180);
}

function forceRuntimeFrameRefresh() {
  const frame = document.querySelector("#workspace-preview .workspace-app-frame");
  if (!frame || !state.currentRuntimeSession?.preview?.renderUrl) {
    return;
  }

  const runtimeLiveUrl = `${state.currentRuntimeSession.preview.renderUrl}${
    state.currentRuntimeSession.preview.renderUrl.includes("?") ?"&" : "?"
  }rev=${encodeURIComponent(String(state.currentRuntimeSession.runtimeVersion || 1))}`;
  frame.dataset.runtimeVersion = String(state.currentRuntimeSession.runtimeVersion || "");
  frame.dataset.runtimeSessionId = String(state.currentRuntimeSession.id || "");
  frame.dataset.runtimeBase = state.currentRuntimeSession.preview.renderUrl;
  frame.dataset.runtimeSrc = runtimeLiveUrl;
  frame.src = runtimeLiveUrl;
}

function syncWorkspaceSlices() {
  const structuralContent = contentForStructureNavigation();
  state.currentSections = deriveWorkspaceSections(structuralContent, state.currentWorkObjectFile);
  if (!state.currentSections.some((section) => section.id === state.currentSectionId)) {
    state.currentSectionId = "";
  }

  if (isPresentationWorkspace()) {
    const slideSections = state.currentSections.filter((section) => isPresentationSection(section));
    if (slideSections.length && !slideSections.some((section) => section.id === state.currentSectionId)) {
      state.currentSectionId = slideSections[0].id;
    }
  } else if (isDatasetWorkspace()) {
    state.currentSectionId = "";
    state.currentBlockId = "";
  }

  state.currentBlocks = deriveWorkspaceBlocks(
    structuralContent,
    state.currentWorkObjectFile,
    state.currentSectionId,
    state.currentSections
  );
  if (!state.currentBlocks.some((block) => block.id === state.currentBlockId)) {
    state.currentBlockId = "";
  }
}

function ensureFileMatchesDimension() {
  const available = getFilteredEditableFiles(state.currentWorkObject, state.currentDimension);
  if (!available.length) {
    state.currentWorkObjectFile = "";
    return;
  }

  if (!available.includes(state.currentWorkObjectFile)) {
    state.currentWorkObjectFile = available[0];
  }
}

function ensureCurrentSurface() {
  const surfaces = currentSurfaces();
  if (!surfaces.length) {
    state.currentSurfaceId = "";
    return;
  }

  if (!surfaces.some((surface) => surface.id === state.currentSurfaceId)) {
    state.currentSurfaceId = currentSurfaceModel()?.defaultSurface || surfaces[0].id;
  }
}

function setPillsFromResult(result = null) {
  const strategyText =
    result?.strategy ||
    state.config?.config?.strategy?.mode ||
    state.config?.config?.strategy ||
    "free-first";
  const providerText = result?.modelsUsed?.length
    ?result.modelsUsed.join(", ")
    : state.config?.config?.agentic?.enabled
      ?"local-first"
      : "pending";

  el["strategy-pill"].textContent = strategyText;
  el["provider-pill"].textContent = providerText.startsWith("LLM:")
    ?providerText
    : `LLM: ${providerText}`;
}

function renderPendingAttachments() {
  el["attachment-list"].innerHTML = "";

  for (const [index, file] of state.pendingAttachments.entries()) {
    const chip = document.createElement("div");
    chip.className = "attachment-chip";
    chip.innerHTML = `<span>${file.name}</span><span class="attachment-meta">${formatBytes(file.size)}</span>`;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.textContent = "x";
    removeButton.addEventListener("click", () => {
      state.pendingAttachments = state.pendingAttachments.filter((_, itemIndex) => itemIndex !== index);
      renderPendingAttachments();
    });

    chip.appendChild(removeButton);
    el["attachment-list"].appendChild(chip);
  }
}

function renderSelect(select, items, currentValue, labelFn, valueFn) {
  select.innerHTML = "";

  for (const item of items) {
    const option = document.createElement("option");
    option.value = String(valueFn(item));
    option.textContent = labelFn(item);
    option.selected = String(currentValue) === option.value;
    select.appendChild(option);
  }
}

function renderCardList(container, items, emptyText, onClick, currentId, titleFn, metaFn) {
  container.innerHTML = "";

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "detail-item";
    empty.textContent = emptyText;
    container.appendChild(empty);
    return;
  }

  for (const item of items) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = `conversation-card${String(currentId) === String(item.id) ?" active" : ""}`;
    card.addEventListener("click", () => onClick(item));

    const title = document.createElement("strong");
    title.textContent = titleFn(item);
    const meta = document.createElement("p");
    meta.className = "tiny";
    meta.textContent = metaFn(item);

    card.append(title, meta);
    container.appendChild(card);
  }
}

function renderUsers() {
  el["user-count"].textContent = String(state.users.length);

  if (!state.users.length) {
    el["user-select"].innerHTML = '<option value="">Create a user to begin</option>';
    return;
  }

  renderSelect(
    el["user-select"],
    state.users,
    state.currentUserId,
    (user) => user.username,
    (user) => user.id
  );
}

function renderConversations() {
  const conversations = filteredConversations();
  if (el["conversation-header-title"]) {
    el["conversation-header-title"].textContent = state.currentProjectId
      ? "Project chats"
      : "Chats";
  }
  renderCardList(
    el["conversation-list"],
    conversations,
    state.currentProjectId
      ? "No chats for this project yet."
      : "Start a new chat or pick a project.",
    (conversation) =>
      selectConversation(conversation.id, {
        preserveProject: Boolean(state.currentProjectId)
      }).catch(handleError),
    state.currentConversationId,
    (conversation) => conversation.title,
    (conversation) => `${conversation.message_count} messages`
  );
}

function renderProjects() {
  if (el["project-count"]) {
    el["project-count"].textContent = String(state.projects.length);
  }
  renderProjectCards(
    el["project-list"],
    state.projects,
    state.currentProjectId,
    (project) => selectProject(project.id).catch(handleError)
  );
}

function renderWorkObjects() {
  if (!el["workspace-object-list"]) {
    return;
  }

  renderWorkspaceObjectList(
    el["workspace-object-list"],
    state.workObjects,
    state.currentWorkObjectId,
    (workObject) => selectWorkObject(workObject.id, preferredOpenPath(workObject)).catch(handleError)
  );
}

function renderMessages() {
  el["chat-thread"].innerHTML = "";

  if (!state.messages.length) {
    el["chat-thread"].classList.add("hidden");
    return;
  }

  el["chat-thread"].classList.toggle("hidden", !state.copilotOpen);

  for (const message of state.messages) {
    el["chat-thread"].appendChild(
      renderChatMessage(message, {
        onOpenWorkObject: (workObject) =>
          selectWorkObject(workObject.id, preferredOpenPath(workObject)).catch(handleError),
        onContinueWithObject: (workObject) =>
          continueWithWorkObject(workObject.id, preferredOpenPath(workObject)).catch(handleError)
      })
    );
  }

  el["chat-thread"].scrollTop = el["chat-thread"].scrollHeight;
}

function renderWorkspaceSwitcher(hasVisibleWorkspace = false) {
  const container = el["workspace-switcher"];
  if (!container) {
    return;
  }
  container.innerHTML = "";
  container.classList.remove("hidden");

  const items = workspaceSwitcherItems();
  const currentFamily = currentWorkspaceFamilyId();
  const projectObjects = workspaceWorkObjects();

  items.forEach((item) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `workspace-switcher-chip${currentFamily === item.family ? " active" : ""}`;
    chip.textContent = item.label;
    chip.addEventListener("click", () => {
      const existing =
        projectObjects.find((obj) => obj.workspaceFamilyId === item.family) ||
        projectObjects.find((obj) => obj.workspaceFamilyLabel === item.label) ||
        null;
      if (existing) {
        selectWorkObject(existing.id, preferredOpenPath(existing)).catch(handleError);
        return;
      }
      createBlankWorkspace(item.kind, item.family, item.label).catch(handleError);
    });
    container.appendChild(chip);
  });
}

function renderPreferences() {
  el["pref-language"].value = state.preferences.language || "";
  el["pref-tone"].value = state.preferences.tone || "";
  el["pref-format"].value = state.preferences.format || "";
}

function renderMetaStack(container, items = []) {
  container.innerHTML = "";

  for (const item of items.filter(Boolean)) {
    const row = document.createElement("div");
    row.className = "detail-item";

    if (item.href) {
      const link = document.createElement("a");
      link.className = "detail-link";
      link.href = item.href;
      link.textContent = item.label;
      row.appendChild(link);
    } else {
      row.textContent = item.label;
    }

    container.appendChild(row);
  }
}

function renderTokenList(container, items = []) {
  container.innerHTML = "";

  for (const item of items.filter(Boolean)) {
    const token = document.createElement("span");
    token.className = "token";
    token.textContent = item;
    container.appendChild(token);
  }
}

function workspaceWorkObjects() {
  if (state.currentWorkspace?.workObjects?.length) {
    return state.currentWorkspace.workObjects;
  }

  if (state.currentProjectId) {
    return state.workObjects.filter((workObject) => workObject.projectId === state.currentProjectId);
  }

  return state.workObjects;
}

function updateEditorValue() {
  if (state.editorDirty && state.editorDraftKey === currentEditorKey()) {
    el["work-object-editor"].value = state.editorDraft;
    return;
  }

  if (usesWholeFileStructuredEditing()) {
    el["work-object-editor"].value = currentContent();
    state.editorDirty = false;
    state.editorDraft = "";
    state.editorDraftKey = "";
    return;
  }

  if (currentBlock()) {
    el["work-object-editor"].value = currentBlock().block;
    state.editorDirty = false;
    state.editorDraft = "";
    state.editorDraftKey = "";
    return;
  }

  if (currentSection()) {
    el["work-object-editor"].value = currentSection().block;
    state.editorDirty = false;
    state.editorDraft = "";
    state.editorDraftKey = "";
    return;
  }

  el["work-object-editor"].value = currentContent();
  state.editorDirty = false;
  state.editorDraft = "";
  state.editorDraftKey = "";
}

function refreshPreviewPane() {
  const previewContent = currentDraftContent();
  const previewSections = usesWholeFileStructuredEditing()
    ?deriveWorkspaceSections(previewContent, state.currentWorkObjectFile)
    : state.currentSections;
  const previewBlocks = usesWholeFileStructuredEditing()
    ?deriveWorkspaceBlocks(
        previewContent,
        state.currentWorkObjectFile,
        state.currentSectionId,
        previewSections
      )
    : state.currentBlocks;

  renderWorkspacePreview(el["workspace-preview"], {
    workObject: state.currentWorkObject,
    project: state.currentWorkspace?.project || null,
    projectWorkObjects: workspaceWorkObjects(),
    filePath: state.currentWorkObjectFile || state.currentWorkObject?.primaryFile || "",
    content: previewContent,
    surfaceModel: currentSurfaceModel(),
    currentSurfaceId: state.currentSurfaceId,
    runtimeSession: state.currentRuntimeSession,
    runtimePatch: state.currentRuntimePatch,
    editorDirty: state.editorDirty,
    selectedSectionId: state.currentSectionId,
    sections: previewSections,
    blocks: previewBlocks,
    currentBlockId: state.currentBlockId,
    selectedStructuredItemId: state.currentStructuredItemId,
    selectedStructuredSubItemId: state.currentStructuredSubItemId,
    activePreviewFilter: state.currentPreviewFilter,
    onDocumentSectionFocus: (sectionId) => {
      state.currentSectionId = sectionId;
      state.currentBlockId = "";
      renderWorkspace();
    },
    onDocumentInlineEdit: updateDocumentPreviewInline,
    onProjectObjectSelect: (workObject) =>
      selectWorkObject(workObject.id, preferredOpenPath(workObject)).catch(handleError),
    onPresentationSlideFocus: focusPresentationSlide,
    onPresentationSlideEdit: updatePresentationPreviewInline,
    onDataHeaderEdit: updateSpreadsheetHeaderFromPreview,
    onDataCellEdit: updateSpreadsheetCellFromPreview,
    onDataGridEdit: updateSpreadsheetDraftFromPreview,
    onDashboardFilterToggle: toggleDashboardPreviewFilter,
    onDashboardWidgetMove: moveDashboardWidget,
    onDashboardWidgetDrop: moveDashboardWidgetTo,
    onDashboardWidgetResize: resizeDashboardWidget,
    onDashboardWidgetFocus: focusDashboardWidget,
    onDashboardChartFocus: focusDashboardChart,
    onWorkflowStageFocus: focusWorkflowStage,
    onWorkflowStageMove: moveWorkflowStage,
    onWorkflowStagePositionChange: updateWorkflowStagePosition,
    onWorkflowLinkCreate: createWorkflowLink,
    onWorkflowLinkFocus: focusWorkflowLink,
    onWorkflowLinkRemove: removeWorkflowLink,
    onDesignFrameFocus: focusDesignFrame,
    onDesignBlockFocus: focusDesignBlock,
    onDesignBlockMove: moveDesignBlock,
    onDesignBlockPositionChange: updateDesignBlockPosition,
    onDesignBlockResize: resizeDesignBlock
  });
}

function applyWorkspaceLabels() {
  const fileLabel = el["workspace-file-label"];
  const outlineLabel = el["workspace-outline-label"];
  const blockLabel = el["workspace-block-label"];
  const editorLabel = el["workspace-editor-label"];

  if (!fileLabel || !outlineLabel || !blockLabel || !editorLabel) {
    return;
  }

  const labels = currentWorkspaceStructureLabels();
  fileLabel.textContent = labels.fileLabel;
  outlineLabel.textContent = labels.outlineLabel;
  blockLabel.textContent = labels.blockLabel;
  editorLabel.textContent = labels.editorLabel;
}

function renderDocumentStructuredEditor(container) {
  const profile = currentDocumentWorkspaceProfile();
  const filePath = state.currentWorkObjectFile || "";
  const content = currentDraftContent();
  const sections = deriveWorkspaceSections(content, filePath).filter((section) => section.id !== "whole-file");
  const activeSection =
    sections.find((section) => section.id === state.currentSectionId) ||
    sections[0] ||
    null;

  if (activeSection && activeSection.id !== state.currentSectionId) {
    state.currentSectionId = activeSection.id;
  }

  const blocks = deriveWorkspaceBlocks(
    content,
    filePath,
    activeSection?.id || "",
    activeSection ? [activeSection] : deriveWorkspaceSections(content, filePath)
  );
  const activeBlock = blocks.find((block) => block.id === state.currentBlockId) || blocks[0] || null;
  const shell = document.createElement("div");
  shell.className = "workspace-document-editor workspace-document-workbench";

  const toolbar = document.createElement("div");
  toolbar.className = "workspace-structured-toolbar";

  const wordCount = countWords(content);
  const stats = document.createElement("div");
  stats.className = "workspace-structured-stats";
  stats.textContent = `${sections.length || 1} sections | ${blocks.length || 1} focus areas | ${wordCount} words`;

  const actions = document.createElement("div");
  actions.className = "workspace-structured-actions";

  const addSectionButton = document.createElement("button");
  addSectionButton.type = "button";
  addSectionButton.className = "ghost-button";
  addSectionButton.textContent = "Add section";
  addSectionButton.addEventListener("click", () => {
    const nextTitle = `New section ${sections.length + 1}`;
    const nextBlock = `## ${nextTitle}\n\nAdd the next section here.`;
    const separator = content.trim() ? "\n\n" : "";
    syncEditorDraft(`${content.trimEnd()}${separator}${nextBlock}`, { refreshWorkspace: true });
  });

  const focusWholeButton = document.createElement("button");
  focusWholeButton.type = "button";
  focusWholeButton.className = "ghost-button";
  focusWholeButton.textContent = "Whole document";
  focusWholeButton.addEventListener("click", () => {
    state.currentSectionId = "";
    state.currentBlockId = "";
    renderWorkspace();
  });

  actions.append(addSectionButton, focusWholeButton);
  toolbar.append(stats, actions);
  shell.appendChild(toolbar);

  const insightGrid = createStructuredInsightGrid([
    { label: "Sections", value: sections.length || 1, meta: activeSection ? `Active: ${activeSection.title}` : "Single flowing document" },
    { label: "Focus areas", value: blocks.length || 1, meta: activeBlock?.title || "Whole document" },
    { label: "Read time", value: `${estimateReadMinutes(wordCount)} min`, meta: "Estimated from the current draft" },
    { label: "File", value: friendlyFileLabel(filePath) || "Document source", meta: "Markdown or plain text source" }
  ]);
  if (insightGrid) {
    shell.appendChild(insightGrid);
  }

  const workbenchHero = document.createElement("div");
  workbenchHero.className = "workspace-document-hero";
  const heroMeta = document.createElement("div");
  heroMeta.className = "workspace-document-hero-meta";
  const heroKicker = document.createElement("span");
  heroKicker.className = "tiny";
  heroKicker.textContent = profile.workspaceLabel;
  const heroTitle = document.createElement("strong");
  heroTitle.textContent = activeSection?.title || state.currentWorkObject?.title || "Untitled document";
  const heroCopy = document.createElement("p");
  heroCopy.textContent = activeSection
    ? `Focus on ${activeSection.title} while keeping the rest of the document in view.`
    : profile.heroCopy;
  heroMeta.append(heroKicker, heroTitle, heroCopy);

  const heroTokens = document.createElement("div");
  heroTokens.className = "workspace-chip-list";
  [
    sections.length > 2 ? "Outline ready" : "Early draft",
    listCountFromDocument(content) ? "Action lists" : "Narrative draft",
    activeBlock ? "Focused edit" : "Whole page"
  ].forEach((label, index) => {
    const chip = document.createElement("span");
    chip.className = `workspace-chip${index === 0 ? " active" : ""}`;
    chip.textContent = label;
    heroTokens.appendChild(chip);
  });
  workbenchHero.append(heroMeta, heroTokens);
  shell.appendChild(workbenchHero);

  const layout = document.createElement("div");
  layout.className = "workspace-editor-layout workspace-document-layout";
  const sidebar = document.createElement("aside");
  sidebar.className = "workspace-editor-sidebar";
  const main = document.createElement("div");
  main.className = "workspace-editor-main";

  const sectionPanel = createEditorPanel(profile.sectionPanelTitle, profile.sectionPanelHint);
  sectionPanel.body.appendChild(
    createEditorMiniList(
      sections.map((section) => ({
        id: section.id,
        title: section.title || "Section",
        meta: `${blocks.length && section.id === activeSection?.id ? blocks.length : deriveWorkspaceBlocks(content, filePath, section.id, [section]).length || 1} focus areas`
      })),
      activeSection?.id || "",
      {
        emptyLabel: "Start by adding a section.",
        onSelect: (section) => {
          state.currentSectionId = section.id;
          state.currentBlockId = "";
          renderWorkspace();
        }
      }
    )
  );
  sidebar.appendChild(sectionPanel.panel);

  const detailPanel = createEditorPanel(profile.detailPanelTitle, profile.detailPanelHint);
  detailPanel.body.appendChild(
    createEditorMiniList(
      blocks.map((block) => ({
        id: block.id,
        title: block.title || "Detail",
        meta: block.preview || "Focused passage"
      })),
      activeBlock?.id || "",
      {
        emptyLabel: "Pick a section to expose smaller focus areas.",
        onSelect: (block) => {
          state.currentBlockId = block.id;
          renderWorkspace();
        }
      }
    )
  );
  sidebar.appendChild(detailPanel.panel);

  const propertyPanel = createEditorPanel(profile.propertyPanelTitle, profile.propertyPanelHint);
  const propertyGrid = createStructuredInsightGrid([
    { label: "Page title", value: state.currentWorkObject?.title || "Document", meta: "Persistent project object" },
    { label: "Current section", value: activeSection?.title || "Whole document", meta: activeBlock?.title || "No focused detail yet" },
    { label: "Source", value: friendlyFileLabel(filePath) || "content.md", meta: "Editable primary file" }
  ]);
  if (propertyGrid) {
    propertyPanel.body.appendChild(propertyGrid);
  }
  sidebar.appendChild(propertyPanel.panel);

  const linkedPanel = createEditorPanel(profile.linkedPanelTitle, profile.linkedPanelHint);
  linkedPanel.body.appendChild(
    createEditorMiniList(
      sections.slice(0, 6).map((section, index) => ({
        id: section.id,
        title: section.title || `Page ${index + 1}`,
        meta:
          index === 0
            ? "Current narrative anchor"
            : index === 1
              ? "Useful as a follow-up section or derivative asset"
              : "Potential linked page"
      })),
      activeSection?.id || "",
      {
        emptyLabel: "Add a section to start linking this page to the rest of the project.",
        onSelect: (section) => {
          state.currentSectionId = section.id;
          state.currentBlockId = "";
          renderWorkspace();
        }
      }
    )
  );
  sidebar.appendChild(linkedPanel.panel);

  const sectionTitleLabel = document.createElement("label");
  sectionTitleLabel.className = "composer-label";
  sectionTitleLabel.textContent = activeSection ? "Section title" : "Document title";
  const sectionTitleInput = document.createElement("input");
  sectionTitleInput.type = "text";
  sectionTitleInput.className = "workspace-slide-title-input";
  sectionTitleInput.value =
    activeSection?.title ||
    (normalizeEditorText(content).split("\n").find((line) => /^#\s+/.test(line.trim())) || "").replace(/^#\s+/, "");
  sectionTitleInput.placeholder = activeSection ? "Name the current section" : "Add a document title";
  sectionTitleInput.addEventListener("input", (event) => {
    if (!activeSection) {
      const lines = normalizeEditorText(currentDraftContent()).split("\n");
      const titleLineIndex = lines.findIndex((line) => /^#\s+/.test(line.trim()));
      if (titleLineIndex >= 0) {
        lines[titleLineIndex] = `# ${event.target.value}`;
      } else {
        lines.unshift(`# ${event.target.value}`, "");
      }
      syncEditorDraft(lines.join("\n"));
      return;
    }

    const nextBlock = buildMarkdownSectionBlock(
      activeSection,
      event.target.value,
      normalizeEditorText(activeSection.block).split("\n").slice(1).join("\n").trim()
    );
    syncEditorDraft(
      applyWorkspaceSectionEdit(currentDraftContent(), filePath, activeSection.id, nextBlock),
      { refreshWorkspace: true }
    );
  });
  const sectionPanelMain = createEditorPanel(
    activeSection ? "Section editor" : "Document editor",
    activeSection ? "Change the section title and its main body." : "Set the title and shape the whole document."
  );
  sectionPanelMain.body.append(sectionTitleLabel, sectionTitleInput);

  const bodyLabel = document.createElement("label");
  bodyLabel.className = "composer-label";
  bodyLabel.textContent = activeSection ? "Section body" : "Document body";
  const bodyInput = document.createElement("textarea");
  bodyInput.rows = 10;
  bodyInput.className = "workspace-slide-body-input";
  bodyInput.value = activeSection
    ? normalizeEditorText(activeSection.block).split("\n").slice(1).join("\n").trim()
    : currentDraftContent();
  bodyInput.addEventListener("input", (event) => {
    if (!activeSection) {
      syncEditorDraft(event.target.value);
      return;
    }
    const nextBlock = buildMarkdownSectionBlock(activeSection, sectionTitleInput.value, event.target.value);
    syncEditorDraft(
      applyWorkspaceSectionEdit(currentDraftContent(), filePath, activeSection.id, nextBlock),
      { refreshWorkspace: true }
    );
  });
  sectionPanelMain.body.append(bodyLabel, bodyInput);
  main.appendChild(sectionPanelMain.panel);

  const contextPanel = createEditorPanel("Page context", "Keep the whole section and document summary visible while you edit like a doc tool.");
  const contextSummary = document.createElement("div");
  contextSummary.className = "workspace-document-context-grid";
  const summaryCards = [
    {
      label: "Document summary",
      value: normalizeEditorText(content).split("\n").filter(Boolean).slice(0, 3).join(" ")
    },
    {
      label: "Active section summary",
      value: activeSection
        ? normalizeEditorText(activeSection.block).split("\n").slice(1).join(" ").trim() || "This section is still empty."
        : "Editing the whole page right now."
    }
  ];
  summaryCards.forEach((item) => {
    const card = document.createElement("article");
    card.className = "workspace-document-context-card";
    const label = document.createElement("span");
    label.className = "tiny";
    label.textContent = item.label;
    const text = document.createElement("p");
    text.textContent = item.value;
    card.append(label, text);
    contextSummary.appendChild(card);
  });
  contextPanel.body.appendChild(contextSummary);
  main.appendChild(contextPanel.panel);

  const stagePanel = createEditorPanel("Page canvas", "See the active page like a real document surface while editing the structure.");
  const pageStage = document.createElement("article");
  pageStage.className = "workspace-document-page-stage";
  const pageStageHeader = document.createElement("div");
  pageStageHeader.className = "workspace-document-page-stage-header";
  const pageStageMeta = document.createElement("div");
  pageStageMeta.className = "workspace-document-hero-meta";
  const pageStageKicker = document.createElement("span");
  pageStageKicker.className = "tiny";
  pageStageKicker.textContent = "Current page";
  const pageStageTitle = document.createElement("strong");
  pageStageTitle.textContent = activeSection?.title || state.currentWorkObject?.title || "Untitled document";
  const pageStageCopy = document.createElement("p");
  pageStageCopy.textContent = activeSection
    ? activeSection.preview || "Use this section as the current drafting surface."
    : "This page is the current working document for the project.";
  pageStageMeta.append(pageStageKicker, pageStageTitle, pageStageCopy);
  const pageStageMode = document.createElement("div");
  pageStageMode.className = "workspace-chip-list";
  [
    "Page",
    listCountFromDocument(content) ? "Actionable" : "Narrative",
    activeBlock ? "Focused" : "Whole"
  ].forEach((label, index) => {
    const chip = document.createElement("span");
    chip.className = `workspace-chip${index === 0 ? " active" : ""}`;
    chip.textContent = label;
    pageStageMode.appendChild(chip);
  });
  pageStageHeader.append(pageStageMeta, pageStageMode);
  const pageStageRibbon = document.createElement("div");
  pageStageRibbon.className = "workspace-flow-chip-list";
  [
    activeSection ? "Section sync" : "Page sync",
    `${sections.length || 1} pages`,
    activeBlock ? "Focused passage" : "Whole page",
    "Project linked"
  ].forEach((label, index) => {
    const chip = document.createElement("span");
    chip.className = `workspace-flow-chip${index === 0 ? " active" : ""}`;
    chip.textContent = label;
    pageStageRibbon.appendChild(chip);
  });
  const pageStageBody = document.createElement("div");
  pageStageBody.className = "workspace-document-page-stage-body";
  normalizeEditorText(activeSection?.block || content)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 7)
    .forEach((line) => {
      const element = document.createElement(/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line) ? "li" : /^#{1,3}\s+/.test(line) ? "h4" : "p");
      element.textContent = line.replace(/^[-*]\s+|^\d+\.\s+|^#{1,3}\s+/, "");
      pageStageBody.appendChild(element);
    });
  if (!pageStageBody.childNodes.length) {
    const fallback = document.createElement("p");
    fallback.textContent = "Add your first section, insight or procedure to start building the page.";
    pageStageBody.appendChild(fallback);
  }
  const pageStageRail = document.createElement("div");
  pageStageRail.className = "workspace-document-page-rail";
  const pageRailLabel = document.createElement("span");
  pageRailLabel.className = "tiny";
  pageRailLabel.textContent = "Page rail";
  pageStageRail.appendChild(pageRailLabel);
  sections.slice(0, 6).forEach((section, index) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `workspace-mini-list-item${section.id === activeSection?.id || (!activeSection && index === 0) ? " active" : ""}`;
    item.textContent = section.title || `Section ${index + 1}`;
    item.addEventListener("click", () => {
      state.currentSectionId = section.id;
      state.currentBlockId = "";
      renderWorkspace();
    });
    pageStageRail.appendChild(item);
  });
  if (!sections.length) {
    const empty = document.createElement("span");
    empty.className = "tiny muted";
    empty.textContent = "Add sections to build a proper page rail.";
    pageStageRail.appendChild(empty);
  }
  const pageStageLayout = document.createElement("div");
  pageStageLayout.className = "workspace-document-page-layout";
  pageStageLayout.append(pageStageBody, pageStageRail);
  pageStage.append(pageStageHeader, pageStageRibbon, pageStageLayout);
  stagePanel.body.appendChild(pageStage);
  main.appendChild(stagePanel.panel);

  if (activeBlock) {
    const detailLabel = document.createElement("label");
    detailLabel.className = "composer-label";
    detailLabel.textContent = "Focused detail";
    const detailInput = document.createElement("textarea");
    detailInput.rows = 6;
    detailInput.className = "workspace-slide-body-input workspace-detail-input";
    detailInput.value = activeBlock.block || "";
    detailInput.addEventListener("input", (event) => {
      syncEditorDraft(
        applyWorkspaceBlockEdit(
          currentDraftContent(),
          filePath,
          activeSection?.id || "",
          activeBlock.id,
          event.target.value,
          activeSection ? [activeSection] : deriveWorkspaceSections(currentDraftContent(), filePath)
        ),
        { refreshWorkspace: true }
      );
    });
    const focusedPanel = createEditorPanel("Focused edit", "Tighten one specific paragraph, list or block without losing the rest of the section.");
    focusedPanel.body.append(detailLabel, detailInput);
    main.appendChild(focusedPanel.panel);
  }

  layout.append(sidebar, main);
  shell.appendChild(layout);
  container.appendChild(shell);
}

function renderDevelopmentStructuredEditor(container) {
  const filePath = state.currentWorkObjectFile || "";
  const content = currentDraftContent();
  const blocks = deriveWorkspaceBlocks(content, filePath, "", []);
  const activeBlock = blocks.find((block) => block.id === state.currentBlockId) || blocks[0] || null;

  if (activeBlock && activeBlock.id !== state.currentBlockId) {
    state.currentBlockId = activeBlock.id;
  }

  const shell = document.createElement("div");
  shell.className = "workspace-development-editor workspace-development-workbench";

  const toolbar = document.createElement("div");
  toolbar.className = "workspace-structured-toolbar";

  const lines = normalizeEditorText(content).split("\n");
  const nonEmptyLines = lines.filter((line) => line.trim()).length;
  const stats = document.createElement("div");
  stats.className = "workspace-structured-stats";
  stats.textContent = `${lines.length} lines | ${blocks.length || 1} blocks | ${inferCodeLanguageLabel(filePath)}`;

  const actions = document.createElement("div");
  actions.className = "workspace-structured-actions";

  const addBlockButton = document.createElement("button");
  addBlockButton.type = "button";
  addBlockButton.className = "ghost-button";
  addBlockButton.textContent = "Add block";
  addBlockButton.addEventListener("click", () => {
    const separator = content.trim() ? "\n\n" : "";
    syncEditorDraft(`${content.trimEnd()}${separator}${codeBlockSeedForPath(filePath)}`, {
      refreshWorkspace: true
    });
  });

  const wholeFileButton = document.createElement("button");
  wholeFileButton.type = "button";
  wholeFileButton.className = "ghost-button";
  wholeFileButton.textContent = "Whole file";
  wholeFileButton.addEventListener("click", () => {
    state.currentBlockId = "";
    renderWorkspace();
  });

  actions.append(addBlockButton, wholeFileButton);
  toolbar.append(stats, actions);
  shell.appendChild(toolbar);

  const insightGrid = createStructuredInsightGrid([
    { label: "Language", value: inferCodeLanguageLabel(filePath), meta: friendlyFileLabel(filePath) || "Source file" },
    { label: "Lines", value: lines.length, meta: `${nonEmptyLines} non-empty lines` },
    { label: "Blocks", value: blocks.length || 1, meta: activeBlock?.title || "Whole file" },
    { label: "Workspace", value: friendlyWorkspaceFamilyLabel(currentWorkspaceFamilyId() || "development"), meta: "Code, debug and evolve the project here" }
  ]);
  if (insightGrid) {
    shell.appendChild(insightGrid);
  }
  const devHero = document.createElement("div");
  devHero.className = "workspace-dev-hero";
  const devHeroMeta = document.createElement("div");
  devHeroMeta.className = "workspace-document-hero-meta";
  const devHeroKicker = document.createElement("span");
  devHeroKicker.className = "tiny";
  devHeroKicker.textContent = "Development workspace";
  const devHeroTitle = document.createElement("strong");
  devHeroTitle.textContent = friendlyFileLabel(filePath) || "Source file";
  const devHeroCopy = document.createElement("p");
  devHeroCopy.textContent = activeBlock
    ? `Edit ${activeBlock.title || "the active block"} while keeping execution and diagnostics visible like an IDE.`
    : "Work on the file with symbols, diagnostics and runtime posture visible at the same time.";
  devHeroMeta.append(devHeroKicker, devHeroTitle, devHeroCopy);
  const devHeroTabs = document.createElement("div");
  devHeroTabs.className = "workspace-code-tabs";
  ["Explorer", "Editor", "Terminal", "Problems"].forEach((label, index) => {
    const tab = document.createElement("span");
    tab.className = `workspace-code-tab${index === 1 ? " is-active" : ""}`;
    tab.textContent = label;
    devHeroTabs.appendChild(tab);
  });
  devHero.append(devHeroMeta, devHeroTabs);
  shell.appendChild(devHero);
  const layout = document.createElement("div");
  layout.className = "workspace-editor-layout workspace-development-layout";
  const sidebar = document.createElement("aside");
  sidebar.className = "workspace-editor-sidebar";
  const main = document.createElement("div");
  main.className = "workspace-editor-main";

  const navigatorPanel = createEditorPanel("Block navigator", "Jump between focused code blocks without losing the full file.");
  navigatorPanel.body.appendChild(
    createEditorMiniList(
      blocks.map((block) => ({
        id: block.id,
        title: block.title || "Block",
        meta: block.preview || "Focused code block"
      })),
      activeBlock?.id || "",
      {
        emptyLabel: "Add a block to start structuring this file.",
        onSelect: (block) => {
          state.currentBlockId = block.id;
          renderWorkspace();
        }
      }
    )
  );
  sidebar.appendChild(navigatorPanel.panel);

  const diagnosticsPanel = createEditorPanel("Diagnostics", "Read the file like a code workspace, not a plain textarea.");
  const diagnostics = createStructuredInsightGrid([
    {
      label: "Imports",
      value: normalizeEditorText(content).split("\n").filter((line) => /^\s*(import|const .*require\()/.test(line)).length,
      meta: "Dependency entry points"
    },
    {
      label: "Functions",
      value: normalizeEditorText(content).split("\n").filter((line) => /\b(function\s+\w+|\w+\s*=>|async\s+function|\w+\([^)]*\)\s*\{)/.test(line)).length,
      meta: "Executable units in the current file"
    },
    {
      label: "TODOs",
      value: normalizeEditorText(content).split("\n").filter((line) => /todo|fixme/i.test(line)).length,
      meta: "Open engineering follow-up points"
    }
  ]);
  if (diagnostics) {
    diagnosticsPanel.body.appendChild(diagnostics);
  }
  sidebar.appendChild(diagnosticsPanel.panel);

  const problemPanel = createEditorPanel("Problems", "Keep failures, tests and open loops visible like a real IDE problems lane.");
  const problemList = document.createElement("div");
  problemList.className = "workspace-mini-list";
  [
    {
      title: "Imports",
      meta: normalizeEditorText(content).split("\n").filter((line) => /^\s*(import|const .*require\()/.test(line)).length
        ? "Dependencies present in the current file"
        : "No imports detected yet"
    },
    {
      title: "Tests",
      meta: normalizeEditorText(content).split("\n").filter((line) => /\b(describe|it|test|expect)\b/.test(line)).length
        ? "Test signals already visible"
        : "No tests detected"
    },
    {
      title: "Open loops",
      meta: normalizeEditorText(content).split("\n").filter((line) => /todo|fixme|hack/i.test(line)).length
        ? "TODO / FIXME markers need attention"
        : "No obvious follow-up marker"
    }
  ].forEach((item, index) => {
    const row = document.createElement("div");
    row.className = `workspace-mini-list-item${index === 0 ? " active" : ""}`;
    const title = document.createElement("strong");
    title.textContent = item.title;
    const meta = document.createElement("span");
    meta.className = "tiny";
    meta.textContent = item.meta;
    row.append(title, meta);
    problemList.appendChild(row);
  });
  problemPanel.body.appendChild(problemList);
  sidebar.appendChild(problemPanel.panel);

  const executionPanel = createEditorPanel("Execution lane", "Keep likely commands, runtime posture and test pressure visible while editing.");
  const executionInsights = createStructuredInsightGrid([
    {
      label: "Runnable",
      value: /(\.js|\.ts|\.jsx|\.tsx|\.html)$/i.test(filePath || "") ? "Yes" : "Review",
      meta: /\.html$/i.test(filePath || "")
        ? "Best with the live preview surface"
        : /\.(jsx?|tsx?)$/i.test(filePath || "")
          ? "Can evolve inside the current project runtime"
          : "Treat as a support file"
    },
    {
      label: "Test pressure",
      value: normalizeEditorText(content).split("\n").filter((line) => /\b(describe|it|test|expect)\b/.test(line)).length,
      meta: "Testing signals detected in the current file"
    },
    {
      label: "Open loops",
      value: normalizeEditorText(content).split("\n").filter((line) => /todo|fixme|hack/i.test(line)).length,
      meta: "Follow-up points still visible in source"
    }
  ]);
  if (executionInsights) {
    executionPanel.body.appendChild(executionInsights);
  }
  const suggestedCommands = document.createElement("div");
  suggestedCommands.className = "workspace-chip-list";
  const commandHints = /\.html$/i.test(filePath || "")
    ? ["Live preview", "Open runtime", "Inspect layout"]
    : /\.(jsx?|tsx?)$/i.test(filePath || "")
      ? ["Run flow", "Check imports", "Add tests"]
      : /\.json$/i.test(filePath || "")
        ? ["Validate schema", "Check keys", "Compare diff"]
        : ["Review file", "Patch block", "Follow with Hydria"];
  commandHints.forEach((hint, index) => {
    const chip = document.createElement("span");
    chip.className = `workspace-chip${index === 0 ? " active" : ""}`;
    chip.textContent = hint;
    suggestedCommands.appendChild(chip);
  });
  executionPanel.body.appendChild(suggestedCommands);
  sidebar.appendChild(executionPanel.panel);

  const fileTreePanel = createEditorPanel("Workspace tree", "Keep the active file anchored inside a believable development workspace.");
  const treeItems = [
    { id: "root", title: "Project root", meta: "Current working project" },
    ...String(filePath || "")
      .split("/")
      .filter(Boolean)
      .map((segment, index, list) => ({
        id: `path-${index}`,
        title: segment,
        meta: index === list.length - 1 ? "Active file" : "Folder"
      }))
  ];
  fileTreePanel.body.appendChild(
    createEditorMiniList(treeItems, treeItems[treeItems.length - 1]?.id || "", {
      emptyLabel: "Open a file to expose the workspace tree."
    })
  );
  sidebar.appendChild(fileTreePanel.panel);

  const stagePanel = createEditorPanel("Code stage", "Keep the focused symbol, file posture and likely run path visible like a real editor surface.");
  const stageShell = document.createElement("div");
  stageShell.className = "workspace-dev-stage";
  const stageHeader = document.createElement("div");
  stageHeader.className = "workspace-presentation-stage-header";
  const stageHeaderMeta = document.createElement("div");
  stageHeaderMeta.className = "workspace-code-toolbar-meta";
  const stageTitle = document.createElement("strong");
  stageTitle.textContent = activeBlock?.title || friendlyFileLabel(filePath) || "Source file";
  const stageHint = document.createElement("span");
  stageHint.className = "tiny";
  stageHint.textContent = `${inferCodeLanguageLabel(filePath)} | ${blocks.length || 1} blocks`;
  stageHeaderMeta.append(stageTitle, stageHint);
  const stageActions = document.createElement("div");
  stageActions.className = "workspace-chip-list";
  commandHints.forEach((hint, index) => {
    const chip = document.createElement("span");
    chip.className = `workspace-chip${index === 0 ? " active" : ""}`;
    chip.textContent = hint;
    stageActions.appendChild(chip);
  });
  stageHeader.append(stageHeaderMeta, stageActions);
  const stageGrid = document.createElement("div");
  stageGrid.className = "workspace-document-context-grid";
  [
    {
      label: "Focused symbol",
      value: activeBlock?.title || "Whole file"
    },
    {
      label: "Current posture",
      value: /\.html$/i.test(filePath || "")
        ? "Runtime-connected UI file"
        : /\.(jsx?|tsx?)$/i.test(filePath || "")
          ? "Logic and interface source"
          : /\.json$/i.test(filePath || "")
            ? "Config / schema source"
            : "Support source"
    }
  ].forEach((item) => {
    const card = document.createElement("article");
    card.className = "workspace-document-context-card";
    const label = document.createElement("span");
    label.className = "tiny";
    label.textContent = item.label;
    const text = document.createElement("p");
    text.textContent = item.value;
    card.append(label, text);
    stageGrid.appendChild(card);
  });
  const console = document.createElement("div");
  console.className = "workspace-dev-console";
  [
    `$ ${commandHints[0] || "review file"}`,
    activeBlock?.preview || "Focused block ready for iteration.",
    diagnostics.imports ? `${diagnostics.imports} imports detected in the current file.` : "No imports detected yet."
  ].forEach((line, index) => {
    const row = document.createElement("div");
    row.className = "workspace-dev-console-line";
    row.textContent = index === 0 ? line : `> ${line}`;
    console.appendChild(row);
  });
  stageShell.append(stageHeader, stageGrid, console);
  stagePanel.body.appendChild(stageShell);
  main.appendChild(stagePanel.panel);

  const focusLabel = document.createElement("label");
  focusLabel.className = "composer-label";
  focusLabel.textContent = activeBlock ? "Focused block" : "Whole file";
  const focusInput = document.createElement("textarea");
  focusInput.rows = 14;
  focusInput.className = "workspace-slide-body-input workspace-code-block-input";
  focusInput.value = activeBlock?.block || content;
  focusInput.addEventListener("input", (event) => {
    if (!activeBlock) {
      syncEditorDraft(event.target.value);
      return;
    }
    syncEditorDraft(
      applyWorkspaceBlockEdit(currentDraftContent(), filePath, "", activeBlock.id, event.target.value, []),
      { refreshWorkspace: true }
    );
  });
  const editorPanel = createEditorPanel(activeBlock ? "Focused block editor" : "Source editor", "Edit the selected block directly and keep the rest of the file stable.");
  editorPanel.body.append(focusLabel, focusInput);
  main.appendChild(editorPanel.panel);

  const reviewPanel = createEditorPanel("Whole file context", "Keep the surrounding source visible so block edits still feel anchored in a real file.");
  const reviewLabel = document.createElement("label");
  reviewLabel.className = "composer-label";
  reviewLabel.textContent = "Readonly file context";
  const reviewInput = document.createElement("textarea");
  reviewInput.rows = 8;
  reviewInput.readOnly = true;
  reviewInput.className = "workspace-slide-body-input workspace-code-block-input";
  reviewInput.value = content;
  reviewPanel.body.append(reviewLabel, reviewInput);
  main.appendChild(reviewPanel.panel);

  const terminalPanel = createEditorPanel("Run & terminal", "Keep an execution lane visible so the workspace feels closer to a real development tool.");
  const terminalCards = document.createElement("div");
  terminalCards.className = "workspace-document-context-grid";
  [
    {
      label: "Suggested run",
      value: /\.html$/i.test(filePath || "")
        ? "Open live preview"
        : /\.(jsx?|tsx?)$/i.test(filePath || "")
          ? "Run current flow"
          : /\.json$/i.test(filePath || "")
            ? "Validate config"
            : "Review source"
    },
    {
      label: "Next debug move",
      value: activeBlock?.preview || "Focus the next unstable block and iterate with Hydria."
    }
  ].forEach((item) => {
    const card = document.createElement("article");
    card.className = "workspace-document-context-card";
    const label = document.createElement("span");
    label.className = "tiny";
    label.textContent = item.label;
    const text = document.createElement("p");
    text.textContent = item.value;
    card.append(label, text);
    terminalCards.appendChild(card);
  });
  terminalPanel.body.appendChild(terminalCards);
  main.appendChild(terminalPanel.panel);

  layout.append(sidebar, main);
  shell.appendChild(layout);
  container.appendChild(shell);
}

function renderDatasetStructuredEditor(container) {
  const profile = currentDatasetWorkspaceProfile();
  const model = deriveSpreadsheetDraft(currentDraftContent());
  const columnLetter = (index) => {
    let value = index + 1;
    let label = "";
    while (value > 0) {
      const remainder = (value - 1) % 26;
      label = String.fromCharCode(65 + remainder) + label;
      value = Math.floor((value - 1) / 26);
    }
    return label;
  };
  const shell = document.createElement("div");
  shell.className = "workspace-spreadsheet-editor workspace-spreadsheet-workbench";

  const toolbar = document.createElement("div");
  toolbar.className = "workspace-structured-toolbar";

  const stats = document.createElement("div");
  stats.className = "workspace-structured-stats";
  stats.textContent = `${model.rows.length} rows | ${model.columns.length} columns`;

  const actions = document.createElement("div");
  actions.className = "workspace-structured-actions";

  const addRowButton = document.createElement("button");
  addRowButton.type = "button";
  addRowButton.className = "ghost-button";
  addRowButton.textContent = "Add row";
  addRowButton.addEventListener("click", () => {
    const nextModel = deriveSpreadsheetDraft(currentDraftContent());
    const nextRows = [...nextModel.rows, Array.from({ length: nextModel.columns.length }, () => "")];
    syncEditorDraft(buildSpreadsheetContent({ columns: nextModel.columns, rows: nextRows }), {
      refreshWorkspace: true
    });
  });

  const addColumnButton = document.createElement("button");
  addColumnButton.type = "button";
  addColumnButton.className = "ghost-button";
  addColumnButton.textContent = "Add column";
  addColumnButton.addEventListener("click", () => {
    const nextModel = deriveSpreadsheetDraft(currentDraftContent());
    const nextColumns = [...nextModel.columns, `Column ${nextModel.columns.length + 1}`];
    const nextRows = nextModel.rows.map((row) => [...row, ""]);
    syncEditorDraft(buildSpreadsheetContent({ columns: nextColumns, rows: nextRows }), {
      refreshWorkspace: true
    });
  });

  const totalsButton = document.createElement("button");
  totalsButton.type = "button";
  totalsButton.className = "ghost-button";
  totalsButton.textContent = "Add totals";
  totalsButton.addEventListener("click", () => {
    const nextModel = deriveSpreadsheetDraft(currentDraftContent());
    const totalRow = nextModel.columns.map((column, index) => {
      if (index === 0) {
        return "Total";
      }
      const values = nextModel.rows
        .map((row) => Number(String(row[index] || "").replace(",", ".")))
        .filter((value) => Number.isFinite(value));
      if (!values.length) {
        return "";
      }
      const total = values.reduce((sum, value) => sum + value, 0);
      return Number.isInteger(total) ?String(total) : total.toFixed(2);
    });
    syncEditorDraft(buildSpreadsheetContent({ columns: nextModel.columns, rows: [...nextModel.rows, totalRow] }), {
      refreshWorkspace: true
    });
  });

  const removeRowButton = document.createElement("button");
  removeRowButton.type = "button";
  removeRowButton.className = "ghost-button";
  removeRowButton.textContent = "Remove last row";
  removeRowButton.disabled = model.rows.length <= 1;
  removeRowButton.addEventListener("click", () => {
    const nextModel = deriveSpreadsheetDraft(currentDraftContent());
    const nextRows = nextModel.rows.slice(0, -1);
    syncEditorDraft(buildSpreadsheetContent({ columns: nextModel.columns, rows: nextRows.length ?nextRows : [[""]] }), {
      refreshWorkspace: true
    });
  });

  const removeColumnButton = document.createElement("button");
  removeColumnButton.type = "button";
  removeColumnButton.className = "ghost-button";
  removeColumnButton.textContent = "Remove last column";
  removeColumnButton.disabled = model.columns.length <= 1;
  removeColumnButton.addEventListener("click", () => {
    const nextModel = deriveSpreadsheetDraft(currentDraftContent());
    const nextColumns = nextModel.columns.slice(0, -1);
    const nextRows = nextModel.rows.map((row) => row.slice(0, -1));
    syncEditorDraft(buildSpreadsheetContent({ columns: nextColumns.length ?nextColumns : ["Column 1"], rows: nextRows }), {
      refreshWorkspace: true
    });
  });

  actions.append(addRowButton, addColumnButton, totalsButton, removeRowButton, removeColumnButton);
  toolbar.append(stats, actions);
  const insightGrid = createStructuredInsightGrid([
    { label: "Rows", value: model.rows.length, meta: "Editable records" },
    { label: "Columns", value: model.columns.length, meta: model.columns.slice(0, 3).join(", ") || "Table headers" },
    {
      label: "Filled cells",
      value: model.rows.flat().filter((value) => String(value || "").trim()).length,
      meta: "Non-empty cells in the current draft"
    },
    {
      label: "Numeric cells",
      value: model.rows.flat().filter((value) => Number.isFinite(Number(String(value || "").replace(",", ".")))).length,
      meta: "Cells Hydria can already compute from"
    }
  ]);
  const spreadsheetHero = document.createElement("div");
  spreadsheetHero.className = "workspace-spreadsheet-hero";
  const spreadsheetHeroMeta = document.createElement("div");
  spreadsheetHeroMeta.className = "workspace-document-hero-meta";
  const spreadsheetHeroKicker = document.createElement("span");
  spreadsheetHeroKicker.className = "tiny";
  spreadsheetHeroKicker.textContent = profile.workspaceLabel;
  const spreadsheetHeroTitle = document.createElement("strong");
  spreadsheetHeroTitle.textContent = state.currentWorkObject?.title || profile.sheetName;
  const spreadsheetHeroCopy = document.createElement("p");
  spreadsheetHeroCopy.textContent = profile.heroCopy;
  spreadsheetHeroMeta.append(spreadsheetHeroKicker, spreadsheetHeroTitle, spreadsheetHeroCopy);
  const spreadsheetHeroTabs = document.createElement("div");
  spreadsheetHeroTabs.className = "workspace-sheet-tabs";
  profile.tabs.forEach((label, index) => {
    const chip = document.createElement("span");
    chip.className = `workspace-sheet-tab${index === 0 ? " active" : ""}`;
    chip.textContent = label;
    spreadsheetHeroTabs.appendChild(chip);
  });
  spreadsheetHero.append(spreadsheetHeroMeta, spreadsheetHeroTabs);
  const sheetTabs = document.createElement("div");
  sheetTabs.className = "workspace-sheet-tabs";
  [profile.sheetName, "Summary"].forEach((label, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `workspace-sheet-tab${index === 0 ? " active" : ""}`;
    button.textContent = label;
    button.disabled = index !== 0;
    sheetTabs.appendChild(button);
  });

  const formulaBar = document.createElement("div");
  formulaBar.className = "workspace-formula-bar";
  const formulaLabel = document.createElement("span");
  formulaLabel.className = "tiny";
  formulaLabel.textContent = `${profile.sheetName} fields`;
  const formulaInput = document.createElement("input");
  formulaInput.type = "text";
  formulaInput.value = model.columns.join(" | ");
  formulaInput.placeholder = "Rename the current columns";
  formulaInput.addEventListener("input", (event) => {
    const nextColumns = String(event.target.value || "")
      .split("|")
      .map((part) => part.trim())
      .filter(Boolean);
    if (!nextColumns.length) {
      return;
    }
    const nextModel = deriveSpreadsheetDraft(currentDraftContent());
    const width = nextColumns.length;
    const nextRows = nextModel.rows.map((row) => Array.from({ length: width }, (_, index) => row[index] || ""));
    syncEditorDraft(buildSpreadsheetContent({ columns: nextColumns, rows: nextRows }), {
      refreshWorkspace: true
    });
  });
  formulaBar.append(formulaLabel, formulaInput);
  const layout = document.createElement("div");
  layout.className = "workspace-editor-layout workspace-spreadsheet-layout";
  const sidebar = document.createElement("aside");
  sidebar.className = "workspace-editor-sidebar";
  const main = document.createElement("div");
  main.className = "workspace-editor-main";

  const sheetPanel = createEditorPanel(profile.sheetPanelTitle, profile.sheetPanelHint);
  sheetPanel.body.appendChild(sheetTabs);
  sheetPanel.body.appendChild(
    createEditorMiniList(
      model.columns.map((column, index) => ({
        id: `column-${index}`,
        title: column || `Column ${index + 1}`,
        meta: `${model.rows.filter((row) => String(row[index] || "").trim()).length} filled cells`
      })),
      model.columns[0] ? "column-0" : "",
      {
        emptyLabel: "Add your first column to structure the table."
      }
    )
  );
  sidebar.appendChild(sheetPanel.panel);

  const dataProfilePanel = createEditorPanel(profile.profilePanelTitle, profile.profilePanelHint);
  const numericColumns = model.columns.filter((_, columnIndex) =>
    model.rows.some((row) => Number.isFinite(Number(String(row[columnIndex] || "").replace(",", "."))))
  );
  const fillRatio = model.columns.length && model.rows.length
    ? Math.round((model.rows.flat().filter((value) => String(value || "").trim()).length / (model.columns.length * model.rows.length)) * 100)
    : 0;
  const profileGrid = createStructuredInsightGrid([
    { label: "Sheet", value: profile.sheetName, meta: "Primary working grid" },
    { label: "Coverage", value: `${fillRatio}%`, meta: "How much of the visible sheet is filled" },
    { label: "Numeric columns", value: numericColumns.length, meta: numericColumns.slice(0, 3).join(", ") || "None yet" }
  ]);
  if (profileGrid) {
    dataProfilePanel.body.appendChild(profileGrid);
  }
  sidebar.appendChild(dataProfilePanel.panel);

  const selectionPanel = createEditorPanel(profile.selectionPanelTitle, profile.selectionPanelHint);
  const selectionGrid = createStructuredInsightGrid([
    { label: "Range", value: `A1:${String.fromCharCode(64 + Math.max(1, model.columns.length))}${Math.max(1, model.rows.length + 1)}`, meta: "Visible grid range" },
    { label: "Headers", value: model.columns.slice(0, 2).join(" / ") || "Column 1", meta: "Quick rename from the bar above" }
  ]);
  if (selectionGrid) {
    selectionPanel.body.appendChild(selectionGrid);
  }
  sidebar.appendChild(selectionPanel.panel);

  const computedPanel = createEditorPanel(profile.computedPanelTitle, profile.computedPanelHint);
  const numericColumnsWithValues = model.columns
    .map((column, columnIndex) => ({
      column,
      values: model.rows
        .map((row) => Number(String(row[columnIndex] || "").replace(",", ".")))
        .filter((value) => Number.isFinite(value))
    }))
    .filter((entry) => entry.values.length);
  const computedGrid = createStructuredInsightGrid(
    numericColumnsWithValues.slice(0, 3).map((entry) => {
      const total = entry.values.reduce((sum, value) => sum + value, 0);
      const average = total / entry.values.length;
      return {
        label: entry.column,
        value: Number.isInteger(total) ? String(total) : total.toFixed(2),
        meta: `Avg ${Number.isInteger(average) ? average : average.toFixed(2)}`
      };
    })
  );
  if (computedGrid) {
    computedPanel.body.appendChild(computedGrid);
  }
  sidebar.appendChild(computedPanel.panel);

  const tableWrap = document.createElement("div");
  tableWrap.className = "workspace-grid-editor-wrap";

  const table = document.createElement("table");
  table.className = "workspace-grid-editor";

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  const corner = document.createElement("th");
  corner.textContent = "#";
  headerRow.appendChild(corner);

  model.columns.forEach((column, columnIndex) => {
    const th = document.createElement("th");
    const input = document.createElement("input");
    input.type = "text";
    input.value = column;
    input.setAttribute("aria-label", `Column ${columnIndex + 1}`);
    input.addEventListener("input", (event) => {
      const nextModel = deriveSpreadsheetDraft(currentDraftContent());
      const nextColumns = [...nextModel.columns];
      nextColumns[columnIndex] = event.target.value;
      syncEditorDraft(buildSpreadsheetContent({ columns: nextColumns, rows: nextModel.rows }));
      stats.textContent = `${nextModel.rows.length} rows | ${nextColumns.length} columns`;
    });
    th.appendChild(input);
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  model.rows.forEach((row, rowIndex) => {
    const tr = document.createElement("tr");
    const rowLabel = document.createElement("th");
    rowLabel.textContent = String(rowIndex + 1);
    tr.appendChild(rowLabel);

    model.columns.forEach((_, columnIndex) => {
      const td = document.createElement("td");
      const input = document.createElement("input");
      input.type = "text";
      input.value = row[columnIndex] || "";
      input.setAttribute("aria-label", `Row ${rowIndex + 1}, column ${columnIndex + 1}`);
      input.addEventListener("input", (event) => {
        const nextModel = deriveSpreadsheetDraft(currentDraftContent());
        const nextRows = nextModel.rows.map((item) => [...item]);
        nextRows[rowIndex][columnIndex] = event.target.value;
        syncEditorDraft(buildSpreadsheetContent({ columns: nextModel.columns, rows: nextRows }));
      });
      td.appendChild(input);
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  tableWrap.appendChild(table);

  const gridPanel = createEditorPanel("Grid editor", "Edit the live table directly, rename columns and shape records like a spreadsheet.");
  gridPanel.body.append(formulaBar, tableWrap);
  main.appendChild(gridPanel.panel);

  const stagePanel = createEditorPanel("Sheet stage", "Keep the working grid, data profile and current sheet story visible like a spreadsheet product.");
  const stageShell = document.createElement("div");
  stageShell.className = "workspace-spreadsheet-stage";
  const stageHeader = document.createElement("div");
  stageHeader.className = "workspace-presentation-stage-header";
  const stageHeaderMeta = document.createElement("div");
  stageHeaderMeta.className = "workspace-code-toolbar-meta";
  const stageTitle = document.createElement("strong");
  stageTitle.textContent = state.currentWorkObject?.title || "Sheet 1";
  const stageHint = document.createElement("span");
  stageHint.className = "tiny";
  stageHint.textContent = `${model.rows.length} rows | ${model.columns.length} columns`;
  stageHeaderMeta.append(stageTitle, stageHint);
  const stageTokens = document.createElement("div");
  stageTokens.className = "workspace-chip-list";
  [
    "Table",
    numericColumnsWithValues.length ? "Computable" : "Raw data",
    model.rows.length > 20 ? "Large sheet" : "Working set"
  ].forEach((label, index) => {
    const chip = document.createElement("span");
    chip.className = `workspace-chip${index === 0 ? " active" : ""}`;
    chip.textContent = label;
    stageTokens.appendChild(chip);
  });
  stageHeader.append(stageHeaderMeta, stageTokens);
  const stageSelection = document.createElement("div");
  stageSelection.className = "workspace-flow-chip-list";
  [
    `Selection ${columnLetter(0)}1`,
    `${Math.max(1, model.columns.length)} columns`,
    `${Math.max(1, model.rows.length)} records`,
    numericColumnsWithValues.length ? "Computed" : "Manual"
  ].forEach((label, index) => {
    const chip = document.createElement("span");
    chip.className = `workspace-flow-chip${index === 0 ? " active" : ""}`;
    chip.textContent = label;
    stageSelection.appendChild(chip);
  });
  const stageCards = document.createElement("div");
  stageCards.className = "workspace-document-context-grid";
  [
    { label: "Primary fields", value: model.columns.slice(0, 4).join(" | ") || "Define your first columns" },
    { label: "Sample record", value: (model.rows[0] || []).filter(Boolean).join(" | ") || "Add a first record to populate the sheet" }
  ].forEach((item) => {
    const card = document.createElement("article");
    card.className = "workspace-document-context-card";
    const label = document.createElement("span");
    label.className = "tiny";
    label.textContent = item.label;
    const text = document.createElement("p");
    text.textContent = item.value;
    card.append(label, text);
    stageCards.appendChild(card);
  });
  const stageGridShell = document.createElement("div");
  stageGridShell.className = "workspace-sheet-stage-shell";
  const stageFormula = document.createElement("div");
  stageFormula.className = "workspace-formula-bar";
  const stageFormulaLabel = document.createElement("span");
  stageFormulaLabel.className = "tiny";
  stageFormulaLabel.textContent = "Formula";
  const stageFormulaValue = document.createElement("input");
  stageFormulaValue.type = "text";
  stageFormulaValue.readOnly = true;
  stageFormulaValue.value = `=${columnLetter(0)}1${model.columns[0] ? ` (${model.columns[0]})` : ""}`;
  stageFormula.append(stageFormulaLabel, stageFormulaValue);
  const stageTableShell = document.createElement("div");
  stageTableShell.className = "workspace-table-shell workspace-sheet-stage-table-shell";
  const stageTable = document.createElement("table");
  stageTable.className = "workspace-data-table workspace-sheet-stage-table";
  const stageHead = document.createElement("thead");
  const stageHeadRow = document.createElement("tr");
  const stageCorner = document.createElement("th");
  stageCorner.textContent = "";
  stageHeadRow.appendChild(stageCorner);
  model.columns.slice(0, 6).forEach((_, index) => {
    const th = document.createElement("th");
    th.textContent = columnLetter(index);
    stageHeadRow.appendChild(th);
  });
  stageHead.appendChild(stageHeadRow);
  stageTable.appendChild(stageHead);
  const stageBody = document.createElement("tbody");
  const headerDisplayRow = document.createElement("tr");
  const headerDisplayIndex = document.createElement("th");
  headerDisplayIndex.textContent = "1";
  headerDisplayRow.appendChild(headerDisplayIndex);
  model.columns.slice(0, 6).forEach((column) => {
    const td = document.createElement("td");
    td.textContent = column || "Column";
    headerDisplayRow.appendChild(td);
  });
  stageBody.appendChild(headerDisplayRow);
  model.rows.slice(0, 5).forEach((row, rowIndex) => {
    const tr = document.createElement("tr");
    const indexCell = document.createElement("th");
    indexCell.textContent = String(rowIndex + 2);
    tr.appendChild(indexCell);
    model.columns.slice(0, 6).forEach((_, columnIndex) => {
      const td = document.createElement("td");
      td.textContent = row[columnIndex] || "";
      tr.appendChild(td);
    });
    stageBody.appendChild(tr);
  });
  stageTable.appendChild(stageBody);
  stageTableShell.appendChild(stageTable);
  stageGridShell.append(stageFormula, stageTableShell);
  stageShell.append(stageHeader, stageSelection, stageCards, stageGridShell);
  stagePanel.body.appendChild(stageShell);
  main.appendChild(stagePanel.panel);

  const summaryPanel = createEditorPanel("Sheet summary", "Keep the current table story visible so the sheet feels like a decision surface, not raw CSV.");
  const summaryCards = document.createElement("div");
  summaryCards.className = "workspace-document-context-grid";
  [
    {
      label: "Top fields",
      value: model.columns.slice(0, 4).join(", ") || "No columns yet"
    },
    {
      label: "Sample row",
      value: (model.rows[0] || []).filter(Boolean).join(" | ") || "Add a row to start shaping the sheet."
    }
  ].forEach((item) => {
    const card = document.createElement("article");
    card.className = "workspace-document-context-card";
    const label = document.createElement("span");
    label.className = "tiny";
    label.textContent = item.label;
    const text = document.createElement("p");
    text.textContent = item.value;
    card.append(label, text);
    summaryCards.appendChild(card);
  });
  summaryPanel.body.appendChild(summaryCards);
  main.appendChild(summaryPanel.panel);

  shell.append(toolbar);
  if (insightGrid) {
    shell.appendChild(insightGrid);
  }
  shell.appendChild(spreadsheetHero);
  shell.appendChild(layout);
  layout.append(sidebar, main);
  container.appendChild(shell);
}

function renderPresentationStructuredEditor(container) {
  const draftContent = currentDraftContent();
  const deck = derivePresentationDeck(draftContent, state.currentWorkObject?.title || "Untitled presentation");
  const slideSections = state.currentSections.filter((section) => isPresentationSection(section));
  const selectedIndex = Math.max(0, slideSections.findIndex((section) => section.id === state.currentSectionId));
  const activeSlideIndex = slideSections.length ?selectedIndex : 0;
  const activeSlide = deck.slides[activeSlideIndex] || deck.slides[0];

  const shell = document.createElement("div");
  shell.className = "workspace-slide-editor workspace-presentation-workbench";

  const toolbar = document.createElement("div");
  toolbar.className = "workspace-structured-toolbar";

  const stats = document.createElement("div");
  stats.className = "workspace-structured-stats";
  stats.textContent = `${deck.slides.length} slides | deck workspace`;

  const addSlideButton = document.createElement("button");
  addSlideButton.type = "button";
  addSlideButton.className = "ghost-button";
  addSlideButton.textContent = "Add slide";
  addSlideButton.addEventListener("click", () => {
    const nextDeck = derivePresentationDeck(currentDraftContent(), state.currentWorkObject?.title || "Untitled presentation");
    const nextSlides = [
      ...nextDeck.slides,
      {
        title: `Slide ${nextDeck.slides.length + 1}`,
        body: "Add the next key point here."
      }
    ];
    syncEditorDraft(
      buildPresentationContent({
        title: nextDeck.title,
        slides: nextSlides
      }),
      { refreshWorkspace: true }
    );
  });

  const duplicateSlideButton = document.createElement("button");
  duplicateSlideButton.type = "button";
  duplicateSlideButton.className = "ghost-button";
  duplicateSlideButton.textContent = "Duplicate";
  duplicateSlideButton.addEventListener("click", () => {
    const nextDeck = derivePresentationDeck(currentDraftContent(), state.currentWorkObject?.title || "Untitled presentation");
    const seed = nextDeck.slides[activeSlideIndex] || nextDeck.slides[0];
    const nextSlides = [...nextDeck.slides];
    nextSlides.splice(activeSlideIndex + 1, 0, {
      ...seed,
      title: `${seed.title || "Slide"} copy`
    });
    syncEditorDraft(buildPresentationContent({ title: nextDeck.title, slides: nextSlides }), {
      refreshWorkspace: true
    });
  });

  const moveLeftButton = document.createElement("button");
  moveLeftButton.type = "button";
  moveLeftButton.className = "ghost-button";
  moveLeftButton.textContent = "Move left";
  moveLeftButton.disabled = activeSlideIndex <= 0;
  moveLeftButton.addEventListener("click", () => {
    const nextDeck = derivePresentationDeck(currentDraftContent(), state.currentWorkObject?.title || "Untitled presentation");
    const nextSlides = [...nextDeck.slides];
    const [moved] = nextSlides.splice(activeSlideIndex, 1);
    nextSlides.splice(activeSlideIndex - 1, 0, moved);
    syncEditorDraft(buildPresentationContent({ title: nextDeck.title, slides: nextSlides }), {
      refreshWorkspace: true
    });
  });

  const moveRightButton = document.createElement("button");
  moveRightButton.type = "button";
  moveRightButton.className = "ghost-button";
  moveRightButton.textContent = "Move right";
  moveRightButton.disabled = activeSlideIndex >= deck.slides.length - 1;
  moveRightButton.addEventListener("click", () => {
    const nextDeck = derivePresentationDeck(currentDraftContent(), state.currentWorkObject?.title || "Untitled presentation");
    const nextSlides = [...nextDeck.slides];
    const [moved] = nextSlides.splice(activeSlideIndex, 1);
    nextSlides.splice(activeSlideIndex + 1, 0, moved);
    syncEditorDraft(buildPresentationContent({ title: nextDeck.title, slides: nextSlides }), {
      refreshWorkspace: true
    });
  });

  const actions = document.createElement("div");
  actions.className = "workspace-structured-actions";
  actions.append(addSlideButton, duplicateSlideButton, moveLeftButton, moveRightButton);
  toolbar.append(stats, actions);
  const deckTitleLabel = document.createElement("label");
  deckTitleLabel.className = "composer-label";
  deckTitleLabel.textContent = "Deck title";
  const deckTitleInput = document.createElement("input");
  deckTitleInput.type = "text";
  deckTitleInput.value = deck.title;
  deckTitleInput.className = "workspace-slide-title-input";
  deckTitleInput.addEventListener("input", (event) => {
    const nextDeck = derivePresentationDeck(currentDraftContent(), state.currentWorkObject?.title || "Untitled presentation");
    syncEditorDraft(
      buildPresentationContent({
        title: event.target.value,
        slides: nextDeck.slides
      })
    );
  });

  const slideRail = document.createElement("div");
  slideRail.className = "workspace-slide-rail";
  deck.slides.forEach((slide, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `workspace-slide-pill${index === activeSlideIndex ?" active" : ""}`;
    button.textContent = slide.title || `Slide ${index + 1}`;
    button.addEventListener("click", () => {
      const nextSection = slideSections[index];
      state.currentSectionId = nextSection?.id || "";
      state.currentBlockId = "";
      renderWorkspace();
    });
    slideRail.appendChild(button);
  });

  const slideTitleLabel = document.createElement("label");
  slideTitleLabel.className = "composer-label";
  slideTitleLabel.textContent = "Slide title";
  const slideTitleInput = document.createElement("input");
  slideTitleInput.type = "text";
  slideTitleInput.className = "workspace-slide-title-input";
  slideTitleInput.value = activeSlide?.title || "";
  slideTitleInput.addEventListener("input", (event) => {
    const nextDeck = derivePresentationDeck(currentDraftContent(), state.currentWorkObject?.title || "Untitled presentation");
    const nextSlides = nextDeck.slides.map((slide, index) =>
      index === activeSlideIndex ?{ ...slide, title: event.target.value } : slide
    );
    syncEditorDraft(buildPresentationContent({ title: nextDeck.title, slides: nextSlides }));
  });

  const slideBodyLabel = document.createElement("label");
  slideBodyLabel.className = "composer-label";
  slideBodyLabel.textContent = "Slide content";
  const slideBodyInput = document.createElement("textarea");
  slideBodyInput.rows = 10;
  slideBodyInput.className = "workspace-slide-body-input";
  slideBodyInput.value = activeSlide?.body || "";
  slideBodyInput.addEventListener("input", (event) => {
    const nextDeck = derivePresentationDeck(currentDraftContent(), state.currentWorkObject?.title || "Untitled presentation");
    const nextSlides = nextDeck.slides.map((slide, index) =>
      index === activeSlideIndex ?{ ...slide, body: event.target.value } : slide
    );
    syncEditorDraft(buildPresentationContent({ title: nextDeck.title, slides: nextSlides }));
  });

  const layout = document.createElement("div");
  layout.className = "workspace-editor-layout workspace-presentation-layout";
  const sidebar = document.createElement("aside");
  sidebar.className = "workspace-editor-sidebar";
  const main = document.createElement("div");
  main.className = "workspace-editor-main";

  const slidePanel = createEditorPanel("Slides", "Pick the slide you want to modify.");
  slidePanel.body.appendChild(
    createEditorMiniList(
      deck.slides.map((slide, index) => ({
        id: slide.id || `slide-${index + 1}`,
        title: slide.title || `Slide ${index + 1}`,
        meta: `${normalizeEditorText(slide.body).split("\n").filter((line) => line.trim()).length || 1} talking points`
      })),
      activeSlide?.id || "",
      {
        onSelect: (slide) => {
          const index = deck.slides.findIndex((item) => item.id === slide.id);
          const nextSection = slideSections[index];
          state.currentSectionId = nextSection?.id || "";
          state.currentBlockId = "";
          renderWorkspace();
        }
      }
    )
  );
  sidebar.appendChild(slidePanel.panel);

  const editingPanel = createEditorPanel("How to modify", "Pick a slide, change its title and content, then Hydria keeps the deck in sync.");
  const editingSteps = document.createElement("div");
  editingSteps.className = "workspace-flow-chip-list";
  ["1 Pick a slide", "2 Rewrite the message", "3 Saved automatically"].forEach((label, index) => {
    const chip = document.createElement("span");
    chip.className = `workspace-flow-chip${index === 0 ? " active" : ""}`;
    chip.textContent = label;
    editingSteps.appendChild(chip);
  });
  editingPanel.body.appendChild(editingSteps);
  sidebar.appendChild(editingPanel.panel);

  const slideEditorPanel = createEditorPanel("Edit current slide", "Change the deck title, then rewrite the active slide directly.");
  slideEditorPanel.body.append(deckTitleLabel, deckTitleInput, slideTitleLabel, slideTitleInput, slideBodyLabel, slideBodyInput);
  main.appendChild(slideEditorPanel.panel);

  const stagePanel = createEditorPanel("Current slide snapshot", "Keep a compact reminder of the active slide while you edit.");
  const stageShell = document.createElement("div");
  stageShell.className = "workspace-presentation-stage-shell";
  const stageHeader = document.createElement("div");
  stageHeader.className = "workspace-presentation-stage-header";
  const stageHeaderMeta = document.createElement("div");
  stageHeaderMeta.className = "workspace-code-toolbar-meta";
  const stageName = document.createElement("strong");
  stageName.textContent = activeSlide?.title || "Slide";
  const stageHint = document.createElement("span");
  stageHint.className = "tiny";
  stageHint.textContent = `Slide ${activeSlideIndex + 1} of ${deck.slides.length}`;
  stageHeaderMeta.append(stageName, stageHint);
  const stageChips = document.createElement("div");
  stageChips.className = "workspace-chip-list";
  [
    "Story",
    normalizeEditorText(activeSlide?.body || "").split("\n").filter((line) => line.trim()).length > 3 ? "Dense" : "Lean",
    activeSlideIndex === 0 ? "Opening" : activeSlideIndex === deck.slides.length - 1 ? "Closing" : "Middle"
  ].forEach((label, index) => {
    const chip = document.createElement("span");
    chip.className = `workspace-chip${index === 0 ? " active" : ""}`;
    chip.textContent = label;
    stageChips.appendChild(chip);
  });
  stageHeader.append(stageHeaderMeta, stageChips);
  const stageWorkbench = document.createElement("div");
  stageWorkbench.className = "workspace-presentation-stage-workbench";
  const stageThumbRail = document.createElement("div");
  stageThumbRail.className = "workspace-presentation-thumbnail-rail";
  deck.slides.slice(0, 6).forEach((slide, index) => {
    const thumb = document.createElement("button");
    thumb.type = "button";
    thumb.className = `workspace-presentation-thumbnail${index === activeSlideIndex ? " active" : ""}`;
    thumb.addEventListener("click", () => {
      const nextSection = slideSections[index];
      state.currentSectionId = nextSection?.id || "";
      state.currentBlockId = "";
      renderWorkspace();
    });
    const meta = document.createElement("span");
    meta.className = "tiny";
    meta.textContent = `Slide ${index + 1}`;
    const title = document.createElement("strong");
    title.textContent = slide.title || `Slide ${index + 1}`;
    const preview = document.createElement("p");
    preview.textContent = normalizeEditorText(slide.body || "").split("\n").find((line) => line.trim()) || "Shape this slide in the deck.";
    thumb.append(meta, title, preview);
    stageThumbRail.appendChild(thumb);
  });

  const stageCanvas = document.createElement("article");
  stageCanvas.className = "workspace-presentation-stage-canvas";
  const stageCanvasKicker = document.createElement("span");
  stageCanvasKicker.className = "workspace-slide-kicker";
  stageCanvasKicker.textContent = "Active slide";
  const stageCanvasTitle = document.createElement("h3");
  stageCanvasTitle.textContent = activeSlide?.title || "Slide";
  const stageCanvasBody = document.createElement("div");
  stageCanvasBody.className = "workspace-presentation-stage-body";
  normalizeEditorText(activeSlide?.body || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 6)
    .forEach((line) => {
      const item = document.createElement(/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line) ? "li" : "p");
      item.textContent = line.replace(/^[-*]\s+|^\d+\.\s+/, "");
      stageCanvasBody.appendChild(item);
    });
  if (!stageCanvasBody.childNodes.length) {
    const fallback = document.createElement("p");
    fallback.textContent = "Add the key message, proof points and next step for this slide.";
    stageCanvasBody.appendChild(fallback);
  }
  stageCanvas.append(stageCanvasKicker, stageCanvasTitle, stageCanvasBody);

  const notesPanel = document.createElement("div");
  notesPanel.className = "workspace-presentation-speaker-notes";
  const notesHeader = document.createElement("div");
  notesHeader.className = "workspace-code-toolbar-meta";
  const notesTitle = document.createElement("strong");
  notesTitle.textContent = "Speaker notes";
  const notesHint = document.createElement("span");
  notesHint.className = "tiny";
  notesHint.textContent = "What to say while this slide is on screen";
  notesHeader.append(notesTitle, notesHint);
  notesPanel.appendChild(notesHeader);
  const notesGrid = document.createElement("div");
  notesGrid.className = "workspace-document-context-grid";
  [
    {
      label: "Presenter note",
      value: normalizeEditorText(activeSlide?.body || "").split("\n").filter((line) => line.trim())[0] || "Lead with the most important message."
    },
    {
      label: "Audience signal",
      value: activeSlideIndex === 0 ? "Hook interest quickly." : activeSlideIndex === deck.slides.length - 1 ? "Make the next action obvious." : "Support the story with proof."
    }
  ].forEach((item) => {
    const card = document.createElement("article");
    card.className = "workspace-document-context-card";
    const label = document.createElement("span");
    label.className = "tiny";
    label.textContent = item.label;
    const text = document.createElement("p");
    text.textContent = item.value;
    card.append(label, text);
    notesGrid.appendChild(card);
  });
  notesPanel.appendChild(notesGrid);
  stageWorkbench.append(stageThumbRail, stageCanvas, notesPanel);
  stageShell.append(stageHeader, stageWorkbench);
  const noteSummaryPanel = createEditorPanel("Presenter notes", "Hydria keeps the speaking angle visible while you rewrite the slide.");
  noteSummaryPanel.body.appendChild(notesPanel);
  main.appendChild(noteSummaryPanel.panel);

  layout.append(sidebar, main);
  shell.append(toolbar, layout);
  container.appendChild(shell);
}

function parseCardsText(value = "") {
  return normalizeEditorText(value)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [title = "", meta = "", text = ""] = line.split("|").map((part) => part.trim());
      return { title, meta, text };
    });
}

function parseTableHeaders(value = "") {
  return String(value || "")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseTableRows(value = "", width = 0) {
  return normalizeEditorText(value)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const row = line.split("|").map((part) => part.trim());
      if (!width) {
        return row;
      }
      return Array.from({ length: width }, (_, index) => row[index] || "");
    });
}

function renderAppConfigStructuredEditor(container) {
  const config = deriveAppConfigDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria App");
  if (!config.pages.length) {
    config.pages = [
      {
        id: "overview",
        label: "Overview",
        title: "Overview",
        intro: "Describe the first view.",
        cards: [{ title: "Main card", meta: "Value", text: "Add the main content here." }],
        table: null,
        checklist: []
      }
    ];
  }

  if (!state.currentStructuredItemId || !config.pages.some((page) => page.id === state.currentStructuredItemId)) {
    state.currentStructuredItemId = config.pages[0].id;
  }

  const activeIndex = Math.max(
    0,
    config.pages.findIndex((page) => page.id === state.currentStructuredItemId)
  );
  const activePage = config.pages[activeIndex] || config.pages[0];
  const currentMode = activePage?.table?.headers?.length
    ?"table"
    : activePage?.checklist?.length
      ?"checklist"
      : "cards";

  const shell = document.createElement("div");
  shell.className = "workspace-app-builder workspace-app-workbench";

  const toolbar = document.createElement("div");
  toolbar.className = "workspace-structured-toolbar";
  const stats = document.createElement("div");
  stats.className = "workspace-structured-stats";
  stats.textContent = `${config.pages.length} views`;
  const actions = document.createElement("div");
  actions.className = "workspace-structured-actions";

  const addPageButton = document.createElement("button");
  addPageButton.type = "button";
  addPageButton.className = "ghost-button";
  addPageButton.textContent = "Add view";
  addPageButton.addEventListener("click", () => {
    const nextConfig = deriveAppConfigDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria App");
    const nextPages = [
      ...nextConfig.pages,
      {
        id: `page-${nextConfig.pages.length + 1}`,
        label: `View ${nextConfig.pages.length + 1}`,
        title: `New view ${nextConfig.pages.length + 1}`,
        intro: "Describe what this view should show.",
        cards: [{ title: "Main card", meta: "Value", text: "Add the main content here." }],
        table: null,
        checklist: []
      }
    ];
    syncEditorDraft(buildAppConfigContent({ ...nextConfig, pages: nextPages }), { refreshWorkspace: true });
  });
  actions.append(addPageButton);
  toolbar.append(stats, actions);
  const appInsightGrid = createStructuredInsightGrid([
    { label: "App", value: config.title || "Hydria App", meta: config.subtitle || "Shape the current product blueprint" },
    { label: "Views", value: config.pages.length, meta: activePage ? `Active: ${activePage.label || activePage.title}` : "No active view" },
    { label: "Current mode", value: currentMode === "cards" ? "Cards" : currentMode === "table" ? "Table" : "Checklist", meta: "Switch the active view between content modes" },
    {
      label: "Current payload",
      value: activePage?.cards?.length || activePage?.table?.rows?.length || activePage?.checklist?.length || 0,
      meta: currentMode === "table" ? "Rows in the active table" : currentMode === "checklist" ? "Checklist items" : "Cards in the active view"
    }
  ]);
  const appHero = document.createElement("div");
  appHero.className = "workspace-app-hero";
  const appHeroMeta = document.createElement("div");
  appHeroMeta.className = "workspace-document-hero-meta";
  const appHeroKicker = document.createElement("span");
  appHeroKicker.className = "tiny";
  appHeroKicker.textContent = "App builder workspace";
  const appHeroTitle = document.createElement("strong");
  appHeroTitle.textContent = config.title || "Hydria App";
  const appHeroCopy = document.createElement("p");
  appHeroCopy.textContent = config.subtitle || "Shape the product, its views and the current user loop without leaving the workspace.";
  appHeroMeta.append(appHeroKicker, appHeroTitle, appHeroCopy);
  const appHeroTabs = document.createElement("div");
  appHeroTabs.className = "workspace-code-tabs";
  ["Blueprint", "Views", "Data", "Flow"].forEach((label, index) => {
    const tab = document.createElement("span");
    tab.className = `workspace-code-tab${index === 0 ? " is-active" : ""}`;
    tab.textContent = label;
    appHeroTabs.appendChild(tab);
  });
  appHero.append(appHeroMeta, appHeroTabs);

  const layout = document.createElement("div");
  layout.className = "workspace-editor-layout workspace-app-builder-layout";
  const sidebar = document.createElement("aside");
  sidebar.className = "workspace-editor-sidebar";
  const main = document.createElement("div");
  main.className = "workspace-editor-main";

  const pageRail = document.createElement("div");
  pageRail.className = "workspace-slide-rail";
  config.pages.forEach((page, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `workspace-slide-pill${index === activeIndex ?" active" : ""}`;
    button.textContent = page.label || page.title || `View ${index + 1}`;
    button.addEventListener("click", () => {
      state.currentStructuredItemId = page.id;
      renderWorkspace();
    });
    pageRail.appendChild(button);
  });

  const fields = [
    {
      label: "App title",
      value: config.title,
      apply(nextValue) {
        const nextConfig = deriveAppConfigDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria App");
        syncEditorDraft(buildAppConfigContent({ ...nextConfig, title: nextValue }));
      }
    },
    {
      label: "Subtitle",
      value: config.subtitle,
      apply(nextValue) {
        const nextConfig = deriveAppConfigDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria App");
        syncEditorDraft(buildAppConfigContent({ ...nextConfig, subtitle: nextValue }));
      }
    },
    {
      label: "Active view label",
      value: activePage?.label || "",
      apply(nextValue) {
        const nextConfig = deriveAppConfigDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria App");
        nextConfig.pages[activeIndex] = { ...nextConfig.pages[activeIndex], label: nextValue };
        syncEditorDraft(buildAppConfigContent(nextConfig));
      }
    },
    {
      label: "Active view title",
      value: activePage?.title || "",
      apply(nextValue) {
        const nextConfig = deriveAppConfigDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria App");
        nextConfig.pages[activeIndex] = { ...nextConfig.pages[activeIndex], title: nextValue };
        syncEditorDraft(buildAppConfigContent(nextConfig));
      }
    }
  ];

  shell.append(toolbar);
  if (appInsightGrid) {
    shell.appendChild(appInsightGrid);
  }
  const viewsPanel = createEditorPanel("Views", "Move between the app surfaces and keep the blueprint coherent.");
  viewsPanel.body.append(pageRail);
  sidebar.appendChild(viewsPanel.panel);

  const shellPanel = createEditorPanel("App shell", "Set the title and framing of the product.");
  fields.forEach((field) => {
    const label = document.createElement("label");
    label.className = "composer-label";
    label.textContent = field.label;
    const input = document.createElement("input");
    input.type = "text";
    input.className = "workspace-slide-title-input";
    input.value = field.value;
    input.addEventListener("input", (event) => field.apply(event.target.value));
    shellPanel.body.append(label, input);
  });
  sidebar.appendChild(shellPanel.panel);

  const signalPanel = createEditorPanel("Product signals", "Keep the active view posture and current payload visible like a real internal tool builder.");
  const signalGrid = createStructuredInsightGrid([
    { label: "Active view", value: activePage?.label || activePage?.title || "View", meta: activePage?.title || "Current product surface" },
    { label: "Mode", value: currentMode === "cards" ? "Cards" : currentMode === "table" ? "Table" : "Checklist", meta: "Current surface payload type" },
    {
      label: "Payload",
      value: activePage?.cards?.length || activePage?.table?.rows?.length || activePage?.checklist?.length || 0,
      meta: currentMode === "table" ? "Rows" : currentMode === "checklist" ? "Actions" : "Cards"
    }
  ]);
  if (signalGrid) {
    signalPanel.body.appendChild(signalGrid);
  }
  sidebar.appendChild(signalPanel.panel);

  const introLabel = document.createElement("label");
  introLabel.className = "composer-label";
  introLabel.textContent = "View intro";
  const introInput = document.createElement("textarea");
  introInput.rows = 4;
  introInput.className = "workspace-slide-body-input";
  introInput.value = activePage?.intro || "";
  introInput.addEventListener("input", (event) => {
    const nextConfig = deriveAppConfigDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria App");
    nextConfig.pages[activeIndex] = { ...nextConfig.pages[activeIndex], intro: event.target.value };
    syncEditorDraft(buildAppConfigContent(nextConfig));
  });
  const viewPanel = createEditorPanel("Active view", "Shape the currently selected view and its main payload.");
  viewPanel.body.append(introLabel, introInput);

  const contentModeNav = document.createElement("div");
  contentModeNav.className = "workspace-chip-list";
  [
    { id: "cards", label: "Cards" },
    { id: "table", label: "Table" },
    { id: "checklist", label: "Checklist" }
  ].forEach((mode) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `workspace-chip${currentMode === mode.id ?" active" : ""}`;
    button.textContent = mode.label;
    button.addEventListener("click", () => {
      const nextConfig = deriveAppConfigDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria App");
      const nextPage = { ...nextConfig.pages[activeIndex] };
      if (mode.id === "cards") {
        nextPage.cards = nextPage.cards?.length ?nextPage.cards : [{ title: "Main card", meta: "Value", text: "Describe the key value." }];
        nextPage.table = null;
        nextPage.checklist = [];
      } else if (mode.id === "table") {
        nextPage.table = nextPage.table?.headers?.length
          ?nextPage.table
          : { headers: ["Column 1", "Column 2"], rows: [["", ""], ["", ""]] };
        nextPage.cards = [];
        nextPage.checklist = [];
      } else {
        nextPage.checklist = nextPage.checklist?.length ?nextPage.checklist : ["First action", "Second action"];
        nextPage.cards = [];
        nextPage.table = null;
      }
      nextConfig.pages[activeIndex] = nextPage;
      syncEditorDraft(buildAppConfigContent(nextConfig), { refreshWorkspace: true });
    });
    contentModeNav.appendChild(button);
  });
  viewPanel.body.append(contentModeNav);

  if (currentMode === "cards") {
    const cardsLabel = document.createElement("label");
    cardsLabel.className = "composer-label";
    cardsLabel.textContent = "Cards (Title | Meta | Text)";
    const cardsInput = document.createElement("textarea");
    cardsInput.rows = 5;
    cardsInput.className = "workspace-slide-body-input";
    cardsInput.value = (activePage?.cards || [])
      .map((card) => [card.title || "", card.meta || "", card.text || ""].join(" | "))
      .join("\n");
    cardsInput.addEventListener("input", (event) => {
      const nextConfig = deriveAppConfigDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria App");
      nextConfig.pages[activeIndex] = {
        ...nextConfig.pages[activeIndex],
        cards: parseCardsText(event.target.value),
        table: null,
        checklist: []
      };
      syncEditorDraft(buildAppConfigContent(nextConfig));
    });
    viewPanel.body.append(cardsLabel, cardsInput);
  }

  if (currentMode === "table") {
    const tableLabel = document.createElement("label");
    tableLabel.className = "composer-label";
    tableLabel.textContent = "Table headers and rows";
    const tableHeadersInput = document.createElement("input");
    tableHeadersInput.type = "text";
    tableHeadersInput.className = "workspace-slide-title-input";
    tableHeadersInput.value = activePage?.table?.headers?.join(" | ") || "";
    const tableRowsInput = document.createElement("textarea");
    tableRowsInput.rows = 4;
    tableRowsInput.className = "workspace-slide-body-input";
    tableRowsInput.value = (activePage?.table?.rows || []).map((row) => row.join(" | ")).join("\n");

    const syncTable = () => {
      const nextConfig = deriveAppConfigDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria App");
      const headers = parseTableHeaders(tableHeadersInput.value);
      const rows = parseTableRows(tableRowsInput.value, headers.length);
      nextConfig.pages[activeIndex] = {
        ...nextConfig.pages[activeIndex],
        table: headers.length ?{ headers, rows } : null,
        cards: [],
        checklist: []
      };
      syncEditorDraft(buildAppConfigContent(nextConfig));
    };

    tableHeadersInput.addEventListener("input", syncTable);
    tableRowsInput.addEventListener("input", syncTable);
    viewPanel.body.append(tableLabel, tableHeadersInput, tableRowsInput);
  }

  if (currentMode === "checklist") {
    const checklistLabel = document.createElement("label");
    checklistLabel.className = "composer-label";
    checklistLabel.textContent = "Checklist";
    const checklistInput = document.createElement("textarea");
    checklistInput.rows = 4;
    checklistInput.className = "workspace-slide-body-input";
    checklistInput.value = (activePage?.checklist || []).join("\n");
    checklistInput.addEventListener("input", (event) => {
      const nextConfig = deriveAppConfigDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria App");
      nextConfig.pages[activeIndex] = {
        ...nextConfig.pages[activeIndex],
        checklist: normalizeEditorText(event.target.value)
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
        cards: [],
        table: null
      };
      syncEditorDraft(buildAppConfigContent(nextConfig));
    });
    viewPanel.body.append(checklistLabel, checklistInput);
  }

  const stagePanel = createEditorPanel("View stage", "Preview the active surface like a real app builder instead of editing raw config only.");
  const stageShell = document.createElement("div");
  stageShell.className = "workspace-app-stage";
  const stageHeader = document.createElement("div");
  stageHeader.className = "workspace-presentation-stage-header";
  const stageHeaderMeta = document.createElement("div");
  stageHeaderMeta.className = "workspace-code-toolbar-meta";
  const stageHeaderTitle = document.createElement("strong");
  stageHeaderTitle.textContent = activePage?.title || activePage?.label || "Active view";
  const stageHeaderHint = document.createElement("span");
  stageHeaderHint.className = "tiny";
  stageHeaderHint.textContent = `${activePage?.label || "View"} | ${currentMode}`;
  stageHeaderMeta.append(stageHeaderTitle, stageHeaderHint);
  const stageHeaderActions = document.createElement("div");
  stageHeaderActions.className = "workspace-chip-list";
  [
    "View",
    currentMode === "table" ? "Structured" : currentMode === "checklist" ? "Actionable" : "Narrative",
    config.pages.length > 3 ? "Multi-view" : "Focused"
  ].forEach((label, index) => {
    const chip = document.createElement("span");
    chip.className = `workspace-chip${index === 0 ? " active" : ""}`;
    chip.textContent = label;
    stageHeaderActions.appendChild(chip);
  });
  stageHeader.append(stageHeaderMeta, stageHeaderActions);
  const stageLead = document.createElement("p");
  stageLead.className = "workspace-app-stage-copy";
  stageLead.textContent = activePage?.intro || "Describe what users should immediately understand on this view.";
  stageShell.append(stageHeader, stageLead);
  if (currentMode === "cards") {
    const cardGrid = document.createElement("div");
    cardGrid.className = "workspace-dashboard-widget-grid";
    (activePage?.cards || []).forEach((card) => {
      const element = document.createElement("article");
      element.className = "workspace-dashboard-widget workspace-dashboard-widget--medium";
      const meta = document.createElement("span");
      meta.className = "tiny";
      meta.textContent = card.meta || "Signal";
      const title = document.createElement("strong");
      title.textContent = card.title || "Card";
      const text = document.createElement("p");
      text.textContent = card.text || "Describe the value of this card.";
      element.append(meta, title, text);
      cardGrid.appendChild(element);
    });
    stageShell.appendChild(cardGrid);
  } else if (currentMode === "table") {
    const stageTableWrap = document.createElement("div");
    stageTableWrap.className = "workspace-grid-editor-wrap";
    const stageTable = document.createElement("table");
    stageTable.className = "workspace-grid-editor";
    const stageThead = document.createElement("thead");
    const stageHeadRow = document.createElement("tr");
    const stageCorner = document.createElement("th");
    stageCorner.textContent = "#";
    stageHeadRow.appendChild(stageCorner);
    (activePage?.table?.headers || []).forEach((header) => {
      const th = document.createElement("th");
      th.textContent = header;
      stageHeadRow.appendChild(th);
    });
    stageThead.appendChild(stageHeadRow);
    stageTable.appendChild(stageThead);
    const stageTbody = document.createElement("tbody");
    (activePage?.table?.rows || []).slice(0, 5).forEach((row, rowIndex) => {
      const tr = document.createElement("tr");
      const indexCell = document.createElement("th");
      indexCell.textContent = String(rowIndex + 1);
      tr.appendChild(indexCell);
      (activePage?.table?.headers || []).forEach((_, columnIndex) => {
        const td = document.createElement("td");
        td.textContent = row[columnIndex] || "";
        tr.appendChild(td);
      });
      stageTbody.appendChild(tr);
    });
    stageTable.appendChild(stageTbody);
    stageTableWrap.appendChild(stageTable);
    stageShell.appendChild(stageTableWrap);
  } else {
    const checklist = document.createElement("div");
    checklist.className = "workspace-mini-list";
    (activePage?.checklist || []).forEach((item, index) => {
      const row = document.createElement("div");
      row.className = "workspace-mini-list-item";
      const title = document.createElement("strong");
      title.textContent = item;
      const meta = document.createElement("span");
      meta.className = "tiny";
      meta.textContent = `Step ${index + 1}`;
      row.append(title, meta);
      checklist.appendChild(row);
    });
    stageShell.appendChild(checklist);
  }
  stagePanel.body.appendChild(stageShell);

  main.appendChild(viewPanel.panel);
  main.appendChild(stagePanel.panel);
  layout.append(sidebar, main);
  shell.append(appHero, layout);
  container.appendChild(shell);
}

function renderDashboardStructuredEditor(container) {
  const model = deriveDashboardDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Dashboard");
  if (!state.currentStructuredItemId || !model.charts.some((_, index) => `chart-${index + 1}` === state.currentStructuredItemId)) {
    state.currentStructuredItemId = model.charts[0] ? "chart-1" : "";
  }
  if (!state.currentStructuredSubItemId || !model.widgets.some((widget) => widget.id === state.currentStructuredSubItemId)) {
    state.currentStructuredSubItemId = model.widgets[0]?.id || "";
  }
  const activeChartIndex = Math.max(
    0,
    model.charts.findIndex((_, index) => `chart-${index + 1}` === state.currentStructuredItemId)
  );
  const activeChart = model.charts[activeChartIndex] || model.charts[0] || { title: "", kind: "line", points: [] };
  const activeWidgetIndex = Math.max(
    0,
    model.widgets.findIndex((widget) => widget.id === state.currentStructuredSubItemId)
  );
  const activeWidget =
    model.widgets[activeWidgetIndex] ||
    model.widgets[0] ||
    { id: "widget-1", title: "", type: "summary", size: "medium", summary: "" };
  const shell = document.createElement("div");
  shell.className = "workspace-app-builder workspace-dashboard-editor workspace-dashboard-workbench";

  const toolbar = document.createElement("div");
  toolbar.className = "workspace-structured-toolbar";
  const stats = document.createElement("div");
  stats.className = "workspace-structured-stats";
  stats.textContent = `${model.widgets.length} widgets | ${model.metrics.length} metrics | ${model.charts.length} charts`;
  const actions = document.createElement("div");
  actions.className = "workspace-structured-actions";

  const addMetricButton = document.createElement("button");
  addMetricButton.type = "button";
  addMetricButton.className = "ghost-button";
  addMetricButton.textContent = "Add metric";
  addMetricButton.addEventListener("click", () => {
    const next = deriveDashboardDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Dashboard");
    next.metrics.push({ label: `Metric ${next.metrics.length + 1}`, value: "", delta: "" });
    syncEditorDraft(buildDashboardContent(next), { refreshWorkspace: true });
  });

  const addChartButton = document.createElement("button");
  addChartButton.type = "button";
  addChartButton.className = "ghost-button";
  addChartButton.textContent = "Add chart";
  addChartButton.addEventListener("click", () => {
    const next = deriveDashboardDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Dashboard");
    next.charts.push({ title: `Chart ${next.charts.length + 1}`, kind: "line", points: [{ label: "P1", value: "" }, { label: "P2", value: "" }] });
    state.currentStructuredItemId = `chart-${next.charts.length}`;
    syncEditorDraft(buildDashboardContent(next), { refreshWorkspace: true });
  });

  const removeMetricButton = document.createElement("button");
  removeMetricButton.type = "button";
  removeMetricButton.className = "ghost-button";
  removeMetricButton.textContent = "Remove metric";
  removeMetricButton.disabled = model.metrics.length <= 1;
  removeMetricButton.addEventListener("click", () => {
    const next = deriveDashboardDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Dashboard");
    next.metrics = next.metrics.slice(0, -1);
    syncEditorDraft(buildDashboardContent(next), { refreshWorkspace: true });
  });

  const removeChartButton = document.createElement("button");
  removeChartButton.type = "button";
  removeChartButton.className = "ghost-button";
  removeChartButton.textContent = "Remove chart";
  removeChartButton.disabled = model.charts.length <= 1;
  removeChartButton.addEventListener("click", () => {
    const next = deriveDashboardDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Dashboard");
    next.charts = next.charts.slice(0, -1);
    state.currentStructuredItemId = next.charts.length ? `chart-${Math.max(1, next.charts.length)}` : "";
    syncEditorDraft(buildDashboardContent(next), { refreshWorkspace: true });
  });

  const moveWidgetLeftButton = document.createElement("button");
  moveWidgetLeftButton.type = "button";
  moveWidgetLeftButton.className = "ghost-button";
  moveWidgetLeftButton.textContent = "Widget left";
  moveWidgetLeftButton.disabled = activeWidgetIndex <= 0;
  moveWidgetLeftButton.addEventListener("click", () => {
    moveDashboardWidget(activeWidget.id, -1);
  });

  const moveWidgetRightButton = document.createElement("button");
  moveWidgetRightButton.type = "button";
  moveWidgetRightButton.className = "ghost-button";
  moveWidgetRightButton.textContent = "Widget right";
  moveWidgetRightButton.disabled = activeWidgetIndex >= model.widgets.length - 1;
  moveWidgetRightButton.addEventListener("click", () => {
    moveDashboardWidget(activeWidget.id, 1);
  });

  actions.append(
    addMetricButton,
    addChartButton,
    removeMetricButton,
    removeChartButton,
    moveWidgetLeftButton,
    moveWidgetRightButton
  );
  toolbar.append(stats, actions);
  const dashboardInsightGrid = createStructuredInsightGrid([
    { label: "Dashboard", value: model.title || "Hydria Dashboard", meta: model.summary || "Keep the key signal obvious and current" },
    { label: "Metrics", value: model.metrics.length, meta: model.metrics[0]?.label || "No metric yet" },
    { label: "Widgets", value: model.widgets.length, meta: activeWidget.title || "No active widget" },
    { label: "Charts", value: model.charts.length, meta: activeChart.title || "No active chart" }
  ]);
  const dashboardHero = document.createElement("div");
  dashboardHero.className = "workspace-dashboard-hero";
  const dashboardHeroMeta = document.createElement("div");
  dashboardHeroMeta.className = "workspace-document-hero-meta";
  const dashboardHeroKicker = document.createElement("span");
  dashboardHeroKicker.className = "tiny";
  dashboardHeroKicker.textContent = "Analytics workspace";
  const dashboardHeroTitle = document.createElement("strong");
  dashboardHeroTitle.textContent = model.title || "Dashboard";
  const dashboardHeroCopy = document.createElement("p");
  dashboardHeroCopy.textContent = model.summary || "Shape the reporting layer so the main signal, breakdown and action path stay obvious.";
  dashboardHeroMeta.append(dashboardHeroKicker, dashboardHeroTitle, dashboardHeroCopy);
  const dashboardHeroTabs = document.createElement("div");
  dashboardHeroTabs.className = "workspace-code-tabs";
  ["Overview", "Widgets", "Charts", "Table"].forEach((label, index) => {
    const tab = document.createElement("span");
    tab.className = `workspace-code-tab${index === 0 ? " is-active" : ""}`;
    tab.textContent = label;
    dashboardHeroTabs.appendChild(tab);
  });
  dashboardHero.append(dashboardHeroMeta, dashboardHeroTabs);
  const layout = document.createElement("div");
  layout.className = "workspace-editor-layout workspace-dashboard-layout";
  const sidebar = document.createElement("aside");
  sidebar.className = "workspace-editor-sidebar";
  const main = document.createElement("div");
  main.className = "workspace-editor-main";

  const titleLabel = document.createElement("label");
  titleLabel.className = "composer-label";
  titleLabel.textContent = "Dashboard title";
  const titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.className = "workspace-slide-title-input";
  titleInput.value = model.title;
  titleInput.addEventListener("input", (event) => {
    const next = deriveDashboardDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Dashboard");
    next.title = event.target.value;
    syncEditorDraft(buildDashboardContent(next));
  });

  const summaryLabel = document.createElement("label");
  summaryLabel.className = "composer-label";
  summaryLabel.textContent = "Summary";
  const summaryInput = document.createElement("textarea");
  summaryInput.rows = 3;
  summaryInput.className = "workspace-slide-body-input";
  summaryInput.value = model.summary;
  summaryInput.addEventListener("input", (event) => {
    const next = deriveDashboardDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Dashboard");
    next.summary = event.target.value;
    syncEditorDraft(buildDashboardContent(next));
  });

  const filtersLabel = document.createElement("label");
  filtersLabel.className = "composer-label";
  filtersLabel.textContent = "Filters";
  const filtersInput = document.createElement("input");
  filtersInput.type = "text";
  filtersInput.className = "workspace-slide-title-input";
  filtersInput.value = model.filters.join(" | ");
  filtersInput.addEventListener("input", (event) => {
    const next = deriveDashboardDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Dashboard");
    next.filters = normalizeEditorText(event.target.value)
      .split("|")
      .map((item) => item.trim())
      .filter(Boolean);
    syncEditorDraft(buildDashboardContent(next));
  });

  const widgetsLabel = document.createElement("label");
  widgetsLabel.className = "composer-label";
  widgetsLabel.textContent = "Widgets (Title | Type | Size | Summary)";
  const widgetsInput = document.createElement("textarea");
  widgetsInput.rows = 5;
  widgetsInput.className = "workspace-slide-body-input";
  widgetsInput.value = model.widgets
    .map((widget) => [widget.title, widget.type, widget.size || "medium", widget.summary].join(" | "))
    .join("\n");
  widgetsInput.addEventListener("input", (event) => {
    const next = deriveDashboardDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Dashboard");
    next.widgets = normalizeEditorText(event.target.value)
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => {
        const [title = "", type = "summary", size = "medium", summary = ""] = line
          .split("|")
          .map((part) => part.trim());
        return { id: `widget-${index + 1}`, title, type, size, summary };
      });
    syncEditorDraft(buildDashboardContent(next));
  });

  const widgetRail = document.createElement("div");
  widgetRail.className = "workspace-slide-rail";
  model.widgets.forEach((widget) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `workspace-slide-pill${widget.id === activeWidget.id ? " active" : ""}`;
    button.textContent = widget.title || "Widget";
    button.addEventListener("click", () => {
      state.currentStructuredSubItemId = widget.id;
      renderWorkspace();
    });
    widgetRail.appendChild(button);
  });

  const activeWidgetTitleLabel = document.createElement("label");
  activeWidgetTitleLabel.className = "composer-label";
  activeWidgetTitleLabel.textContent = "Active widget title";
  const activeWidgetTitleInput = document.createElement("input");
  activeWidgetTitleInput.type = "text";
  activeWidgetTitleInput.className = "workspace-slide-title-input";
  activeWidgetTitleInput.value = activeWidget.title || "";
  activeWidgetTitleInput.addEventListener("input", (event) => {
    const next = deriveDashboardDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Dashboard");
    next.widgets = next.widgets.map((widget) =>
      widget.id === activeWidget.id ? { ...widget, title: event.target.value } : widget
    );
    syncEditorDraft(buildDashboardContent(next));
  });

  const activeWidgetTypeLabel = document.createElement("label");
  activeWidgetTypeLabel.className = "composer-label";
  activeWidgetTypeLabel.textContent = "Active widget type";
  const activeWidgetTypeInput = document.createElement("select");
  activeWidgetTypeInput.className = "workspace-slide-title-input";
  ["summary", "alert", "list", "chart", "spotlight"].forEach((kind) => {
    const option = document.createElement("option");
    option.value = kind;
    option.textContent = kind;
    option.selected = (activeWidget.type || "summary") === kind;
    activeWidgetTypeInput.appendChild(option);
  });
  activeWidgetTypeInput.addEventListener("change", (event) => {
    const next = deriveDashboardDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Dashboard");
    next.widgets = next.widgets.map((widget) =>
      widget.id === activeWidget.id ? { ...widget, type: event.target.value } : widget
    );
    syncEditorDraft(buildDashboardContent(next));
  });

  const activeWidgetSizeLabel = document.createElement("label");
  activeWidgetSizeLabel.className = "composer-label";
  activeWidgetSizeLabel.textContent = "Active widget size";
  const activeWidgetSizeInput = document.createElement("select");
  activeWidgetSizeInput.className = "workspace-slide-title-input";
  ["small", "medium", "large"].forEach((size) => {
    const option = document.createElement("option");
    option.value = size;
    option.textContent = size;
    option.selected = (activeWidget.size || "medium") === size;
    activeWidgetSizeInput.appendChild(option);
  });
  activeWidgetSizeInput.addEventListener("change", (event) => {
    const next = deriveDashboardDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Dashboard");
    next.widgets = next.widgets.map((widget) =>
      widget.id === activeWidget.id ? { ...widget, size: event.target.value } : widget
    );
    syncEditorDraft(buildDashboardContent(next));
  });

  const activeWidgetSummaryLabel = document.createElement("label");
  activeWidgetSummaryLabel.className = "composer-label";
  activeWidgetSummaryLabel.textContent = "Active widget summary";
  const activeWidgetSummaryInput = document.createElement("textarea");
  activeWidgetSummaryInput.rows = 3;
  activeWidgetSummaryInput.className = "workspace-slide-body-input";
  activeWidgetSummaryInput.value = activeWidget.summary || "";
  activeWidgetSummaryInput.addEventListener("input", (event) => {
    const next = deriveDashboardDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Dashboard");
    next.widgets = next.widgets.map((widget) =>
      widget.id === activeWidget.id ? { ...widget, summary: event.target.value } : widget
    );
    syncEditorDraft(buildDashboardContent(next));
  });

  const widgetListPanel = createEditorPanel("Widget stack", "Pick a widget, then refine its role, size and summary.");
  widgetListPanel.body.append(
    createEditorMiniList(
      model.widgets.map((widget) => ({
        id: widget.id,
        title: widget.title || "Widget",
        meta: `${widget.type || "summary"} · ${widget.size || "medium"}`
      })),
      activeWidget.id,
      {
        emptyLabel: "No widgets yet.",
        onSelect: (widget) => {
          state.currentStructuredSubItemId = widget.id;
          renderWorkspace();
        }
      }
    )
  );
  sidebar.appendChild(widgetListPanel.panel);

  const filterPanel = createEditorPanel("Slices", "Keep the active dashboard slices visible like a BI filter rail.");
  const filterChips = document.createElement("div");
  filterChips.className = "workspace-chip-list";
  (model.filters || []).forEach((filter, index) => {
    const chip = document.createElement("span");
    chip.className = `workspace-chip${index === 0 ? " active" : ""}`;
    chip.textContent = filter;
    filterChips.appendChild(chip);
  });
  if (!(model.filters || []).length) {
    const empty = document.createElement("span");
    empty.className = "tiny muted";
    empty.textContent = "No filters yet. Add slices above.";
    filterChips.appendChild(empty);
  }
  filterPanel.body.appendChild(filterChips);
  sidebar.appendChild(filterPanel.panel);

  const metricShelfPanel = createEditorPanel("Metric shelf", "Keep the headline KPIs visible like a real analytics builder.");
  metricShelfPanel.body.appendChild(
    createEditorMiniList(
      model.metrics.map((metric, index) => ({
        id: `metric-${index + 1}`,
        title: metric.label || `Metric ${index + 1}`,
        meta: [metric.value, metric.delta].filter(Boolean).join(" · ") || "No signal yet"
      })),
      "metric-1",
      {
        emptyLabel: "No metrics yet. Add one above to shape the dashboard spine."
      }
    )
  );
  sidebar.appendChild(metricShelfPanel.panel);

  const metricsLabel = document.createElement("label");
  metricsLabel.className = "composer-label";
  metricsLabel.textContent = "Metrics (Label | Value | Delta)";
  const metricsInput = document.createElement("textarea");
  metricsInput.rows = 6;
  metricsInput.className = "workspace-slide-body-input";
  metricsInput.value = model.metrics.map((metric) => [metric.label, metric.value, metric.delta].join(" | ")).join("\n");
  metricsInput.addEventListener("input", (event) => {
    const next = deriveDashboardDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Dashboard");
    next.metrics = normalizeEditorText(event.target.value)
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [label = "", value = "", delta = ""] = line.split("|").map((part) => part.trim());
        return { label, value, delta };
      });
    syncEditorDraft(buildDashboardContent(next));
  });

  const chartsLabel = document.createElement("label");
  chartsLabel.className = "composer-label";
  chartsLabel.textContent = "Charts (Title | Kind | Label:Value, Label:Value)";
  const chartsInput = document.createElement("textarea");
  chartsInput.rows = 6;
  chartsInput.className = "workspace-slide-body-input";
  chartsInput.value = model.charts
    .map((chart) => [chart.title, chart.kind, (chart.points || []).map((point) => `${point.label}:${point.value}`).join(", ")].join(" | "))
    .join("\n");
  chartsInput.addEventListener("input", (event) => {
    const next = deriveDashboardDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Dashboard");
    next.charts = normalizeEditorText(event.target.value)
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [title = "", kind = "line", pointsRaw = ""] = line.split("|").map((part) => part.trim());
        return {
          title,
          kind,
          points: pointsRaw
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
            .map((item) => {
              const [label = "", value = ""] = item.split(":").map((part) => part.trim());
              return { label, value };
            })
        };
      });
    syncEditorDraft(buildDashboardContent(next));
  });

  const chartRail = document.createElement("div");
  chartRail.className = "workspace-slide-rail";
  model.charts.forEach((chart, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `workspace-slide-pill${index === activeChartIndex ? " active" : ""}`;
    button.textContent = chart.title || `Chart ${index + 1}`;
    button.addEventListener("click", () => {
      state.currentStructuredItemId = `chart-${index + 1}`;
      renderWorkspace();
    });
    chartRail.appendChild(button);
  });

  const reportStagePanel = createEditorPanel("Report stage", "Shape the active view like a real analytics surface with the main metric story up front.");
  const reportStage = document.createElement("div");
  reportStage.className = "workspace-dashboard-stage";
  const reportHeader = document.createElement("div");
  reportHeader.className = "workspace-presentation-stage-header";
  const reportHeaderMeta = document.createElement("div");
  reportHeaderMeta.className = "workspace-code-toolbar-meta";
  const reportTitle = document.createElement("strong");
  reportTitle.textContent = activeChart.title || activeWidget.title || model.title || "Dashboard";
  const reportHint = document.createElement("span");
  reportHint.className = "tiny";
  reportHint.textContent = `${activeChart.kind || "chart"} | ${model.filters[0] || "all slices"}`;
  reportHeaderMeta.append(reportTitle, reportHint);
  const reportTabs = document.createElement("div");
  reportTabs.className = "workspace-chip-list";
  [
    activeWidget.type || "summary",
    activeWidget.size || "medium",
    activeChart.points?.length ? `${activeChart.points.length} points` : "No points"
  ].forEach((label, index) => {
    const chip = document.createElement("span");
    chip.className = `workspace-chip${index === 0 ? " active" : ""}`;
    chip.textContent = label;
    reportTabs.appendChild(chip);
  });
  reportHeader.append(reportHeaderMeta, reportTabs);
  reportStage.appendChild(reportHeader);
  const reportGrid = document.createElement("div");
  reportGrid.className = "workspace-document-context-grid";
  const mainSignal = document.createElement("article");
  mainSignal.className = "workspace-document-context-card";
  const mainSignalLabel = document.createElement("span");
  mainSignalLabel.className = "tiny";
  mainSignalLabel.textContent = "Main widget";
  const mainSignalValue = document.createElement("p");
  mainSignalValue.textContent = activeWidget.summary || "Use the active widget to state the main signal first.";
  mainSignal.append(mainSignalLabel, mainSignalValue);
  const chartSignal = document.createElement("article");
  chartSignal.className = "workspace-document-context-card";
  const chartSignalLabel = document.createElement("span");
  chartSignalLabel.className = "tiny";
  chartSignalLabel.textContent = "Active chart";
  const chartSignalValue = document.createElement("p");
  chartSignalValue.textContent = (activeChart.points || []).slice(0, 3).map((point) => `${point.label}: ${point.value}`).join(" | ") || "Add points to make the chart meaningful.";
  chartSignal.append(chartSignalLabel, chartSignalValue);
  reportGrid.append(mainSignal, chartSignal);
  reportStage.appendChild(reportGrid);
  if ((model.filters || []).length) {
    const reportFilterRow = document.createElement("div");
    reportFilterRow.className = "workspace-flow-chip-list";
    model.filters.slice(0, 4).forEach((filter, index) => {
      const chip = document.createElement("span");
      chip.className = `workspace-flow-chip${index === 0 ? " active" : ""}`;
      chip.textContent = filter;
      reportFilterRow.appendChild(chip);
    });
    reportStage.appendChild(reportFilterRow);
  }
  if ((model.metrics || []).length) {
    const reportMetricRow = document.createElement("div");
    reportMetricRow.className = "workspace-dashboard-metrics";
    model.metrics.slice(0, 3).forEach((metric) => {
      const metricCard = document.createElement("article");
      metricCard.className = "workspace-dashboard-kpi";
      const label = document.createElement("span");
      label.className = "tiny";
      label.textContent = metric.label || "Metric";
      const value = document.createElement("strong");
      value.textContent = metric.value || "—";
      const delta = document.createElement("span");
      delta.className = `workspace-dashboard-delta${
        String(metric.delta || "").trim().startsWith("+") ? " positive" : String(metric.delta || "").trim().startsWith("-") ? " negative" : ""
      }`;
      delta.textContent = metric.delta || "Watching";
      metricCard.append(label, value, delta);
      reportMetricRow.appendChild(metricCard);
    });
    reportStage.appendChild(reportMetricRow);
  }
  if ((activeChart.points || []).length) {
    const numericPoints = activeChart.points.map((point) => {
      const parsed = Number(String(point.value || "").replace(/[^0-9.-]/g, ""));
      return Number.isFinite(parsed) ? parsed : 0;
    });
    const maxValue = Math.max(...numericPoints, 1);
    const reportBars = document.createElement("div");
    reportBars.className = "workspace-dashboard-bars";
    activeChart.points.slice(0, 6).forEach((point, index) => {
      const value = numericPoints[index] || 0;
      const group = document.createElement("article");
      group.className = "workspace-dashboard-bar-group";
      const bar = document.createElement("div");
      bar.className = "workspace-dashboard-bar";
      const fill = document.createElement("div");
      fill.className = "workspace-dashboard-bar-fill";
      fill.style.height = `${Math.max(16, Math.round((value / maxValue) * 100))}%`;
      bar.appendChild(fill);
      const label = document.createElement("span");
      label.className = "tiny";
      label.textContent = point.label || `P${index + 1}`;
      const valueLabel = document.createElement("strong");
      valueLabel.textContent = point.value || "0";
      group.append(bar, label, valueLabel);
      reportBars.appendChild(group);
    });
    reportStage.appendChild(reportBars);
  }
  reportStagePanel.body.appendChild(reportStage);
  main.appendChild(reportStagePanel.panel);

  const activeChartTitleLabel = document.createElement("label");
  activeChartTitleLabel.className = "composer-label";
  activeChartTitleLabel.textContent = "Active chart title";
  const activeChartTitleInput = document.createElement("input");
  activeChartTitleInput.type = "text";
  activeChartTitleInput.className = "workspace-slide-title-input";
  activeChartTitleInput.value = activeChart.title || "";
  activeChartTitleInput.addEventListener("input", (event) => {
    const next = deriveDashboardDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Dashboard");
    next.charts = next.charts.map((chart, index) =>
      index === activeChartIndex ? { ...chart, title: event.target.value } : chart
    );
    syncEditorDraft(buildDashboardContent(next));
  });

  const activeChartKindLabel = document.createElement("label");
  activeChartKindLabel.className = "composer-label";
  activeChartKindLabel.textContent = "Active chart type";
  const activeChartKindInput = document.createElement("select");
  activeChartKindInput.className = "workspace-slide-title-input";
  ["line", "bar", "area", "progress"].forEach((kind) => {
    const option = document.createElement("option");
    option.value = kind;
    option.textContent = kind;
    option.selected = (activeChart.kind || "line") === kind;
    activeChartKindInput.appendChild(option);
  });
  activeChartKindInput.addEventListener("change", (event) => {
    const next = deriveDashboardDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Dashboard");
    next.charts = next.charts.map((chart, index) =>
      index === activeChartIndex ? { ...chart, kind: event.target.value } : chart
    );
    syncEditorDraft(buildDashboardContent(next));
  });

  const activeChartPointsLabel = document.createElement("label");
  activeChartPointsLabel.className = "composer-label";
  activeChartPointsLabel.textContent = "Active chart points";
  const activeChartPointsInput = document.createElement("textarea");
  activeChartPointsInput.rows = 4;
  activeChartPointsInput.className = "workspace-slide-body-input";
  activeChartPointsInput.value = (activeChart.points || [])
    .map((point) => `${point.label}:${point.value}`)
    .join("\n");
  activeChartPointsInput.addEventListener("input", (event) => {
    const next = deriveDashboardDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Dashboard");
    const nextPoints = normalizeEditorText(event.target.value)
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const [label = "", value = ""] = item.split(":").map((part) => part.trim());
        return { label, value };
      });
    next.charts = next.charts.map((chart, index) =>
      index === activeChartIndex ? { ...chart, points: nextPoints } : chart
    );
    syncEditorDraft(buildDashboardContent(next));
  });

  const chartListPanel = createEditorPanel("Chart rack", "Move between charts and keep the signal selection sharp.");
  chartListPanel.body.append(
    createEditorMiniList(
      model.charts.map((chart, index) => ({
        id: `chart-${index + 1}`,
        title: chart.title || `Chart ${index + 1}`,
        meta: `${chart.kind || "line"} · ${(chart.points || []).length} points`
      })),
      `chart-${activeChartIndex + 1}`,
      {
        emptyLabel: "No charts yet.",
        onSelect: (chart) => {
          state.currentStructuredItemId = chart.id;
          renderWorkspace();
        }
      }
    )
  );
  sidebar.appendChild(chartListPanel.panel);

  const activeFilterIndex = (model.filters || []).findIndex((filter) => filter === state.currentPreviewFilter);
  const filterListPanel = createEditorPanel("Filters", "Keep preview focus aligned with the business slice you care about.");
  filterListPanel.body.append(
    createEditorMiniList(
      (model.filters || []).map((filter, index) => ({
        id: `filter-${index + 1}`,
        title: filter,
        meta: state.currentPreviewFilter === filter ? "Active preview focus" : "Preview filter"
      })),
      activeFilterIndex >= 0 ? `filter-${activeFilterIndex + 1}` : "",
      {
        emptyLabel: "No filters yet.",
        onSelect: (filterItem) => {
          const nextFilter = model.filters[Number(String(filterItem.id || "").replace("filter-", "")) - 1] || "";
          state.currentPreviewFilter = state.currentPreviewFilter === nextFilter ? "" : nextFilter;
          renderWorkspace();
        }
      }
    )
  );
  sidebar.appendChild(filterListPanel.panel);

  const tableToolbar = document.createElement("div");
  tableToolbar.className = "workspace-structured-toolbar";
  const tableStats = document.createElement("div");
  tableStats.className = "workspace-structured-stats";
  tableStats.textContent = `${model.table.rows.length} rows · ${model.table.columns.length} columns`;
  const tableActions = document.createElement("div");
  tableActions.className = "workspace-structured-actions";

  const addTableRowButton = document.createElement("button");
  addTableRowButton.type = "button";
  addTableRowButton.className = "ghost-button";
  addTableRowButton.textContent = "Add row";
  addTableRowButton.addEventListener("click", () => {
    const next = deriveDashboardDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Dashboard");
    next.table.rows.push(Array.from({ length: next.table.columns.length }, () => ""));
    syncEditorDraft(buildDashboardContent(next), { refreshWorkspace: true });
  });

  const addTableColumnButton = document.createElement("button");
  addTableColumnButton.type = "button";
  addTableColumnButton.className = "ghost-button";
  addTableColumnButton.textContent = "Add column";
  addTableColumnButton.addEventListener("click", () => {
    const next = deriveDashboardDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Dashboard");
    next.table.columns.push(`Column ${next.table.columns.length + 1}`);
    next.table.rows = next.table.rows.map((row) => [...row, ""]);
    syncEditorDraft(buildDashboardContent(next), { refreshWorkspace: true });
  });

  tableActions.append(addTableRowButton, addTableColumnButton);
  tableToolbar.append(tableStats, tableActions);

  const tableWrap = document.createElement("div");
  tableWrap.className = "workspace-grid-editor-wrap";
  const table = document.createElement("table");
  table.className = "workspace-grid-editor";
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  const corner = document.createElement("th");
  corner.textContent = "#";
  headerRow.appendChild(corner);
  model.table.columns.forEach((column, columnIndex) => {
    const th = document.createElement("th");
    const input = document.createElement("input");
    input.type = "text";
    input.value = column;
    input.addEventListener("input", (event) => {
      const next = deriveDashboardDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Dashboard");
      next.table.columns[columnIndex] = event.target.value;
      syncEditorDraft(buildDashboardContent(next));
    });
    th.appendChild(input);
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);
  const tbody = document.createElement("tbody");
  model.table.rows.forEach((row, rowIndex) => {
    const tr = document.createElement("tr");
    const rowLabel = document.createElement("th");
    rowLabel.textContent = String(rowIndex + 1);
    tr.appendChild(rowLabel);
    model.table.columns.forEach((_, columnIndex) => {
      const td = document.createElement("td");
      const input = document.createElement("input");
      input.type = "text";
      input.value = row[columnIndex] || "";
      input.addEventListener("input", (event) => {
        const next = deriveDashboardDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Dashboard");
        next.table.rows = next.table.rows.map((tableRow) => [...tableRow]);
        next.table.rows[rowIndex][columnIndex] = event.target.value;
        syncEditorDraft(buildDashboardContent(next));
      });
      td.appendChild(input);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  tableWrap.appendChild(table);

  const framingPanel = createEditorPanel("Dashboard framing", "Define the title, summary, filter model and key metrics first.");
  const activeFilters = document.createElement("div");
  activeFilters.className = "workspace-chip-list";
  (model.filters || []).forEach((filter) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `workspace-chip${state.currentPreviewFilter === filter ? " active" : ""}`;
    chip.textContent = filter;
    chip.addEventListener("click", () => {
      state.currentPreviewFilter = state.currentPreviewFilter === filter ? "" : filter;
      renderWorkspace();
    });
    activeFilters.appendChild(chip);
  });
  framingPanel.body.append(
    titleLabel,
    titleInput,
    summaryLabel,
    summaryInput,
    filtersLabel,
    filtersInput,
    activeFilters,
    metricsLabel,
    metricsInput
  );
  main.appendChild(framingPanel.panel);

  const activeWidgetPanel = createEditorPanel("Active widget", "Tune the currently focused card instead of editing the whole dashboard at once.");
  activeWidgetPanel.body.append(
    activeWidgetTitleLabel,
    activeWidgetTitleInput,
    activeWidgetTypeLabel,
    activeWidgetTypeInput,
    activeWidgetSizeLabel,
    activeWidgetSizeInput,
    activeWidgetSummaryLabel,
    activeWidgetSummaryInput,
    widgetsLabel,
    widgetsInput
  );
  main.appendChild(activeWidgetPanel.panel);

  const activeChartPanel = createEditorPanel("Active chart", "Keep the chart narrative close to the exact visual users will see.");
  activeChartPanel.body.append(
    activeChartTitleLabel,
    activeChartTitleInput,
    activeChartKindLabel,
    activeChartKindInput,
    activeChartPointsLabel,
    activeChartPointsInput,
    chartsLabel,
    chartsInput
  );
  main.appendChild(activeChartPanel.panel);

  const tablePanel = createEditorPanel("Data table", "Feed the operational layer with the same rows the dashboard is built from.");
  tablePanel.body.append(tableToolbar, tableWrap);
  main.appendChild(tablePanel.panel);

  shell.append(toolbar);
  if (dashboardInsightGrid) {
    shell.appendChild(dashboardInsightGrid);
  }
  shell.appendChild(dashboardHero);
  layout.append(sidebar, main);
  shell.appendChild(layout);
  container.appendChild(shell);
}

function renderWorkflowStructuredEditor(container) {
  const model = deriveWorkflowDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Workflow");
  if (!state.currentStructuredItemId || !model.stages.some((stage) => stage.id === state.currentStructuredItemId)) {
    state.currentStructuredItemId = model.stages[0]?.id || "";
  }
  if (!state.currentStructuredSubItemId || !model.links.some((link) => link.id === state.currentStructuredSubItemId)) {
    state.currentStructuredSubItemId = model.links[0]?.id || "";
  }
  const activeStageIndex = Math.max(
    0,
    model.stages.findIndex((stage) => stage.id === state.currentStructuredItemId)
  );
  const activeStage = model.stages[activeStageIndex] || model.stages[0] || { id: "step-1", label: "", owner: "", note: "" };
  const activeLinkIndex = Math.max(
    0,
    model.links.findIndex((link) => link.id === state.currentStructuredSubItemId)
  );
  const activeLink = model.links[activeLinkIndex] || model.links[0] || { id: "link-1", from: "", to: "", label: "Next" };
  const shell = document.createElement("div");
  shell.className = "workspace-app-builder workspace-workflow-editor";

  const toolbar = document.createElement("div");
  toolbar.className = "workspace-structured-toolbar";
  const stats = document.createElement("div");
  stats.className = "workspace-structured-stats";
  stats.textContent = `${model.stages.length} steps | ${model.links.length} links | ${model.automations.length} automations`;
  const actions = document.createElement("div");
  actions.className = "workspace-structured-actions";

  const addStageButton = document.createElement("button");
  addStageButton.type = "button";
  addStageButton.className = "ghost-button";
  addStageButton.textContent = "Add stage";
  addStageButton.addEventListener("click", () => {
    const next = deriveWorkflowDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Workflow");
    next.stages.push({
      id: `step-${next.stages.length + 1}`,
      label: `Step ${next.stages.length + 1}`,
      owner: "Hydria",
      note: ""
    });
    next.links = buildSequentialWorkflowLinks(next.stages, next.links);
    syncEditorDraft(buildWorkflowContent(next), { refreshWorkspace: true });
  });

  const removeStageButton = document.createElement("button");
  removeStageButton.type = "button";
  removeStageButton.className = "ghost-button";
  removeStageButton.textContent = "Remove stage";
  removeStageButton.disabled = model.stages.length <= 1;
  removeStageButton.addEventListener("click", () => {
    const next = deriveWorkflowDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Workflow");
    next.stages = next.stages.slice(0, -1);
    next.links = buildSequentialWorkflowLinks(next.stages, next.links);
    state.currentStructuredItemId = next.stages[Math.max(0, next.stages.length - 1)]?.id || "";
    syncEditorDraft(buildWorkflowContent(next), { refreshWorkspace: true });
  });

  const moveStageLeftButton = document.createElement("button");
  moveStageLeftButton.type = "button";
  moveStageLeftButton.className = "ghost-button";
  moveStageLeftButton.textContent = "Move left";
  moveStageLeftButton.disabled = activeStageIndex <= 0;
  moveStageLeftButton.addEventListener("click", () => {
    const next = deriveWorkflowDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Workflow");
    const [moved] = next.stages.splice(activeStageIndex, 1);
    next.stages.splice(activeStageIndex - 1, 0, moved);
    next.links = buildSequentialWorkflowLinks(next.stages, next.links);
    state.currentStructuredItemId = moved.id;
    syncEditorDraft(buildWorkflowContent(next), { refreshWorkspace: true });
  });

  const moveStageRightButton = document.createElement("button");
  moveStageRightButton.type = "button";
  moveStageRightButton.className = "ghost-button";
  moveStageRightButton.textContent = "Move right";
  moveStageRightButton.disabled = activeStageIndex >= model.stages.length - 1;
  moveStageRightButton.addEventListener("click", () => {
    const next = deriveWorkflowDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Workflow");
    const [moved] = next.stages.splice(activeStageIndex, 1);
    next.stages.splice(activeStageIndex + 1, 0, moved);
    next.links = buildSequentialWorkflowLinks(next.stages, next.links);
    state.currentStructuredItemId = moved.id;
    syncEditorDraft(buildWorkflowContent(next), { refreshWorkspace: true });
  });

  actions.append(addStageButton, removeStageButton, moveStageLeftButton, moveStageRightButton);
  toolbar.append(stats, actions);
  const workflowInsightGrid = createStructuredInsightGrid([
    { label: "Workflow", value: model.title || "Hydria Workflow", meta: model.objective || "Keep the flow clear and operable" },
    { label: "Trigger", value: model.trigger || "Manual", meta: "What starts the current automation" },
    { label: "Steps", value: model.stages.length, meta: activeStage.label || "No active stage" },
    { label: "Outputs", value: model.outputs.length, meta: model.outputs[0] || "No output defined yet" }
  ]);
  const workflowHero = document.createElement("div");
  workflowHero.className = "workspace-workflow-hero";
  const workflowHeroMeta = document.createElement("div");
  workflowHeroMeta.className = "workspace-document-hero-meta";
  const workflowHeroKicker = document.createElement("span");
  workflowHeroKicker.className = "tiny";
  workflowHeroKicker.textContent = "Automation workspace";
  const workflowHeroTitle = document.createElement("strong");
  workflowHeroTitle.textContent = model.title || "Workflow";
  const workflowHeroCopy = document.createElement("p");
  workflowHeroCopy.textContent = model.objective || "Shape the trigger, node flow and outputs like a real automation canvas.";
  workflowHeroMeta.append(workflowHeroKicker, workflowHeroTitle, workflowHeroCopy);
  const workflowHeroTabs = document.createElement("div");
  workflowHeroTabs.className = "workspace-code-tabs";
  ["Flow", "Nodes", "Automations", "Outputs"].forEach((label, index) => {
    const tab = document.createElement("span");
    tab.className = `workspace-code-tab${index === 0 ? " is-active" : ""}`;
    tab.textContent = label;
    workflowHeroTabs.appendChild(tab);
  });
  workflowHero.append(workflowHeroMeta, workflowHeroTabs);
  const layout = document.createElement("div");
  layout.className = "workspace-editor-layout workspace-workflow-layout";
  const sidebar = document.createElement("aside");
  sidebar.className = "workspace-editor-sidebar";
  const main = document.createElement("div");
  main.className = "workspace-editor-main";

  const stageRail = document.createElement("div");
  stageRail.className = "workspace-slide-rail";
  model.stages.forEach((stage, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `workspace-slide-pill${index === activeStageIndex ? " active" : ""}`;
    button.textContent = stage.label || `Step ${index + 1}`;
    button.addEventListener("click", () => {
      state.currentStructuredItemId = stage.id;
      renderWorkspace();
    });
    stageRail.appendChild(button);
  });

  const linkRail = document.createElement("div");
  linkRail.className = "workspace-slide-rail";
  (model.links || []).forEach((link, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `workspace-slide-pill${link.id === activeLink.id ? " active" : ""}`;
    button.textContent = link.label || `Link ${index + 1}`;
    button.addEventListener("click", () => {
      state.currentStructuredSubItemId = link.id;
      renderWorkspace();
    });
    linkRail.appendChild(button);
  });

  const titleLabel = document.createElement("label");
  titleLabel.className = "composer-label";
  titleLabel.textContent = "Workflow title";
  const titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.className = "workspace-slide-title-input";
  titleInput.value = model.title;
  titleInput.addEventListener("input", (event) => {
    const next = deriveWorkflowDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Workflow");
    next.title = event.target.value;
    syncEditorDraft(buildWorkflowContent(next));
  });

  const objectiveLabel = document.createElement("label");
  objectiveLabel.className = "composer-label";
  objectiveLabel.textContent = "Objective";
  const objectiveInput = document.createElement("textarea");
  objectiveInput.rows = 3;
  objectiveInput.className = "workspace-slide-body-input";
  objectiveInput.value = model.objective;
  objectiveInput.addEventListener("input", (event) => {
    const next = deriveWorkflowDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Workflow");
    next.objective = event.target.value;
    syncEditorDraft(buildWorkflowContent(next));
  });

  const triggerLabel = document.createElement("label");
  triggerLabel.className = "composer-label";
  triggerLabel.textContent = "Trigger";
  const triggerInput = document.createElement("input");
  triggerInput.type = "text";
  triggerInput.className = "workspace-slide-title-input";
  triggerInput.value = model.trigger;
  triggerInput.addEventListener("input", (event) => {
    const next = deriveWorkflowDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Workflow");
    next.trigger = event.target.value;
    syncEditorDraft(buildWorkflowContent(next));
  });

  const stageLabelLabel = document.createElement("label");
  stageLabelLabel.className = "composer-label";
  stageLabelLabel.textContent = "Active stage label";
  const stageLabelInput = document.createElement("input");
  stageLabelInput.type = "text";
  stageLabelInput.className = "workspace-slide-title-input";
  stageLabelInput.value = activeStage.label || "";
  stageLabelInput.addEventListener("input", (event) => {
    const next = deriveWorkflowDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Workflow");
    next.stages = next.stages.map((stage, index) =>
      index === activeStageIndex ? { ...stage, label: event.target.value } : stage
    );
    next.links = buildSequentialWorkflowLinks(next.stages, next.links);
    syncEditorDraft(buildWorkflowContent(next));
  });

  const stageOwnerLabel = document.createElement("label");
  stageOwnerLabel.className = "composer-label";
  stageOwnerLabel.textContent = "Active stage owner";
  const stageOwnerInput = document.createElement("input");
  stageOwnerInput.type = "text";
  stageOwnerInput.className = "workspace-slide-title-input";
  stageOwnerInput.value = activeStage.owner || "";
  stageOwnerInput.addEventListener("input", (event) => {
    const next = deriveWorkflowDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Workflow");
    next.stages = next.stages.map((stage, index) =>
      index === activeStageIndex ? { ...stage, owner: event.target.value } : stage
    );
    next.links = buildSequentialWorkflowLinks(next.stages, next.links);
    syncEditorDraft(buildWorkflowContent(next));
  });

  const stageNoteLabel = document.createElement("label");
  stageNoteLabel.className = "composer-label";
  stageNoteLabel.textContent = "Active stage note";
  const stageNoteInput = document.createElement("textarea");
  stageNoteInput.rows = 5;
  stageNoteInput.className = "workspace-slide-body-input";
  stageNoteInput.value = activeStage.note || "";
  stageNoteInput.addEventListener("input", (event) => {
    const next = deriveWorkflowDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Workflow");
    next.stages = next.stages.map((stage, index) =>
      index === activeStageIndex ? { ...stage, note: event.target.value } : stage
    );
    next.links = buildSequentialWorkflowLinks(next.stages, next.links);
    syncEditorDraft(buildWorkflowContent(next));
  });

  const automationLabel = document.createElement("label");
  automationLabel.className = "composer-label";
  automationLabel.textContent = "Automation rules";
  const automationInput = document.createElement("textarea");
  automationInput.rows = 4;
  automationInput.className = "workspace-slide-body-input";
  automationInput.value = model.automations.join("\n");
  automationInput.addEventListener("input", (event) => {
    const next = deriveWorkflowDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Workflow");
    next.automations = normalizeEditorText(event.target.value).split("\n").map((line) => line.trim()).filter(Boolean);
    syncEditorDraft(buildWorkflowContent(next));
  });

  const outputsLabel = document.createElement("label");
  outputsLabel.className = "composer-label";
  outputsLabel.textContent = "Outputs";
  const outputsInput = document.createElement("textarea");
  outputsInput.rows = 3;
  outputsInput.className = "workspace-slide-body-input";
  outputsInput.value = model.outputs.join("\n");
  outputsInput.addEventListener("input", (event) => {
    const next = deriveWorkflowDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Workflow");
    next.outputs = normalizeEditorText(event.target.value).split("\n").map((line) => line.trim()).filter(Boolean);
    syncEditorDraft(buildWorkflowContent(next));
  });

  const linksLabel = document.createElement("label");
  linksLabel.className = "composer-label";
  linksLabel.textContent = "Connections (From -> To | Label)";
  const linksInput = document.createElement("textarea");
  linksInput.rows = 4;
  linksInput.className = "workspace-slide-body-input";
  linksInput.value = (model.links || [])
    .map((link) => `${link.from} -> ${link.to} | ${link.label || "Next"}`)
    .join("\n");
  linksInput.addEventListener("input", (event) => {
    const next = deriveWorkflowDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Workflow");
    next.links = normalizeEditorText(event.target.value)
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => {
        const [path = "", label = "Next"] = line.split("|").map((part) => part.trim());
        const [from = "", to = ""] = path.split("->").map((part) => part.trim());
        return { id: `link-${index + 1}`, from, to, label };
      });
    syncEditorDraft(buildWorkflowContent(next));
  });

  const activeLinkLabel = document.createElement("label");
  activeLinkLabel.className = "composer-label";
  activeLinkLabel.textContent = "Active connection label";
  const activeLinkLabelInput = document.createElement("input");
  activeLinkLabelInput.type = "text";
  activeLinkLabelInput.className = "workspace-slide-title-input";
  activeLinkLabelInput.value = activeLink.label || "";
  activeLinkLabelInput.addEventListener("input", (event) => {
    const next = deriveWorkflowDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Workflow");
    next.links = next.links.map((link) =>
      link.id === activeLink.id ? { ...link, label: event.target.value } : link
    );
    syncEditorDraft(buildWorkflowContent(next));
  });

  const activeLinkPathLabel = document.createElement("label");
  activeLinkPathLabel.className = "composer-label";
  activeLinkPathLabel.textContent = "Active connection path";
  const activeLinkPathInput = document.createElement("input");
  activeLinkPathInput.type = "text";
  activeLinkPathInput.className = "workspace-slide-title-input";
  activeLinkPathInput.value = activeLink.from && activeLink.to ? `${activeLink.from} -> ${activeLink.to}` : "";
  activeLinkPathInput.addEventListener("input", (event) => {
    const next = deriveWorkflowDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Workflow");
    const [from = "", to = ""] = String(event.target.value || "").split("->").map((part) => part.trim());
    next.links = next.links.map((link) =>
      link.id === activeLink.id ? { ...link, from, to } : link
    );
    syncEditorDraft(buildWorkflowContent(next));
  });

  const stagesPanel = createEditorPanel("Stages", "Navigate the workflow like a real automation board.");
  stagesPanel.body.append(stageRail);
  stagesPanel.body.appendChild(
    createEditorMiniList(
      model.stages.map((stage) => ({
        id: stage.id,
        title: stage.label || "Stage",
        meta: stage.owner || "Hydria"
      })),
      activeStage.id,
      {
        onSelect: (stage) => {
          state.currentStructuredItemId = stage.id;
          renderWorkspace();
        }
      }
    )
  );
  sidebar.appendChild(stagesPanel.panel);

  const linksPanel = createEditorPanel("Connections", "Keep the path between stages explicit and editable.");
  linksPanel.body.append(linkRail);
  linksPanel.body.appendChild(
    createEditorMiniList(
      model.links.map((link) => ({
        id: link.id,
        title: link.label || "Link",
        meta: link.from && link.to ? `${link.from} -> ${link.to}` : "Undefined path"
      })),
      activeLink.id,
      {
        onSelect: (link) => {
          state.currentStructuredSubItemId = link.id;
          renderWorkspace();
        }
      }
    )
  );
  sidebar.appendChild(linksPanel.panel);

  const runPanel = createEditorPanel("Run lane", "Keep trigger, outputs and execution posture visible like an automation operator.");
  const runGrid = createStructuredInsightGrid([
    { label: "Trigger", value: model.trigger || "Manual", meta: "What wakes the flow" },
    { label: "Outputs", value: model.outputs.length || 0, meta: model.outputs[0] || "No output yet" },
    { label: "Automations", value: model.automations.length || 0, meta: model.automations[0] || "No rule yet" }
  ]);
  if (runGrid) {
    runPanel.body.appendChild(runGrid);
  }
  const runStrip = document.createElement("div");
  runStrip.className = "workspace-flow-chip-list";
  [
    model.trigger || "Manual run",
    `${model.stages.length} stages`,
    `${model.links.length} paths`,
    model.outputs[0] || "No output yet"
  ].forEach((label, index) => {
    const chip = document.createElement("span");
    chip.className = `workspace-flow-chip${index === 0 ? " active" : ""}`;
    chip.textContent = label;
    runStrip.appendChild(chip);
  });
  runPanel.body.appendChild(runStrip);
  sidebar.appendChild(runPanel.panel);

  const framingPanel = createEditorPanel("Workflow framing", "Set the title, objective and trigger for the whole automation.");
  framingPanel.body.append(titleLabel, titleInput, objectiveLabel, objectiveInput, triggerLabel, triggerInput);
  main.appendChild(framingPanel.panel);

  const boardPanel = createEditorPanel("Automation board", "Keep the active node and current path visible like a real workflow builder.");
  const boardShell = document.createElement("div");
  boardShell.className = "workspace-workflow-stage-shell";
  const boardHeader = document.createElement("div");
  boardHeader.className = "workspace-presentation-stage-header";
  const boardHeaderMeta = document.createElement("div");
  boardHeaderMeta.className = "workspace-code-toolbar-meta";
  const boardTitle = document.createElement("strong");
  boardTitle.textContent = activeStage.label || "Active stage";
  const boardHint = document.createElement("span");
  boardHint.className = "tiny";
  boardHint.textContent = `${activeStage.owner || "Hydria"} | ${activeLink.label || "Next"}`;
  boardHeaderMeta.append(boardTitle, boardHint);
  const boardChips = document.createElement("div");
  boardChips.className = "workspace-chip-list";
  [
    model.trigger || "Manual",
    `${model.stages.length} stages`,
    `${model.links.length} links`
  ].forEach((label, index) => {
    const chip = document.createElement("span");
    chip.className = `workspace-chip${index === 0 ? " active" : ""}`;
    chip.textContent = label;
    boardChips.appendChild(chip);
  });
  boardHeader.append(boardHeaderMeta, boardChips);
  const boardGrid = document.createElement("div");
  boardGrid.className = "workspace-document-context-grid";
  [
    {
      label: "Current stage note",
      value: activeStage.note || "Use the selected stage to explain what happens here."
    },
    {
      label: "Current connection",
      value: activeLink.from && activeLink.to ? `${activeLink.from} -> ${activeLink.to}` : "Select or create a link to make the path explicit."
    }
  ].forEach((item) => {
    const card = document.createElement("article");
    card.className = "workspace-document-context-card";
    const label = document.createElement("span");
    label.className = "tiny";
    label.textContent = item.label;
    const text = document.createElement("p");
    text.textContent = item.value;
    card.append(label, text);
    boardGrid.appendChild(card);
  });
  const boardPath = document.createElement("div");
  boardPath.className = "workspace-flow-chip-list";
  (model.links || []).slice(0, 4).forEach((link, index) => {
    const chip = document.createElement("span");
    chip.className = `workspace-flow-chip${link.id === activeLink.id || index === 0 ? " active" : ""}`;
    chip.textContent = link.from && link.to ? `${link.from} -> ${link.to}` : link.label || "Connection";
    boardPath.appendChild(chip);
  });
  if (!boardPath.childNodes.length) {
    const chip = document.createElement("span");
    chip.className = "workspace-flow-chip active";
    chip.textContent = "Add a connection to expose the path";
    boardPath.appendChild(chip);
  }
  const boardOutputs = document.createElement("div");
  boardOutputs.className = "workspace-document-context-grid";
  [
    {
      label: "Outputs",
      value: model.outputs.slice(0, 3).join(" | ") || "No workflow outputs declared yet."
    },
    {
      label: "Automation posture",
      value: model.automations.slice(0, 2).join(" | ") || "Manual review remains the current fallback."
    }
  ].forEach((item) => {
    const card = document.createElement("article");
    card.className = "workspace-document-context-card";
    const label = document.createElement("span");
    label.className = "tiny";
    label.textContent = item.label;
    const text = document.createElement("p");
    text.textContent = item.value;
    card.append(label, text);
    boardOutputs.appendChild(card);
  });
  boardShell.append(boardHeader, boardGrid, boardPath, boardOutputs);
  boardPanel.body.appendChild(boardShell);
  main.appendChild(boardPanel.panel);

  const stageEditorPanel = createEditorPanel("Active stage", "Edit the current step and its operating note.");
  stageEditorPanel.body.append(stageLabelLabel, stageLabelInput, stageOwnerLabel, stageOwnerInput, stageNoteLabel, stageNoteInput);
  main.appendChild(stageEditorPanel.panel);

  const automationPanel = createEditorPanel("Automation details", "Define actions, outputs and explicit links.");
  automationPanel.body.append(
    automationLabel,
    automationInput,
    outputsLabel,
    outputsInput,
    activeLinkLabel,
    activeLinkLabelInput,
    activeLinkPathLabel,
    activeLinkPathInput,
    linksLabel,
    linksInput
  );
  main.appendChild(automationPanel.panel);

  layout.append(sidebar, main);
  shell.append(toolbar, workflowInsightGrid, workflowHero, layout);
  container.appendChild(shell);
}

function renderDesignStructuredEditor(container) {
  const model = deriveDesignDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Design");
  if (!state.currentStructuredItemId || !model.frames.some((frame) => frame.id === state.currentStructuredItemId)) {
    state.currentStructuredItemId = model.frames[0]?.id || "";
  }
  const activeFrameIndex = Math.max(
    0,
    model.frames.findIndex((frame) => frame.id === state.currentStructuredItemId)
  );
  const activeFrame =
    model.frames[activeFrameIndex] ||
    model.frames[0] ||
    { id: "frame-1", name: "", goal: "", blocks: normalizeDesignBlocks(["Header", "Hero", "Content", "CTA"]) };
  if (
    !state.currentStructuredSubItemId ||
    !Array.isArray(activeFrame.blocks) ||
    !activeFrame.blocks.some((block) => block.id === state.currentStructuredSubItemId)
  ) {
    state.currentStructuredSubItemId = activeFrame.blocks?.[0]?.id || "";
  }
  const activeBlockIndex = Math.max(
    0,
    (activeFrame.blocks || []).findIndex((block) => block.id === state.currentStructuredSubItemId)
  );
  const activeBlock =
    (activeFrame.blocks || [])[activeBlockIndex] ||
    normalizeDesignBlocks(["Block 1"])[0];
  const shell = document.createElement("div");
  shell.className = "workspace-app-builder workspace-design-editor";

  const toolbar = document.createElement("div");
  toolbar.className = "workspace-structured-toolbar";
  const stats = document.createElement("div");
  stats.className = "workspace-structured-stats";
  stats.textContent = `${model.frames.length} frames · ${(activeFrame.blocks || []).length} blocks · ${model.palette.length} colors`;
  const actions = document.createElement("div");
  actions.className = "workspace-structured-actions";

  const addColorButton = document.createElement("button");
  addColorButton.type = "button";
  addColorButton.className = "ghost-button";
  addColorButton.textContent = "Add color";
  addColorButton.addEventListener("click", () => {
    const next = deriveDesignDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Design");
    next.palette.push({ name: `Color ${next.palette.length + 1}`, value: "#d8d2ca" });
    syncEditorDraft(buildDesignContent(next), { refreshWorkspace: true });
  });

  const addFrameButton = document.createElement("button");
  addFrameButton.type = "button";
  addFrameButton.className = "ghost-button";
  addFrameButton.textContent = "Add frame";
  addFrameButton.addEventListener("click", () => {
    const next = deriveDesignDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Design");
    const frame = {
      id: `frame-${next.frames.length + 1}`,
      name: `Frame ${next.frames.length + 1}`,
      goal: "",
      blocks: normalizeDesignBlocks(["Header", "Hero", "Content", "CTA"])
    };
    next.frames.push(frame);
    state.currentStructuredItemId = frame.id;
    syncEditorDraft(buildDesignContent(next), { refreshWorkspace: true });
  });

  const removeFrameButton = document.createElement("button");
  removeFrameButton.type = "button";
  removeFrameButton.className = "ghost-button";
  removeFrameButton.textContent = "Remove frame";
  removeFrameButton.disabled = model.frames.length <= 1;
  removeFrameButton.addEventListener("click", () => {
    const next = deriveDesignDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Design");
    next.frames = next.frames.filter((_, index) => index !== activeFrameIndex);
    state.currentStructuredItemId = next.frames[Math.max(0, activeFrameIndex - 1)]?.id || "";
    syncEditorDraft(buildDesignContent(next), { refreshWorkspace: true });
  });

  const addBlockButton = document.createElement("button");
  addBlockButton.type = "button";
  addBlockButton.className = "ghost-button";
  addBlockButton.textContent = "Add block";
  addBlockButton.addEventListener("click", () => {
    const next = deriveDesignDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Design");
    const frame = next.frames[activeFrameIndex];
    if (!frame) {
      return;
    }
    frame.blocks = [
      ...(frame.blocks || []),
      normalizeDesignBlocks([`Block ${(frame.blocks || []).length + 1}`])[0]
    ];
    state.currentStructuredSubItemId = frame.blocks[frame.blocks.length - 1]?.id || "";
    syncEditorDraft(buildDesignContent(next), { refreshWorkspace: true });
  });

  const removeBlockButton = document.createElement("button");
  removeBlockButton.type = "button";
  removeBlockButton.className = "ghost-button";
  removeBlockButton.textContent = "Remove block";
  removeBlockButton.disabled = (activeFrame.blocks || []).length <= 1;
  removeBlockButton.addEventListener("click", () => {
    const next = deriveDesignDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Design");
    const frame = next.frames[activeFrameIndex];
    if (!frame) {
      return;
    }
    frame.blocks = (frame.blocks || []).filter((block) => block.id !== activeBlock.id);
    state.currentStructuredSubItemId = frame.blocks[Math.max(0, activeBlockIndex - 1)]?.id || "";
    syncEditorDraft(buildDesignContent(next), { refreshWorkspace: true });
  });

  const moveBlockLeftButton = document.createElement("button");
  moveBlockLeftButton.type = "button";
  moveBlockLeftButton.className = "ghost-button";
  moveBlockLeftButton.textContent = "Block left";
  moveBlockLeftButton.disabled = activeBlockIndex <= 0;
  moveBlockLeftButton.addEventListener("click", () => {
    moveDesignBlock(activeFrame.id, activeBlock.id, -1);
  });

  const moveBlockRightButton = document.createElement("button");
  moveBlockRightButton.type = "button";
  moveBlockRightButton.className = "ghost-button";
  moveBlockRightButton.textContent = "Block right";
  moveBlockRightButton.disabled = activeBlockIndex >= (activeFrame.blocks || []).length - 1;
  moveBlockRightButton.addEventListener("click", () => {
    moveDesignBlock(activeFrame.id, activeBlock.id, 1);
  });

  actions.append(
    addColorButton,
    addFrameButton,
    removeFrameButton,
    addBlockButton,
    removeBlockButton,
    moveBlockLeftButton,
    moveBlockRightButton
  );
  toolbar.append(stats, actions);
  const designInsightGrid = createStructuredInsightGrid([
    { label: "Design", value: model.title || "Hydria Design", meta: model.brief || "Shape the interaction flow, not just static screens" },
    { label: "Frames", value: model.frames.length, meta: activeFrame.name || "No active frame" },
    { label: "Blocks", value: (activeFrame.blocks || []).length, meta: activeBlock.label || "No active block" },
    { label: "Palette", value: model.palette.length, meta: model.palette[0]?.name || "No design token yet" }
  ]);
  const layout = document.createElement("div");
  layout.className = "workspace-editor-layout";
  const sidebar = document.createElement("aside");
  sidebar.className = "workspace-editor-sidebar";
  const main = document.createElement("div");
  main.className = "workspace-editor-main";

  const titleLabel = document.createElement("label");
  titleLabel.className = "composer-label";
  titleLabel.textContent = "Design title";
  const titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.className = "workspace-slide-title-input";
  titleInput.value = model.title;
  titleInput.addEventListener("input", (event) => {
    const next = deriveDesignDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Design");
    next.title = event.target.value;
    syncEditorDraft(buildDesignContent(next));
  });

  const briefLabel = document.createElement("label");
  briefLabel.className = "composer-label";
  briefLabel.textContent = "Design brief";
  const briefInput = document.createElement("textarea");
  briefInput.rows = 3;
  briefInput.className = "workspace-slide-body-input";
  briefInput.value = model.brief;
  briefInput.addEventListener("input", (event) => {
    const next = deriveDesignDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Design");
    next.brief = event.target.value;
    syncEditorDraft(buildDesignContent(next));
  });

  const frameListPanel = createEditorPanel("Frames", "Switch screen quickly and keep the flow visible from the sidebar.");
  frameListPanel.body.append(
    createEditorMiniList(
      model.frames.map((frame) => ({
        id: frame.id,
        title: frame.name || "Frame",
        meta: frame.goal || "No frame goal yet"
      })),
      activeFrame.id,
      {
        emptyLabel: "No frames yet.",
        onSelect: (frame) => {
          state.currentStructuredItemId = frame.id;
          state.currentStructuredSubItemId = "";
          renderWorkspace();
        }
      }
    )
  );
  sidebar.appendChild(frameListPanel.panel);

  const blockListPanel = createEditorPanel("Blocks", "Focus a single block and move it like a real layout system.");
  blockListPanel.body.append(
    createEditorMiniList(
      (activeFrame.blocks || []).map((block) => ({
        id: block.id,
        title: block.label || "Block",
        meta: `${Math.round(Number(block.x) || 0)},${Math.round(Number(block.y) || 0)} · ${Math.round(Number(block.w) || 0)}×${Math.round(Number(block.h) || 0)}`
      })),
      activeBlock.id,
      {
        emptyLabel: "No blocks yet.",
        onSelect: (block) => {
          state.currentStructuredSubItemId = block.id;
          renderWorkspace();
        }
      }
    )
  );
  sidebar.appendChild(blockListPanel.panel);

  const designSystemPanel = createEditorPanel("System tokens", "Keep palette and component vocabulary visible while you shape the wireframes.");
  designSystemPanel.body.append(
    createEditorMiniList(
      (model.palette || []).map((token, index) => ({
        id: `color-${index + 1}`,
        title: token.name || `Color ${index + 1}`,
        meta: token.value || ""
      })),
      "",
      { emptyLabel: "No colors yet." }
    )
  );
  if ((model.components || []).length) {
    const componentCloud = document.createElement("div");
    componentCloud.className = "workspace-chip-list";
    (model.components || []).forEach((component) => {
      const chip = document.createElement("span");
      chip.className = "workspace-chip";
      chip.textContent = component;
      componentCloud.appendChild(chip);
    });
    designSystemPanel.body.appendChild(componentCloud);
  }
  sidebar.appendChild(designSystemPanel.panel);

  const paletteLabel = document.createElement("label");
  paletteLabel.className = "composer-label";
  paletteLabel.textContent = "Palette (Name | Color)";
  const paletteInput = document.createElement("textarea");
  paletteInput.rows = 5;
  paletteInput.className = "workspace-slide-body-input";
  paletteInput.value = model.palette.map((token) => [token.name, token.value].join(" | ")).join("\n");
  paletteInput.addEventListener("input", (event) => {
    const next = deriveDesignDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Design");
    next.palette = normalizeEditorText(event.target.value)
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [name = "", value = ""] = line.split("|").map((part) => part.trim());
        return { name, value };
      });
    syncEditorDraft(buildDesignContent(next));
  });

  const framesLabel = document.createElement("label");
  framesLabel.className = "composer-label";
  framesLabel.textContent = "Frames (Name | Goal)";
  const framesInput = document.createElement("textarea");
  framesInput.rows = 6;
  framesInput.className = "workspace-slide-body-input";
  framesInput.value = model.frames.map((frame) => [frame.name, frame.goal].join(" | ")).join("\n");
  framesInput.addEventListener("input", (event) => {
    const next = deriveDesignDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Design");
    const previousFrames = next.frames.map((frame) => ({ ...frame }));
    next.frames = normalizeEditorText(event.target.value)
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => {
        const [name = "", goal = ""] = line.split("|").map((part) => part.trim());
        return {
          id: `frame-${index + 1}`,
          name,
          goal,
          blocks: previousFrames[index]?.blocks?.length
            ? previousFrames[index].blocks
            : normalizeDesignBlocks(["Header", "Hero", "Content", "CTA"])
        };
      });
    syncEditorDraft(buildDesignContent(next));
  });

  const activeFrameNameLabel = document.createElement("label");
  activeFrameNameLabel.className = "composer-label";
  activeFrameNameLabel.textContent = "Active frame name";
  const activeFrameNameInput = document.createElement("input");
  activeFrameNameInput.type = "text";
  activeFrameNameInput.className = "workspace-slide-title-input";
  activeFrameNameInput.value = activeFrame.name || "";
  activeFrameNameInput.addEventListener("input", (event) => {
    const next = deriveDesignDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Design");
    next.frames = next.frames.map((frame, index) =>
      index === activeFrameIndex ? { ...frame, name: event.target.value } : frame
    );
    syncEditorDraft(buildDesignContent(next));
  });

  const activeFrameGoalLabel = document.createElement("label");
  activeFrameGoalLabel.className = "composer-label";
  activeFrameGoalLabel.textContent = "Active frame goal";
  const activeFrameGoalInput = document.createElement("textarea");
  activeFrameGoalInput.rows = 4;
  activeFrameGoalInput.className = "workspace-slide-body-input";
  activeFrameGoalInput.value = activeFrame.goal || "";
  activeFrameGoalInput.addEventListener("input", (event) => {
    const next = deriveDesignDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Design");
    next.frames = next.frames.map((frame, index) =>
      index === activeFrameIndex ? { ...frame, goal: event.target.value } : frame
    );
    syncEditorDraft(buildDesignContent(next));
  });

  const activeFrameBlocksLabel = document.createElement("label");
  activeFrameBlocksLabel.className = "composer-label";
  activeFrameBlocksLabel.textContent = "Active frame blocks";
  const activeFrameBlocksInput = document.createElement("textarea");
  activeFrameBlocksInput.rows = 5;
  activeFrameBlocksInput.className = "workspace-slide-body-input";
  activeFrameBlocksInput.value = (activeFrame.blocks || []).map((block) => block.label).join("\n");
  activeFrameBlocksInput.addEventListener("input", (event) => {
    const next = deriveDesignDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Design");
    next.frames = next.frames.map((frame, index) =>
      index === activeFrameIndex
        ? {
            ...frame,
            blocks: normalizeEditorText(event.target.value)
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean)
              .map((label, blockIndex) => ({
                ...(frame.blocks?.[blockIndex] || normalizeDesignBlocks([label])[0]),
                id: frame.blocks?.[blockIndex]?.id || `block-${blockIndex + 1}`,
                label
              }))
          }
        : frame
    );
    syncEditorDraft(buildDesignContent(next));
  });

  const activeBlockLabel = document.createElement("label");
  activeBlockLabel.className = "composer-label";
  activeBlockLabel.textContent = "Active block";
  const activeBlockInput = document.createElement("input");
  activeBlockInput.type = "text";
  activeBlockInput.className = "workspace-slide-title-input";
  activeBlockInput.value = activeBlock.label || "";
  activeBlockInput.addEventListener("input", (event) => {
    const next = deriveDesignDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Design");
    next.frames = next.frames.map((frame, index) => {
      if (index !== activeFrameIndex) {
        return frame;
      }
      const blocks = [...(frame.blocks || [])];
      blocks[activeBlockIndex] = {
        ...(blocks[activeBlockIndex] || normalizeDesignBlocks([event.target.value])[0]),
        label: event.target.value
      };
      return {
        ...frame,
        blocks
      };
    });
    syncEditorDraft(buildDesignContent(next));
  });

  const componentsLabel = document.createElement("label");
  componentsLabel.className = "composer-label";
  componentsLabel.textContent = "Components";
  const componentsInput = document.createElement("textarea");
  componentsInput.rows = 4;
  componentsInput.className = "workspace-slide-body-input";
  componentsInput.value = model.components.join("\n");
  componentsInput.addEventListener("input", (event) => {
    const next = deriveDesignDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Design");
    next.components = normalizeEditorText(event.target.value).split("\n").map((line) => line.trim()).filter(Boolean);
    syncEditorDraft(buildDesignContent(next));
  });

  const activeBlockPositionGrid = document.createElement("div");
  activeBlockPositionGrid.className = "workspace-editor-field-grid";
  [
    {
      label: "X",
      value: Math.round(Number(activeBlock.x) || 0),
      min: 0,
      apply(nextValue) {
        updateDesignBlockPosition(activeFrame.id, activeBlock.id, nextValue, activeBlock.y);
      }
    },
    {
      label: "Y",
      value: Math.round(Number(activeBlock.y) || 0),
      min: 0,
      apply(nextValue) {
        updateDesignBlockPosition(activeFrame.id, activeBlock.id, activeBlock.x, nextValue);
      }
    },
    {
      label: "Width",
      value: Math.round(Number(activeBlock.w) || 160),
      min: 80,
      apply(nextValue) {
        resizeDesignBlock(activeFrame.id, activeBlock.id, nextValue - (Number(activeBlock.w) || 160), 0);
      }
    },
    {
      label: "Height",
      value: Math.round(Number(activeBlock.h) || 36),
      min: 24,
      apply(nextValue) {
        resizeDesignBlock(activeFrame.id, activeBlock.id, 0, nextValue - (Number(activeBlock.h) || 36));
      }
    }
  ].forEach((field) => {
    const wrap = document.createElement("label");
    wrap.className = "workspace-editor-inline-field";
    const label = document.createElement("span");
    label.className = "composer-label";
    label.textContent = field.label;
    const input = document.createElement("input");
    input.type = "number";
    input.min = String(field.min || 0);
    input.className = "workspace-slide-title-input";
    input.value = String(field.value);
    input.addEventListener("input", (event) => {
      const nextValue = Number(event.target.value);
      if (!Number.isFinite(nextValue)) {
        return;
      }
      field.apply(nextValue);
    });
    wrap.append(label, input);
    activeBlockPositionGrid.appendChild(wrap);
  });

  const briefPanel = createEditorPanel("Design brief", "Keep the product framing, palette and component vocabulary aligned.");
  briefPanel.body.append(
    titleLabel,
    titleInput,
    briefLabel,
    briefInput,
    paletteLabel,
    paletteInput,
    componentsLabel,
    componentsInput
  );
  main.appendChild(briefPanel.panel);

  const activeFramePanel = createEditorPanel("Active frame", "Set the intent of the current screen before moving the lower-level blocks.");
  activeFramePanel.body.append(
    activeFrameNameLabel,
    activeFrameNameInput,
    activeFrameGoalLabel,
    activeFrameGoalInput,
    activeFrameBlocksLabel,
    activeFrameBlocksInput,
    framesLabel,
    framesInput
  );
  main.appendChild(activeFramePanel.panel);

  const activeBlockPanel = createEditorPanel("Active block", "Fine-tune the selected layout element like a real wireframe editor.");
  activeBlockPanel.body.append(
    activeBlockLabel,
    activeBlockInput,
    activeBlockPositionGrid
  );
  main.appendChild(activeBlockPanel.panel);

  shell.append(toolbar);
  if (designInsightGrid) {
    shell.appendChild(designInsightGrid);
  }
  layout.append(sidebar, main);
  shell.appendChild(layout);
  container.appendChild(shell);
}

function renderStructuredEditor() {
  const container = el["workspace-structured-editor"];
  if (!container) {
    return;
  }

  container.innerHTML = "";
  const isStructured = usesWholeFileStructuredEditing();
  container.classList.toggle("hidden", !isStructured);
  el["work-object-editor"]?.classList.toggle("hidden", isStructured);

  if (isDatasetWorkspace()) {
    renderDatasetStructuredEditor(container);
    return;
  }

  if (isDocumentWorkspace()) {
    renderDocumentStructuredEditor(container);
    return;
  }

  if (isDevelopmentWorkspace()) {
    renderDevelopmentStructuredEditor(container);
    return;
  }

  if (isPresentationWorkspace()) {
    renderPresentationStructuredEditor(container);
    return;
  }

  if (isDashboardWorkspace()) {
    renderDashboardStructuredEditor(container);
    return;
  }

  if (isWorkflowWorkspace()) {
    renderWorkflowStructuredEditor(container);
    return;
  }

  if (isDesignWorkspace()) {
    renderDesignStructuredEditor(container);
    return;
  }

  if (isAppConfigWorkspace()) {
    renderAppConfigStructuredEditor(container);
  }
}

function renderWorkspaceLauncher(hasVisibleWorkspace = false) {
  const container = el["workspace-launcher"];
  if (!container) {
    return;
  }
  container.classList.toggle("hidden", hasVisibleWorkspace);
  if (hasVisibleWorkspace) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = "";
  const header = document.createElement("div");
  header.className = "workspace-launcher-header";
  const title = document.createElement("div");
  const heading = document.createElement("h3");
  heading.textContent = "Open a workspace";
  const subtitle = document.createElement("p");
  subtitle.textContent = "Pick a blank workspace to start working immediately.";
  title.append(heading, subtitle);
  header.appendChild(title);

  const grid = document.createElement("div");
  grid.className = "workspace-launcher-grid";

  const items = [
    { kind: "document", family: "document_knowledge", label: "Docs", hint: "Write, summarize, structure." },
    { kind: "dataset", family: "data_spreadsheet", label: "Sheets", hint: "Tables, CSV, quick analysis." },
    { kind: "presentation", family: "presentation", label: "Slides", hint: "Pitch decks, reporting." },
    { kind: "dashboard", family: "analytics_dashboard", label: "Dashboard", hint: "KPI and charts." },
    { kind: "workflow", family: "workflow_automation", label: "Automation", hint: "Flows and triggers." },
    { kind: "project", family: "app_builder", label: "App Builder", hint: "Build a live app." },
    { kind: "design", family: "design", label: "Whiteboard", hint: "Layouts and brainstorming." },
    { kind: "code", family: "development", label: "Code Studio", hint: "Edit code directly." }
  ];

  items.forEach((item) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "workspace-launcher-card";
    const label = document.createElement("strong");
    label.textContent = item.label;
    const hint = document.createElement("span");
    hint.textContent = item.hint;
    card.append(label, hint);
    card.addEventListener("click", () => {
      createBlankWorkspace(item.kind, item.family, item.label).catch(handleError);
    });
    grid.appendChild(card);
  });

  container.append(header, grid);
}

function renderWorkspace() {
  const workObject = state.currentWorkObject;
  const project = state.currentWorkspace?.project || null;
  const hasVisibleWorkspace = Boolean(workObject || project);
  const workspaceLens = currentWorkspaceLens();
  const workspaceFamilyId = currentWorkspaceFamilyId();
  const isDocumentCloneWorkspace = workspaceFamilyId === "document_knowledge";
  const showDocumentProjectContext = !isDocumentCloneWorkspace || state.documentProjectContextVisible;

  ensureFileMatchesDimension();
  syncWorkspaceSlices();
  ensureCurrentSurface();

  const filePath = state.currentWorkObjectFile || workObject?.primaryFile || "";
  const surfaceModel = currentSurfaceModel();
  const dimensions = project?.dimensions || workObject?.projectDimensions || [];

  el["work-object-empty"].classList.toggle("hidden", Boolean(workObject));
  if (el["workspace-layout"]) {
    el["workspace-layout"].classList.toggle("hidden", !hasVisibleWorkspace);
  }
  renderWorkspaceLauncher(hasVisibleWorkspace);
  el["work-object-kind"].textContent = workObject?.objectKind || workObject?.kind || "None";
  if (el["workspace-panel-root"]) {
    el["workspace-panel-root"].dataset.mode = state.workspaceMode;
    el["workspace-panel-root"].dataset.kind = workspaceLens.kind || "creation";
    el["workspace-panel-root"].dataset.family = currentWorkspaceFamilyId() || "generic";
  }
  if (el["assistant-dock"]) {
    el["assistant-dock"].dataset.kind = workspaceLens.kind || "creation";
    el["assistant-dock"].dataset.family = currentWorkspaceFamilyId() || "generic";
  }
  if (el["workspace-context-label"]) {
    el["workspace-context-label"].classList.toggle("hidden", !hasVisibleWorkspace);
  }
  if (el["workspace-title"]) {
    el["workspace-title"].textContent =
      workObject?.title || project?.name || "Nothing open yet";
  }
  if (el["workspace-subtitle"]) {
    el["workspace-subtitle"].textContent = hasVisibleWorkspace
      ? state.workspaceMode === "edit"
        ? "Change what is open on the right, or ask Hydria to continue the same project below."
        : friendlyWorkspaceSubtitle(project, workObject, workspaceLens)
      : "Open a blank workspace or ask Hydria to create something. It will open here automatically.";
  }
  if (el["workspace-operating-strip"]) {
    el["workspace-operating-strip"].classList.toggle("hidden", !hasVisibleWorkspace || state.workspaceMode === "edit");
  }
  if (el["workspace-operating-mode"]) {
    el["workspace-operating-mode"].textContent = workspaceLens.kindLabel;
  }
  if (el["workspace-operating-role"]) {
    el["workspace-operating-role"].textContent = workspaceLens.scopeLabel;
  }
  if (el["workspace-operating-risk"]) {
    el["workspace-operating-risk"].textContent = workspaceLens.nextStep;
  }
  if (el["assistant-role-heading"]) {
    el["assistant-role-heading"].textContent = workspaceLens.assistantTitle;
  }
  if (el["assistant-helper-text"]) {
    el["assistant-helper-text"].textContent = workspaceLens.assistantHelper;
  }
  if (el["prompt-input"]) {
    el["prompt-input"].placeholder = hasVisibleWorkspace
      ?workspaceLens.promptPlaceholder
      : "Describe what you want Hydria to create.";
  }
  if (el["assistant-status-text"] && !state.loading) {
    el["assistant-status-text"].textContent = hasVisibleWorkspace
      ?workspaceLens.assistantStatus
      : "Tell Hydria what you want to create, or open a blank workspace above.";
  }
  applyWorkspaceLabels();
  if (el["workspace-view-status"]) {
    el["workspace-view-status"].textContent = currentPreviewSummary();
  }
  if (el["workspace-project-context-toggle"]) {
    el["workspace-project-context-toggle"].classList.toggle("hidden", !isDocumentCloneWorkspace || !hasVisibleWorkspace);
    el["workspace-project-context-toggle"].textContent = state.documentProjectContextVisible
      ? "Hide project"
      : "Show project";
  }
  el["active-work-object-badge"].textContent = workObject
    ?`${workspaceLens.kindLabel}: ${currentScopeLabel()}`
    : "No active project yet";

  el["workspace-project-badge"].textContent = project
    ?`Project: ${project.name}`
    : "No active project";

  renderMetaStack(el["workspace-project-meta"], [
    workObject?.workspaceFamilyLabel ? { label: `Workspace · ${workObject.workspaceFamilyLabel}` } : null,
    project?.workObjectCount ? { label: `${project.workObjectCount} linked objects` } : null,
    workObject?.nextActionHint ? { label: workObject.nextActionHint } : null
  ]);
  renderTokenList(
    el["workspace-dimensions"],
    (project?.workspaceFamilies || []).length
      ? (project.workspaceFamilies || []).slice(0, 5).map((family) => friendlyWorkspaceFamilyLabel(family))
      : project?.dimensions || []
  );
  renderWorkspaceBreadcrumb(el["workspace-breadcrumb"], [
    project?.name ?{ label: "Project", value: project.name } : null,
    workObject?.title ?{ label: "Item", value: workObject.title } : null,
    filePath ?{ label: "Page", value: friendlyFileLabel(filePath) } : null,
    currentSection() ?{ label: "Part", value: currentSection().title } : null,
    currentBlock() ?{ label: "Detail", value: currentBlock().title } : null
  ]);
  renderWorkspaceProjectMap(el["workspace-project-map"], {
    project,
    workObjects: state.currentWorkspace?.workObjects || [],
    currentWorkObjectId: state.currentWorkObjectId,
    onSelectWorkObject: (workObjectId) => {
      const target =
        (state.currentWorkspace?.workObjects || []).find((item) => item.id === workObjectId) ||
        state.workObjects.find((item) => item.id === workObjectId);
      if (!target) {
        return;
      }
      selectWorkObject(target.id, preferredOpenPath(target)).catch(handleError);
    }
  });
  el["workspace-project-map"]?.classList.toggle(
    "hidden",
    state.workspaceMode === "edit" ||
      !showDocumentProjectContext ||
      !hasVisibleWorkspace ||
      (state.currentWorkspace?.workObjects || []).length <= 1
  );
  el["workspace-breadcrumb"]?.classList.toggle("hidden", state.workspaceMode === "edit" || !showDocumentProjectContext);
  el["workspace-project-meta"]?.classList.toggle("hidden", state.workspaceMode === "edit" || !showDocumentProjectContext);
  el["workspace-dimensions"]?.classList.toggle("hidden", state.workspaceMode === "edit" || !showDocumentProjectContext);
  const actionGuide = currentWorkspaceActionGuide();
  if (el["workspace-action-guide"]) {
    el["workspace-action-guide"].classList.toggle(
      "hidden",
      !(workObject && filePath) || state.workspaceMode === "edit" || isDocumentCloneWorkspace
    );
  }
  if (el["workspace-action-guide-title"]) {
    el["workspace-action-guide-title"].textContent = actionGuide.title;
  }
  if (el["workspace-action-guide-text"]) {
    el["workspace-action-guide-text"].textContent = actionGuide.text;
  }
  if (el["workspace-action-guide-steps"]) {
    el["workspace-action-guide-steps"].innerHTML = "";
    actionGuide.steps.forEach((label, index) => {
      const chip = document.createElement("span");
      chip.className = `workspace-flow-chip${index === 0 ? " active" : ""}`;
      chip.textContent = label;
      el["workspace-action-guide-steps"].appendChild(chip);
    });
  }
  if (el["workspace-edit-now-button"]) {
    el["workspace-edit-now-button"].textContent = actionGuide.editLabel;
    el["workspace-edit-now-button"].disabled = !workObject || !filePath;
  }
  if (el["workspace-ask-hydria-button"]) {
    el["workspace-ask-hydria-button"].disabled = !workObject;
  }
  if (el["workspace-save-now-button"]) {
    el["workspace-save-now-button"].disabled = !workObject || !filePath;
  }
  renderWorkspaceModeNav();
  renderWorkspaceSwitcher(hasVisibleWorkspace);
  if (el["workspace-dimension-nav"]?.parentElement) {
    el["workspace-dimension-nav"].parentElement.classList.toggle(
      "hidden",
      isDocumentCloneWorkspace || dimensions.length <= 1
    );
  }
  renderWorkspaceDimensionNav(
    el["workspace-dimension-nav"],
    dimensions,
    state.currentDimension,
    (dimension) => {
      state.currentDimension = dimension;
      const nextFiles = getFilteredEditableFiles(state.currentWorkObject, state.currentDimension);
      if (nextFiles.length && !nextFiles.includes(state.currentWorkObjectFile)) {
        selectWorkObject(state.currentWorkObjectId, nextFiles[0], {
          syncProject: false,
          preserveDimension: true
        }).catch(handleError);
        return;
      }
      state.currentSectionId = "";
      state.currentBlockId = "";
        renderWorkspace();
      }
    );
  renderWorkspaceSurfaceNav(
    el["workspace-surface-nav"],
    surfaceModel?.availableSurfaces || [],
    state.currentSurfaceId,
    (surfaceId) => {
      state.currentSurfaceId = surfaceId;
      if (surfaceId === "edit") {
        setWorkspaceMode("edit");
      } else {
        setWorkspaceMode("view");
      }
      renderWorkspace();
      if (surfaceId === "edit") {
        el["work-object-editor"].focus();
      }
    }
  );

  renderMetaStack(el["work-object-meta"], []);

  const structureLabels = currentWorkspaceStructureLabels();

  renderWorkspaceObjectList(
    el["workspace-object-list"],
    workspaceWorkObjects(),
    state.currentWorkObjectId,
    (nextWorkObject) => selectWorkObject(nextWorkObject.id, preferredOpenPath(nextWorkObject)).catch(handleError)
  );

  const editableFiles = getFilteredEditableFiles(workObject, state.currentDimension);
  el["work-object-file-select"].innerHTML = "";
  if (editableFiles.length) {
    renderSelect(
      el["work-object-file-select"],
      editableFiles,
      filePath,
      (entryPath) => friendlyFileLabel(entryPath),
      (entryPath) => entryPath
    );
    el["work-object-file-select"].disabled = false;
  } else {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No editable file";
    el["work-object-file-select"].appendChild(option);
    el["work-object-file-select"].disabled = true;
  }
  if (el["work-object-file-select"]?.parentElement) {
    el["work-object-file-select"].parentElement.classList.toggle("hidden", editableFiles.length <= 1);
  }

  renderWorkspaceSectionList(
    el["workspace-section-list"],
    state.currentSections,
    state.currentSectionId,
    (sectionId) => {
      state.currentSectionId = sectionId;
      state.currentBlockId = "";
      syncWorkspaceSlices();
      updateEditorValue();
      renderWorkspace();
    },
    {
      rootLabel: structureLabels.sectionRootLabel,
      rootMeta: structureLabels.sectionRootMeta,
      itemMetaLabel: structureLabels.sectionItemMeta
    }
  );
  if (el["workspace-section-list"]?.parentElement) {
    const hideSections =
      isDatasetWorkspace() ||
      isAppConfigWorkspace() ||
      isDashboardWorkspace() ||
      isWorkflowWorkspace() ||
      isDesignWorkspace() ||
      state.currentSections.length <= 1;
    el["workspace-section-list"].parentElement.classList.toggle("hidden", hideSections);
  }

  renderWorkspaceBlockList(
    el["workspace-block-list"],
    state.currentBlocks,
    state.currentBlockId,
    (blockId) => {
      state.currentBlockId = blockId;
      updateEditorValue();
      renderWorkspace();
    },
    {
      rootLabel: structureLabels.blockRootLabel,
      rootMeta: structureLabels.blockRootMeta,
      itemMetaLabel: structureLabels.blockItemMeta,
      emptyLabel: structureLabels.emptyBlockText
    }
  );
  if (el["workspace-block-list"]?.parentElement) {
    const hideBlocks =
      isDatasetWorkspace() ||
      isPresentationWorkspace() ||
      isAppConfigWorkspace() ||
      isDashboardWorkspace() ||
      isWorkflowWorkspace() ||
      isDesignWorkspace() ||
      state.currentBlocks.length <= 1;
    el["workspace-block-list"].parentElement.classList.toggle("hidden", hideBlocks);
  }

  refreshPreviewPane();
  renderStructuredEditor();

  el["work-object-editor"].disabled = !workObject || !filePath;
  el["save-work-object-button"].disabled = !workObject || !filePath;
  if (el["workspace-save-button"]) {
    el["workspace-save-button"].disabled = !workObject || !filePath || !state.editorDirty;
    el["workspace-save-button"].textContent = state.editorDirty ?"Save" : "Saved";
  }
  el["work-object-improve-prompt"].disabled = !workObject || !filePath;
  el["improve-work-object-button"].disabled = !workObject || !filePath;
  el["work-object-editor"].placeholder = workObject
    ?isDatasetWorkspace()
      ?"Edit the table directly."
      : isPresentationWorkspace()
        ?"Edit the selected slide."
        : isDashboardWorkspace()
          ?"Edit the dashboard model directly."
          : isWorkflowWorkspace()
            ?"Edit the workflow directly."
            : isDesignWorkspace()
              ?"Edit the design model directly."
        : isAppConfigWorkspace()
          ?"Shape the app builder settings here."
        : `Edit ${currentScopeLabel().toLowerCase()} here.`
    : "Nothing editable is selected yet.";
  el["work-object-improve-prompt"].placeholder = currentBlock()
    ?"Ex: make this part more convincing"
    : isDatasetWorkspace()
      ?"Ex: add a useful summary column"
      : isPresentationWorkspace()
        ?"Ex: make this slide sharper and more persuasive"
        : isDashboardWorkspace()
          ?"Ex: add better KPIs and one clearer trend"
          : isWorkflowWorkspace()
            ?"Ex: simplify this flow and add one automation rule"
            : isDesignWorkspace()
              ?"Ex: make this wireframe cleaner and more premium"
        : isAppConfigWorkspace()
          ?"Ex: make this app more useful for meal planning"
      : currentSection()
        ?"Ex: clarify this section and add an example"
        : "Ex: make this content clearer and stronger";

  updateEditorValue();
}

function updateLastRun(result = null) {
  state.lastRun = result;
  if (result) {
    renderRunDetails(result, el.details);
  }
  setPillsFromResult(result);
}

function mergeWorkObject(workObject = null) {
  if (!workObject?.id) {
    return;
  }

  const index = state.workObjects.findIndex((item) => item.id === workObject.id);
  if (index >= 0) {
    state.workObjects[index] = { ...state.workObjects[index], ...workObject };
  } else {
    state.workObjects.unshift(workObject);
  }
}

async function loadProjects() {
  if (!state.currentUserId) {
    state.projects = [];
    renderProjects();
    return;
  }

  const payload = await apiClient.listProjects(state.currentUserId, state.currentConversationId);
  state.projects = payload.projects || [];
  renderProjects();
}

async function loadWorkObjects() {
  if (!state.currentUserId) {
    state.workObjects = [];
    renderWorkObjects();
    return;
  }

  const payload = await apiClient.listWorkObjects(state.currentUserId, state.currentConversationId);
  state.workObjects = payload.workObjects || [];
  renderWorkObjects();
}

async function loadMessages() {
  if (!state.currentConversationId) {
    state.messages = [];
    renderMessages();
    return;
  }

  const payload = await apiClient.getMessages(state.currentConversationId);
  state.messages = payload.messages || [];
  renderMessages();
}

async function loadPreferences() {
  if (!state.currentUserId) {
    state.preferences = {};
    renderPreferences();
    return;
  }

  const payload = await apiClient.getPreferences(state.currentUserId);
  state.preferences = payload.preferences || {};
  renderPreferences();
}

async function ensureConversation() {
  if (state.currentConversationId) {
    return state.currentConversationId;
  }

  const title = `Workspace ${new Date().toLocaleString()}`;
  const payload = await apiClient.createConversation(state.currentUserId, title);
  const conversation = payload.conversation;
  state.conversations.unshift(conversation);
  renderConversations();
  if (state.currentProjectId) {
    sessionStore.linkConversationToProject(state.currentProjectId, conversation.id);
    await selectConversation(conversation.id, { preserveProject: true });
  } else {
    await selectConversation(conversation.id);
  }
  return conversation.id;
}

async function resolvePreferredUserId(users, storedUserId) {
  const orderedUsers = [
    ...(storedUserId
      ? users.filter((user) => String(user.id) === String(storedUserId))
      : []),
    ...users.filter((user) => String(user.id) !== String(storedUserId || ""))
  ];

  for (const user of orderedUsers) {
    try {
      const [conversationsPayload, projectsPayload] = await Promise.all([
        apiClient.listConversations(user.id),
        apiClient.listProjects(user.id, "")
      ]);
      const hasConversations =
        Array.isArray(conversationsPayload?.conversations) &&
        conversationsPayload.conversations.length > 0;
      const hasProjects =
        Array.isArray(projectsPayload?.projects) && projectsPayload.projects.length > 0;

      if (hasConversations || hasProjects) {
        return user.id;
      }
    } catch {
      // Ignore failed probes and continue to the next user candidate.
    }
  }

  return orderedUsers[0]?.id || null;
}

async function selectUser(userId) {
  await flushPendingWorkObjectChanges();
  state.currentUserId = Number(userId);
  state.currentConversationId = null;
  state.currentProjectId = null;
  state.currentWorkspace = null;
  state.currentWorkObjectId = null;
  state.currentWorkObject = null;
  state.currentWorkObjectFile = "";
  state.currentSections = [];
  state.currentSectionId = "";
  state.currentBlocks = [];
  state.currentBlockId = "";
  state.currentStructuredItemId = "";
  state.currentStructuredSubItemId = "";
  state.currentPreviewFilter = "";
  state.currentDimension = "";
  state.currentSurfaceId = "";
  clearRuntimeSessionState(true);
  state.currentRuntimeSession = null;
  state.liveRuntimeDraft = "";
  state.editorDirty = false;
  state.editorDraft = "";
  state.editorDraftKey = "";
  setWorkspaceMode("view");
  setCopilotOpen(true);
  state.messages = [];

  sessionStore.setUserId(state.currentUserId);
  sessionStore.clearConversationId();

  renderUsers();
  renderMessages();
  renderWorkspace();
  await loadPreferences();

  const conversationsPayload = await apiClient.listConversations(state.currentUserId);
  state.conversations = conversationsPayload.conversations || [];
  renderConversations();

  await loadProjects();
  await loadWorkObjects();

  const storedConversationId = sessionStore.getConversationId();
  const targetConversation =
    state.conversations.find(
      (conversation) => String(conversation.id) === String(storedConversationId || "")
    ) || state.conversations[0];

  if (targetConversation) {
    await selectConversation(targetConversation.id);
  } else {
    setStatus("Create a conversation or send a prompt to start.");
  }
}

async function selectConversation(conversationId, options = {}) {
  const preserveProject = Boolean(options.preserveProject);
  if (Number(conversationId) !== Number(state.currentConversationId || 0)) {
    await flushPendingWorkObjectChanges();
  }
  state.currentConversationId = Number(conversationId);
  if (!preserveProject) {
    state.currentProjectId = null;
    state.currentWorkspace = null;
    state.currentWorkObjectId = null;
    state.currentWorkObject = null;
    state.currentWorkObjectFile = "";
    state.currentSections = [];
    state.currentSectionId = "";
    state.currentBlocks = [];
    state.currentBlockId = "";
    state.currentStructuredItemId = "";
    state.currentStructuredSubItemId = "";
    state.currentPreviewFilter = "";
    state.currentDimension = "";
    state.currentSurfaceId = "";
    clearRuntimeSessionState(true);
    state.currentRuntimeSession = null;
    state.liveRuntimeDraft = "";
    state.editorDirty = false;
    state.editorDraft = "";
    state.editorDraftKey = "";
    setWorkspaceMode("view");
  }
  setCopilotOpen(true);

  sessionStore.setConversationId(state.currentConversationId);
  renderConversations();

  await loadMessages();
  if (!preserveProject) {
    await loadProjects();
    await loadWorkObjects();
    renderWorkspace();
  }

  if (preserveProject) {
    return;
  }

  const latestProject = state.projects[0] || null;
  const latestWorkObject = state.workObjects[0] || null;

  if (latestProject) {
    await selectProject(latestProject.id, {
      preferredWorkObjectId: latestWorkObject?.id || ""
    });
  } else if (latestWorkObject) {
    await selectWorkObject(latestWorkObject.id, latestWorkObject.primaryFile, {
      syncProject: true
    });
  } else {
    setCopilotOpen(true);
    setStatus("Describe what you want to create below.");
  }
}

async function selectProject(projectId, options = {}) {
  if (String(projectId) !== String(state.currentProjectId || "")) {
    await flushPendingWorkObjectChanges();
  }
  const payload = await apiClient.getProjectWorkspace(
    projectId,
    state.currentUserId,
    state.currentConversationId
  );

  const workspace = payload.workspace || null;
  if (!workspace) {
    throw new Error("Project workspace not found");
  }

  state.currentProjectId = workspace.project.id;
  state.currentWorkspace = workspace;
  if (!options.preserveDimension) {
    state.currentDimension = "";
  }
  if (!options.preserveStructuredItem) {
    state.currentStructuredItemId = "";
    state.currentStructuredSubItemId = "";
  }
  state.currentPreviewFilter = "";
  if (!options.preserveSurface) {
    state.currentSurfaceId = "";
  }
  clearRuntimeSessionState(true);
  state.liveRuntimeDraft = "";
  state.editorDirty = false;
  state.editorDraft = "";
  state.editorDraftKey = "";
  if (!options.preserveMode) {
  setWorkspaceMode("edit");
  }
  renderProjects();
  const projectConversationIds = sessionStore.getProjectConversations(state.currentProjectId);
  if (projectConversationIds.length) {
    const firstConversation = projectConversationIds[0];
    await selectConversation(firstConversation, { preserveProject: true });
  } else {
    state.currentConversationId = null;
    renderConversations();
    renderMessages();
  }
  renderWorkspace();

  const targetWorkObjectId =
    options.preferredWorkObjectId ||
    workspace.activeWorkObjectId ||
    workspace.workObjects[0]?.id ||
    "";

  if (targetWorkObjectId) {
    const targetWorkObject =
      workspace.workObjects.find((item) => item.id === targetWorkObjectId) ||
      workspace.workObjects[0];
    await selectWorkObject(targetWorkObject.id, options.preferredFile || preferredOpenPath(targetWorkObject), {
      syncProject: false,
      preserveDimension: options.preserveDimension,
      preserveSurface: options.preserveSurface
    });
  }
}

async function selectWorkObject(workObjectId, filePath = "", options = {}) {
  if (
    state.currentWorkObjectId &&
    (String(workObjectId) !== String(state.currentWorkObjectId) ||
      String(filePath || "") !== String(state.currentWorkObjectFile || ""))
  ) {
    await flushPendingWorkObjectChanges();
  }
  const payload = await apiClient.getWorkObject(workObjectId, filePath);
  const workObject = payload.workObject;

  clearRuntimeSyncTimer();
  state.currentWorkObjectId = workObject.id;
  state.currentWorkObject = workObject;
  if (!options.preserveDimension) {
    state.currentDimension = "";
  }
  const defaultSurfaceId = preferredSurfaceForLens(workObject);
  if (!options.preserveSurface) {
    state.currentSurfaceId = defaultSurfaceId;
  }
  if (!options.preserveRuntimeSession || state.currentRuntimeSession?.workObjectId !== workObject.id) {
    state.currentRuntimeSession = null;
  }
  state.liveRuntimeDraft = "";
  state.editorDirty = false;
  state.editorDraft = "";
  state.editorDraftKey = "";
  if (!options.preserveMode) {
    setWorkspaceMode("view");
  }
  state.currentWorkObjectFile =
    workObject?.file?.path ||
    filePath ||
    (defaultSurfaceId === "live" ?workObject.surfaceModel?.runtimeEntryPath : "") ||
    workObject?.primaryFile ||
    getEditableFiles(workObject)[0] ||
    "";
  state.currentSectionId = "";
  state.currentBlockId = "";
  if (!options.preserveStructuredItem) {
    state.currentStructuredItemId = "";
    state.currentStructuredSubItemId = "";
  }
  state.currentPreviewFilter = "";
  syncWorkspaceSlices();

  if (
    options.syncProject !== false &&
    workObject.projectId &&
    workObject.projectId !== state.currentProjectId
  ) {
    await selectProject(workObject.projectId, {
      preferredWorkObjectId: workObject.id,
      preferredFile: state.currentWorkObjectFile,
      preserveDimension: options.preserveDimension,
      preserveSurface: options.preserveSurface
    });
    return;
  }

  if (workObject.surfaceModel?.runtimeCapable) {
    await ensureRuntimeSessionForWorkObject(workObject);
  }

  mergeWorkObject(workObject);
  renderWorkObjects();
  renderWorkspace();
}

async function continueWithWorkObject(workObjectId, filePath = "") {
  await selectWorkObject(workObjectId, filePath);
  setCopilotOpen(true);
  el["prompt-input"].focus();
  setStatus("Edit directly here, or ask Hydria to improve what is open.");
}

async function savePreferences() {
  if (!state.currentUserId) {
    throw new Error("Select a user first");
  }

  const payload = await apiClient.savePreferences(state.currentUserId, {
    language: el["pref-language"].value.trim(),
    tone: el["pref-tone"].value.trim(),
    format: el["pref-format"].value.trim()
  });

  state.preferences = payload.preferences || {};
  renderPreferences();
  setStatus("Preferences saved.");
}

async function saveWorkObjectChanges(options = {}) {
  const { silent = false, source = "manual" } = options;
  if (!state.currentWorkObjectId || !state.currentWorkObjectFile) {
    throw new Error("Select a work object first");
  }

  clearAutoSaveTimer();

  const runtimeTracked = isRuntimeTrackedFile(state.currentWorkObjectFile);
  const keepInlinePreviewSession = silent && isInlinePreviewEditingActive();
  const editorValue = currentEditorInputValue();
  const editorKeyAtStart = currentEditorKey();
  const normalizedEditorValue = normalizeEditorText(editorValue);
  let nextContent;

  if (usesWholeFileStructuredEditing()) {
    nextContent = editorValue;
  } else if (currentBlock()) {
    nextContent = applyWorkspaceBlockEdit(
      currentContent(),
      state.currentWorkObjectFile,
      state.currentSectionId,
      state.currentBlockId,
      editorValue,
      state.currentSections
    );
  } else if (currentSection()) {
    nextContent = applyWorkspaceSectionEdit(
      currentContent(),
      state.currentWorkObjectFile,
      state.currentSectionId,
      editorValue
    );
  } else {
    nextContent = editorValue;
  }

  state.autoSaving = true;
  if (el["workspace-view-status"]) {
    el["workspace-view-status"].textContent = currentPreviewSummary();
  }
  if (el["workspace-save-button"]) {
    el["workspace-save-button"].disabled = true;
    el["workspace-save-button"].textContent = "Saving...";
  }
  try {
    const payload = await apiClient.updateWorkObjectContent(
      state.currentWorkObjectId,
      state.currentWorkObjectFile,
      nextContent
    );

    state.currentWorkObject = payload.workObject;
    state.currentWorkObjectFile = payload.workObject.file?.path || state.currentWorkObjectFile;
    state.liveRuntimeDraft = "";
    const draftChangedSinceSaveStarted =
      state.editorDraftKey === editorKeyAtStart &&
      normalizeEditorText(state.editorDraft) !== normalizedEditorValue;
    if (!draftChangedSinceSaveStarted) {
      state.editorDirty = false;
      state.editorDraft = "";
      state.editorDraftKey = "";
    }
    syncWorkspaceSlices();
    mergeWorkObject(payload.workObject);
    await refreshRuntimeSession();
    state.currentRuntimePatch =
      runtimeTracked && state.currentRuntimeSession?.id
        ?{
            sessionId: state.currentRuntimeSession.id,
            runtimeVersion: state.currentRuntimeSession.runtimeVersion || 0,
            entryPath: state.currentWorkObjectFile,
            content: nextContent
          }
        : null;

    if (state.currentProjectId) {
      const workspacePayload = await apiClient.getProjectWorkspace(
        state.currentProjectId,
        state.currentUserId,
        state.currentConversationId
      );
      state.currentWorkspace = workspacePayload.workspace || state.currentWorkspace;
    }

    renderWorkObjects();
    if (!keepInlinePreviewSession) {
      renderWorkspace();
    }
    if (!silent) {
      setStatus(`Saved ${currentScopeLabel().toLowerCase()} in ${state.currentWorkObject.title}.`);
    } else if (source === "autosave") {
      setStatus(`Saved automatically in ${state.currentWorkObject.title}.`);
    }
    if (draftChangedSinceSaveStarted) {
      scheduleAutoSave();
    }
  } finally {
    state.autoSaving = false;
    if (!keepInlinePreviewSession) {
      renderWorkspace();
    } else {
      if (el["workspace-view-status"]) {
        el["workspace-view-status"].textContent = currentPreviewSummary();
      }
      if (el["workspace-save-button"]) {
        el["workspace-save-button"].disabled = !state.editorDirty;
        el["workspace-save-button"].textContent = state.editorDirty ? "Save" : "Saved";
      }
    }
  }
}

async function improveWorkObject() {
  if (!state.currentWorkObjectId || !state.currentWorkObjectFile) {
    throw new Error("Select a work object first");
  }

  if (state.editorDirty) {
    await flushPendingWorkObjectChanges();
  }

  const runtimeTracked = isRuntimeTrackedFile(state.currentWorkObjectFile);
  const scopePrompt = currentBlock()
    ?`${el["work-object-improve-prompt"].value.trim()} Focus on the selected block.`
    : currentSection()
      ?`${el["work-object-improve-prompt"].value.trim()} Focus on the selected section.`
      : el["work-object-improve-prompt"].value.trim();

  const payload = await apiClient.improveWorkObject(
    state.currentWorkObjectId,
    state.currentWorkObjectFile,
    scopePrompt
  );

  state.currentWorkObject = payload.workObject;
  state.currentWorkObjectFile = payload.workObject.file?.path || state.currentWorkObjectFile;
  state.currentSectionId = "";
  state.currentBlockId = "";
  state.liveRuntimeDraft = "";
  state.editorDirty = false;
  state.editorDraft = "";
  state.editorDraftKey = "";
  syncWorkspaceSlices();
  mergeWorkObject(payload.workObject);
  await refreshRuntimeSession();
  state.currentRuntimePatch =
    runtimeTracked && state.currentRuntimeSession?.id
      ?{
          sessionId: state.currentRuntimeSession.id,
          runtimeVersion: state.currentRuntimeSession.runtimeVersion || 0,
          entryPath: state.currentWorkObjectFile,
          content: payload.workObject.file?.content || currentContent()
        }
      : null;

  if (state.currentProjectId) {
    const workspacePayload = await apiClient.getProjectWorkspace(
      state.currentProjectId,
      state.currentUserId,
      state.currentConversationId
    );
    state.currentWorkspace = workspacePayload.workspace || state.currentWorkspace;
  }

  el["work-object-improve-prompt"].value = "";
  renderWorkObjects();
  renderWorkspace();
  setStatus(payload.finalAnswer || `Improved ${state.currentWorkObject.title}.`);
}

function looksLikeCreationPrompt(prompt = "") {
  return /\b(Create|build|generate|make|scaffold|ship|produce|Cree|fais|construis|genere|fabrique|produis)\b/i.test(
    String(prompt || "")
  );
}

async function applyChatPayload(payload = {}) {
  updateLastRun(payload);
  setStatus(
    payload.meta?.durationMs ?`Completed in ${payload.meta.durationMs} ms` : "Hydria completed the task."
  );

  await loadMessages();
  await loadProjects();
  await loadWorkObjects();

  if (payload.project?.id) {
    await selectProject(payload.project.id, {
      preferredWorkObjectId: payload.activeWorkObject?.id || payload.workObject?.id || ""
    });
    return;
  }

  if (payload.activeWorkObject?.id) {
    await selectWorkObject(payload.activeWorkObject.id, payload.activeWorkObject.primaryFile, {
      syncProject: true
    });
    return;
  }

  if (payload.workObjects?.length) {
    const newest = payload.workObjects[0];
    await selectWorkObject(newest.id, newest.primaryFile, {
      syncProject: true
    });
  }
}

async function runHydriaPrompt({
  prompt,
  attachments = [],
  preserveComposer = false,
  workObjectId = state.currentWorkObjectId || undefined,
  workObjectPath = resolvePromptTargetPath()
} = {}) {
  await ensureConversation();
  if (state.editorDirty && !attachments.length) {
    await flushPendingWorkObjectChanges();
  }
  setLoading(true);
  setStatus("Hydria is working...");

  try {
    const payload = await apiClient.sendChat({
      userId: state.currentUserId,
      conversationId: state.currentConversationId,
      prompt,
      attachments,
      workObjectId,
      workObjectPath
    });

    const expectedCreation =
      looksLikeCreationPrompt(prompt) || Boolean(payload.executionIntent?.readyToAct);
    if (
      expectedCreation &&
      !payload.project?.id &&
      !payload.activeWorkObject?.id &&
      !(payload.workObjects || []).length
    ) {
      throw new Error("Hydria did not create a visible project. Check the logs and retry.");
    }

    if (!preserveComposer) {
      el["prompt-input"].value = "";
      el["attachment-input"].value = "";
      state.pendingAttachments = [];
      renderPendingAttachments();
    }

    await applyChatPayload(payload);
    return payload;
  } finally {
    setLoading(false);
  }
}

async function sendPrompt(event) {
  event.preventDefault();
  await waitForBoot();

  if (!state.currentUserId) {
    throw new Error("Create or select a user first");
  }

  const prompt = el["prompt-input"].value.trim();
  if (!prompt && !state.pendingAttachments.length) {
    return;
  }

  await runHydriaPrompt({
    prompt,
    attachments: state.pendingAttachments
  });
}

async function createProjectFromUI() {
  if (!state.currentUserId) {
    throw new Error("Create or select a user first");
  }

  const answer = window.prompt(
    "What should Hydria create?",
    "une application simple"
  );
  const requestedProject = String(answer || "").trim();
  if (!requestedProject) {
    return;
  }

  const prompt = /^(Create|build|generate|make|scaffold|Cree|fais|construis|genere)\b/i.test(
    requestedProject
  )
    ?requestedProject
    : `Crée ${requestedProject}`;

  const conversationTitle = `Project · ${requestedProject.slice(0, 48)}`;
  const conversationPayload = await apiClient.createConversation(
    state.currentUserId,
    conversationTitle
  );
  state.conversations.unshift(conversationPayload.conversation);
  renderConversations();
  sessionStore.linkConversationToProject(
    payload.project?.id || payload.project?.projectId || state.currentProjectId,
    conversationPayload.conversation.id
  );
  await selectConversation(conversationPayload.conversation.id, { preserveProject: true });

  await runHydriaPrompt({
    prompt,
    attachments: [],
    preserveComposer: true,
    workObjectId: undefined,
    workObjectPath: ""
  });
}

async function startCreationConversationFromUI() {
  await waitForBoot();

  if (!state.currentUserId) {
    throw new Error("Create or select a user first");
  }

  const conversationTitle = `Workspace ${new Date().toLocaleString()}`;
  const conversationPayload = await apiClient.createConversation(
    state.currentUserId,
    conversationTitle
  );
  state.conversations.unshift(conversationPayload.conversation);
  renderConversations();
  if (state.currentProjectId) {
    sessionStore.linkConversationToProject(state.currentProjectId, conversationPayload.conversation.id);
    await selectConversation(conversationPayload.conversation.id, { preserveProject: true });
  } else {
    await selectConversation(conversationPayload.conversation.id);
  }
  focusPromptComposer();
  el["prompt-input"].value = "";
  el["prompt-input"].placeholder =
    "Ex: crée une application de cuisine, fais un excel avec les numéros de 1 à 100, fais une présentation...";
  setStatus("Describe what you want to create below.");
}

async function createUser() {
  const username = el["new-user-input"].value.trim();
  if (!username) {
    throw new Error("Enter a username first");
  }

  const payload = await apiClient.createUser(username);
  state.users.unshift(payload.user);
  el["new-user-input"].value = "";
  renderUsers();
  await selectUser(payload.user.id);
}

async function createConversation() {
  await waitForBoot();

  if (!state.currentUserId) {
    throw new Error("Select a user first");
  }

  const title = `Workspace ${new Date().toLocaleString()}`;
  const payload = await apiClient.createConversation(state.currentUserId, title);
  state.conversations.unshift(payload.conversation);
  renderConversations();
  if (state.currentProjectId) {
    sessionStore.linkConversationToProject(state.currentProjectId, payload.conversation.id);
    await selectConversation(payload.conversation.id, { preserveProject: true });
  } else {
    await selectConversation(payload.conversation.id);
  }
  el["prompt-input"].value = "";
  el["prompt-input"].placeholder =
    "Ex: crée une application de cuisine, fais un excel avec les numéros de 1 à 100, fais une présentation...";
  focusPromptComposer();
  setStatus("Describe what you want to create below.");
}

async function clearConversation() {
  if (!state.currentConversationId) {
    return;
  }

  await apiClient.clearConversation(state.currentConversationId);
  await loadMessages();
  setStatus("Conversation cleared.");
}

function handleError(error) {
  console.error(error);
  setStatus(error.message || "Unexpected error");
}

function bindEvents() {
  window.addEventListener("message", (event) => {
    const payload = event.data || {};
    if (!payload || payload.type !== "hydria-runtime-patch-ack") {
      return;
    }

    if (
      !state.currentRuntimeSession?.id ||
      String(payload.sessionId || "") !== String(state.currentRuntimeSession.id || "")
    ) {
      return;
    }

    if (payload.applied === false) {
      forceRuntimeFrameRefresh();
    }
  });

  el["copilot-toggle-button"]?.addEventListener("click", () => {
    setCopilotOpen(true);
    el["assistant-dock"]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    el["prompt-input"]?.focus();
  });

  el["user-select"].addEventListener("change", (event) => {
    const nextUserId = Number(event.target.value || 0);
    if (nextUserId) {
      selectUser(nextUserId).catch(handleError);
    }
  });

  el["create-user-button"].addEventListener("click", () => {
    createUser().catch(handleError);
  });

  el["new-conversation-button"].addEventListener("click", () => {
    createConversation().catch(handleError);
  });

  el["new-project-button"]?.addEventListener("click", () => {
    startCreationConversationFromUI().catch(handleError);
  });

  el["clear-conversation-button"].addEventListener("click", () => {
    clearConversation().catch(handleError);
  });

  el["chat-form"].addEventListener("submit", (event) => {
    sendPrompt(event).catch(handleError);
  });

  el["attachment-input"].addEventListener("change", (event) => {
    const files = Array.from(event.target.files || []);
    state.pendingAttachments = [...state.pendingAttachments, ...files];
    renderPendingAttachments();
  });

  el["clear-attachments-button"].addEventListener("click", () => {
    state.pendingAttachments = [];
    el["attachment-input"].value = "";
    renderPendingAttachments();
  });

  el["save-preferences-button"].addEventListener("click", () => {
    savePreferences().catch(handleError);
  });

  el["work-object-editor"].addEventListener("input", () => {
    syncEditorDraft(el["work-object-editor"].value);
  });

  el["work-object-file-select"].addEventListener("change", (event) => {
    if (!state.currentWorkObjectId) {
      return;
    }

    state.currentSectionId = "";
    state.currentBlockId = "";
    state.liveRuntimeDraft = "";
    state.editorDirty = false;
    selectWorkObject(state.currentWorkObjectId, event.target.value, {
      syncProject: false,
      preserveDimension: true,
      preserveSurface: true,
      preserveRuntimeSession: true
    }).catch(handleError);
  });

  el["save-work-object-button"].addEventListener("click", () => {
    saveWorkObjectChanges().catch(handleError);
  });

  el["workspace-save-button"]?.addEventListener("click", () => {
    saveWorkObjectChanges().catch(handleError);
  });

  el["workspace-project-context-toggle"]?.addEventListener("click", () => {
    state.documentProjectContextVisible = !state.documentProjectContextVisible;
    renderWorkspace();
  });

  el["workspace-edit-now-button"]?.addEventListener("click", () => {
    focusWorkspaceEditor();
  });

  el["workspace-ask-hydria-button"]?.addEventListener("click", () => {
    focusPromptComposer();
  });

  el["workspace-save-now-button"]?.addEventListener("click", () => {
    saveWorkObjectChanges().catch(handleError);
  });

  el["improve-work-object-button"].addEventListener("click", () => {
    improveWorkObject().catch(handleError);
  });
}

async function init() {
  cache();
  setInteractiveEnabled(false);
  bindEvents();
  setCopilotOpen(true);
  renderPendingAttachments();
  renderMessages();
  renderProjects();
  renderWorkObjects();
  renderWorkspace();

  const [configPayload, healthPayload, usersPayload] = await Promise.all([
    apiClient.getPublicConfig().catch(() => null),
    apiClient.getHealth().catch(() => null),
    apiClient.listUsers()
  ]);

  state.config = configPayload || null;
  state.users = usersPayload.users || [];
  renderUsers();

  if (healthPayload?.status === "ok" || healthPayload?.health?.status === "ok") {
    setStatus("Hydria workspace ready.");
  } else {
    setStatus("Hydria workspace initializing...");
  }

  setPillsFromResult(null);

  const storedUserId = sessionStore.getUserId();
  const preferredUserId = await resolvePreferredUserId(state.users, storedUserId);
  const targetUser =
    state.users.find((user) => String(user.id) === String(preferredUserId || "")) ||
    state.users.find((user) => String(user.id) === String(storedUserId || "")) ||
    state.users[0];

  if (targetUser) {
    await selectUser(targetUser.id);
  } else {
    setStatus("Create a user to begin.");
  }
}

state.bootPromise = init();
state.bootPromise
  .then(() => {
    state.ready = true;
    setInteractiveEnabled(true);
  })
  .catch((error) => {
    state.ready = true;
    setInteractiveEnabled(true);
    handleError(error);
  });


