# Hydria OS — verified identity foundation (P0, partial)

## What this does

The existing `users` records are legacy display-name profiles, **not** verified
accounts. The new optional account-credential tables attach salted `scrypt`
password hashes to an **existing** user record and persist only SHA-256 hashes
of random 256-bit session tokens. Issuing a new password revokes all old
sessions for that user. Session verification never trusts a client-provided
`userId`; shared browser cookies are `HttpOnly`, `SameSite=Strict`, and `Secure`
in production. Login is rate-limited in each server process.
The same-origin `/crm-api` proxy strips the Hydria identity cookie before
forwarding to CRM and blocks any upstream attempt to overwrite that cookie,
while retaining CRM's own authentication cookies.

The HTTP session endpoints are available under the **existing** Hydria access
gate (production still requires Basic authentication and an HTTPS origin):

- `POST /api/identity/session` with `{ "username": "...", "password": "..." }`:
  issue a cookie, return only the verified public account identity.
- `GET /api/identity/session`: return the verified account for the cookie.
- `DELETE /api/identity/session`: revoke the cookie token and expire the cookie.

There is **no** self-service password registration. Existing profiles cannot
be claimed just by guessing their username.

## Opt-in authenticated project and document reads (next slice)

The following additional routes require the above session cookie. They always
resolve the actor from `req.hydriaIdentity.id`, never from a query parameter:

| Endpoint | Response | Visibility |
| --- | --- | --- |
| `GET /api/projects/mine` | `projects` | Projects owned by the account |
| `GET /api/projects/mine/:projectId` | `workspace` | Owned project or explicitly shared work objects only |
| `GET /api/projects/mine/:projectId/workspace` | `workspace` | Same scoped project navigator |
| `GET /api/work-objects/mine` | `workObjects` | Owned and directly shared objects |
| `GET /api/work-objects/mine/search?q=...` | `results` | Search restricted to those objects |
| `GET /api/work-objects/mine/:workObjectId?content=1` | `workObject` | Detail and editable source content, if authorized |

Authentication errors return `401`; attempting to impersonate another
`userId` or read someone else's private work object returns `403`. A project
that is not accessible returns `404`. Responses set `Cache-Control: no-store`.
Project listings include owned projects; collaborators can open an explicitly
shared project's navigator by ID without gaining its private documents **or
private project metadata** (including the project graph, plan, exports and
unshared work-object IDs). Collaborators receive a generic `Shared project`
label with only their shared work objects in the navigator.

`WorkObjectService.get` now accepts an optional `actorUserId`. When present,
it enforces read permissions before loading content; absent actor retains the
legacy internal/private-pilot behavior until the API migration is complete.

## Opt-in authenticated document mutations (versioned slice)

The following routes also require the verified session cookie and derive their
actor from that session, not from a caller-provided `userId`:

| Method and endpoint | Body | Required role |
| --- | --- | --- |
| `PATCH /api/work-objects/mine/:workObjectId` | `{ "title": "New title", "expectedRevision": 3 }` | Editor or owner |
| `POST /api/work-objects/mine/:workObjectId/trash` | `{ "expectedRevision": 3 }` | Editor or owner |
| `POST /api/work-objects/mine/:workObjectId/restore` | `{ "expectedRevision": 4 }` | Editor or owner |

`expectedRevision` is a required positive integer matching the current object
revision. A stale revision returns `409` and does not overwrite the current
state. Invalid titles or missing revisions return `400`; unauthorized users
receive `401`/`403`. Successful responses disable caching and include the
updated work object and its new revision. These operations are reversible;
an attempt to trash an already trashed document (or restore an active one)
returns `409` without changing its previous recovery status. There is no
authenticated permanent-delete route in this slice.

The original, unscoped document APIs are **unchanged and still restricted to
the private single-owner pilot**. These new routes are an incremental contract
for a future authenticated UI, not a multi-tenant launch.

## Provision an existing profile

Use the normal `HYDRIA_OS_DATA_DIR` pointing to the deployment's persistent
SQLite data directory. The backend must have created the legacy user profile
first. From the project root, in a trusted operator shell:

```bash
read -r -s -p 'Hydria identity password: ' HYDRIA_IDENTITY_SECRET
printf '\n'
printf '%s\n' "$HYDRIA_IDENTITY_SECRET" | node backend/scripts/provisionHydriaIdentity.mjs existing_username
unset HYDRIA_IDENTITY_SECRET
```

The password never appears in command arguments or server logs. A password
rotation invalidates previously issued sessions. Do not run this against the
wrong `HYDRIA_OS_DATA_DIR` or while treating display-name profiles as accounts
for multiple people.

## Explicit limitations — not multi-user production readiness

This tranche establishes **proof of identity**, not complete **authorization**.
The old user selection UI and many existing API routes still accept client
`userId` or use single-owner implicit access. The new
`requireVerifiedIdentity(identity)` middleware binds the opt-in read routes
above to a verified account, but is **not** a global policy yet. A
cookie does **not** make the existing Docs, Drive, CRM, Flow, assets, search or
shared-file routes safe for multiple unrelated users. Keep the single-owner
production access restriction; do not offer independent accounts to external
users yet.

Next security slices:

1. Continue migrating the existing project/work-object endpoints, file content
   edits, history, sharing, exports and assets to the verified actor, then switch
   the UI to the scoped equivalents. The first rename/trash/restore routes are
   implemented but the legacy UI still uses its historical APIs.
2. Separate explicit public share-token endpoints and internal service access
   from interactive private user access, with tests for every file operation.
3. Bind conversation, preferences, Drive native assets, Flow, CRM and other
   workspaces to the same identity; add durable per-account resource ownership.
4. Add account login/logout UX and remove the legacy identity selector once
   every sensitive API is covered; review reverse-proxy, session expiry,
   cross-site request protection, multi-instance rate limits and recovery.

## Verification

```bash
npm run gate:identity-sessions --prefix backend
```

The gate performs real HTTP exchanges with two distinct identities, checks
revocation, expiration, cookie attributes, ID spoofing and retry throttling,
provisions a persisted SQLite account through a separate CLI process, then
checks project navigation, private file content, explicit document sharing and
cross-account search with the full Hydria backend.
