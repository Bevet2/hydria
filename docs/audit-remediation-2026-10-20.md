# Audit remediation — 20 October 2026

Baseline: main `931f6e3`. This change addresses the findings in the critical
audit without asserting that a private owner gateway is multi-user SaaS.

## Changes and regression evidence

| Finding | Change | Verification |
| --- | --- | --- |
| A01 — MFA challenge accepted as access | Separate JWT audiences and purposes; runtime validation of every identity/session claim; account/session/tenant validation | `auditSecurityGate.ts`, `auditIsolationGate.ts` |
| A02 — default bridge secret / shared admins | Optional bridge disabled without a secret; production refuses weak/example secrets and requires an existing tenant UUID; local IDs namespaced by instance and tenant; MEMBER accounts and five-minute revocable sessions | Production configuration checks, real HTTP CRM session tests |
| A03 — sensitive User relations | Response-boundary recursive redaction, including nested relations; preserves dates and Prisma Decimal serialization | Token/redaction gate and HTTP task response test |
| A04 — silent JSON loss | Reject corrupt state; atomic temporary-file writes, fsync and rename; previous JSON copy; source save journal and restart recovery; serialized artifact index updates | Corruption, failed render and interrupted-save tests |
| A05 — concurrent saves | Process-wide keyed document lock; revision check inside the lock; failed exports restore original content | Concurrent save produces one success and one 409 |
| A06 — destructive AI actions | Server-owned operation risk policy; accessible confirmation dialog; signed, expiring, single-use consent bound to profile, target and revision | `osActionConsentGate.mjs` and mobile confirmation test |
| A07 — provider routing | Availability separated from preference; premium and explicit model overrides respect local-only/core-only policy | Routing matrix with all six modes |
| A08 — profile import bypass | Mandatory profile for HTTP content writes; imports use the same owner and data-role checks as reads | Cross-profile import and missing-profile checks |
| A09 — generic URL reader | Public IP/DNS validation, pinned lookup, redirect revalidation, credential stripping, finite redirects/deadline/response bytes | Private IPv4/IPv6, redirect and public-read tests |
| A10 — 39 unavailable CRM tools | Client and server read one shared 25-operation registry; signed capabilities endpoint | Single packaged JSON definition, build and CRM tests |
| A11 — nested UI | One heading/save status, native fullscreen controls, compact mobile menus, mobile document reflow, localized main navigation, no remote font dependency | Six-editor browser gates, keyboard/drag tests, mobile edit-save-reload |
| A12 — maintenance / misleading scores | Extract spreadsheet definitions and initial workspace state; minified production ESM bundle with shared chunks; mark benchmark results as internal heuristics; candidates no longer count as factual evidence | Production build and independent acceptance regressions |

The source modules still warrant gradual editor-by-editor refactoring. This
change does not claim to replace the full editing architecture or to certify
Office rendering fidelity on a large real-world corpus. Visual simplification
and passing browser scenarios are concrete improvements, not a usability
certification or a claim that every native editor label has been localized.

## Integration with Drive and ArtCraft

The security branch is reconciled with main `4470987`, retaining Drive,
PDF Studio, PhotoCraft, FigCraft and the image revision history. Production
bundling leaves installed `frontend/vendor` runtimes byte-for-byte unchanged;
CI compares the official installed distributions with the bundled output.
The Docker image retains the optional verified ArtCraft installation steps.
Drive acceptance waits for profile hydration and searches the created title,
so localization and previously created documents do not invalidate the test.
These changes do not add direct editor write-back or multi-user authorization.

## Deployment migration

1. Stop writes and take a verified backup before updating. Existing data
   formats are preserved; the added journals and `.previous` files are not a
   substitute for external backups.
2. Re-authenticate CRM clients. Older access tokens have no access audience,
   purpose or required session binding and are rejected.
3. For production CRM, configure independent random JWT/encryption secrets
   of at least 32 characters. Example values are refused. Keep existing valid
   encryption keys when updating an installed CRM: rotating an encryption key
   without re-encrypting stored provider/MFA secrets makes them unreadable.
4. Leave the CRM bridge disabled unless needed. To enable it, set matching
   `HYDRIA_INTEGRATION_SECRET` (CRM) and `CRM_INTEGRATION_SECRET` (OS), provision
   `HYDRIA_INTEGRATION_ORGANIZATION_ID` with an existing CRM organization UUID,
   and set a stable `HYDRIA_INTEGRATION_INSTANCE_ID`. Bridge-created profiles
   are members, not administrators. No existing user or CRM record is deleted.
5. Build the OS production frontend with `npm run build:frontend --prefix
   backend`. The Docker image does this automatically, then drops build-only
   dependencies. Source development mode continues to serve the original
   modules. The lightweight OS image still deploys separately from CRM.

If a catalog becomes unreadable, writes stop. Shut down the instance, verify
a full backup and restore it to a new directory using the backup utility.
The `.previous` catalog can help manual recovery but may precede the latest
successful operation. Never overwrite a running instance with a guessed empty
catalog. A pending content-save journal restores the pre-save content on the
next process start when the catalog commit was not completed.

## Security and deployment boundaries

OS remains a private single-owner application behind HTTP Basic and HTTPS.
Profile IDs are organization/UI selectors, not authenticated independent
accounts. This work closes the specific missing-profile/import inconsistencies;
it does not make user-supplied profile IDs a security identity. A public OS
requires session-based identity and tenant authorization across all routes.

JSON/file writes and locks assume one backend process. Do not run multiple
writers against the same data directory. Source content and its catalog have
recovery support; generated previews can be regenerated and are not a
distributed transaction. A live backup spanning SQLite, JSON and assets is
not a globally atomic snapshot; pause writes for a consistent full-instance
backup.

The public web reader rejects local/private addresses. Deliberate localhost
browser previews belong to the separate privileged local tools; do not enable
those tools for untrusted public users. External providers, DNS, TLS, payments
and OAuth need deployment-specific live validation.

## Dependencies and licensing

The dependency updates include official SheetJS 0.20.3, patched upload/archive
libraries, React Router 7, and tested transitive overrides for image-size,
argparse and deepmerge-ts. Prisma CLI is managed at the CRM workspace root
so the transitive security override is applied consistently rather than lost
across a workspace link. Verify a clean install with `npm ci`, then run the
audit and product gates; do not regenerate a lockfile by blindly forcing major
upgrades.

`npm audit` is a dependency database check, not proof of exploitability or a
complete security assessment. No project-wide distribution license was
invented; that business/legal decision and the corresponding HyperFormula
terms remain explicit in `THIRD_PARTY_NOTICES.md`.

## Commands

```bash
npm ci --prefix backend
node backend/scripts/auditSecurityGate.mjs
node backend/scripts/osActionConsentGate.mjs
node backend/scripts/buildFrontend.mjs
node backend/scripts/runLocalValidation.mjs osBugHuntApi osExportSmoke osProductUiGate osEditorWorkbenchGate osAuditUxGate

cd crm
npm ci
npm run db:generate
npm run typecheck
npm run build
node --import tsx apps/api/scripts/auditSecurityGate.ts
# Against a disposable running CRM + PostgreSQL:
node --import tsx apps/api/scripts/auditIsolationGate.ts
```

CI also runs the existing Flow, collaboration, production, Office-export and
browser regressions. Inspect its screenshots and failures before merging.
