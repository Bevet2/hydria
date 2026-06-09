# Northstar CRM

Northstar CRM is an original open source CRM built for this repository. It takes inspiration from the clarity and object-focused workflows of modern CRMs without copying Twenty CRM source code or visual assets.

## V1 features

- Contacts and companies
- Lead qualification and transactional lead conversion
- Deals with a drag-and-drop sales pipeline
- Forecast categories and team forecast reports
- Product catalog, opportunity line items and quotes
- 360-degree record pages with related data and activity timelines
- Global CRM search
- Tasks, notes and activities
- Custom field definitions and values
- CSV contact import and export
- JWT authentication
- Admin, manager, member and viewer roles
- REST API
- Responsive React interface
- PostgreSQL and Prisma
- Docker Compose

## Quick start with Docker

```bash
cp .env.example .env
docker compose up --build
```

The CRM is available at `http://localhost:4174` and the API at `http://localhost:4010/api`.

The Hydria workspace entry is available at `http://localhost:3001/workspace/crm`.

Default seeded account:

```text
admin@northstar.local
Northstar123!
```

Change the password and `JWT_SECRET` outside local development.

## Local development

```bash
npm install
cp .env.example .env
docker compose up -d postgres
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Web: `http://localhost:5174`

API: `http://localhost:4010/api`

Architecture and endpoint references:

- `docs/architecture.md`
- `docs/api.md`
- `docs/crm-capabilities.md`
- `docs/production.md`

## Structure

```text
crm/
  apps/
    api/   Express, Prisma, JWT and REST modules
    web/   React, TypeScript and Vite
  docker-compose.yml
```

## License

MIT
