# SHBACE Medical Cloud Platform

This is an additive Cloudflare backend. The existing Vercel deployment, PWA offline bundle, Android/Capacitor app, local question bank, and current user data remain the primary production experience until a separately tested client integration is enabled.

## Services

- **Workers**: versioned API and admin console.
- **D1**: release metadata, feature configuration, and admin audit events.
- **D1**: immutable, versioned JSON question-bank snapshots stored in bounded text chunks; this avoids requiring R2 billing activation.
- **KV binding**: reserved for future low-latency configuration/cache use.
- **Worker HTML response**: serves the admin console from the Worker root.

## Current API

Public:
- `GET /v1/health`
- `GET /v1/release`
- `GET /v1/question-bank` (returns the active published bank; supports ETag)

Admin (requires `Authorization: Bearer <ADMIN_API_TOKEN>`):
- `GET /v1/admin/releases`
- `POST /v1/admin/releases` with `{ "version": "1.1.1", "channel": "stable", "bank": { "questions": [], "order": {} } }`
- `POST /v1/admin/rollback` with `{ "version": "1.1.0" }`
- `PUT /v1/admin/features` with `{ "features": { "remoteQuestionBank": false, "flashcards": false, "cloudProgressSync": false } }`

The admin console is served at the Worker root URL. Question-bank snapshots are stored in D1 as bounded chunks; R2 is not required or enabled in this no-additional-billing setup. It keeps the token in sessionStorage for the current browser session only. Never put the admin token in app JavaScript, HTML source, GitHub files, or Vercel public environment variables.

## Provisioning

From this directory, with Wrangler authenticated to the intended Cloudflare account:

1. Install: `npm install`
2. Create D1: `npx wrangler d1 create shbace-medical-db`
3. Create KV: `npx wrangler kv namespace create SHBACE_FLAGS`
4. Put the returned D1 database ID and KV namespace ID into `wrangler.toml`.
5. Apply schema: `npm run db:migrate:remote`
6. Set the `ADMIN_API_TOKEN` secret in the Cloudflare Dashboard (or `npx wrangler secret put ADMIN_API_TOKEN` from an authenticated local terminal).
7. Deploy: `npm run deploy`
8. Test `/v1/health`, then open the Worker root and connect with the admin token.

The `ADMIN_API_TOKEN` must be a long random secret (at least 32 random bytes). Store it in a password manager. Do not commit it.

The D1 and KV resources are already provisioned in the linked Cloudflare account. R2 is intentionally not used because the account owner declined any additional-billing authorization. The Worker has been uploaded to the `shbace-medical` workers.dev subdomain; set `ADMIN_API_TOKEN` before using administration endpoints.

## Safe rollout policy

1. Publish a cloud snapshot first; do not overwrite `data/qbData.json`, `data/qbData_reviewed.json`, the reviewed patch, or the audit logs.
2. Validate the remote bank and compare its question IDs/count with the local baseline.
3. Integrate the app client behind an explicit remote-content feature flag, retaining local fallback and existing original/reviewed selection.
4. Test online update, offline launch, interrupted update, rollback, and Android/PWA behavior on a preview deployment.
5. Enable remote delivery only after parity checks. Vercel remains the app host.

Cloud progress sync, user accounts, and private per-user data are intentionally not activated by this first backend slice. They require a separate privacy/security design, authentication provider, consent flow, export/delete controls, and conflict-resolution tests.
