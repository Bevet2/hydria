# Hydria V1

Hydria V1 is a local orchestration layer for multi-model and multi-API workflows. It routes user prompts, prefers free providers first, manages SQLite-backed user history, builds compact context for LLM calls, and can combine API data with model reasoning through a single chat interface.

Hydria V1 is intentionally professional and modular. It does not include jailbreak logic, policy bypass behavior, or offensive prompt-routing features.

## Vision

Hydria V1 focuses on a pragmatic baseline:

- clean local chat UI
- file attachments for images, PDF, DOCX, code, and text files
- central orchestrator: `HydriaBrain`
- OpenRouter free-first model routing
- external API catalog driven by JSON
- web search and direct URL reading
- local developer tools for workspace inspection, diagnostics, and preview checks
- SQLite user history and conversation logs
- short-term, summarized, and long-term memory
- extensible architecture for future multimodal adapters

## Architecture

```text
hydria/
  frontend/                    Vanilla JS UI served by Express
  backend/
    routes/                    REST API
    middleware/                Multipart upload middleware
    services/hydria/           Brain, classifier, planner, synthesizer
    services/providers/        OpenRouter adapter
    services/apis/             API router, catalog loader, normalizers
    services/web/              Web search, URL reading, HTML extraction
    services/tools/            Workspace inspection, diagnostics, preview tooling
    services/attachments/      File extraction and attachment context
    services/memory/           History, profile, memory, context builder
    services/registry/         Model and API registries
    services/future/           Multimodal placeholders for V2
    db/                        SQLite bootstrap and schema
    config/                    Central app config
    utils/                     Logging, timing, error helpers
  data/api-catalog/            Curated and custom API catalogs
```

## Agentic Core V1

Hydria now includes a second orchestration layer in `backend/src` that evolves the original `HydriaBrain` into a modular autonomous-agent baseline.

New modules:

- `src/core`: autonomous brain and provider abstraction
- `src/agents`: planner, executor, critic, memory
- `src/agents/gitAgent`: GitHub-oriented specialist
- `src/runtime`: file, shell, credentials adapters
- `src/runtime`: file, shell, credentials and stateful browser adapters
- `src/tools`: unified tool registry
- `src/memory`: JSON stateful memory store
- `src/knowledge`: local ingestion and retrieval store
- `src/knowledge`: local ingestion and richer semantic-like retrieval store
- `src/evals`: heuristic evaluator and performance log
- `src/evals`: heuristic evaluator, benchmark log, and domain benchmark runner
- `src/evolution`: controlled retry loop
- `src/evolution`: controlled multi-strategy retry loop
- `scripts/domainBenchmarkEval.mjs`: automatic benchmark by domain
- `scripts/realworldBenchmarkEval.mjs`: real-world benchmark scenarios
- `src/integrations/github`: GitHub search, repo, file and clone adapters
- `src/patterns`: validated reusable pattern library
- `src/projects`: lightweight live project tracking
- `src/project-builder`: scaffold + delivery helpers
- `src/artifacts`: export zip and delivery manifest
- `src/work-objects`: persistent editable objects exposed to the user workspace
- `frontend/app.js` + `frontend/components/workspacePanel.js`: visual workspace shell for project/object navigation, preview and editing
- `src/projects/internalCapabilityDiscovery.js`: internal capability discovery from local sibling projects
- `src/projects/globalProjectService.js`: transforms project tasks into multidimensional global projects
- `src/types`: shared contracts

Current loop:

1. receive user task
2. recall memory and ingest attachments
3. resolve conversational follow-up
4. build a mini-plan
5. execute tools and model steps
6. observe results
7. synthesize the final answer
8. critique the run
9. persist useful memory and task outcome

Delivery loop for actionable build prompts:

1. scaffold project files in the internal sandbox
2. install dependencies for Node/JS templates
3. smoke-run the generated app
4. apply simple bounded auto-fixes when the failure is obvious
5. validate readiness
6. export a user-facing zip artifact
7. return a clean delivery-oriented answer

Global project layer:

1. inspect local sibling projects like `F:\\hydria-studio` and `F:\\hydria music`
2. internalize them as native capabilities instead of external tools
3. choose project dimensions automatically (`text`, `narrative`, `visual`, `audio`, `logic`, etc.)
4. scaffold a richer workspace with blueprint, experience overview, and capability-specific packs
5. expose the result as a persistent editable work object

Workspace layer:

1. list projects and work objects in the sidebar
2. open a project as a structured workspace instead of a raw zip
3. navigate between project objects, dimensions, editable files, sections and content blocks
4. choose a universal surface per object/file: `overview`, `preview`, `edit`, `structure`, `code`, `data`, `media`, `app`, `live`
5. keep preview as the main surface, with editing opened only when needed
6. run interactive HTML/CSS/JS work objects in a sandboxed live surface directly inside Hydria
7. back the live surface with a real runtime session, separate from the saved source and the current draft
8. apply soft live patches for HTML/CSS when possible, instead of reloading the preview iframe each time
9. keep the workspace above the assistant, with the copilot docked below as a follow-up tool for the currently open project
10. autosave manual edits back into the active work object, while preserving a direct Save action
11. route follow-up chat requests on an open project back into that same work object/project instead of creating a detached result
12. edit the full file, a section, or a selected block, then persist the change back to the same work object
13. edit datasets through a native spreadsheet-style grid instead of raw CSV text
14. edit presentations through a slide-native editor instead of a plain textarea
15. generate static app projects with a domain-aware `app.config.json` and a live multi-view runtime
16. generate dashboard objects with a native dashboard surface and JSON model
17. generate workflow objects with a native workflow surface and editable automation graph model
18. generate design / wireframe objects with a native design surface and editable visual system model
19. keep chat as a discreet assistant, while the preview stays central
20. turn `Ask Hydria` creation prompts like `create a recipe app` into a real project, work object, workspace entry, and live preview automatically
21. start a fresh creation flow from the UI with `Create with Hydria`, then let the assistant create the right shape
22. infer an explicit `intent profile` with real objective, ambiguity, hidden constraints, implied needs, and user expertise
23. plan the right `environment` for that intent instead of falling back to generic text or scaffolding
24. keep `project continuity` across a conversation so follow-up prompts resume and evolve the current object or project automatically
25. run a light `intent simulation` step before execution to arbitrate between create, update, transform, and project scaffold paths
26. simulate multiple `environment scenarios` before creation to choose whether Hydria should continue, transform, extend a project, or create a new environment
27. simulate multiple `project trajectories` to decide between linked object extension, project shell evolution, full delivery, or a fresh project branch
28. simulate multiple `business scenarios` before execution to choose whether the best move is an MVP launch, an investor-facing asset, an analytics command center, an automation operator, a knowledge asset, or a design sprint
29. simulate multiple `product plans` above the technical path to arbitrate between lean object delivery, project extension, launch-ready MVP, investor asset, operating surface, and design iteration
30. simulate multiple `impact outcomes` to estimate user value, build cost, transformation risk, continuity ROI, and time-to-value before execution
31. simulate multiple `usage scenarios` to decide whether Hydria should optimize for quick first success, stakeholder review, launch validation, repeat operator usage, or continuous project iteration

Reference docs:

- [architecture.md](/c:/Users/Boyer-Vidal/Desktop/hydria/docs/architecture.md)
- [adding-agent.md](/c:/Users/Boyer-Vidal/Desktop/hydria/docs/adding-agent.md)
- [adding-tool.md](/c:/Users/Boyer-Vidal/Desktop/hydria/docs/adding-tool.md)
- [git-agent.md](/c:/Users/Boyer-Vidal/Desktop/hydria/docs/git-agent.md)
- [runtime.md](/c:/Users/Boyer-Vidal/Desktop/hydria/docs/runtime.md)
- [knowledge.md](/c:/Users/Boyer-Vidal/Desktop/hydria/docs/knowledge.md)
- [memory.md](/c:/Users/Boyer-Vidal/Desktop/hydria/docs/memory.md)
- [learning.md](/c:/Users/Boyer-Vidal/Desktop/hydria/docs/learning.md)
- [global-projects.md](/c:/Users/Boyer-Vidal/Desktop/hydria/docs/global-projects.md)
- [work-objects.md](/c:/Users/Boyer-Vidal/Desktop/hydria/docs/work-objects.md)
- [evals.md](/c:/Users/Boyer-Vidal/Desktop/hydria/docs/evals.md)
- [evolution.md](/c:/Users/Boyer-Vidal/Desktop/hydria/docs/evolution.md)
- [roadmap.md](/c:/Users/Boyer-Vidal/Desktop/hydria/docs/roadmap.md)

### Core flow

1. `POST /api/chat` sends a prompt and optional attachments to `HydriaBrain`.
2. The upload middleware accepts multipart files in memory.
3. The attachment service extracts text from code/text files, DOCX, PDF, and OCR-enabled images.
4. `HydriaBrain` classifies the task.
5. The planner builds a readable execution plan.
6. The API router optionally resolves a catalog-driven external provider.
7. The web router can search the web or read a direct URL, then extract readable content and sources.
8. The tool router can inspect the local workspace, run safe diagnostics, or inspect a preview URL.
9. The context builder selects recent messages, summary memory, long-term memory, preferences, attachment excerpts, API data, web results, and local tool results.
10. OpenRouter is called through a free-first model chain with fallback.
11. The synthesizer merges candidates and returns a structured response.
12. History, execution logs, useful memory, and attachment traces are stored in SQLite-backed conversation history.

## Attachments

Hydria V1 accepts multipart file uploads directly from the chat composer.

Supported classes:

- images through local OCR
- PDF documents
- DOCX documents
- legacy `.doc` parsing path
- code and config files
- plain text and CSV-style text files

Current behavior:

- uploaded files are parsed on the backend
- extracted text is bounded by per-file and global context budgets
- extracted content is injected into the model context
- a compact attachment trace is stored in the conversation as `tool` messages for later turns
- attachment metadata and excerpts are returned by `POST /api/chat`

Environment flags:

- `MAX_ATTACHMENTS`
- `MAX_ATTACHMENT_SIZE_MB`
- `MAX_ATTACHMENT_EXTRACT_CHARS`
- `MAX_TOTAL_ATTACHMENT_CHARS`
- `ENABLE_ATTACHMENT_OCR`
- `OCR_LANGUAGES`

Notes:

- image support uses OCR, not native multimodal vision
- DOCX parsing is verified end-to-end
- legacy `.doc` extraction is implemented, but depends on the structure of the Word file
- scanned PDFs without embedded text may require a future OCR path in V2

## OpenRouter free tree

Hydria V1 supports a simple but real free-first model hierarchy:

- `DEFAULT_FREE_MODEL`
- `FALLBACK_MODEL`
- `FREE_GENERAL_MODEL`
- `FREE_CODE_MODEL`
- `FREE_REASONING_MODEL`
- `FREE_FAST_MODEL`
- `FREE_AGENT_MODEL`

Rules implemented in code:

- if `FREE_FAST_MODEL` is empty, Hydria falls back to `FREE_GENERAL_MODEL`
- if `FREE_AGENT_MODEL` is empty, Hydria falls back to `FREE_REASONING_MODEL`
- if a specialized model fails, Hydria falls back to `FALLBACK_MODEL`
- if only `DEFAULT_FREE_MODEL` and `FALLBACK_MODEL` are configured, the app still runs

## API catalog

Hydria does not hardcode all providers in service logic. API availability is driven by:

- [curated-apis.json](/c:/Users/Boyer-Vidal/Desktop/hydria/data/api-catalog/curated-apis.json)
- [custom-apis.json](/c:/Users/Boyer-Vidal/Desktop/hydria/data/api-catalog/custom-apis.json)

Each entry declares:

- id, name, category, description
- base URL and auth type
- pricing tier
- capabilities
- enablement and priority

The router then chooses the best enabled provider according to:

- configuration availability
- free-first pricing preference
- provider priority

## Web access

Hydria V1 now includes a dedicated web layer for:

- direct URL reading
- lightweight web search
- readable HTML extraction
- source-aware synthesis

Current behavior:

- a prompt containing a URL triggers direct page reading
- a prompt asking to search the web triggers web search
- Hydria can read top search hits when the task needs summarization or analysis
- web results are injected into LLM context and also returned as explicit sources/artifacts

Current free-first stack:

- DuckDuckGo HTML search for result discovery
- DuckDuckGo Instant Answer as fallback
- Jina Reader for readable URL extraction
- direct HTTP fetch + HTML extraction as local fallback

Environment flags:

- `ENABLE_WEB_ACCESS`
- `MAX_WEB_RESULTS`
- `MAX_WEB_PAGES_PER_REQUEST`
- `ENABLE_BROWSER_FETCH`

## Local tools

Hydria V1 now includes a local tool layer for code and debugging tasks.

Current tools:

- workspace inspection
- safe diagnostics runner
- preview and render inspection

Current behavior:

- code/debug prompts can trigger workspace scanning before LLM analysis
- Hydria can run safe local diagnostics such as `npm run test`, `npm run lint`, `npm run build`, or targeted syntax checks when available
- Hydria can inspect a local preview URL and capture a screenshot artifact when browser automation is available
- tool outputs are injected into prompt context and also returned as explicit sources

Environment flags:

- `ENABLE_LOCAL_TOOLS`
- `TOOLS_WORKSPACE_ROOT`
- `TOOL_TIMEOUT_MS`
- `MAX_TOOL_OUTPUT_CHARS`
- `MAX_TOOL_FILES_SCANNED`
- `MAX_TOOL_RELEVANT_FILES`
- `ENABLE_BROWSER_PREVIEW`
- capability match

## History and memory

SQLite stores:

- users
- conversations
- messages
- user preferences
- user memory
- execution logs

Memory is split into three layers:

- short-term: recent messages in the active conversation
- summarized: compact conversation summary when a thread grows
- long-term: preferences, durable facts, project context

The main memory services are:

- `saveMessage()`
- `getConversationHistory()`
- `summarizeConversationIfNeeded()`
- `storeUsefulMemory()`
- `getRelevantMemoryForPrompt()`

## Frontend

The frontend is plain HTML, CSS, and modular JavaScript. It includes:

- user creation and selection
- conversation list
- chat input and message history
- multi-file attachment picker
- execution details panel
- preference editor
- local session persistence via `localStorage`
- sober dark responsive layout

## Installation

### Prerequisites

- Node.js 22+ recommended
- internet access for OpenRouter and external APIs

### Setup

1. Copy `backend/.env.example` to `backend/.env`
2. Add your `OPENROUTER_API_KEY`
3. Optionally tune attachment OCR and file limits in `backend/.env`
4. Optionally add API keys for `GNEWS_API_KEY`, `ALPHA_VANTAGE_API_KEY`, `OMDB_API_KEY`, and `THESPORTSDB_API_KEY`
5. Install backend dependencies

Windows PowerShell:

```powershell
Copy-Item backend\.env.example backend\.env
cd backend
npm.cmd install
npm.cmd start
```

macOS / Linux:

```bash
cp backend/.env.example backend/.env
cd backend
npm install
npm start
```

You can also use:

- `start.bat` on Windows
- `start.sh` on macOS / Linux

Agentic smoke eval:

```powershell
cd backend
npm.cmd run eval:agentic-smoke
```

## Launch

Once the backend is running, open:

```text
http://localhost:3001
```

The Express server also serves the frontend statically, so no separate frontend process is required.

## Main endpoints

- `GET /api/health`
- `GET /api/config/public`
- `POST /api/chat`
- `GET /api/users`
- `POST /api/users`
- `GET /api/users/:userId/conversations`
- `POST /api/conversations`
- `GET /api/conversations/:conversationId/messages`
- `DELETE /api/conversations/:conversationId/messages`
- `GET /api/preferences/:userId`
- `POST /api/preferences/:userId`
- `GET /api/memory/:userId`

## Example chat response

`POST /api/chat` returns a structured payload with:

- success flag
- classification
- strategy
- execution plan
- models used
- APIs used
- final answer
- artifacts and candidate previews
- processed attachments
- memory used
- duration metadata

## Manual test scenarios

1. Simple question:
   `Explique simplement ce qu'est Hydria en 5 lignes.`
2. Code question:
   `J'ai une TypeError dans Node.js quand j'appelle map sur undefined. Donne une stratÃ©gie de debug.`
3. Weather:
   `Quelle est la mÃ©tÃ©o Ã  Paris aujourd'hui ?`
4. Crypto + analysis:
   `Donne le prix du BTC et fais une analyse rapide du contexte.`
5. News + summary:
   `Quelles sont les actualitÃ©s IA rÃ©centes et rÃ©sume-les.`
6. Image OCR:
   Upload an image containing text and ask `Que contient cette image ?`
7. PDF / DOCX summary:
   Upload a document and ask `RÃ©sume ce document`
8. Code file review:
   Upload `*.js`, `*.py`, `*.ts`, etc. and ask `Explique ce fichier` or `Trouve les bugs`
9. Resume an older conversation:
   Create a conversation, send several prompts, switch away, then reopen it from the left sidebar.
10. Preference memory:
   `RÃ©ponds en franÃ§ais.` then save preferences in the sidebar and ask a new question.

## Limits of V1

- heuristic task classifier
- no real multimodal provider integration
- attachment understanding for images relies on OCR rather than native vision
- scanned PDFs may not yield text without a future OCR path
- news, finance, sports, and movie coverage depends on optional external keys
- summarization memory is local and extractive rather than judge-based
- no authentication layer because the app is intended for local use

## V2 roadmap

- stronger task classification through an auxiliary router model
- richer API capability adapters and per-provider health scoring
- vector or semantic memory retrieval
- multimodal routing for image, music, and video
- OCR on scanned PDFs and richer document chunking
- background jobs, caching, and rate-limit management
- team-oriented multi-user auth and permissions

## Important files

- [HydriaAutonomousBrain.js](/c:/Users/Boyer-Vidal/Desktop/hydria/backend/src/core/HydriaAutonomousBrain.js)
- [plannerAgent.js](/c:/Users/Boyer-Vidal/Desktop/hydria/backend/src/agents/plannerAgent.js)
- [executorAgent.js](/c:/Users/Boyer-Vidal/Desktop/hydria/backend/src/agents/executorAgent.js)
- [memoryAgent.js](/c:/Users/Boyer-Vidal/Desktop/hydria/backend/src/agents/memoryAgent.js)
- [ToolRegistry.js](/c:/Users/Boyer-Vidal/Desktop/hydria/backend/src/tools/ToolRegistry.js)
- [JsonMemoryStore.js](/c:/Users/Boyer-Vidal/Desktop/hydria/backend/src/memory/JsonMemoryStore.js)
- [JsonKnowledgeStore.js](/c:/Users/Boyer-Vidal/Desktop/hydria/backend/src/knowledge/JsonKnowledgeStore.js)
- [HydriaBrain.js](/c:/Users/Boyer-Vidal/Desktop/hydria/backend/services/hydria/HydriaBrain.js)
- [planner.js](/c:/Users/Boyer-Vidal/Desktop/hydria/backend/services/hydria/planner.js)
- [classifier.js](/c:/Users/Boyer-Vidal/Desktop/hydria/backend/services/hydria/classifier.js)
- [attachmentService.js](/c:/Users/Boyer-Vidal/Desktop/hydria/backend/services/attachments/attachmentService.js)
- [openrouterService.js](/c:/Users/Boyer-Vidal/Desktop/hydria/backend/services/providers/openrouter/openrouterService.js)
- [apiRouter.js](/c:/Users/Boyer-Vidal/Desktop/hydria/backend/services/apis/apiRouter.js)
- [memoryService.js](/c:/Users/Boyer-Vidal/Desktop/hydria/backend/services/memory/memoryService.js)
- [contextBuilder.js](/c:/Users/Boyer-Vidal/Desktop/hydria/backend/services/memory/contextBuilder.js)
- [schema.sql](/c:/Users/Boyer-Vidal/Desktop/hydria/backend/db/schema.sql)
