# REST API

Base URL through Hydria OS: `http://localhost:3001/crm-api`

Authenticated requests accept either a session JWT or an API key:

```http
Authorization: Bearer <token-or-ncrm-api-key>
```

## Authentication and account security

- `POST /auth/register`, `/auth/login`, `/auth/login/mfa`, `/auth/refresh`
- `POST /auth/forgot-password`, `/auth/reset-password`
- `POST /auth/verify-email`, `/auth/verification/request`
- `POST /auth/accept-invitation`
- `GET /auth/me`, `/auth/sessions`
- `DELETE /auth/sessions/:id`
- `POST /auth/logout`, `/auth/logout-all`
- `POST /auth/mfa/setup`, `/auth/mfa/enable`, `/auth/mfa/disable`
- `GET|POST /users/invitations`, `DELETE /users/invitations/:id`

Invitation, verification and reset links are delivered to
`TRANSACTIONAL_EMAIL_URL`. The relay receives JSON containing `from`, `to`,
`subject`, `text` and `html`. Development responses also expose a debug URL.

## CRM resources

- Contacts, companies, leads, opportunities, stages, products and tasks expose
  list/create/read/update/delete routes.
- Leads support transactional conversion with `POST /leads/:id/convert`.
- Opportunities support line items and quotes under `/products/deals/:dealId`.
- Notes, activities, attachments and custom fields support record timelines.
- `/dashboard`, `/dashboard/preferences`, `/reports` and `/search?q=...`
  provide operational reporting and per-user dashboard configuration.
- `/notifications` provides reminders, assignments and overdue alerts.
- `GET|POST /tickets`, `GET|PATCH|DELETE /tickets/:id`
- `GET|POST /tickets/queues`, `PATCH /tickets/queues/:queueId`
- `POST /tickets/:id/messages`, `POST /tickets/:id/escalate`
- Secure customer portal:
  `POST /tickets/portal/:token/request-access`,
  `POST /tickets/portal/:token/session`,
  authenticated `GET /tickets/portal/:token` and
  `POST /tickets/portal/:token/messages`

Support queues accept `routingStrategy`, `businessHours`, `holidays`,
`pauseStatuses` and a graduated `escalationPolicy`. The worker calculates SLA
deadlines in business minutes, pauses clocks in configured statuses and emits
notifications and ticket events for breaches and escalation levels.
- Ticket attachments use `/attachments` with `entityType: "TICKET"`.
- `GET|POST /custom-objects`, `PATCH|DELETE /custom-objects/:definitionId`
- `GET|POST /custom-objects/:definitionId/records`
- `PATCH|DELETE /custom-objects/:definitionId/records/:recordId`
- Teams and permissions: `GET|POST /users/teams`,
  `PATCH /users/teams/:teamId`, `PATCH /users/:id/permissions`

## Data operations

- `GET /contacts/duplicates`, `POST /contacts/merge`, `POST /contacts/bulk`
- `GET /data/duplicates/:resource` for `companies` and `leads`
- `POST /data/bulk/:resource` for `companies`, `leads`, `deals`, `products`
  and `tasks`
- `POST /data/duplicates/companies/merge`
- `POST /data/duplicates/leads/merge`
- `POST /data/import/:resource`
- `GET /data/export/:resource.csv`
- `GET|POST /saved-views`, `PATCH|DELETE /saved-views/:id`
- `GET /audit-logs`

Bulk deletion requires the literal confirmation `DELETE`.

## Automations

- `GET|POST /automations`
- `PATCH|DELETE /automations/:id`
- `GET /automations/runs/history`

Triggers cover record creation, lead qualification, deal-stage changes, quote
acceptance and overdue tasks. Actions cover owner assignment, task creation,
queued email, field updates and deal-stage moves.

## Communications and integrations

- `GET /integrations`
- `GET /integrations/oauth/config`
- `POST /integrations/oauth/:provider/start`
- `POST /integrations/oauth/callback` (public provider callback exchange)
- `POST /integrations/custom`
- `POST /integrations/:id/sync`, `DELETE /integrations/:id`
- `GET /integrations/readiness`
- `GET|POST /communications/templates`
- `GET|POST /communications/messages`
- `GET /communications/conversations`
- `POST /communications/conversations/:id/read|reply`
- `POST /communications/messages/:id/reply-received`
- `GET|POST /communications/calendar`, `DELETE /communications/calendar/:id`

Google Workspace and Microsoft 365 require their client ID and secret in
`.env`. Email and calendar synchronizations run as persistent background jobs.
Outbound email supports attachments and automatic retries. Custom HTTPS
connectors support accounting, support and marketing systems.

Register this exact web callback in both provider consoles:

```text
http://localhost:3001/crm/oauth/callback
```

Google requires the Gmail and Google Calendar APIs, an OAuth web client and the
configured test users while the consent screen is in testing. Microsoft Entra
requires a Web redirect URI, a client secret and delegated permissions
`User.Read`, `Mail.ReadWrite`, `Mail.Send` and `Calendars.ReadWrite`.

`GET /integrations/oauth/config` never exposes credentials. It returns the
callback URI, provider readiness, missing environment variable names and a
link to the provider console.

The CRM uses a popup-safe authorization-code flow with server-side one-time
state storage and PKCE. This also works when the CRM iframe uses `127.0.0.1`
while the registered callback uses `localhost`.

## Quotes, signatures, invoices and payments

- `GET|PATCH /commercial/quotes/:id`
- `GET /commercial/quotes/:id/history`
- `POST /commercial/quotes/:id/versions|approvals|signatures|invoices`
- `GET /commercial/approvals/inbox`
- `POST /commercial/approvals/:id/decision`
- Public electronic signature: `GET|POST /commercial/signatures/:token`
- `GET /commercial/invoices`, `GET|PATCH /commercial/invoices/:id`
- `GET /commercial/invoices/:id/pdf`
- `POST /commercial/quotes/:id/send`, `POST /commercial/invoices/:id/send`
- `POST /commercial/invoices/:id/checkout`
- `POST /commercial/invoices/:id/payments`
- `POST /commercial/payments/:id/refunds`
- `POST /commercial/invoices/:id/credit-notes`
- `POST /commercial/invoices/:id/reminders`
- `POST /commercial/invoices/:id/push/:connectionId`
- `GET|POST /commercial/goals`, `DELETE /commercial/goals/:id`

Stripe checkout and webhook processing require `STRIPE_SECRET_KEY` and
`STRIPE_WEBHOOK_SECRET`.

## Platform APIs

- API keys: `GET|POST /api-keys`, `DELETE /api-keys/:id`
- Webhooks: `GET|POST /webhooks`, delivery history and retry routes
- Consent/privacy: `/compliance/consents`, `/compliance/privacy-requests`
- Retention: `GET|PUT /compliance/retention`, `POST /compliance/retention/run`
- Monitoring: `GET /monitoring/summary`, `GET /monitoring/errors`
- Background jobs: `GET /monitoring/jobs`, `POST /monitoring/jobs/:id/retry`
- Backups: `GET /backups/export`, `POST /backups/restore`
- Scheduled backups: `GET|PUT /backups/schedule`, `POST /backups/schedule/run`

Backup schema v4 contains business, communication, automation, quote,
invoicing, support tickets, SLA queues, teams, permission policies, custom
objects, campaigns, territories, sequences, saved reports and GDPR records
plus attachments. API keys, OAuth tokens, webhook
secrets and backup credentials are intentionally excluded. Restore replaces
the active organization's data and requires multipart confirmation `RESTORE`.

API key scopes are enforced on every API-key request: `crm:read`,
`crm:write`, `crm:commercial`, `crm:communications` and `crm:admin`.
Persistent jobs cover email delivery, webhook delivery, provider
synchronization and invoice reminders. Failed jobs use exponential backoff and
move to the dead-letter queue after their maximum attempts.

## Hydria OS and Core

Hydria OS uses signed server-to-server requests. `HYDRIA_INTEGRATION_SECRET`
and `CRM_INTEGRATION_SECRET` must match.

- `POST /integrations/hydria/session`
- `POST /integrations/hydria/context`
- `POST /integrations/hydria/query`
- `POST /integrations/hydria/actions`

Canonical operations include create/update for CRM records and tickets, lead
conversion, deal-stage updates, product addition, quote creation, customer
summaries and confirmed sensitive deletion. Ticket operations are
`crm.create_ticket` and `crm.update_ticket`. Hydria OS exposes
`/api/hydria/control` with `workspaceFamilyId: "crm_sales"`.

## Validation gates

With the CRM running:

```bash
cd crm
npm run gate:operations
npm run gate:productivity
npm run gate:platform
npm run gate:resilience
npm run gate:oauth
npm run gate:communications
npm run gate:commercial
npm run gate:tickets
npm run gate:backup-restore
npm run gate:custom-objects
npm run gate:sales-ops
npm run gate:load
npm run test:e2e -w @northstar/web
```

With Hydria OS and Core running:

```bash
cd backend
npm run gate:crm-core
```
