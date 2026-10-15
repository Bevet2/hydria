# Hydria OS — Flow Manager (Data / ETL)

Hydria OS includes a dedicated **Flow Manager** page (`/workspace/flows`).
It is separate from **Automation** (`/workspace/automation`) so data pipelines
do not replace the existing task/workflow editor.

## Features available

- Visual graph with draggable nodes, input/output ports, clickable connections,
  zoom, full screen, keyboard deletion and Undo/Redo.
- Searchable node repository.
- JSON source tables, plus browser-side CSV import including quoted values.
- Select columns, filter rows, sort, arithmetic derived columns, group/aggregate,
  two-input left/inner join, and table output.
- Inspect intermediate node row counts, execution status and samples.
- Import/export a `hydria-dataflow` JSON model, export the **full output** as CSV.
- Automatic persistence through the current work object's `workflow.json` and OS autosave.
- Stateless local validation/execution API:
  - `GET /api/flows/catalog`
  - `POST /api/flows/validate` with `{ "flow": { ... } }`
  - `POST /api/flows/run` with `{ "flow": { ... }, "sampleLimit": 30 }`
  - `POST /api/flows/export` with `{ "flow": { ... } }` for a complete CSV download

A new Flow Manager project starts with a source → filter → output example.

## Operation and scope

The graph engine runs **safe deterministic transformations only**. It never evaluates
arbitrary JavaScript, SQL or Python, and rejects unknown node types, invalid ports,
missing edges, duplicate input connections, and cycles.

Current limits: 100 nodes, 250 links, 20,000 rows, 100 source columns and 100
sampled preview rows per node. CSV imports are limited to 2 MB.
Flow executions are manual and stateless; the workflow definition is persisted.
Execution previews are sampled; complete output can be exported as CSV (up to 25 MB).
Execution results are not stored as separate durable datasets.

This is not a full KNIME alternative yet. SQL connectors, data catalog discovery,
typed schemas, runtime caching, streaming files, scheduling, execution history,
multi-workspace output publishing, and a full workflow recovery system remain
distinct backlog items.

## OSS design references

- [KNIME](https://docs.knime.com/ap/5.11/analytics_platform_user_guide/)
  — node repository, input/output ports, configuring and executing nodes.
- [Rete.js](https://retejs.org/docs/) — modular visual programming and dataflow.
- [xyflow / React Flow](https://xyflow.com/open-source) — node-editor interaction patterns.

Hydria OS currently uses plain JavaScript in its frontend, so the editor is
implemented without importing React Flow or Rete.js. This avoids introducing a
second UI runtime just for this module, and doesn't copy those projects' source.

## Validation

```bash
node backend/scripts/dataFlowGate.mjs
npm run test:visual-workspace --prefix backend -- --scenario "dataflow-workbench-smoke,os-global-command-palette"
```

The CI also validates the core Docs, Sheets, Slides and Canvas smoke scenarios.

## OS keyboard shortcuts

- `Ctrl/Cmd + K`: search all workspaces, projects and work objects.
- `Ctrl/Cmd + Shift + F`: global search.
- `Ctrl/Cmd + S`: save current editable object.
- Flow editor: `Delete` selected node, `Escape` connection mode,
  `Ctrl/Cmd + Z` undo and `Ctrl/Cmd + Shift + Z` redo.
