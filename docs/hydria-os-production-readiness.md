# Hydria OS — readiness for a private production pilot

**Scope:** one private owner/workspace behind TLS. This is **not yet a
multi-tenant public SaaS**. Hydria CRM has a separate authentication and
deployment lifecycle and is not covered by these guarantees.

## Required configuration

- `NODE_ENV=production` enables the access gate for every API route,
  frontend page, static asset, and downstream CRM proxy route.
- `HYDRIA_OS_ACCESS_USERNAME` — 3–64 ASCII alphanumeric, dot, dash, underscore.
- `HYDRIA_OS_ACCESS_PASSWORD` — a unique generated secret of at least 20
  characters; never commit it, pass it in URLs, or write it in logs.
- `HYDRIA_OS_PUBLIC_ORIGIN` — full **HTTPS origin** without path, e.g.
  `https://os.example.org`. All authenticated unsafe requests with a
  different browser Origin, or `Sec-Fetch-Site: cross-site`, are refused.
- `HYDRIA_OS_DATA_DIR` — writable, durable filesystem location (defaults to
  `data/` in the project). Includes SQLite database and generated artifacts.

The app **refuses to start in production** when the user, password or
HTTPS origin is missing or invalid. Development remains unchanged.
`/livez` returns only `ok` and can be used by an internal load balancer
without exposing database details. `/api/health` and all actual data require
HTTP Basic authentication. Browsers prompt for the credential automatically;
same-origin API requests inherit the authenticated session.

**HTTPS is mandatory.** The backend itself is plain HTTP and must sit behind
a correctly configured TLS reverse proxy. Never expose its port directly to
the public Internet or use the Basic password over plaintext HTTP.

A production deployment defaults **privileged local workspace tools** to
disabled unless `ENABLE_LOCAL_TOOLS=true` is explicitly set. Enabling them
requires a separate security review of their permissions and filesystem
access. Native Hydria Core providers and other optional services need their
own credentials and reachability checks.

## Security boundaries

- This is a **single shared owner password**, not fine-grained user identity.
  The UI's internal user selectors are not tenant isolation.
- Sharing links outside the owner account will not work without signing in
  through the gateway first.
- HTTP Basic does not support logout/token revocation except by changing
  credentials. Password rotation requires a restart.
- The independent CRM may require its own session headers. The proxy now
  strips OS Basic credentials instead of forwarding them downstream.
- The embedded CRM reverse proxy also removes hop-by-hop and untrusted
  forwarding headers. It sets the public HTTPS host/protocol from
  `HYDRIA_OS_PUBLIC_ORIGIN`, preserves CRM Bearer tokens and request bodies,
  and returns a generic HTTP 503/504 when its upstream is disconnected or
  exceeds `CRM_API_TIMEOUT_MS` (default 15 seconds). The proxy aborts
  upstream work after the client disconnects. Do not publish the downstream
  CRM API directly without its own authentication and network controls.
- Requests that do not send Origin and Fetch Metadata (e.g. automation
  clients) still require the owner password. API clients should also control
  their own requests and secrets.
- Database and saved flow snapshots are not encrypted at rest. Protect
  persistent-volume permissions, encrypted disks and backups.
- Public signup, user invitation, workspace ACLs, distributed scheduler,
  rate-limited login, OAuth/SSO, audit and intrusion monitoring are future
  milestones; do not present this gateway as a complete security solution.

## ArtCraft embedded editors in production

PDF Studio, Photo Studio et Design Studio intègrent respectivement PdfCraft,
PhotoCraft et FigCraft dans une `iframe` **sur la même origine** que Hydria OS.

Par défaut, toutes les autres ressources du serveur refusent l'intégration
(`X-Frame-Options: DENY`, `Content-Security-Policy: frame-ancestors 'none'`).
**Seuls** les points d'entrée exacts suivants permettent `SAMEORIGIN` et
`frame-ancestors 'self'` :

- `/vendor/pdfcraft/index.html`
- `/vendor/photocraft/index.html`
- `/vendor/figcraft/index.html`

Le middleware Node ajoute ces en-têtes après contrôle de l'authentification
Basic. Le proxy Caddy doit **transmettre les en-têtes d'Express** ; n'ajoutez
pas de règle globale `X-Frame-Options: DENY` ou de politique
`frame-ancestors 'none'` qui écraserait cette exception, faute de quoi
les éditeurs intégrés ne fonctionneront pas en production.

Ce réglage n'autorise pas les autres sites à embarquer les éditeurs Hydria,
ne donne pas d'accès public aux bundles WASM, et **n'isole pas** les moteurs
open source de la page parent : une iframe avec `allow-scripts` et
`allow-same-origin` demeure du code exécuté avec la confiance de l'origine.
La vérification SHA-256 des bundles et un pilote mono-propriétaire restent
des précautions, pas une sandbox de sécurité complète. Pour un SaaS public,
prévoir une origine isolée et un protocole inter-frame à permissions bornées.

Les tests `productionAccessGate.mjs` et `productionBrowserGate.mjs`
valident l'allowlist, la conservation des refus par défaut, les ressources
authentifiées et le chargement de trois éditeurs factices dans Chromium.
Ils ne remplacent pas un test visuel des vrais moteurs sur le VPS.

## Deployment acceptance gates

Run these from a checkout with `npm ci --prefix backend`:

```bash
node backend/scripts/productionAccessGate.mjs
node backend/scripts/productionBootGate.mjs
```

The gates cover failed startup configuration, credentials, unsafe-origin
rejection, private API and frontend access, and SQLite persistence across
a real Node process restart. The same gates run in the OS GitHub Actions CI.

Deployment also requires: HTTPS certificate, reverse proxy, secrets
injected outside Git, durable data mount, backup + restore test,
monitoring and rollback instructions. See the Docker/TLS deployment
documentation before exposing any instance to users.
