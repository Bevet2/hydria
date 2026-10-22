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
`requireVerifiedIdentity(identity)` middleware exists for progressively binding
those routes to a verified account, but is **not** a global policy yet. A
cookie does **not** make the existing Docs, Drive, CRM, Flow, assets, search or
shared-file routes safe for multiple unrelated users. Keep the single-owner
production access restriction; do not offer independent accounts to external
users yet.

Next security slices:

1. Bind all user-scoped read/write endpoints to `req.hydriaIdentity.id` and
   reject spoofed IDs, starting with project/work-object detail and assets.
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

The gate performs an actual HTTP exchange with two distinct identities, checks
revocation, expiration, cookie attributes, ID spoofing and retry throttling,
and provisions a persisted SQLite account through a separate CLI process.
