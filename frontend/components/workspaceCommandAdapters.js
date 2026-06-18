import { createWorkspaceCommandDispatcher } from "./workspaceCommandRegistry.js";

// Shared commands stop here: adapters translate the same visible command
// into the engine-specific operation. Docs edits HTML/contenteditable nodes,
// while Sheets edits the spreadsheet cell model.
const callWorkspaceOperation = (operations = {}, name = "", ...args) => {
  const operation = operations[name];
  if (typeof operation !== "function") {
    return undefined;
  }
  return operation(...args);
};

export function createWorkspaceCommandExecutor(target = "", adapter = {}) {
  const dispatch = createWorkspaceCommandDispatcher({ [target]: adapter });
  return (commandId = "", options = {}) => dispatch(commandId, { target, ...options });
}

export function createDocsWorkspaceCommandAdapter(operations = {}) {
  const call = (name = "", ...args) => callWorkspaceOperation(operations, name, ...args);

  // Keep Docs behavior isolated from Sheets. New shared menu commands should
  // land here only when they have a real HTML/contenteditable implementation.
  return {
    bold: (_command, { fromContextMenu = false } = {}) => {
      const fallback = () => call("toggleActiveBlockStyle", "fontWeight", "700", "");
      if (fromContextMenu) {
        call("runInlineCommandFromContextMenu", "bold", fallback);
        return;
      }
      call("runInlineCommand", "bold");
    },
    italic: (_command, { fromContextMenu = false } = {}) => {
      const fallback = () => call("toggleActiveBlockStyle", "fontStyle", "italic", "");
      if (fromContextMenu) {
        call("runInlineCommandFromContextMenu", "italic", fallback);
        return;
      }
      call("runInlineCommand", "italic");
    },
    underline: (_command, { fromContextMenu = false } = {}) => {
      if (fromContextMenu) {
        call("runInlineCommandFromContextMenu", "underline", () => call("toggleActiveBlockUnderline"));
        return;
      }
      call("runInlineCommand", "underline");
    },
    strikethrough: () => {
      call("runInlineCommandWithSelection", "strikeThrough", null, () => call("toggleActiveBlockStrikethrough"), "Strikethrough updated");
    },
    fontSize: (_command, { value = "" } = {}) => {
      call("applyBlockFontSize", value);
    },
    fontFamily: (_command, { value = "" } = {}) => {
      call("applyBlockFontFamily", value);
    },
    textColor: (_command, { value = "" } = {}) => {
      if (value) {
        call("runInlineCommandWithSelection", "foreColor", value, () => call("applyBlockTextColor", value), "Text color updated");
        return;
      }
      call("applyBlockTextColor", "");
    },
    highlightColor: (_command, { value = "" } = {}) => {
      if (value) {
        call("runInlineCommandWithSelection", "hiliteColor", value, () => call("applyBlockHighlightColor", value), "Highlight updated");
        return;
      }
      call("applyBlockHighlightColor", "");
    },
    alignLeft: () => call("applyBlockAlignment", "left"),
    alignCenter: () => call("applyBlockAlignment", "center"),
    alignRight: () => call("applyBlockAlignment", "right"),
    alignJustify: () => call("applyBlockAlignment", "justify"),
    clearFormatting: () => {
      call("runInlineCommandWithSelection", "removeFormat", null, () => call("resetActiveBlockFormatting"), "Formatting reset");
    }
  };
}

export function createSheetWorkspaceCommandAdapter(operations = {}) {
  const call = (name = "", ...args) => callWorkspaceOperation(operations, name, ...args);

  // Sheets commands operate on selected cells/ranges. They can share labels,
  // icons and shortcuts with Docs, but must preserve the cell-model semantics.
  return {
    bold: () => call("toggleSelectedTextStyle", "bold"),
    italic: () => call("toggleSelectedTextStyle", "italic"),
    underline: () => call("toggleSelectedTextStyle", "underline"),
    fontSize: (_command, { value = null, delta = null } = {}) => {
      const numericDelta = Number(delta);
      if (Number.isFinite(numericDelta) && numericDelta !== 0) {
        call("adjustSelectedFontSize", numericDelta);
        return;
      }
      const numericValue = Number(value);
      if (Number.isFinite(numericValue)) {
        call("setSelectedFontSize", numericValue);
      }
    },
    fontFamily: (_command, { value = "" } = {}) => call("setSelectedFontFamily", value),
    textColor: (_command, { value = "" } = {}) => call("setSelectedTextColor", value),
    fillColor: (_command, { value = "" } = {}) => call("setSelectedFillColor", value),
    alignLeft: () => call("setSelectedHorizontalAlign", "left"),
    alignCenter: () => call("setSelectedHorizontalAlign", "center"),
    alignRight: () => call("setSelectedHorizontalAlign", "right"),
    alignTop: () => call("setSelectedVerticalAlign", "top"),
    alignMiddle: () => call("setSelectedVerticalAlign", "middle"),
    alignBottom: () => call("setSelectedVerticalAlign", "bottom"),
    clearFormatting: () => call("clearSelectedFormatting")
  };
}

export function createDashboardWorkspaceCommandAdapter(operations = {}) {
  const call = (name = "", ...args) => callWorkspaceOperation(operations, name, ...args);

  // Dashboard is the first Power BI-style surface. Keep its visible commands
  // shared, but let the dashboard model decide how KPIs, visuals and slicers
  // are stored and refreshed.
  return {
    dashboardAddMetric: () => call("addMetric"),
    dashboardAddChart: (_command, { value = "line" } = {}) => call("addChart", value || "line"),
    dashboardAddFilter: () => call("addFilter"),
    dashboardAddTableRow: () => call("addTableRow"),
    dashboardAddTableColumn: () => call("addTableColumn"),
    dashboardRemoveMetric: () => call("removeMetric"),
    dashboardRemoveChart: () => call("removeChart"),
    dashboardMoveWidgetLeft: () => call("moveWidget", -1),
    dashboardMoveWidgetRight: () => call("moveWidget", 1),
    dashboardRefresh: () => call("refresh")
  };
}

export function createPresentationWorkspaceCommandAdapter(operations = {}) {
  const call = (name = "", ...args) => callWorkspaceOperation(operations, name, ...args);

  // Slides shares the command dispatcher with Docs, Sheets and Dashboard, but
  // keeps deck-specific mutations in the presentation model.
  return {
    slideAdd: () => call("addSlide"),
    slideDuplicate: () => call("duplicateSlide"),
    slideDelete: () => call("deleteSlide"),
    slideMoveLeft: () => call("moveSlide", -1),
    slideMoveRight: () => call("moveSlide", 1),
    slideLayout: (_command, { value = "" } = {}) => call("setLayout", value),
    slideTheme: (_command, { value = "" } = {}) => call("setTheme", value)
  };
}
