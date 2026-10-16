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


## Optional SQLite connector (server-side, read-only)

The Flow Manager can read an explicitly configured SQLite database through
`GET /api/flow-sources/sqlite/tables` and `POST /api/flow-sources/sqlite/read`.
This is a **bounded read-only source**, not an arbitrary SQL execution endpoint.

An administrator must configure both values in `backend/.env`:

```env
HYDRIA_FLOW_SQLITE_PATH=/absolute/path/to/business-data.sqlite
HYDRIA_FLOW_CONNECTOR_TOKEN=long-private-random-token
```

Both endpoints require the token in the `x-hydria-flow-token` request header.
The POST body is `{"table":"sales","limit":1000}`. The database path and
authentication secret are never included in a flow file. The query is restricted
to a known database table, uses a read-only SQLite connection, and accepts a
bounded count of at most 20,000 rows, 100 columns, and 2 MB returned JSON.

The returned `rows` can be used as the JSON data of an `input.table` source
in a Flow Manager graph. This is a local SQL source foundation, **not** a
PostgreSQL connector, credential vault, scheduled refresh or managed catalog.


## Execution history

When a Flow Manager workflow is executed from the editor, it receives a
random UUID history key saved with the workflow definition. The local SQLite
database keeps up to 50 metadata records per workflow: timestamp, success or
failure, elapsed milliseconds, executed steps, number of output rows and errors.
Data rows, previews and source credentials are **not stored** in this history.
The editor exposes a collapsible recent-run view and a refresh action.
The API endpoints are `POST /api/flows/run` (with `historyId`) and
`GET /api/flows/history/:flowKey`.

The opaque UUID is a local lookup key, **not an authentication boundary**.
Do not expose these endpoints to untrusted users without adding authenticated
workspace authorization first. This is execution metadata only, not durable
output datasets, job scheduling or recovery.


## Data reshaping and workbook import

The Flow Manager includes deterministic Pivot (sum/average/count/min/max)
and Unpivot nodes, each respecting the 20,000-row/100-column limits.
For multi-tab XLSX imports, select the worksheet explicitly before loading
source rows. Hidden worksheets are excluded when visible ones exist.


A workflow with multiple `Table output` nodes can export every result as one
multi-sheet XLSX workbook (`POST /api/flows/export-workbook`), using one
worksheet per output. This complements the ZIP of individual CSVs. Export
limits: 100 columns/output, 250,000 workbook cells and 25 MB total.

## Saved result datasets (opt-in)

The Flow Manager can now explicitly persist the **selected complete Table
output** in the Hydria OS server's SQLite database. This is separate from
the execution metadata history and never happens implicitly on every run.

1. Run a flow and select an output.
2. Enter `HYDRIA_FLOW_CONNECTOR_TOKEN` in the Saved datasets panel.
3. Choose **Save selected output to SQLite**, then **Refresh saved datasets**.
4. Saved datasets can be opened, deleted, or imported as **new Table source
   nodes** for further ETL work. Importing copies the rows into the workflow;
   it does not create an automatic live connection to the snapshot.

The server reruns the complete flow before saving, rather than saving only
the UI sample. Each snapshot is limited to 20,000 rows, at most 100
columns per row, and 2 MB of serialized JSON. It retains the 10 most recent
snapshots **per flow key**, pruning older ones. On-disk storage is ordinary
SQLite, not encrypted at rest.

API endpoints (all require `x-hydria-flow-token`):

- `POST /api/flows/snapshots` with `{ "flow": {...}, "historyId": "<UUID>", "outputId": "<output-node-id>" }`
- `GET /api/flows/snapshots/:flowKey` (metadata, no row data)
- `GET /api/flows/snapshots/:flowKey/:snapshotId` (full stored rows)
- `DELETE /api/flows/snapshots/:flowKey/:snapshotId`

The access token remains in memory in the editor; it is not saved to
`workflow.json`, browser local storage, or the snapshot database. The
server must have `HYDRIA_FLOW_CONNECTOR_TOKEN` configured. Flow keys are
identifiers, **not** authorization. Do not expose the Flow Manager as a
public multi-user service without adding per-workspace authentication and
authorization, storage quotas and audit records.

These snapshots are manual, immutable datasets, **not** automated refreshes,
scheduled flows, streaming outputs or per-tenant data catalogs. Validate with:

```bash
node backend/scripts/flowResultSnapshotGate.mjs
```

## Interval-based automated execution

Flow Manager now supports a **server-side scheduled workflow** for each
workflow history key. The editor offers Create/Update, Pause/Resume, Run Now
and Remove controls in the Saved datasets panel. Schedules are persisted in
the backend's SQLite database and survive restarts.

All five schedule API routes require `x-hydria-flow-token` with the configured
`HYDRIA_FLOW_CONNECTOR_TOKEN`:

- `GET /api/flows/schedules` — metadata for up to 25 configured schedules
- `GET /api/flows/schedules/:flowKey` — current schedule and last-run status
- `PUT /api/flows/schedules/:flowKey` — full validated flow definition, selected
  `outputId`, integer `intervalMinutes` (15–1440), boolean `enabled`,
  optional boolean `publishSnapshot`
- `POST /api/flows/schedules/:flowKey/run` — execute immediately
- `DELETE /api/flows/schedules/:flowKey` — remove the schedule but retain
  already saved snapshots

The worker checks due times every 60 seconds and executes up to five due
schedules per tick. Execution metadata is recorded in the same history used
by manual runs. When `publishSnapshot` is enabled, the full selected output
is saved using the existing bounded snapshot store (2 MB, at most ten per
flow). A flow must first be run from the UI to establish its UUID key.

Schedules support **only the current synchronous, deterministic data-flow
nodes**, including embedded `input.table` rows. They **do not automatically
refresh browser-imported CSV, REST or SQLite source data**; those imports are
copied into an input node. Scheduled execution of live PostgreSQL/API inputs
will require explicit server-side connector nodes with secure references.
Scheduled definitions are capped at 512 KB and 40 nodes, with no arbitrary
code execution.

The scheduler starts only when `HYDRIA_FLOW_CONNECTOR_TOKEN` is set. Set
`HYDRIA_FLOW_SCHEDULER_ENABLED=false` to disable the background tick while
keeping management endpoints available. Because this is a single-process
worker, **do not run several backend replicas with it enabled** until a
distributed lease mechanism is added. It uses at-most-once due-time claims,
not a guaranteed exactly-once job system. Per-workspace authorization,
encrypted stored input rows, retries, an audit trail, and distributed
coordination are still required for production multi-tenant use.

Validate it with `node backend/scripts/flowSchedulerGate.mjs`.

## PostgreSQL connector (server-side, read-only)

A new optional PostgreSQL table reader is available through the Flow Manager
source inspector. It lists up to 100 visible database tables and allows a
bounded read of a single table into an `input.table` node. An administrator
must install the **PostgreSQL psql command-line client** on the backend host;
Hydria does not download or embed a driver.

Environment example in `backend/.env`:

```env
HYDRIA_FLOW_CONNECTOR_TOKEN=a-long-random-admin-token
HYDRIA_FLOW_PG_HOST=127.0.0.1
HYDRIA_FLOW_PG_PORT=5432
HYDRIA_FLOW_PG_DATABASE=business
HYDRIA_FLOW_PG_USER=hydria_reader
HYDRIA_FLOW_PG_PASSWORD=server-only-password
HYDRIA_FLOW_PG_SSLMODE=require
# Optional path to psql if not on PATH
# HYDRIA_FLOW_PSQL_BIN=/usr/bin/psql
```

Use a **database role with SELECT access only** to required schemas/tables.
Use `verify-full` plus correct CA configuration when accessing a remote
database over TLS; `require` encrypts the connection but doesn't provide
the same hostname verification. `disable` is intended only for local
development.

Protected endpoints:

- `GET /api/flow-sources/postgres/tables` returns `{schema,name}` entries
- `POST /api/flow-sources/postgres/read` with
  `{"schema":"public","table":"sales","limit":1000}`

Both require `x-hydria-flow-token`. The backend runs only fixed, read-only
metadata queries and bounded table SELECTs, without arbitrary submitted SQL,
shell execution or user-supplied connection settings. Table identifiers are
checked against the catalog and validated. Limits: 20,000 rows, 100 columns
and 2 MB of JSON output, with PostgreSQL statement and process timeouts.

**Important:** Importing into a source node makes a static copy of the rows.
Scheduled flows run this copy; they do not currently reconnect to PostgreSQL
on each interval. Credentials are never written to workflow files. Do not use
this connector to import highly sensitive information into workflows unless
the Hydria OS workspace is properly access-controlled and encrypted at rest.

Run `node backend/scripts/flowPostgresSourceGate.mjs` for mock-backed
identifier validation, query, limit, permission and secret-handling tests.
Full connectivity should also be tested against a real PostgreSQL database
in the target environment.

## Live Flow dashboard (initial dynamic viewer)

From the Flow Manager toolbar, click **Live dashboard** after running the
workflow at least once. This opens `/flow-dashboard.html?flowKey=<UUID>`
on the same Hydria OS server. Enter `HYDRIA_FLOW_CONNECTOR_TOKEN` to fetch
the saved results. The token is kept in tab memory, never stored in the URL,
history, local storage or the workflow file.

The viewer offers latest/historical dataset selection, category grouping,
sum/average/count measures, row filtering, a preview table and a refresh
button. While the page is visible it checks for new stored snapshots every
60 seconds. Cells and labels are rendered with DOM `textContent`, not raw
HTML. The most recent scheduled result can therefore appear automatically.

This is **a new read-only Flow dataset dashboard**. It is not yet a dynamic
connector inside the existing Hydria dashboard editing surface, and it
doesn't stream records directly from an external database. Existing snapshots
still require connector token authentication. Configure workspace
authorization before offering access to untrusted users.

Run `node backend/scripts/flowDashboardGate.mjs` to verify filtering,
aggregation and numeric calculations.
