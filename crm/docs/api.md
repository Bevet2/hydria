# REST API

Base URL: `http://localhost:4010/api`

Send the JWT in:

```http
Authorization: Bearer <token>
```

## Authentication

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`

## CRM resources

- `GET|POST /contacts`
- `GET|PATCH|DELETE /contacts/:id`
- `POST /contacts/import`
- `GET /contacts/export.csv`
- `GET|POST /companies`
- `GET|PATCH|DELETE /companies/:id`
- `GET /pipeline`
- `POST /pipeline/deals`
- `PATCH|DELETE /pipeline/deals/:id`
- `POST /pipeline/stages`
- `PATCH /pipeline/stages/:id`
- `GET|POST /tasks`
- `PATCH|DELETE /tasks/:id`
- `GET|POST /timeline/activities`
- `POST /timeline/notes`
- `DELETE /timeline/notes/:id`
- `GET|POST /custom-fields`
- `PUT /custom-fields/:definitionId/values/:entityId`
- `DELETE /custom-fields/:id`
- `GET /dashboard`
- `GET|POST /leads`
- `GET|PATCH|DELETE /leads/:id`
- `POST /leads/:id/convert`
- `GET|POST /products`
- `PATCH /products/:id`
- `GET|POST /products/deals/:dealId/items`
- `DELETE /products/deals/:dealId/items/:itemId`
- `GET /products/quotes`
- `POST /products/deals/:dealId/quotes`
- `PATCH /products/quotes/:id/status`
- `GET /reports`
- `GET /search?q=...`
- `GET|POST /users`
- `PATCH /users/:id/role`

## Login example

```bash
curl http://localhost:4010/api/auth/login \
  -H "content-type: application/json" \
  -d '{"email":"admin@northstar.local","password":"Northstar123!"}'
```
