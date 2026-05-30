import assert from "node:assert/strict";
import {
  applyHydriaDocumentToolOperationsToContent,
  applyHydriaSlideToolOperationsToContent,
  applyHydriaWorkspaceToolOperationsToContent,
  buildWorkspaceContextFields,
  executeWorkspaceToolCalls,
  listWorkspaceToolsForWorkObject,
  normalizeWorkspaceToolCallsFromCore,
  synthesizeWorkspaceToolCallsFromPrompt
} from "../services/hydria/workspaceToolDispatcher.js";

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
        dataValidations: {},
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

const quantityPriceSheetContent = JSON.stringify(
  {
    kind: "hydria-sheet",
    version: 1,
    activeSheetId: "sheet-1",
    namedRanges: [],
    sheets: [
      {
        id: "sheet-1",
        name: "Sheet 1",
        columns: ["nb de crayon", "prix", "Column 3"],
        rows: [["10", "0.5", ""]],
        columnWidths: {},
        rowHeights: {},
        merges: [],
        cellFormats: {},
        cellNotes: {},
        dataValidations: {},
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

const coreResult = {
  proposedActions: [
    {
      id: "action-1",
      type: "workspace_tool_call",
      title: "Add total column",
      target: {
        workObjectId: "sheet-1",
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
      }
    }
  ]
};

const calls = normalizeWorkspaceToolCallsFromCore(coreResult);
assert.equal(calls.length, 1);
assert.equal(calls[0].payload.toolName, "sheet.apply_formula");
assert.equal(calls[0].payload.operations[0].type, "sheet.add_column");

let applied = applyHydriaWorkspaceToolOperationsToContent(
  sheetContent,
  calls[0].payload.operations
);
assert.deepEqual(applied.applied, ["sheet.add_column"]);

let model = JSON.parse(applied.content);
assert.deepEqual(model.sheets[0].columns, ["Prix", "Quantite", "Total"]);
assert.equal(model.sheets[0].rows[0][2], "=A2*B2");

applied = applyHydriaWorkspaceToolOperationsToContent(applied.content, [
  {
    type: "sheet.set_formula",
    target: {
      cell: "C2"
    },
    formula: "A2+B2"
  },
  {
    type: "sheet.set_cell",
    target: {
      cell: "D2"
    },
    value: "Valide"
  }
]);
assert.deepEqual(applied.applied, ["sheet.set_formula", "sheet.set_cell"]);

model = JSON.parse(applied.content);
assert.equal(model.sheets[0].rows[0][2], "=A2+B2");
assert.equal(model.sheets[0].columns[3], "Column 4");
assert.equal(model.sheets[0].rows[0][3], "Valide");

const synthesizedSheetCalls = synthesizeWorkspaceToolCallsFromPrompt({
  prompt: "fais la somme en C",
  activeWorkObject: {
    id: "sheet-1",
    kind: "dataset",
    workspaceFamilyId: "data_spreadsheet",
    primaryFile: "table.csv"
  },
  activeWorkObjectContent: sheetContent
});
assert.equal(synthesizedSheetCalls.length, 1);
assert.equal(synthesizedSheetCalls[0].payload.toolName, "sheet.apply_formula");
assert.equal(synthesizedSheetCalls[0].payload.operations.length, 2);
assert.equal(synthesizedSheetCalls[0].payload.operations[0].type, "sheet.add_column");
assert.equal(synthesizedSheetCalls[0].payload.operations[0].columnName, "Somme");
assert.equal(synthesizedSheetCalls[0].payload.operations[0].target.columnIndex, 2);
assert.equal(synthesizedSheetCalls[0].payload.operations[1].type, "sheet.set_formula");
assert.equal(synthesizedSheetCalls[0].payload.operations[1].target.cell, "C2");
assert.equal(synthesizedSheetCalls[0].payload.operations[1].formula, "=A2+B2");

applied = applyHydriaWorkspaceToolOperationsToContent(
  sheetContent,
  synthesizedSheetCalls[0].payload.operations
);
model = JSON.parse(applied.content);
assert.deepEqual(applied.applied, ["sheet.add_column", "sheet.set_formula"]);
assert.equal(model.sheets[0].columns[2], "Somme");
assert.equal(model.sheets[0].rows[0][2], "=A2+B2");

const totalSheetContent = JSON.stringify(
  {
    kind: "hydria-sheet",
    version: 1,
    activeSheetId: "sheet-1",
    sheets: [
      {
        id: "sheet-1",
        name: "Sheet 1",
        columns: ["nb de crayon", "prix"],
        rows: [["10", "0.5"]]
      }
    ]
  },
  null,
  2
);
const totalSheetCalls = synthesizeWorkspaceToolCallsFromPrompt({
  prompt: "fais le total en C",
  activeWorkObject: {
    id: "sheet-1",
    kind: "dataset",
    workspaceFamilyId: "data_spreadsheet",
    primaryFile: "table.csv"
  },
  activeWorkObjectContent: totalSheetContent
});
assert.equal(totalSheetCalls[0].payload.operations[0].type, "sheet.add_column");
assert.equal(totalSheetCalls[0].payload.operations[0].columnName, "Total");
assert.equal(totalSheetCalls[0].payload.operations[1].type, "sheet.set_formula");
assert.equal(totalSheetCalls[0].payload.operations[1].formula, "=A2*B2");

const inferredTotalCalls = synthesizeWorkspaceToolCallsFromPrompt({
  prompt: "fais le total",
  activeWorkObject: {
    id: "sheet-1",
    kind: "dataset",
    workspaceFamilyId: "data_spreadsheet",
    primaryFile: "table.csv"
  },
  activeWorkObjectContent: quantityPriceSheetContent
});
assert.equal(inferredTotalCalls.length, 1);
assert.equal(inferredTotalCalls[0].payload.toolName, "sheet.apply_formula");
assert.equal(inferredTotalCalls[0].payload.operations.length, 2);
assert.equal(inferredTotalCalls[0].payload.operations[0].type, "sheet.add_column");
assert.equal(inferredTotalCalls[0].payload.operations[0].columnName, "Total");
assert.equal(inferredTotalCalls[0].payload.operations[0].target.columnIndex, 2);
assert.equal(inferredTotalCalls[0].payload.operations[1].type, "sheet.set_formula");
assert.equal(inferredTotalCalls[0].payload.operations[1].formula, "=A2*B2");

applied = applyHydriaWorkspaceToolOperationsToContent(
  quantityPriceSheetContent,
  inferredTotalCalls[0].payload.operations
);
model = JSON.parse(applied.content);
assert.deepEqual(applied.applied, ["sheet.add_column", "sheet.set_formula"]);
assert.equal(model.sheets[0].columns[2], "Total");
assert.equal(model.sheets[0].rows[0][2], "=A2*B2");

const previousWrongTotalContent = JSON.stringify(
  {
    kind: "hydria-sheet",
    version: 1,
    activeSheetId: "sheet-1",
    sheets: [
      {
        id: "sheet-1",
        name: "Sheet 1",
        columns: ["nb de crayon", "prix", "Column 3"],
        rows: [["10", "0.5", "=A2+B2"]]
      }
    ]
  },
  null,
  2
);
const correctedTotalCalls = synthesizeWorkspaceToolCallsFromPrompt({
  prompt: "fais le total",
  activeWorkObject: {
    id: "sheet-1",
    kind: "dataset",
    workspaceFamilyId: "data_spreadsheet",
    primaryFile: "table.csv"
  },
  activeWorkObjectContent: previousWrongTotalContent
});
assert.equal(correctedTotalCalls.length, 1);
assert.equal(correctedTotalCalls[0].payload.operations[0].target.columnIndex, 2);
assert.equal(correctedTotalCalls[0].payload.operations[1].target.cell, "C2");
assert.equal(correctedTotalCalls[0].payload.operations[1].formula, "=A2*B2");

applied = applyHydriaWorkspaceToolOperationsToContent(
  previousWrongTotalContent,
  correctedTotalCalls[0].payload.operations
);
model = JSON.parse(applied.content);
assert.equal(model.sheets[0].columns[2], "Total");
assert.equal(model.sheets[0].rows[0][2], "=A2*B2");

const amountSheetContent = JSON.stringify(
  {
    kind: "hydria-sheet",
    version: 1,
    activeSheetId: "sheet-1",
    sheets: [
      {
        id: "sheet-1",
        name: "Sheet 1",
        columns: ["Article", "Quantite", "Prix unitaire", "Montant"],
        rows: [["Stylo", "3", "1.5", ""]]
      }
    ]
  },
  null,
  2
);
const amountCalls = synthesizeWorkspaceToolCallsFromPrompt({
  prompt: "complete le montant",
  activeWorkObject: {
    id: "sheet-1",
    kind: "dataset",
    workspaceFamilyId: "data_spreadsheet",
    primaryFile: "table.csv"
  },
  activeWorkObjectContent: amountSheetContent
});
assert.equal(amountCalls.length, 1);
assert.equal(amountCalls[0].payload.operations.length, 1);
assert.equal(amountCalls[0].payload.operations[0].target.cell, "D2");
assert.equal(amountCalls[0].payload.operations[0].formula, "=B2*C2");

const multiQuantitySheetContent = JSON.stringify(
  {
    kind: "hydria-sheet",
    version: 1,
    activeSheetId: "sheet-1",
    sheets: [
      {
        id: "sheet-1",
        name: "Sheet 1",
        columns: ["nb de crayon gris", "nb de crayon rouge", "prix", "Total"],
        rows: [["10", "10", "0.5", "5"]]
      }
    ]
  },
  null,
  2
);
const multiQuantityCalls = synthesizeWorkspaceToolCallsFromPrompt({
  prompt: "fais le total",
  activeWorkObject: {
    id: "sheet-1",
    kind: "dataset",
    workspaceFamilyId: "data_spreadsheet",
    primaryFile: "table.csv"
  },
  activeWorkObjectContent: multiQuantitySheetContent
});
assert.equal(multiQuantityCalls.length, 1);
assert.equal(multiQuantityCalls[0].payload.operations.length, 1);
assert.equal(multiQuantityCalls[0].payload.operations[0].target.cell, "D2");
assert.equal(multiQuantityCalls[0].payload.operations[0].formula, "=SOMME(A2:B2)*C2");

applied = applyHydriaWorkspaceToolOperationsToContent(
  multiQuantitySheetContent,
  multiQuantityCalls[0].payload.operations
);
model = JSON.parse(applied.content);
assert.deepEqual(applied.applied, ["sheet.set_formula"]);
assert.equal(model.sheets[0].rows[0][3], "=SOMME(A2:B2)*C2");

for (const prompt of ["corrige le total", "mets le bon total", "corrige le calcul"]) {
  const correctionCalls = synthesizeWorkspaceToolCallsFromPrompt({
    prompt,
    activeWorkObject: {
      id: "sheet-1",
      kind: "dataset",
      workspaceFamilyId: "data_spreadsheet",
      primaryFile: "table.csv"
    },
    activeWorkObjectContent: multiQuantitySheetContent
  });
  assert.equal(correctionCalls.length, 1, `${prompt} should produce one workspace call`);
  assert.equal(correctionCalls[0].payload.operations.length, 1, `${prompt} should update the existing total column`);
  assert.equal(correctionCalls[0].payload.operations[0].target.cell, "D2");
  assert.equal(correctionCalls[0].payload.operations[0].formula, "=SOMME(A2:B2)*C2");
}

const revenueSheetContent = JSON.stringify(
  {
    kind: "hydria-sheet",
    version: 1,
    activeSheetId: "sheet-1",
    sheets: [
      {
        id: "sheet-1",
        name: "Sheet 1",
        columns: ["Janvier", "Fevrier", "Mars", "Total"],
        rows: [["10", "20", "30", ""]]
      }
    ]
  },
  null,
  2
);
const revenueCalls = synthesizeWorkspaceToolCallsFromPrompt({
  prompt: "fais le total",
  activeWorkObject: {
    id: "sheet-1",
    kind: "dataset",
    workspaceFamilyId: "data_spreadsheet",
    primaryFile: "table.csv"
  },
  activeWorkObjectContent: revenueSheetContent
});
assert.equal(revenueCalls.length, 1);
assert.equal(revenueCalls[0].payload.operations.length, 1);
assert.equal(revenueCalls[0].payload.operations[0].target.cell, "D2");
assert.equal(revenueCalls[0].payload.operations[0].formula, "=SOMME(A2:C2)");

const sheetTools = listWorkspaceToolsForWorkObject({
  kind: "dataset",
  workspaceFamilyId: "data_spreadsheet",
  primaryFile: "table.csv"
});
[
  "sheet.apply_formula",
  "sheet.set_cell",
  "sheet.add_column",
  "sheet.add_row",
  "sheet.rename_column",
  "sheet.delete_column",
  "sheet.delete_row",
  "sheet.sort_range",
  "sheet.filter_rows",
  "sheet.format_cells",
  "sheet.add_chart",
  "sheet.set_data_validation",
  "sheet.add_named_range",
  "sheet.freeze_panes"
].forEach((tool) => assert.ok(sheetTools.includes(tool), `${tool} should be exposed`));

const contentTypedFields = buildWorkspaceContextFields({
  activeWorkObject: {
    id: "sheet-doc-1",
    kind: "document",
    metadata: {
      workspaceFamilyId: "document_knowledge"
    },
    primaryFile: "document.json"
  },
  contentPreview: sheetContent
});
assert.equal(contentTypedFields.workspaceFamilyId, "data_spreadsheet");
assert.ok(contentTypedFields.workspaceTools.includes("sheet.apply_formula"));
assert.ok(!contentTypedFields.workspaceTools.includes("doc.edit"));
const contentTypedPreview = JSON.parse(contentTypedFields.contentPreview);
assert.equal(contentTypedPreview.kind, "hydria-sheet");
assert.deepEqual(contentTypedPreview.columns, ["Prix", "Quantite"]);

const largeSheetContent = JSON.stringify({
  kind: "hydria-sheet",
  version: 1,
  activeSheetId: "sheet-1",
  sheets: [
    {
      id: "sheet-1",
      name: "Sheet 1",
      columns: ["nb de crayon gris", "nb de crayon rouge", "prix", "Total"],
      rows: Array.from({ length: 60 }, (_, index) => ["10", String(index + 1), "0.5", ""]),
      cellNotes: Object.fromEntries(Array.from({ length: 60 }, (_, index) => [`D${index + 2}`, "long note ".repeat(20)]))
    }
  ]
});
const largeSheetFields = buildWorkspaceContextFields({
  activeWorkObject: {
    id: "large-sheet-1",
    kind: "dataset",
    workspaceFamilyId: "data_spreadsheet",
    primaryFile: "table.csv"
  },
  contentPreview: largeSheetContent
});
const largeSheetPreview = JSON.parse(largeSheetFields.contentPreview);
assert.equal(largeSheetPreview.kind, "hydria-sheet");
assert.equal(largeSheetPreview.rowCount, 60);
assert.equal(largeSheetPreview.rows.length, 25);
assert.deepEqual(largeSheetPreview.columns, ["nb de crayon gris", "nb de crayon rouge", "prix", "Total"]);
assert.ok(largeSheetFields.contentPreview.length < largeSheetContent.length);

let savedContent = "";
const execution = await executeWorkspaceToolCalls({
  calls: [
    {
      ...calls[0],
      payload: {
        ...calls[0].payload,
        operations: [
          {
            type: "add_column",
            columnIndex: 2,
            formula: "=A2*B2"
          }
        ]
      }
    }
  ],
  userId: 1,
  prompt: "Ajoute une colonne Total dans le tableur.",
  workObjectService: {
    readContent() {
      return {
        workObject: {
          id: "sheet-1",
          title: "Test sheet",
          userId: 1,
          kind: "dataset",
          metadata: {
            workspaceFamilyId: "data_spreadsheet"
          }
        },
        entryPath: "table.csv",
        content: sheetContent
      };
    },
    async updateContent({ content }) {
      savedContent = content;
      return {
        id: "sheet-1",
        title: "Test sheet",
        primaryFile: "table.csv",
        file: {
          path: "table.csv",
          content
        }
      };
    }
  }
});
assert.equal(execution.executed, 1);
assert.equal(execution.results[0].status, "completed");
assert.deepEqual(execution.results[0].operationsApplied, ["sheet.add_column"]);
assert.equal(JSON.parse(savedContent).sheets[0].columns[2], "Total");
assert.equal(JSON.parse(savedContent).sheets[0].rows[0][2], "=A2*B2");

const tupleCalls = normalizeWorkspaceToolCallsFromCore({
  workspaceToolCalls: [
    {
      type: "workspace_tool_call",
      target: {
        workObjectId: "sheet-1",
        entryPath: "table.csv"
      },
      payload: {
        toolName: "sheet.apply_formula",
        operations: [["=A2*B2", { row: 1, column: "Total" }]]
      }
    }
  ]
});
assert.equal(tupleCalls[0].payload.operations[0].type, "sheet.add_column");
assert.equal(tupleCalls[0].payload.operations[0].columnName, "Total");

let tupleStringSavedContent = "";
const tupleStringCalls = normalizeWorkspaceToolCallsFromCore({
  workspaceToolCalls: [
    {
      type: "workspace_tool_call",
      target: {
        workObjectId: "sheet-1",
        entryPath: "table.csv"
      },
      payload: {
        toolName: "sheet.apply_formula",
        operations: [["A2", "=A2*B2"]]
      }
    }
  ]
});
assert.equal(tupleStringCalls[0].payload.operations[0].type, "sheet.set_formula");
const tupleStringExecution = await executeWorkspaceToolCalls({
  calls: tupleStringCalls,
  userId: 1,
  prompt: "Ajoute une colonne Total dans le tableur.",
  workObjectService: {
    readContent() {
      return {
        workObject: {
          id: "sheet-1",
          title: "Test sheet",
          userId: 1,
          kind: "dataset",
          metadata: {
            workspaceFamilyId: "data_spreadsheet"
          }
        },
        entryPath: "table.csv",
        content: sheetContent
      };
    },
    async updateContent({ content }) {
      tupleStringSavedContent = content;
      return {
        id: "sheet-1",
        title: "Test sheet",
        primaryFile: "table.csv",
        file: {
          path: "table.csv",
          content
        }
      };
    }
  }
});
assert.equal(tupleStringExecution.executed, 1);
assert.equal(JSON.parse(tupleStringSavedContent).sheets[0].columns[2], "Total");
assert.equal(JSON.parse(tupleStringSavedContent).sheets[0].rows[0][2], "=A2*B2");

const setRangeCalls = normalizeWorkspaceToolCallsFromCore({
  proposedActions: [
    {
      type: "workspace_tool_call",
      target: {
        workObjectId: "sheet-1",
        entryPath: "table.csv"
      },
      payload: {
        toolName: "sheet.apply_formula",
        operations: [
          {
            type: "sheet.set_range",
            range: "C2:D2",
            values: [["=A2+B2", "=A2*B2"]]
          }
        ]
      }
    }
  ]
});
assert.deepEqual(setRangeCalls[0].payload.operations[0].values, [["=A2+B2", "=A2*B2"]]);

const richSheetResult = applyHydriaWorkspaceToolOperationsToContent(sheetContent, [
  {
    type: "sheet.rename_column",
    target: { columnName: "Prix" },
    value: "Prix HT"
  },
  {
    type: "sheet.add_row",
    values: ["20", "2"]
  },
  {
    type: "sheet.add_row",
    values: ["5", "1"]
  },
  {
    type: "sheet.sort_range",
    target: { columnName: "Prix HT" },
    direction: "desc"
  },
  {
    type: "sheet.filter_rows",
    target: { columnName: "Prix HT" },
    value: "20"
  },
  {
    type: "sheet.format_cells",
    target: { columnName: "Prix HT" },
    format: { numberFormat: "currency", bold: true }
  },
  {
    type: "sheet.delete_column",
    target: { columnName: "Quantite" }
  }
]);
assert.deepEqual(richSheetResult.applied, [
  "sheet.rename_column",
  "sheet.add_row",
  "sheet.add_row",
  "sheet.sort_range",
  "sheet.filter_rows",
  "sheet.format_cells",
  "sheet.delete_column"
]);
const richSheetModel = JSON.parse(richSheetResult.content);
assert.deepEqual(richSheetModel.sheets[0].columns, ["Prix HT"]);
assert.equal(richSheetModel.sheets[0].rows[0][0], "20");
assert.equal(richSheetModel.sheets[0].filterQuery, "20");
assert.equal(richSheetModel.sheets[0].cellFormats["0:0"].bold, true);

const completeSheetResult = applyHydriaWorkspaceToolOperationsToContent(sheetContent, [
  { type: "sheet.insert_rows", target: { rowIndex: 1 }, count: 2 },
  { type: "sheet.insert_columns", target: { columnIndex: 1 }, count: 1, values: ["Remise"] },
  { type: "sheet.set_range", range: "B2:C3", values: [["5", "2"], ["10", "3"]] },
  { type: "sheet.merge_cells", range: "A2:B2" },
  { type: "sheet.set_note", target: { cell: "A2" }, value: "Prix client" },
  { type: "sheet.set_data_validation", range: "B2:B5", payload: { type: "number" } },
  { type: "sheet.add_conditional_format", range: "A2:A5", payload: { rule: "greaterThan", value: 10 } },
  { type: "sheet.add_table", title: "Ventes", range: "A1:C5" },
  { type: "sheet.add_chart", title: "CA", payload: { kind: "bar", range: "A1:C5" } },
  { type: "sheet.add_named_range", title: "PrixRange", range: "A2:A5" },
  { type: "sheet.freeze_panes", payload: { rows: 1, columns: 1 } },
  { type: "sheet.protect_sheet" },
  { type: "sheet.add_sheet", title: "Synthese" }
]);
assert.deepEqual(completeSheetResult.issues, []);
const completeSheetModel = JSON.parse(completeSheetResult.content);
assert.equal(completeSheetModel.sheets[0].columns[1], "Remise");
assert.equal(completeSheetModel.sheets[0].merges[0].range, "A2:B2");
assert.equal(completeSheetModel.sheets[0].cellNotes["1:0"], "Prix client");
assert.equal(completeSheetModel.sheets[0].tables[0].title, "Ventes");
assert.equal(completeSheetModel.sheets[0].charts[0].title, "CA");
assert.equal(completeSheetModel.namedRanges[0].name, "PrixRange");
assert.equal(completeSheetModel.sheets[0].frozenRows, 1);
assert.equal(completeSheetModel.sheets[0].protected, true);
assert.equal(completeSheetModel.sheets[1].name, "Synthese");

const docResult = applyHydriaDocumentToolOperationsToContent("<h1>Doc</h1>\n<p>Intro</p>", [
  {
    type: "doc.insert_section",
    title: "Next steps",
    content: "Ship the OS adapter."
  },
  {
    type: "doc.append_paragraph",
    content: "Keep the Core output canonical."
  }
]);
assert.deepEqual(docResult.applied, ["doc.insert_section", "doc.append_paragraph"]);
assert.match(docResult.content, /<h2>Next steps<\/h2>/);
assert.match(docResult.content, /Ship the OS adapter/);

const docContent = "# Plan projet\n\n## Introduction\n\nLe projet Hydria OS connecte Core et workspace. Il doit rester traçable. Il expose des actions editables.\n\n## Risques\n\n- Mauvais routage\n";
const summarizedIntroCalls = synthesizeWorkspaceToolCallsFromPrompt({
  prompt: "raccourcis l'introduction",
  activeWorkObject: {
    id: "doc-1",
    kind: "document",
    workspaceFamilyId: "document_knowledge",
    primaryFile: "content.md"
  },
  activeWorkObjectContent: docContent
});
assert.equal(summarizedIntroCalls.length, 1);
assert.equal(summarizedIntroCalls[0].payload.toolName, "doc.edit");
assert.equal(summarizedIntroCalls[0].payload.operations[0].type, "doc.replace_block");
assert.equal(summarizedIntroCalls[0].payload.operations[0].target.heading, "Introduction");
assert.match(summarizedIntroCalls[0].payload.operations[0].value, /Hydria OS/);

const deleteRiskCalls = synthesizeWorkspaceToolCallsFromPrompt({
  prompt: "supprime la section risques",
  activeWorkObject: {
    id: "doc-1",
    kind: "document",
    workspaceFamilyId: "document_knowledge",
    primaryFile: "content.md"
  },
  activeWorkObjectContent: docContent
});
assert.equal(deleteRiskCalls.length, 1);
assert.equal(deleteRiskCalls[0].payload.operations[0].type, "doc.delete_section");
assert.equal(deleteRiskCalls[0].payload.operations[0].target.heading, "Risques");

const addSectionCalls = synthesizeWorkspaceToolCallsFromPrompt({
  prompt: "ajoute une section Décisions avec \"Valider le contrat Core OS.\"",
  activeWorkObject: {
    id: "doc-1",
    kind: "document",
    workspaceFamilyId: "document_knowledge",
    primaryFile: "content.md"
  },
  activeWorkObjectContent: docContent
});
assert.equal(addSectionCalls.length, 1);
assert.equal(addSectionCalls[0].payload.operations[0].type, "doc.insert_section");
assert.equal(addSectionCalls[0].payload.operations[0].title, "Décisions");
assert.equal(addSectionCalls[0].payload.operations[0].value, "Valider le contrat Core OS.");

const docReplace = applyHydriaDocumentToolOperationsToContent("# Doc\n\nOld paragraph", [
  {
    type: "doc.replace_block",
    target: {
      oldText: "Old paragraph"
    },
    content: "New paragraph"
  }
]);
assert.deepEqual(docReplace.applied, ["doc.replace_block"]);
assert.match(docReplace.content, /New paragraph/);

const docTableAndDelete = applyHydriaDocumentToolOperationsToContent(
  "<h1>Doc</h1>\n<h2>Risques</h2>\n<p>Old risk list</p>",
  [
    {
      type: "doc.delete_section",
      title: "Risques",
      target: { heading: "Risques" }
    },
    {
      type: "doc.insert_table",
      title: "Decisions",
      values: [
        ["Decision", "Owner"],
        ["Migration", "Core"]
      ]
    }
  ]
);
assert.deepEqual(docTableAndDelete.applied, ["doc.delete_section", "doc.insert_table"]);
assert.doesNotMatch(docTableAndDelete.content, /Old risk list/);
assert.match(docTableAndDelete.content, /<table>/);
assert.match(docTableAndDelete.content, /Migration/);

const completeDocResult = applyHydriaDocumentToolOperationsToContent("<h1>Doc</h1>", [
  { type: "doc.insert_heading", title: "Scope", target: { level: 2 } },
  { type: "doc.insert_paragraph", content: "Paragraph content." },
  { type: "doc.insert_list", values: ["One", "Two"] },
  { type: "doc.insert_link", title: "Hydria", value: "https://app.hydria.click" },
  { type: "doc.insert_quote", content: "A governed workspace action." },
  { type: "doc.insert_code_block", content: "const ok = true;", payload: { language: "js" } },
  { type: "doc.set_title", title: "New title" },
  { type: "doc.add_comment", title: "review", content: "Check wording." }
]);
assert.deepEqual(completeDocResult.issues, []);
assert.match(completeDocResult.content, /<h1>New title<\/h1>/);
assert.match(completeDocResult.content, /<ul><li>One<\/li><li>Two<\/li><\/ul>/);
assert.match(completeDocResult.content, /href="https:\/\/app\.hydria\.click"/);
assert.match(completeDocResult.content, /hydria-comment:review/);

const slideResult = applyHydriaSlideToolOperationsToContent(
  "# Deck\n\n## Slide 1 - Intro\n\nHello",
  [
    {
      type: "slide.add",
      title: "Proof",
      content: "- Live Sheet operation\n- Persisted revision"
    },
    {
      type: "slide.update",
      target: {
        slideNumber: 1
      },
      content: "Updated intro"
    }
  ]
);
assert.deepEqual(slideResult.applied, ["slide.add", "slide.update"]);
assert.match(slideResult.content, /## Slide 1 - Intro/);
assert.match(slideResult.content, /Updated intro/);
assert.match(slideResult.content, /## Slide 2 - Proof/);

console.log("workspaceToolDispatcherSmoke ok");
