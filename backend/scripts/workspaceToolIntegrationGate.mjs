import assert from "node:assert/strict";
import { executeWorkspaceToolCalls } from "../services/hydria/workspaceToolDispatcher.js";

const sheetContent = JSON.stringify(
  {
    kind: "hydria-sheet",
    version: 1,
    activeSheetId: "sheet-1",
    namedRanges: [],
    sheets: [
      {
        id: "sheet-1",
        name: "Sheet 1",
        columns: ["Prix", "Quantite"],
        rows: [["10", "2"]],
        columnWidths: {},
        rowHeights: {},
        merges: [],
        cellFormats: {},
        cellNotes: {},
        dataValidations: [],
        conditionalFormats: [],
        tables: [],
        pivotTables: [],
        charts: [],
        sparklines: {},
        slicers: [],
        filterQuery: "",
        filterColumnIndex: -1,
        tableFilters: {},
        sort: null,
        hidden: false,
        protected: false,
        protectedRanges: [],
        zoomLevel: 1,
        showGridlines: true,
        frozenRows: 0,
        frozenColumns: 0
      }
    ]
  },
  null,
  2
);

const state = {
  content: sheetContent,
  revision: 1,
  history: []
};

const workObjectService = {
  readContent() {
    return {
      workObject: {
        id: "gate-sheet-1",
        title: "Workspace Tool Gate Sheet",
        userId: 42,
        kind: "dataset",
        metadata: {
          workspaceFamilyId: "data_spreadsheet"
        },
        revision: state.revision,
        history: state.history
      },
      entryPath: "table.csv",
      content: state.content
    };
  },
  async updateContent({ content, note, actor }) {
    state.content = content;
    state.revision += 1;
    state.history.push({
      type: "content_update",
      actor,
      entryPath: "table.csv",
      note
    });
    return {
      id: "gate-sheet-1",
      title: "Workspace Tool Gate Sheet",
      userId: 42,
      kind: "dataset",
      revision: state.revision,
      history: state.history,
      primaryFile: "table.csv",
      file: {
        path: "table.csv",
        content
      },
      workspaceFamilyId: "data_spreadsheet"
    };
  }
};

const coreResponse = {
  proposedActions: [
    {
      id: "core-action-1",
      type: "workspace_tool_call",
      title: "Add calculated total",
      target: {
        workObjectId: "gate-sheet-1",
        entryPath: "table.csv"
      },
      payload: {
        toolName: "sheet.apply_formula",
        operations: [
          {
            type: "sheet.add_column",
            columnName: "Total",
            formula: "=A2*B2",
            target: {
              columnName: "Total",
              rowIndex: 0
            }
          }
        ]
      },
      riskLevel: "low",
      requiresConfirmation: false
    },
    {
      type: "create_artifact",
      title: "Should not be executed"
    }
  ]
};

const execution = await executeWorkspaceToolCalls({
  proposedActions: coreResponse.proposedActions,
  userId: 42,
  prompt: "Ajoute une colonne Total avec =A2*B2.",
  workObjectService
});

assert.equal(execution.executed, 1);
assert.equal(execution.results.length, 1);
assert.equal(execution.results[0].status, "completed");
assert.deepEqual(execution.results[0].operationsApplied, ["sheet.add_column"]);

const model = JSON.parse(state.content);
assert.deepEqual(model.sheets[0].columns, ["Prix", "Quantite", "Total"]);
assert.equal(model.sheets[0].rows[0][2], "=A2*B2");
assert.equal(state.revision, 2);
assert.equal(state.history.length, 1);
assert.equal(state.history[0].actor, "hydria_core_api");
assert.match(state.history[0].note, /workspace_tool_call/);
assert.match(state.history[0].note, /applied=sheet\.add_column/);
assert.equal(execution.results[0].trace.action.operations[0].type, "sheet.add_column");

const noOp = await executeWorkspaceToolCalls({
  proposedActions: [],
  userId: 42,
  prompt: "Ne fais rien.",
  workObjectService
});
assert.equal(noOp.executed, 0);
assert.deepEqual(noOp.results, []);

console.log("workspaceToolIntegrationGate ok");
