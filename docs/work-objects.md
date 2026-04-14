# Work Objects

Hydria exposes user-facing creations as work objects instead of treating them as plain chat text.

## What a work object is

A work object is the persistent, editable facade above:
- project workspaces
- generated documents
- presentations
- datasets
- dashboards
- workflows
- design / wireframe models
- code bundles

The canonical backend layer lives in:
- `backend/src/work-objects/workObject.types.js`
- `backend/src/work-objects/workObject.store.js`
- `backend/src/work-objects/workObject.service.js`

## Core behavior

When Hydria creates something tangible, it now:
1. creates or updates the underlying project/artifact
2. registers a work object
3. exposes it through `/api/work-objects`
4. opens it in the frontend workspace
5. allows edit, save and improve operations
6. auto-opens the created project/work object after `Ask Hydria` or `New project`
7. lands runtime-capable objects directly on the live preview surface when possible

## Backing storage

- metadata store: `data/agentic/work-object-store.json`
- object content/workspaces: `data/agentic/work-objects`
- project sandboxes: `data/agentic/sandbox`
- exports: `data/agentic/artifacts`

## Main routes

- `GET /api/work-objects?userId=&conversationId=`
- `GET /api/work-objects/:workObjectId`
- `GET /api/work-objects/:workObjectId/assets/*`
- `GET /api/work-objects/:workObjectId/runtime`
- `POST /api/work-objects/:workObjectId/runtime/session`
- `GET /api/work-objects/:workObjectId/runtime/session`
- `PATCH /api/work-objects/:workObjectId/runtime/session`
- `POST /api/work-objects/:workObjectId/runtime/session/reset`
- `GET /api/work-objects/:workObjectId/runtime/session/render`
- `GET /api/work-objects/:workObjectId/runtime/session/assets/*`
- `PATCH /api/work-objects/:workObjectId/content`
- `POST /api/work-objects/:workObjectId/improve`

## Response model

Hydria keeps the user-facing answer clean and returns the object separately in the payload:
- `activeWorkObject`
- `workObjects`
- `delivery`
- `artifacts`

The UI uses these fields to render:
- an object card in the chat flow
- a workspace panel where preview is central and editing is contextual
- a workspace-first layout where the assistant sits below the active project instead of competing with it
- delivery/download actions
- a visual workspace with:
  - project list
  - project object navigator
  - editable file selector
  - section-level navigation for markdown-like content
  - central preview pane
  - contextual editor drawer
  - discreet copilot panel
  - shape-native editors when the object calls for it:
    - spreadsheet-style grid for datasets
    - slide editor for presentations
    - dashboard editor and dashboard surface for KPI / chart objects, widgets, active chart editing, filters, mini chart bars and table slices
    - workflow editor and workflow surface for staged automation flows, explicit links, active step editing, outputs and ownership
    - design editor and design surface for wireframe objects, frame blocks, active frame editing, palette tokens and frame previews
    - live runtime + config-backed app editing for static apps

## Workspace behavior

The frontend now treats work objects as workspace surfaces instead of plain chat attachments.

Flow:
1. open a project from `/api/projects`
2. load its related work objects
3. select a work object and one editable file
4. derive sections and blocks locally for granular editing
5. choose a surface depending on the object and file:
   - `overview`
   - `preview`
   - `edit`
   - `structure`
   - `code`
   - `data`
   - `media`
   - `app`
   - `live`
6. render the active surface with a type-aware renderer:
   - project: overview + dimensions + linked objects
   - document: readable sectioned view
   - code: editor-like preview
  - data: structured table or JSON view, with spreadsheet-style editing in the drawer
  - presentation: slide stage + slide strip, with slide-native editing in the drawer
  - dashboard: KPI cards + bar-chart style previews + table surface backed by `dashboard.json`
  - workflow: staged automation flow + outputs surface backed by `workflow.json`
  - design: wireframe / palette / frame surface with visual frame cards backed by `wireframe.json`
  - media/app: direct asset preview when available
   - live: sandboxed runtime preview for interactive HTML/CSS/JS work objects
7. edit the whole file, a section, or a block on the same persistent object
8. autosave manual edits on the active object, with explicit Save still available
9. treat copilot follow-up prompts as changes to the open project/work object when the intent is clearly iterative
10. save back through `PATCH /api/work-objects/:id/content`

## Live runtime behavior

For runtime-capable work objects:
- Hydria detects an HTML entry such as `index.html`
- the surface model exposes `runtimeCapable`, `runtimeEntryPath` and `runtimeUrl`
- the frontend ensures a `runtimeSession` and connects the `live` surface to that session instead of reading the edited file directly
- relative runtime assets are rewritten to the runtime-session asset route
- editing a tracked runtime file now updates a draft inside the runtime session
- the live iframe reads the runtime session render URL, not the raw file URL
- small runtime changes such as CSS and entry HTML edits can now be pushed into the active iframe without replacing it
- heavier changes still fall back to a clean runtime refresh when soft patching is not safe
- saving the object syncs the persisted source revision back into the runtime session
- the runtime session can be reset without recreating the work object

This means Hydria can now behave more like a lightweight workspace than a text-only chat.

## Links

Work objects can link back to:
- `projectId`
- exported artifact ids
- future memory / learning / pattern references

This keeps the object layer stable while the internal systems evolve underneath.
