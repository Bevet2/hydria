import { renderChatMessage } from "./components/chatMessage.js";
import { renderRunDetails } from "./components/detailsPanel.js";
import {
  applyWorkspaceBlockEdit,
  applyWorkspaceSectionEdit,
  deriveWorkspaceBlocks,
  deriveWorkspaceSections,
  matchesWorkspaceDimension,
  renderProjectCards,
  renderCrmWorkspaceEmbed,
  renderWorkspaceBreadcrumb,
  renderWorkspaceBlockList,
  renderWorkspaceDimensionNav,
  renderWorkspaceObjectList,
  renderWorkspaceProjectMap,
  renderWorkspacePreview,
  renderWorkspaceSurfaceNav,
  renderWorkspaceSectionList
} from "./components/workspacePanel.js";
import {
  createDashboardWorkspaceCommandAdapter,
  createPresentationWorkspaceCommandAdapter,
  createWorkspaceLens,
  createWorkspaceCommandExecutor,
  createWorkspaceDashboardHomeMenuItems,
  createWorkspaceStructureLabels,
  createWorkspaceIconNode,
  createWorkspaceMenuActionButton,
  getWorkspaceCommandIcon,
  parseWorkspacePagePath,
  resolveWorkspacePageForWorkObject,
  WORKSPACE_PAGES,
  workspacePageFromSlug,
  workspacePagePath
} from "./components/workspaceSharedCommands.js";
import { apiClient } from "./services/apiClient.js";
import {
  applyCollaborationOperation,
  buildCollaborationOperation,
  collaborationClientId,
  collaborationQueueSize,
  queueCollaborationOperation,
  replayCollaborationOperations
} from "./services/collaborationClient.js";
import { sessionStore } from "./services/sessionStore.js";

const initialWorkspacePage = parseWorkspacePagePath();

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
  closedSheetDocumentIds: [],
  workspacePreviewExpanded: false,
  workspacePageSlug: initialWorkspacePage?.slug || "",
  routeHydrating: true,
  routeTransitioning: false,
  coreChatLoading: false,
  coreChatAttachments: [],
  coreChatPendingMessages: [],
  coreChatStreamingText: "",
  coreChatGenerationId: "",
  coreChatStatus: "",
  coreChatModel: "hydria-core",
  coreChatToolMode: "auto",
  coreChatCatalog: { models: [], tools: [] },
  chatProjects: [],
  conversationTree: [],
  currentChatProjectId: "",
  currentConversationFolder: "",
  conversationSearch: "",
  showArchivedConversations: false,
  workspaceLibraryQuery: "",
  workspaceLibraryShowArchived: false,
  workspaceLibraryShowTrash: false,
  workspaceLibrarySearchResults: [],
  workspacePresence: [],
  workspaceRemoteRevision: null,
  collaborationVersion: 0,
  collaborationPersistedRevision: 0,
  collaborationServerContent: "",
  collaborationClientId: collaborationClientId(),
  collaborationQueueSize: collaborationQueueSize(),
  collaborationApplyingRemote: false,
  sheetCalculation: null,
  sheetCalculationEngineId: "",
  presentationClipboard: null,
  presentationZoom: 1,
  presentationRibbonTab: "home",
  presentationSelectedElementIds: [],
  presentationSelectionCleared: false,
  presentationFormatBrush: null,
  presentationUndoStack: [],
  presentationRedoStack: [],
  presentationShowGrid: false,
  presentationShowGuides: false,
  presentationSnapToGrid: false,
  presentationShowSlideRail: true,
  presentationShowInspector: false,
  offline: !navigator.onLine,
  ready: false,
  bootPromise: null
};

const el = {};
let workspacePreviewExpandedPlaceholder = null;
let workspacePreviewExpandedOverlay = null;
let workspacePreviewExpandedFrame = null;
let workspaceLibrarySearchHandle = null;
let workspacePresenceHandle = null;
let workspaceEventSource = null;
let workspaceCursorHandle = null;
let collaborationSyncHandle = null;
let collaborationPendingChange = null;
let collaborationSending = null;
let sheetCalculationHandle = null;
let sheetCalculationRequestId = 0;
let presentationKeyboardHandler = null;

function createDashboardCommandButton(item = {}, executeCommand = null) {
  return createWorkspaceMenuActionButton(item, {
    actionClassName: "workspace-dashboard-command-button",
    iconClassName: "workspace-dashboard-command-icon",
    labelClassName: "workspace-dashboard-command-label",
    metaClassName: "workspace-dashboard-command-meta",
    createIconNode: createWorkspaceIconNode,
    resolveIconName: getWorkspaceCommandIcon,
    hasSubmenu: false,
    onClick: (_event, menuItem) => {
      if (!menuItem.commandId || typeof executeCommand !== "function") {
        return;
      }
      executeCommand(menuItem.commandId, {
        value: menuItem.value,
        options: menuItem.options || {}
      });
    }
  });
}

function appendDashboardCommandGroups(host = null, items = [], executeCommand = null) {
  if (!host) {
    return;
  }
  let group = null;
  const ensureGroup = () => {
    if (!group) {
      group = document.createElement("div");
      group.className = "workspace-dashboard-command-group";
      host.appendChild(group);
    }
    return group;
  };
  items.forEach((item) => {
    if (!item) {
      return;
    }
    if (item.separator) {
      group = null;
      return;
    }
    ensureGroup().appendChild(createDashboardCommandButton(item, executeCommand));
  });
}

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
    "workspace-sheet-documents",
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
  return WORKSPACE_PAGES;
}

function workspacePageForWorkObject(workObject = null) {
  return resolveWorkspacePageForWorkObject(workObject, {
    files: getEditableFiles(workObject),
    isCodeLikePath
  });
}

function currentWorkspacePage() {
  return workspacePageFromSlug(state.workspacePageSlug);
}

function setWorkspacePage(page = null, { historyMode = "push" } = {}) {
  const nextPage = page || null;
  const nextSlug = nextPage?.slug || "";
  const nextPath = workspacePagePath(nextPage);
  const currentPath = String(window.location.pathname || "/").replace(/\/+$/, "") || "/";

  state.workspacePageSlug = nextSlug;
  document.body.dataset.workspacePage = nextSlug || "overview";
  document.title = nextPage ? `${nextPage.title} | Hydria` : "Hydria";

  if (historyMode === "none" || currentPath === nextPath) {
    return;
  }

  const method = historyMode === "replace" ? "replaceState" : "pushState";
  window.history[method]({ workspace: nextSlug }, "", nextPath);
}

function allWorkspaceWorkObjects() {
  if (state.currentWorkspace?.workObjects?.length) {
    return state.currentWorkspace.workObjects;
  }

  if (state.currentProjectId) {
    return state.workObjects.filter(
      (workObject) => String(workObject.projectId || "") === String(state.currentProjectId)
    );
  }

  return state.workObjects;
}

function clearCurrentWorkObjectState() {
  clearRuntimeSessionState(true);
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
  state.currentRuntimeSession = null;
  state.liveRuntimeDraft = "";
  state.editorDirty = false;
  state.editorDraft = "";
  state.editorDraftKey = "";
  setWorkspaceMode("view");
}

async function activateWorkspacePage(page = null, { historyMode = "push" } = {}) {
  if (state.routeTransitioning) {
    return;
  }

  state.routeTransitioning = true;
  try {
    setWorkspacePage(page, { historyMode });

    if (!page) {
      await flushPendingWorkObjectChanges();
      clearCurrentWorkObjectState();
      renderWorkspace();
      return;
    }

    if (page.slug === "chat") {
      await flushPendingWorkObjectChanges();
      clearCurrentWorkObjectState();
      renderWorkspace();
      return;
    }

    const currentPage = workspacePageForWorkObject(state.currentWorkObject);
    if (currentPage?.slug === page.slug) {
      renderWorkspace();
      return;
    }

    const existing = allWorkspaceWorkObjects().find(
      (workObject) => workspacePageForWorkObject(workObject)?.slug === page.slug
    );
    if (existing) {
      await selectWorkObject(existing.id, preferredOpenPath(existing), {
        syncRoute: false,
        syncProject: true
      });
      return;
    }

    await flushPendingWorkObjectChanges();
    clearCurrentWorkObjectState();
    renderWorkspace();
  } finally {
    state.routeTransitioning = false;
  }
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

function localDraftStorageKey(
  workObjectId = state.currentWorkObjectId,
  entryPath = state.currentWorkObjectFile
) {
  return `hydria-work-object-draft:${workObjectId || ""}:${entryPath || ""}`;
}

function persistLocalWorkspaceDraft() {
  if (!state.currentWorkObjectId || !state.currentWorkObjectFile) {
    return;
  }
  if (!state.editorDirty) {
    localStorage.removeItem(localDraftStorageKey());
    return;
  }
  localStorage.setItem(
    localDraftStorageKey(),
    JSON.stringify({
      content: state.editorDraft,
      revision: state.currentWorkObject?.revision || 1,
      savedAt: new Date().toISOString()
    })
  );
}

function restoreLocalWorkspaceDraft() {
  const raw = localStorage.getItem(localDraftStorageKey());
  if (!raw) {
    return false;
  }
  try {
    const draft = JSON.parse(raw);
    if (typeof draft.content !== "string" || draft.content === currentEditorBaseline()) {
      localStorage.removeItem(localDraftStorageKey());
      return false;
    }
    state.editorDirty = true;
    state.editorDraft = draft.content;
    state.editorDraftKey = currentEditorKey();
    setStatus(`Brouillon local restaure (${new Date(draft.savedAt).toLocaleString()}).`);
    return true;
  } catch {
    localStorage.removeItem(localDraftStorageKey());
    return false;
  }
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
  const content = normalizePresentationSourceText(currentDraftContent());
  const deck = derivePresentationDeck(content, state.currentWorkObject?.title || "Untitled presentation");
  const slideSections = deriveWorkspaceSections(content, state.currentWorkObjectFile || "slides.md")
    .filter((section) => isPresentationSection(section));
  const activeIndex = Math.max(
    0,
    slideSections.findIndex((section) => section.id === (slideId || state.currentSectionId))
  );
  const nextSlides = deck.slides.map((slide, index) => {
    if (index !== activeIndex) {
      return slide;
    }
    return {
      ...slide,
      title:
        String(payload.title || slide.title || "Slide").replace(/^slide\s+\d+\s*-\s*/i, "").trim() ||
        "Slide",
      body: normalizeEditorText(payload.body || "").trim()
    };
  });
  const nextContent = buildPresentationContent({ title: deck.title, slides: nextSlides });
  state.currentSectionId = presentationSectionIdForIndex(nextContent, activeIndex);
  state.currentBlockId = "";
  syncPreviewInlineDraft(nextContent);
}

function updateSpreadsheetDraftFromPreview(model = {}, options = {}) {
  scheduleSheetCalculation(model);
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

  return createWorkspaceLens({
    kind,
    title,
    fileLabel,
    workspaceFamilyId,
    workspaceFamilyLabel,
    workspaceFamilyDescription,
    projectName: project?.name || "",
    hasWorkObject: Boolean(workObject)
  });
}

function currentWorkspaceStructureLabels() {
  const familyId =
    state.currentWorkObject?.workspaceFamilyId ||
    currentEnvironmentPlan()?.workspaceFamilyId ||
    "";
  const workspaceType = isDatasetWorkspace()
    ? "dataset"
    : isDocumentWorkspace()
      ? "document"
      : isDevelopmentWorkspace()
        ? "development"
        : isPresentationWorkspace()
          ? "presentation"
          : isDashboardWorkspace()
            ? "dashboard"
            : isWorkflowWorkspace()
              ? "workflow"
              : isDesignWorkspace()
                ? "design"
                : isAppConfigWorkspace()
                  ? "appConfig"
                  : "";

  return createWorkspaceStructureLabels({ familyId, workspaceType });
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

function buildSurfaceList(workObject = null) {
  let surfaces = Array.isArray(workObject?.surfaceModel?.availableSurfaces)
    ? workObject.surfaceModel.availableSurfaces.filter(Boolean)
    : [];
  const kind = String(workObject?.objectKind || workObject?.kind || "").toLowerCase();
  const familyId = String(
    workObject?.workspaceFamilyId ||
      workObject?.environmentPlan?.workspaceFamilyId ||
      ""
  ).toLowerCase();

  if (kind === "presentation" || familyId === "presentation") {
    surfaces = surfaces.filter((surface) => surface.id !== "preview");
  }

  if (
    familyId !== "document_knowledge" ||
    surfaces.some((surface) => surface.id === "canvas")
  ) {
    return surfaces;
  }

  return [...surfaces, { id: "canvas", label: "Canvas", enabled: true }];
}

function currentSurfaces() {
  return buildSurfaceList(state.currentWorkObject);
}

function preferredSurfaceForLens(workObject = null) {
  const surfaces = buildSurfaceList(workObject).map((surface) => surface.id);
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
    currentWorkspacePage()?.family ||
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
      workspaceLabel: "Hydria CRM workspace",
      heroCopy: "Track leads, accounts, opportunities, products, quotes and forecasts like a complete sales CRM.",
      sheetName: "Pipeline",
      tabs: ["Pipeline", "Leads", "Forecast", "Quotes", "Summary"],
      sheetPanelTitle: "Pipeline views",
      sheetPanelHint: "Keep stages and ownership visible while you update the pipeline.",
      profilePanelTitle: "Pipeline profile",
      profilePanelHint: "Read the table like a sales pipeline with stage posture and coverage.",
      selectionPanelTitle: "Current pipeline",
      selectionPanelHint: "Keep the active pipeline range in view while you edit.",
      computedPanelTitle: "Sales signals",
      computedPanelHint: "Expose stage totals, weighted forecast, conversion, quote status and follow-up load."
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
              sourceTableId: String(chart.sourceTableId || chart.tableId || ""),
              seriesName: String(chart.seriesName || chart.series || ""),
              secondarySeriesName: String(chart.secondarySeriesName || chart.secondarySeries || ""),
              x: Math.max(16, Number(chart.x ?? chart.left ?? 212) || 212),
              y: Math.max(16, Number(chart.y ?? chart.top ?? 52) || 52),
              width: Math.max(280, Number(chart.width || 432) || 432),
              height: Math.max(180, Number(chart.height || 284) || 284),
              showLegend: chart.showLegend !== false,
              showAxes: chart.showAxes !== false,
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

const PRESENTATION_SLIDE_LAYOUTS = Object.freeze([
  { value: "title", label: "Title" },
  { value: "content", label: "Content" },
  { value: "bullets", label: "Bullets" },
  { value: "two-column", label: "Two columns" },
  { value: "comparison", label: "Comparison" },
  { value: "quote", label: "Quote" },
  { value: "image", label: "Image" },
  { value: "section", label: "Section break" }
]);

const PRESENTATION_SLIDE_THEMES = Object.freeze([
  { value: "default", label: "Neutral" },
  { value: "product", label: "Product" },
  { value: "problem", label: "Problem" },
  { value: "proof", label: "Proof" },
  { value: "roadmap", label: "Roadmap" },
  { value: "insight", label: "Insight" }
]);

const PRESENTATION_SLIDE_TRANSITIONS = Object.freeze([
  { value: "none", label: "None" },
  { value: "fade", label: "Fade" },
  { value: "push", label: "Push" },
  { value: "wipe", label: "Wipe" },
  { value: "split", label: "Split" },
  { value: "zoom", label: "Zoom" }
]);

const PRESENTATION_SLIDE_BACKGROUNDS = Object.freeze([
  { value: "#ffffff", label: "White" },
  { value: "#f8fafc", label: "Soft gray" },
  { value: "#eff6ff", label: "Blue tint" },
  { value: "#f0fdf4", label: "Green tint" },
  { value: "#fff7ed", label: "Warm tint" },
  { value: "#111827", label: "Dark" }
]);

const PRESENTATION_ELEMENT_TYPES = Object.freeze(["title", "text", "shape", "image", "table", "chart", "icon", "video", "code", "equation"]);
const PRESENTATION_SHAPE_TYPES = Object.freeze(["rectangle", "round-rect", "ellipse", "line", "callout", "triangle", "diamond", "arrow"]);
const PRESENTATION_TEXT_ALIGNMENTS = Object.freeze(["left", "center", "right"]);
const PRESENTATION_CHART_TYPES = Object.freeze(["bar", "column", "line", "pie"]);
const PRESENTATION_ELEMENT_ANIMATIONS = Object.freeze([
  { value: "none", label: "None" },
  { value: "fade", label: "Fade" },
  { value: "rise", label: "Rise" },
  { value: "zoom", label: "Zoom" },
  { value: "wipe", label: "Wipe" }
]);
const PRESENTATION_FONT_OPTIONS = Object.freeze([
  { value: "", label: "Default" },
  { value: "Arial, sans-serif", label: "Arial" },
  { value: "Calibri, Candara, Segoe, sans-serif", label: "Calibri" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: "Impact, sans-serif", label: "Impact" },
  { value: "\"IBM Plex Sans\", sans-serif", label: "IBM Plex" },
  { value: "\"Times New Roman\", serif", label: "Times" },
  { value: "Verdana, sans-serif", label: "Verdana" }
]);
const PRESENTATION_DECK_TEMPLATES = Object.freeze([
  {
    id: "web-product",
    label: "Web pitch",
    theme: "product",
    background: "#ffffff",
    accent: "#2563eb",
    titleColor: "#111827",
    bodyColor: "#334155",
    fontFamily: "\"IBM Plex Sans\", sans-serif",
    transition: "fade"
  },
  {
    id: "ai-report",
    label: "AI report",
    theme: "insight",
    background: "#f8fafc",
    accent: "#0f766e",
    titleColor: "#102a43",
    bodyColor: "#334e68",
    fontFamily: "Arial, sans-serif",
    transition: "push"
  },
  {
    id: "business-native",
    label: "Native PPTX",
    theme: "proof",
    background: "#ffffff",
    accent: "#1d4ed8",
    titleColor: "#172033",
    bodyColor: "#344054",
    fontFamily: "Calibri, Candara, Segoe, sans-serif",
    transition: "none"
  },
  {
    id: "interactive-class",
    label: "Interactive",
    theme: "roadmap",
    background: "#eff6ff",
    accent: "#7c3aed",
    titleColor: "#1e1b4b",
    bodyColor: "#334155",
    fontFamily: "Verdana, sans-serif",
    transition: "zoom"
  }
]);
const PRESENTATION_SLIDE_META_PATTERN = /^<!--\s*hydria-slide:\s*(\{[\s\S]*\})\s*-->\s*$/i;

function normalizePresentationSourceText(value = "") {
  const text = normalizeEditorText(value);
  const actualLineBreaks = (text.match(/\n/g) || []).length;
  if (actualLineBreaks < 2 && /\\n/.test(text)) {
    return text.replace(/\\n/g, "\n");
  }
  return text;
}

function presentationOptionValue(options = [], value = "", fallback = "") {
  const normalized = String(value || "").trim().toLowerCase();
  return options.some((option) => option.value === normalized) ? normalized : fallback;
}

function normalizePresentationLayout(value = "") {
  return presentationOptionValue(PRESENTATION_SLIDE_LAYOUTS, value, "content");
}

function normalizePresentationTheme(value = "") {
  return presentationOptionValue(PRESENTATION_SLIDE_THEMES, value, "default");
}

function normalizePresentationTransition(value = "") {
  return presentationOptionValue(PRESENTATION_SLIDE_TRANSITIONS, value, "none");
}

function clampPresentationNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, number));
}

function normalizePresentationColor(value = "", fallback = "#ffffff") {
  const text = String(value || "").trim();
  if (!text) {
    return fallback;
  }
  if (
    /^#[0-9a-f]{3,8}$/i.test(text) ||
    /^rgba?\([\d\s.,%]+\)$/i.test(text) ||
    /^hsla?\([\d\s.,%]+\)$/i.test(text) ||
    text === "transparent"
  ) {
    return text;
  }
  return fallback;
}

function createPresentationElementId(prefix = "element") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function parsePresentationSlideMetaLine(line = "") {
  const match = String(line || "").trim().match(PRESENTATION_SLIDE_META_PATTERN);
  if (!match) {
    return null;
  }

  try {
    const parsed = JSON.parse(match[1]);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function stripPresentationInternalMeta(value = "") {
  return normalizeEditorText(value)
    .split("\n")
    .filter((line) => !parsePresentationSlideMetaLine(line))
    .join("\n")
    .trim();
}

function inferPresentationSlideLayout(title = "", body = "") {
  const text = `${title}\n${body}`.toLowerCase();
  const visibleLines = stripPresentationInternalMeta(body)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const bulletCount = visibleLines.filter((line) => /^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)).length;
  const wordCount = countWords(visibleLines.join(" "));

  if (visibleLines.some((line) => /^>\s+/.test(line))) {
    return "quote";
  }
  if (/(https?:\/\/\S+\.(?:png|jpe?g|gif|webp|svg)|\bimage\s*:)/i.test(body)) {
    return "image";
  }
  if (visibleLines.some((line) => /\s\|\s/.test(line)) || /\b(vs|versus|compare|comparison|comparaison)\b/i.test(text)) {
    return "comparison";
  }
  if (bulletCount >= 3) {
    return "bullets";
  }
  if (visibleLines.length >= 4) {
    return "two-column";
  }
  if (wordCount <= 18) {
    return "title";
  }
  return "content";
}

function inferPresentationSlideTheme(title = "", body = "") {
  const text = `${title}\n${body}`.toLowerCase();
  if (/\b(why|problem|pain|risk|risque|enjeu|opportunity|opportunite)\b/.test(text)) {
    return "problem";
  }
  if (/\b(product|demo|feature|workflow|interface|produit|fonction)\b/.test(text)) {
    return "product";
  }
  if (/\b(proof|metric|kpi|signal|traction|evidence|preuve|mesure|resultat)\b/.test(text)) {
    return "proof";
  }
  if (/\b(next|roadmap|milestone|timeline|plan|suite|jalon)\b/.test(text)) {
    return "roadmap";
  }
  if (/\b(insight|analysis|data|learned|analyse|donnee|signal)\b/.test(text)) {
    return "insight";
  }
  return "default";
}

function presentationDefaultBackground(theme = "default") {
  switch (theme) {
    case "problem":
      return "#fff7ed";
    case "proof":
      return "#f0fdf4";
    case "roadmap":
      return "#eff6ff";
    case "insight":
      return "#f8fafc";
    case "product":
      return "#ffffff";
    default:
      return "#ffffff";
  }
}

function presentationVisibleLines(body = "") {
  return stripPresentationInternalMeta(body)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function presentationBulletsFromBody(body = "") {
  return presentationVisibleLines(body)
    .filter((line) => /^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line))
    .map((line) => line.replace(/^[-*]\s+|^\d+\.\s+/, "").trim())
    .filter(Boolean);
}

function presentationParagraphsFromBody(body = "") {
  return presentationVisibleLines(body)
    .filter((line) => !/^[-*]\s+/.test(line) && !/^\d+\.\s+/.test(line))
    .map((line) => line.replace(/^>\s+/, "").trim())
    .filter(Boolean);
}

function createDefaultPresentationElements({ title = "", body = "", layout = "content", image = "", cta = "" } = {}) {
  const paragraphs = presentationParagraphsFromBody(body);
  const bullets = presentationBulletsFromBody(body);
  const bodyText = bullets.length
    ? bullets.map((item) => `- ${item}`).join("\n")
    : paragraphs.join("\n") || "Main point";
  const elements = [
    {
      id: "title",
      type: "title",
      text: title || "Slide title",
      x: layout === "section" ? 12 : 7,
      y: layout === "section" ? 34 : 10,
      w: layout === "section" ? 76 : 80,
      h: layout === "section" ? 18 : 22,
      fontSize: layout === "section" ? 46 : 34,
      bold: true,
      color: "#111827",
      fill: "transparent",
      stroke: "transparent",
      align: layout === "section" ? "center" : "left"
    }
  ];

  if (layout !== "section") {
    elements.push({
      id: "body",
      type: "text",
      text: bodyText,
      x: 7,
      y: layout === "title" ? 40 : 30,
      w: layout === "two-column" || layout === "image" ? 42 : 58,
      h: layout === "title" ? 20 : 36,
      fontSize: bullets.length ? 22 : 20,
      color: "#374151",
      fill: "transparent",
      stroke: "transparent",
      align: "left"
    });
  }

  if (layout === "two-column") {
    const secondColumnText = paragraphs.slice(2).join("\n") || bullets.slice(2).map((item) => `- ${item}`).join("\n") || "Second idea";
    elements.push({
      id: "column-2",
      type: "text",
      text: secondColumnText,
      x: 54,
      y: 28,
      w: 38,
      h: 36,
      fontSize: 20,
      color: "#374151",
      fill: "#f8fafc",
      stroke: "#e5e7eb",
      align: "left"
    });
  }

  if (layout === "comparison") {
    elements.push(
      {
        id: "compare-left",
        type: "shape",
        shape: "rectangle",
        text: paragraphs[0] || bullets[0] || "Option A",
        x: 7,
        y: 35,
        w: 40,
        h: 32,
        fontSize: 20,
        color: "#111827",
        fill: "#eff6ff",
        stroke: "#bfdbfe",
        align: "center"
      },
      {
        id: "compare-right",
        type: "shape",
        shape: "rectangle",
        text: paragraphs[1] || bullets[1] || "Option B",
        x: 53,
        y: 35,
        w: 40,
        h: 32,
        fontSize: 20,
        color: "#111827",
        fill: "#f0fdf4",
        stroke: "#bbf7d0",
        align: "center"
      }
    );
  }

  if (layout === "image" || image) {
    elements.push({
      id: "image",
      type: "image",
      src: image,
      text: "Image",
      x: 56,
      y: 25,
      w: 36,
      h: 44,
      fill: "#f8fafc",
      stroke: "#cbd5e1"
    });
  }

  if (cta) {
    elements.push({
      id: "cta",
      type: "shape",
      shape: "callout",
      text: cta,
      x: 62,
      y: 74,
      w: 30,
      h: 12,
      fontSize: 14,
      bold: true,
      color: "#0f172a",
      fill: "#dbeafe",
      stroke: "#93c5fd",
      align: "center"
    });
  }

  return elements;
}

function normalizePresentationElement(element = {}, index = 0, fallback = {}) {
  const type = PRESENTATION_ELEMENT_TYPES.includes(String(element.type || "").toLowerCase())
    ? String(element.type || "").toLowerCase()
    : "text";
  const shape = PRESENTATION_SHAPE_TYPES.includes(String(element.shape || "").toLowerCase())
    ? String(element.shape || "").toLowerCase()
    : "rectangle";
  const align = PRESENTATION_TEXT_ALIGNMENTS.includes(String(element.align || "").toLowerCase())
    ? String(element.align || "").toLowerCase()
    : "left";
  const chartType = PRESENTATION_CHART_TYPES.includes(String(element.chartType || "").toLowerCase())
    ? String(element.chartType || "").toLowerCase()
    : "bar";
  return {
    id: String(element.id || `${type}-${index + 1}`).trim() || `${type}-${index + 1}`,
    type,
    shape,
    chartType,
    groupId: String(element.groupId || "").trim(),
    locked: Boolean(element.locked),
    text: String(element.text ?? fallback.text ?? ""),
    src: String(element.src || element.image || element.imageUrl || "").trim(),
    x: clampPresentationNumber(element.x, 0, 100, fallback.x ?? 8),
    y: clampPresentationNumber(element.y, 0, 100, fallback.y ?? 18),
    w: clampPresentationNumber(element.w ?? element.width, 3, 100, fallback.w ?? 42),
    h: clampPresentationNumber(element.h ?? element.height, 3, 100, fallback.h ?? 16),
    z: clampPresentationNumber(element.z, 0, 1000, index),
    fontSize: clampPresentationNumber(element.fontSize, 8, 96, type === "title" ? 38 : 20),
    fontFamily: String(element.fontFamily || "").trim(),
    bold: Boolean(element.bold || type === "title"),
    italic: Boolean(element.italic),
    underline: Boolean(element.underline),
    align,
    color: normalizePresentationColor(element.color, type === "shape" || type === "chart" ? "#111827" : "#374151"),
    fill: normalizePresentationColor(
      element.fill || element.background,
      type === "shape" || type === "table" || type === "chart" || type === "code" ? "#ffffff" : "transparent"
    ),
    stroke: normalizePresentationColor(
      element.stroke || element.borderColor,
      type === "shape" || type === "image" || type === "table" || type === "chart" || type === "video" || type === "code"
        ? "#cbd5e1"
        : "transparent"
    ),
    strokeWidth: clampPresentationNumber(
      element.strokeWidth ?? element.borderWidth,
      0,
      8,
      type === "shape" || type === "image" || type === "table" || type === "chart" || type === "video" || type === "code" ? 1 : 0
    ),
    opacity: clampPresentationNumber(element.opacity, 0.1, 1, 1),
    rotation: clampPresentationNumber(element.rotation, -180, 180, 0),
    flipX: Boolean(element.flipX),
    flipY: Boolean(element.flipY),
    animation: PRESENTATION_ELEMENT_ANIMATIONS.some((animation) => animation.value === String(element.animation || "").toLowerCase())
      ? String(element.animation || "").toLowerCase()
      : "none",
    cropX: clampPresentationNumber(element.cropX ?? element.objectPositionX, 0, 100, 50),
    cropY: clampPresentationNumber(element.cropY ?? element.objectPositionY, 0, 100, 50),
    zoom: clampPresentationNumber(element.zoom ?? element.cropZoom, 1, 4, 1)
  };
}

function presentationElementDuplicateSignature(element = {}) {
  const signatureKeys = [
    "type",
    "shape",
    "text",
    "src",
    "chartType",
    "x",
    "y",
    "w",
    "h",
    "fontSize",
    "fontFamily",
    "bold",
    "italic",
    "underline",
    "align",
    "color",
    "fill",
    "stroke",
    "strokeWidth",
    "opacity",
    "rotation",
    "flipX",
    "flipY",
    "animation",
    "cropX",
    "cropY",
    "zoom"
  ];
  return signatureKeys.map((key) => `${key}:${String(element[key] ?? "")}`).join("|");
}

function normalizePresentationElements(elements = [], context = {}) {
  const source = Array.isArray(elements) && elements.length
    ? elements
    : createDefaultPresentationElements(context);
  const seenIds = new Set();
  return source.map((element, index) => {
    const normalized = normalizePresentationElement(element, index);
    const baseId = normalized.id || `${normalized.type}-${index + 1}`;
    let nextId = baseId;
    let suffix = 2;
    while (seenIds.has(nextId)) {
      nextId = `${baseId}-${suffix}`;
      suffix += 1;
    }
    seenIds.add(nextId);
    return nextId === normalized.id ? normalized : { ...normalized, id: nextId };
  });
}

function parsePresentationTableText(value = "") {
  const rows = normalizeEditorText(value)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) =>
      line
        .split(/\s*\|\s*|,/)
        .map((cell) => cell.trim())
        .filter((cell, index, cells) => cell || cells.length <= 1 || index === 0)
    )
    .filter((row) => row.length);
  if (!rows.length) {
    return {
      headers: ["Column", "Value"],
      rows: [["Item", "0"]]
    };
  }
  const width = Math.max(...rows.map((row) => row.length));
  const normalizedRows = rows.map((row) => Array.from({ length: width }, (_, index) => row[index] || ""));
  return {
    headers: normalizedRows[0],
    rows: normalizedRows.slice(1)
  };
}

function parsePresentationChartText(value = "") {
  const items = normalizeEditorText(value)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const parts = line.split(/\s*\|\s*|,/).map((part) => part.trim()).filter(Boolean);
      const label = parts.length > 1 ? parts[0] : `Item ${index + 1}`;
      const numericSource = parts.length > 1 ? parts[1] : parts[0];
      const valueNumber = Number(String(numericSource || "").replace(/[^\d.-]/g, ""));
      return {
        label,
        value: Number.isFinite(valueNumber) ? valueNumber : index + 1
      };
    })
    .filter((item) => item.label);
  return items.length
    ? items
    : [
        { label: "North", value: 42 },
        { label: "South", value: 28 },
        { label: "West", value: 18 }
      ];
}

function presentationElementIconName(element = {}) {
  if (element.type === "image") return "image";
  if (element.type === "table") return "table";
  if (element.type === "chart") return element.chartType === "line" ? "lineChart" : element.chartType === "pie" ? "pieChart" : "chart";
  if (element.type === "video") return "play";
  if (element.type === "code") return "code";
  if (element.type === "equation") return "function";
  if (element.type === "icon") return "shape";
  if (element.shape === "line") return "lineChart";
  if (element.type === "shape") return "shape";
  return "text";
}

function normalizePresentationSlideMeta(meta = {}, { title = "", body = "" } = {}) {
  const inferredLayout = inferPresentationSlideLayout(title, body);
  const inferredTheme = inferPresentationSlideTheme(title, body);
  const layout = normalizePresentationLayout(meta.layout || inferredLayout);
  const theme = normalizePresentationTheme(meta.theme || inferredTheme);
  const image = String(meta.image || meta.imageUrl || "").trim();
  const cta = String(meta.cta || meta.nextStep || "").trim();
  return {
    layout,
    theme,
    background: normalizePresentationColor(meta.background || meta.backgroundColor, presentationDefaultBackground(theme)),
    transition: normalizePresentationTransition(meta.transition),
    transitionDuration: clampPresentationNumber(meta.transitionDuration ?? meta.duration, 0.1, 10, 1),
    notes: String(meta.notes || meta.speakerNotes || "").trim(),
    image,
    cta,
    elements: normalizePresentationElements(meta.elements, { title, body, layout, image, cta })
  };
}

function splitPresentationSlideLines(lines = []) {
  const metadata = {};
  const bodyLines = [];

  for (const rawLine of lines) {
    const parsedMeta = parsePresentationSlideMetaLine(rawLine);
    if (parsedMeta) {
      Object.assign(metadata, parsedMeta);
      continue;
    }
    bodyLines.push(rawLine);
  }

  return { metadata, bodyLines };
}

function buildPresentationSlideMetaComment(slide = {}) {
  const meta = normalizePresentationSlideMeta(slide, {
    title: slide.title || "",
    body: slide.body || ""
  });
  return `<!-- hydria-slide: ${JSON.stringify(meta)} -->`;
}

function presentationSectionIdForIndex(content = "", slideIndex = 0) {
  const sections = deriveWorkspaceSections(content, state.currentWorkObjectFile || "slides.md")
    .filter((section) => isPresentationSection(section));
  const safeIndex = Math.max(0, Math.min(sections.length - 1, Number(slideIndex || 0)));
  return sections[safeIndex]?.id || "";
}

function derivePresentationDeck(content = "", fallbackTitle = "Untitled presentation") {
  const text = normalizePresentationSourceText(content);
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
    ?sections.map((slide, index) => {
        const parsed = splitPresentationSlideLines(slide.bodyLines);
        const rawBody = parsed.bodyLines.join("\n");
        const title = slide.title || `Slide ${index + 1}`;
        return {
          id: `slide-${index + 1}`,
          title,
          body: stripPresentationInternalMeta(rawBody),
          ...normalizePresentationSlideMeta(parsed.metadata, {
            title,
            body: rawBody
          })
        };
      })
    : [
        {
          id: "slide-1",
          title: "Slide 1",
          body: "Add the main message here.",
          ...normalizePresentationSlideMeta({ layout: "title", theme: "default" }, {
            title: "Slide 1",
            body: "Add the main message here."
          })
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
          body: "Add the first key message here.",
          layout: "title",
          theme: "default",
          notes: "",
          image: "",
          cta: ""
        }
      ];

  return [
    `# ${String(title || "Untitled presentation").trim()}`,
    "",
    ...safeSlides.flatMap((slide, index) => [
      `## Slide ${index + 1} - ${String(slide.title || "Untitled slide").trim()}`,
      buildPresentationSlideMetaComment(slide),
      stripPresentationInternalMeta(slide.body || "") || "Add the main point here.",
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
  const nextMode = ["view", "edit"].includes(mode) ? mode : "view";
  state.workspaceMode = nextMode === "view" && isPresentationWorkspace() ? "edit" : nextMode;
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
    case "canvas":
      return "Canvas";
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
  container.classList.toggle("hidden", isPresentationWorkspace());
  if (isPresentationWorkspace()) {
    return;
  }
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

function getWorkspacePreviewPane() {
  return el["workspace-preview"]?.closest(".workspace-preview-pane") || null;
}

function getWorkspacePreviewExpandButton() {
  return el["workspace-preview"]?.querySelector(".workspace-page-preview-expand-button") || null;
}

function updateWorkspacePreviewExpandButton() {
  const button = getWorkspacePreviewExpandButton();
  if (!button) {
    return;
  }
  const isExpanded = Boolean(state.workspacePreviewExpanded);
  button.textContent = isExpanded ? "Exit full screen" : "Full screen";
  button.title = isExpanded ? "Exit full screen" : "Open full screen";
  button.setAttribute("aria-label", button.title);
  button.setAttribute("aria-pressed", isExpanded ? "true" : "false");
}

function ensureWorkspacePreviewExpandedHost() {
  if (workspacePreviewExpandedOverlay?.isConnected && workspacePreviewExpandedFrame) {
    return workspacePreviewExpandedFrame;
  }

  workspacePreviewExpandedOverlay = document.createElement("div");
  workspacePreviewExpandedOverlay.className = "workspace-sheet-modal-overlay workspace-page-preview-modal-overlay";
  workspacePreviewExpandedOverlay.tabIndex = -1;

  const backdrop = document.createElement("div");
  backdrop.className = "workspace-sheet-modal-backdrop workspace-page-preview-modal-backdrop";
  backdrop.addEventListener("click", () => setWorkspacePreviewExpanded(false));

  const dialog = document.createElement("div");
  dialog.className = "workspace-sheet-modal-dialog workspace-page-preview-modal-dialog";

  workspacePreviewExpandedFrame = document.createElement("div");
  workspacePreviewExpandedFrame.className = "workspace-sheet-modal-scale-frame workspace-page-preview-modal-frame";

  workspacePreviewExpandedOverlay.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setWorkspacePreviewExpanded(false);
    }
  });

  dialog.appendChild(workspacePreviewExpandedFrame);
  workspacePreviewExpandedOverlay.append(backdrop, dialog);
  document.body.appendChild(workspacePreviewExpandedOverlay);
  return workspacePreviewExpandedFrame;
}

function mountWorkspacePreviewPane() {
  const pane = getWorkspacePreviewPane();
  if (!pane) {
    return;
  }

  const isExpanded = Boolean(state.workspacePreviewExpanded);
  pane.classList.toggle("is-page-expanded", isExpanded);
  document.body.classList.toggle("workspace-page-preview-expanded", isExpanded);

  if (isExpanded) {
    const frame = ensureWorkspacePreviewExpandedHost();
    if (!workspacePreviewExpandedPlaceholder && pane.parentNode) {
      workspacePreviewExpandedPlaceholder = document.createComment("workspace-preview-pane-placeholder");
      pane.parentNode.insertBefore(workspacePreviewExpandedPlaceholder, pane);
    }
    if (pane.parentElement !== frame || frame.firstElementChild !== pane) {
      frame.replaceChildren(pane);
    }
    workspacePreviewExpandedOverlay?.focus({ preventScroll: true });
  } else {
    if (workspacePreviewExpandedPlaceholder?.parentNode && pane.parentElement !== workspacePreviewExpandedPlaceholder.parentNode) {
      workspacePreviewExpandedPlaceholder.parentNode.insertBefore(pane, workspacePreviewExpandedPlaceholder);
    }
    workspacePreviewExpandedPlaceholder?.remove();
    workspacePreviewExpandedPlaceholder = null;
    workspacePreviewExpandedOverlay?.remove();
    workspacePreviewExpandedOverlay = null;
    workspacePreviewExpandedFrame = null;
  }

  updateWorkspacePreviewExpandButton();
}

function setWorkspacePreviewExpanded(nextExpanded = false) {
  state.workspacePreviewExpanded = Boolean(nextExpanded);
  mountWorkspacePreviewPane();
}

function enhanceWorkspacePreviewHeader() {
  const preview = el["workspace-preview"];
  const header = preview?.querySelector(":scope > .workspace-preview-header");
  if (!preview || !header || !state.currentWorkObject) {
    updateWorkspacePreviewExpandButton();
    return;
  }

  header.classList.add("has-page-controls");
  let actions = header.querySelector(".workspace-preview-header-actions");
  if (!actions) {
    actions = document.createElement("div");
    actions.className = "workspace-preview-header-actions";
    const kind = header.querySelector(":scope > .workspace-preview-kind");
    if (kind) {
      actions.appendChild(kind);
    }
    header.appendChild(actions);
  }

  let button = actions.querySelector(".workspace-page-preview-expand-button");
  if (!button) {
    button = document.createElement("button");
    button.type = "button";
    button.className = "workspace-page-preview-expand-button";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      setWorkspacePreviewExpanded(!state.workspacePreviewExpanded);
    });
    actions.appendChild(button);
  }

  mountWorkspacePreviewPane();
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
  const expandedSheet = document.querySelector(".workspace-sheet-modal-overlay .workspace-sheet-app.is-expanded");
  return Boolean(
    activeElement &&
      (
        preview.contains(activeElement) ||
        expandedSheet?.contains(activeElement)
      )
  );
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

function scheduleSheetCalculation(model = null) {
  if (!model || !Array.isArray(model.sheets)) return;
  if (sheetCalculationHandle) window.clearTimeout(sheetCalculationHandle);
  const requestId = ++sheetCalculationRequestId;
  sheetCalculationHandle = window.setTimeout(async () => {
    sheetCalculationHandle = null;
    try {
      const payload = await apiClient.calculateSheet(
        model,
        state.sheetCalculationEngineId
      );
      if (
        requestId !== sheetCalculationRequestId ||
        !isSheetWorkObject(state.currentWorkObject)
      ) {
        return;
      }
      state.sheetCalculation = payload.calculation || null;
      state.sheetCalculationEngineId =
        payload.calculation?.engineId || state.sheetCalculationEngineId;
      refreshPreviewPane();
    } catch (error) {
      state.sheetCalculation = {
        engine: "local-fallback",
        errors: [{ message: error.message || "Formula engine unavailable" }]
      };
    }
  }, 220);
}

function usesCollaborativeEditing() {
  return Boolean(
    state.currentWorkObjectId &&
      state.currentWorkObjectFile &&
      (
        isDocumentWorkObject(state.currentWorkObject) ||
        isSheetWorkObject(state.currentWorkObject)
      )
  );
}

function updateCollaborativeWorkObjectContent(content = "", revision = null) {
  if (!state.currentWorkObject) return;
  state.currentWorkObject = {
    ...state.currentWorkObject,
    ...(revision ? { revision: Number(revision) } : {}),
    content: String(content || ""),
    file: {
      ...(state.currentWorkObject.file || {}),
      path: state.currentWorkObjectFile,
      content: String(content || "")
    }
  };
  mergeWorkObject(state.currentWorkObject);
}

async function hydrateWorkObjectCollaboration() {
  if (!usesCollaborativeEditing()) return null;
  const payload = await apiClient.getWorkObjectCollaboration(
    state.currentWorkObjectId,
    {
      entryPath: state.currentWorkObjectFile,
      userId: state.currentUserId
    }
  );
  const collaboration = payload.collaboration || {};
  state.collaborationVersion = Number(collaboration.version || 0);
  state.collaborationPersistedRevision = Number(
    collaboration.persistedRevision || state.currentWorkObject?.revision || 1
  );
  state.collaborationServerContent = String(
    collaboration.content ?? currentContent()
  );
  updateCollaborativeWorkObjectContent(
    state.collaborationServerContent,
    state.collaborationPersistedRevision
  );
  return collaboration;
}

function scheduleCollaborativeOperation(previousContent = "", nextContent = "") {
  if (
    !usesCollaborativeEditing() ||
    state.collaborationApplyingRemote ||
    previousContent === nextContent
  ) {
    return;
  }
  if (!collaborationPendingChange) {
    collaborationPendingChange = {
      workObjectId: state.currentWorkObjectId,
      entryPath: state.currentWorkObjectFile,
      previousContent,
      nextContent
    };
  } else {
    collaborationPendingChange.nextContent = nextContent;
  }
  if (collaborationSyncHandle) window.clearTimeout(collaborationSyncHandle);
  collaborationSyncHandle = window.setTimeout(() => {
    collaborationSyncHandle = null;
    flushCollaborativeOperation().catch(handleError);
  }, 180);
}

async function sendQueuedCollaborationOperation(item = {}) {
  const payload = await apiClient.applyWorkObjectOperation(item.workObjectId, {
    entryPath: item.entryPath,
    userId: item.userId,
    clientId: state.collaborationClientId,
    baseVersion: item.baseVersion,
    operation: item.operation
  });
  const collaboration = payload.collaboration || {};
  if (
    String(item.workObjectId) === String(state.currentWorkObjectId) &&
    String(item.entryPath) === String(state.currentWorkObjectFile)
  ) {
    state.collaborationVersion = Number(
      collaboration.version || state.collaborationVersion
    );
    state.collaborationServerContent = String(
      collaboration.content ?? state.collaborationServerContent
    );
  }
  return collaboration;
}

async function flushCollaborativeOperation() {
  if (collaborationSyncHandle) {
    window.clearTimeout(collaborationSyncHandle);
    collaborationSyncHandle = null;
  }
  if (collaborationSending) {
    await collaborationSending;
    if (collaborationPendingChange) return flushCollaborativeOperation();
    return null;
  }
  const change = collaborationPendingChange;
  collaborationPendingChange = null;
  if (!change) return null;
  if (
    String(change.workObjectId) !== String(state.currentWorkObjectId) ||
    String(change.entryPath) !== String(state.currentWorkObjectFile)
  ) {
    return null;
  }
  const operation = buildCollaborationOperation(
    change.previousContent,
    change.nextContent,
    { sheet: isSheetWorkObject(state.currentWorkObject) }
  );
  if (!operation) return null;
  const item = {
    workObjectId: change.workObjectId,
    entryPath: change.entryPath,
    userId: state.currentUserId,
    baseVersion: state.collaborationVersion,
    operation
  };
  if (state.offline || !navigator.onLine) {
    state.collaborationQueueSize = queueCollaborationOperation(item);
    state.collaborationVersion += 1;
    setStatus(
      `Mode hors ligne : ${state.collaborationQueueSize} modification(s) en attente.`
    );
    return null;
  }

  collaborationSending = sendQueuedCollaborationOperation(item);
  try {
    const collaboration = await collaborationSending;
    state.collaborationPersistedRevision = Number(
      collaboration.persistedRevision || state.collaborationPersistedRevision
    );
    return collaboration;
  } catch (error) {
    if (!navigator.onLine || Number(error?.status || 0) >= 500) {
      state.collaborationQueueSize = queueCollaborationOperation(item);
      state.collaborationVersion = Math.max(
        state.collaborationVersion,
        Number(item.baseVersion || 0) + 1
      );
      persistLocalWorkspaceDraft();
      return null;
    }
    throw error;
  } finally {
    collaborationSending = null;
    if (collaborationPendingChange) {
      scheduleCollaborativeOperation(
        collaborationPendingChange.previousContent,
        collaborationPendingChange.nextContent
      );
    }
  }
}

function scheduleAutoSave() {
  clearAutoSaveTimer();

  if (
    !state.editorDirty ||
    !state.currentWorkObjectId ||
    !state.currentWorkObjectFile ||
    state.loading ||
    state.offline ||
    usesCollaborativeEditing()
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

  const previousContent = currentDraftContent();
  const normalized = String(nextValue || "");
  state.editorDirty = normalized !== currentEditorBaseline();
  state.editorDraft = normalized;
  state.editorDraftKey = currentEditorKey();
  persistLocalWorkspaceDraft();
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

  if (usesCollaborativeEditing()) {
    scheduleCollaborativeOperation(previousContent, normalized);
  } else {
    scheduleAutoSave();
  }

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
    state.currentSurfaceId = preferredSurfaceForLens(state.currentWorkObject) || surfaces[0].id;
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

async function runCoreChatPrompt(prompt = "", attachments = []) {
  const input = String(prompt || "").trim();
  const selectedAttachments = Array.from(attachments || []);
  if ((!input && !selectedAttachments.length) || state.coreChatLoading) {
    return;
  }
  if (!state.currentUserId) {
    throw new Error("Create or select a user first");
  }

  const pendingMessage = {
    id: `core-chat-pending-${Date.now()}`,
    role: "user",
    content: input || "Analyse les fichiers joints.",
    attachments: selectedAttachments.map((file) => ({
      name: file.name,
      sizeBytes: file.size
    })),
    created_at: new Date().toISOString(),
    pending: true,
    conversationId: state.currentConversationId || null,
    persistedMessageCount: state.messages.length
  };
  state.coreChatPendingMessages.push(pendingMessage);
  state.coreChatLoading = true;
  state.coreChatStreamingText = "";
  state.coreChatStatus = "Hydria Core analyse la demande...";
  state.coreChatGenerationId = crypto.randomUUID();
  renderWorkspace();
  setStatus("Hydria Core is responding...");
  try {
    await ensureConversation();
    pendingMessage.conversationId = state.currentConversationId;
    let finalAnswer = "";
    await apiClient.streamHydriaCore({
      userId: state.currentUserId,
      conversationId: state.currentConversationId,
      projectId: state.currentProjectId || "",
      prompt: input,
      attachments: selectedAttachments,
      generationId: state.coreChatGenerationId,
      model: state.coreChatModel,
      toolMode: state.coreChatToolMode
    }, (event, payload) => {
      if (event === "start") {
        state.coreChatPendingMessages = state.coreChatPendingMessages.filter(
          (message) => message.id !== pendingMessage.id
        );
      } else if (event === "status") {
        state.coreChatStatus = payload.text || "";
      } else if (event === "chunk") {
        state.coreChatStreamingText += payload.text || "";
      } else if (event === "done") {
        finalAnswer = payload.answer || state.coreChatStreamingText;
      } else if (event === "stopped") {
        state.coreChatStatus = "Generation arretee.";
      }
      renderWorkspace();
    });
    await loadMessages();
    await loadChatWorkspaceData();
    state.coreChatPendingMessages = state.coreChatPendingMessages.filter(
      (message) => message.id !== pendingMessage.id
    );
    updateLastRun({
      strategy: "hydria-core-direct-chat",
      modelsUsed: ["Hydria Core"],
      meta: {
        externalHydria: true
      }
    });
    setStatus(finalAnswer || state.coreChatStatus || "Hydria Core responded.");
  } catch (error) {
    await loadMessages().catch(() => {});
    const persisted = state.messages
      .slice(pendingMessage.persistedMessageCount)
      .some((message) => message.role === "user");
    if (persisted) {
      state.coreChatPendingMessages = state.coreChatPendingMessages.filter(
        (message) => message.id !== pendingMessage.id
      );
    }
    throw error;
  } finally {
    state.coreChatLoading = false;
    state.coreChatStreamingText = "";
    state.coreChatGenerationId = "";
    state.coreChatStatus = "";
    renderWorkspace();
  }
}

async function loadChatWorkspaceData() {
  if (!state.currentUserId) {
    state.chatProjects = [];
    state.conversationTree = [];
    return;
  }
  const [catalog, projects, tree] = await Promise.all([
    apiClient.getHydriaChatCatalog().catch(() => ({ models: [], tools: [] })),
    apiClient.listChatProjects(state.currentUserId).catch(() => ({ projects: [] })),
    apiClient.getConversationTree(state.currentUserId).catch(() => ({ tree: [] }))
  ]);
  state.coreChatCatalog = {
    models: catalog.models || [],
    tools: catalog.tools || []
  };
  state.chatProjects = projects.projects || [];
  state.conversationTree = tree.tree || [];
}

function flattenConversationTree(nodes = [], depth = 0, output = []) {
  nodes.forEach((node) => {
    output.push({ ...node, depth });
    flattenConversationTree(node.children || [], depth + 1, output);
  });
  return output;
}

function renderCoreChatWorkspace(container) {
  container.innerHTML = "";
  container.classList.add("workspace-launcher-core-chat");

  const page = document.createElement("section");
  page.className = "core-chat-page";

  const header = document.createElement("header");
  header.className = "core-chat-header";
  const headingGroup = document.createElement("div");
  headingGroup.className = "core-chat-heading";
  const identity = document.createElement("span");
  identity.className = "core-chat-identity";
  identity.textContent = "H";
  const headingCopy = document.createElement("div");
  const heading = document.createElement("h3");
  heading.textContent = "Chat";
  const model = document.createElement("span");
  model.className = "core-chat-model";
  const modelDot = document.createElement("span");
  modelDot.className = "core-chat-model-dot";
  const modelLabel = document.createElement("span");
  modelLabel.textContent = "Hydria Core";
  const coreReady = Boolean(state.config?.config?.hydriaExternal?.configured);
  model.classList.toggle("is-offline", !coreReady);
  model.append(modelDot, modelLabel);
  headingCopy.append(heading, model);
  headingGroup.append(identity, headingCopy);

  const actions = document.createElement("div");
  actions.className = "core-chat-header-actions";
  const modelSelect = document.createElement("select");
  modelSelect.className = "core-chat-header-select";
  modelSelect.title = "Modele";
  const modelCatalog = state.coreChatCatalog.models.length
    ? state.coreChatCatalog.models
    : [
        { id: "hydria-core", label: "Hydria Core", available: true },
        { id: "local", label: "Hydria Local", available: true }
      ];
  modelCatalog.forEach((entry) => {
    const option = document.createElement("option");
    option.value = entry.id;
    option.textContent = entry.available === false ? `${entry.label} indisponible` : entry.label;
    option.disabled = entry.available === false;
    option.title = (entry.capabilities || []).join(", ");
    modelSelect.appendChild(option);
  });
  modelSelect.value = state.coreChatModel;
  modelSelect.disabled = state.coreChatLoading;
  modelSelect.addEventListener("change", () => {
    state.coreChatModel = modelSelect.value;
  });
  const toolSelect = document.createElement("select");
  toolSelect.className = "core-chat-header-select";
  toolSelect.title = "Outils";
  const toolCatalog = state.coreChatCatalog.tools.length
    ? state.coreChatCatalog.tools
    : [
        { id: "auto", label: "Outils auto", available: true },
        { id: "files", label: "Fichiers", available: true },
        { id: "none", label: "Sans outils", available: true }
      ];
  toolCatalog.forEach((entry) => {
    const option = document.createElement("option");
    option.value = entry.id;
    option.textContent = entry.label;
    option.disabled = entry.available === false;
    toolSelect.appendChild(option);
  });
  toolSelect.value = state.coreChatToolMode;
  toolSelect.disabled = state.coreChatLoading;
  toolSelect.addEventListener("change", () => {
    state.coreChatToolMode = toolSelect.value;
  });
  const searchButton = document.createElement("button");
  searchButton.type = "button";
  searchButton.className = "core-chat-icon-button";
  searchButton.title = "Rechercher dans les conversations";
  searchButton.textContent = "?";
  searchButton.addEventListener("click", async () => {
    const query = window.prompt("Rechercher dans les conversations", state.conversationSearch);
    if (query === null) return;
    state.conversationSearch = query.trim();
    const payload = await apiClient.listConversations(state.currentUserId, {
      search: state.conversationSearch,
      archived: state.showArchivedConversations ? 1 : ""
    });
    state.conversations = payload.conversations || [];
    renderConversations();
  });
  const archiveButton = document.createElement("button");
  archiveButton.type = "button";
  archiveButton.className = "core-chat-icon-button";
  archiveButton.title = state.showArchivedConversations
    ? "Restaurer cette conversation"
    : "Archiver cette conversation";
  archiveButton.textContent = state.showArchivedConversations ? "R" : "A";
  archiveButton.disabled = !state.currentConversationId || state.coreChatLoading;
  archiveButton.addEventListener("click", async () => {
    await apiClient.updateConversation(state.currentConversationId, {
      userId: state.currentUserId,
      archived: !state.showArchivedConversations
    });
    state.conversations = state.conversations.filter(
      (conversation) => Number(conversation.id) !== Number(state.currentConversationId)
    );
    const next = state.conversations[0];
    if (next) await selectConversation(next.id);
    else {
      state.currentConversationId = null;
      state.messages = [];
      renderWorkspace();
    }
  });
  const archiveListButton = document.createElement("button");
  archiveListButton.type = "button";
  archiveListButton.className = `core-chat-icon-button${
    state.showArchivedConversations ? " active" : ""
  }`;
  archiveListButton.title = state.showArchivedConversations
    ? "Afficher les conversations actives"
    : "Afficher les archives";
  archiveListButton.textContent = "H";
  archiveListButton.addEventListener("click", async () => {
    state.showArchivedConversations = !state.showArchivedConversations;
    const payload = await apiClient.listConversations(state.currentUserId, {
      search: state.conversationSearch,
      archived: state.showArchivedConversations ? 1 : ""
    });
    state.conversations = payload.conversations || [];
    const next = state.conversations[0];
    if (next) await selectConversation(next.id);
    else {
      state.currentConversationId = null;
      state.messages = [];
      renderConversations();
      renderWorkspace();
    }
  });
  const shareButton = document.createElement("button");
  shareButton.type = "button";
  shareButton.className = "core-chat-icon-button";
  shareButton.title = "Partager cette conversation";
  shareButton.textContent = "S";
  shareButton.disabled = !state.currentConversationId;
  shareButton.addEventListener("click", async () => {
    const payload = await apiClient.shareConversation(
      state.currentConversationId,
      state.currentUserId
    );
    const shareUrl = `${window.location.origin}${payload.shareUrl}`;
    await navigator.clipboard?.writeText(shareUrl).catch(() => {});
    window.prompt("Lien de partage", shareUrl);
  });
  const newChatButton = document.createElement("button");
  newChatButton.type = "button";
  newChatButton.className = "core-chat-icon-button";
  newChatButton.title = "New chat";
  newChatButton.setAttribute("aria-label", "New chat");
  newChatButton.appendChild(
    createWorkspaceIconNode("insert", {
      className: "core-chat-button-icon",
      label: "New chat"
    })
  );
  newChatButton.disabled = state.coreChatLoading;
  newChatButton.addEventListener("click", async () => {
    await createConversation();
    await activateWorkspacePage(workspacePageFromSlug("chat"), { historyMode: "replace" });
  });
  const clearButton = document.createElement("button");
  clearButton.type = "button";
  clearButton.className = "core-chat-icon-button";
  clearButton.title = "Clear conversation";
  clearButton.setAttribute("aria-label", "Clear conversation");
  clearButton.appendChild(
    createWorkspaceIconNode("delete", {
      className: "core-chat-button-icon",
      label: "Clear"
    })
  );
  clearButton.disabled = !state.currentConversationId || state.coreChatLoading;
  clearButton.addEventListener("click", async () => {
    await clearConversation();
    renderWorkspace();
  });
  actions.append(
    modelSelect,
    toolSelect,
    searchButton,
    archiveListButton,
    archiveButton,
    shareButton,
    newChatButton,
    clearButton
  );
  header.append(headingGroup, actions);

  const conversationRail = document.createElement("aside");
  conversationRail.className = "core-chat-conversation-rail";
  const railHeader = document.createElement("div");
  railHeader.className = "core-chat-rail-header";
  const railTitle = document.createElement("strong");
  railTitle.textContent = "Conversations";
  const newProjectButton = document.createElement("button");
  newProjectButton.type = "button";
  newProjectButton.className = "core-chat-icon-button";
  newProjectButton.title = "Nouveau projet";
  newProjectButton.textContent = "+";
  newProjectButton.addEventListener("click", async () => {
    const name = window.prompt("Nom du projet");
    if (!name?.trim()) return;
    const payload = await apiClient.createChatProject({
      userId: state.currentUserId,
      name: name.trim()
    });
    state.chatProjects.unshift(payload.project);
    state.currentChatProjectId = payload.project.id;
    renderWorkspace();
  });
  railHeader.append(railTitle, newProjectButton);

  const railFilters = document.createElement("div");
  railFilters.className = "core-chat-rail-filters";
  const projectSelect = document.createElement("select");
  projectSelect.setAttribute("aria-label", "Projet de conversations");
  const allProjects = document.createElement("option");
  allProjects.value = "";
  allProjects.textContent = "Tous les projets";
  projectSelect.appendChild(allProjects);
  state.chatProjects.forEach((project) => {
    const option = document.createElement("option");
    option.value = project.id;
    option.textContent = project.name;
    projectSelect.appendChild(option);
  });
  projectSelect.value = state.currentChatProjectId;
  projectSelect.addEventListener("change", () => {
    state.currentChatProjectId = projectSelect.value;
    renderWorkspace();
  });
  const railSearch = document.createElement("input");
  railSearch.type = "search";
  railSearch.placeholder = "Rechercher";
  railSearch.value = state.conversationSearch;
  railSearch.addEventListener("input", () => {
    state.conversationSearch = railSearch.value;
    renderWorkspace();
  });
  railFilters.append(projectSelect, railSearch);

  const conversationTreeList = document.createElement("div");
  conversationTreeList.className = "core-chat-tree";
  const normalizedSearch = state.conversationSearch.trim().toLowerCase();
  const treeEntries = flattenConversationTree(state.conversationTree.length
    ? state.conversationTree
    : state.conversations.map((conversation) => ({ ...conversation, children: [] })))
    .filter((conversation) =>
      (!state.currentChatProjectId || conversation.project_id === state.currentChatProjectId) &&
      (!normalizedSearch ||
        String(conversation.title || "").toLowerCase().includes(normalizedSearch))
    );
  treeEntries.forEach((conversation) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `core-chat-tree-item${
      Number(conversation.id) === Number(state.currentConversationId) ? " active" : ""
    }`;
    button.style.setProperty("--branch-depth", String(conversation.depth || 0));
    const titleNode = document.createElement("span");
    titleNode.textContent = conversation.title || "Conversation";
    const metaNode = document.createElement("small");
    metaNode.textContent = conversation.depth
      ? `Branche · ${conversation.message_count || 0} messages`
      : `${conversation.message_count || 0} messages`;
    button.append(titleNode, metaNode);
    button.addEventListener("click", () => {
      selectConversation(conversation.id).catch(handleError);
    });
    conversationTreeList.appendChild(button);
  });
  if (!treeEntries.length) {
    const emptyTree = document.createElement("p");
    emptyTree.className = "core-chat-tree-empty";
    emptyTree.textContent = "Aucune conversation.";
    conversationTreeList.appendChild(emptyTree);
  }

  const currentConversation = state.conversations.find(
    (conversation) => Number(conversation.id) === Number(state.currentConversationId)
  );
  if (currentConversation) {
    const organize = document.createElement("div");
    organize.className = "core-chat-organize";
    const folderInput = document.createElement("input");
    folderInput.placeholder = "Dossier";
    folderInput.value = currentConversation.folder || "";
    folderInput.setAttribute("aria-label", "Dossier de la conversation");
    const assignProject = document.createElement("select");
    assignProject.setAttribute("aria-label", "Projet de la conversation");
    const noProject = document.createElement("option");
    noProject.value = "";
    noProject.textContent = "Sans projet";
    assignProject.appendChild(noProject);
    state.chatProjects.forEach((project) => {
      const option = document.createElement("option");
      option.value = project.id;
      option.textContent = project.name;
      assignProject.appendChild(option);
    });
    assignProject.value = currentConversation.project_id || "";
    const saveOrganize = async () => {
      const payload = await apiClient.updateConversation(currentConversation.id, {
        userId: state.currentUserId,
        folder: folderInput.value.trim(),
        projectId: assignProject.value
      });
      Object.assign(currentConversation, payload.conversation);
      await loadChatWorkspaceData();
      renderWorkspace();
    };
    folderInput.addEventListener("change", () => saveOrganize().catch(handleError));
    assignProject.addEventListener("change", () => saveOrganize().catch(handleError));
    organize.append(folderInput, assignProject);
    conversationRail.append(railHeader, railFilters, conversationTreeList, organize);
  } else {
    conversationRail.append(railHeader, railFilters, conversationTreeList);
  }

  const thread = document.createElement("div");
  thread.className = "core-chat-thread";
  const pendingMessages = state.coreChatPendingMessages.filter(
    (message) =>
      !message.conversationId ||
      Number(message.conversationId) === Number(state.currentConversationId || 0)
  );
  const chatMessages = [
    ...state.messages,
    ...pendingMessages
  ];
  if (!chatMessages.length) {
    const empty = document.createElement("div");
    empty.className = "core-chat-empty";
    const emptyMark = document.createElement("span");
    emptyMark.className = "core-chat-empty-mark";
    emptyMark.textContent = "H";
    const emptyTitle = document.createElement("h4");
    emptyTitle.textContent = "Comment puis-je vous aider ?";
    const suggestions = document.createElement("div");
    suggestions.className = "core-chat-suggestions";
    [
      "Structurer une idée",
      "Rédiger un plan",
      "Analyser un problème",
      "Préparer une synthèse"
    ].forEach((label) => {
      const suggestion = document.createElement("button");
      suggestion.type = "button";
      suggestion.textContent = label;
      suggestion.addEventListener("click", () => {
        input.value = label;
        input.dispatchEvent(new Event("input"));
        input.focus();
      });
      suggestions.appendChild(suggestion);
    });
    empty.append(emptyMark, emptyTitle, suggestions);
    thread.appendChild(empty);
  } else {
    chatMessages.forEach((message, messageIndex) => {
      const previousUserMessage = [...chatMessages]
        .slice(0, messageIndex)
        .reverse()
        .find((candidate) => candidate.role === "user");
      thread.appendChild(
        renderChatMessage(message, {
          onOpenWorkObject: (workObject) =>
            selectWorkObject(workObject.id, preferredOpenPath(workObject)).catch(handleError),
          onContinueWithObject: (workObject) =>
            continueWithWorkObject(workObject.id, preferredOpenPath(workObject)).catch(handleError),
          showActions: true,
          onEditMessage: async (selectedMessage) => {
            if (selectedMessage.role !== "user" || !Number(selectedMessage.id)) {
              input.value = String(selectedMessage.content || "");
              input.dispatchEvent(new Event("input"));
              input.focus();
              return;
            }
            const payload = await apiClient.branchConversation(state.currentConversationId, {
              userId: state.currentUserId,
              messageId: selectedMessage.id,
              title: `${state.conversations.find((item) => Number(item.id) === Number(state.currentConversationId))?.title || "Conversation"} (branche)`
            });
            state.conversations.unshift(payload.conversation);
            await loadChatWorkspaceData();
            await selectConversation(payload.conversation.id);
            input.value = String(selectedMessage.content || "");
            input.dispatchEvent(new Event("input"));
            input.focus();
          },
          onRegenerateMessage: () => {
            const prompt = String(previousUserMessage?.content || "").trim();
            if (prompt) {
              runCoreChatPrompt(prompt).catch(handleError);
            }
          }
        })
      );
    });
  }
  if (state.coreChatLoading) {
    if (state.coreChatStreamingText) {
      thread.appendChild(
        renderChatMessage({
          id: `stream-${state.coreChatGenerationId}`,
          role: "assistant",
          content: state.coreChatStreamingText,
          streaming: true
        })
      );
    } else {
      const thinking = document.createElement("article");
      thinking.className = "message assistant core-chat-thinking";
      const bubble = document.createElement("div");
      bubble.className = "message-bubble";
      const dots = document.createElement("span");
      dots.className = "core-chat-thinking-dots";
      dots.innerHTML = "<i></i><i></i><i></i>";
      const status = document.createElement("small");
      status.textContent = state.coreChatStatus || "Hydria Core reflechit...";
      bubble.append(dots, status);
      thinking.appendChild(bubble);
      thread.appendChild(thinking);
    }
  }

  const form = document.createElement("form");
  form.className = "core-chat-composer";
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.multiple = true;
  fileInput.className = "core-chat-file-input";
  fileInput.accept = [
    ".pdf", ".doc", ".docx", ".txt", ".md", ".rtf", ".log",
    ".csv", ".tsv", ".xls", ".xlsx", ".ods",
    ".ppt", ".pptx", ".odp",
    ".json", ".jsonc", ".jsonl", ".ndjson", ".xml", ".yaml", ".yml", ".toml",
    ".env", ".cfg", ".conf", ".config", ".ini", ".properties",
    ".js", ".jsx", ".ts", ".tsx", ".py", ".java", ".cs", ".cpp", ".c",
    ".h", ".hpp", ".go", ".rs", ".php", ".rb", ".sql", ".html", ".css",
    ".kt", ".lua", ".ps1", ".sh", ".swift", ".bat",
    ".zip", ".7z", ".rar", ".tar", ".gz", ".bz2", ".tgz", ".xz",
    "image/*", "audio/*", "video/*"
  ].join(",");
  const attachmentList = document.createElement("div");
  attachmentList.className = "core-chat-attachment-list";
  const composerControls = document.createElement("div");
  composerControls.className = "core-chat-composer-controls";
  const attachButton = document.createElement("button");
  attachButton.type = "button";
  attachButton.className = "core-chat-attach-button";
  attachButton.title = "Importer des fichiers";
  attachButton.setAttribute("aria-label", "Importer des fichiers");
  attachButton.appendChild(
    createWorkspaceIconNode("attachment", {
      className: "core-chat-button-icon",
      label: "Importer des fichiers"
    })
  );
  attachButton.disabled = state.coreChatLoading;
  attachButton.addEventListener("click", () => fileInput.click());
  const input = document.createElement("textarea");
  input.rows = 1;
  input.placeholder = "Écrivez votre message...";
  input.disabled = state.coreChatLoading;
  const sendButton = document.createElement("button");
  sendButton.type = state.coreChatLoading ? "button" : "submit";
  sendButton.className = "core-chat-send-button";
  sendButton.title = state.coreChatLoading ? "Arreter" : "Send";
  sendButton.setAttribute("aria-label", state.coreChatLoading ? "Arreter" : "Send");
  sendButton.disabled = !state.coreChatLoading;
  if (state.coreChatLoading) {
    sendButton.classList.add("is-stop");
    const stopMark = document.createElement("span");
    stopMark.className = "core-chat-stop-mark";
    sendButton.appendChild(stopMark);
    sendButton.addEventListener("click", () => {
      if (state.coreChatGenerationId) {
        apiClient.stopHydriaCore(state.coreChatGenerationId).catch(handleError);
        state.coreChatStatus = "Arret demande...";
        renderWorkspace();
      }
    });
  } else {
    sendButton.appendChild(
      createWorkspaceIconNode("chevronUp", {
        className: "core-chat-button-icon",
        label: "Send"
      })
    );
  }
  composerControls.append(attachButton, input, sendButton);
  form.append(fileInput, attachmentList, composerControls);

  const updateComposerState = () => {
    attachmentList.innerHTML = "";
    attachmentList.classList.toggle("hidden", !state.coreChatAttachments.length);

    state.coreChatAttachments.forEach((file, index) => {
      const chip = document.createElement("div");
      chip.className = "core-chat-attachment-chip";
      const icon = createWorkspaceIconNode("page", {
        className: "core-chat-attachment-icon",
        label: "File"
      });
      const copy = document.createElement("span");
      copy.className = "core-chat-attachment-copy";
      const name = document.createElement("strong");
      name.textContent = file.name;
      const size = document.createElement("small");
      size.textContent = formatBytes(file.size);
      copy.append(name, size);
      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "core-chat-attachment-remove";
      removeButton.title = `Retirer ${file.name}`;
      removeButton.setAttribute("aria-label", `Retirer ${file.name}`);
      removeButton.appendChild(
        createWorkspaceIconNode("close", {
          className: "core-chat-attachment-remove-icon",
          label: "Retirer"
        })
      );
      removeButton.disabled = state.coreChatLoading;
      removeButton.addEventListener("click", () => {
        state.coreChatAttachments = state.coreChatAttachments.filter(
          (_, fileIndex) => fileIndex !== index
        );
        updateComposerState();
      });
      chip.append(icon, copy, removeButton);
      attachmentList.appendChild(chip);
    });

    sendButton.disabled = state.coreChatLoading
      ? false
      : !input.value.trim() && !state.coreChatAttachments.length;
  };

  const addFiles = (files = []) => {
    const attachmentConfig = state.config?.config?.attachments || {};
    const maxFiles = Number(attachmentConfig.maxFiles || 6);
    const maxFileSize = Number(attachmentConfig.maxFileSizeBytes || 15 * 1024 * 1024);
    const availableSlots = Math.max(0, maxFiles - state.coreChatAttachments.length);
    const incoming = Array.from(files || []);
    const accepted = incoming
      .filter((file) => {
        if (file.size > maxFileSize) {
          setStatus(`${file.name} dépasse la taille maximale de ${formatBytes(maxFileSize)}.`);
          return false;
        }
        return true;
      })
      .slice(0, availableSlots);

    if (incoming.length > availableSlots) {
      setStatus(`Hydria accepte jusqu'à ${maxFiles} fichiers par message.`);
    }
    state.coreChatAttachments = [...state.coreChatAttachments, ...accepted];
    fileInput.value = "";
    updateComposerState();
  };

  fileInput.addEventListener("change", (event) => addFiles(event.target.files));
  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 180)}px`;
    updateComposerState();
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (input.value.trim() || state.coreChatAttachments.length) {
        form.requestSubmit();
      }
    }
  });
  form.addEventListener("dragover", (event) => {
    event.preventDefault();
    form.classList.add("is-dragover");
  });
  form.addEventListener("dragleave", (event) => {
    if (!form.contains(event.relatedTarget)) {
      form.classList.remove("is-dragover");
    }
  });
  form.addEventListener("drop", (event) => {
    event.preventDefault();
    form.classList.remove("is-dragover");
    addFiles(event.dataTransfer?.files || []);
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const prompt = input.value.trim();
    const attachments = [...state.coreChatAttachments];
    if (!prompt && !attachments.length) {
      return;
    }
    input.value = "";
    input.style.height = "auto";
    state.coreChatAttachments = [];
    updateComposerState();
    runCoreChatPrompt(prompt, attachments).catch(handleError);
  });
  updateComposerState();

  const composerDock = document.createElement("div");
  composerDock.className = "core-chat-composer-dock";
  composerDock.appendChild(form);
  const chatMain = document.createElement("div");
  chatMain.className = "core-chat-main";
  chatMain.append(thread, composerDock);
  const chatLayout = document.createElement("div");
  chatLayout.className = "core-chat-layout";
  chatLayout.append(conversationRail, chatMain);
  page.append(header, chatLayout);
  container.appendChild(page);
  window.requestAnimationFrame(() => {
    thread.scrollTop = thread.scrollHeight;
    if (!chatMessages.length && !state.coreChatLoading) {
      input.focus();
    }
  });
}

function renderWorkspaceSwitcher(hasVisibleWorkspace = false) {
  const container = el["workspace-switcher"];
  if (!container) {
    return;
  }
  container.innerHTML = "";
  container.classList.remove("hidden");
  container.setAttribute("aria-label", "Hydria workspaces");

  const items = workspaceSwitcherItems();
  const activePage = currentWorkspacePage();
  const projectObjects = allWorkspaceWorkObjects();

  const overview = document.createElement("button");
  overview.type = "button";
  overview.className = `workspace-switcher-chip workspace-switcher-home${
    activePage ? "" : " active"
  }`;
  overview.textContent = "Overview";
  overview.setAttribute("aria-current", activePage ? "false" : "page");
  overview.addEventListener("click", () => {
    activateWorkspacePage(null).catch(handleError);
  });
  container.appendChild(overview);

  items.forEach((item) => {
    const count = projectObjects.filter(
      (workObject) => workspacePageForWorkObject(workObject)?.slug === item.slug
    ).length;
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `workspace-switcher-chip${activePage?.slug === item.slug ? " active" : ""}`;
    chip.setAttribute("aria-current", activePage?.slug === item.slug ? "page" : "false");
    const label = document.createElement("span");
    label.textContent = item.label;
    const badge = document.createElement("small");
    badge.textContent = String(count);
    badge.setAttribute("aria-label", `${count} ${item.label} objects`);
    chip.append(label, badge);
    chip.addEventListener("click", () => {
      activateWorkspacePage(item).catch(handleError);
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
  const objects = allWorkspaceWorkObjects();
  const page = currentWorkspacePage();
  if (!page) {
    return objects;
  }
  return objects.filter(
    (workObject) => workspacePageForWorkObject(workObject)?.slug === page.slug
  );
}

function isSheetWorkObject(workObject = null) {
  if (!workObject) {
    return false;
  }

  const kind = String(workObject.objectKind || workObject.kind || "").toLowerCase();
  const family = String(workObject.workspaceFamilyId || workObject.workspaceFamilyLabel || "").toLowerCase();
  const fileList = getEditableFiles(workObject).join(" ");

  return (
    kind === "dataset" ||
    family.includes("data_spreadsheet") ||
    family.includes("spreadsheet") ||
    /\.(csv|tsv|xlsx|xlsm|xls)\b/i.test(fileList)
  );
}

function isDocumentWorkObject(workObject = null) {
  if (!workObject) {
    return false;
  }

  const pageSlug = workspacePageForWorkObject(workObject)?.slug || "";
  if (pageSlug) {
    return pageSlug === "docs";
  }

  const kind = String(workObject.objectKind || workObject.kind || "").toLowerCase();
  const family = String(workObject.workspaceFamilyId || workObject.workspaceFamilyLabel || "").toLowerCase();
  const fileList = getEditableFiles(workObject).join(" ");

  return (
    kind === "document" ||
    family.includes("document_knowledge") ||
    /\.(md|markdown|txt|html?)\b/i.test(fileList)
  );
}

function currentWorkspaceDocumentListConfig() {
  const page = currentWorkspacePage();
  if (page?.slug === "docs") {
    return {
      title: "Open Docs",
      newTitle: "New Docs document",
      newKind: "document",
      newFamily: "document_knowledge",
      newLabel: "Docs",
      emptyText: "Create a Docs document to start working with multiple files.",
      defaultMeta: "Document workspace",
      renamePrompt: "Nom du document Docs",
      keepOneStatus: "Garde au moins un document Docs ouvert.",
      matches: isDocumentWorkObject
    };
  }
  if (page?.slug === "sheets") {
    return {
      title: "Open Sheets",
      newTitle: "New Sheets document",
      newKind: "dataset",
      newFamily: "data_spreadsheet",
      newLabel: "Sheets",
      emptyText: "Create a Sheets document to start working with multiple files.",
      defaultMeta: "Spreadsheet workspace",
      renamePrompt: "Nom du document Sheets",
      keepOneStatus: "Garde au moins un document Sheets ouvert.",
      matches: isSheetWorkObject
    };
  }
  return null;
}

function workspaceDocumentMeta(workObject = {}, config = currentWorkspaceDocumentListConfig()) {
  const primaryPath = workObject.primaryFile || getEditableFiles(workObject)[0] || "";
  const fileLabel = friendlyFileLabel(primaryPath);
  const status = workObject.status || "";
  const revision = workObject.revision ? `rev. ${workObject.revision}` : "";
  return [fileLabel, status, revision].filter(Boolean).join(" | ") || config?.defaultMeta || "Workspace document";
}

function isSheetDocumentClosed(workObjectId = "") {
  return state.closedSheetDocumentIds.includes(String(workObjectId || ""));
}

function reopenSheetDocument(workObjectId = "") {
  const id = String(workObjectId || "");
  if (!id) {
    return;
  }
  state.closedSheetDocumentIds = state.closedSheetDocumentIds.filter((item) => item !== id);
}

function markSheetDocumentClosed(workObjectId = "") {
  const id = String(workObjectId || "");
  if (!id || isSheetDocumentClosed(id)) {
    return;
  }
  state.closedSheetDocumentIds = [...state.closedSheetDocumentIds, id];
}

function workspaceDocumentsForConfig(config = currentWorkspaceDocumentListConfig()) {
  if (!config?.matches) {
    return [];
  }

  const candidates = [
    config.matches(state.currentWorkObject) ? state.currentWorkObject : null,
    ...workspaceWorkObjects().filter(config.matches),
    ...state.workObjects.filter((workObject) => {
      if (!config.matches(workObject)) {
        return false;
      }
      if (!state.currentProjectId) {
        return true;
      }
      return String(workObject.projectId || "") === String(state.currentProjectId);
    })
  ].filter(Boolean);

  const seen = new Set();
  const query = state.workspaceLibraryQuery.trim().toLowerCase();
  return candidates
    .filter((workObject) => {
      const id = String(workObject.id || "");
      if (!id || seen.has(id)) {
        return false;
      }
      seen.add(id);
      return true;
    })
    .filter((workObject) => !isSheetDocumentClosed(workObject.id))
    .filter((workObject) =>
      state.workspaceLibraryShowTrash
        ? String(workObject.status || "").toLowerCase() === "trashed"
        : String(workObject.status || "").toLowerCase() !== "trashed"
    )
    .filter(
      (workObject) =>
        state.workspaceLibraryShowArchived ||
        String(workObject.status || "").toLowerCase() !== "archived"
    )
    .filter((workObject) => {
      if (!query) {
        return true;
      }
      if (
        state.workspaceLibrarySearchResults.some(
          (result) => String(result.id) === String(workObject.id)
        )
      ) {
        return true;
      }
      return [
        workObject.title,
        workObject.summary,
        workObject.primaryFile,
        workObject.workspaceFamilyLabel,
        workObject.status
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    })
    .sort((left, right) => {
      const favoriteDelta =
        Number(Boolean(right.metadata?.favorite)) -
        Number(Boolean(left.metadata?.favorite));
      if (favoriteDelta) {
        return favoriteDelta;
      }
      return new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0);
    });
}

function workspaceSheetDocuments() {
  return workspaceDocumentsForConfig({
    matches: isSheetWorkObject,
    defaultMeta: "Spreadsheet workspace"
  });
}

function hideWorkspaceSheetDocumentMenu() {
  const menu = document.getElementById("workspace-sheet-document-menu");
  if (menu) {
    menu.hidden = true;
    menu.innerHTML = "";
  }
}

function ensureWorkspaceSheetDocumentMenu() {
  let menu = document.getElementById("workspace-sheet-document-menu");
  if (menu) {
    return menu;
  }

  menu = document.createElement("div");
  menu.id = "workspace-sheet-document-menu";
  menu.className = "workspace-sheet-document-menu";
  menu.hidden = true;
  menu.addEventListener("click", (event) => {
    event.stopPropagation();
  });
  menu.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  document.body.appendChild(menu);
  return menu;
}

function positionWorkspaceSheetDocumentMenu(menu, x, y) {
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  menu.hidden = false;

  requestAnimationFrame(() => {
    const rect = menu.getBoundingClientRect();
    const margin = 10;
    const nextLeft = Math.max(margin, Math.min(x, window.innerWidth - rect.width - margin));
    const nextTop = Math.max(margin, Math.min(y, window.innerHeight - rect.height - margin));
    menu.style.left = `${nextLeft}px`;
    menu.style.top = `${nextTop}px`;
  });
}

function appendSheetDocumentMenuAction(menu, { label = "", meta = "", danger = false, action = () => {} } = {}) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `workspace-sheet-document-menu-item${danger ? " danger" : ""}`;
  const text = document.createElement("span");
  text.textContent = label;
  const shortcut = document.createElement("em");
  shortcut.textContent = meta;
  button.append(text, shortcut);
  button.addEventListener("click", () => {
    hideWorkspaceSheetDocumentMenu();
    action();
  });
  menu.appendChild(button);
}

function appendSheetDocumentMenuSeparator(menu) {
  const separator = document.createElement("div");
  separator.className = "workspace-sheet-document-menu-separator";
  menu.appendChild(separator);
}

async function openWorkspaceSheetDocument(workObject = {}) {
  reopenSheetDocument(workObject.id);
  await selectWorkObject(workObject.id, preferredOpenPath(workObject));
}

async function renameWorkspaceSheetDocument(workObject = {}, config = currentWorkspaceDocumentListConfig()) {
  const currentTitle = workObject.title || config?.newTitle || "New document";
  const nextTitle = window.prompt(config?.renamePrompt || "Nom du document", currentTitle);
  if (nextTitle === null) {
    return;
  }

  const normalizedTitle = nextTitle.trim();
  if (!normalizedTitle) {
    setStatus("Le nom du document ne peut pas etre vide.");
    return;
  }

  const payload = await apiClient.updateWorkObject(workObject.id, {
    title: normalizedTitle
  });
  if (payload.workObject) {
    mergeWorkObject(payload.workObject);
    if (String(state.currentWorkObjectId) === String(payload.workObject.id)) {
      state.currentWorkObject = { ...state.currentWorkObject, ...payload.workObject };
    }
    renderWorkObjects();
    renderWorkspace();
  }
  setStatus(`Document renomme : ${normalizedTitle}.`);
}

async function saveWorkspaceSheetDocument(workObject = {}) {
  reopenSheetDocument(workObject.id);
  if (String(state.currentWorkObjectId) !== String(workObject.id)) {
    await selectWorkObject(workObject.id, preferredOpenPath(workObject));
  }
  if (state.editorDirty) {
    await saveWorkObjectChanges();
  } else {
    setStatus(`${workObject.title || "Document"} est deja sauvegarde.`);
  }
}

async function toggleWorkspaceDocumentFavorite(workObject = {}) {
  const favorite = !Boolean(workObject.metadata?.favorite);
  const payload = await apiClient.updateWorkObject(workObject.id, {
    metadata: { favorite }
  });
  if (payload.workObject) {
    mergeWorkObject(payload.workObject);
    if (String(state.currentWorkObjectId) === String(payload.workObject.id)) {
      state.currentWorkObject = { ...state.currentWorkObject, ...payload.workObject };
    }
  }
  renderWorkObjects();
  renderWorkspace();
  setStatus(favorite ? "Document ajoute aux favoris." : "Document retire des favoris.");
}

async function archiveWorkspaceDocument(workObject = {}) {
  const archived = String(workObject.status || "").toLowerCase() === "archived";
  const payload = await apiClient.updateWorkObject(workObject.id, {
    status: archived ? "ready" : "archived"
  });
  if (payload.workObject) {
    mergeWorkObject(payload.workObject);
    if (String(state.currentWorkObjectId) === String(payload.workObject.id)) {
      if (!archived) {
        clearCurrentWorkObjectState();
      } else {
        state.currentWorkObject = { ...state.currentWorkObject, ...payload.workObject };
      }
    }
  }
  renderWorkObjects();
  renderWorkspace();
  setStatus(archived ? "Document restaure." : "Document archive.");
}

async function trashWorkspaceDocument(workObject = {}) {
  const trashed = String(workObject.status || "").toLowerCase() === "trashed";
  const payload = trashed
    ? await apiClient.restoreTrashedWorkObject(workObject.id, state.currentUserId)
    : await apiClient.trashWorkObject(workObject.id, state.currentUserId);
  if (payload.workObject) {
    mergeWorkObject(payload.workObject);
    if (!trashed && String(state.currentWorkObjectId) === String(workObject.id)) {
      clearCurrentWorkObjectState();
    }
  }
  renderWorkObjects();
  renderWorkspace();
  setStatus(trashed ? "Document restaure depuis la corbeille." : "Document place dans la corbeille.");
}

async function deleteWorkspaceDocumentPermanently(workObject = {}) {
  if (!window.confirm(`Supprimer definitivement "${workObject.title || "Document"}" ?`)) {
    return;
  }
  await apiClient.deleteWorkObjectPermanently(workObject.id, state.currentUserId);
  state.workObjects = state.workObjects.filter(
    (item) => String(item.id) !== String(workObject.id)
  );
  if (String(state.currentWorkObjectId) === String(workObject.id)) {
    clearCurrentWorkObjectState();
  }
  renderWorkObjects();
  renderWorkspace();
  setStatus("Document supprime definitivement.");
}

async function shareWorkspaceDocument(workObject = {}) {
  const current = workObject.metadata?.sharing || {};
  const visibility = window.confirm(
    current.visibility === "link"
      ? "Le partage par lien est actif. OK pour le conserver, Annuler pour le desactiver."
      : "Activer le partage par lien pour ce document ?"
  )
    ? "link"
    : "private";
  const requestedRole =
    visibility === "link"
      ? window.prompt(
          "Role du lien : viewer, commenter ou editor",
          current.defaultRole || "viewer"
        )
      : current.defaultRole || "viewer";
  if (
    visibility === "link" &&
    !["viewer", "commenter", "editor"].includes(requestedRole)
  ) {
    setStatus("Role de partage invalide.");
    return;
  }

  const payload = await apiClient.updateWorkObjectSharing(workObject.id, {
    userId: state.currentUserId,
    visibility,
    defaultRole: requestedRole,
    shares: current.shares || []
  });
  if (payload.workObject) {
    mergeWorkObject(payload.workObject);
    if (String(state.currentWorkObjectId) === String(payload.workObject.id)) {
      state.currentWorkObject = { ...state.currentWorkObject, ...payload.workObject };
    }
  }

  const token = payload.workObject?.metadata?.sharing?.shareToken;
  if (visibility === "link" && token) {
    const shareUrl = `${window.location.origin}/share/work/${token}`;
    await navigator.clipboard?.writeText(shareUrl).catch(() => {});
    window.prompt("Lien de partage", shareUrl);
  }
  renderWorkspace();
  setStatus(visibility === "link" ? "Partage par lien active." : "Partage par lien desactive.");
}

function closeWorkspaceAnnotations() {
  document.getElementById("workspace-annotations-overlay")?.remove();
}

async function saveWorkspaceAnnotations(workObject, annotations) {
  const payload = await apiClient.updateWorkObjectAnnotations(workObject.id, {
    userId: state.currentUserId,
    annotations
  });
  if (payload.workObject) {
    mergeWorkObject(payload.workObject);
    if (String(state.currentWorkObjectId) === String(payload.workObject.id)) {
      state.currentWorkObject = { ...state.currentWorkObject, ...payload.workObject };
    }
  }
  return payload.workObject;
}

function showWorkspaceAnnotations(workObject = state.currentWorkObject) {
  closeWorkspaceAnnotations();
  if (!workObject) return;
  let annotations = [...(workObject.metadata?.annotations || [])];
  const overlay = document.createElement("div");
  overlay.id = "workspace-annotations-overlay";
  overlay.className = "workspace-version-history-overlay";
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeWorkspaceAnnotations();
  });
  const panel = document.createElement("section");
  panel.className = "workspace-annotations-panel";
  const header = document.createElement("header");
  const heading = document.createElement("div");
  const title = document.createElement("h3");
  title.textContent = "Commentaires et suggestions";
  const subtitle = document.createElement("p");
  subtitle.textContent = friendlyFileLabel(state.currentWorkObjectFile || workObject.primaryFile || "");
  heading.append(title, subtitle);
  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "workspace-version-history-close";
  closeButton.textContent = "x";
  closeButton.addEventListener("click", closeWorkspaceAnnotations);
  header.append(heading, closeButton);
  const toolbar = document.createElement("div");
  toolbar.className = "workspace-annotations-toolbar";
  const addButton = document.createElement("button");
  addButton.type = "button";
  addButton.textContent = "Ajouter un commentaire";
  const suggestButton = document.createElement("button");
  suggestButton.type = "button";
  suggestButton.textContent = "Proposer une modification";
  toolbar.append(addButton, suggestButton);
  const list = document.createElement("div");
  list.className = "workspace-annotations-list";

  const annotationAnchorLabel = (anchor = {}) => {
    if (anchor.type === "cell" && anchor.cell) return `Cellule ${anchor.cell}`;
    if (anchor.type === "text" && anchor.quote) {
      return `Texte : "${String(anchor.quote).slice(0, 80)}"`;
    }
    if (anchor.type === "text" && Number(anchor.blockIndex) >= 0) {
      return `Bloc ${Number(anchor.blockIndex) + 1}`;
    }
    return "";
  };

  const applySuggestion = async (annotation) => {
    const replacement = String(annotation.suggestedText || "").trim();
    if (!replacement) throw new Error("Cette suggestion ne contient aucun remplacement.");
    const anchor = annotation.anchor || {};
    if (anchor.type === "cell" && anchor.cell) {
      const [rowIndex, columnIndex] = String(anchor.cell).split(":").map(Number);
      const model = deriveSpreadsheetDraft(currentDraftContent());
      const sheet =
        model.sheets.find((item) => item.id === model.activeSheetId) ||
        model.sheets[0];
      if (!sheet || rowIndex < 0 || columnIndex < 0) {
        throw new Error("La cellule cible n'existe plus.");
      }
      while (sheet.rows.length <= rowIndex) sheet.rows.push([]);
      while (sheet.rows[rowIndex].length <= columnIndex) sheet.rows[rowIndex].push("");
      sheet.rows[rowIndex][columnIndex] = replacement;
      syncEditorDraft(buildSpreadsheetContent(model), { refreshWorkspace: true });
    } else {
      const quote = String(anchor.quote || "");
      const source = currentDraftContent();
      if (!quote || !source.includes(quote)) {
        throw new Error("Le texte cible n'existe plus dans le document.");
      }
      syncEditorDraft(source.replace(quote, replacement), {
        refreshWorkspace: true
      });
    }
    annotation.resolved = true;
    annotation.acceptedAt = new Date().toISOString();
    annotation.acceptedByUserId = state.currentUserId;
    await saveWorkspaceAnnotations(workObject, annotations);
  };

  const redraw = () => {
    list.innerHTML = "";
    const visible = annotations.filter(
      (annotation) =>
        !annotation.entryPath ||
        annotation.entryPath === (state.currentWorkObjectFile || workObject.primaryFile)
    );
    if (!visible.length) {
      const empty = document.createElement("p");
      empty.textContent = "Aucun commentaire sur ce fichier.";
      list.appendChild(empty);
    }
    visible.forEach((annotation) => {
      const item = document.createElement("article");
      const meta = document.createElement("span");
      meta.textContent = [
        annotation.type === "suggestion" ? "Suggestion" : "Commentaire",
        annotation.authorName || `User ${annotation.authorUserId || ""}`,
        annotation.resolved ? "resolu" : ""
      ].filter(Boolean).join(" | ");
      const body = document.createElement("p");
      body.textContent = annotation.body || "";
      item.append(meta, body);
      const anchorLabel = annotationAnchorLabel(annotation.anchor);
      if (anchorLabel) {
        const anchor = document.createElement("small");
        anchor.className = "workspace-annotation-anchor";
        anchor.textContent = anchorLabel;
        item.appendChild(anchor);
      }
      if (annotation.type === "suggestion" && annotation.suggestedText) {
        const replacement = document.createElement("pre");
        replacement.className = "workspace-annotation-suggestion";
        replacement.textContent = annotation.suggestedText;
        item.appendChild(replacement);
      }
      (annotation.replies || []).forEach((reply) => {
        const replyNode = document.createElement("blockquote");
        replyNode.textContent = `${reply.authorName || `User ${reply.authorUserId || ""}`}: ${reply.body || ""}`;
        item.appendChild(replyNode);
      });
      const actions = document.createElement("div");
      const replyButton = document.createElement("button");
      replyButton.type = "button";
      replyButton.textContent = "Repondre";
      replyButton.addEventListener("click", async () => {
        const body = window.prompt("Votre reponse");
        if (!body?.trim()) return;
        annotation.replies = [
          ...(annotation.replies || []),
          {
            id: crypto.randomUUID(),
            body: body.trim(),
            authorUserId: state.currentUserId,
            authorName: currentUserDisplayName(),
            createdAt: new Date().toISOString()
          }
        ];
        await saveWorkspaceAnnotations(workObject, annotations);
        redraw();
      });
      const resolveButton = document.createElement("button");
      resolveButton.type = "button";
      resolveButton.textContent = annotation.resolved ? "Reouvrir" : "Resoudre";
      resolveButton.addEventListener("click", async () => {
        annotation.resolved = !annotation.resolved;
        await saveWorkspaceAnnotations(workObject, annotations);
        redraw();
      });
      actions.append(replyButton);
      if (
        annotation.type === "suggestion" &&
        annotation.suggestedText &&
        !annotation.acceptedAt
      ) {
        const acceptButton = document.createElement("button");
        acceptButton.type = "button";
        acceptButton.textContent = "Accepter";
        acceptButton.addEventListener("click", () => {
          applySuggestion(annotation).then(redraw).catch(handleError);
        });
        actions.appendChild(acceptButton);
      }
      actions.append(resolveButton);
      item.appendChild(actions);
      list.appendChild(item);
    });
  };

  const addAnnotation = async (type) => {
    const body = window.prompt(
      type === "suggestion"
        ? "Pourquoi proposez-vous cette modification ?"
        : "Commentaire (utilisez @nom pour mentionner)"
    );
    if (!body?.trim()) return;
    const anchor = captureWorkspaceCursor();
    const suggestedText =
      type === "suggestion"
        ? window.prompt("Texte ou valeur de remplacement", anchor?.quote || "")
        : "";
    if (type === "suggestion" && !suggestedText?.trim()) return;
    annotations.push({
      id: crypto.randomUUID(),
      type,
      body: body.trim(),
      authorUserId: state.currentUserId,
      authorName: currentUserDisplayName(),
      entryPath: state.currentWorkObjectFile || workObject.primaryFile || "",
      sectionId: state.currentSectionId || "",
      blockId: state.currentBlockId || "",
      anchor,
      suggestedText: String(suggestedText || "").trim(),
      mentions: [...body.matchAll(/@([\w.-]+)/g)].map((match) => match[1]),
      replies: [],
      resolved: false,
      createdAt: new Date().toISOString()
    });
    await saveWorkspaceAnnotations(workObject, annotations);
    redraw();
  };
  addButton.addEventListener("click", () => addAnnotation("comment").catch(handleError));
  suggestButton.addEventListener("click", () => addAnnotation("suggestion").catch(handleError));
  redraw();
  panel.append(header, toolbar, list);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
}

function closeWorkspaceVersionHistory() {
  document.getElementById("workspace-version-history-overlay")?.remove();
}

async function showWorkspaceVersionHistory(workObject = {}) {
  closeWorkspaceVersionHistory();
  const payload = await apiClient.getWorkObjectHistory(workObject.id);
  const history = payload.history || [];
  const overlay = document.createElement("div");
  overlay.id = "workspace-version-history-overlay";
  overlay.className = "workspace-version-history-overlay";
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      closeWorkspaceVersionHistory();
    }
  });

  const panel = document.createElement("section");
  panel.className = "workspace-version-history-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-label", `Historique de ${workObject.title || "document"}`);

  const header = document.createElement("header");
  const heading = document.createElement("div");
  const title = document.createElement("h3");
  title.textContent = "Historique des versions";
  const subtitle = document.createElement("p");
  subtitle.textContent = `${workObject.title || "Document"} | revision actuelle ${workObject.revision || 1}`;
  heading.append(title, subtitle);
  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "workspace-version-history-close";
  closeButton.textContent = "x";
  closeButton.title = "Fermer";
  closeButton.setAttribute("aria-label", "Fermer");
  closeButton.addEventListener("click", closeWorkspaceVersionHistory);
  header.append(heading, closeButton);

  const list = document.createElement("div");
  list.className = "workspace-version-history-list";
  const comparison = document.createElement("div");
  comparison.className = "workspace-version-compare hidden";
  if (!history.length) {
    const empty = document.createElement("p");
    empty.className = "workspace-version-history-empty";
    empty.textContent = "Aucune version precedente.";
    list.appendChild(empty);
  }

  history.forEach((entry) => {
    const item = document.createElement("article");
    const copy = document.createElement("div");
    const label = document.createElement("strong");
    label.textContent = `Revision ${entry.revision || "?"}`;
    const meta = document.createElement("span");
    const date = entry.at ? new Date(entry.at).toLocaleString() : "";
    meta.textContent = [entry.actor || "", date, entry.note || entry.type || ""]
      .filter(Boolean)
      .join(" | ");
    copy.append(label, meta);
    item.appendChild(copy);

    if (entry.restorable) {
      const compareButton = document.createElement("button");
      compareButton.type = "button";
      compareButton.textContent = "Comparer";
      compareButton.addEventListener("click", async () => {
        compareButton.disabled = true;
        try {
          const [snapshotPayload, currentPayload] = await Promise.all([
            apiClient.getWorkObjectHistorySnapshot(workObject.id, entry.id),
            apiClient.getWorkObject(workObject.id, entry.entryPath || workObject.primaryFile || "")
          ]);
          comparison.innerHTML = "";
          comparison.classList.remove("hidden");
          const oldColumn = document.createElement("section");
          const newColumn = document.createElement("section");
          const oldTitle = document.createElement("strong");
          const newTitle = document.createElement("strong");
          const oldContent = document.createElement("pre");
          const newContent = document.createElement("pre");
          oldTitle.textContent = `Revision ${entry.revision || "?"}`;
          newTitle.textContent = `Revision ${currentPayload.workObject?.revision || "actuelle"}`;
          oldContent.textContent = snapshotPayload.snapshot?.content || "";
          newContent.textContent = currentPayload.workObject?.file?.content || "";
          oldColumn.append(oldTitle, oldContent);
          newColumn.append(newTitle, newContent);
          comparison.append(oldColumn, newColumn);
        } finally {
          compareButton.disabled = false;
        }
      });
      const restoreButton = document.createElement("button");
      restoreButton.type = "button";
      restoreButton.textContent = "Restaurer";
      restoreButton.addEventListener("click", async () => {
        if (!window.confirm(`Restaurer la revision ${entry.revision || ""} ?`)) {
          return;
        }
        restoreButton.disabled = true;
        try {
          const restored = await apiClient.restoreWorkObjectHistory(workObject.id, entry.id);
          if (restored.workObject) {
            mergeWorkObject(restored.workObject);
            await selectWorkObject(
              restored.workObject.id,
              restored.workObject.primaryFile || preferredOpenPath(restored.workObject)
            );
          }
          closeWorkspaceVersionHistory();
          setStatus(`Revision ${entry.revision || ""} restauree.`);
        } finally {
          restoreButton.disabled = false;
        }
      });
      const actions = document.createElement("div");
      actions.className = "workspace-version-history-actions";
      actions.append(compareButton, restoreButton);
      item.appendChild(actions);
    }
    list.appendChild(item);
  });

  panel.append(header, list, comparison);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  closeButton.focus();
}

async function closeWorkspaceSheetDocument(workObject = {}, config = currentWorkspaceDocumentListConfig()) {
  const openDocuments = workspaceDocumentsForConfig(config);
  if (String(state.currentWorkObjectId) === String(workObject.id) && openDocuments.length <= 1) {
    setStatus(config?.keepOneStatus || "Garde au moins un document ouvert.");
    return;
  }

  markSheetDocumentClosed(workObject.id);
  if (String(state.currentWorkObjectId) === String(workObject.id)) {
    const fallback = workspaceDocumentsForConfig(config).find((item) => String(item.id) !== String(workObject.id));
    if (fallback) {
      await selectWorkObject(fallback.id, preferredOpenPath(fallback));
      setStatus(`${workObject.title || "Document"} ferme.`);
      return;
    }
  }

  renderWorkspace();
  setStatus(`${workObject.title || "Document"} ferme.`);
}

function showWorkspaceSheetDocumentMenu(event, workObject = {}) {
  event.preventDefault();
  event.stopPropagation();
  const config = currentWorkspaceDocumentListConfig();
  const menu = ensureWorkspaceSheetDocumentMenu();
  menu.innerHTML = "";

  appendSheetDocumentMenuAction(menu, {
    label: "Ouvrir",
    action: () => openWorkspaceSheetDocument(workObject).catch(handleError)
  });
  appendSheetDocumentMenuAction(menu, {
    label: "Renommer",
    meta: "F2",
    action: () => renameWorkspaceSheetDocument(workObject, config).catch(handleError)
  });
  appendSheetDocumentMenuAction(menu, {
    label: "Sauvegarder",
    meta: String(state.currentWorkObjectId) === String(workObject.id) && state.editorDirty ? "modifie" : "",
    action: () => saveWorkspaceSheetDocument(workObject).catch(handleError)
  });
  appendSheetDocumentMenuAction(menu, {
    label: workObject.metadata?.favorite ? "Retirer des favoris" : "Ajouter aux favoris",
    action: () => toggleWorkspaceDocumentFavorite(workObject).catch(handleError)
  });
  appendSheetDocumentMenuAction(menu, {
    label: "Historique des versions",
    action: () => showWorkspaceVersionHistory(workObject).catch(handleError)
  });
  appendSheetDocumentMenuAction(menu, {
    label: "Partager",
    action: () => shareWorkspaceDocument(workObject).catch(handleError)
  });
  appendSheetDocumentMenuAction(menu, {
    label: "Commentaires et suggestions",
    meta: String(workObject.metadata?.annotations?.length || ""),
    action: () => showWorkspaceAnnotations(workObject)
  });
  appendSheetDocumentMenuSeparator(menu);
  appendSheetDocumentMenuAction(menu, {
    label: "Nouveau document",
    action: () =>
      createBlankWorkspace(
        config?.newKind || "dataset",
        config?.newFamily || "data_spreadsheet",
        config?.newLabel || "Sheets"
      ).catch(handleError)
  });
  appendSheetDocumentMenuAction(menu, {
    label:
      String(workObject.status || "").toLowerCase() === "archived"
        ? "Restaurer"
        : "Archiver",
    danger: String(workObject.status || "").toLowerCase() !== "archived",
    action: () => archiveWorkspaceDocument(workObject).catch(handleError)
  });
  appendSheetDocumentMenuAction(menu, {
    label:
      String(workObject.status || "").toLowerCase() === "trashed"
        ? "Restaurer de la corbeille"
        : "Mettre a la corbeille",
    danger: String(workObject.status || "").toLowerCase() !== "trashed",
    action: () => trashWorkspaceDocument(workObject).catch(handleError)
  });
  if (String(workObject.status || "").toLowerCase() === "trashed") {
    appendSheetDocumentMenuAction(menu, {
      label: "Supprimer definitivement",
      danger: true,
      action: () => deleteWorkspaceDocumentPermanently(workObject).catch(handleError)
    });
  }
  appendSheetDocumentMenuAction(menu, {
    label: "Fermer l'onglet",
    danger: true,
    action: () => closeWorkspaceSheetDocument(workObject, config).catch(handleError)
  });

  positionWorkspaceSheetDocumentMenu(menu, event.clientX, event.clientY);
}

function renderWorkspaceSheetDocuments() {
  const container = el["workspace-sheet-documents"];
  if (!container) {
    return;
  }

  const config = currentWorkspaceDocumentListConfig();
  const sheetObjects = workspaceDocumentsForConfig(config);
  const shouldShow = Boolean(config);

  container.classList.toggle("hidden", !shouldShow);
  container.innerHTML = "";
  if (!shouldShow) {
    return;
  }

  const header = document.createElement("div");
  header.className = "workspace-sheet-documents-header";

  const titleWrap = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = config.title;
  const count = document.createElement("span");
  count.textContent = `${sheetObjects.length || 0} document${sheetObjects.length === 1 ? "" : "s"}`;
  titleWrap.append(title, count);

  const tools = document.createElement("div");
  tools.className = "workspace-sheet-documents-tools";
  const search = document.createElement("input");
  search.type = "search";
  search.value = state.workspaceLibraryQuery;
  search.placeholder = "Rechercher";
  search.setAttribute("aria-label", "Rechercher dans la bibliotheque");
  search.addEventListener("input", () => {
    state.workspaceLibraryQuery = search.value;
    window.clearTimeout(workspaceLibrarySearchHandle);
    workspaceLibrarySearchHandle = window.setTimeout(async () => {
      const query = state.workspaceLibraryQuery.trim();
      try {
        state.workspaceLibrarySearchResults = query
          ? (
              await apiClient.searchWorkObjects(
                state.currentUserId,
                query,
                config.newKind === "dataset" ? "dataset" : "document"
              )
            ).results || []
          : [];
        renderWorkspaceSheetDocuments();
      } catch (error) {
        handleError(error);
      }
    }, 220);
    renderWorkspaceSheetDocuments();
    requestAnimationFrame(() => {
      const nextSearch = el["workspace-sheet-documents"]?.querySelector(
        ".workspace-sheet-documents-tools input"
      );
      if (nextSearch) {
        nextSearch.focus();
        nextSearch.setSelectionRange(search.value.length, search.value.length);
      }
    });
  });
  const archivedButton = document.createElement("button");
  archivedButton.type = "button";
  archivedButton.className = `workspace-sheet-document-archive-toggle${
    state.workspaceLibraryShowArchived ? " active" : ""
  }`;
  archivedButton.textContent = "Archives";
  archivedButton.setAttribute("aria-pressed", String(state.workspaceLibraryShowArchived));
  archivedButton.addEventListener("click", () => {
    state.workspaceLibraryShowArchived = !state.workspaceLibraryShowArchived;
    renderWorkspaceSheetDocuments();
  });
  const trashButton = document.createElement("button");
  trashButton.type = "button";
  trashButton.className = `workspace-sheet-document-archive-toggle${
    state.workspaceLibraryShowTrash ? " active" : ""
  }`;
  trashButton.textContent = "Corbeille";
  trashButton.setAttribute("aria-pressed", String(state.workspaceLibraryShowTrash));
  trashButton.addEventListener("click", () => {
    state.workspaceLibraryShowTrash = !state.workspaceLibraryShowTrash;
    if (state.workspaceLibraryShowTrash) {
      state.workspaceLibraryShowArchived = true;
    }
    renderWorkspaceSheetDocuments();
  });
  tools.append(search, archivedButton, trashButton);

  const newButton = document.createElement("button");
  newButton.type = "button";
  newButton.className = "workspace-sheet-document-new";
  newButton.textContent = "+";
  newButton.title = config.newTitle;
  newButton.addEventListener("click", () => {
    createBlankWorkspace(config.newKind, config.newFamily, config.newLabel).catch(handleError);
  });

  header.append(titleWrap, tools, newButton);
  container.appendChild(header);

  const list = document.createElement("div");
  list.className = "workspace-sheet-document-list";

  if (!sheetObjects.length) {
    const empty = document.createElement("p");
    empty.className = "workspace-sheet-document-empty";
    empty.textContent = config.emptyText;
    list.appendChild(empty);
  }

  sheetObjects.forEach((workObject) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `workspace-sheet-document-item${
      String(state.currentWorkObjectId) === String(workObject.id) ? " active" : ""
    }`;
    item.addEventListener("click", () => {
      openWorkspaceSheetDocument(workObject).catch(handleError);
    });
    item.addEventListener("contextmenu", (event) => {
      showWorkspaceSheetDocumentMenu(event, workObject);
    });
    item.addEventListener("keydown", (event) => {
      if (event.key === "F2") {
        event.preventDefault();
        renameWorkspaceSheetDocument(workObject, config).catch(handleError);
      } else if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        closeWorkspaceSheetDocument(workObject, config).catch(handleError);
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        saveWorkspaceSheetDocument(workObject).catch(handleError);
      }
    });

    const label = document.createElement("strong");
    label.textContent = `${workObject.metadata?.favorite ? "[Favorite] " : ""}${
      workObject.title || config.newTitle || "Untitled document"
    }`;
    const meta = document.createElement("span");
    meta.textContent = workspaceDocumentMeta(workObject, config);
    item.append(label, meta);
    list.appendChild(item);
  });

  container.appendChild(list);
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
    crmUserId: state.currentUserId,
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
    onDataGridEdit: updateSpreadsheetDraftFromPreview,
    sheetCalculation: state.sheetCalculation,
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
  renderRemoteWorkspacePresence();
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

function renderPresentationStructuredEditorLegacy(container) {
  const draftContent = normalizePresentationSourceText(currentDraftContent());
  const deck = derivePresentationDeck(draftContent, state.currentWorkObject?.title || "Untitled presentation");
  const slideSections = deriveWorkspaceSections(draftContent, state.currentWorkObjectFile || "slides.md")
    .filter((section) => isPresentationSection(section));
  const selectedIndex = slideSections.findIndex((section) => section.id === state.currentSectionId);
  const activeSlideIndex = selectedIndex >= 0 ? selectedIndex : 0;
  const activeSlide = deck.slides[activeSlideIndex] || deck.slides[0];
  if (slideSections.length && selectedIndex < 0) {
    state.currentSectionId = slideSections[activeSlideIndex]?.id || "";
    state.currentBlockId = "";
  }
  const activeSlideBody = stripPresentationInternalMeta(activeSlide?.body || "");
  const activeSlideLines = activeSlideBody
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const activeSlideBullets = activeSlideLines
    .filter((line) => /^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line))
    .map((line) => line.replace(/^[-*]\s+|^\d+\.\s+/, "").trim())
    .filter(Boolean);
  const activeSlideParagraphs = activeSlideLines.filter(
    (line) => !/^[-*]\s+/.test(line) && !/^\d+\.\s+/.test(line)
  );
  const writePresentationDraft = (updater = null, { refreshWorkspace = false, selectIndex = activeSlideIndex } = {}) => {
    const nextDeck = derivePresentationDeck(currentDraftContent(), state.currentWorkObject?.title || "Untitled presentation");
    let nextSelectIndex = Number.isInteger(selectIndex) ? selectIndex : activeSlideIndex;
    if (typeof updater === "function") {
      const returnedIndex = updater(nextDeck);
      if (Number.isInteger(returnedIndex)) {
        nextSelectIndex = returnedIndex;
      }
    }
    if (!nextDeck.slides.length) {
      nextDeck.slides.push({
        title: "Slide 1",
        body: "Add the main message here.",
        layout: "title",
        theme: "default",
        notes: "",
        image: "",
        cta: ""
      });
      nextSelectIndex = 0;
    }
    const safeIndex = Math.max(0, Math.min(nextDeck.slides.length - 1, nextSelectIndex));
    const nextContent = buildPresentationContent({ title: nextDeck.title, slides: nextDeck.slides });
    state.currentSectionId = presentationSectionIdForIndex(nextContent, safeIndex);
    state.currentBlockId = "";
    syncEditorDraft(nextContent, { refreshWorkspace });
  };
  const executePresentationCommand = createWorkspaceCommandExecutor(
    "presentation",
    createPresentationWorkspaceCommandAdapter({
      addSlide: () => {
        writePresentationDraft((nextDeck) => {
          const insertIndex = Math.min(nextDeck.slides.length, activeSlideIndex + 1);
          const seed = nextDeck.slides[activeSlideIndex] || {};
          nextDeck.slides.splice(insertIndex, 0, {
            title: `Slide ${nextDeck.slides.length + 1}`,
            body: "- Main message\n- Proof point\n- Next step",
            layout: "bullets",
            theme: seed.theme || "default",
            notes: "",
            image: "",
            cta: ""
          });
          return insertIndex;
        }, { refreshWorkspace: true });
      },
      duplicateSlide: () => {
        writePresentationDraft((nextDeck) => {
          const seed = nextDeck.slides[activeSlideIndex] || nextDeck.slides[0];
          const insertIndex = Math.min(nextDeck.slides.length, activeSlideIndex + 1);
          nextDeck.slides.splice(insertIndex, 0, {
            ...seed,
            title: `${seed.title || "Slide"} copy`
          });
          return insertIndex;
        }, { refreshWorkspace: true });
      },
      deleteSlide: () => {
        if (deck.slides.length <= 1) {
          return;
        }
        writePresentationDraft((nextDeck) => {
          nextDeck.slides.splice(activeSlideIndex, 1);
          return Math.max(0, activeSlideIndex - 1);
        }, { refreshWorkspace: true });
      },
      moveSlide: (direction = 0) => {
        const nextIndex = activeSlideIndex + Number(direction || 0);
        if (nextIndex < 0 || nextIndex >= deck.slides.length) {
          return;
        }
        writePresentationDraft((nextDeck) => {
          nextDeck.slides = moveItemInArray(nextDeck.slides, activeSlideIndex, nextIndex);
          return nextIndex;
        }, { refreshWorkspace: true });
      },
      setLayout: (layout = "") => {
        writePresentationDraft((nextDeck) => {
          nextDeck.slides = nextDeck.slides.map((slide, index) =>
            index === activeSlideIndex ? { ...slide, layout: normalizePresentationLayout(layout) } : slide
          );
        }, { refreshWorkspace: true });
      },
      setTheme: (theme = "") => {
        writePresentationDraft((nextDeck) => {
          nextDeck.slides = nextDeck.slides.map((slide, index) =>
            index === activeSlideIndex ? { ...slide, theme: normalizePresentationTheme(theme) } : slide
          );
        }, { refreshWorkspace: true });
      }
    })
  );
  const createCommandButton = (commandId = "", label = "", { disabled = false, value = "" } = {}) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ghost-button workspace-slide-command-button";
    button.disabled = disabled;
    button.title = label;
    button.appendChild(
      createWorkspaceIconNode(getWorkspaceCommandIcon(commandId), {
        className: "workspace-slide-command-icon",
        label
      })
    );
    const text = document.createElement("span");
    text.textContent = label;
    button.appendChild(text);
    button.addEventListener("click", () => executePresentationCommand(commandId, { value }));
    return button;
  };

  const shell = document.createElement("div");
  shell.className = "workspace-slide-editor workspace-presentation-workbench";

  const toolbar = document.createElement("div");
  toolbar.className = "workspace-structured-toolbar";

  const stats = document.createElement("div");
  stats.className = "workspace-structured-stats";
  stats.textContent = `${deck.slides.length} slides | ${activeSlide.layout || "content"} | ${activeSlide.theme || "default"}`;

  const actions = document.createElement("div");
  actions.className = "workspace-structured-actions";
  actions.append(
    createCommandButton("slideAdd", "Add slide"),
    createCommandButton("slideDuplicate", "Duplicate"),
    createCommandButton("slideMoveLeft", "Move left", { disabled: activeSlideIndex <= 0 }),
    createCommandButton("slideMoveRight", "Move right", { disabled: activeSlideIndex >= deck.slides.length - 1 }),
    createCommandButton("slideDelete", "Delete", { disabled: deck.slides.length <= 1 })
  );
  toolbar.append(stats, actions);

  const insightGrid = createStructuredInsightGrid([
    { label: "Slides", value: deck.slides.length, meta: "Deck structure" },
    {
      label: "Layouts",
      value: new Set(deck.slides.map((slide) => slide.layout || "content")).size,
      meta: deck.slides.map((slide) => slide.layout || "content").slice(0, 3).join(", ")
    },
    {
      label: "Speaker notes",
      value: deck.slides.filter((slide) => String(slide.notes || "").trim()).length,
      meta: "Slides with presenter context"
    },
    {
      label: "Visual slides",
      value: deck.slides.filter((slide) => String(slide.image || "").trim() || slide.layout === "image").length,
      meta: "Image-ready layouts"
    }
  ]);

  const presentationHero = document.createElement("div");
  presentationHero.className = "workspace-presentation-hero";
  const presentationHeroMeta = document.createElement("div");
  presentationHeroMeta.className = "workspace-document-hero-meta";
  const presentationHeroKicker = document.createElement("span");
  presentationHeroKicker.className = "tiny";
  presentationHeroKicker.textContent = "Slides workspace";
  const presentationHeroTitle = document.createElement("strong");
  presentationHeroTitle.textContent = deck.title || state.currentWorkObject?.title || "Slides";
  const presentationHeroCopy = document.createElement("p");
  presentationHeroCopy.textContent = "Build the deck slide by slide with layout, story, speaker notes and a live presentation canvas.";
  presentationHeroMeta.append(presentationHeroKicker, presentationHeroTitle, presentationHeroCopy);
  const presentationHeroTabs = document.createElement("div");
  presentationHeroTabs.className = "workspace-sheet-tabs";
  ["Slides", "Design", "Notes", "Preview"].forEach((label, index) => {
    const chip = document.createElement("span");
    chip.className = `workspace-sheet-tab${index === 0 ? " active" : ""}`;
    chip.textContent = label;
    presentationHeroTabs.appendChild(chip);
  });
  presentationHero.append(presentationHeroMeta, presentationHeroTabs);

  const deckTitleLabel = document.createElement("label");
  deckTitleLabel.className = "composer-label";
  deckTitleLabel.textContent = "Deck title";
  const deckTitleInput = document.createElement("input");
  deckTitleInput.type = "text";
  deckTitleInput.value = deck.title;
  deckTitleInput.className = "workspace-slide-title-input";
  deckTitleInput.addEventListener("input", (event) => {
    writePresentationDraft((nextDeck) => {
      nextDeck.title = event.target.value;
    }, { refreshWorkspace: false });
  });

  const slideRail = document.createElement("div");
  slideRail.className = "workspace-slide-rail";
  deck.slides.forEach((slide, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `workspace-slide-pill${index === activeSlideIndex ?" active" : ""}`;
    button.textContent = slide.title || `Slide ${index + 1}`;
    button.addEventListener("click", () => {
      state.currentSectionId = slideSections[index]?.id || "";
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
    writePresentationDraft((nextDeck) => {
      nextDeck.slides = nextDeck.slides.map((slide, index) =>
        index === activeSlideIndex ?{ ...slide, title: event.target.value } : slide
      );
    }, { refreshWorkspace: false });
  });

  const slideLayoutLabel = document.createElement("label");
  slideLayoutLabel.className = "composer-label";
  slideLayoutLabel.textContent = "Layout";
  const slideLayoutSelect = document.createElement("select");
  slideLayoutSelect.className = "workspace-slide-title-input workspace-slide-select";
  PRESENTATION_SLIDE_LAYOUTS.forEach((layout) => {
    const option = document.createElement("option");
    option.value = layout.value;
    option.textContent = layout.label;
    option.selected = (activeSlide.layout || "content") === layout.value;
    slideLayoutSelect.appendChild(option);
  });
  slideLayoutSelect.addEventListener("change", (event) => {
    executePresentationCommand("slideLayout", { value: event.target.value });
  });

  const slideThemeLabel = document.createElement("label");
  slideThemeLabel.className = "composer-label";
  slideThemeLabel.textContent = "Theme";
  const slideThemeSelect = document.createElement("select");
  slideThemeSelect.className = "workspace-slide-title-input workspace-slide-select";
  PRESENTATION_SLIDE_THEMES.forEach((theme) => {
    const option = document.createElement("option");
    option.value = theme.value;
    option.textContent = theme.label;
    option.selected = (activeSlide.theme || "default") === theme.value;
    slideThemeSelect.appendChild(option);
  });
  slideThemeSelect.addEventListener("change", (event) => {
    executePresentationCommand("slideTheme", { value: event.target.value });
  });

  const slideBodyLabel = document.createElement("label");
  slideBodyLabel.className = "composer-label";
  slideBodyLabel.textContent = "Slide content";
  const slideBodyInput = document.createElement("textarea");
  slideBodyInput.rows = 10;
  slideBodyInput.className = "workspace-slide-body-input";
  slideBodyInput.value = activeSlideBody;
  slideBodyInput.addEventListener("input", (event) => {
    writePresentationDraft((nextDeck) => {
      nextDeck.slides = nextDeck.slides.map((slide, index) =>
        index === activeSlideIndex ?{ ...slide, body: event.target.value } : slide
      );
    }, { refreshWorkspace: false });
  });

  const notesLabel = document.createElement("label");
  notesLabel.className = "composer-label";
  notesLabel.textContent = "Speaker notes";
  const notesInput = document.createElement("textarea");
  notesInput.rows = 5;
  notesInput.className = "workspace-slide-body-input workspace-slide-notes-input";
  notesInput.value = activeSlide?.notes || "";
  notesInput.addEventListener("input", (event) => {
    writePresentationDraft((nextDeck) => {
      nextDeck.slides = nextDeck.slides.map((slide, index) =>
        index === activeSlideIndex ?{ ...slide, notes: event.target.value } : slide
      );
    }, { refreshWorkspace: false });
  });

  const mediaFieldGrid = document.createElement("div");
  mediaFieldGrid.className = "workspace-editor-field-grid";
  const imageField = document.createElement("label");
  imageField.className = "workspace-editor-inline-field";
  const imageFieldLabel = document.createElement("span");
  imageFieldLabel.className = "composer-label";
  imageFieldLabel.textContent = "Image URL";
  const imageInput = document.createElement("input");
  imageInput.type = "url";
  imageInput.className = "workspace-slide-title-input";
  imageInput.value = activeSlide?.image || "";
  imageInput.placeholder = "https://...";
  imageInput.addEventListener("input", (event) => {
    writePresentationDraft((nextDeck) => {
      nextDeck.slides = nextDeck.slides.map((slide, index) =>
        index === activeSlideIndex ?{ ...slide, image: event.target.value } : slide
      );
    }, { refreshWorkspace: false });
  });
  imageField.append(imageFieldLabel, imageInput);
  const ctaField = document.createElement("label");
  ctaField.className = "workspace-editor-inline-field";
  const ctaFieldLabel = document.createElement("span");
  ctaFieldLabel.className = "composer-label";
  ctaFieldLabel.textContent = "CTA";
  const ctaInput = document.createElement("input");
  ctaInput.type = "text";
  ctaInput.className = "workspace-slide-title-input";
  ctaInput.value = activeSlide?.cta || "";
  ctaInput.placeholder = "Next step";
  ctaInput.addEventListener("input", (event) => {
    writePresentationDraft((nextDeck) => {
      nextDeck.slides = nextDeck.slides.map((slide, index) =>
        index === activeSlideIndex ?{ ...slide, cta: event.target.value } : slide
      );
    }, { refreshWorkspace: false });
  });
  ctaField.append(ctaFieldLabel, ctaInput);
  mediaFieldGrid.append(imageField, ctaField);

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
        meta: `${slide.layout || "content"} | ${normalizeEditorText(slide.body).split("\n").filter((line) => line.trim()).length || 1} points`
      })),
      activeSlide?.id || "",
      {
        onSelect: (slide) => {
          const index = deck.slides.findIndex((item) => item.id === slide.id);
          state.currentSectionId = slideSections[index]?.id || "";
          state.currentBlockId = "";
          renderWorkspace();
        }
      }
    )
  );
  sidebar.appendChild(slidePanel.panel);

  const designPanel = createEditorPanel("Slide design", "Switch the active slide layout and theme without rewriting the content.");
  designPanel.body.appendChild(
    createEditorMiniList(
      PRESENTATION_SLIDE_LAYOUTS.map((layout) => ({
        id: layout.value,
        title: layout.label,
        meta: layout.value === activeSlide.layout ? "Active layout" : "Apply layout"
      })),
      activeSlide.layout || "content",
      {
        onSelect: (layout) => executePresentationCommand("slideLayout", { value: layout.id })
      }
    )
  );
  designPanel.body.appendChild(
    createEditorMiniList(
      PRESENTATION_SLIDE_THEMES.map((theme) => ({
        id: theme.value,
        title: theme.label,
        meta: theme.value === activeSlide.theme ? "Active theme" : "Apply theme"
      })),
      activeSlide.theme || "default",
      {
        onSelect: (theme) => executePresentationCommand("slideTheme", { value: theme.id })
      }
    )
  );
  sidebar.appendChild(designPanel.panel);

  const storyPanel = createEditorPanel("Deck profile", "Keep the narrative structure visible while you edit.");
  const storyGrid = createStructuredInsightGrid([
    { label: "Current slide", value: `${activeSlideIndex + 1}/${deck.slides.length}`, meta: activeSlide.title || "Slide" },
    { label: "Body points", value: activeSlideLines.length || 1, meta: activeSlideBullets.length ? `${activeSlideBullets.length} bullets` : "Narrative text" },
    { label: "Theme", value: activeSlide.theme || "default", meta: activeSlide.layout || "content" }
  ]);
  if (storyGrid) {
    storyPanel.body.appendChild(storyGrid);
  }
  sidebar.appendChild(storyPanel.panel);

  const slideEditorPanel = createEditorPanel("Edit current slide", "Change the deck title, then rewrite the active slide directly.");
  slideEditorPanel.body.append(
    deckTitleLabel,
    deckTitleInput,
    slideRail,
    slideTitleLabel,
    slideTitleInput,
    slideLayoutLabel,
    slideLayoutSelect,
    slideThemeLabel,
    slideThemeSelect,
    slideBodyLabel,
    slideBodyInput,
    mediaFieldGrid
  );
  main.appendChild(slideEditorPanel.panel);

  const stagePanel = createEditorPanel("Slides stage", "Preview the active slide as a presentation surface, not as raw markdown.");
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
  stageHint.textContent = `Slide ${activeSlideIndex + 1} of ${deck.slides.length} | ${activeSlide.layout || "content"}`;
  stageHeaderMeta.append(stageName, stageHint);
  const stageChips = document.createElement("div");
  stageChips.className = "workspace-chip-list";
  [
    activeSlide.theme || "Story",
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
      state.currentSectionId = slideSections[index]?.id || "";
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
  stageCanvas.className = `workspace-presentation-stage-canvas layout-${activeSlide.layout || "content"} theme-${activeSlide.theme || "default"}`;
  stageCanvas.dataset.layout = activeSlide.layout || "content";
  stageCanvas.dataset.theme = activeSlide.theme || "default";
  const stageCanvasKicker = document.createElement("span");
  stageCanvasKicker.className = "workspace-slide-kicker";
  stageCanvasKicker.textContent = `${activeSlide.layout || "content"} | ${activeSlide.theme || "default"}`;
  const stageCanvasTitle = document.createElement("h3");
  stageCanvasTitle.textContent = activeSlide?.title || "Slide";
  const stageCanvasBody = document.createElement("div");
  stageCanvasBody.className = "workspace-presentation-stage-body";
  if (activeSlide.layout === "image" && activeSlide.image) {
    const figure = document.createElement("figure");
    figure.className = "workspace-presentation-stage-figure";
    const image = document.createElement("img");
    image.src = activeSlide.image;
    image.alt = activeSlide.title || "Slide visual";
    figure.appendChild(image);
    stageCanvasBody.appendChild(figure);
  }
  if (activeSlide.layout === "quote") {
    const quote = document.createElement("blockquote");
    quote.textContent =
      activeSlideParagraphs.find((line) => /^>\s+/.test(line))?.replace(/^>\s+/, "") ||
      activeSlideParagraphs[0] ||
      "Add a strong quote or statement.";
    stageCanvasBody.appendChild(quote);
  } else if (activeSlide.layout === "comparison") {
    const comparisonGrid = document.createElement("div");
    comparisonGrid.className = "workspace-presentation-comparison-grid";
    const comparisonLines = activeSlideParagraphs.length ? activeSlideParagraphs : activeSlideBullets;
    comparisonLines.slice(0, 4).forEach((line, index) => {
      const [label = `Side ${index + 1}`, value = line] = String(line || "").split("|").map((part) => part.trim());
      const card = document.createElement("article");
      card.className = "workspace-presentation-comparison-card";
      const cardLabel = document.createElement("span");
      cardLabel.className = "tiny";
      cardLabel.textContent = value === line ? `Point ${index + 1}` : label;
      const cardValue = document.createElement("p");
      cardValue.textContent = value || line;
      card.append(cardLabel, cardValue);
      comparisonGrid.appendChild(card);
    });
    stageCanvasBody.appendChild(comparisonGrid);
  } else {
    activeSlideParagraphs.slice(0, activeSlide.layout === "two-column" ? 4 : 3).forEach((line) => {
      const item = document.createElement(/^>\s+/.test(line) ? "blockquote" : "p");
      item.textContent = line.replace(/^>\s+/, "");
      stageCanvasBody.appendChild(item);
    });
    if (activeSlideBullets.length) {
      const list = document.createElement("ul");
      activeSlideBullets.slice(0, 6).forEach((line) => {
        const item = document.createElement("li");
        item.textContent = line;
        list.appendChild(item);
      });
      stageCanvasBody.appendChild(list);
    }
  }
  if (activeSlide.cta) {
    const cta = document.createElement("div");
    cta.className = "workspace-presentation-cta";
    cta.textContent = activeSlide.cta;
    stageCanvasBody.appendChild(cta);
  }
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
      value: activeSlide.notes || activeSlideParagraphs[0] || activeSlideBullets[0] || "Lead with the most important message."
    },
    {
      label: "Next action",
      value: activeSlide.cta || (activeSlideIndex === deck.slides.length - 1 ? "Make the next action obvious." : "Support the story with proof.")
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
  stagePanel.body.appendChild(stageShell);
  main.appendChild(stagePanel.panel);

  const noteSummaryPanel = createEditorPanel("Presenter script", "Keep notes separate from the visible slide content.");
  noteSummaryPanel.body.append(notesLabel, notesInput);
  main.appendChild(noteSummaryPanel.panel);

  layout.append(sidebar, main);
  shell.append(toolbar);
  if (insightGrid) {
    shell.appendChild(insightGrid);
  }
  shell.append(presentationHero, layout);
  container.appendChild(shell);
}

function renderPresentationStructuredEditor(container) {
  const draftContent = normalizePresentationSourceText(currentDraftContent());
  const deck = derivePresentationDeck(draftContent, state.currentWorkObject?.title || "Untitled presentation");
  const slideSections = deriveWorkspaceSections(draftContent, state.currentWorkObjectFile || "slides.md")
    .filter((section) => isPresentationSection(section));
  const selectedIndex = slideSections.findIndex((section) => section.id === state.currentSectionId);
  const activeSlideIndex = selectedIndex >= 0 ? selectedIndex : 0;
  const activeSlide = deck.slides[activeSlideIndex] || deck.slides[0];
  if (slideSections.length && selectedIndex < 0) {
    state.currentSectionId = slideSections[activeSlideIndex]?.id || "";
    state.currentBlockId = "";
  }

  const visibleBody = stripPresentationInternalMeta(activeSlide?.body || "");
  const activeElements = normalizePresentationElements(activeSlide?.elements, {
    title: activeSlide?.title || "",
    body: visibleBody,
    layout: activeSlide?.layout || "content",
    image: activeSlide?.image || "",
    cta: activeSlide?.cta || ""
  }).sort((left, right) => Number(left.z || 0) - Number(right.z || 0));

  const validElementIds = new Set(activeElements.map((element) => element.id));
  let selectedElementIds = [
    ...new Set(
      [
        ...(Array.isArray(state.presentationSelectedElementIds) ? state.presentationSelectedElementIds : []),
        state.currentStructuredSubItemId
      ]
        .map((id) => String(id || ""))
        .filter((id) => id && validElementIds.has(id))
    )
  ];
  if (!selectedElementIds.length && activeElements.length && !state.presentationSelectionCleared) {
    selectedElementIds = [activeElements[0].id];
  }
  state.presentationSelectedElementIds = selectedElementIds;
  state.currentStructuredSubItemId = selectedElementIds[0] || "";
  const selectedElementSet = new Set(selectedElementIds);
  const selectedElements = activeElements.filter((element) => selectedElementSet.has(element.id));
  const selectedElement =
    selectedElements.find((element) => element.id === state.currentStructuredSubItemId) || selectedElements[0] || null;
  const hasMultiSelection = selectedElements.length > 1;

  const setPresentationSelection = (ids = [], primaryId = "") => {
    const nextIds = [
      ...new Set(
        ids
          .map((id) => String(id || ""))
          .filter((id) => id && validElementIds.has(id))
      )
    ];
    state.presentationSelectedElementIds = nextIds;
    state.currentStructuredSubItemId = primaryId && nextIds.includes(primaryId) ? primaryId : nextIds[0] || "";
    state.presentationSelectionCleared = !nextIds.length;
  };

  const setActivePresentationSlide = (nextIndex = 0) => {
    const safeIndex = Math.max(0, Math.min(deck.slides.length - 1, Number(nextIndex || 0)));
    state.currentSectionId = slideSections[safeIndex]?.id || presentationSectionIdForIndex(currentDraftContent(), safeIndex);
    state.currentBlockId = "";
    state.currentStructuredSubItemId = "";
    state.presentationSelectedElementIds = [];
    state.presentationSelectionCleared = true;
    renderWorkspace();
  };

  const writePresentationDraft = (
    updater = null,
    {
      refreshWorkspace = false,
      selectIndex = activeSlideIndex,
      selectedElementId = state.currentStructuredSubItemId,
      selectedElementIds: nextSelectedElementIds = null,
      skipHistory = false
    } = {}
  ) => {
    const previousContent = currentDraftContent();
    const nextDeck = derivePresentationDeck(previousContent, state.currentWorkObject?.title || "Untitled presentation");
    let nextSelectIndex = Number.isInteger(selectIndex) ? selectIndex : activeSlideIndex;
    if (typeof updater === "function") {
      const returnedIndex = updater(nextDeck);
      if (Number.isInteger(returnedIndex)) {
        nextSelectIndex = returnedIndex;
      }
    }
    if (!nextDeck.slides.length) {
      nextDeck.slides.push({
        title: "Slide 1",
        body: "Add the main message here.",
        ...normalizePresentationSlideMeta({ layout: "title", theme: "default" }, {
          title: "Slide 1",
          body: "Add the main message here."
        })
      });
      nextSelectIndex = 0;
    }
    nextDeck.slides = nextDeck.slides.map((slide) => ({
      ...slide,
      ...normalizePresentationSlideMeta(slide, {
        title: slide.title || "",
        body: slide.body || ""
      })
    }));
    const safeIndex = Math.max(0, Math.min(nextDeck.slides.length - 1, nextSelectIndex));
    const nextContent = buildPresentationContent({ title: nextDeck.title, slides: nextDeck.slides });
    state.currentSectionId = presentationSectionIdForIndex(nextContent, safeIndex);
    state.currentBlockId = "";
    const safeSlide = nextDeck.slides[safeIndex] || {};
    const safeElements = normalizePresentationElements(safeSlide.elements, {
      title: safeSlide.title,
      body: safeSlide.body,
      layout: safeSlide.layout,
      image: safeSlide.image,
      cta: safeSlide.cta
    });
    const safeElementIds = new Set(safeElements.map((element) => element.id));
    const requestedSelection = Array.isArray(nextSelectedElementIds) ? nextSelectedElementIds : [selectedElementId];
    const nextSelection = [
      ...new Set(
        requestedSelection
          .map((id) => String(id || ""))
          .filter((id) => id && safeElementIds.has(id))
      )
    ];
    state.presentationSelectedElementIds = nextSelection.length ? nextSelection : safeElements[0]?.id ? [safeElements[0].id] : [];
    state.currentStructuredSubItemId =
      selectedElementId && state.presentationSelectedElementIds.includes(selectedElementId)
        ? selectedElementId
        : state.presentationSelectedElementIds[0] || "";
    state.presentationSelectionCleared = !state.presentationSelectedElementIds.length;
    if (!skipHistory && nextContent !== previousContent) {
      const undoStack = Array.isArray(state.presentationUndoStack) ? state.presentationUndoStack : [];
      if (undoStack[undoStack.length - 1] !== previousContent) {
        state.presentationUndoStack = [...undoStack.slice(-39), previousContent];
      }
      state.presentationRedoStack = [];
    }
    syncEditorDraft(nextContent, { refreshWorkspace });
  };

  const restorePresentationHistoryContent = (content = "") => {
    const nextContent = normalizePresentationSourceText(content);
    const nextDeck = derivePresentationDeck(nextContent, state.currentWorkObject?.title || "Untitled presentation");
    const nextIndex = Math.max(0, Math.min(nextDeck.slides.length - 1, activeSlideIndex));
    state.currentSectionId = presentationSectionIdForIndex(nextContent, nextIndex);
    state.currentBlockId = "";
    state.currentStructuredSubItemId = nextDeck.slides[nextIndex]?.elements?.[0]?.id || "";
    state.presentationSelectedElementIds = state.currentStructuredSubItemId ? [state.currentStructuredSubItemId] : [];
    state.presentationSelectionCleared = !state.presentationSelectedElementIds.length;
    syncEditorDraft(nextContent, { refreshWorkspace: true });
  };

  const undoPresentationChange = () => {
    const undoStack = Array.isArray(state.presentationUndoStack) ? state.presentationUndoStack : [];
    if (!undoStack.length) {
      return;
    }
    const previousContent = undoStack[undoStack.length - 1];
    state.presentationUndoStack = undoStack.slice(0, -1);
    state.presentationRedoStack = [...(state.presentationRedoStack || []).slice(-39), currentDraftContent()];
    restorePresentationHistoryContent(previousContent);
  };

  const redoPresentationChange = () => {
    const redoStack = Array.isArray(state.presentationRedoStack) ? state.presentationRedoStack : [];
    if (!redoStack.length) {
      return;
    }
    const nextContent = redoStack[redoStack.length - 1];
    state.presentationRedoStack = redoStack.slice(0, -1);
    state.presentationUndoStack = [...(state.presentationUndoStack || []).slice(-39), currentDraftContent()];
    restorePresentationHistoryContent(nextContent);
  };

  const updateActiveSlide = (patch = {}, options = {}) => {
    writePresentationDraft((nextDeck) => {
      nextDeck.slides = nextDeck.slides.map((slide, index) =>
        index === activeSlideIndex
          ? {
              ...slide,
              ...patch
            }
          : slide
      );
    }, options);
  };

  const updateElement = (
    elementId = "",
    patch = {},
    { refreshWorkspace = false, selectedElementIds: nextSelection = [elementId] } = {}
  ) => {
    if (!elementId) {
      return;
    }
    writePresentationDraft((nextDeck) => {
      nextDeck.slides = nextDeck.slides.map((slide, index) => {
        if (index !== activeSlideIndex) {
          return slide;
        }
        const elements = normalizePresentationElements(slide.elements, {
          title: slide.title,
          body: slide.body,
          layout: slide.layout,
          image: slide.image,
          cta: slide.cta
        }).map((element) => (element.id === elementId ? { ...element, ...patch } : element));
        return { ...slide, elements };
      });
    }, { refreshWorkspace, selectedElementId: elementId, selectedElementIds: nextSelection });
  };

  const updateElementsByIds = (
    elementIds = [],
    mapper = (element) => element,
    { refreshWorkspace = false, selectedElementId = elementIds[0] || "", selectedElementIds: nextSelection = elementIds } = {}
  ) => {
    const ids = new Set(elementIds.filter(Boolean));
    if (!ids.size || typeof mapper !== "function") {
      return;
    }
    writePresentationDraft((nextDeck) => {
      nextDeck.slides = nextDeck.slides.map((slide, index) => {
        if (index !== activeSlideIndex) {
          return slide;
        }
        const elements = normalizePresentationElements(slide.elements, {
          title: slide.title,
          body: slide.body,
          layout: slide.layout,
          image: slide.image,
          cta: slide.cta
        }).map((element) => (ids.has(element.id) ? mapper(element) : element));
        return { ...slide, elements };
      });
    }, { refreshWorkspace, selectedElementId, selectedElementIds: nextSelection });
  };

  const selectionBounds = (elements = selectedElements) => {
    const list = elements.filter(Boolean);
    if (!list.length) {
      return null;
    }
    const left = Math.min(...list.map((element) => Number(element.x || 0)));
    const top = Math.min(...list.map((element) => Number(element.y || 0)));
    const right = Math.max(...list.map((element) => Number(element.x || 0) + Number(element.w || 0)));
    const bottom = Math.max(...list.map((element) => Number(element.y || 0) + Number(element.h || 0)));
    return { x: left, y: top, w: right - left, h: bottom - top, right, bottom };
  };

  const copyPresentationFormatting = (element = selectedElement) => {
    if (!element) {
      return null;
    }
    return {
      fontSize: element.fontSize,
      fontFamily: element.fontFamily,
      bold: element.bold,
      italic: element.italic,
      underline: element.underline,
      align: element.align,
      color: element.color,
      fill: element.fill,
      stroke: element.stroke,
      strokeWidth: element.strokeWidth,
      opacity: element.opacity,
      shape: element.shape,
      chartType: element.chartType
    };
  };

  const copySelectedFormatting = () => {
    const formatting = copyPresentationFormatting(selectedElement);
    if (!formatting) {
      return;
    }
    state.presentationFormatBrush = formatting;
    setStatus("Mise en forme prete a appliquer.");
    renderWorkspace();
  };

  const applyPresentationFormatBrush = (elementId = "") => {
    if (!elementId || !state.presentationFormatBrush) {
      return false;
    }
    updateElement(elementId, { ...state.presentationFormatBrush }, { refreshWorkspace: true });
    state.presentationFormatBrush = null;
    setStatus("Mise en forme appliquee.");
    return true;
  };

  const groupSelectedElements = () => {
    if (selectedElements.length < 2) {
      return;
    }
    const groupId = createPresentationElementId("group");
    updateElementsByIds(selectedElementIds, (element) => ({ ...element, groupId }), {
      refreshWorkspace: true,
      selectedElementId: selectedElement?.id || selectedElementIds[0],
      selectedElementIds
    });
  };

  const ungroupSelectedElements = () => {
    if (!selectedElements.some((element) => element.groupId)) {
      return;
    }
    updateElementsByIds(selectedElementIds, (element) => ({ ...element, groupId: "" }), {
      refreshWorkspace: true,
      selectedElementId: selectedElement?.id || selectedElementIds[0],
      selectedElementIds
    });
  };

  const toggleSelectedLock = () => {
    if (!selectedElements.length) {
      return;
    }
    const shouldLock = selectedElements.some((element) => !element.locked);
    updateElementsByIds(selectedElementIds, (element) => ({ ...element, locked: shouldLock }), {
      refreshWorkspace: true,
      selectedElementId: selectedElement?.id || selectedElementIds[0],
      selectedElementIds
    });
  };

  const selectAllPresentationElements = () => {
    const allIds = activeElements.map((element) => element.id);
    setPresentationSelection(allIds, allIds[0] || "");
    renderWorkspace();
  };

  const selectPresentationElementOrGroup = (element = null) => {
    if (!element) {
      return;
    }
    if (element.groupId) {
      const groupIds = activeElements.filter((item) => item.groupId === element.groupId).map((item) => item.id);
      setPresentationSelection(groupIds.length ? groupIds : [element.id], element.id);
      return;
    }
    setPresentationSelection([element.id], element.id);
  };

  const insertElement = (partial = {}) => {
    const id = createPresentationElementId(partial.type || "element");
    const element = normalizePresentationElement(
      {
        id,
        z: activeElements.length + 1,
        ...partial
      },
      activeElements.length
    );
    writePresentationDraft((nextDeck) => {
      nextDeck.slides = nextDeck.slides.map((slide, index) => {
        if (index !== activeSlideIndex) {
          return slide;
        }
        const elements = normalizePresentationElements(slide.elements, {
          title: slide.title,
          body: slide.body,
          layout: slide.layout,
          image: slide.image,
          cta: slide.cta
        });
        return { ...slide, elements: [...elements, element] };
      });
    }, { refreshWorkspace: true, selectedElementId: id });
  };

  const copyElementToClipboard = (element = null) => {
    if (!element) {
      return;
    }
    state.presentationClipboard = { ...element };
    setStatus("Objet copie.");
  };

  const copyElementsToClipboard = (elements = []) => {
    const list = elements.filter(Boolean);
    if (!list.length) {
      return;
    }
    if (list.length === 1) {
      copyElementToClipboard(list[0]);
      return;
    }
    state.presentationClipboard = {
      type: "selection",
      elements: list.map((element) => ({ ...element }))
    };
    setStatus(`${list.length} objets copies.`);
  };

  const duplicateElementFrom = (source = null) => {
    if (!source) {
      return;
    }
    insertElement({
      ...source,
      id: createPresentationElementId(source.type || "element"),
      x: Math.min(94, Number(source.x || 0) + 4),
      y: Math.min(94, Number(source.y || 0) + 4),
      z: activeElements.length + 1
    });
  };

  const duplicateElementsFrom = (sources = []) => {
    const list = sources.filter(Boolean);
    if (!list.length) {
      return;
    }
    if (list.length === 1) {
      duplicateElementFrom(list[0]);
      return;
    }
    const clones = list.map((source, index) => ({
      ...source,
      id: createPresentationElementId(source.type || "element"),
      x: Math.min(94, Number(source.x || 0) + 4),
      y: Math.min(94, Number(source.y || 0) + 4),
      z: activeElements.length + index + 1
    }));
    writePresentationDraft((nextDeck) => {
      nextDeck.slides = nextDeck.slides.map((slide, index) => {
        if (index !== activeSlideIndex) {
          return slide;
        }
        const elements = normalizePresentationElements(slide.elements, {
          title: slide.title,
          body: slide.body,
          layout: slide.layout,
          image: slide.image,
          cta: slide.cta
        });
        return { ...slide, elements: [...elements, ...clones] };
      });
    }, { refreshWorkspace: true, selectedElementId: clones[0]?.id || "", selectedElementIds: clones.map((clone) => clone.id) });
  };

  const removeElementById = (elementId = "") => {
    if (!elementId || activeElements.length <= 1) {
      return;
    }
    const nextSelection = activeElements.find((element) => element.id !== elementId)?.id || "";
    writePresentationDraft((nextDeck) => {
      nextDeck.slides = nextDeck.slides.map((slide, index) => {
        if (index !== activeSlideIndex) {
          return slide;
        }
        return {
          ...slide,
          elements: normalizePresentationElements(slide.elements, {
            title: slide.title,
            body: slide.body,
            layout: slide.layout,
            image: slide.image,
            cta: slide.cta
          }).filter((element) => element.id !== elementId)
        };
      });
    }, { refreshWorkspace: true, selectedElementId: nextSelection });
  };

  const removeElementsByIds = (elementIds = []) => {
    const lockedIds = new Set(activeElements.filter((element) => element.locked).map((element) => element.id));
    const ids = new Set(elementIds.filter((id) => id && !lockedIds.has(id)));
    if (!ids.size || activeElements.length <= 1) {
      return;
    }
    const remaining = activeElements.filter((element) => !ids.has(element.id));
    if (!remaining.length) {
      return;
    }
    const nextSelection = remaining[0]?.id || "";
    writePresentationDraft((nextDeck) => {
      nextDeck.slides = nextDeck.slides.map((slide, index) => {
        if (index !== activeSlideIndex) {
          return slide;
        }
        return {
          ...slide,
          elements: normalizePresentationElements(slide.elements, {
            title: slide.title,
            body: slide.body,
            layout: slide.layout,
            image: slide.image,
            cta: slide.cta
          }).filter((element) => !ids.has(element.id))
        };
      });
    }, { refreshWorkspace: true, selectedElementId: nextSelection, selectedElementIds: nextSelection ? [nextSelection] : [] });
  };

  const moveElementDepth = (elementId = "", delta = 0) => {
    if (!elementId) {
      return;
    }
    const sorted = [...activeElements];
    const currentIndex = sorted.findIndex((element) => element.id === elementId);
    if (currentIndex < 0) {
      return;
    }
    const nextIndex = Math.max(0, Math.min(sorted.length - 1, currentIndex + Number(delta || 0)));
    if (currentIndex === nextIndex) {
      return;
    }
    const nextSorted = moveItemInArray(sorted, currentIndex, nextIndex).map((element, index) => ({
      ...element,
      z: index
    }));
    updateActiveSlide({ elements: nextSorted }, { refreshWorkspace: true, selectedElementId: elementId });
  };

  const alignElement = (element = null, alignment = "") => {
    if (!element) {
      return;
    }
    const patch = {};
    if (alignment === "left") patch.x = 0;
    if (alignment === "center") patch.x = Math.max(0, (100 - Number(element.w || 0)) / 2);
    if (alignment === "right") patch.x = Math.max(0, 100 - Number(element.w || 0));
    if (alignment === "top") patch.y = 0;
    if (alignment === "middle") patch.y = Math.max(0, (100 - Number(element.h || 0)) / 2);
    if (alignment === "bottom") patch.y = Math.max(0, 100 - Number(element.h || 0));
    updateElement(element.id, patch, { refreshWorkspace: true });
  };

  const focusSelectedTextEditor = () => {
    window.setTimeout(() => {
      const editor = document.querySelector(".workspace-powerpoint-textarea");
      editor?.focus();
      editor?.select?.();
    }, 0);
  };

  const removeSelectedElement = () => {
    if (!selectedElements.length) {
      return;
    }
    removeElementsByIds(selectedElementIds);
  };

  const duplicateSelectedElement = () => {
    duplicateElementsFrom(selectedElements);
  };

  const moveSelectedElementDepth = (delta = 0) => {
    if (!selectedElementIds.length) {
      return;
    }
    if (selectedElementIds.length === 1) {
      moveElementDepth(selectedElementIds[0], delta);
      return;
    }
    if (Math.abs(Number(delta || 0)) > 1) {
      const ids = new Set(selectedElementIds);
      const selectedInOrder = activeElements.filter((element) => ids.has(element.id));
      const rest = activeElements.filter((element) => !ids.has(element.id));
      const nextSorted = (Number(delta || 0) > 0 ? [...rest, ...selectedInOrder] : [...selectedInOrder, ...rest])
        .map((element, index) => ({ ...element, z: index }));
      updateActiveSlide({ elements: nextSorted }, {
        refreshWorkspace: true,
        selectedElementId: selectedElement?.id || selectedElementIds[0],
        selectedElementIds
      });
      return;
    }
    const sorted = [...activeElements];
    const direction = Number(delta || 0) > 0 ? 1 : -1;
    const ids = new Set(selectedElementIds);
    const ordered = direction > 0 ? [...sorted].reverse() : sorted;
    ordered.forEach((element) => {
      const currentIndex = sorted.findIndex((item) => item.id === element.id);
      const swapIndex = currentIndex + direction;
      if (!ids.has(element.id) || swapIndex < 0 || swapIndex >= sorted.length || ids.has(sorted[swapIndex]?.id)) {
        return;
      }
      [sorted[currentIndex], sorted[swapIndex]] = [sorted[swapIndex], sorted[currentIndex]];
    });
    const nextSorted = sorted.map((element, index) => ({ ...element, z: index }));
    updateActiveSlide({ elements: nextSorted }, { refreshWorkspace: true, selectedElementId: selectedElement?.id || selectedElementIds[0], selectedElementIds });
  };

  const copySelectedElement = () => {
    copyElementsToClipboard(selectedElements);
  };

  const cutSelectedElement = () => {
    if (!selectedElements.length || activeElements.length <= selectedElements.length) {
      return;
    }
    copyElementsToClipboard(selectedElements);
    removeElementsByIds(selectedElementIds);
  };

  const pastePresentationClipboard = () => {
    if (!state.presentationClipboard) {
      return;
    }
    const clipboardElements = Array.isArray(state.presentationClipboard.elements)
      ? state.presentationClipboard.elements
      : [];
    if (clipboardElements.length) {
      const clones = clipboardElements.map((source, index) => ({
        ...source,
        id: createPresentationElementId(source.type || "element"),
        x: Math.min(94, Number(source.x || 0) + 4),
        y: Math.min(94, Number(source.y || 0) + 4),
        z: activeElements.length + index + 1
      }));
      writePresentationDraft((nextDeck) => {
        nextDeck.slides = nextDeck.slides.map((slide, index) => {
          if (index !== activeSlideIndex) {
            return slide;
          }
          const elements = normalizePresentationElements(slide.elements, {
            title: slide.title,
            body: slide.body,
            layout: slide.layout,
            image: slide.image,
            cta: slide.cta
          });
          return { ...slide, elements: [...elements, ...clones] };
        });
      }, { refreshWorkspace: true, selectedElementId: clones[0]?.id || "", selectedElementIds: clones.map((clone) => clone.id) });
      return;
    }
    insertElement({
      ...state.presentationClipboard,
      id: createPresentationElementId(state.presentationClipboard.type || "element"),
      x: Math.min(94, Number(state.presentationClipboard.x || 0) + 4),
      y: Math.min(94, Number(state.presentationClipboard.y || 0) + 4),
      z: activeElements.length + 1
    });
  };

  const alignSelectedElement = (alignment = "") => {
    if (!selectedElements.length) {
      return;
    }
    if (selectedElements.length > 1) {
      const bounds = selectionBounds(selectedElements);
      if (!bounds) {
        return;
      }
      updateElementsByIds(selectedElementIds, (element) => {
        const patch = {};
        if (alignment === "left") patch.x = bounds.x;
        if (alignment === "center") patch.x = bounds.x + bounds.w / 2 - Number(element.w || 0) / 2;
        if (alignment === "right") patch.x = bounds.right - Number(element.w || 0);
        if (alignment === "top") patch.y = bounds.y;
        if (alignment === "middle") patch.y = bounds.y + bounds.h / 2 - Number(element.h || 0) / 2;
        if (alignment === "bottom") patch.y = bounds.bottom - Number(element.h || 0);
        return { ...element, ...patch };
      }, { refreshWorkspace: true, selectedElementId: selectedElement?.id || selectedElementIds[0], selectedElementIds });
      return;
    }
    alignElement(selectedElement, alignment);
  };

  const distributeSelectedElements = (axis = "horizontal") => {
    if (selectedElements.length < 3) {
      return;
    }
    const sorted = [...selectedElements].sort((left, right) =>
      axis === "horizontal"
        ? Number(left.x || 0) - Number(right.x || 0)
        : Number(left.y || 0) - Number(right.y || 0)
    );
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const start = axis === "horizontal" ? Number(first.x || 0) : Number(first.y || 0);
    const end = axis === "horizontal" ? Number(last.x || 0) : Number(last.y || 0);
    const step = (end - start) / Math.max(1, sorted.length - 1);
    const positions = new Map(sorted.map((element, index) => [element.id, start + step * index]));
    updateElementsByIds(selectedElementIds, (element) => ({
      ...element,
      [axis === "horizontal" ? "x" : "y"]: positions.get(element.id) ?? element[axis === "horizontal" ? "x" : "y"]
    }), { refreshWorkspace: true, selectedElementId: selectedElement?.id || selectedElementIds[0], selectedElementIds });
  };

  const nudgeSelectedElement = (dx = 0, dy = 0) => {
    if (!selectedElements.length) {
      return;
    }
    const movableIds = selectedElements.filter((element) => !element.locked).map((element) => element.id);
    if (!movableIds.length) {
      return;
    }
    updateElementsByIds(movableIds, (element) => ({
      ...element,
      x: clampPresentationNumber(Number(element.x || 0) + dx, 0, 100 - Number(element.w || 0), element.x),
      y: clampPresentationNumber(Number(element.y || 0) + dy, 0, 100 - Number(element.h || 0), element.y)
    }), { refreshWorkspace: true, selectedElementId: selectedElement?.id || selectedElementIds[0], selectedElementIds });
  };

  const zoomPresentationCanvas = (delta = 0) => {
    state.presentationZoom = Math.max(0.5, Math.min(2, Number(state.presentationZoom || 1) + delta));
    renderWorkspace();
  };

  const handlePresentationKeyboard = (event) => {
    if (!isPresentationWorkspace()) {
      return;
    }
    const tagName = String(event.target?.tagName || "").toLowerCase();
    if (tagName === "input" || tagName === "textarea" || event.target?.isContentEditable) {
      return;
    }
    const step = event.shiftKey ? 5 : 1;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
      event.preventDefault();
      selectAllPresentationElements();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "x") {
      event.preventDefault();
      cutSelectedElement();
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      removeSelectedElement();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
      event.preventDefault();
      duplicateSelectedElement();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      if (event.shiftKey) {
        redoPresentationChange();
      } else {
        undoPresentationChange();
      }
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
      event.preventDefault();
      redoPresentationChange();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c") {
      event.preventDefault();
      copySelectedElement();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v") {
      event.preventDefault();
      pastePresentationClipboard();
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      nudgeSelectedElement(-step, 0);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      nudgeSelectedElement(step, 0);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      nudgeSelectedElement(0, -step);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      nudgeSelectedElement(0, step);
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setPresentationSelection([], "");
      renderWorkspace();
      return;
    }
    if (event.key === "Tab" && activeElements.length) {
      event.preventDefault();
      const currentIndex = activeElements.findIndex((element) => element.id === selectedElementIds[0]);
      const nextIndex = event.shiftKey
        ? (currentIndex <= 0 ? activeElements.length - 1 : currentIndex - 1)
        : (currentIndex >= activeElements.length - 1 ? 0 : currentIndex + 1);
      const nextElement = activeElements[nextIndex];
      if (nextElement) {
        setPresentationSelection([nextElement.id], nextElement.id);
        renderWorkspace();
      }
      return;
    }
    if (event.key === "F5") {
      event.preventDefault();
      openPresentationSlideShow(event.shiftKey ? activeSlideIndex : 0, { fullscreen: true });
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      executePresentationCommand("slideAdd");
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "g") {
      event.preventDefault();
      if (event.shiftKey) {
        ungroupSelectedElements();
      } else {
        groupSelectedElements();
      }
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "l") {
      event.preventDefault();
      toggleSelectedLock();
      return;
    }
  };

  if (presentationKeyboardHandler) {
    document.removeEventListener("keydown", presentationKeyboardHandler);
  }
  presentationKeyboardHandler = handlePresentationKeyboard;
  document.addEventListener("keydown", presentationKeyboardHandler);

  const executePresentationCommand = createWorkspaceCommandExecutor(
    "presentation",
    createPresentationWorkspaceCommandAdapter({
      addSlide: () => {
        writePresentationDraft((nextDeck) => {
          const insertIndex = Math.min(nextDeck.slides.length, activeSlideIndex + 1);
          const seed = nextDeck.slides[activeSlideIndex] || {};
          const title = `Slide ${nextDeck.slides.length + 1}`;
          const body = "- Main message\n- Proof point\n- Next step";
          nextDeck.slides.splice(insertIndex, 0, {
            title,
            body,
            ...normalizePresentationSlideMeta(
              {
                layout: "bullets",
                theme: seed.theme || "default",
                background: seed.background || presentationDefaultBackground(seed.theme || "default")
              },
              { title, body }
            )
          });
          return insertIndex;
        }, { refreshWorkspace: true });
      },
      duplicateSlide: () => {
        writePresentationDraft((nextDeck) => {
          const seed = nextDeck.slides[activeSlideIndex] || nextDeck.slides[0];
          const insertIndex = Math.min(nextDeck.slides.length, activeSlideIndex + 1);
          const elements = normalizePresentationElements(seed.elements, {
            title: seed.title,
            body: seed.body,
            layout: seed.layout,
            image: seed.image,
            cta: seed.cta
          }).map((element) => ({
            ...element,
            id: createPresentationElementId(element.type)
          }));
          nextDeck.slides.splice(insertIndex, 0, {
            ...seed,
            title: `${seed.title || "Slide"} copy`,
            elements
          });
          return insertIndex;
        }, { refreshWorkspace: true });
      },
      deleteSlide: () => {
        if (deck.slides.length <= 1) {
          return;
        }
        writePresentationDraft((nextDeck) => {
          nextDeck.slides.splice(activeSlideIndex, 1);
          return Math.max(0, activeSlideIndex - 1);
        }, { refreshWorkspace: true });
      },
      moveSlide: (direction = 0) => {
        const nextIndex = activeSlideIndex + Number(direction || 0);
        if (nextIndex < 0 || nextIndex >= deck.slides.length) {
          return;
        }
        writePresentationDraft((nextDeck) => {
          nextDeck.slides = moveItemInArray(nextDeck.slides, activeSlideIndex, nextIndex);
          return nextIndex;
        }, { refreshWorkspace: true });
      },
      setLayout: (layout = "") => {
        const nextLayout = normalizePresentationLayout(layout);
        updateActiveSlide({
          layout: nextLayout,
          elements: createDefaultPresentationElements({
            title: activeSlide?.title || "",
            body: visibleBody,
            layout: nextLayout,
            image: activeSlide?.image || "",
            cta: activeSlide?.cta || ""
          })
        }, { refreshWorkspace: true });
      },
      setTheme: (theme = "") => {
        const nextTheme = normalizePresentationTheme(theme);
        updateActiveSlide({
          theme: nextTheme,
          background: presentationDefaultBackground(nextTheme)
        }, { refreshWorkspace: true });
      }
    })
  );

  const downloadPresentationExport = async () => {
    if (!state.currentWorkObjectId) {
      return;
    }
    const markdown = buildPresentationContent({ title: deck.title, slides: deck.slides });
    const response = await fetch(`/api/work-objects/${encodeURIComponent(state.currentWorkObjectId)}/presentation-export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        markdown,
        title: deck.title || state.currentWorkObject?.title || "Presentation",
        downloadName: `${deck.title || state.currentWorkObject?.title || "presentation"}.pptx`
      })
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || "Presentation export failed");
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${String(deck.title || "presentation").replace(/[^\w.-]+/g, "_")}.pptx`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setStatus("Presentation PPTX exportee.");
  };

  const openPresentationSlideShow = (startIndex = 0, { fullscreen = false, presenter = false } = {}) => {
    let slideIndex = Math.max(0, Math.min(deck.slides.length - 1, Number(startIndex || 0)));
    const overlay = document.createElement("div");
    overlay.className = `workspace-powerpoint-slideshow${presenter ? " is-presenter" : ""}`;
    overlay.tabIndex = -1;
    const frame = document.createElement("div");
    frame.className = "workspace-powerpoint-slideshow-frame";
    const presenterPanel = document.createElement("aside");
    presenterPanel.className = "workspace-powerpoint-presenter-panel";
    const controls = document.createElement("div");
    controls.className = "workspace-powerpoint-slideshow-controls";
    const previousButton = createRibbonButton("Previous", "chevronLeft", () => {
      slideIndex = Math.max(0, slideIndex - 1);
      renderSlide();
    });
    const nextButton = createRibbonButton("Next", "chevronRight", () => {
      slideIndex = Math.min(deck.slides.length - 1, slideIndex + 1);
      renderSlide();
    });
    const closeButton = createRibbonButton("Close", "close", () => close());
    const counter = document.createElement("span");
    counter.className = "workspace-powerpoint-slideshow-counter";
    controls.append(previousButton, counter, nextButton, closeButton);
    overlay.append(frame, presenterPanel, controls);

    const renderElement = (element, host) => {
      const node = document.createElement("div");
      node.className = [
        "workspace-powerpoint-slideshow-element",
        "workspace-powerpoint-element",
        `type-${element.type}`,
        `shape-${element.shape || "rectangle"}`,
        element.animation && element.animation !== "none" ? `animate-${element.animation}` : ""
      ].filter(Boolean).join(" ");
      node.style.left = `${element.x}%`;
      node.style.top = `${element.y}%`;
      node.style.width = `${element.w}%`;
      node.style.height = `${element.h}%`;
      node.style.zIndex = String(element.z || 0);
      node.style.color = element.color;
      node.style.background = element.fill;
      node.style.borderColor = element.stroke;
      node.style.borderWidth = `${Number(element.strokeWidth || 0)}px`;
      node.style.opacity = String(element.opacity);
      node.style.transform = `rotate(${element.rotation || 0}deg) scale(${element.flipX ? -1 : 1}, ${element.flipY ? -1 : 1})`;
      node.style.textAlign = element.align || "left";
      node.style.fontSize = `${element.fontSize}px`;
      node.style.fontFamily = element.fontFamily || "";
      node.style.fontWeight = element.bold ? "700" : "400";
      node.style.fontStyle = element.italic ? "italic" : "normal";
      node.style.textDecoration = element.underline ? "underline" : "none";
      if (element.type === "image" && element.src) {
        const image = document.createElement("img");
        image.src = element.src;
        image.alt = element.text || "Slide image";
        image.style.objectPosition = `${element.cropX || 50}% ${element.cropY || 50}%`;
        image.style.transform = `scale(${element.zoom || 1})`;
        node.appendChild(image);
      } else if (element.type === "table") {
        const tableData = parsePresentationTableText(element.text || "");
        const table = document.createElement("table");
        table.className = "workspace-powerpoint-table";
        const thead = document.createElement("thead");
        const headerRow = document.createElement("tr");
        tableData.headers.forEach((header) => {
          const cell = document.createElement("th");
          cell.textContent = header;
          headerRow.appendChild(cell);
        });
        thead.appendChild(headerRow);
        const tbody = document.createElement("tbody");
        tableData.rows.forEach((row) => {
          const tr = document.createElement("tr");
          row.forEach((value) => {
            const cell = document.createElement("td");
            cell.textContent = value;
            tr.appendChild(cell);
          });
          tbody.appendChild(tr);
        });
        table.append(thead, tbody);
        node.appendChild(table);
      } else if (element.type === "chart") {
        const data = parsePresentationChartText(element.text || "");
        const maxValue = Math.max(1, ...data.map((item) => Math.abs(Number(item.value || 0))));
        const chart = document.createElement("div");
        chart.className = `workspace-powerpoint-chart chart-${element.chartType || "bar"}`;
        data.slice(0, 8).forEach((item, index) => {
          const bar = document.createElement("span");
          bar.className = "workspace-powerpoint-chart-bar";
          bar.style.setProperty("--value", `${Math.max(4, Math.abs(item.value) / maxValue * 100)}%`);
          bar.style.setProperty("--bar-index", String(index));
          const label = document.createElement("em");
          label.textContent = item.label;
          const value = document.createElement("strong");
          value.textContent = String(item.value);
          bar.append(label, value);
          chart.appendChild(bar);
        });
        node.appendChild(chart);
      } else if (element.type === "icon") {
        const icon = document.createElement("span");
        icon.className = "workspace-powerpoint-icon-object";
        icon.textContent = element.text || "*";
        node.appendChild(icon);
      } else if (element.type === "video") {
        const shell = document.createElement("span");
        shell.className = "workspace-powerpoint-video-object";
        shell.appendChild(createWorkspaceIconNode("play", {
          className: "workspace-powerpoint-video-play",
          label: "Play"
        }));
        const label = document.createElement("strong");
        label.textContent = element.text || "Video";
        shell.appendChild(label);
        node.appendChild(shell);
      } else if (element.type === "code") {
        const code = document.createElement("code");
        code.className = "workspace-powerpoint-code-object";
        code.textContent = element.text || "";
        node.appendChild(code);
      } else {
        const text = document.createElement("span");
        text.className = element.type === "equation" ? "workspace-powerpoint-equation-object" : "workspace-powerpoint-element-text";
        text.textContent = element.text || "";
        node.appendChild(text);
      }
      host.appendChild(node);
    };

    function renderSlide() {
      const slide = deck.slides[slideIndex] || deck.slides[0] || {};
      frame.innerHTML = "";
      const slideCanvas = document.createElement("section");
      const slideTransition = slide.transition || "none";
      slideCanvas.className = [
        "workspace-powerpoint-slideshow-slide",
        "workspace-powerpoint-slide",
        `theme-${slide.theme || "default"}`,
        slideTransition && slideTransition !== "none" ? `transition-${slideTransition}` : ""
      ].filter(Boolean).join(" ");
      slideCanvas.style.background = slide.background || presentationDefaultBackground(slide.theme || "default");
      slideCanvas.style.animationDuration = `${Number(slide.transitionDuration || 1)}s`;
      normalizePresentationElements(slide.elements, {
        title: slide.title,
        body: stripPresentationInternalMeta(slide.body || ""),
        layout: slide.layout,
        image: slide.image,
        cta: slide.cta
      })
        .sort((left, right) => Number(left.z || 0) - Number(right.z || 0))
        .forEach((element) => renderElement(element, slideCanvas));
      frame.appendChild(slideCanvas);
      if (presenter) {
        presenterPanel.innerHTML = "";
        const panelTitle = document.createElement("strong");
        panelTitle.textContent = "Presenter view";
        const notesLabel = document.createElement("span");
        notesLabel.textContent = "Speaker notes";
        const notesText = document.createElement("p");
        notesText.textContent = slide.notes || "No speaker notes for this slide.";
        const nextLabel = document.createElement("span");
        nextLabel.textContent = "Next slide";
        const nextText = document.createElement("p");
        nextText.textContent = deck.slides[slideIndex + 1]?.title || "End of deck";
        presenterPanel.append(panelTitle, notesLabel, notesText, nextLabel, nextText);
      }
      counter.textContent = `${slideIndex + 1} / ${deck.slides.length}`;
      previousButton.disabled = slideIndex <= 0;
      nextButton.disabled = slideIndex >= deck.slides.length - 1;
    }

    function onKeydown(event) {
      if (event.key === "Escape") {
        close();
      } else if (event.key === "ArrowRight" || event.key === "PageDown" || event.key === " ") {
        event.preventDefault();
        slideIndex = Math.min(deck.slides.length - 1, slideIndex + 1);
        renderSlide();
      } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        slideIndex = Math.max(0, slideIndex - 1);
        renderSlide();
      }
    }

    function close() {
      document.removeEventListener("keydown", onKeydown, true);
      if (document.fullscreenElement === overlay && document.exitFullscreen) {
        document.exitFullscreen().catch?.(() => {});
      }
      overlay.remove();
    }

    document.body.appendChild(overlay);
    document.addEventListener("keydown", onKeydown, true);
    renderSlide();
    if (fullscreen && overlay.requestFullscreen) {
      overlay.requestFullscreen().catch(() => {});
    }
    overlay.focus({ preventScroll: true });
  };

  const createRibbonButton = (
    label = "",
    icon = "",
    action = null,
    { disabled = false, active = false, size = "regular", compact = false } = {}
  ) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = [
      "workspace-powerpoint-command",
      active ? "active" : "",
      size ? `size-${size}` : "",
      compact ? "is-compact" : ""
    ].filter(Boolean).join(" ");
    button.disabled = disabled;
    button.title = label;
    button.appendChild(
      createWorkspaceIconNode(icon || getWorkspaceCommandIcon(label), {
        className: "workspace-powerpoint-command-icon",
        label
      })
    );
    const text = document.createElement("span");
    text.textContent = label;
    button.appendChild(text);
    if (typeof action === "function") {
      button.addEventListener("click", action);
    }
    return button;
  };

  const createRibbonMenuButton = (label = "", icon = "", items = [], options = {}) =>
    createRibbonButton(label, icon, (event) => showPresentationContextMenu(event, items), options);

  const createRibbonStack = (children = []) => {
    const stack = document.createElement("div");
    stack.className = "workspace-powerpoint-ribbon-stack";
    children.filter(Boolean).forEach((child) => stack.appendChild(child));
    return stack;
  };

  const createRibbonGroup = (label = "", children = [], { wide = false } = {}) => {
    const group = document.createElement("div");
    group.className = `workspace-powerpoint-ribbon-group${wide ? " is-wide" : ""}`;
    const body = document.createElement("div");
    body.className = "workspace-powerpoint-ribbon-actions";
    children.filter(Boolean).forEach((child) => body.appendChild(child));
    const caption = document.createElement("span");
    caption.className = "workspace-powerpoint-ribbon-caption";
    caption.textContent = label;
    group.append(body, caption);
    return group;
  };

  const createSelect = (label = "", options = [], value = "", onChange = null) => {
    const wrap = document.createElement("label");
    wrap.className = "workspace-powerpoint-select-wrap";
    const caption = document.createElement("span");
    caption.textContent = label;
    const select = document.createElement("select");
    select.className = "workspace-powerpoint-select";
    options.forEach((option) => {
      const item = document.createElement("option");
      item.value = option.value;
      item.textContent = option.label;
      item.selected = String(option.value) === String(value);
      select.appendChild(item);
    });
    if (typeof onChange === "function") {
      select.addEventListener("change", (event) => onChange(event.target.value));
    }
    wrap.append(caption, select);
    return wrap;
  };

  const createRibbonField = (label = "", input = null) => {
    const wrap = document.createElement("label");
    wrap.className = "workspace-powerpoint-ribbon-field";
    const caption = document.createElement("span");
    caption.textContent = label;
    wrap.appendChild(caption);
    if (input) {
      wrap.appendChild(input);
    }
    return wrap;
  };

  const createThemeGallery = () => {
    const gallery = document.createElement("div");
    gallery.className = "workspace-powerpoint-theme-gallery";
    PRESENTATION_SLIDE_THEMES.forEach((theme) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `workspace-powerpoint-theme-preset${activeSlide?.theme === theme.value ? " active" : ""}`;
      button.title = theme.label;
      button.style.background = presentationDefaultBackground(theme.value);
      button.addEventListener("click", () => executePresentationCommand("slideTheme", { value: theme.value }));
      const label = document.createElement("span");
      label.textContent = theme.label;
      button.appendChild(label);
      gallery.appendChild(button);
    });
    return gallery;
  };

  const createLayoutGallery = () => {
    const gallery = document.createElement("div");
    gallery.className = "workspace-powerpoint-layout-gallery";
    PRESENTATION_SLIDE_LAYOUTS.slice(0, 6).forEach((layout) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `workspace-powerpoint-layout-preset layout-${layout.value}${activeSlide?.layout === layout.value ? " active" : ""}`;
      button.title = layout.label;
      button.addEventListener("click", () => executePresentationCommand("slideLayout", { value: layout.value }));
      const preview = document.createElement("span");
      preview.className = "workspace-powerpoint-layout-preview";
      preview.innerHTML = "<i></i><b></b><em></em>";
      const label = document.createElement("span");
      label.textContent = layout.label;
      button.append(preview, label);
      gallery.appendChild(button);
    });
    return gallery;
  };

  const createInspectorField = (label = "", input = null) => {
    const field = document.createElement("label");
    field.className = "workspace-powerpoint-field";
    const caption = document.createElement("span");
    caption.textContent = label;
    field.appendChild(caption);
    if (input) {
      field.appendChild(input);
    }
    return field;
  };

  const createTextInput = (value = "", onInput = null, { type = "text", min = "", max = "", step = "" } = {}) => {
    const input = document.createElement("input");
    input.type = type;
    input.value = value ?? "";
    input.className = "workspace-powerpoint-input";
    if (min !== "") input.min = min;
    if (max !== "") input.max = max;
    if (step !== "") input.step = step;
    if (typeof onInput === "function") {
      input.addEventListener(type === "number" || type === "color" ? "change" : "input", (event) => onInput(event.target.value));
    }
    return input;
  };

  const closePresentationContextMenu = () => {
    document.querySelectorAll(".workspace-powerpoint-context-menu").forEach((menu) => menu.remove());
  };

  const showPresentationContextMenu = (event, items = []) => {
    event.preventDefault();
    event.stopPropagation();
    closePresentationContextMenu();

    const menu = document.createElement("div");
    menu.className = "workspace-powerpoint-context-menu";
    menu.setAttribute("role", "menu");

    let closeOnOutside = null;
    let closeOnEscape = null;
    const cleanup = () => {
      menu.remove();
      if (closeOnOutside) {
        document.removeEventListener("pointerdown", closeOnOutside, true);
      }
      if (closeOnEscape) {
        document.removeEventListener("keydown", closeOnEscape, true);
      }
    };

    const appendMenuItems = (host, menuItems = []) => {
      menuItems.forEach((item) => {
        if (item?.separator) {
          const separator = document.createElement("div");
          separator.className = "workspace-powerpoint-context-separator";
          host.appendChild(separator);
          return;
        }

        const hasChildren = Array.isArray(item?.children) && item.children.length;
        const rowHost = hasChildren ? document.createElement("div") : host;
        if (hasChildren) {
          rowHost.className = "workspace-powerpoint-context-submenu-wrap";
          host.appendChild(rowHost);
        }
        const button = document.createElement("button");
        button.type = "button";
        button.className = [
          "workspace-powerpoint-context-item",
          item?.danger ? "danger" : "",
          hasChildren ? "has-submenu" : ""
        ].filter(Boolean).join(" ");
        button.disabled = Boolean(item?.disabled);
        button.setAttribute("role", "menuitem");
        button.appendChild(
          createWorkspaceIconNode(item?.icon || getWorkspaceCommandIcon(item?.label || ""), {
            className: "workspace-powerpoint-context-icon",
            label: item?.label || ""
          })
        );
        const label = document.createElement("span");
        label.textContent = item?.label || "";
        button.appendChild(label);
        if (hasChildren) {
          const arrow = document.createElement("b");
          arrow.className = "workspace-powerpoint-context-submenu-arrow";
          arrow.textContent = ">";
          button.appendChild(arrow);
          const submenu = document.createElement("div");
          submenu.className = "workspace-powerpoint-context-menu workspace-powerpoint-context-submenu";
          submenu.setAttribute("role", "menu");
          appendMenuItems(submenu, item.children);
          rowHost.append(button, submenu);
          button.addEventListener("click", (clickEvent) => {
            clickEvent.preventDefault();
            clickEvent.stopPropagation();
          });
          return;
        }
        if (typeof item?.action === "function") {
          button.addEventListener("click", (clickEvent) => {
            clickEvent.preventDefault();
            clickEvent.stopPropagation();
            cleanup();
            if (!button.disabled) {
              item.action();
            }
          });
        }
        rowHost.appendChild(button);
      });
    };

    appendMenuItems(menu, items);

    const menuHost = document.fullscreenElement || document.body;
    menuHost.appendChild(menu);
    const menuRect = menu.getBoundingClientRect();
    const left = Math.max(8, Math.min(event.clientX, window.innerWidth - menuRect.width - 8));
    const top = Math.max(8, Math.min(event.clientY, window.innerHeight - menuRect.height - 8));
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;

    closeOnOutside = (pointerEvent) => {
      if (!menu.contains(pointerEvent.target)) {
        cleanup();
      }
    };
    closeOnEscape = (keyboardEvent) => {
      if (keyboardEvent.key === "Escape") {
        cleanup();
      }
    };
    window.setTimeout(() => {
      document.addEventListener("pointerdown", closeOnOutside, true);
      document.addEventListener("keydown", closeOnEscape, true);
    }, 0);
  };

  const shell = document.createElement("div");
  shell.className = "workspace-powerpoint-app workspace-slide-editor";
  shell.tabIndex = -1;
  const togglePresentationEditorFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      return;
    }
    container.requestFullscreen?.().catch(() => {});
  };

  const titleBar = document.createElement("div");
  titleBar.className = "workspace-powerpoint-titlebar";
  const titleMeta = document.createElement("div");
  titleMeta.className = "workspace-powerpoint-title-meta";
  const deckTitleInput = createTextInput(deck.title, (value) => {
    writePresentationDraft((nextDeck) => {
      nextDeck.title = value;
    }, { refreshWorkspace: false });
  });
  deckTitleInput.classList.add("workspace-powerpoint-deck-title");
  const deckMeta = document.createElement("span");
  deckMeta.textContent = `${deck.slides.length} slides | ${activeSlide?.layout || "content"} | ${activeSlide?.transition || "none"} | ${selectedElements.length} selected`;
  titleMeta.append(deckTitleInput, deckMeta);
  const titleActions = document.createElement("div");
  titleActions.className = "workspace-powerpoint-title-actions";
  const slideJump = createSelect(
    "Slide",
    deck.slides.map((slide, index) => ({
      value: String(index),
      label: `${index + 1}. ${slide.title || "Untitled"}`
    })),
    String(activeSlideIndex),
    (value) => setActivePresentationSlide(Number(value))
  );
  slideJump.classList.add("workspace-powerpoint-slide-jump");
  titleActions.append(
    slideJump,
    createRibbonButton("Plein ecran", "maximize", togglePresentationEditorFullscreen),
    createRibbonButton("Diaporama", "play", () => openPresentationSlideShow(activeSlideIndex, { fullscreen: true })),
    createRibbonButton("Vue presentateur", "presentation", () => openPresentationSlideShow(activeSlideIndex, { fullscreen: true, presenter: true })),
    createRibbonButton("Export PPTX", "download", () => downloadPresentationExport().catch(handleError))
  );
  titleBar.append(titleMeta, titleActions);

  const updateSelectedElementStyle = (patch = {}) => {
    if (!selectedElements.length) {
      return;
    }
    updateElementsByIds(selectedElementIds, (element) => ({ ...element, ...patch }), {
      refreshWorkspace: true,
      selectedElementId: selectedElement?.id || selectedElementIds[0],
      selectedElementIds
    });
  };

  const isPresentationTextAlignmentTarget = (element = null) =>
    Boolean(
      element &&
        element.shape !== "line" &&
        ["title", "text", "shape", "icon", "video", "equation"].includes(String(element.type || ""))
    );

  const isPresentationShapeEditable = (element = null) =>
    Boolean(element && ["title", "text", "shape"].includes(String(element.type || "")));

  const selectedTextAlignmentEnabled = selectedElements.some(isPresentationTextAlignmentTarget);
  const selectedShapeEditEnabled = selectedElements.some(isPresentationShapeEditable);

  const setSelectedTextAlignment = (alignment = "left") => {
    if (!selectedTextAlignmentEnabled || !PRESENTATION_TEXT_ALIGNMENTS.includes(alignment)) {
      return;
    }
    updateElementsByIds(selectedElementIds, (element) =>
      isPresentationTextAlignmentTarget(element) ? { ...element, align: alignment } : element
    , {
      refreshWorkspace: true,
      selectedElementId: selectedElement?.id || selectedElementIds[0],
      selectedElementIds
    });
  };

  const setSelectedShapeType = (shape = "rectangle") => {
    const nextShape = PRESENTATION_SHAPE_TYPES.includes(String(shape || "").toLowerCase())
      ? String(shape || "").toLowerCase()
      : "rectangle";
    if (!selectedShapeEditEnabled) {
      return;
    }
    updateElementsByIds(selectedElementIds, (element) =>
      isPresentationShapeEditable(element) ? { ...element, shape: nextShape } : element
    , {
      refreshWorkspace: true,
      selectedElementId: selectedElement?.id || selectedElementIds[0],
      selectedElementIds
    });
  };

  const insertTextBox = () => insertElement({
    type: "text",
    text: "New text box",
    x: 16,
    y: 30,
    w: 38,
    h: 14,
    fontSize: 22,
    fill: "transparent",
    stroke: "transparent"
  });
  const insertTitleBox = () => insertElement({
    type: "title",
    text: "New title",
    x: 10,
    y: 12,
    w: 70,
    h: 14,
    fontSize: 36,
    bold: true,
    fill: "transparent",
    stroke: "transparent"
  });
  const insertBulletsBox = () => insertElement({
    type: "text",
    text: "- First point\n- Second point\n- Third point",
    x: 10,
    y: 36,
    w: 48,
    h: 26,
    fontSize: 21,
    fill: "transparent",
    stroke: "transparent"
  });
  const insertImageBox = () => {
    if (document.querySelector(".workspace-powerpoint-file-picker")) {
      return;
    }
    const picker = document.createElement("input");
    picker.type = "file";
    picker.accept = "image/*";
    picker.className = "workspace-powerpoint-file-picker";
    picker.style.display = "none";
    document.body.appendChild(picker);
    const cleanup = () => picker.remove();
    picker.addEventListener("change", () => {
      const file = picker.files?.[0];
      if (!file) {
        cleanup();
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        cleanup();
        insertElement({
          type: "image",
          text: file.name,
          src: event.target.result,
          x: 20,
          y: 20,
          w: 60,
          h: 45,
          fill: "#f8fafc",
          stroke: "transparent"
        });
      };
      reader.onerror = cleanup;
      reader.onabort = cleanup;
      reader.readAsDataURL(file);
    });
    picker.addEventListener("cancel", cleanup);
    picker.addEventListener("abort", cleanup);
    picker.click();
  };
  const insertShapeBox = (shape = "rectangle") => insertElement({
    type: "shape",
    shape,
    text: shape === "line" || shape === "ellipse" || shape === "triangle" || shape === "diamond" || shape === "arrow" ? "" : "Shape",
    x: shape === "line" ? 20 : 55,
    y: shape === "line" ? 70 : 34,
    w: shape === "line" ? 48 : shape === "ellipse" ? 18 : shape === "arrow" ? 34 : 28,
    h: shape === "line" ? 3 : shape === "ellipse" ? 18 : 18,
    fill: shape === "line" ? "#2563eb" : shape === "ellipse" ? "#f0fdf4" : "#eff6ff",
    stroke: shape === "line" ? "#2563eb" : shape === "ellipse" ? "#86efac" : "#93c5fd",
    align: "center"
  });
  const insertTableBox = () => insertElement({
    type: "table",
    text: "Metric | Value | Owner\nPipeline | 42 | Sales\nForecast | 18k | Finance",
    x: 12,
    y: 34,
    w: 46,
    h: 28,
    fontSize: 13,
    fill: "#ffffff",
    stroke: "#cbd5e1"
  });
  const insertChartBox = () => insertElement({
    type: "chart",
    chartType: "bar",
    text: "North | 42\nSouth | 28\nWest | 18",
    x: 56,
    y: 34,
    w: 34,
    h: 30,
    fontSize: 12,
    fill: "#f0fdf4",
    stroke: "#86efac",
    align: "center"
  });
  const insertIconBox = () => insertElement({
    type: "icon",
    text: "*",
    x: 58,
    y: 24,
    w: 12,
    h: 12,
    fontSize: 42,
    color: "#2563eb",
    fill: "transparent",
    stroke: "transparent",
    align: "center"
  });
  const insertVideoBox = () => insertElement({
    type: "video",
    text: "Video",
    src: "",
    x: 50,
    y: 28,
    w: 40,
    h: 32,
    fontSize: 18,
    fill: "#111827",
    stroke: "#334155",
    color: "#ffffff",
    align: "center"
  });
  const insertEquationBox = () => insertElement({
    type: "equation",
    text: "f(x) = ax + b",
    x: 18,
    y: 62,
    w: 34,
    h: 12,
    fontSize: 24,
    fontFamily: "Georgia, serif",
    fill: "transparent",
    stroke: "transparent"
  });
  const insertCodeBox = () => insertElement({
    type: "code",
    text: "const total = price * quantity;",
    x: 12,
    y: 58,
    w: 46,
    h: 18,
    fontSize: 13,
    fontFamily: "Consolas, monospace",
    fill: "#0f172a",
    stroke: "#334155",
    color: "#e2e8f0"
  });

  const isPresentationListTextTarget = (element = null) =>
    Boolean(
      element &&
        !element.locked &&
        element.shape !== "line" &&
        ["title", "text", "shape"].includes(String(element.type || ""))
    );

  const getPresentationTextLines = (value = "") => String(value ?? "").replace(/\r\n?/g, "\n").split("\n");

  const stripPresentationListPrefix = (line = "") =>
    String(line || "").replace(/^(\s*)(?:[-*]\s+|\d+[.)]\s+)/, "$1");

  const hasPresentationListPrefix = (line = "", ordered = false) => {
    const pattern = ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*]\s+/;
    return pattern.test(String(line || ""));
  };

  const selectedElementHasListStyle = (ordered = false) => {
    if (!isPresentationListTextTarget(selectedElement)) {
      return false;
    }
    const lines = getPresentationTextLines(selectedElement.text || "").filter((line) => line.trim());
    return Boolean(lines.length && lines.every((line) => hasPresentationListPrefix(line, ordered)));
  };

  const formatPresentationListText = (value = "", ordered = false) => {
    const lines = getPresentationTextLines(value);
    const nonEmptyLines = lines.filter((line) => line.trim());
    const shouldRemove =
      nonEmptyLines.length > 0 && nonEmptyLines.every((line) => hasPresentationListPrefix(line, ordered));
    let itemNumber = 1;
    return lines
      .map((line) => {
        if (!line.trim()) {
          return line;
        }
        if (shouldRemove) {
          return stripPresentationListPrefix(line);
        }
        const indent = line.match(/^\s*/)?.[0] || "";
        const content = stripPresentationListPrefix(line).slice(indent.length).trimStart();
        const marker = ordered ? `${itemNumber++}.` : "-";
        return `${indent}${marker} ${content}`;
      })
      .join("\n");
  };

  const changePresentationListIndentText = (value = "", direction = "indent") =>
    getPresentationTextLines(value)
      .map((line) => {
        if (!line.trim()) {
          return line;
        }
        if (direction === "outdent") {
          return line.replace(/^\s{1,2}/, "");
        }
        return `  ${line}`;
      })
      .join("\n");

  const updateActiveTextEditorValue = (editor, element, nextValue = "", caretOffset = null) => {
    editor.textContent = nextValue;
    updateElement(element.id, { text: nextValue }, { refreshWorkspace: false });
    if (Number.isFinite(caretOffset)) {
      window.requestAnimationFrame(() => setPresentationTextCaretOffset(editor, caretOffset));
    }
  };

  const getPresentationTextCaretOffset = (editor) => {
    const selection = window.getSelection?.();
    if (!selection?.rangeCount || !editor.contains(selection.anchorNode)) {
      return String(editor.textContent || "").length;
    }
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.setEnd(selection.anchorNode, selection.anchorOffset);
    return range.toString().length;
  };

  const setPresentationTextCaretOffset = (editor, offset = 0) => {
    const safeOffset = Math.max(0, Number(offset || 0));
    const selection = window.getSelection?.();
    if (!selection) {
      return;
    }
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    let remaining = safeOffset;
    let textNode = walker.nextNode();
    while (textNode) {
      const length = textNode.nodeValue.length;
      if (remaining <= length) {
        const range = document.createRange();
        range.setStart(textNode, remaining);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        return;
      }
      remaining -= length;
      textNode = walker.nextNode();
    }
    if (!editor.firstChild) {
      editor.appendChild(document.createTextNode(""));
    }
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  };

  const getPresentationLineAtOffset = (value = "", offset = 0) => {
    const text = String(value ?? "").replace(/\r\n?/g, "\n");
    const safeOffset = Math.max(0, Math.min(text.length, Number(offset || 0)));
    const lines = text.split("\n");
    let start = 0;
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const end = start + line.length;
      if (safeOffset <= end || index === lines.length - 1) {
        return { index, line, start, end };
      }
      start = end + 1;
    }
    return { index: 0, line: text, start: 0, end: text.length };
  };

  const handlePresentationListKeydown = (event, element, editor) => {
    if (!isPresentationListTextTarget(element)) {
      return false;
    }
    const value = String(editor.textContent || "").replace(/\r\n?/g, "\n");
    const caretOffset = getPresentationTextCaretOffset(editor);
    const lineInfo = getPresentationLineAtOffset(value, caretOffset);

    if (event.key === "Tab") {
      event.preventDefault();
      event.stopPropagation();
      const lineStart = lineInfo.start;
      const lineEnd = lineInfo.end;
      const currentLine = value.slice(lineStart, lineEnd);
      const nextLine = event.shiftKey ? currentLine.replace(/^\s{1,2}/, "") : `  ${currentLine}`;
      const nextValue = `${value.slice(0, lineStart)}${nextLine}${value.slice(lineEnd)}`;
      const delta = nextLine.length - currentLine.length;
      updateActiveTextEditorValue(editor, element, nextValue, Math.max(lineStart, caretOffset + delta));
      return true;
    }

    if (event.key !== "Enter") {
      return false;
    }

    const prefixMatch = lineInfo.line.match(/^(\s*)([-*]|\d+[.)])\s*/);
    if (!prefixMatch) {
      return false;
    }

    event.preventDefault();
    event.stopPropagation();
    const lineContent = lineInfo.line.slice(prefixMatch[0].length).trim();
    if (!lineContent) {
      const nextLine = prefixMatch[1] || "";
      const nextValue = `${value.slice(0, lineInfo.start)}${nextLine}${value.slice(lineInfo.end)}`;
      updateActiveTextEditorValue(editor, element, nextValue, lineInfo.start + nextLine.length);
      return true;
    }

    const marker = prefixMatch[2];
    const orderedMatch = marker.match(/^(\d+)([.)])$/);
    const nextMarker = orderedMatch ? `${Number(orderedMatch[1]) + 1}${orderedMatch[2]}` : marker;
    const insertion = `\n${prefixMatch[1]}${nextMarker} `;
    const nextValue = `${value.slice(0, caretOffset)}${insertion}${value.slice(caretOffset)}`;
    updateActiveTextEditorValue(editor, element, nextValue, caretOffset + insertion.length);
    return true;
  };

  const applySelectedElementTextTransform = (transformer = (value) => value) => {
    if (!isPresentationListTextTarget(selectedElement)) {
      return;
    }
    const activeEditor = document.activeElement?.closest?.(".workspace-powerpoint-element-text[contenteditable='true']");
    const value = activeEditor && canvas?.contains(activeEditor)
      ? String(activeEditor.textContent || "")
      : String(selectedElement.text || "");
    const nextValue = transformer(value);
    if (activeEditor && canvas?.contains(activeEditor)) {
      const caretOffset = Math.min(getPresentationTextCaretOffset(activeEditor), nextValue.length);
      updateActiveTextEditorValue(activeEditor, selectedElement, nextValue, caretOffset);
      return;
    }
    updateElement(selectedElement.id, { text: nextValue }, { refreshWorkspace: true });
  };

  const toggleSelectedElementList = (ordered = false) => {
    applySelectedElementTextTransform((value) => formatPresentationListText(value, ordered));
  };

  const changeSelectedElementListIndent = (direction = "indent") => {
    applySelectedElementTextTransform((value) => changePresentationListIndentText(value, direction));
  };

  const getSlideElements = (slide = {}) =>
    normalizePresentationElements(slide.elements, {
      title: slide.title,
      body: slide.body,
      layout: slide.layout,
      image: slide.image,
      cta: slide.cta
    });

  const extractPresentationActionLines = (value = "") =>
    getPresentationTextLines(value)
      .map((line) => stripPresentationListPrefix(line).trim())
      .filter(Boolean)
      .filter((line, index, lines) => lines.indexOf(line) === index);

  const buildDeckAudit = () => {
    const slides = Array.isArray(deck.slides) ? deck.slides : [];
    const slideStats = slides.map((slide, index) => {
      const elements = getSlideElements(slide);
      const text = [
        slide.title,
        stripPresentationInternalMeta(slide.body || ""),
        ...elements.map((element) => element.text || "")
      ].join("\n");
      return {
        index,
        title: String(slide.title || "").trim(),
        body: stripPresentationInternalMeta(slide.body || "").trim(),
        notes: String(slide.notes || "").trim(),
        theme: String(slide.theme || "default"),
        background: String(slide.background || ""),
        transition: String(slide.transition || "none"),
        elements,
        wordCount: countWords(text),
        visualCount: elements.filter((element) => ["shape", "image", "chart", "table", "icon", "video"].includes(element.type)).length
      };
    });
    const issues = [];
    const slideCount = slideStats.length;
    const slidesWithTitles = slideStats.filter((slide) => slide.title).length;
    const slidesWithNotes = slideStats.filter((slide) => slide.notes).length;
    const slidesWithVisuals = slideStats.filter((slide) => slide.visualCount > 0).length;
    const heavySlides = slideStats.filter((slide) => slide.wordCount > 90 || slide.elements.length > 8);
    const emptySlides = slideStats.filter((slide) => !slide.body && slide.elements.length <= 1);
    const themeCount = new Set(slideStats.map((slide) => slide.theme)).size;
    const backgroundCount = new Set(slideStats.map((slide) => slide.background).filter(Boolean)).size;
    const transitionCount = new Set(slideStats.map((slide) => slide.transition)).size;
    const titleWords = slideStats.flatMap((slide) => slide.title.toLowerCase().split(/\s+/).filter(Boolean));
    const repeatedTitleWords = titleWords.length - new Set(titleWords).size;
    const hasAgenda = slideStats.some((slide) => /\b(agenda|plan|sommaire|outline)\b/i.test(slide.title));
    const hasClosing = slideStats.some((slide) => /\b(next|suite|action|decision|conclusion|merci|thank)\b/i.test(`${slide.title}\n${slide.body}`));

    if (slideCount < 3) issues.push("Le deck est court : ajoute un agenda, une preuve et une slide de conclusion.");
    if (slidesWithTitles < slideCount) issues.push("Certaines slides n'ont pas de titre clair.");
    if (slidesWithNotes < Math.ceil(slideCount * 0.6)) issues.push("Peu de notes presentateur : la presentation sera moins exploitable en mode diaporama.");
    if (slidesWithVisuals < Math.ceil(slideCount * 0.5)) issues.push("Ajoute plus de formes, tableaux, graphiques ou images natives pour eviter un deck trop textuel.");
    if (heavySlides.length) issues.push(`${heavySlides.length} slide(s) sont trop denses : split ou reduis le texte.`);
    if (emptySlides.length) issues.push(`${emptySlides.length} slide(s) semblent vides ou trop legeres.`);
    if (themeCount > 3 || backgroundCount > 4) issues.push("La direction artistique manque de coherence : applique un template de deck.");
    if (transitionCount > 4) issues.push("Trop de transitions differentes : stabilise l'experience de presentation.");
    if (!hasAgenda && slideCount >= 4) issues.push("Ajoute une slide Agenda pour guider l'audience.");
    if (!hasClosing && slideCount >= 3) issues.push("Ajoute une slide de prochaine action ou decision.");

    const contentScore = clampPresentationNumber(
      35 +
        Math.min(25, slideCount * 4) +
        (slidesWithTitles / Math.max(1, slideCount)) * 20 +
        (slideStats.filter((slide) => slide.wordCount >= 8).length / Math.max(1, slideCount)) * 15 -
        heavySlides.length * 8 -
        emptySlides.length * 12,
      0,
      100,
      55
    );
    const designScore = clampPresentationNumber(
      40 +
        (slidesWithVisuals / Math.max(1, slideCount)) * 25 +
        Math.max(0, 20 - Math.max(0, themeCount - 2) * 8) +
        Math.max(0, 15 - heavySlides.length * 5),
      0,
      100,
      55
    );
    const coherenceScore = clampPresentationNumber(
      35 +
        (hasAgenda ? 15 : 0) +
        (hasClosing ? 15 : 0) +
        Math.max(0, 20 - Math.max(0, transitionCount - 2) * 6) +
        Math.max(0, 15 - repeatedTitleWords),
      0,
      100,
      55
    );
    return {
      total: Math.round((contentScore + designScore + coherenceScore) / 3),
      scores: [
        { label: "Content", value: Math.round(contentScore) },
        { label: "Design", value: Math.round(designScore) },
        { label: "Coherence", value: Math.round(coherenceScore) }
      ],
      issues,
      metrics: [
        `${slideCount} slides`,
        `${slideStats.reduce((total, slide) => total + slide.elements.length, 0)} objets natifs`,
        `${slidesWithNotes}/${slideCount} avec notes`,
        `${slidesWithVisuals}/${slideCount} avec visuels`
      ]
    };
  };

  const buildSpeakerNotesForSlide = (slide = {}, index = 0, total = 1) => {
    const lines = extractPresentationActionLines(slide.body || "");
    const lead = lines[0] || slide.title || "Main point";
    const support = lines.slice(1, 3).join(" / ") || "Use the visible slide objects as proof.";
    const close = index + 1 < total ? "Transition to the next point." : "Close with the concrete next action.";
    return `Lead: ${lead}\nSupport: ${support}\nMove: ${close}`;
  };

  const applyDeckAgentQuickFixes = () => {
    writePresentationDraft((nextDeck) => {
      const total = nextDeck.slides.length || 1;
      nextDeck.slides = nextDeck.slides.map((slide, index) => {
        const elements = getSlideElements(slide).map((element) => {
          if (element.type === "title") {
            return { ...element, text: slide.title || element.text, x: 7, y: index === 0 ? 12 : 10, w: 80, h: 18 };
          }
          if (element.id === "body" || element.type === "text") {
            return {
              ...element,
              x: Number(element.x || 0) < 6 ? 7 : element.x,
              w: Math.min(82, Math.max(42, Number(element.w || 58))),
              h: Math.min(48, Math.max(18, Number(element.h || 24)))
            };
          }
          return element;
        });
        const bodyLines = extractPresentationActionLines(slide.body || "");
        const layout = bodyLines.length >= 3 ? "bullets" : slide.layout || "content";
        return {
          ...slide,
          layout,
          theme: slide.theme || inferPresentationSlideTheme(slide.title, slide.body),
          background: slide.background || presentationDefaultBackground(slide.theme || "default"),
          transition: slide.transition && slide.transition !== "none" ? slide.transition : "fade",
          transitionDuration: slide.transitionDuration || 0.8,
          notes: slide.notes || buildSpeakerNotesForSlide(slide, index, total),
          elements
        };
      });
    }, { refreshWorkspace: true, selectedElementId: selectedElement?.id || "" });
    setStatus("Deck agent: structure, notes et transitions rapides appliques.");
  };

  const addAgendaSlide = () => {
    const agendaItems = deck.slides
      .map((slide) => String(slide.title || "").replace(/^agenda$/i, "").trim())
      .filter(Boolean)
      .slice(1, 7);
    if (!agendaItems.length) {
      setStatus("Agenda non ajoute : il faut au moins deux slides titrees.");
      return;
    }
    const body = agendaItems.map((item, index) => `${index + 1}. ${item}`).join("\n");
    const agendaSlide = {
      title: "Agenda",
      body,
      layout: "bullets",
      theme: "roadmap",
      background: presentationDefaultBackground("roadmap"),
      transition: "fade",
      transitionDuration: 0.8,
      notes: "Set expectations, then move quickly into the first section.",
      elements: createDefaultPresentationElements({
        title: "Agenda",
        body,
        layout: "bullets"
      })
    };
    writePresentationDraft((nextDeck) => {
      const insertAt = Math.min(1, nextDeck.slides.length);
      nextDeck.slides.splice(insertAt, 0, agendaSlide);
      return insertAt;
    }, { refreshWorkspace: true, selectIndex: 1, selectedElementId: "title" });
    setStatus("Slide Agenda ajoutee.");
  };

  const splitSelectedBulletsToSlides = () => {
    const selectedLines = extractPresentationActionLines(selectedElement?.text || "");
    const sourceText = selectedLines.length >= 2 ? selectedElement.text : activeSlide?.body || "";
    const lines = extractPresentationActionLines(sourceText).slice(0, 10);
    if (lines.length < 2) {
      setStatus("Split impossible : selectionne une zone avec au moins deux bullet points.");
      return;
    }
    const newSlides = lines.map((line, index) => {
      const body = `- Key message\n- Proof point\n- Next step`;
      return {
        title: line,
        body,
        layout: "bullets",
        theme: index === lines.length - 1 ? "roadmap" : "insight",
        background: "#ffffff",
        transition: "fade",
        transitionDuration: 0.8,
        notes: `Explain ${line}. Keep it concrete and move to the next slide.`,
        elements: createDefaultPresentationElements({ title: line, body, layout: "bullets" })
      };
    });
    writePresentationDraft((nextDeck) => {
      const insertAt = activeSlideIndex + 1;
      nextDeck.slides.splice(insertAt, 0, ...newSlides);
      return insertAt;
    }, { refreshWorkspace: true, selectIndex: activeSlideIndex + 1, selectedElementId: "title" });
    setStatus(`${newSlides.length} slides creees depuis les bullet points.`);
  };

  const applyDeckTemplate = (templateId = "") => {
    const template = PRESENTATION_DECK_TEMPLATES.find((item) => item.id === templateId) || PRESENTATION_DECK_TEMPLATES[0];
    writePresentationDraft((nextDeck) => {
      nextDeck.slides = nextDeck.slides.map((slide, index) => {
        const elements = getSlideElements(slide).map((element) => {
          const textElement = ["title", "text", "shape"].includes(element.type);
          return {
            ...element,
            fontFamily: textElement ? template.fontFamily : element.fontFamily,
            color: element.type === "title" ? template.titleColor : textElement ? template.bodyColor : element.color,
            stroke: element.type === "shape" && element.stroke === "#cbd5e1" ? template.accent : element.stroke,
            fill:
              element.type === "shape" && (element.fill === "#ffffff" || element.fill === "#eff6ff")
                ? `${template.background}`
                : element.fill
          };
        });
        return {
          ...slide,
          theme: index === 0 ? template.theme : slide.theme || template.theme,
          background: template.background,
          transition: template.transition,
          transitionDuration: template.transition === "none" ? 1 : 0.8,
          elements
        };
      });
    }, { refreshWorkspace: true, selectedElementId: selectedElement?.id || "" });
    setStatus(`Template ${template.label} applique au deck.`);
  };

  const showDeckAudit = () => {
    const audit = buildDeckAudit();
    document.querySelectorAll(".workspace-powerpoint-audit-overlay").forEach((node) => node.remove());
    const overlay = document.createElement("div");
    overlay.className = "workspace-powerpoint-audit-overlay";
    const panel = document.createElement("section");
    panel.className = "workspace-powerpoint-audit-panel";
    const header = document.createElement("header");
    const heading = document.createElement("div");
    const kicker = document.createElement("span");
    kicker.textContent = "Hydria deck agent";
    const title = document.createElement("h3");
    title.textContent = `Score ${audit.total}/100`;
    const copy = document.createElement("p");
    copy.textContent = audit.metrics.join(" | ");
    heading.append(kicker, title, copy);
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "Close";
    close.addEventListener("click", () => overlay.remove());
    header.append(heading, close);

    const scoreGrid = document.createElement("div");
    scoreGrid.className = "workspace-powerpoint-audit-scores";
    audit.scores.forEach((score) => {
      const card = document.createElement("article");
      card.innerHTML = `<strong>${score.value}</strong><span>${score.label}</span><i style="--score:${score.value}%"></i>`;
      scoreGrid.appendChild(card);
    });

    const issueList = document.createElement("div");
    issueList.className = "workspace-powerpoint-audit-issues";
    const issueTitle = document.createElement("strong");
    issueTitle.textContent = audit.issues.length ? "A corriger" : "Aucun blocage majeur";
    issueList.appendChild(issueTitle);
    if (audit.issues.length) {
      const list = document.createElement("ul");
      audit.issues.slice(0, 8).forEach((issue) => {
        const item = document.createElement("li");
        item.textContent = issue;
        list.appendChild(item);
      });
      issueList.appendChild(list);
    } else {
      const empty = document.createElement("p");
      empty.textContent = "Le deck est coherent pour une V1. Tu peux passer a l'export ou a la mise en forme fine.";
      issueList.appendChild(empty);
    }

    const actions = document.createElement("footer");
    [
      ["Quick fixes", applyDeckAgentQuickFixes],
      ["Add agenda", addAgendaSlide],
      ["Split bullets", splitSelectedBulletsToSlides],
      ["Export PPTX", () => downloadPresentationExport().catch(handleError)]
    ].forEach(([label, action]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.addEventListener("click", () => {
        overlay.remove();
        action();
      });
      actions.appendChild(button);
    });

    panel.append(header, scoreGrid, issueList, actions);
    overlay.appendChild(panel);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        overlay.remove();
      }
    });
    document.body.appendChild(overlay);
  };

  const createAgentTemplateGallery = () => {
    const gallery = document.createElement("div");
    gallery.className = "workspace-powerpoint-agent-template-gallery";
    PRESENTATION_DECK_TEMPLATES.forEach((template) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "workspace-powerpoint-agent-template";
      button.title = template.label;
      button.style.setProperty("--template-bg", template.background);
      button.style.setProperty("--template-accent", template.accent);
      button.addEventListener("click", () => applyDeckTemplate(template.id));
      const swatch = document.createElement("i");
      const label = document.createElement("span");
      label.textContent = template.label;
      button.append(swatch, label);
      gallery.appendChild(button);
    });
    return gallery;
  };

  const ribbonTabs = [
    { id: "home", label: "Home" },
    { id: "insert", label: "Insert" },
    { id: "design", label: "Design" },
    { id: "agent", label: "Agent" },
    { id: "transitions", label: "Transitions" },
    { id: "animations", label: "Animations" },
    { id: "slideshow", label: "Diaporama" },
    { id: "review", label: "Review" },
    { id: "view", label: "View" },
    { id: "format", label: "Format" }
  ];
  if (!ribbonTabs.some((tab) => tab.id === state.presentationRibbonTab)) {
    state.presentationRibbonTab = "home";
  }
  const activeRibbonTab = state.presentationRibbonTab || "home";
  const listCommandDisabled = !isPresentationListTextTarget(selectedElement);
  const ribbonGroupsForTab = {
    home: [
      createRibbonGroup("Clipboard", [
        createRibbonStack([
          createRibbonButton("Undo", "undo", undoPresentationChange, {
            disabled: !(state.presentationUndoStack || []).length,
            compact: true
          }),
          createRibbonButton("Redo", "redo", redoPresentationChange, {
            disabled: !(state.presentationRedoStack || []).length,
            compact: true
          })
        ]),
        createRibbonButton("Paste", "paste", pastePresentationClipboard, {
          disabled: !state.presentationClipboard,
          size: "large"
        }),
        createRibbonStack([
          createRibbonButton("Cut", "cut", cutSelectedElement, {
            disabled: !selectedElements.length || activeElements.length <= selectedElements.length || selectedElements.some((element) => element.locked),
            compact: true
          }),
          createRibbonButton("Copy", "copy", copySelectedElement, { disabled: !selectedElements.length, compact: true }),
          createRibbonButton("Duplicate", "duplicate", duplicateSelectedElement, { disabled: !selectedElements.length, compact: true }),
          createRibbonButton("Delete", "delete", removeSelectedElement, {
            disabled: !selectedElements.length || activeElements.length <= selectedElements.length || selectedElements.some((element) => element.locked),
            compact: true
          })
        ])
      ]),
      createRibbonGroup("Slides", [
        createRibbonButton("New slide", "insert", () => executePresentationCommand("slideAdd"), { size: "large" }),
        createRibbonStack([
          createRibbonButton("Duplicate slide", "duplicate", () => executePresentationCommand("slideDuplicate"), { compact: true }),
          createRibbonButton("Delete slide", "delete", () => executePresentationCommand("slideDelete"), {
            disabled: deck.slides.length <= 1,
            compact: true
          }),
          createRibbonButton("Move left", "chevronLeft", () => executePresentationCommand("slideMoveLeft"), {
            disabled: activeSlideIndex <= 0,
            compact: true
          }),
          createRibbonButton("Move right", "chevronRight", () => executePresentationCommand("slideMoveRight"), {
            disabled: activeSlideIndex >= deck.slides.length - 1,
            compact: true
          })
        ])
      ]),
      createRibbonGroup("Font", [
        createRibbonStack([
          createSelect("Font", PRESENTATION_FONT_OPTIONS, selectedElement?.fontFamily || "", (value) =>
            updateSelectedElementStyle({ fontFamily: value })
          ),
          createRibbonField(
            "Size",
            createTextInput(String(selectedElement?.fontSize || 22), (value) =>
              updateSelectedElementStyle({ fontSize: Number(value) })
            , { type: "number", min: "8", max: "96", step: "1" })
          )
        ]),
        createRibbonStack([
          createRibbonButton("B", "bold", () => updateSelectedElementStyle({ bold: !selectedElement?.bold }), {
            disabled: !selectedElement,
            active: Boolean(selectedElement?.bold),
            compact: true
          }),
          createRibbonButton("I", "italic", () => updateSelectedElementStyle({ italic: !selectedElement?.italic }), {
            disabled: !selectedElement,
            active: Boolean(selectedElement?.italic),
            compact: true
          }),
          createRibbonButton("U", "underline", () => updateSelectedElementStyle({ underline: !selectedElement?.underline }), {
            disabled: !selectedElement,
            active: Boolean(selectedElement?.underline),
            compact: true
          }),
          createRibbonButton("Edit text", "text", focusSelectedTextEditor, {
            disabled: !selectedElement || selectedElement.shape === "line",
            compact: true
          })
        ]),
        createRibbonStack([
          createRibbonField(
            "Text",
            createTextInput(selectedElement?.color || "#374151", (value) =>
              updateSelectedElementStyle({ color: value })
            , { type: "color" })
          ),
          createRibbonField(
            "Fill",
            createTextInput(selectedElement?.fill === "transparent" ? "#ffffff" : selectedElement?.fill || "#ffffff", (value) =>
              updateSelectedElementStyle({ fill: value })
            , { type: "color" })
          ),
          createRibbonField(
            "Border",
            createTextInput(selectedElement?.stroke === "transparent" ? "#ffffff" : selectedElement?.stroke || "#cbd5e1", (value) =>
              updateSelectedElementStyle({ stroke: value })
            , { type: "color" })
          )
        ])
      ], { wide: true }),
      createRibbonGroup("Size", [
        createRibbonStack([
          createRibbonField("W", createTextInput(String(Math.round(Number(selectedElement?.w || 0))), (value) =>
            updateSelectedElementStyle({ w: Number(value) })
          , { type: "number", min: "3", max: "100", step: "1" })),
          createRibbonField("H", createTextInput(String(Math.round(Number(selectedElement?.h || 0))), (value) =>
            updateSelectedElementStyle({ h: Number(value) })
          , { type: "number", min: "1", max: "100", step: "1" }))
        ]),
        createRibbonStack([
          createRibbonField("X", createTextInput(String(Math.round(Number(selectedElement?.x || 0))), (value) =>
            updateSelectedElementStyle({ x: Number(value) })
          , { type: "number", min: "0", max: "100", step: "1" })),
          createRibbonField("Y", createTextInput(String(Math.round(Number(selectedElement?.y || 0))), (value) =>
            updateSelectedElementStyle({ y: Number(value) })
          , { type: "number", min: "0", max: "100", step: "1" }))
        ])
      ]),
      createRibbonGroup("Paragraph", [
        createRibbonStack([
          createRibbonButton("Bullets", "list", () => toggleSelectedElementList(false), {
            disabled: listCommandDisabled,
            active: selectedElementHasListStyle(false),
            compact: true
          }),
          createRibbonButton("Numbering", "number", () => toggleSelectedElementList(true), {
            disabled: listCommandDisabled,
            active: selectedElementHasListStyle(true),
            compact: true
          }),
          createRibbonButton("Outdent", "chevronLeft", () => changeSelectedElementListIndent("outdent"), {
            disabled: listCommandDisabled,
            compact: true
          }),
          createRibbonButton("Indent", "chevronRight", () => changeSelectedElementListIndent("indent"), {
            disabled: listCommandDisabled,
            compact: true
          })
        ]),
        createRibbonStack([
          createRibbonButton("Align left", "alignLeft", () => setSelectedTextAlignment("left"), {
            disabled: !selectedTextAlignmentEnabled,
            active: Boolean(selectedElement && selectedElement.align === "left"),
            compact: true
          }),
          createRibbonButton("Align center", "alignCenter", () => setSelectedTextAlignment("center"), {
            disabled: !selectedTextAlignmentEnabled,
            active: Boolean(selectedElement && selectedElement.align === "center"),
            compact: true
          }),
          createRibbonButton("Align right", "alignRight", () => setSelectedTextAlignment("right"), {
            disabled: !selectedTextAlignmentEnabled,
            active: Boolean(selectedElement && selectedElement.align === "right"),
            compact: true
          })
        ])
      ]),
      createRibbonGroup("Arrange", [
        createRibbonStack([
          createRibbonMenuButton("Layer", "chevronRight", [
            { label: "Bring to front", icon: "chevronRight", disabled: !selectedElements.length, action: () => moveSelectedElementDepth(999) },
            { label: "Send to back", icon: "chevronLeft", disabled: !selectedElements.length, action: () => moveSelectedElementDepth(-999) },
            { label: "Bring forward", icon: "chevronRight", disabled: !selectedElements.length, action: () => moveSelectedElementDepth(1) },
            { label: "Send backward", icon: "chevronLeft", disabled: !selectedElements.length, action: () => moveSelectedElementDepth(-1) }
          ], { disabled: !selectedElements.length, compact: true }),
          createRibbonMenuButton("Align", "alignCenter", [
            { label: "Object left", icon: "alignLeft", disabled: !selectedElements.length, action: () => alignSelectedElement("left") },
            { label: "Object center", icon: "alignCenter", disabled: !selectedElements.length, action: () => alignSelectedElement("center") },
            { label: "Object right", icon: "alignRight", disabled: !selectedElements.length, action: () => alignSelectedElement("right") },
            { separator: true },
            { label: "Object top", icon: "alignTop", disabled: !selectedElements.length, action: () => alignSelectedElement("top") },
            { label: "Object middle", icon: "alignMiddle", disabled: !selectedElements.length, action: () => alignSelectedElement("middle") },
            { label: "Object bottom", icon: "alignBottom", disabled: !selectedElements.length, action: () => alignSelectedElement("bottom") },
            { separator: true },
            { label: "Distribute horizontal", icon: "alignCenter", disabled: selectedElements.length < 3, action: () => distributeSelectedElements("horizontal") },
            { label: "Distribute vertical", icon: "alignMiddle", disabled: selectedElements.length < 3, action: () => distributeSelectedElements("vertical") }
          ], { disabled: !selectedElements.length, compact: true })
        ]),
        createRibbonStack([
          createRibbonButton("Select all", "checkbox", selectAllPresentationElements, {
            disabled: !activeElements.length,
            compact: true
          }),
          createRibbonButton("Format painter", "palette", copySelectedFormatting, {
            disabled: !selectedElement,
            active: Boolean(state.presentationFormatBrush),
            compact: true
          }),
          createRibbonMenuButton("Group", "group", [
            { label: "Group", icon: "group", disabled: selectedElements.length < 2, action: groupSelectedElements },
            { label: "Ungroup", icon: "group", disabled: !selectedElements.some((element) => element.groupId), action: ungroupSelectedElements },
            { label: selectedElements.some((element) => element.locked) ? "Unlock" : "Lock", icon: "lock", disabled: !selectedElements.length, action: toggleSelectedLock }
          ], { disabled: !selectedElements.length, compact: true })
        ])
      ])
    ],
    insert: [
      createRibbonGroup("Slides", [
        createRibbonButton("New slide", "insert", () => executePresentationCommand("slideAdd"), { size: "large" }),
        createRibbonStack([
          createRibbonButton("Duplicate slide", "duplicate", () => executePresentationCommand("slideDuplicate"), { compact: true }),
          createRibbonButton("Delete slide", "delete", () => executePresentationCommand("slideDelete"), {
            disabled: deck.slides.length <= 1,
            compact: true
          })
        ])
      ]),
      createRibbonGroup("Text", [
        createRibbonButton("Title", "text", insertTitleBox, { size: "large" }),
        createRibbonStack([
          createRibbonButton("Text box", "textColor", insertTextBox, { compact: true }),
          createRibbonButton("Bullets", "list", insertBulletsBox, { compact: true }),
          createRibbonButton("Equation", "function", insertEquationBox, { compact: true }),
          createRibbonButton("Code", "code", insertCodeBox, { compact: true }),
          createRibbonButton("Speaker notes", "note", () => document.querySelector(".workspace-powerpoint-notes textarea")?.focus(), {
            compact: true
          })
        ])
      ]),
      createRibbonGroup("Media", [
        createRibbonButton("Image", "image", insertImageBox, { size: "large" }),
        createRibbonStack([
          createRibbonButton("Table", "table", insertTableBox, { compact: true }),
          createRibbonButton("Chart", "chart", insertChartBox, { compact: true }),
          createRibbonButton("Icon", "shape", insertIconBox, { compact: true }),
          createRibbonButton("Video", "play", insertVideoBox, { compact: true })
        ])
      ]),
      createRibbonGroup("Shapes", [
        createRibbonButton("Rectangle", "shape", () => insertShapeBox("rectangle"), { size: "large" }),
        createRibbonStack([
          createRibbonButton("Rounded", "shape", () => insertShapeBox("round-rect"), { compact: true }),
          createRibbonButton("Circle", "shape", () => insertShapeBox("ellipse"), { compact: true }),
          createRibbonButton("Line", "lineChart", () => insertShapeBox("line"), { compact: true }),
          createRibbonButton("Triangle", "shape", () => insertShapeBox("triangle"), { compact: true }),
          createRibbonButton("Diamond", "shape", () => insertShapeBox("diamond"), { compact: true }),
          createRibbonButton("Arrow", "chevronRight", () => insertShapeBox("arrow"), { compact: true }),
          createRibbonButton("Callout", "shape", () => insertShapeBox("callout"), { compact: true })
        ])
      ])
    ],
    design: [
      createRibbonGroup("Theme", [
        createRibbonButton("Reset theme", "refresh", () =>
          updateActiveSlide({
            theme: "default",
            background: presentationDefaultBackground("default")
          }, { refreshWorkspace: true })
        , { size: "large" }),
        createRibbonStack([
          createThemeGallery(),
          createSelect("Theme", PRESENTATION_SLIDE_THEMES, activeSlide?.theme || "default", (value) =>
            executePresentationCommand("slideTheme", { value })
          ),
          createSelect("Background", PRESENTATION_SLIDE_BACKGROUNDS, activeSlide?.background || "#ffffff", (value) =>
            updateActiveSlide({ background: value }, { refreshWorkspace: true })
          )
        ])
      ], { wide: true }),
      createRibbonGroup("Layout", [
        createRibbonButton("Title layout", "text", () => executePresentationCommand("slideLayout", { value: "title" }), {
          active: activeSlide?.layout === "title",
          size: "large"
        }),
        createRibbonStack([
          createLayoutGallery(),
          createSelect("Layout", PRESENTATION_SLIDE_LAYOUTS, activeSlide?.layout || "content", (value) =>
            executePresentationCommand("slideLayout", { value })
          ),
          createRibbonButton("Content", "grid", () => executePresentationCommand("slideLayout", { value: "content" }), {
            active: activeSlide?.layout === "content",
            compact: true
          }),
          createRibbonButton("Two columns", "split", () => executePresentationCommand("slideLayout", { value: "two-column" }), {
            active: activeSlide?.layout === "two-column",
            compact: true
          })
        ])
      ], { wide: true })
    ],
    agent: [
      createRibbonGroup("Deck Intelligence", [
        createRibbonButton("Audit deck", "check", showDeckAudit, { size: "large" }),
        createRibbonStack([
          createRibbonButton("Quick fixes", "refresh", applyDeckAgentQuickFixes, { compact: true }),
          createRibbonButton("Speaker notes", "note", () => {
            writePresentationDraft((nextDeck) => {
              const total = nextDeck.slides.length || 1;
              nextDeck.slides = nextDeck.slides.map((slide, index) => ({
                ...slide,
                notes: buildSpeakerNotesForSlide(slide, index, total)
              }));
            }, { refreshWorkspace: true, selectedElementId: selectedElement?.id || "" });
            setStatus("Notes presentateur regenerees pour le deck.");
          }, { compact: true }),
          createRibbonButton("PPTX guard", "check", () => {
            const audit = buildDeckAudit();
            const nativeObjects = deck.slides.reduce((total, slide) => total + getSlideElements(slide).length, 0);
            setStatus(`PPTX natif: ${nativeObjects} objets editables, score ${audit.total}/100.`);
          }, { compact: true })
        ])
      ], { wide: true }),
      createRibbonGroup("Generate", [
        createRibbonButton("Add agenda", "insert", addAgendaSlide, { size: "large" }),
        createRibbonStack([
          createRibbonButton("Split bullets", "split", splitSelectedBulletsToSlides, { compact: true }),
          createRibbonButton("Storyboard", "presentation", () => {
            addAgendaSlide();
            window.setTimeout(() => applyDeckAgentQuickFixes(), 0);
          }, { compact: true }),
          createRibbonButton("Closing slide", "chevronRight", () => {
            const body = "- Decision needed\n- Owner\n- Next step";
            const closingSlide = {
              title: "Next action",
              body,
              layout: "bullets",
              theme: "roadmap",
              background: presentationDefaultBackground("roadmap"),
              transition: "fade",
              transitionDuration: 0.8,
              notes: "Close by naming the concrete next step and owner.",
              elements: createDefaultPresentationElements({ title: "Next action", body, layout: "bullets" })
            };
            writePresentationDraft((nextDeck) => {
              nextDeck.slides.push(closingSlide);
              return nextDeck.slides.length - 1;
            }, { refreshWorkspace: true, selectIndex: deck.slides.length, selectedElementId: "title" });
            setStatus("Slide de conclusion ajoutee.");
          }, { compact: true })
        ])
      ], { wide: true }),
      createRibbonGroup("Templates", [
        createAgentTemplateGallery(),
        createRibbonStack(
          PRESENTATION_DECK_TEMPLATES.slice(0, 3).map((template) =>
            createRibbonButton(template.label, "palette", () => applyDeckTemplate(template.id), { compact: true })
          )
        )
      ], { wide: true }),
      createRibbonGroup("Delivery", [
        createRibbonButton("Presenter view", "presentation", () => openPresentationSlideShow(activeSlideIndex, {
          fullscreen: true,
          presenter: true
        }), { size: "large" }),
        createRibbonStack([
          createRibbonButton("Diaporama", "play", () => openPresentationSlideShow(activeSlideIndex, { fullscreen: true }), { compact: true }),
          createRibbonButton("Export PPTX", "download", () => downloadPresentationExport().catch(handleError), { compact: true })
        ])
      ])
    ],
    transitions: [
      createRibbonGroup("Transition", [
        createRibbonButton("None", "refresh", () => updateActiveSlide({ transition: "none" }, { refreshWorkspace: true }), {
          active: (activeSlide?.transition || "none") === "none",
          size: "large"
        }),
        createRibbonStack(
          PRESENTATION_SLIDE_TRANSITIONS
            .filter((transition) => transition.value !== "none")
            .map((transition) =>
              createRibbonButton(transition.label, "chevronRight", () =>
                updateActiveSlide({ transition: transition.value }, { refreshWorkspace: true })
              , { active: activeSlide?.transition === transition.value, compact: true })
            )
        )
      ]),
      createRibbonGroup("Timing", [
        createSelect(
          "Current",
          PRESENTATION_SLIDE_TRANSITIONS,
          activeSlide?.transition || "none",
          (value) => updateActiveSlide({ transition: value }, { refreshWorkspace: true })
        ),
        createRibbonStack([
          createRibbonField(
            "Duration",
            createTextInput(String(activeSlide?.transitionDuration || 1), (value) =>
              updateActiveSlide({ transitionDuration: Number(value) }, { refreshWorkspace: true })
            , { type: "number", min: "0.1", max: "10", step: "0.1" })
          ),
          createRibbonButton("Apply to all", "duplicate", () => {
            const transition = activeSlide?.transition || "none";
            const transitionDuration = activeSlide?.transitionDuration || 1;
            writePresentationDraft((nextDeck) => {
              nextDeck.slides = nextDeck.slides.map((slide) => ({ ...slide, transition, transitionDuration }));
            }, { refreshWorkspace: true, selectedElementId: selectedElement?.id || "" });
          }, { compact: true })
        ])
      ], { wide: true })
    ],
    animations: [
      createRibbonGroup("Animation", [
        createRibbonButton("None", "refresh", () => updateSelectedElementStyle({ animation: "none" }), {
          disabled: !selectedElements.length,
          active: selectedElement?.animation === "none",
          size: "large"
        }),
        createRibbonStack(
          PRESENTATION_ELEMENT_ANIMATIONS
            .filter((animation) => animation.value !== "none")
            .map((animation) =>
              createRibbonButton(animation.label, "play", () => updateSelectedElementStyle({ animation: animation.value }), {
                disabled: !selectedElements.length,
                active: selectedElement?.animation === animation.value,
                compact: true
              })
            )
        )
      ]),
      createRibbonGroup("Timing", [
        createSelect("Selected", PRESENTATION_ELEMENT_ANIMATIONS, selectedElement?.animation || "none", (value) =>
          updateSelectedElementStyle({ animation: value })
        ),
        createRibbonStack([
          createRibbonButton("Apply to slide", "duplicate", () => {
            const animation = selectedElement?.animation || "fade";
            updateElementsByIds(activeElements.map((element) => element.id), (element) => ({ ...element, animation }), {
              refreshWorkspace: true,
              selectedElementId: selectedElement?.id || selectedElementIds[0],
              selectedElementIds
            });
          }, { disabled: !selectedElement, compact: true })
        ])
      ], { wide: true })
    ],
    slideshow: [
      createRibbonGroup("Start Slide Show", [
        createRibbonButton("Depuis debut", "play", () => openPresentationSlideShow(0, { fullscreen: true }), { size: "large" }),
        createRibbonStack([
          createRibbonButton("Depuis slide", "play", () => openPresentationSlideShow(activeSlideIndex, { fullscreen: true }), { compact: true }),
          createRibbonButton("Vue presentateur", "presentation", () => openPresentationSlideShow(activeSlideIndex, {
            fullscreen: true,
            presenter: true
          }), { compact: true }),
          createRibbonButton("Fenetre", "presentation", () => openPresentationSlideShow(activeSlideIndex), { compact: true })
        ])
      ]),
      createRibbonGroup("Set Up", [
        createRibbonButton("Plein ecran", "maximize", () => openPresentationSlideShow(activeSlideIndex, { fullscreen: true }), { size: "large" }),
        createRibbonStack([
          createRibbonButton("Notes", "note", () => document.querySelector(".workspace-powerpoint-notes textarea")?.focus(), { compact: true }),
          createRibbonButton("Masquer miniatures", "eyeOff", () => {
            state.presentationShowSlideRail = false;
            renderWorkspace();
          }, { disabled: !state.presentationShowSlideRail, compact: true }),
          createRibbonButton("Afficher miniatures", "list", () => {
            state.presentationShowSlideRail = true;
            renderWorkspace();
          }, { disabled: Boolean(state.presentationShowSlideRail), compact: true })
        ])
      ]),
      createRibbonGroup("Navigate", [
        createRibbonButton("Previous", "chevronLeft", () => setActivePresentationSlide(activeSlideIndex - 1), {
          disabled: activeSlideIndex <= 0,
          size: "large"
        }),
        createRibbonStack([
          createRibbonButton("Next", "chevronRight", () => setActivePresentationSlide(activeSlideIndex + 1), {
            disabled: activeSlideIndex >= deck.slides.length - 1,
            compact: true
          }),
          createRibbonButton("First", "chevronLeft", () => setActivePresentationSlide(0), {
            disabled: activeSlideIndex <= 0,
            compact: true
          }),
          createRibbonButton("Last", "chevronRight", () => setActivePresentationSlide(deck.slides.length - 1), {
            disabled: activeSlideIndex >= deck.slides.length - 1,
            compact: true
          })
        ])
      ]),
      createRibbonGroup("Export", [
        createRibbonButton("Export PPTX", "download", () => downloadPresentationExport().catch(handleError), { size: "large" })
      ])
    ],
    review: [
      createRibbonGroup("Notes", [
        createRibbonButton("Speaker notes", "note", () => document.querySelector(".workspace-powerpoint-notes textarea")?.focus(), { size: "large" }),
        createRibbonStack([
          createRibbonButton("Clear notes", "eraser", () => updateActiveSlide({ notes: "" }, { refreshWorkspace: true }), {
            disabled: !activeSlide?.notes,
            compact: true
          }),
          createRibbonButton("Copy slide text", "copy", () => {
            copyElementsToClipboard(activeElements.filter((element) => element.type !== "image"));
          }, { compact: true })
        ])
      ]),
      createRibbonGroup("Check", [
        createRibbonButton("Check deck", "check", () => {
          const emptySlides = deck.slides.filter((slide) => !String(slide.title || "").trim()).length;
          const objects = deck.slides.reduce((total, slide) => total + normalizePresentationElements(slide.elements, {
            title: slide.title,
            body: slide.body,
            layout: slide.layout,
            image: slide.image,
            cta: slide.cta
          }).length, 0);
          setStatus(`${deck.slides.length} slides, ${objects} objets, ${emptySlides} titre manquant.`);
        }, { size: "large" }),
        createRibbonStack([
          createRibbonButton("Select all objects", "checkbox", selectAllPresentationElements, { compact: true }),
          createRibbonButton("Reset selection", "close", () => {
            setPresentationSelection([], "");
            renderWorkspace();
          }, { compact: true })
        ])
      ])
    ],
    view: [
      createRibbonGroup("Zoom", [
        createRibbonButton("Zoom out", "zoom", () => zoomPresentationCanvas(-0.1), {
          disabled: Number(state.presentationZoom || 1) <= 0.5,
          size: "large"
        }),
        createRibbonStack([
          createRibbonButton("100%", "zoom", () => {
            state.presentationZoom = 1;
            renderWorkspace();
          }, { compact: true }),
          createRibbonButton("Zoom in", "zoom", () => zoomPresentationCanvas(0.1), {
            disabled: Number(state.presentationZoom || 1) >= 2,
            compact: true
          })
        ])
      ]),
      createRibbonGroup("Show", [
        createRibbonButton("Grid", "grid", () => {
          state.presentationShowGrid = !state.presentationShowGrid;
          renderWorkspace();
        }, { size: "large", active: Boolean(state.presentationShowGrid) }),
        createRibbonStack([
          createRibbonButton("Miniatures", "list", () => {
            state.presentationShowSlideRail = !state.presentationShowSlideRail;
            renderWorkspace();
          }, { active: Boolean(state.presentationShowSlideRail), compact: true }),
          createRibbonButton("Inspecteur", "sidebar", () => {
            state.presentationShowInspector = !state.presentationShowInspector;
            renderWorkspace();
          }, { active: Boolean(state.presentationShowInspector), compact: true }),
          createRibbonButton("Plein ecran", "maximize", togglePresentationEditorFullscreen, { compact: true }),
          createRibbonButton("Guides", "alignCenter", () => {
            state.presentationShowGuides = !state.presentationShowGuides;
            renderWorkspace();
          }, { active: Boolean(state.presentationShowGuides), compact: true }),
          createRibbonButton("Snap to grid", "grid", () => {
            state.presentationSnapToGrid = !state.presentationSnapToGrid;
            renderWorkspace();
          }, { active: Boolean(state.presentationSnapToGrid), compact: true }),
          createRibbonButton("Object list", "list", () => {
            state.currentStructuredSubItemId = "";
            renderWorkspace();
          }, { compact: true }),
          createRibbonButton("Select first", "shape", () => {
            setPresentationSelection(activeElements[0]?.id ? [activeElements[0].id] : [], activeElements[0]?.id || "");
            renderWorkspace();
          }, { disabled: !activeElements.length, compact: true }),
          createRibbonButton("Edit text", "text", focusSelectedTextEditor, {
            disabled: !selectedElement || selectedElement.shape === "line",
            compact: true
          })
        ])
      ])
    ]
    ,
    format: [
      createRibbonGroup("Object", [
        createRibbonButton("Format painter", "palette", copySelectedFormatting, {
          disabled: !selectedElement,
          active: Boolean(state.presentationFormatBrush),
          size: "large"
        }),
        createRibbonStack([
          createRibbonButton(selectedElements.some((element) => element.locked) ? "Unlock" : "Lock", "lock", toggleSelectedLock, {
            disabled: !selectedElements.length,
            compact: true
          }),
          createRibbonButton("Group", "group", groupSelectedElements, {
            disabled: selectedElements.length < 2,
            compact: true
          }),
          createRibbonButton("Ungroup", "group", ungroupSelectedElements, {
            disabled: !selectedElements.some((element) => element.groupId),
            compact: true
          })
        ])
      ]),
      createRibbonGroup("Size", [
        createRibbonStack([
          createRibbonField("X", createTextInput(String(Math.round(Number(selectedElement?.x || 0))), (value) =>
            updateSelectedElementStyle({ x: Number(value) })
          , { type: "number", min: "0", max: "100", step: "1" })),
          createRibbonField("Y", createTextInput(String(Math.round(Number(selectedElement?.y || 0))), (value) =>
            updateSelectedElementStyle({ y: Number(value) })
          , { type: "number", min: "0", max: "100", step: "1" }))
        ]),
        createRibbonStack([
          createRibbonField("W", createTextInput(String(Math.round(Number(selectedElement?.w || 0))), (value) =>
            updateSelectedElementStyle({ w: Number(value) })
          , { type: "number", min: "3", max: "100", step: "1" })),
          createRibbonField("H", createTextInput(String(Math.round(Number(selectedElement?.h || 0))), (value) =>
            updateSelectedElementStyle({ h: Number(value) })
          , { type: "number", min: "1", max: "100", step: "1" }))
        ])
      ], { wide: true }),
      createRibbonGroup("Style", [
        createRibbonStack([
          createRibbonField("Fill", createTextInput(selectedElement?.fill === "transparent" ? "#ffffff" : selectedElement?.fill || "#ffffff", (value) =>
            updateSelectedElementStyle({ fill: value })
          , { type: "color" })),
          createRibbonField("Line", createTextInput(selectedElement?.stroke === "transparent" ? "#ffffff" : selectedElement?.stroke || "#cbd5e1", (value) =>
            updateSelectedElementStyle({ stroke: value })
          , { type: "color" })),
          createRibbonField("Weight", createTextInput(String(selectedElement?.strokeWidth ?? 1), (value) =>
            updateSelectedElementStyle({ strokeWidth: Number(value) })
          , { type: "number", min: "0", max: "8", step: "1" }))
        ]),
        createRibbonStack([
          createRibbonField("Opacity", createTextInput(String(selectedElement?.opacity || 1), (value) =>
            updateSelectedElementStyle({ opacity: Number(value) })
          , { type: "number", min: "0.1", max: "1", step: "0.1" })),
          createRibbonField("Rotate", createTextInput(String(Math.round(Number(selectedElement?.rotation || 0))), (value) =>
            updateSelectedElementStyle({ rotation: Number(value) })
          , { type: "number", min: "-180", max: "180", step: "1" }))
        ])
      ], { wide: true }),
      createRibbonGroup("Arrange", [
        createRibbonButton("Front", "chevronRight", () => moveSelectedElementDepth(999), {
          disabled: !selectedElements.length,
          size: "large"
        }),
        createRibbonStack([
          createRibbonButton("Object left", "alignLeft", () => alignSelectedElement("left"), { disabled: !selectedElements.length, compact: true }),
          createRibbonButton("Object center", "alignCenter", () => alignSelectedElement("center"), { disabled: !selectedElements.length, compact: true }),
          createRibbonButton("Object right", "alignRight", () => alignSelectedElement("right"), { disabled: !selectedElements.length, compact: true }),
          createRibbonButton("Forward", "chevronRight", () => moveSelectedElementDepth(1), { disabled: !selectedElements.length, compact: true }),
          createRibbonButton("Backward", "chevronLeft", () => moveSelectedElementDepth(-1), { disabled: !selectedElements.length, compact: true }),
          createRibbonButton("Back", "chevronLeft", () => moveSelectedElementDepth(-999), { disabled: !selectedElements.length, compact: true })
        ])
      ]),
      createRibbonGroup("Type", [
        selectedElement?.type === "chart"
          ? createSelect(
              "Chart",
              PRESENTATION_CHART_TYPES.map((chartType) => ({ value: chartType, label: chartType })),
              selectedElement.chartType || "bar",
              (value) => updateSelectedElementStyle({ chartType: value })
            )
          : null,
        selectedShapeEditEnabled
          ? createSelect(
              "Shape",
              PRESENTATION_SHAPE_TYPES.map((shape) => ({ value: shape, label: shape })),
              selectedElement.shape || "rectangle",
              (value) => setSelectedShapeType(value)
            )
          : null,
        createRibbonStack([
          createRibbonButton("Flip H", "transpose", () => updateSelectedElementStyle({ flipX: !selectedElement?.flipX }), {
            disabled: !selectedElement,
            compact: true
          }),
          createRibbonButton("Flip V", "transpose", () => updateSelectedElementStyle({ flipY: !selectedElement?.flipY }), {
            disabled: !selectedElement,
            compact: true
          })
        ])
      ], { wide: true })
    ]
  };

  const createPresentationContextStrip = () => {
    const strip = document.createElement("div");
    strip.className = "workspace-powerpoint-context-strip";
    const scope = document.createElement("strong");
    scope.className = "workspace-powerpoint-context-scope";
    scope.textContent = hasMultiSelection
      ? `${selectedElements.length} objects`
      : selectedElement
        ? `${selectedElement.type}${selectedElement.type === "shape" ? ` / ${selectedElement.shape}` : ""}`
        : "Slide";
    strip.appendChild(scope);

    if (hasMultiSelection) {
      strip.append(
        createRibbonButton("Group", "group", groupSelectedElements, { disabled: selectedElements.length < 2, compact: true }),
        createRibbonButton("Ungroup", "group", ungroupSelectedElements, {
          disabled: !selectedElements.some((element) => element.groupId),
          compact: true
        }),
        createRibbonButton(selectedElements.some((element) => element.locked) ? "Unlock" : "Lock", "lock", toggleSelectedLock, {
          compact: true
        }),
        createRibbonButton("Align left", "alignLeft", () => alignSelectedElement("left"), { compact: true }),
        createRibbonButton("Align center", "alignCenter", () => alignSelectedElement("center"), { compact: true }),
        createRibbonButton("Align top", "alignTop", () => alignSelectedElement("top"), { compact: true }),
        createRibbonButton("Distribute H", "alignCenter", () => distributeSelectedElements("horizontal"), {
          disabled: selectedElements.length < 3,
          compact: true
        }),
        createRibbonButton("Distribute V", "alignMiddle", () => distributeSelectedElements("vertical"), {
          disabled: selectedElements.length < 3,
          compact: true
        }),
        createRibbonField("Fill", createTextInput(selectedElement?.fill === "transparent" ? "#ffffff" : selectedElement?.fill || "#ffffff", (value) =>
          updateSelectedElementStyle({ fill: value })
        , { type: "color" })),
        createRibbonField("Line", createTextInput(selectedElement?.stroke === "transparent" ? "#ffffff" : selectedElement?.stroke || "#cbd5e1", (value) =>
          updateSelectedElementStyle({ stroke: value })
        , { type: "color" })),
        createRibbonButton("Delete", "delete", removeSelectedElement, {
          disabled: activeElements.length <= selectedElements.length || selectedElements.some((element) => element.locked),
          compact: true
        })
      );
      return strip;
    }

    if (!selectedElement) {
      strip.append(
        createRibbonField("Title", createTextInput(activeSlide?.title || "", (value) =>
          updateActiveSlide({ title: value }, { refreshWorkspace: false, selectedElementId: "" })
        )),
        createSelect("Layout", PRESENTATION_SLIDE_LAYOUTS, activeSlide?.layout || "content", (value) =>
          executePresentationCommand("slideLayout", { value })
        ),
        createSelect("Theme", PRESENTATION_SLIDE_THEMES, activeSlide?.theme || "default", (value) =>
          executePresentationCommand("slideTheme", { value })
        ),
        createRibbonField("Background", createTextInput(activeSlide?.background || "#ffffff", (value) =>
          updateActiveSlide({ background: value }, { refreshWorkspace: true, selectedElementId: "" })
        , { type: "color" })),
        createSelect("Transition", PRESENTATION_SLIDE_TRANSITIONS, activeSlide?.transition || "none", (value) =>
          updateActiveSlide({ transition: value }, { refreshWorkspace: true })
        ),
        createRibbonField("Duration", createTextInput(String(activeSlide?.transitionDuration || 1), (value) =>
          updateActiveSlide({ transitionDuration: Number(value) }, { refreshWorkspace: true })
        , { type: "number", min: "0.1", max: "10", step: "0.1" })),
        createRibbonButton("Diaporama", "play", () => openPresentationSlideShow(activeSlideIndex, { fullscreen: true }), { compact: true }),
        createRibbonButton("Miniatures", "list", () => {
          state.presentationShowSlideRail = !state.presentationShowSlideRail;
          renderWorkspace();
        }, { active: Boolean(state.presentationShowSlideRail), compact: true })
      );
      return strip;
    }

    [
      createRibbonField("Text", createTextInput(selectedElement.text || "", (value) =>
        updateElement(selectedElement.id, { text: value }, { refreshWorkspace: false })
      )),
      createRibbonButton("Bullets", "list", () => toggleSelectedElementList(false), {
        disabled: listCommandDisabled,
        active: selectedElementHasListStyle(false),
        compact: true
      }),
      createRibbonButton("Numbering", "number", () => toggleSelectedElementList(true), {
        disabled: listCommandDisabled,
        active: selectedElementHasListStyle(true),
        compact: true
      }),
      createRibbonButton("Outdent", "chevronLeft", () => changeSelectedElementListIndent("outdent"), {
        disabled: listCommandDisabled,
        compact: true
      }),
      createRibbonButton("Indent", "chevronRight", () => changeSelectedElementListIndent("indent"), {
        disabled: listCommandDisabled,
        compact: true
      }),
      createRibbonField("X", createTextInput(String(Math.round(Number(selectedElement.x || 0))), (value) =>
        updateElement(selectedElement.id, { x: Number(value) }, { refreshWorkspace: true })
      , { type: "number", min: "0", max: "100", step: "1" })),
      createRibbonField("Y", createTextInput(String(Math.round(Number(selectedElement.y || 0))), (value) =>
        updateElement(selectedElement.id, { y: Number(value) }, { refreshWorkspace: true })
      , { type: "number", min: "0", max: "100", step: "1" })),
      createRibbonField("W", createTextInput(String(Math.round(Number(selectedElement.w || 0))), (value) =>
        updateElement(selectedElement.id, { w: Number(value) }, { refreshWorkspace: true })
      , { type: "number", min: "3", max: "100", step: "1" })),
      createRibbonField("H", createTextInput(String(Math.round(Number(selectedElement.h || 0))), (value) =>
        updateElement(selectedElement.id, { h: Number(value) }, { refreshWorkspace: true })
      , { type: "number", min: "1", max: "100", step: "1" })),
      createSelect("Font", PRESENTATION_FONT_OPTIONS, selectedElement.fontFamily || "", (value) =>
        updateElement(selectedElement.id, { fontFamily: value }, { refreshWorkspace: true })
      ),
      createRibbonField("Size", createTextInput(String(selectedElement.fontSize || 20), (value) =>
        updateElement(selectedElement.id, { fontSize: Number(value) }, { refreshWorkspace: true })
      , { type: "number", min: "8", max: "96", step: "1" })),
      createRibbonField("Text", createTextInput(selectedElement.color || "#374151", (value) =>
        updateElement(selectedElement.id, { color: value }, { refreshWorkspace: true })
      , { type: "color" })),
      createRibbonField("Fill", createTextInput(selectedElement.fill === "transparent" ? "#ffffff" : selectedElement.fill || "#ffffff", (value) =>
        updateElement(selectedElement.id, { fill: value }, { refreshWorkspace: true })
      , { type: "color" })),
      createRibbonField("Line", createTextInput(selectedElement.stroke === "transparent" ? "#ffffff" : selectedElement.stroke || "#cbd5e1", (value) =>
        updateElement(selectedElement.id, { stroke: value }, { refreshWorkspace: true })
      , { type: "color" })),
      createRibbonField("Weight", createTextInput(String(selectedElement.strokeWidth ?? 1), (value) =>
        updateElement(selectedElement.id, { strokeWidth: Number(value) }, { refreshWorkspace: true })
      , { type: "number", min: "0", max: "8", step: "1" })),
      createRibbonField("Rotate", createTextInput(String(Math.round(Number(selectedElement.rotation || 0))), (value) =>
        updateElement(selectedElement.id, { rotation: Number(value) }, { refreshWorkspace: true })
      , { type: "number", min: "-180", max: "180", step: "1" })),
      createRibbonField("Opacity", createTextInput(String(selectedElement.opacity || 1), (value) =>
        updateElement(selectedElement.id, { opacity: Number(value) }, { refreshWorkspace: true })
      , { type: "number", min: "0.1", max: "1", step: "0.1" })),
      createSelect("Anim", PRESENTATION_ELEMENT_ANIMATIONS, selectedElement.animation || "none", (value) =>
        updateElement(selectedElement.id, { animation: value }, { refreshWorkspace: true })
      ),
      selectedElement.type === "shape"
        ? createSelect("Shape", PRESENTATION_SHAPE_TYPES.map((shape) => ({ value: shape, label: shape })), selectedElement.shape || "rectangle", (value) =>
            updateElement(selectedElement.id, { shape: value }, { refreshWorkspace: true })
          )
        : null,
      selectedElement.type === "chart"
        ? createSelect("Chart", PRESENTATION_CHART_TYPES.map((chartType) => ({ value: chartType, label: chartType })), selectedElement.chartType || "bar", (value) =>
            updateElement(selectedElement.id, { chartType: value }, { refreshWorkspace: true })
          )
        : null,
      createRibbonButton(selectedElement.locked ? "Unlock" : "Lock", "lock", () =>
        updateElement(selectedElement.id, { locked: !selectedElement.locked }, { refreshWorkspace: true })
      , { compact: true }),
      createRibbonButton("Duplicate", "duplicate", duplicateSelectedElement, { compact: true }),
      createRibbonButton("Delete", "delete", removeSelectedElement, {
        disabled: activeElements.length <= 1 || selectedElement.locked,
        compact: true
      })
    ].filter(Boolean).forEach((child) => strip.appendChild(child));
    return strip;
  };

  const ribbon = document.createElement("div");
  ribbon.className = "workspace-powerpoint-ribbon";
  const tabs = document.createElement("div");
  tabs.className = "workspace-powerpoint-tabs";
  ribbonTabs.forEach((item) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = `workspace-powerpoint-tab${item.id === activeRibbonTab ? " active" : ""}`;
    tab.textContent = item.label;
    tab.addEventListener("click", () => {
      state.presentationRibbonTab = item.id;
      renderWorkspace();
    });
    tabs.appendChild(tab);
  });
  const ribbonBody = document.createElement("div");
  ribbonBody.className = "workspace-powerpoint-ribbon-body";
  ribbonBody.append(...(ribbonGroupsForTab[activeRibbonTab] || ribbonGroupsForTab.home));
  ribbon.append(tabs, ribbonBody);

  const editor = document.createElement("div");
  editor.className = [
    "workspace-powerpoint-editor",
    state.presentationShowSlideRail ? "" : "is-slide-rail-hidden",
    state.presentationShowInspector ? "" : "is-inspector-hidden"
  ].filter(Boolean).join(" ");

  const slideRail = document.createElement("aside");
  slideRail.className = "workspace-powerpoint-slide-rail";
  deck.slides.forEach((slide, index) => {
    const thumb = document.createElement("button");
    thumb.type = "button";
    thumb.className = `workspace-powerpoint-thumb${index === activeSlideIndex ? " active" : ""}`;
    thumb.addEventListener("click", () => {
      state.currentSectionId = slideSections[index]?.id || "";
      state.currentBlockId = "";
      state.currentStructuredSubItemId = "";
      state.presentationSelectedElementIds = [];
      state.presentationSelectionCleared = true;
      renderWorkspace();
    });
    const number = document.createElement("span");
    number.className = "workspace-powerpoint-thumb-number";
    number.textContent = String(index + 1);
    const miniature = document.createElement("span");
    miniature.className = "workspace-powerpoint-thumb-canvas";
    miniature.style.background = slide.background || presentationDefaultBackground(slide.theme || "default");
    const thumbElements = normalizePresentationElements(slide.elements, {
      title: slide.title,
      body: stripPresentationInternalMeta(slide.body || ""),
      layout: slide.layout,
      image: slide.image,
      cta: slide.cta
    }).sort((left, right) => Number(left.z || 0) - Number(right.z || 0));
    thumbElements.slice(0, 10).forEach((element) => {
      const previewElement = document.createElement("span");
      previewElement.className = [
        "workspace-powerpoint-thumb-element",
        `type-${element.type}`,
        `shape-${element.shape || "rectangle"}`
      ].join(" ");
      previewElement.style.left = `${element.x}%`;
      previewElement.style.top = `${element.y}%`;
      previewElement.style.width = `${element.w}%`;
      previewElement.style.height = `${element.h}%`;
      previewElement.style.zIndex = String(element.z || 0);
      previewElement.style.color = element.color;
      previewElement.style.background = element.type === "image" && !element.src ? "#f8fafc" : element.fill;
      previewElement.style.borderColor = element.stroke;
      previewElement.style.transform = `rotate(${element.rotation || 0}deg)`;
      previewElement.textContent =
        element.shape === "line"
          ? ""
          : element.type === "image"
            ? ""
            : String(element.text || "").replace(/\s+/g, " ").slice(0, 26);
      miniature.appendChild(previewElement);
    });
    const thumbMeta = document.createElement("small");
    thumbMeta.className = "workspace-powerpoint-thumb-meta";
    thumbMeta.textContent = `${slide.layout || "content"} | ${slide.transition || "none"}`;
    miniature.appendChild(thumbMeta);
    thumb.append(number, miniature);
    slideRail.appendChild(thumb);
  });

  const stage = document.createElement("main");
  stage.className = "workspace-powerpoint-stage";
  const stageToolbar = document.createElement("div");
  stageToolbar.className = "workspace-powerpoint-stage-toolbar";
  const stageLabel = document.createElement("div");
  stageLabel.className = "workspace-powerpoint-stage-label";
  const stageTitle = document.createElement("strong");
  stageTitle.textContent = activeSlide?.title || "Slide";
  const stageMeta = document.createElement("span");
  stageMeta.textContent = `Slide ${activeSlideIndex + 1} of ${deck.slides.length} | 16:9 | ${activeElements.length} objects`;
  stageLabel.append(stageTitle, stageMeta);
  const stageView = document.createElement("div");
  stageView.className = "workspace-powerpoint-view-controls";
  [
    ["Guides", "presentationShowGuides"],
    ["Grid", "presentationShowGrid"],
    ["Snap", "presentationSnapToGrid"]
  ].forEach(([label, key]) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `workspace-powerpoint-view-chip${state[key] ? " active" : ""}`;
    chip.textContent = label;
    chip.addEventListener("click", () => {
      state[key] = !state[key];
      renderWorkspace();
    });
    stageView.appendChild(chip);
  });
  const createZoomChip = (label, action, disabled = false) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    btn.className = "workspace-powerpoint-view-chip workspace-powerpoint-zoom-btn";
    btn.disabled = disabled;
    if (!disabled) {
      btn.addEventListener("click", action);
    }
    return btn;
  };
  const zoomOutButton = createZoomChip("−", () => zoomPresentationCanvas(-0.1), Number(state.presentationZoom || 1) <= 0.5);
  const zoomValue = document.createElement("button");
  zoomValue.type = "button";
  zoomValue.className = "workspace-powerpoint-view-chip active workspace-powerpoint-zoom-value";
  zoomValue.textContent = `${Math.round(Number(state.presentationZoom || 1) * 100)}%`;
  zoomValue.title = "Reset zoom to 100%";
  zoomValue.addEventListener("click", () => { state.presentationZoom = 1; renderWorkspace(); });
  const zoomInButton = createZoomChip("+", () => zoomPresentationCanvas(0.1), Number(state.presentationZoom || 1) >= 2);
  stageView.append(zoomOutButton, zoomValue, zoomInButton);
  stageToolbar.append(stageLabel, stageView);

  const slideWrap = document.createElement("div");
  slideWrap.className = `workspace-powerpoint-canvas-wrap${state.presentationShowGrid ? "" : " hide-grid"}`;
  const canvas = document.createElement("section");
  canvas.className = [
    "workspace-powerpoint-slide",
    `theme-${activeSlide?.theme || "default"}`,
    state.presentationShowGuides ? "show-guides" : ""
  ].filter(Boolean).join(" ");
  canvas.style.background = activeSlide?.background || presentationDefaultBackground(activeSlide?.theme || "default");
  canvas.style.transform = `scale(${Number(state.presentationZoom || 1)})`;
  canvas.setAttribute("aria-label", activeSlide?.title || "Slide canvas");

  const snapPresentationValue = (value, step = 1) => {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return value;
    }
    if (!state.presentationSnapToGrid) {
      return number;
    }
    return Math.round(number / step) * step;
  };

  const clampElementBox = (box = {}, source = {}) => {
    const minW = source.shape === "line" ? 3 : 4;
    const minH = source.shape === "line" ? 1 : 4;
    const w = clampPresentationNumber(snapPresentationValue(box.w), minW, 100, source.w || 10);
    const h = clampPresentationNumber(snapPresentationValue(box.h), minH, 100, source.h || 8);
    return {
      x: clampPresentationNumber(snapPresentationValue(box.x), 0, 100 - w, source.x || 0),
      y: clampPresentationNumber(snapPresentationValue(box.y), 0, 100 - h, source.y || 0),
      w,
      h
    };
  };

  const applyElementBoxStyles = (node, box = {}) => {
    node.style.left = `${box.x}%`;
    node.style.top = `${box.y}%`;
    node.style.width = `${box.w}%`;
    node.style.height = `${box.h}%`;
  };

  const startElementPointerInteraction = (event, element, node) => {
    if (event.button !== 0) {
      return;
    }
    if (node.dataset.editing === "true") {
      return;
    }
    const rotateNode = event.target?.closest?.(".workspace-powerpoint-rotate-handle");
    const handleNode = event.target?.closest?.(".workspace-powerpoint-resize-handle");
    if ((event.shiftKey || event.ctrlKey || event.metaKey) && !rotateNode && !handleNode) {
      event.preventDefault();
      event.stopPropagation();
      const nextIds = selectedElementSet.has(element.id)
        ? selectedElementIds.filter((id) => id !== element.id)
        : [...selectedElementIds, element.id];
      setPresentationSelection(nextIds.length ? nextIds : [element.id], element.id);
      node.dataset.selectionHandled = "true";
      window.setTimeout(() => {
        delete node.dataset.selectionHandled;
      }, 0);
      renderWorkspace();
      return;
    }
    if (
      !rotateNode &&
      !handleNode &&
      state.currentStructuredSubItemId === element.id &&
      event.target?.closest?.(".workspace-powerpoint-element-text")
    ) {
      return;
    }
    const handle = handleNode
      ? ["nw", "ne", "sw", "se"].find((name) => handleNode.classList.contains(name)) || "se"
      : "";
    event.preventDefault();
    event.stopPropagation();
    const pointerTarget = handleNode || rotateNode || node;
    try {
      pointerTarget?.setPointerCapture?.(event.pointerId);
    } catch {
      // Pointer capture can fail if the browser has already released the pointer.
    }
    if (!selectedElementSet.has(element.id)) {
      selectPresentationElementOrGroup(element);
    } else {
      state.currentStructuredSubItemId = element.id;
    }
    node.focus({ preventScroll: true });
    if (element.locked && !rotateNode && !handleNode) {
      renderWorkspace();
      return;
    }
    if (element.locked && (rotateNode || handleNode)) {
      renderWorkspace();
      return;
    }

    const canvasRect = canvas.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();
    const center = {
      x: nodeRect.left + nodeRect.width / 2,
      y: nodeRect.top + nodeRect.height / 2
    };
    const groupMoveElements = !rotateNode && !handle && selectedElementSet.has(element.id) && selectedElements.length > 1
      ? selectedElements
      : [element];
    const groupStartBoxes = new Map(groupMoveElements.map((item) => [
      item.id,
      {
        x: Number(item.x || 0),
        y: Number(item.y || 0),
        w: Number(item.w || 10),
        h: Number(item.h || 10)
      }
    ]));
    const start = {
      x: Number(element.x || 0),
      y: Number(element.y || 0),
      w: Number(element.w || 10),
      h: Number(element.h || 10),
      rotation: Number(element.rotation || 0),
      pointerX: event.clientX,
      pointerY: event.clientY
    };
    let latestBox = clampElementBox(start, element);
    let latestGroupBoxes = new Map(groupStartBoxes);
    let latestRotation = start.rotation;
    node.classList.add(rotateNode ? "is-rotating" : handle ? "is-resizing" : "is-dragging");

    const onPointerMove = (moveEvent) => {
      moveEvent.preventDefault();
      moveEvent.stopPropagation();
      if (rotateNode) {
        const angle = Math.atan2(moveEvent.clientY - center.y, moveEvent.clientX - center.x) * (180 / Math.PI) + 90;
        latestRotation = Math.round(angle);
        node.style.transform = `rotate(${latestRotation}deg) scale(${element.flipX ? -1 : 1}, ${element.flipY ? -1 : 1})`;
        return;
      }
      const dx = ((moveEvent.clientX - start.pointerX) / Math.max(1, canvasRect.width)) * 100;
      const dy = ((moveEvent.clientY - start.pointerY) / Math.max(1, canvasRect.height)) * 100;
      let next = { x: start.x, y: start.y, w: start.w, h: start.h };
      if (!handle) {
        next = {
          ...next,
          x: start.x + dx,
          y: start.y + dy
        };
        if (groupMoveElements.length > 1) {
          latestGroupBoxes = new Map();
          groupMoveElements.forEach((groupElement) => {
            const groupStart = groupStartBoxes.get(groupElement.id);
            const groupBox = clampElementBox({
              ...groupStart,
              x: Number(groupStart?.x || 0) + dx,
              y: Number(groupStart?.y || 0) + dy
            }, groupElement);
            latestGroupBoxes.set(groupElement.id, groupBox);
            const groupNode = canvas.querySelector(`[data-element-id="${CSS.escape(groupElement.id)}"]`);
            if (groupNode) {
              applyElementBoxStyles(groupNode, groupBox);
            }
          });
          return;
        }
      } else {
        const minW = element.shape === "line" ? 3 : 4;
        const minH = element.shape === "line" ? 1 : 4;
        if (handle.includes("e")) {
          next.w = Math.max(minW, start.w + dx);
        }
        if (handle.includes("s")) {
          next.h = Math.max(minH, start.h + dy);
        }
        if (handle.includes("w")) {
          const maxX = start.x + start.w - minW;
          next.x = Math.max(0, Math.min(maxX, start.x + dx));
          next.w = start.w + start.x - next.x;
        }
        if (handle.includes("n")) {
          const maxY = start.y + start.h - minH;
          next.y = Math.max(0, Math.min(maxY, start.y + dy));
          next.h = start.h + start.y - next.y;
        }
      }
      latestBox = clampElementBox(next, element);
      applyElementBoxStyles(node, latestBox);
    };

    const onPointerUp = (upEvent) => {
      upEvent?.preventDefault?.();
      upEvent?.stopPropagation?.();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      try {
        pointerTarget?.releasePointerCapture?.(event.pointerId);
      } catch {
        // No-op: the pointer may already be released after a cancelled interaction.
      }
      node.classList.remove("is-dragging", "is-resizing", "is-rotating");
      if (groupMoveElements.length > 1 && !rotateNode && !handle) {
        updateElementsByIds(
          groupMoveElements.map((item) => item.id),
          (item) => ({ ...item, ...(latestGroupBoxes.get(item.id) || {}) }),
          {
            refreshWorkspace: true,
            selectedElementId: element.id,
            selectedElementIds: groupMoveElements.map((item) => item.id)
          }
        );
        return;
      }
      updateElement(element.id, rotateNode ? { rotation: latestRotation } : latestBox, {
        refreshWorkspace: true,
        selectedElementIds: [element.id]
      });
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp, { once: true });
  };

  const canvasPointToPercent = (event) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: clampPresentationNumber(((event.clientX - rect.left) / Math.max(1, rect.width)) * 100, 0, 100, 10),
      y: clampPresentationNumber(((event.clientY - rect.top) / Math.max(1, rect.height)) * 100, 0, 100, 10)
    };
  };

  const insertElementAtPoint = (point = {}, partial = {}) => {
    const width = Number(partial.w || 32);
    const height = Number(partial.h || 16);
    insertElement({
      ...partial,
      x: clampPresentationNumber(point.x, 0, 100 - width, partial.x || 10),
      y: clampPresentationNumber(point.y, 0, 100 - height, partial.y || 10)
    });
  };

  const createCanvasInsertItems = (point = {}) => [
    {
      label: "Text box",
      icon: "textColor",
      action: () => insertElementAtPoint(point, {
        type: "text",
        text: "New text box",
        w: 36,
        h: 14,
        fontSize: 22,
        fill: "transparent",
        stroke: "transparent"
      })
    },
    {
      label: "Title",
      icon: "text",
      action: () => insertElementAtPoint(point, {
        type: "title",
        text: "New title",
        w: 58,
        h: 14,
        fontSize: 36,
        bold: true,
        fill: "transparent",
        stroke: "transparent"
      })
    },
    {
      label: "Rectangle",
      icon: "shape",
      action: () => insertElementAtPoint(point, {
        type: "shape",
        shape: "rectangle",
        text: "Shape",
        w: 28,
        h: 18,
        fill: "#eff6ff",
        stroke: "#93c5fd",
        align: "center"
      })
    },
    {
      label: "Circle",
      icon: "shape",
      action: () => insertElementAtPoint(point, {
        type: "shape",
        shape: "ellipse",
        text: "",
        w: 18,
        h: 18,
        fill: "#f0fdf4",
        stroke: "#86efac"
      })
    },
    {
      label: "Image",
      icon: "image",
      action: () => insertElementAtPoint(point, {
        type: "image",
        text: "Image",
        src: "",
        w: 34,
        h: 36,
        fill: "#f8fafc",
        stroke: "#cbd5e1"
      })
    },
    {
      label: "Table",
      icon: "table",
      action: () => insertElementAtPoint(point, {
        type: "table",
        text: "Metric | Value\nPipeline | 42\nForecast | 18k",
        w: 42,
        h: 24,
        fontSize: 13,
        fill: "#ffffff",
        stroke: "#cbd5e1"
      })
    },
    {
      label: "Chart",
      icon: "chart",
      action: () => insertElementAtPoint(point, {
        type: "chart",
        chartType: "bar",
        text: "North | 42\nSouth | 28\nWest | 18",
        w: 34,
        h: 28,
        fill: "#f0fdf4",
        stroke: "#86efac"
      })
    },
    {
      label: "Equation",
      icon: "function",
      action: () => insertElementAtPoint(point, {
        type: "equation",
        text: "f(x) = ax + b",
        w: 34,
        h: 12,
        fontSize: 24,
        fontFamily: "Georgia, serif",
        fill: "transparent",
        stroke: "transparent"
      })
    }
  ];

  const renderTableElement = (element, node) => {
    const tableData = parsePresentationTableText(element.text || "");
    const table = document.createElement("table");
    table.className = "workspace-powerpoint-table";
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    tableData.headers.forEach((header) => {
      const cell = document.createElement("th");
      cell.textContent = header;
      headerRow.appendChild(cell);
    });
    thead.appendChild(headerRow);
    const tbody = document.createElement("tbody");
    tableData.rows.forEach((row) => {
      const tr = document.createElement("tr");
      row.forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        tr.appendChild(cell);
      });
      tbody.appendChild(tr);
    });
    table.append(thead, tbody);
    node.appendChild(table);
  };

  const renderChartElement = (element, node) => {
    const data = parsePresentationChartText(element.text || "");
    const maxValue = Math.max(1, ...data.map((item) => Math.abs(Number(item.value || 0))));
    const chart = document.createElement("div");
    chart.className = `workspace-powerpoint-chart chart-${element.chartType || "bar"}`;
    data.slice(0, 8).forEach((item, index) => {
      const bar = document.createElement("span");
      bar.className = "workspace-powerpoint-chart-bar";
      bar.style.setProperty("--value", `${Math.max(4, Math.abs(item.value) / maxValue * 100)}%`);
      bar.style.setProperty("--bar-index", String(index));
      const label = document.createElement("em");
      label.textContent = item.label;
      const value = document.createElement("strong");
      value.textContent = String(item.value);
      bar.append(label, value);
      chart.appendChild(bar);
    });
    node.appendChild(chart);
  };

  const renderIconElement = (element, node) => {
    const icon = document.createElement("span");
    icon.className = "workspace-powerpoint-icon-object";
    icon.textContent = element.text || "*";
    node.appendChild(icon);
  };

  const renderVideoElement = (element, node) => {
    const shell = document.createElement("span");
    shell.className = "workspace-powerpoint-video-object";
    shell.appendChild(createWorkspaceIconNode("play", {
      className: "workspace-powerpoint-video-play",
      label: "Play"
    }));
    const label = document.createElement("strong");
    label.textContent = element.text || "Video";
    shell.appendChild(label);
    node.appendChild(shell);
  };

  const renderCodeElement = (element, node) => {
    const code = document.createElement("code");
    code.className = "workspace-powerpoint-code-object";
    code.textContent = element.text || "";
    node.appendChild(code);
  };

  const appendCanvasResizeHandles = (element, node) => {
    if (!element || !node) {
      return;
    }
    const x = Number(element.x || 0);
    const y = Number(element.y || 0);
    const w = Number(element.w || 0);
    const h = Number(element.h || 0);
    [
      ["nw", x, y],
      ["ne", x + w, y],
      ["sw", x, y + h],
      ["se", x + w, y + h]
    ].forEach(([handle, left, top]) => {
      const dot = document.createElement("i");
      dot.className = `workspace-powerpoint-resize-handle workspace-powerpoint-canvas-resize-handle ${handle}`;
      dot.dataset.elementId = element.id;
      dot.title = `Resize ${String(handle).toUpperCase()}`;
      dot.style.left = `${left}%`;
      dot.style.top = `${top}%`;
      dot.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      dot.addEventListener("pointerdown", (event) => startElementPointerInteraction(event, element, node));
      canvas.appendChild(dot);
    });
  };

  activeElements.forEach((element) => {
    const node = document.createElement("div");
    node.className = [
      "workspace-powerpoint-element",
      `type-${element.type}`,
      `shape-${element.shape || "rectangle"}`,
      selectedElementSet.has(element.id) ? "selected" : "",
      hasMultiSelection && selectedElementSet.has(element.id) ? "multi-selected" : "",
      element.locked ? "is-locked" : "",
      element.groupId ? "is-grouped" : ""
    ].join(" ");
    node.dataset.elementId = element.id;
    node.tabIndex = 0;
    node.style.left = `${element.x}%`;
    node.style.top = `${element.y}%`;
    node.style.width = `${element.w}%`;
    node.style.height = `${element.h}%`;
    node.style.zIndex = String(element.z || 0);
    node.style.color = element.color;
    node.style.background = element.fill;
    node.style.borderColor = element.stroke;
    node.style.borderWidth = `${Number(element.strokeWidth || 0)}px`;
    node.style.opacity = String(element.opacity);
    node.style.transform = `rotate(${element.rotation || 0}deg) scale(${element.flipX ? -1 : 1}, ${element.flipY ? -1 : 1})`;
    node.style.textAlign = element.align || "left";
    node.style.fontSize = `${element.fontSize}px`;
    node.style.fontFamily = element.fontFamily || "";
    node.style.fontWeight = element.bold ? "700" : "400";
    node.style.fontStyle = element.italic ? "italic" : "normal";
    node.style.textDecoration = element.underline ? "underline" : "none";
    node.addEventListener("pointerdown", (event) => startElementPointerInteraction(event, element, node));
    node.addEventListener("click", (event) => {
      event.stopPropagation();
      if (node.dataset.selectionHandled === "true") {
        return;
      }
      if (state.presentationFormatBrush) {
        applyPresentationFormatBrush(element.id);
        return;
      }
      const additive = event.shiftKey || event.ctrlKey || event.metaKey;
      if (additive) {
        const nextIds = selectedElementSet.has(element.id)
          ? selectedElementIds.filter((id) => id !== element.id)
          : [...selectedElementIds, element.id];
        setPresentationSelection(nextIds.length ? nextIds : [element.id], element.id);
        renderWorkspace();
        return;
      }
      if (selectedElementIds.length === 1 && selectedElementIds[0] === element.id) {
        return;
      }
      selectPresentationElementOrGroup(element);
      renderWorkspace();
    });
    node.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectPresentationElementOrGroup(element);
        renderWorkspace();
      }
    });
    node.addEventListener("contextmenu", (event) => {
      if (!selectedElementSet.has(element.id)) {
        selectPresentationElementOrGroup(element);
      } else {
        state.currentStructuredSubItemId = element.id;
      }
      canvas.querySelectorAll(".workspace-powerpoint-element.selected").forEach((selectedNode) => {
        selectedNode.classList.remove("selected");
      });
      node.classList.add("selected");
      const contextElements = selectedElementSet.has(element.id)
        ? selectedElements
        : element.groupId
          ? activeElements.filter((item) => item.groupId === element.groupId)
          : [element];
      const contextElementIds = contextElements.map((item) => item.id);
      const textContextItems = [
        {
          label: "Bullets",
          icon: "list",
          disabled: contextElements.length > 1 || !isPresentationListTextTarget(element),
          action: () => updateElement(element.id, {
            text: formatPresentationListText(element.text || "", false)
          }, { refreshWorkspace: true })
        },
        {
          label: "Numbering",
          icon: "number",
          disabled: contextElements.length > 1 || !isPresentationListTextTarget(element),
          action: () => updateElement(element.id, {
            text: formatPresentationListText(element.text || "", true)
          }, { refreshWorkspace: true })
        },
        { separator: true },
        {
          label: "Increase indent",
          icon: "chevronRight",
          disabled: contextElements.length > 1 || !isPresentationListTextTarget(element),
          action: () => updateElement(element.id, {
            text: changePresentationListIndentText(element.text || "", "indent")
          }, { refreshWorkspace: true })
        },
        {
          label: "Decrease indent",
          icon: "chevronLeft",
          disabled: contextElements.length > 1 || !isPresentationListTextTarget(element),
          action: () => updateElement(element.id, {
            text: changePresentationListIndentText(element.text || "", "outdent")
          }, { refreshWorkspace: true })
        },
        { separator: true },
        {
          label: "Text align left",
          icon: "alignLeft",
          disabled: contextElements.length > 1 || !isPresentationTextAlignmentTarget(element),
          action: () => updateElement(element.id, { align: "left" }, { refreshWorkspace: true })
        },
        {
          label: "Text align center",
          icon: "alignCenter",
          disabled: contextElements.length > 1 || !isPresentationTextAlignmentTarget(element),
          action: () => updateElement(element.id, { align: "center" }, { refreshWorkspace: true })
        },
        {
          label: "Text align right",
          icon: "alignRight",
          disabled: contextElements.length > 1 || !isPresentationTextAlignmentTarget(element),
          action: () => updateElement(element.id, { align: "right" }, { refreshWorkspace: true })
        }
      ];
      const shapeContextItems = [
        {
          label: "Change to rectangle",
          icon: "shape",
          disabled: contextElements.length > 1 || !isPresentationShapeEditable(element),
          action: () => updateElement(element.id, { shape: "rectangle" }, { refreshWorkspace: true })
        },
        {
          label: "Change to circle",
          icon: "shape",
          disabled: contextElements.length > 1 || !isPresentationShapeEditable(element),
          action: () => updateElement(element.id, { shape: "ellipse" }, { refreshWorkspace: true })
        },
        { separator: true },
        { label: "Reset rotation", icon: "refresh", action: () => updateElement(element.id, { rotation: 0 }, { refreshWorkspace: true }) },
        element.type === "image"
          ? {
              label: "Reset crop",
              icon: "image",
              action: () => updateElement(element.id, { cropX: 50, cropY: 50, zoom: 1 }, { refreshWorkspace: true })
            }
          : null
      ].filter(Boolean);
      const arrangeContextItems = [
        {
          label: "Bring forward",
          icon: "chevronRight",
          action: () => contextElements.length > 1 ? moveSelectedElementDepth(1) : moveElementDepth(element.id, 1)
        },
        {
          label: "Send backward",
          icon: "chevronLeft",
          action: () => contextElements.length > 1 ? moveSelectedElementDepth(-1) : moveElementDepth(element.id, -1)
        },
        { separator: true },
        { label: "Object left", icon: "alignLeft", action: () => contextElements.length > 1 ? alignSelectedElement("left") : alignElement(element, "left") },
        { label: "Object center", icon: "alignCenter", action: () => contextElements.length > 1 ? alignSelectedElement("center") : alignElement(element, "center") },
        { label: "Object right", icon: "alignRight", action: () => contextElements.length > 1 ? alignSelectedElement("right") : alignElement(element, "right") },
        { separator: true },
        { label: "Object top", icon: "alignTop", action: () => contextElements.length > 1 ? alignSelectedElement("top") : alignElement(element, "top") },
        { label: "Object middle", icon: "alignMiddle", action: () => contextElements.length > 1 ? alignSelectedElement("middle") : alignElement(element, "middle") },
        { label: "Object bottom", icon: "alignBottom", action: () => contextElements.length > 1 ? alignSelectedElement("bottom") : alignElement(element, "bottom") },
        { separator: true },
        {
          label: "Distribute horizontal",
          icon: "alignCenter",
          disabled: contextElements.length < 3,
          action: () => distributeSelectedElements("horizontal")
        },
        {
          label: "Distribute vertical",
          icon: "alignMiddle",
          disabled: contextElements.length < 3,
          action: () => distributeSelectedElements("vertical")
        }
      ];
      const selectionContextItems = [
        {
          label: contextElements.some((item) => item.locked) ? "Unlock" : "Lock",
          icon: "lock",
          action: () => updateElementsByIds(contextElementIds, (item) => ({ ...item, locked: !contextElements.some((source) => source.locked) }), {
            refreshWorkspace: true,
            selectedElementId: element.id,
            selectedElementIds: contextElementIds
          })
        },
        {
          label: "Group",
          icon: "group",
          disabled: contextElements.length < 2,
          action: () => {
            const groupId = createPresentationElementId("group");
            updateElementsByIds(contextElementIds, (item) => ({ ...item, groupId }), {
              refreshWorkspace: true,
              selectedElementId: element.id,
              selectedElementIds: contextElementIds
            });
          }
        },
        {
          label: "Ungroup",
          icon: "group",
          disabled: !contextElements.some((item) => item.groupId),
          action: () => updateElementsByIds(contextElementIds, (item) => ({ ...item, groupId: "" }), {
            refreshWorkspace: true,
            selectedElementId: element.id,
            selectedElementIds: contextElementIds
          })
        }
      ];
      const clipboardContextItems = [
        { label: "Copy", icon: "copy", action: () => copyElementsToClipboard(contextElements) },
        {
          label: "Cut",
          icon: "cut",
          disabled: activeElements.length <= contextElements.length || contextElements.some((item) => item.locked),
          action: () => {
            copyElementsToClipboard(contextElements);
            removeElementsByIds(contextElementIds);
          }
        },
        { label: "Paste", icon: "paste", disabled: !state.presentationClipboard, action: pastePresentationClipboard },
        { separator: true },
        { label: "Duplicate", icon: "duplicate", action: () => duplicateElementsFrom(contextElements) }
      ];
      const formattingContextItems = [
        {
          label: state.presentationFormatBrush ? "Paste formatting" : "Copy formatting",
          icon: "palette",
          action: () => state.presentationFormatBrush ? applyPresentationFormatBrush(element.id) : copySelectedFormatting()
        },
        { label: "Reset rotation", icon: "refresh", action: () => updateElement(element.id, { rotation: 0 }, { refreshWorkspace: true }) }
      ];
      showPresentationContextMenu(event, [
        {
          label: contextElements.length > 1 ? `${contextElements.length} objects selected` : "Edit text",
          icon: "text",
          disabled: contextElements.length > 1 || element.shape === "line" || element.locked,
          action: () => {
            state.currentStructuredSubItemId = element.id;
            renderWorkspace();
            focusSelectedTextEditor();
          }
        },
        { label: "Text", icon: "text", children: textContextItems },
        { label: "Shape", icon: "shape", children: shapeContextItems },
        { label: "Clipboard", icon: "copy", children: clipboardContextItems },
        { label: "Formatting", icon: "palette", children: formattingContextItems },
        { label: "Arrange", icon: "alignCenter", children: arrangeContextItems },
        { label: "Selection", icon: "group", children: selectionContextItems },
        {
          label: "Delete",
          icon: "delete",
          danger: true,
          disabled: activeElements.length <= contextElements.length || contextElements.some((item) => item.locked),
          action: () => removeElementsByIds(contextElementIds)
        }
      ].filter(Boolean));
    });
    if (element.type === "image") {
      if (element.src) {
        const image = document.createElement("img");
        image.src = element.src;
        image.alt = element.text || activeSlide?.title || "Slide image";
        image.style.objectPosition = `${element.cropX || 50}% ${element.cropY || 50}%`;
        image.style.transform = `scale(${element.zoom || 1})`;
        image.style.transformOrigin = `${element.cropX || 50}% ${element.cropY || 50}%`;
        node.appendChild(image);
      } else {
        const placeholder = document.createElement("span");
        placeholder.textContent = "Image";
        node.appendChild(placeholder);
      }
    } else if (element.type === "table") {
      renderTableElement(element, node);
    } else if (element.type === "chart") {
      renderChartElement(element, node);
    } else if (element.type === "icon") {
      renderIconElement(element, node);
    } else if (element.type === "video") {
      renderVideoElement(element, node);
    } else if (element.type === "code") {
      renderCodeElement(element, node);
    } else if (element.type === "equation") {
      const equation = document.createElement("span");
      equation.className = "workspace-powerpoint-equation-object";
      equation.textContent = element.text || "f(x) = ax + b";
      node.appendChild(equation);
    } else if (element.shape === "line") {
      node.textContent = "";
    } else {
      const text = document.createElement("span");
      text.className = "workspace-powerpoint-element-text";
      text.textContent = element.text || (element.type === "title" ? activeSlide?.title || "Title" : "");
      text.title = "Double-click to edit text";
      const activateTextEditing = (event) => {
        event.preventDefault();
        event.stopPropagation();
        node.dataset.editing = "true";
        text.setAttribute("contenteditable", "true");
        window.setTimeout(() => {
          text.focus({ preventScroll: true });
          const selection = window.getSelection?.();
          const range = document.createRange();
          range.selectNodeContents(text);
          selection?.removeAllRanges();
          selection?.addRange(range);
        }, 0);
      };
      text.addEventListener("dblclick", activateTextEditing);
      node.addEventListener("dblclick", (event) => {
        if (event.target?.closest?.(".workspace-powerpoint-resize-handle,.workspace-powerpoint-rotate-handle")) {
          return;
        }
        activateTextEditing(event);
      });
      text.addEventListener("blur", () => {
        text.setAttribute("contenteditable", "false");
        node.dataset.editing = "false";
        updateElement(element.id, { text: text.textContent || "" }, { refreshWorkspace: true });
      });
      text.addEventListener("keydown", (event) => {
        if (handlePresentationListKeydown(event, element, text)) {
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          text.blur();
        }
      });
      node.appendChild(text);
    }
    if (element.id === selectedElement?.id && !element.locked) {
      const rotateHandle = document.createElement("i");
      rotateHandle.className = "workspace-powerpoint-rotate-handle";
      rotateHandle.title = "Rotate";
      rotateHandle.addEventListener("pointerdown", (event) => startElementPointerInteraction(event, element, node));
      node.appendChild(rotateHandle);
    }
    canvas.appendChild(node);
    if (element.id === selectedElement?.id && !element.locked) {
      appendCanvasResizeHandles(element, node);
    }
  });
  canvas.addEventListener("contextmenu", (event) => {
    if (event.target?.closest?.(".workspace-powerpoint-element")) {
      return;
    }
    const point = canvasPointToPercent(event);
    showPresentationContextMenu(event, [
      { label: "Paste", icon: "paste", disabled: !state.presentationClipboard, action: pastePresentationClipboard },
      { separator: true },
      { label: "Insert", icon: "insert", children: createCanvasInsertItems(point) },
      {
        label: "Slide",
        icon: "presentation",
        children: [
          { label: "New slide", icon: "insert", action: () => executePresentationCommand("slideAdd") },
          { label: "Diaporama", icon: "play", action: () => openPresentationSlideShow(activeSlideIndex, { fullscreen: true }) },
          { label: "Export PPTX", icon: "download", action: () => downloadPresentationExport().catch(handleError) }
        ]
      }
    ]);
  });
  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.target !== canvas) {
      return;
    }
    const start = canvasPointToPercent(event);
    const marquee = document.createElement("div");
    marquee.className = "workspace-powerpoint-marquee";
    marquee.style.left = `${start.x}%`;
    marquee.style.top = `${start.y}%`;
    marquee.style.width = "0%";
    marquee.style.height = "0%";
    canvas.appendChild(marquee);
    let latest = start;
    const updateMarquee = (point) => {
      latest = point;
      const left = Math.min(start.x, point.x);
      const top = Math.min(start.y, point.y);
      const right = Math.max(start.x, point.x);
      const bottom = Math.max(start.y, point.y);
      marquee.style.left = `${left}%`;
      marquee.style.top = `${top}%`;
      marquee.style.width = `${right - left}%`;
      marquee.style.height = `${bottom - top}%`;
    };
    const onMove = (moveEvent) => {
      updateMarquee(canvasPointToPercent(moveEvent));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      marquee.remove();
      const left = Math.min(start.x, latest.x);
      const top = Math.min(start.y, latest.y);
      const right = Math.max(start.x, latest.x);
      const bottom = Math.max(start.y, latest.y);
      const dragged = Math.abs(right - left) > 1 || Math.abs(bottom - top) > 1;
      if (dragged) {
        const ids = activeElements
          .filter((element) => {
            const elementRight = Number(element.x || 0) + Number(element.w || 0);
            const elementBottom = Number(element.y || 0) + Number(element.h || 0);
            return Number(element.x || 0) <= right && elementRight >= left && Number(element.y || 0) <= bottom && elementBottom >= top;
          })
          .map((element) => element.id);
        setPresentationSelection(ids, ids[0] || "");
        canvas.dataset.marqueeHandled = "true";
        window.setTimeout(() => {
          delete canvas.dataset.marqueeHandled;
          renderWorkspace();
        }, 0);
      }
    };
    event.preventDefault();
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  });
  canvas.addEventListener("click", () => {
    if (canvas.dataset.marqueeHandled === "true") {
      return;
    }
    setPresentationSelection([], "");
    renderWorkspace();
  });
  slideWrap.appendChild(canvas);

  slideWrap.addEventListener("wheel", (event) => {
    event.preventDefault();
    const delta = event.deltaY < 0 ? 0.08 : -0.08;
    zoomPresentationCanvas(delta);
  }, { passive: false });

  const notes = document.createElement("div");
  notes.className = "workspace-powerpoint-notes";
  const notesLabel = document.createElement("span");
  notesLabel.textContent = "Speaker notes";
  const notesInput = document.createElement("textarea");
  notesInput.value = activeSlide?.notes || "";
  notesInput.placeholder = "Notes for the presenter...";
  notesInput.addEventListener("input", (event) => {
    updateActiveSlide({ notes: event.target.value }, { refreshWorkspace: false });
  });
  notes.append(notesLabel, notesInput);
  stage.append(stageToolbar, slideWrap, notes);

  const inspector = document.createElement("aside");
  inspector.className = "workspace-powerpoint-inspector";
  const inspectorHeader = document.createElement("div");
  inspectorHeader.className = "workspace-powerpoint-inspector-header";
  const inspectorTitle = document.createElement("strong");
  inspectorTitle.textContent = hasMultiSelection ? "Selection inspector" : selectedElement ? "Object inspector" : "Slide inspector";
  const inspectorMeta = document.createElement("span");
  inspectorMeta.textContent = hasMultiSelection
    ? `${selectedElements.length} objects selected`
    : selectedElement
    ? `${selectedElement.type}${selectedElement.type === "shape" ? ` | ${selectedElement.shape}` : ""}${selectedElement.locked ? " | locked" : ""}${selectedElement.groupId ? " | grouped" : ""}`
    : `${activeSlide?.layout || "content"} | ${activeSlide?.theme || "default"}`;
  inspectorHeader.append(inspectorTitle, inspectorMeta);
  inspector.appendChild(inspectorHeader);

  const slideInspectorSection = document.createElement("section");
  slideInspectorSection.className = "workspace-powerpoint-inspector-section";
  const slideInspectorTitle = document.createElement("h4");
  slideInspectorTitle.textContent = "Slide";
  slideInspectorSection.append(
    slideInspectorTitle,
    createInspectorField(
      "Title",
      createTextInput(activeSlide?.title || "", (value) =>
        updateActiveSlide({ title: value }, { refreshWorkspace: false, selectedElementId: selectedElement?.id || "" })
      )
    ),
    createInspectorField(
      "Background",
      createTextInput(activeSlide?.background || "#ffffff", (value) =>
        updateActiveSlide({ background: value }, { refreshWorkspace: true, selectedElementId: selectedElement?.id || "" })
      , { type: "color" })
    )
  );
  inspector.appendChild(slideInspectorSection);

  const objectSection = document.createElement("section");
  objectSection.className = "workspace-powerpoint-inspector-section";
  const objectTitle = document.createElement("h4");
  objectTitle.textContent = hasMultiSelection ? "Selected objects" : selectedElement ? "Selected object" : "Objects";
  objectSection.appendChild(objectTitle);

  if (hasMultiSelection) {
    const multiSummary = document.createElement("p");
    multiSummary.className = "workspace-powerpoint-selection-summary";
    multiSummary.textContent = `${selectedElements.length} objects selected. Use Home > Paragraph/Arrange to align, distribute, duplicate or style them together.`;
    const multiActions = document.createElement("div");
    multiActions.className = "workspace-powerpoint-toggle-row";
    [
      ["Align left", () => alignSelectedElement("left")],
      ["Align center", () => alignSelectedElement("center")],
      ["Align right", () => alignSelectedElement("right")],
      ["Distribute H", () => distributeSelectedElements("horizontal")],
      ["Distribute V", () => distributeSelectedElements("vertical")]
    ].forEach(([label, action]) => {
      multiActions.appendChild(
        createRibbonButton(label, getWorkspaceCommandIcon(label), action, {
          disabled: String(label).startsWith("Distribute") && selectedElements.length < 3
        })
      );
    });
    objectSection.append(multiSummary, multiActions);
  } else if (selectedElement) {
    const textArea = document.createElement("textarea");
    textArea.className = "workspace-powerpoint-textarea";
    textArea.value = selectedElement.text || "";
    textArea.placeholder = selectedElement.type === "image" ? "Alt text" : "Object text";
    textArea.addEventListener("input", (event) => {
      updateElement(selectedElement.id, { text: event.target.value }, { refreshWorkspace: false });
      const liveText = canvas.querySelector(`[data-element-id="${CSS.escape(selectedElement.id)}"] .workspace-powerpoint-element-text`);
      if (liveText) {
        liveText.textContent = event.target.value;
      }
    });

    objectSection.append(createInspectorField("Text", textArea));
    if (selectedElement.type === "image" || selectedElement.type === "video") {
      objectSection.append(
        createInspectorField(
          selectedElement.type === "video" ? "Video URL" : "Image URL",
          createTextInput(selectedElement.src || "", (value) => updateElement(selectedElement.id, { src: value }, { refreshWorkspace: true }))
        )
      );
    }
    if (selectedElement.type === "image") {
      const cropGrid = document.createElement("div");
      cropGrid.className = "workspace-powerpoint-field-grid";
      [
        ["Crop X", "cropX", selectedElement.cropX || 50, "0", "100", "1"],
        ["Crop Y", "cropY", selectedElement.cropY || 50, "0", "100", "1"],
        ["Zoom", "zoom", selectedElement.zoom || 1, "1", "4", "0.1"]
      ].forEach(([label, key, value, min, max, step]) => {
        cropGrid.appendChild(
          createInspectorField(
            label,
            createTextInput(String(value), (nextValue) =>
              updateElement(selectedElement.id, { [key]: Number(nextValue) }, { refreshWorkspace: true })
            , { type: "number", min, max, step })
          )
        );
      });
      objectSection.append(
        createInspectorField("Crop", cropGrid)
      );
    }

    const geometry = document.createElement("div");
    geometry.className = "workspace-powerpoint-field-grid";
    [
      ["X", "x", selectedElement.x],
      ["Y", "y", selectedElement.y],
      ["W", "w", selectedElement.w],
      ["H", "h", selectedElement.h]
    ].forEach(([label, key, value]) => {
      geometry.appendChild(
        createInspectorField(
          label,
          createTextInput(String(Math.round(Number(value || 0))), (nextValue) =>
            updateElement(selectedElement.id, { [key]: Number(nextValue) }, { refreshWorkspace: true })
          , { type: "number", min: "0", max: "100", step: "1" })
        )
      );
    });
    objectSection.appendChild(geometry);

    const objectOptions = document.createElement("div");
    objectOptions.className = "workspace-powerpoint-field-grid";
    objectOptions.appendChild(
      createSelect("Font", PRESENTATION_FONT_OPTIONS, selectedElement.fontFamily || "", (value) =>
        updateElement(selectedElement.id, { fontFamily: value }, { refreshWorkspace: true })
      )
    );
    if (selectedElement.type === "shape") {
      objectOptions.appendChild(
        createSelect(
          "Shape",
          PRESENTATION_SHAPE_TYPES.map((shape) => ({ value: shape, label: shape })),
          selectedElement.shape || "rectangle",
          (value) => updateElement(selectedElement.id, { shape: value }, { refreshWorkspace: true })
        )
      );
    }
    if (selectedElement.type === "chart") {
      objectOptions.appendChild(
        createSelect(
          "Chart",
          PRESENTATION_CHART_TYPES.map((chartType) => ({ value: chartType, label: chartType })),
          selectedElement.chartType || "bar",
          (value) => updateElement(selectedElement.id, { chartType: value }, { refreshWorkspace: true })
        )
      );
    }
    objectOptions.appendChild(
      createSelect(
        "Animation",
        PRESENTATION_ELEMENT_ANIMATIONS,
        selectedElement.animation || "none",
        (value) => updateElement(selectedElement.id, { animation: value }, { refreshWorkspace: true })
      )
    );
    objectSection.appendChild(objectOptions);

    const styleGrid = document.createElement("div");
    styleGrid.className = "workspace-powerpoint-field-grid";
    styleGrid.append(
      createInspectorField(
        "Font",
        createTextInput(String(selectedElement.fontSize || 20), (value) =>
          updateElement(selectedElement.id, { fontSize: Number(value) }, { refreshWorkspace: true })
        , { type: "number", min: "8", max: "96", step: "1" })
      ),
      createInspectorField(
        "Text",
        createTextInput(selectedElement.color || "#374151", (value) =>
          updateElement(selectedElement.id, { color: value }, { refreshWorkspace: true })
        , { type: "color" })
      ),
      createInspectorField(
        "Fill",
        createTextInput(selectedElement.fill === "transparent" ? "#ffffff" : selectedElement.fill || "#ffffff", (value) =>
          updateElement(selectedElement.id, { fill: value }, { refreshWorkspace: true })
        , { type: "color" })
      ),
      createInspectorField(
        "Stroke",
        createTextInput(selectedElement.stroke === "transparent" ? "#ffffff" : selectedElement.stroke || "#cbd5e1", (value) =>
          updateElement(selectedElement.id, { stroke: value }, { refreshWorkspace: true })
        , { type: "color" })
      ),
      createInspectorField(
        "Weight",
        createTextInput(String(selectedElement.strokeWidth ?? 1), (value) =>
          updateElement(selectedElement.id, { strokeWidth: Number(value) }, { refreshWorkspace: true })
        , { type: "number", min: "0", max: "8", step: "1" })
      ),
      createInspectorField(
        "Rotation",
        createTextInput(String(Math.round(Number(selectedElement.rotation || 0))), (value) =>
          updateElement(selectedElement.id, { rotation: Number(value) }, { refreshWorkspace: true })
        , { type: "number", min: "-180", max: "180", step: "1" })
      ),
      createInspectorField(
        "Opacity",
        createTextInput(String(selectedElement.opacity || 1), (value) =>
          updateElement(selectedElement.id, { opacity: Number(value) }, { refreshWorkspace: true })
        , { type: "number", min: "0.1", max: "1", step: "0.1" })
      )
    );
    objectSection.appendChild(styleGrid);

    const alignRow = document.createElement("div");
    alignRow.className = "workspace-powerpoint-toggle-row";
    PRESENTATION_TEXT_ALIGNMENTS.forEach((alignment) => {
      alignRow.appendChild(
        createRibbonButton(alignment, getWorkspaceCommandIcon(alignment), () =>
          updateElement(selectedElement.id, { align: alignment }, { refreshWorkspace: true })
        , { active: selectedElement.align === alignment })
      );
    });
    objectSection.append(createInspectorField("Alignment", alignRow));

    const toggles = document.createElement("div");
    toggles.className = "workspace-powerpoint-toggle-row";
    [
      ["B", "bold", "bold"],
      ["I", "italic", "italic"],
      ["U", "underline", "underline"],
      ["Lock", "locked", "lock"],
      ["Flip H", "flipX", "transpose"],
      ["Flip V", "flipY", "transpose"]
    ].forEach(([label, key, icon]) => {
      toggles.appendChild(
        createRibbonButton(label, icon, () =>
          updateElement(selectedElement.id, { [key]: !selectedElement[key] }, { refreshWorkspace: true })
        , { active: Boolean(selectedElement[key]) })
      );
    });
    objectSection.append(createInspectorField("Style", toggles));
  } else {
    const list = document.createElement("div");
    list.className = "workspace-powerpoint-object-list";
    activeElements.forEach((element) => {
      const item = document.createElement("button");
      item.type = "button";
      item.textContent = `${element.type}${element.text ? ` | ${element.text.slice(0, 26)}` : ""}`;
      item.addEventListener("click", () => {
        selectPresentationElementOrGroup(element);
        renderWorkspace();
      });
      list.appendChild(item);
    });
    objectSection.appendChild(list);
  }
  inspector.appendChild(objectSection);

  const layersSection = document.createElement("section");
  layersSection.className = "workspace-powerpoint-inspector-section";
  const layersTitle = document.createElement("h4");
  layersTitle.textContent = "Layers";
  const layersList = document.createElement("div");
  layersList.className = "workspace-powerpoint-layer-list";
  [...activeElements].reverse().forEach((element) => {
    const row = document.createElement("div");
    row.className = `workspace-powerpoint-layer-row${selectedElementSet.has(element.id) ? " active" : ""}`;
    const selectButton = document.createElement("button");
    selectButton.type = "button";
    selectButton.className = "workspace-powerpoint-layer-select";
    selectButton.appendChild(
      createWorkspaceIconNode(presentationElementIconName(element), {
        className: "workspace-powerpoint-layer-icon",
        label: element.type
      })
    );
    const label = document.createElement("span");
    label.textContent = `${element.locked ? "Locked | " : ""}${element.groupId ? "Group | " : ""}${element.type}${element.text ? ` | ${String(element.text).replace(/\s+/g, " ").slice(0, 28)}` : ""}`;
    selectButton.appendChild(label);
    selectButton.addEventListener("click", (event) => {
      if (event.shiftKey || event.ctrlKey || event.metaKey) {
        const nextIds = selectedElementSet.has(element.id)
          ? selectedElementIds.filter((id) => id !== element.id)
          : [...selectedElementIds, element.id];
        setPresentationSelection(nextIds.length ? nextIds : [element.id], element.id);
      } else {
        selectPresentationElementOrGroup(element);
      }
      renderWorkspace();
    });

    const actions = document.createElement("div");
    actions.className = "workspace-powerpoint-layer-actions";
    [
      ["Front", "chevronRight", () => moveElementDepth(element.id, 999)],
      ["Back", "chevronLeft", () => moveElementDepth(element.id, -999)],
      ["Duplicate", "duplicate", () => duplicateElementFrom(element)],
      ["Lock", "lock", () => updateElement(element.id, { locked: !element.locked }, { refreshWorkspace: true })],
      ["Delete", "delete", () => removeElementById(element.id), activeElements.length <= 1 || element.locked]
    ].forEach(([labelText, icon, action, disabled]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "workspace-powerpoint-layer-action";
      button.title = labelText;
      button.disabled = Boolean(disabled);
      button.appendChild(
        createWorkspaceIconNode(icon, {
          className: "workspace-powerpoint-layer-icon",
          label: labelText
        })
      );
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        action();
      });
      actions.appendChild(button);
    });
    row.append(selectButton, actions);
    layersList.appendChild(row);
  });
  layersSection.append(layersTitle, layersList);
  inspector.appendChild(layersSection);

  if (state.presentationShowSlideRail) {
    editor.appendChild(slideRail);
  }
  editor.appendChild(stage);
  if (state.presentationShowInspector) {
    editor.appendChild(inspector);
  }
  shell.append(titleBar, ribbon, editor);
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
  const writeDashboardDraft = (updater = null, { refreshWorkspace = true } = {}) => {
    const next = deriveDashboardDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Dashboard");
    if (typeof updater === "function") {
      updater(next);
    }
    syncEditorDraft(buildDashboardContent(next), { refreshWorkspace });
  };
  const executeDashboardCommand = createWorkspaceCommandExecutor(
    "dashboard",
    createDashboardWorkspaceCommandAdapter({
      addMetric: () => {
        writeDashboardDraft((next) => {
          next.metrics.push({ label: `Metric ${next.metrics.length + 1}`, value: "", delta: "" });
        });
      },
      addChart: (kind = "bar") => {
        writeDashboardDraft((next) => {
          const chartKind = String(kind || "bar");
          next.charts.push({
            title: `Chart ${next.charts.length + 1}`,
            kind: chartKind,
            points: [{ label: "P1", value: "" }, { label: "P2", value: "" }]
          });
          state.currentStructuredItemId = `chart-${next.charts.length}`;
        });
      },
      addFilter: () => {
        writeDashboardDraft((next) => {
          next.filters.push(`Segment ${next.filters.length + 1}`);
        });
      },
      addTableRow: () => {
        writeDashboardDraft((next) => {
          next.table.rows.push(Array.from({ length: next.table.columns.length }, () => ""));
        });
      },
      addTableColumn: () => {
        writeDashboardDraft((next) => {
          next.table.columns.push(`Column ${next.table.columns.length + 1}`);
          next.table.rows = next.table.rows.map((row) => [...row, ""]);
        });
      },
      removeMetric: () => {
        if (model.metrics.length <= 1) {
          return;
        }
        writeDashboardDraft((next) => {
          next.metrics = next.metrics.slice(0, -1);
        });
      },
      removeChart: () => {
        if (model.charts.length <= 1) {
          return;
        }
        writeDashboardDraft((next) => {
          next.charts = next.charts.filter((_, index) => index !== activeChartIndex);
          state.currentStructuredItemId = next.charts.length
            ? `chart-${Math.min(activeChartIndex + 1, next.charts.length)}`
            : "";
        });
      },
      moveWidget: (direction = 0) => {
        moveDashboardWidget(activeWidget.id, direction);
      },
      refresh: () => {
        writeDashboardDraft(null);
      }
    })
  );

  // The Power BI-style dashboard belongs in the main preview canvas. Keep this
  // prototype dormant so the Modify drawer remains a compact editor.
  const renderDashboardPowerBiDrawerPrototype = false;
  if (renderDashboardPowerBiDrawerPrototype) {
    const parseDashboardNumber = (value = "") => {
      const normalized = String(value || "")
        .replace(/\s+/g, "")
        .replace(",", ".")
        .replace(/[^0-9.-]/g, "");
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : null;
    };
    const formatDashboardNumber = (value = null) => {
      if (!Number.isFinite(value)) {
        return "-";
      }
      const absolute = Math.abs(value);
      if (absolute >= 1000000) {
        return `$${(value / 1000000).toFixed(2)}M`;
      }
      if (absolute >= 1000) {
        return `$${Math.round(value / 1000)}K`;
      }
      return String(Math.round(value));
    };
    const tableColumns = model.table?.columns || [];
    const tableRows = model.table?.rows || [];
    const findColumnIndex = (patterns = []) =>
      tableColumns.findIndex((column) => {
        const text = String(column || "").toLowerCase();
        return patterns.some((pattern) => text.includes(pattern));
      });
    const labelColumnIndex = Math.max(
      0,
      findColumnIndex(["region", "territory", "product", "month", "segment", "name"])
    );
    const valueColumnIndex = Math.max(
      0,
      findColumnIndex(["revenue", "sales", "amount", "value", "total", "units"])
    );
    const tablePoints = tableRows
      .map((row, index) => ({
        label: row[labelColumnIndex] || `Row ${index + 1}`,
        value: row[valueColumnIndex] || "",
        numeric: parseDashboardNumber(row[valueColumnIndex])
      }))
      .filter((point) => point.label && point.numeric !== null);
    const activePoints = (activeChart.points || []).length ? activeChart.points : tablePoints;
    const numericPoints = activePoints
      .map((point) => ({
        label: point.label || "Point",
        value: point.value || "",
        numeric: parseDashboardNumber(point.value)
      }))
      .filter((point) => point.numeric !== null);
    const maxPointValue = Math.max(...numericPoints.map((point) => point.numeric), 1);
    const totalValue = tablePoints.reduce((sum, point) => sum + (point.numeric || 0), 0);
    const metricCards = [
      ...(model.metrics || []).slice(0, 4).map((metric) => ({
        label: metric.label || "KPI",
        value: metric.value || "-",
        meta: metric.delta || "Live"
      })),
      { label: "Revenue won", value: formatDashboardNumber(totalValue), meta: "From data model" },
      { label: "Qualified pipeline", value: formatDashboardNumber(maxPointValue), meta: "Top signal" },
      { label: "Forecast", value: numericPoints.length ? `${Math.round((totalValue / Math.max(maxPointValue, 1)) * 10)}%` : "100%", meta: "Scenario" },
      { label: "Data rows", value: String(tableRows.length), meta: `${tableColumns.length} fields` }
    ].slice(0, 4);

    const createPowerIcon = (icon, className = "workspace-powerbi-icon") =>
      createWorkspaceIconNode(icon, { className, label: icon });
    const createRailButton = (label, icon, active = false) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `workspace-powerbi-rail-button${active ? " is-active" : ""}`;
      button.append(createPowerIcon(icon), document.createElement("span"));
      button.lastChild.textContent = label;
      return button;
    };
    const createTopButton = (label, icon, onClick = null) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "workspace-powerbi-top-command";
      button.append(createPowerIcon(icon), document.createElement("span"));
      button.lastChild.textContent = label;
      if (typeof onClick === "function") {
        button.addEventListener("click", onClick);
      }
      return button;
    };
    const createKpiCard = (metric) => {
      const card = document.createElement("article");
      card.className = "workspace-powerbi-kpi-card";
      const label = document.createElement("span");
      label.textContent = metric.label;
      const value = document.createElement("strong");
      value.textContent = metric.value;
      const meta = document.createElement("small");
      meta.textContent = metric.meta || "Updated";
      card.append(label, value, meta);
      return card;
    };
    const createHorizontalBarCard = (title, points = [], { stacked = false } = {}) => {
      const card = document.createElement("article");
      card.className = "workspace-powerbi-visual-card";
      const heading = document.createElement("h3");
      heading.textContent = title;
      const list = document.createElement("div");
      list.className = "workspace-powerbi-horizontal-bars";
      points.slice(0, 5).forEach((point, index) => {
        const numeric = Number.isFinite(point.numeric) ? point.numeric : parseDashboardNumber(point.value) || 0;
        const width = Math.max(8, Math.round((numeric / maxPointValue) * 100));
        const row = document.createElement("div");
        row.className = "workspace-powerbi-bar-row";
        const label = document.createElement("span");
        label.textContent = point.label || `Item ${index + 1}`;
        const track = document.createElement("div");
        track.className = "workspace-powerbi-bar-track";
        const fill = document.createElement("div");
        fill.className = `workspace-powerbi-bar-fill color-${(index % 5) + 1}`;
        fill.style.width = `${width}%`;
        track.appendChild(fill);
        if (stacked) {
          const secondFill = document.createElement("div");
          secondFill.className = "workspace-powerbi-bar-fill is-secondary";
          secondFill.style.width = `${Math.max(8, 100 - width)}%`;
          track.appendChild(secondFill);
        }
        const value = document.createElement("strong");
        value.textContent = point.value || formatDashboardNumber(numeric);
        row.append(label, track, value);
        list.appendChild(row);
      });
      card.append(heading, list);
      return card;
    };
    const createMatrixCard = (title, columns = [], rows = []) => {
      const card = document.createElement("article");
      card.className = "workspace-powerbi-visual-card workspace-powerbi-matrix-card";
      const heading = document.createElement("h3");
      heading.textContent = title;
      const table = document.createElement("table");
      const thead = document.createElement("thead");
      const headerRow = document.createElement("tr");
      columns.slice(0, 4).forEach((column) => {
        const th = document.createElement("th");
        th.textContent = column || "Field";
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);
      const tbody = document.createElement("tbody");
      rows.slice(0, 7).forEach((row) => {
        const tr = document.createElement("tr");
        columns.slice(0, 4).forEach((_, index) => {
          const td = document.createElement("td");
          td.textContent = row[index] || "";
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      card.append(heading, table);
      return card;
    };
    const createMapCard = () => {
      const card = document.createElement("article");
      card.className = "workspace-powerbi-visual-card workspace-powerbi-map-card";
      const heading = document.createElement("h3");
      heading.textContent = "Forecast by Location";
      const map = document.createElement("div");
      map.className = "workspace-powerbi-map";
      ["WA", "CA", "TX", "CO", "IL", "NY", "FL", "NC", "GA", "AZ", "OR", "MI"].forEach((stateName, index) => {
        const stateTile = document.createElement("span");
        stateTile.className = `workspace-powerbi-state-tile tone-${(index % 4) + 1}`;
        stateTile.textContent = stateName;
        map.appendChild(stateTile);
      });
      card.append(heading, map);
      return card;
    };

    const shell = document.createElement("div");
    shell.className = "workspace-dashboard-powerbi";

    const rail = document.createElement("aside");
    rail.className = "workspace-powerbi-rail";
    const launcher = document.createElement("div");
    launcher.className = "workspace-powerbi-launcher";
    launcher.textContent = "::";
    rail.append(
      launcher,
      createRailButton("Accueil", "sheet", true),
      createRailButton("Creer", "insert"),
      createRailButton("Parcourir", "search"),
      createRailButton("Hub de donnees", "database"),
      createRailButton("Applications", "grid"),
      createRailButton("Espaces de travail", "briefcase"),
      createRailButton("Mon espace", "user"),
      createRailButton("Rapports", "barChart")
    );

    const mainShell = document.createElement("div");
    mainShell.className = "workspace-powerbi-main";
    const serviceBar = document.createElement("div");
    serviceBar.className = "workspace-powerbi-servicebar";
    const titleWrap = document.createElement("div");
    titleWrap.className = "workspace-powerbi-title";
    const titleName = document.createElement("strong");
    titleName.textContent = model.title || "Regional Sales Sample";
    const titleMeta = document.createElement("span");
    titleMeta.textContent = "Hydria BI";
    titleWrap.append(titleName, titleMeta);
    const search = document.createElement("input");
    search.type = "search";
    search.className = "workspace-powerbi-search";
    search.placeholder = "Rechercher";
    const serviceActions = document.createElement("div");
    serviceActions.className = "workspace-powerbi-service-actions";
    ["refresh", "settings", "download"].forEach((icon) => serviceActions.appendChild(createPowerIcon(icon)));
    serviceBar.append(titleWrap, search, serviceActions);

    const commandBar = document.createElement("div");
    commandBar.className = "workspace-powerbi-commandbar";
    commandBar.append(
      createTopButton("Fichier", "page"),
      createTopButton("Exporter", "download"),
      createTopButton("Partager", "link"),
      createTopButton("Obtenir des insights", "sparkline"),
      createTopButton("S'abonner au rapport", "note"),
      createTopButton("Definir une alerte", "checkbox"),
      createTopButton("Modifier", "rename")
    );
    const dashboardActions = document.createElement("div");
    dashboardActions.className = "workspace-powerbi-commandbar-actions";
    appendDashboardCommandGroups(
      dashboardActions,
      createWorkspaceDashboardHomeMenuItems({
        canRemoveMetric: model.metrics.length > 1,
        canRemoveChart: model.charts.length > 1,
        canMoveWidgetLeft: activeWidgetIndex > 0,
        canMoveWidgetRight: activeWidgetIndex < model.widgets.length - 1
      }),
      executeDashboardCommand
    );
    commandBar.appendChild(dashboardActions);

    const reportShell = document.createElement("section");
    reportShell.className = "workspace-powerbi-report-shell";
    const reportHeader = document.createElement("header");
    reportHeader.className = "workspace-powerbi-report-header";
    const brand = document.createElement("div");
    brand.className = "workspace-powerbi-brand";
    const brandMark = document.createElement("span");
    brandMark.className = "workspace-powerbi-brand-mark";
    const brandText = document.createElement("strong");
    brandText.textContent = "Hydria";
    brand.append(brandMark, brandText);
    const reportTitle = document.createElement("div");
    reportTitle.className = "workspace-powerbi-report-title";
    const reportName = document.createElement("strong");
    reportName.textContent = String(model.title || "Regional Sales").toUpperCase();
    const reportSub = document.createElement("span");
    reportSub.textContent = model.summary || "Sales Overview";
    reportTitle.append(reportName, reportSub);
    const reportTabs = document.createElement("nav");
    reportTabs.className = "workspace-powerbi-report-tabs";
    ["Overview", "Trends", "Insights"].forEach((label, index) => {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = index === 0 ? "is-active" : "";
      tab.textContent = label;
      reportTabs.appendChild(tab);
    });
    reportHeader.append(brand, reportTitle, reportTabs);

    const canvas = document.createElement("div");
    canvas.className = "workspace-powerbi-canvas";
    const kpiRow = document.createElement("div");
    kpiRow.className = "workspace-powerbi-kpi-row";
    metricCards.forEach((metric) => kpiRow.appendChild(createKpiCard(metric)));
    const grid = document.createElement("div");
    grid.className = "workspace-powerbi-report-grid";
    grid.append(
      createHorizontalBarCard("Revenue Open par Sales Stage", numericPoints.slice(0, 4)),
      createHorizontalBarCard("Revenue Won and Revenue in Pipeline", numericPoints.slice(0, 4), { stacked: true }),
      createMatrixCard("Forecast by Territory", tableColumns, tableRows),
      createMapCard(),
      createMatrixCard("Product Category", tableColumns.slice(0, 4), tableRows.slice(0, 8))
    );
    canvas.append(kpiRow, grid);

    const inspector = document.createElement("aside");
    inspector.className = "workspace-powerbi-inspector";
    const inspectorTitle = document.createElement("div");
    inspectorTitle.className = "workspace-powerbi-inspector-title";
    inspectorTitle.innerHTML = "<strong>Visualisations</strong><span>Donnees</span>";
    const visualGrid = document.createElement("div");
    visualGrid.className = "workspace-powerbi-visual-picker";
    ["barChart", "lineChart", "areaChart", "pieChart", "table", "slicer", "map", "number"].forEach((icon) => {
      const button = document.createElement("button");
      button.type = "button";
      button.appendChild(createPowerIcon(icon));
      visualGrid.appendChild(button);
    });
    const fields = document.createElement("div");
    fields.className = "workspace-powerbi-fields";
    tableColumns.slice(0, 8).forEach((column, index) => {
      const field = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = index < 4;
      const text = document.createElement("span");
      text.textContent = column || `Field ${index + 1}`;
      field.append(checkbox, text);
      fields.appendChild(field);
    });
    const formatPanel = document.createElement("div");
    formatPanel.className = "workspace-powerbi-format-panel";
    const chartTitleLabel = document.createElement("label");
    chartTitleLabel.textContent = "Titre du visuel";
    const chartTitleInput = document.createElement("input");
    chartTitleInput.type = "text";
    chartTitleInput.value = activeChart.title || "";
    chartTitleInput.addEventListener("input", (event) => {
      const next = deriveDashboardDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Dashboard");
      next.charts = next.charts.map((chart, index) =>
        index === activeChartIndex ? { ...chart, title: event.target.value } : chart
      );
      syncEditorDraft(buildDashboardContent(next));
    });
    chartTitleLabel.appendChild(chartTitleInput);
    const chartKindLabel = document.createElement("label");
    chartKindLabel.textContent = "Type";
    const chartKindInput = document.createElement("select");
    ["bar", "line", "area", "progress"].forEach((kind) => {
      const option = document.createElement("option");
      option.value = kind;
      option.textContent = kind;
      option.selected = (activeChart.kind || "bar") === kind;
      chartKindInput.appendChild(option);
    });
    chartKindInput.addEventListener("change", (event) => {
      const next = deriveDashboardDraft(currentDraftContent(), state.currentWorkObject?.title || "Hydria Dashboard");
      next.charts = next.charts.map((chart, index) =>
        index === activeChartIndex ? { ...chart, kind: event.target.value } : chart
      );
      syncEditorDraft(buildDashboardContent(next), { refreshWorkspace: true });
    });
    chartKindLabel.appendChild(chartKindInput);
    formatPanel.append(chartTitleLabel, chartKindLabel);
    inspector.append(inspectorTitle, visualGrid, fields, formatPanel);

    reportShell.append(reportHeader, canvas);
    mainShell.append(serviceBar, commandBar, reportShell);
    shell.append(rail, mainShell, inspector);
    container.appendChild(shell);
    return;
  }

  const shell = document.createElement("div");
  shell.className = "workspace-app-builder workspace-dashboard-editor workspace-dashboard-workbench";

  const toolbar = document.createElement("div");
  toolbar.className = "workspace-structured-toolbar";
  const stats = document.createElement("div");
  stats.className = "workspace-structured-stats";
  stats.textContent = `${model.widgets.length} widgets | ${model.metrics.length} metrics | ${model.charts.length} charts`;
  const actions = document.createElement("div");
  actions.className = "workspace-structured-actions";
  appendDashboardCommandGroups(
    actions,
    createWorkspaceDashboardHomeMenuItems({
      canRemoveMetric: model.metrics.length > 1,
      canRemoveChart: model.charts.length > 1,
      canMoveWidgetLeft: activeWidgetIndex > 0,
      canMoveWidgetRight: activeWidgetIndex < model.widgets.length - 1
    }),
    executeDashboardCommand
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
  appendDashboardCommandGroups(
    tableActions,
    [
      { label: "Add row", icon: "rowInsert", commandId: "dashboardAddTableRow" },
      { label: "Add column", icon: "columnInsert", commandId: "dashboardAddTableColumn" }
    ],
    executeDashboardCommand
  );
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
  const activePage = currentWorkspacePage();
  container.classList.remove("workspace-launcher-crm", "workspace-launcher-core-chat");
  if (activePage?.slug === "chat") {
    renderCoreChatWorkspace(container);
    return;
  }
  if (activePage?.slug === "crm") {
    container.classList.add("workspace-launcher-crm");
    renderCrmWorkspaceEmbed(container, { userId: state.currentUserId });
    return;
  }
  const header = document.createElement("div");
  header.className = "workspace-launcher-header";
  const title = document.createElement("div");
  const heading = document.createElement("h3");
  heading.textContent = activePage ? activePage.title : "Choose a workspace";
  const subtitle = document.createElement("p");
  subtitle.textContent = activePage
    ? activePage.description
    : "Each workspace now opens on its own page with its own files and tools.";
  title.append(heading, subtitle);
  header.appendChild(title);

  const grid = document.createElement("div");
  grid.className = `workspace-launcher-grid${activePage ? " workspace-launcher-grid-single" : ""}`;

  const items = activePage ? [activePage] : workspaceSwitcherItems();

  items.forEach((item) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "workspace-launcher-card";
    card.dataset.workspace = item.slug;
    const label = document.createElement("strong");
    label.textContent = activePage ? item.hint : item.title;
    const hint = document.createElement("span");
    hint.textContent = activePage
      ? "A new object will be created on this page."
      : item.description;
    card.append(label, hint);
    card.addEventListener("click", () => {
      if (activePage) {
        createBlankWorkspace(item.kind, item.family, item.label).catch(handleError);
        return;
      }
      activateWorkspacePage(item).catch(handleError);
    });
    grid.appendChild(card);
  });

  container.append(header, grid);
}

function renderWorkspace() {
  const activePage = currentWorkspacePage();
  const selectedObjectPage = workspacePageForWorkObject(state.currentWorkObject);
  const workObject =
    activePage && selectedObjectPage?.slug !== activePage.slug
      ? null
      : state.currentWorkObject;
  const project = state.currentWorkspace?.project || null;
  const hasVisibleWorkspace = Boolean(workObject);
  const hasEmbeddedPage = activePage?.slug === "crm" || activePage?.slug === "chat";
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

  el["work-object-empty"].classList.toggle("hidden", Boolean(workObject) || hasEmbeddedPage);
  el["work-object-empty"].textContent = activePage
    ? `No ${activePage.label} object is open on this page yet.`
    : "Choose a workspace page to begin.";
  if (el["workspace-layout"]) {
    el["workspace-layout"].classList.toggle("hidden", !hasVisibleWorkspace);
  }
  renderWorkspaceLauncher(hasVisibleWorkspace);
  el["work-object-kind"].textContent = workObject?.objectKind || workObject?.kind || "None";
  if (el["workspace-panel-root"]) {
    el["workspace-panel-root"].dataset.mode = state.workspaceMode;
    el["workspace-panel-root"].dataset.kind = workspaceLens.kind || "creation";
    el["workspace-panel-root"].dataset.family = currentWorkspaceFamilyId() || "generic";
    el["workspace-panel-root"].dataset.hasWorkspace = hasVisibleWorkspace ? "true" : "false";
  }
  if (el["assistant-dock"]) {
    el["assistant-dock"].dataset.kind = workspaceLens.kind || "creation";
    el["assistant-dock"].dataset.family = currentWorkspaceFamilyId() || "generic";
  }
  if (el["workspace-context-label"]) {
    el["workspace-context-label"].classList.toggle("hidden", !activePage);
    el["workspace-context-label"].textContent = activePage
      ? `${activePage.label} workspace`
      : "Workspace overview";
  }
  if (el["workspace-mode-nav"]?.parentElement) {
    el["workspace-mode-nav"].parentElement.classList.toggle("hidden", !hasVisibleWorkspace);
  }
  if (el["workspace-title"]) {
    el["workspace-title"].textContent =
      workObject?.title || activePage?.title || "Hydria workspaces";
  }
  if (el["workspace-subtitle"]) {
    el["workspace-subtitle"].textContent = hasVisibleWorkspace
      ? state.workspaceMode === "edit"
        ? "Change what is open on the right, or ask Hydria to continue the same project below."
        : friendlyWorkspaceSubtitle(project, workObject, workspaceLens)
      : activePage?.description ||
        "Open Docs, Sheets, Slides or another workspace from its dedicated page.";
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
      : activePage
        ? `Describe what Hydria should create in ${activePage.label}.`
        : "Choose a workspace, then describe what you want Hydria to create.";
  }
  if (el["assistant-status-text"] && !state.loading) {
    el["assistant-status-text"].textContent = hasVisibleWorkspace
      ?workspaceLens.assistantStatus
      : activePage
        ? `Ready to create something in ${activePage.label}.`
        : "Choose a workspace page to start.";
  }
  applyWorkspaceLabels();
  if (el["workspace-view-status"]) {
    const collaborators = state.workspacePresence
      .filter((presence) => Number(presence.userId) !== Number(state.currentUserId))
      .map((presence) => presence.name)
      .filter(Boolean);
    el["workspace-view-status"].textContent = [
      currentPreviewSummary(),
      state.offline ? "Hors ligne, brouillon local" : "",
      collaborators.length
        ? `${collaborators.length} collaborateur${collaborators.length > 1 ? "s" : ""} : ${collaborators.join(", ")}`
        : ""
    ]
      .filter(Boolean)
      .join(" | ");
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
    workObjects: workspaceWorkObjects(),
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
      workspaceWorkObjects().length <= 1
  );
  el["workspace-breadcrumb"]?.classList.toggle("hidden", state.workspaceMode === "edit" || !showDocumentProjectContext);
  el["workspace-project-meta"]?.classList.toggle("hidden", state.workspaceMode === "edit" || !showDocumentProjectContext);
  el["workspace-dimensions"]?.classList.toggle("hidden", state.workspaceMode === "edit" || !showDocumentProjectContext);
  const actionGuide = currentWorkspaceActionGuide();
  if (el["workspace-action-guide"]) {
    el["workspace-action-guide"].classList.toggle(
      "hidden",
      !(workObject && filePath) || state.workspaceMode === "edit"
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
    currentSurfaces(),
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
  renderWorkspaceSheetDocuments();

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

  if (!hasVisibleWorkspace && state.workspacePreviewExpanded) {
    setWorkspacePreviewExpanded(false);
  }

  refreshPreviewPane();
  enhanceWorkspacePreviewHeader();
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

  if (Array.isArray(state.currentWorkspace?.workObjects)) {
    const workspaceIndex = state.currentWorkspace.workObjects.findIndex((item) => item.id === workObject.id);
    if (workspaceIndex >= 0) {
      state.currentWorkspace.workObjects[workspaceIndex] = {
        ...state.currentWorkspace.workObjects[workspaceIndex],
        ...workObject
      };
    }
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

  const payload = await apiClient.listWorkObjects(state.currentUserId);
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
  const payload = await apiClient.createConversation(state.currentUserId, title, {
    projectId: state.currentChatProjectId,
    folder: state.currentConversationFolder
  });
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
  await loadChatWorkspaceData();
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
  const conversationChanged =
    Number(conversationId) !== Number(state.currentConversationId || 0);
  if (conversationChanged) {
    await flushPendingWorkObjectChanges();
    state.coreChatAttachments = [];
    if (!state.coreChatLoading) {
      state.coreChatPendingMessages = [];
    }
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
  const latestWorkObject =
    state.workObjects.find(
      (workObject) =>
        Number(workObject.conversationId || 0) === Number(state.currentConversationId || 0)
    ) || null;

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

function stopWorkObjectCollaboration() {
  if (workspacePresenceHandle) {
    window.clearInterval(workspacePresenceHandle);
    workspacePresenceHandle = null;
  }
  workspaceEventSource?.close();
  workspaceEventSource = null;
  state.workspacePresence = [];
  if (collaborationSyncHandle) {
    window.clearTimeout(collaborationSyncHandle);
    collaborationSyncHandle = null;
  }
  collaborationPendingChange = null;
}

function currentUserDisplayName() {
  const user = state.users.find((item) => Number(item.id) === Number(state.currentUserId));
  return user?.username || `User ${state.currentUserId || ""}`.trim();
}

function captureWorkspaceCursor() {
  const activeElement = document.activeElement;
  const cell = activeElement?.closest?.("[data-sheet-grid-cell]");
  if (cell) {
    return {
      type: "cell",
      cell: cell.getAttribute("data-sheet-grid-cell") || "",
      label: cell.getAttribute("aria-label") || ""
    };
  }
  const selection = window.getSelection?.();
  const anchorElement =
    selection?.anchorNode?.nodeType === Node.ELEMENT_NODE
      ? selection.anchorNode
      : selection?.anchorNode?.parentElement;
  const block = anchorElement?.closest?.("[contenteditable='true']");
  const preview = el["workspace-preview"];
  if (block && preview?.contains(block)) {
    const blocks = Array.from(
      preview.querySelectorAll(".workspace-document-page-sheet [contenteditable='true']")
    );
    return {
      type: "text",
      blockIndex: blocks.indexOf(block),
      startOffset: Number(selection?.anchorOffset || 0),
      endOffset: Number(selection?.focusOffset || selection?.anchorOffset || 0),
      quote: String(selection?.toString?.() || "").slice(0, 240)
    };
  }
  return null;
}

function renderRemoteWorkspacePresence() {
  const preview = el["workspace-preview"];
  if (!preview) return;
  preview
    .querySelectorAll(".workspace-remote-presence")
    .forEach((node) => node.remove());
  preview
    .querySelectorAll(".has-remote-collaborator")
    .forEach((node) => node.classList.remove("has-remote-collaborator"));
  preview
    .querySelectorAll(".workspace-remote-presence-host")
    .forEach((node) => node.classList.remove("workspace-remote-presence-host"));
  state.workspacePresence
    .filter(
      (presence) =>
        Number(presence.userId) !== Number(state.currentUserId) &&
        (!presence.entryPath || presence.entryPath === state.currentWorkObjectFile)
    )
    .forEach((presence, index) => {
      const cursor = presence.cursor || {};
      let target = null;
      let badgeHost = null;
      if (cursor.type === "cell" && cursor.cell) {
        target = preview.querySelector(
          `[data-sheet-grid-cell="${CSS.escape(String(cursor.cell))}"]`
        );
        badgeHost = target?.closest?.("td") || target?.parentElement || target;
      } else if (cursor.type === "text" && Number(cursor.blockIndex) >= 0) {
        target = Array.from(
          preview.querySelectorAll(
            ".workspace-document-page-sheet [contenteditable='true']"
          )
        )[Number(cursor.blockIndex)] || null;
        badgeHost = target?.parentElement || target;
      }
      if (!target || !badgeHost) return;
      target.classList.add("has-remote-collaborator");
      badgeHost.classList.add("workspace-remote-presence-host");
      const badge = document.createElement("span");
      badge.className = "workspace-remote-presence";
      badge.style.setProperty("--presence-index", String(index));
      badge.textContent = presence.name || `User ${presence.userId || ""}`;
      badgeHost.appendChild(badge);
    });
}

function scheduleWorkspaceCursorPresence() {
  if (!state.currentWorkObjectId || state.offline) return;
  if (workspaceCursorHandle) window.clearTimeout(workspaceCursorHandle);
  workspaceCursorHandle = window.setTimeout(() => {
    workspaceCursorHandle = null;
    sendWorkObjectPresence().catch(() => {});
  }, 240);
}

async function sendWorkObjectPresence() {
  if (!state.currentWorkObjectId || !state.currentUserId || state.offline) {
    return;
  }
  const payload = await apiClient.touchWorkObjectPresence(state.currentWorkObjectId, {
    userId: state.currentUserId,
    name: currentUserDisplayName(),
    entryPath: state.currentWorkObjectFile,
    cursor: captureWorkspaceCursor()
  });
  state.workspacePresence = payload.presence || [];
  renderRemoteWorkspacePresence();
}

function startWorkObjectCollaboration(workObject = {}) {
  stopWorkObjectCollaboration();
  if (!workObject.id || !state.currentUserId) {
    return;
  }

  const selectedId = String(workObject.id);
  sendWorkObjectPresence().catch(() => {});
  workspacePresenceHandle = window.setInterval(() => {
    if (String(state.currentWorkObjectId) === selectedId) {
      sendWorkObjectPresence().catch(() => {});
    }
  }, 10_000);

  workspaceEventSource = new EventSource(`/api/work-objects/${encodeURIComponent(selectedId)}/events`);
  workspaceEventSource.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data || "{}");
      if (payload.type === "presence") {
        state.workspacePresence = payload.presence || [];
        renderRemoteWorkspacePresence();
        return;
      }
      if (
        payload.type === "operation" &&
        payload.entryPath === state.currentWorkObjectFile
      ) {
        state.collaborationVersion = Math.max(
          state.collaborationVersion,
          Number(payload.version || 0)
        );
        state.collaborationServerContent = String(
          payload.content ?? state.collaborationServerContent
        );
        if (
          String(payload.operation?.clientId || "") ===
          String(state.collaborationClientId)
        ) {
          return;
        }
        state.collaborationApplyingRemote = true;
        try {
          const currentDraft = currentDraftContent();
          const nextDraft = applyCollaborationOperation(
            currentDraft,
            payload.operation || {}
          );
          const nextBaseline = applyCollaborationOperation(
            currentContent(),
            payload.operation || {}
          );
          updateCollaborativeWorkObjectContent(nextBaseline);
          state.editorDraft = nextDraft;
          state.editorDraftKey = currentEditorKey();
          state.editorDirty = nextDraft !== nextBaseline;
          if (el["work-object-editor"]) {
            el["work-object-editor"].value = nextDraft;
          }
          syncWorkspaceSlices();
          refreshPreviewPane();
          setStatus(`${payload.operation?.actorUserId ? "Un collaborateur" : "Hydria"} a modifie le document.`);
        } finally {
          state.collaborationApplyingRemote = false;
        }
        return;
      }
      if (payload.type === "collaboration_conflict") {
        state.workspaceRemoteRevision = Number(payload.revision || 0) || null;
        persistLocalWorkspaceDraft();
        setStatus("Conflit de synchronisation : le brouillon local est conserve.");
        return;
      }
      if (
        payload.type === "content" &&
        payload.source === "collaboration" &&
        payload.entryPath === state.currentWorkObjectFile
      ) {
        state.collaborationPersistedRevision = Number(
          payload.revision || state.collaborationPersistedRevision
        );
        updateCollaborativeWorkObjectContent(
          state.collaborationServerContent || currentDraftContent(),
          state.collaborationPersistedRevision
        );
        if (
          state.editorDirty &&
          currentDraftContent() === state.collaborationServerContent &&
          !collaborationPendingChange
        ) {
          state.editorDirty = false;
          state.editorDraft = "";
          state.editorDraftKey = "";
          localStorage.removeItem(localDraftStorageKey());
        }
        renderWorkObjects();
        renderRemoteWorkspacePresence();
        return;
      }
      if (
        payload.type !== "content" ||
        Number(payload.actorUserId) === Number(state.currentUserId) ||
        Number(payload.revision || 0) <= Number(state.currentWorkObject?.revision || 0)
      ) {
        return;
      }
      state.workspaceRemoteRevision = Number(payload.revision);
      if (state.editorDirty) {
        persistLocalWorkspaceDraft();
        setStatus("Une version distante plus recente existe. Votre brouillon local est conserve.");
        return;
      }
      selectWorkObject(selectedId, state.currentWorkObjectFile, {
        preserveMode: true,
        preserveSurface: true,
        preserveDimension: true,
        syncRoute: false
      }).catch(handleError);
    } catch {
      // Ignore malformed collaboration events.
    }
  };
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
  if (isSheetWorkObject(workObject) || isDocumentWorkObject(workObject)) {
    reopenSheetDocument(workObject.id);
  }
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
    setWorkspaceMode((workObject?.objectKind || workObject?.kind) === "presentation" ? "edit" : "view");
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
  state.collaborationVersion = 0;
  state.collaborationPersistedRevision = Number(workObject.revision || 1);
  state.collaborationServerContent = String(
    workObject?.file?.content || workObject?.content || ""
  );
  state.sheetCalculation = null;
  state.sheetCalculationEngineId = "";
  await hydrateWorkObjectCollaboration().catch((error) => {
    if (Number(error?.status || 0) !== 403) throw error;
  });
  syncWorkspaceSlices();
  restoreLocalWorkspaceDraft();
  if (isSheetWorkObject(workObject)) {
    scheduleSheetCalculation(deriveSpreadsheetDraft(currentDraftContent()));
  }

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

  if (options.syncRoute !== false && !state.routeHydrating) {
    const page = workspacePageForWorkObject(workObject);
    if (page) {
      setWorkspacePage(page, {
        historyMode: options.routeHistoryMode || "push"
      });
    }
  }

  if (workObject.surfaceModel?.runtimeCapable) {
    await ensureRuntimeSessionForWorkObject(workObject);
  }

  mergeWorkObject(workObject);
  startWorkObjectCollaboration(workObject);
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

  if (usesCollaborativeEditing()) {
    state.autoSaving = true;
    if (el["workspace-save-button"]) {
      el["workspace-save-button"].disabled = true;
      el["workspace-save-button"].textContent = "Saving...";
    }
    try {
      await flushCollaborativeOperation();
      if (state.offline || !navigator.onLine) {
        persistLocalWorkspaceDraft();
        setStatus(
          `Mode hors ligne : ${state.collaborationQueueSize} modification(s) en attente.`
        );
        return;
      }
      const payload = await apiClient.flushWorkObjectCollaboration(
        state.currentWorkObjectId,
        { entryPath: state.currentWorkObjectFile }
      );
      const collaboration = payload.collaboration || {};
      state.collaborationVersion = Number(
        collaboration.version || state.collaborationVersion
      );
      state.collaborationPersistedRevision = Number(
        collaboration.persistedRevision ||
          collaboration.workObject?.revision ||
          state.collaborationPersistedRevision
      );
      const serverContent = String(
        state.collaborationServerContent || nextContent
      );
      const draftChangedSinceSaveStarted =
        state.editorDraftKey === editorKeyAtStart &&
        normalizeEditorText(state.editorDraft) !== normalizedEditorValue;
      updateCollaborativeWorkObjectContent(
        serverContent,
        state.collaborationPersistedRevision
      );
      if (!draftChangedSinceSaveStarted) {
        state.editorDirty = false;
        state.editorDraft = "";
        state.editorDraftKey = "";
        localStorage.removeItem(localDraftStorageKey());
        if (el["work-object-editor"]) {
          el["work-object-editor"].value = serverContent;
        }
      }
      syncWorkspaceSlices();
      renderWorkObjects();
      if (!keepInlinePreviewSession) renderWorkspace();
      if (!silent) {
        setStatus(`Saved ${currentScopeLabel().toLowerCase()} in ${state.currentWorkObject.title}.`);
      }
      return;
    } finally {
      state.autoSaving = false;
      if (el["workspace-save-button"]) {
        el["workspace-save-button"].disabled = !state.editorDirty;
        el["workspace-save-button"].textContent = state.editorDirty ? "Save" : "Saved";
      }
    }
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
      nextContent,
      {
        userId: state.currentUserId,
        expectedRevision: state.currentWorkObject?.revision
      }
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
      localStorage.removeItem(localDraftStorageKey());
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
  } catch (error) {
    if (error?.status === 409) {
      persistLocalWorkspaceDraft();
      state.workspaceRemoteRevision = error.details?.currentRevision || null;
      setStatus("Conflit detecte : le brouillon local est conserve. Rechargez le document pour comparer.");
      if (
        window.confirm(
          "Ce document a ete modifie ailleurs. Recharger la version distante ? Votre brouillon local restera stocke."
        )
      ) {
        await selectWorkObject(state.currentWorkObjectId, state.currentWorkObjectFile, {
          preserveMode: true,
          preserveSurface: true,
          preserveDimension: true,
          syncRoute: false
        });
      }
      return;
    }
    if (!navigator.onLine) {
      state.offline = true;
      persistLocalWorkspaceDraft();
      setStatus("Connexion indisponible. Le brouillon est conserve localement.");
      return;
    }
    throw error;
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

function hydriaExternalControlReady() {
  const external = state.config?.config?.hydriaExternal;
  return Boolean(external?.configured && external?.controlEnabled);
}

function shouldUseExternalHydriaControl({ attachments = [] } = {}) {
  return hydriaExternalControlReady() && !attachments.length;
}

function controlPayloadWorkObjects(payload = {}) {
  const results = payload.execution?.results || [];
  return results
    .flatMap((result) => [result.workObject, ...(result.workObjects || [])])
    .filter((workObject) => workObject?.id);
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

async function applyHydriaControlPayload(payload = {}) {
  const workObjects = controlPayloadWorkObjects(payload);
  const workspaceToolResults = payload.workspaceToolResults || payload.execution?.workspaceToolResults || [];
  const completedWorkspaceToolResult = workspaceToolResults.find((result) => result?.status === "completed");
  const pendingWorkspaceToolResult = workspaceToolResults.find((result) => result?.status === "needs_confirmation");
  updateLastRun({
    strategy: "hydria-core-control",
    modelsUsed: [payload.control?.source === "public_api_v1" ? "Hydria Core API v1" : "Hydria Core"],
    meta: {
      externalHydriaControl: true,
      executed: payload.execution?.executed || 0,
      proposedActions: payload.proposedActions?.length || payload.control?.proposedActions?.length || 0,
      workspaceToolCalls: payload.workspaceToolCalls?.length || payload.control?.workspaceToolCalls?.length || 0
    }
  });
  setStatus(
    completedWorkspaceToolResult?.finalAnswer ||
      pendingWorkspaceToolResult?.issues?.[0] ||
      payload.control?.reply ||
      "Hydria Core a pilote Hydria OS."
  );
  if (workspaceToolResults.some((result) => result?.status === "completed" && result?.engine === "crm")) {
    document
      .querySelector(".workspace-crm-live-frame")
      ?.contentWindow?.postMessage({ type: "hydria-crm-refresh" }, "*");
  }

  await loadMessages();
  await loadProjects();
  await loadWorkObjects();

  if (state.currentProjectId) {
    const workspacePayload = await apiClient.getProjectWorkspace(
      state.currentProjectId,
      state.currentUserId,
      state.currentConversationId
    );
    state.currentWorkspace = workspacePayload.workspace || state.currentWorkspace;
  }

  if (workObjects.length) {
    const newest = workObjects[0];
    mergeWorkObject(newest);
    await selectWorkObject(newest.id, preferredOpenPath(newest), {
      syncProject: true
    });
    return;
  }

  renderWorkObjects();
  renderWorkspace();
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
    if (shouldUseExternalHydriaControl({ attachments })) {
      try {
        const controlPayload = await apiClient.runHydriaControl({
          userId: state.currentUserId,
          conversationId: state.currentConversationId,
          projectId: state.currentProjectId || "",
          prompt,
          workObjectId,
          entryPath: workObjectPath,
          workspaceFamilyId: currentWorkspaceFamilyId(),
          execute: true
        });

        if (
          controlPayload.control?.used &&
          ((controlPayload.execution?.executed || 0) > 0 || controlPayload.control?.reply)
        ) {
          if (!preserveComposer) {
            el["prompt-input"].value = "";
            el["attachment-input"].value = "";
            state.pendingAttachments = [];
            renderPendingAttachments();
          }

          await applyHydriaControlPayload(controlPayload);
          return controlPayload;
        }
      } catch (error) {
        console.warn("Hydria Core control fallback to local chat", error);
      }
    }

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
  const payload = await apiClient.createConversation(state.currentUserId, title, {
    projectId: state.currentChatProjectId,
    folder: state.currentConversationFolder
  });
  state.conversations.unshift(payload.conversation);
  await loadChatWorkspaceData();
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
  state.coreChatAttachments = [];
  state.coreChatPendingMessages = [];
  await loadMessages();
  setStatus("Conversation cleared.");
}

function handleError(error) {
  console.error(error);
  setStatus(error.message || "Unexpected error");
}

function bindEvents() {
  window.addEventListener("pagehide", () => {
    clearAutoSaveTimer();
  });

  window.addEventListener("popstate", () => {
    const page = parseWorkspacePagePath();
    activateWorkspacePage(page, { historyMode: "none" }).catch(handleError);
  });

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

  document.addEventListener("click", (event) => {
    const menu = document.getElementById("workspace-sheet-document-menu");
    if (menu && !menu.hidden && !menu.contains(event.target)) {
      hideWorkspaceSheetDocumentMenu();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      hideWorkspaceSheetDocumentMenu();
      if (state.workspacePreviewExpanded) {
        setWorkspacePreviewExpanded(false);
      }
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
  document.addEventListener("selectionchange", scheduleWorkspaceCursorPresence);
  el["workspace-preview"]?.addEventListener("focusin", scheduleWorkspaceCursorPresence);

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
  setWorkspacePage(initialWorkspacePage, { historyMode: "none" });
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
  if (configPayload?.config?.crm?.webUrl) {
    window.HYDRIA_CRM_URL = configPayload.config.crm.webUrl;
  }
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

  state.routeHydrating = false;
  await activateWorkspacePage(initialWorkspacePage, {
    historyMode: "replace"
  });
}

window.addEventListener("offline", () => {
  state.offline = true;
  persistLocalWorkspaceDraft();
  renderWorkspace();
  setStatus("Mode hors ligne : les changements restent dans ce navigateur.");
});

window.addEventListener("online", async () => {
  state.offline = false;
  renderWorkspace();
  try {
    const replay = await replayCollaborationOperations(
      sendQueuedCollaborationOperation
    );
    state.collaborationQueueSize = replay.remaining;
    await sendWorkObjectPresence();
    if (state.editorDirty) {
      await saveWorkObjectChanges({ silent: true, source: "reconnect" });
    } else {
      setStatus(
        replay.sent
          ? `Connexion retablie. ${replay.sent} modification(s) synchronisee(s).`
          : "Connexion retablie."
      );
    }
  } catch (error) {
    handleError(error);
  }
});

window.addEventListener("beforeunload", () => {
  clearAutoSaveTimer();
  clearRuntimeSyncTimer();
  if (state.liveDraftRefreshHandle) {
    window.clearTimeout(state.liveDraftRefreshHandle);
    state.liveDraftRefreshHandle = null;
  }
  persistLocalWorkspaceDraft();
  if (state.currentWorkObjectId && state.currentUserId) {
    fetch(`/api/work-objects/${encodeURIComponent(state.currentWorkObjectId)}/presence`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: state.currentUserId }),
      keepalive: true
    }).catch(() => {});
  }
});

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


