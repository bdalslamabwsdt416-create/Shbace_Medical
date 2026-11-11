# SHBACE Cloud Platform — rollout plan

## Guardrails
- Keep Vercel as the public app host.
- Preserve `main`, the original release branch, and backup branches.
- Keep the 1,718-question original bank immutable.
- Keep reviewed corrections and review/audit records separate.
- Preserve the current local-first/offline behavior and all Android/Capacitor features.
- Never enable a remote dependency until a working local fallback is verified.

## Phases

### Phase 1 — isolated cloud foundation
- Add a Cloudflare Worker API, D1 release/config/audit schema, R2 content snapshots, and a private admin console.
- Create health, active-release, question-bank, publish, rollback, and feature-switch endpoints.
- Deploy to a non-production Worker URL and validate the API.

### Phase 2 — account provisioning
- Create D1, R2, and KV resources in the owner's Cloudflare account.
- Set Worker secrets outside Git.
- Apply migrations and deploy the Worker.
- Record the Worker URL and verify CORS against the Vercel app origin.

### Phase 3 — read-only app integration
- Add an optional client adapter to read release metadata.
- Keep local question-bank selection as the default.
- Verify schema compatibility, IDs, count, checksums, caching, offline fallback, and rollback before enabling remote reads.

### Phase 4 — controlled content publishing
- Publish versioned snapshots from the admin console.
- Add dry-run diff and validation before activation.
- Add content provenance and audit history for every release.

### Phase 5 — remote feature delivery
- Add server-driven feature switches and release compatibility rules.
- Deliver web-only features through Vercel deployments while preserving native APK boundaries.
- Require a new APK when a change needs native Android code or new native permissions.

### Phase 6 — user services (separate security review)
- Design user authentication and per-user progress sync.
- Add consent, encryption, data export/deletion, device conflict handling, and backup/restore.
- Do not enable user-data sync until these controls are tested.

## Current blocker
Cloudflare account resources and credentials are not available to this repository connection. The backend scaffold can be reviewed and committed independently, but provisioning/deployment requires the account owner to authenticate Wrangler or provide a scoped Cloudflare API token through a secure secret mechanism. Do not paste the token into chat or commit it.
