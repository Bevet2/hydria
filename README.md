# Hydria

Hydria is a local AI workspace operating system with persistent work objects,
live document tools, an agentic execution layer, and an integrated CRM.

The repository currently contains:

- **Hydria OS**: the workspace shell, assistant, projects, work objects, tools,
  memory and live execution runtime.
- **Hydria Core adapters**: governed model routing and live
  `workspace_tool_call` execution.
- **Hydria CRM**: a multi-organization sales platform embedded directly in the
  Hydria CRM workspace.

## Current capabilities

### Hydria OS

- Persistent projects, conversations and work objects backed by SQLite.
- User-wide Docs and Sheets libraries with search, favorites, persistent
  archives and restorable content revisions.
- Dedicated workspace pages for Docs, Sheets, Slides, Dashboard, CRM,
  Automation, App Builder, Whiteboard and Code Studio.
- Operational-transform collaboration for Docs and cell-level collaboration
  for Sheets, with presence, offline replay, autosave and revision history.
- Live HTML/CSS/JavaScript runtime and preview surfaces.
- Attachments for images, PDF, DOC/DOCX, text, code and structured data.
- Hydria Core Chat with native upstream streaming, partial-response recovery,
  projects, folders, branching, sharing, citations and file attachments.
- Local tools for workspace inspection, diagnostics and browser previews.
- Local model, OpenRouter and Hydria Core routing.
- Web search, direct URL reading and catalog-driven external APIs.

### Live workspace actions

Hydria OS sends the active workspace context to Core and can apply returned
`workspace_tool_call` actions to the real local work object.

- **Sheets**: HyperFormula-backed incremental calculation, cells, formulas,
  dependency/cycle diagnostics, columns, workbook operations, formatting,
  validation, filters, sorting, tables, charts, protection, import and export.
- **Docs**: sections, paragraphs, blocks, synchronized table of contents,
  footnotes, tables, lists, links, media,
  comments, metadata, DOCX/PDF import and export, and a visual Canvas surface.
- **Slides**: slide creation, content updates and reordering.

Actions are normalized before execution, validated against the active target,
persisted with a revision increment, and recorded in work-object history.

### CRM

- Contacts, companies, leads, opportunities, products, tasks, support tickets
  with business-hours SLA/routing/escalation, and pipelines.
- Lead conversion, duplicate detection and transactional record merging.
- Bulk operations, CSV import/export and saved views.
- Quotes with versioning, approval, signature, discounts, taxes and line items.
- Invoices, due dates, manual payments, Stripe checkout, refunds, credit notes
  and reminders.
- Email templates, conversations, attachments and calendar events.
- Google Workspace and Microsoft 365 OAuth integration.
- Guided automations with execution history.
- Persistent background jobs, retries, exponential backoff and dead-letter
  handling.
- MFA, session management, invitations, password reset and email verification.
- API keys with enforced scopes, webhooks, audit logs and rate limiting.
- Consent, retention, export and anonymization tools.
- Per-user dashboards, monitoring, backups and readiness diagnostics.
- Natural-language CRM actions through Hydria Core.

See [CRM capabilities](crm/docs/crm-capabilities.md) and
[CRM API reference](crm/docs/api.md) for the detailed surface.

## Architecture

```text
hydria/
  frontend/                 Hydria OS browser application
  backend/
    routes/                 Hydria OS REST endpoints
    services/hydria/        Core bridge and workspace action dispatcher
    services/providers/     Local, OpenRouter and Hydria Core providers
    services/attachments/   File extraction and OCR
    services/memory/        Conversation and long-term memory
    src/                    Agentic runtime, tools, projects and work objects
    db/                     SQLite schema and bootstrap
  crm/
    apps/api/               Express, Prisma and PostgreSQL CRM API
    apps/web/               React and Vite CRM application
    docs/                   CRM API, architecture and production guides
  docs/                     Hydria architecture and subsystem guides
  data/                     SQLite data, artifacts and API catalogs
```

Hydria OS owns workspace state and executes local actions. Hydria Core provides
reasoning and proposed actions. The CRM remains a separate PostgreSQL service
and is embedded in Hydria OS with a short-lived integration session.

## Requirements

- Node.js 22 or newer.
- npm.
- Docker Desktop or another PostgreSQL 16 installation for the CRM.
- One optional AI provider:
  - Hydria Core API;
  - OpenRouter;
  - a local Ollama-compatible server.

Google, Microsoft, Stripe, transactional email, alerts and remote backups only
become available when their credentials are configured.

## Quick start

The commands below use PowerShell on Windows.

### 1. Configure Hydria OS

```powershell
Copy-Item backend\.env.example backend\.env
cd backend
npm.cmd install
cd ..
```

Edit `backend/.env` and configure at least one model route when AI responses are
required.

### 2. Configure the CRM

```powershell
Copy-Item crm\.env.example crm\.env
cd crm
docker compose up -d postgres
npm.cmd install
npx.cmd dotenv -e .env -- npm.cmd run db:deploy -w @northstar/api
cd ..
```

Optional demo data:

```powershell
cd crm
npm.cmd run db:seed
cd ..
```

Replace development secrets in `crm/.env` before exposing the application
outside the local machine.

### 3. Start the applications

Terminal 1:

```powershell
cd backend
npm.cmd start
```

Terminal 2:

```powershell
cd crm
npm.cmd run dev
```

### 4. Open the applications

| Service | URL |
| --- | --- |
| Hydria OS | http://localhost:3001 |
| CRM workspace in Hydria | http://localhost:3001/workspace/crm |
| Hydria health | http://localhost:3001/api/health |
| CRM health through Hydria OS | http://localhost:3001/crm-api/health |

## Hydria Core configuration

Hydria has two complementary Core integrations.

### Core as a model provider

This route lets the LLM router use Core for reasoning:

```env
LLM_ROUTING_MODE=core-first
HYDRIA_CORE_ENABLED=true
HYDRIA_CORE_BASE_URL=https://app.hydria.click/api/v1
HYDRIA_CORE_API_KEY=hydria_live_xxx
```

Supported routing modes:

- `core-first`: Core, then local/OpenRouter fallback.
- `core-only`: Core is required.
- `local-first`: local provider first.
- `local-only`, `openrouter-first`, `openrouter-only`.

### Core as a workspace controller

This route sends full workspace context and applies proposed actions locally:

```env
HYDRIA_API_URL=https://app.hydria.click/api/v1/ask
HYDRIA_CORE_ASK_URL=https://app.hydria.click/api/core/ask
HYDRIA_API_KEY=
HYDRIA_EXTERNAL_CONTROL_ENABLED=true
HYDRIA_CONTROL_TOKEN=
```

The forwarded context includes the active work object, workspace family,
content preview, available workspace tools and current target. Hydria OS never
delegates persistence or direct filesystem ownership to Core.

Main integration endpoints:

- `GET /api/hydria/status`
- `GET /api/hydria/capabilities`
- `POST /api/hydria/ask`
- `GET /api/hydria/control/schema`
- `POST /api/hydria/control`
- `POST /api/hydria/actions`

`POST /api/hydria/actions` requires `HYDRIA_CONTROL_TOKEN` when it is exposed
to an external controller.

## CRM configuration

The local defaults live in [crm/.env.example](crm/.env.example).

Important variables:

- `DATABASE_URL`, `JWT_SECRET`, `SECRET_ENCRYPTION_KEY`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `TRANSACTIONAL_EMAIL_URL`, `TRANSACTIONAL_EMAIL_TOKEN`
- `ALERT_WEBHOOK_URL`
- `HYDRIA_INTEGRATION_SECRET`

`HYDRIA_INTEGRATION_SECRET` in `crm/.env` must match
`CRM_INTEGRATION_SECRET` in `backend/.env`.

Provider readiness is visible in the CRM platform administration screen and
through `GET /api/integrations/readiness`.

## Validation

### Hydria OS and Core

```powershell
cd backend
npm.cmd run smoke:hydria-core-adapter
npm.cmd run gate:workspace
npm.cmd run gate:work-object-library
npm.cmd run gate:collaboration-formulas
npm.cmd run gate:crm-core
npm.cmd run gate:hydria-interactions
npm.cmd run test:visual-workspace
```

### CRM

```powershell
cd crm
npm.cmd run typecheck
npm.cmd run build
npm.cmd run gate:operations
npm.cmd run gate:productivity
npm.cmd run gate:platform
npm.cmd run gate:resilience
npm.cmd run gate:oauth
npm.cmd run gate:communications
npm.cmd run gate:commercial
npm.cmd run gate:load
npm.cmd run gate:tickets
```

CRM browser tests:

```powershell
cd crm\apps\web
npm.cmd run test:e2e
```

The GitHub Actions workflow is defined in
[crm-ci.yml](.github/workflows/crm-ci.yml).

## Production

The CRM includes Docker definitions for local and staging environments:

```powershell
cd crm
docker compose --env-file staging.env -f docker-compose.staging.yml up -d --build
```

Before staging:

1. Copy `crm/staging.env.example` to `crm/staging.env`.
2. Replace every secret and provider credential.
3. Register the exact Google and Microsoft OAuth redirect URL.
4. Put the CRM web and API services behind HTTPS.
5. Configure remote backups, transactional email and external alerts.

See [production and recovery](crm/docs/production.md).

## Documentation

- [Hydria architecture](docs/architecture.md)
- [Work objects](docs/work-objects.md)
- [Runtime](docs/runtime.md)
- [Memory](docs/memory.md)
- [Knowledge](docs/knowledge.md)
- [Evaluations](docs/evals.md)
- [Evolution loop](docs/evolution.md)
- [Adding an agent](docs/adding-agent.md)
- [Adding a tool](docs/adding-tool.md)
- [CRM README](crm/README.md)
- [CRM architecture](crm/docs/architecture.md)
- [CRM API](crm/docs/api.md)
- [CRM production guide](crm/docs/production.md)

## Security

- Never commit `.env`, OAuth client secrets, Stripe keys or Hydria API keys.
- Use independent high-entropy values for JWT and encryption secrets.
- Keep API-key scopes minimal.
- Require confirmation for destructive workspace and CRM operations.
- Use HTTPS for OAuth callbacks, webhooks, backups and production traffic.
- Test database and attachment restoration regularly.

## License

The CRM subproject is distributed under the license in
[crm/LICENSE](crm/LICENSE). Check repository ownership requirements before
redistributing the complete Hydria codebase.
