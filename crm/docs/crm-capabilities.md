# CRM capability map

## Available

- Session authentication, refresh rotation, password reset, invitations and
  email verification
- TOTP MFA, recovery codes, active-session review and remote revocation
- Organization isolation, admin/manager/member/viewer roles, teams and
  object/property permission policies
- Contacts, companies, leads, lead conversion, opportunities and pipelines
- Products, editable quote lines, discounts, taxes, PDFs, versions, approval
  inbox and electronic signing
- Invoices, due dates, manual/Stripe payments, refunds, credit notes, reminders
  and accounting connector dispatch
- Tasks, reminders, recurrence, notifications, notes and activity timelines
- Customer-support tickets with automatic routing, business-hours SLA,
  holidays, paused clocks, graduated escalation, threaded public/internal
  messages, attachments, audit history and email-code customer portal
- Fully configurable custom CRM objects with typed fields and records
- Workflow automations, assignment rules and execution history
- Duplicate detection and guided merge for contacts, companies and leads
- Bulk operations and saved views across companies, leads, opportunities,
  products, tasks, quotes and invoices
- CSV import/export for companies, leads, opportunities, products and tasks
- Gmail/Google Calendar and Microsoft mail/calendar synchronization
- Email templates, conversation grouping, attachments, reply tracking and
  meetings
- Sales goals, reports, forecasts, global search and user-configurable
  dashboards including ticket and SLA widgets
- API keys, OAuth connections, signed webhooks and custom HTTPS connectors
- Consent records, privacy export/anonymization/deletion and retention policies
- Persistent job workers with exponential retry, dead-letter administration
  and scheduled Google/Microsoft synchronization
- Audit logs, enforced API scopes, rate limiting, error tracking, external
  alerts and scheduled off-machine backups
- Hydria OS SSO, full CRM context/query access and canonical `crm.*` actions
- Desktop/mobile UI plus operational, productivity, platform, commercial,
  resilience, multi-organization load and E2E gates

## Production configuration

- Register Google and Microsoft OAuth applications and configure redirect URLs.
- Configure the transactional email HTTPS relay for account emails.
- Configure Stripe keys and webhook delivery for live payments.
- Configure an HTTPS backup target and test restore on a separate organization.
- Connect external accounting, support and marketing endpoints as required.
- Repeat the resilience gate against production-sized data before major releases.
- Use `docker-compose.staging.yml`, `staging.env.example` and
  `docs/production.md` for staging, deployment and recovery.

Secrets and provider credentials are never included in CRM backups and must be
restored through the deployment secret store.
