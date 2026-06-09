# Staging, deployment and recovery

## Staging

1. Copy `staging.env.example` to `staging.env` and replace every secret.
2. Register the exact `OAUTH_REDIRECT_URL` in Google Cloud and Microsoft Entra.
3. Put ports `4174` and `4010` behind an HTTPS reverse proxy.
4. Start the stack:

```bash
docker compose --env-file staging.env -f docker-compose.staging.yml up -d --build
```

5. Create the first administrator with the registration screen. Staging and
   production containers do not seed default credentials.
6. Configure the remote HTTPS backup target, transactional email relay,
   external alert webhook and provider credentials from the platform screen.

## Deployment

Before deployment, CI must pass typechecking, builds, all API gates and the
multi-organization load gate. Deploy immutable images or a tagged commit.

```bash
git fetch --tags
git checkout <release-tag>
docker compose --env-file staging.env -f docker-compose.staging.yml build
docker compose --env-file staging.env -f docker-compose.staging.yml up -d
curl --fail https://crm-api-staging.example.com/api/health
```

The API runs `prisma migrate deploy` before starting. Database migrations must
remain backward-compatible with the previously deployed application during a
rolling deployment.

## Backup and recovery

- Keep PostgreSQL volume snapshots in addition to CRM JSON backups.
- Use an HTTPS backup target outside the application host.
- Alert on failed backups and dead-letter jobs.
- Test restoration at least monthly in an isolated environment.

Recovery procedure:

1. Stop writes or place the reverse proxy in maintenance mode.
2. Snapshot the current database and attachment volume.
3. Restore PostgreSQL from the last verified database snapshot.
4. Restore the attachment volume from the matching snapshot.
5. Start the API and run `prisma migrate deploy`.
6. Verify `/api/health`, authentication, tenant isolation, quote totals and one
   attachment download.
7. Run the operations, platform and resilience gates before reopening traffic.

The JSON restore endpoint is intended for organization-level recovery and
requires the explicit `RESTORE` confirmation. It does not restore secrets,
API keys or OAuth tokens.
