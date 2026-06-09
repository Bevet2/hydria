# Northstar CRM architecture

Northstar CRM is an original implementation. It does not reuse Twenty CRM source code, schemas or visual assets.

## Applications

- `apps/web`: React, TypeScript and Vite single-page application.
- `apps/api`: Express REST API, JWT authentication and role checks.
- `apps/api/prisma`: PostgreSQL schema, migrations and demo seed.

## Tenant model

Every CRM record belongs to an `Organization`. The authenticated JWT carries the user and organization identifiers, and every query includes the organization scope.

Roles:

- `ADMIN`: workspace, users and data model administration.
- `MANAGER`: operational data and custom field administration.
- `MEMBER`: CRM record creation and updates.
- `VIEWER`: read-only access.

## Main domains

- Identity: organizations, users and roles.
- Accounts: companies and contacts.
- Prospecting: leads, qualification and transactional conversion.
- Revenue: deals, configurable pipeline stages and forecast categories.
- Catalog: products, opportunity line items and quotes.
- Work: tasks, notes and activities.
- Extensibility: custom field definitions and JSON values.

Lead conversion creates the company, contact and optional opportunity in a single PostgreSQL transaction. Opportunity amounts are recalculated from product line items by the API. Quotes copy those line items into an immutable commercial snapshot.

The Hydria application exposes the CRM as a dedicated `/workspace/crm` page. New Hydria CRM work objects use the `crm_sales` workspace family and include a runnable preview plus a pointer to this full application.
