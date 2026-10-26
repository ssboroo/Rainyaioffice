# RAINY AI OFFICE · 0.3

**Every team. Every workflow. AI-powered.**

Монгол хэлтэй Universal AI Workforce. Байгууллагын хүмүүс, AI ажилтнууд, баримт болон гүйцэтгэлийг нэг ажлын орчинд нэгтгэнэ.

Live: https://rainy-ai-office-production.up.railway.app

## Product surface

- Organization sidebar, dashboard with real task counts, room navigation, kanban/list task board, command search (`Ctrl/Cmd K`), notifications, team inspector, knowledge library and workflow catalog.
- Nine persisted WebGL 2 office environments: general, research, development, finance, HR, sales, education, government and operations. Actual mesh furniture/characters, rounded geometry, lighting/shadows, orbit/zoom, selection, low-cost rendering toggle, accessible employee buttons, reduced-motion handling and GPU cleanup.
- Custom AI employee creation/editing with role descriptions and instructions. The organization controls its team and its knowledge.
- Tasks with priority, due date, human assignee, attached documents, execution history, comments, review/return and downloadable results.
- Reusable organization workflows and six editable industry request templates. These are starting prompts, not prevalidated domain automation.

## AI execution

Single specialist or Project Manager → 1–5 specialists → Quality Reviewer → human review. Each specialist receives preceding outputs and explicit human feedback. OpenAI Agents API runs with `environment: none`; agents produce text drafts and have no external action tools in this release.

An existing server `OPENAI_API_KEY` can power the platform. Each workspace can alternatively configure its own OpenAI key and model in Settings. Workspace keys are encrypted using AES-256-GCM with workspace-bound authenticated data and are never returned by API/state/exports. `WORKSPACE_SECRET_KEY` must remain stable and backed up securely: losing it prevents decryption of workspace keys and MFA secrets. No real API credential is committed.

“Configured” means a credential exists, not that model access or billing was verified. The service still needs a valid user-supplied API credential for live AI work. No paid live API check has been performed in this development session.

## Durable work queue

- SQLite-backed jobs survive browser disconnects and process restarts while waiting. A job may start immediately or at a specified future time (up to 90 days).
- Up to three global jobs and two per workspace execute concurrently. Priority orders eligible queued jobs. Membership/room access are checked again before dispatch.
- Repeated run requests cannot create another active job for the same task. Provider errors are not automatically retried.
- Cancelling a waiting job prevents execution. Cancelling active work submits the provider's session cancellation event and stops later stages. A warning is retained if provider acceptance cannot be confirmed; API acceptance alone does not prove a remote turn has finished.
- Active jobs become `interrupted` after a process restart. Remote execution is not automatically reconciled or resumed. Inspect persisted session IDs before an explicit retry to avoid duplicate charges.
- Usage caps count API attempts, not dollars or tokens. Provider billing controls remain separate.

This is a **single-replica** deployment. Migrate to a shared database/queue and distributed locks before horizontal scaling.

## Documents and files

Import TXT, MD, CSV, JSON, DOCX, XLSX and text PDF up to 5 MB. Extracted text is capped at 100,000 characters; PDF at 80 pages; XLSX at 20 sheets/10,000 rows. ZIP expansion limits, a two-parser concurrency cap, worker memory bounds and a 20-second timeout constrain untrusted parsing. Image/scan PDF OCR and original document layout fidelity are not included.

Store text revisions and restore an earlier revision as a new one. Attach up to three visible documents, totalling 60,000 characters, to a task. Outputs retain source document IDs; this is explicit context attachment, not vector retrieval or proof that the AI cited each source correctly.

Export AI text into TXT/MD, DOCX, PDF with embedded Mongolian/Cyrillic font, or XLSX. XLSX export stores text lines in rows; it does not infer business tables, formulas or calculations. Generated files must still be checked by the user.

## Security boundaries

- Workspace membership is checked on every scoped request. Owner/admin/member/viewer roles are server-enforced; membership removal takes effect immediately. Owners cannot be removed/demoted; only owners manage administrators.
- Private rooms permit explicit members in addition to organization owners/admins. Room tasks, outputs, comments, notifications and room-scoped documents are filtered and protected on direct routes. Workspace-wide documents remain visible to all workspace members.
- Invitations bind to a recipient email, expire after 24 hours, can be revoked and are consumed once. Email ownership itself is not verified yet; share invite codes only through a trusted channel.
- Scrypt password hashes, hashed session tokens, HttpOnly/SameSite cookies, Secure cookies in production, origin checks, security headers, request limits and login throttles.
- Optional Authenticator TOTP MFA with replay checks and eight hashed single-use recovery codes. Enrolment invalidates existing sessions. A user can change their password or revoke all sessions. There is no email password recovery yet; keep recovery codes securely.
- SQLite data is shared storage with application-enforced tenant boundaries, not separate databases or database RLS. Document/output text is plaintext on the protected volume; encrypt the hosting volume and apply organizational retention rules as needed.
- Audit records are append-only through app routes, but are not cryptographically tamper-evident against database administrators.

## Backups

`DATABASE_BACKUPS=true` creates a daily SQLite-consistent snapshot in the data directory's `backups` folder, retaining three daily snapshots, with private permissions. This protects against application mistakes, not volume loss. Add encrypted off-host backup before critical use. The automated backup test reopens a snapshot and verifies committed data. Workspace administrators can export their own organization records as JSON; credentials and MFA material are excluded. JSON reimport is not implemented.

## Configuration

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Optional platform credential, server-only |
| `OPENAI_MODEL` | Model available to the account, default `gpt-6-astra` |
| `WORKSPACE_SECRET_KEY` | Stable 32-byte base64 encryption key for BYOK/MFA |
| `APP_ORIGIN` | Exact public HTTPS origin, no trailing slash |
| `NODE_ENV` | `production` requires HTTPS origin and enables Secure cookies/HSTS |
| `DB_PATH` | SQLite database file on persistent storage |
| `PORT` | HTTP port; default 3000 |
| `DAILY_AI_CALL_LIMIT` | Workspace daily API attempt cap; default 30, UTC day |
| `DATABASE_BACKUPS` | `true` enables three retained daily local snapshots |

## Run, build, validate

Node.js 24+ is required.

```sh
npm ci
npm start
npm run check
npm test
npm run build
npm run test:build
```

The app reads ignored `.env.local` when present. Create a workspace at `http://localhost:3000`. Core features work without an AI credential; live jobs fail honestly until configured.

The production build bundles browser code and Three.js locally, includes the server/file workers/fonts and emits a SHA-256 manifest. It copies only explicit source directories and never copies `.env` or the database. The multi-stage Dockerfile installs only runtime dependencies in the final image.

```sh
docker build -t rainy-ai-office .
docker run --env-file /secure/office.env -p 3000:3000 -v rainy-data:/data rainy-ai-office
```

Railway service `rainy-ai-office` uses `/data/office/office.sqlite`, `/healthz`, a 500 MB persistent volume, and one replica. Railway starts the bootstrap with `RAILWAY_RUN_UID=0` only to initialize its root-mounted volume directory; `runtime.mjs` clears supplementary groups and permanently drops to UID/GID 1000 before importing the application. Runtime logs verify UID 1000.

## Verification and remaining scope

Automated coverage includes tenant/private-room access, roles, sessions, single-use invitations, queue scheduling/cancellation, encrypted BYOK isolation, MFA/recovery codes, backup reopening, DOCX/XLSX/PDF Unicode round trips, malformed archive rejection, true 3D geometry/raycast/disposal and nine environments. DOM interface tests validate navigation, renderer retention, kanban, search and settings with a mocked scene; they do **not** replace actual GPU/visual testing. SDK orchestration uses a local mock HTTP provider in tests.

Actual desktop/mobile GPU appearance, frame rate and a paid end-to-end AI job remain unverified. The visual direction is an editorial product workspace, not a claim of an Awwwards award or certification.

Not yet implemented: email verification/recovery and SSO, billing/subscriptions, external OAuth integrations (email/calendar/CRM), webhook execution, recurring cron workflows, vector search, PPTX output, OCR, dollar-budget reconciliation, PostgreSQL/multiple replicas, off-host backup and a comprehensive independent security/load audit. No inert controls pretend these integrations are connected. Keep critical HR, financial and legal actions under human review; approval only changes internal status and never sends or pays anything externally.
