# RAINY AI OFFICE

**Every team. Every workflow. AI-powered.**

Монгол хэлтэй Universal AI Workforce-ийн эхний ажиллах хувилбар. Хүн болон AI ажилтнуудыг байгууллага тус бүрийн ажлын орчинд нэгтгэнэ. This repository contains a runnable foundation, not a fully audited enterprise SaaS release.

## Implemented

- Email/password registration and login; scrypt password hashes, hashed server-side sessions, HttpOnly cookies, logout/revocation.
- Isolated workspaces with owner/admin/member/viewer roles enforced on the server.
- Recipient-email-bound, revocable, one-time, 24-hour invitations. Users share the code themselves; no email delivery is claimed.
- Rooms, 11 reusable AI employee templates, custom AI employees and instructions.
- Real Three.js WebGL 2 office: mesh furniture, articulated employee characters, lighting, shadows, 360° orbit, zoom and picking. Camera state survives workspace polling and room navigation. Accessible employee buttons remain available if WebGL is unavailable; no SVG scene is substituted. Dependencies are served locally.
- Durable task, document, output, session and audit records in SQLite/WAL.
- Text knowledge documents explicitly attached to tasks. This is context attachment, not vector retrieval or arbitrary file parsing.
- Single employee or sequential Project Manager → 1–5 selected specialist employees → Quality Reviewer → human review workflow. Each specialist receives preceding outputs; this is explicit sequential orchestration, not unrestricted autonomous delegation.
- OpenAI Agents API through the official SDK, using `environment: none` because these workers only produce text drafts. No sandbox, external tools, code execution or external writes.
- Tasks run on the application server independently of the browser. Review results, approve or return with comments, download text outputs.
- Per-workspace daily AI call cap and global concurrency cap of 3 and per-workspace cap of 2. This is a request cap, not a dollar-spend guarantee.
- Interrupted tasks are marked on server restart. Ambiguous failures never auto-retry; session IDs are retained for investigation.
- CSRF origin checks, request size limits, authentication throttling, static allowlist and security headers.

## Room-specific WebGL environments

Nine persisted room types are available when creating a room or using its environment settings: general office, research library, development lab, finance, HR, sales, education, government, and operations. They change actual scene meshes and furnishings: library shelves, server racks, data displays, team portraits, classroom board/lectern, meeting table, and inventory shelving. Geometry tests verify distinct environments. Changing a room's environment preserves its tasks and outputs; all records remain inside the selected organization.

## Workspace security and workflow

A signed-in user can create multiple independent organizations. Membership is checked from the database on every scoped request, so removal takes effect immediately. Owners cannot be demoted or removed; only owners can grant/manage admin access. Admins manage ordinary members and review outputs; members create/run jobs; viewers read only. Roles are never accepted from client-supplied identity fields. Invitations are matched to the signed-in email, expire in 24 hours, and are consumed once. Existing pre-migration unbound invitations become unusable and must be reissued.

Users can revoke all their sessions from Settings. Workspace records, specialist IDs, documents, outputs, invites and task mutations are scoped server-side; changing a browser workspace header cannot bypass membership checks. These are application-enforced boundaries in one SQLite database, not separate physical databases or database row-level security.

Multi-specialist jobs select 1–5 distinct employees from the same workspace. The server runs planning, selected specialists in order, then review. Failure stops subsequent stages; the result cannot be approved before human review. Retries are explicit, never automatic. AI has no external tools in this release, so prompts cannot grant arbitrary email/payment/code execution capabilities. Prompts are not a substitute for access control; the server owns the boundaries.

## Local execution

Requires Node.js 24+.

```sh
npm ci
npm start
```

Visit `http://localhost:3000`, create a workspace, choose an employee, and create a task. Core workspace features work without an API key. Running AI returns a clear 503 if the server has no key. The app reads the existing `OPENAI_API_KEY` from its server environment; never put a key in Git or browser code. `.env.local` is ignored and read by `npm start` when present. No credential has been added to this repository.

`OPENAI_MODEL` defaults to `gpt-6-astra` from the API quickstart. Actual model/Agents API access and billing must be verified with the selected account before launch. The key needs the Agents and model inference permissions documented by OpenAI.

Official contract: https://developers.openai.com/api/docs/guides/agents-api/quickstart

## Configuration

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Existing server-side OpenAI credential; never returned to the browser |
| `OPENAI_MODEL` | Model ID available to the account |
| `APP_ORIGIN` | Exact public origin, e.g. `https://office.example.com`, no trailing slash |
| `NODE_ENV` | `production` enables Secure cookies, HSTS and requires HTTPS APP_ORIGIN |
| `DB_PATH` | SQLite file; mount its directory on durable storage |
| `PORT` | HTTP port, default 3000; `--port` is also supported |
| `DAILY_AI_CALL_LIMIT` | Workspace daily attempt cap, default 30; UTC day |

## Production build

`npm run build` bundles the browser application, Three.js and OrbitControls into a minified local module in `dist/public/app.js`. No browser CDN is needed. The distribution contains the server, public assets, lockfile and SHA-256 build manifest. Source inputs are whitelisted: database files and secrets are never copied.

Run `npm ci --omit=dev --ignore-scripts --prefix dist` then `cd dist && npm start` with production environment variables configured. `npm run test:build` smoke-tests the built server, health endpoint, assets, database initialization and Secure sessions using an isolated temporary database. It does not execute a paid AI request or validate GPU rendering.

The multi-stage Dockerfile builds the same distribution and installs only runtime dependencies in the final image. An actual container image requires a Docker-enabled builder; a successful JavaScript distribution build is separate from a successful Docker image build or Railway deployment.

## Container deployment

```sh
docker build -t rainy-ai-office .
docker run --env-file /secure/office.env -p 3000:3000 -v rainy-data:/data rainy-ai-office
```

The environment file must provide the existing credential and public `APP_ORIGIN`. Put a TLS reverse proxy in front of the container. `/healthz` provides a liveness endpoint. Mount `/data` durably and run a single application replica: both SQLite writes and job execution are owned by one process. Do not scale replicas against the same database.

Use a SQLite-aware backup process (SQLite backup API or `VACUUM INTO`) and periodically test restore. Do not simply copy the database while WAL writes are active. Workspace documents and outputs are stored as plaintext on the server disk: use host-level encryption, restricted volume access, and an explicit data retention policy before sensitive organizational use.

## Validation

```sh
npm run check
npm test
npm run build
npm run test:build
```

24 automated tests cover tenant isolation, session revocation, CSRF, malformed input, role enforcement, single-use invitations, document isolation, approval state transitions, missing keys, and a successful multi-specialist/failing agent workflow through the real SDK against a local mock HTTP transport. No live paid API test has been run. Scene geometry, ray intersections, disposal, and locally served Three.js modules are tested. Actual GPU rendering and desktop/mobile visual QA remain unverified because the available browser environment blocked access.

## Before a public production release

The current deliverable is **v0.2 functional core**, not a claim that all five product phases are finished. Complete these based on actual hosting and operating requirements:

- Configure the existing API credential in the selected hosting environment, verify account access and run a bounded live end-to-end job.
- Verify WebGL rendering, performance and desktop/mobile appearance on actual devices. Characters and furniture are procedural meshes; photorealistic GLB assets are not included.
- Add verified-email onboarding, password recovery, MFA/SSO where needed, account recovery and retention/deletion workflows.
- Add request/registration quotas at the reverse proxy and shared distributed rate limiting before multi-instance deployment; current throttling is per process/IP.
- Introduce a durable job queue and PostgreSQL before horizontal scaling. Process shutdown/restarts currently mark work interrupted; they do not reconcile or cancel remote turns automatically. Inspect recorded sessions before manually retrying an ambiguous failure to avoid duplicate charges.
- Add monitoring, alerts, backup/restore drills, security review and load tests on the actual deployment.
- Add reliable usage reconciliation and financial budget enforcement; request caps do not measure token spend. Configure provider-side financial controls separately.
- Billing/subscriptions, CRM/email/calendar/webhook integration, scheduled jobs, industry packs, arbitrary file upload/parser, full-text/vector retrieval and secure per-tenant BYOK are not yet implemented.
- Current audit rows are append-only through the application API, but are not tamper-evident against database administrators. Choose compliance controls according to the organization's requirements.

Approving a draft only changes its status inside this application. It does not send emails, execute payments, publish content or make legal/financial decisions.

## Railway deployment

Project: RAINY AI OFFICE. Service: rainy-ai-office.

The Docker entrypoint is `node runtime.mjs`. Railway volume startup uses `RAILWAY_RUN_UID=0` only for initialization; the entrypoint creates `/data/office`, makes it private to UID 1000, clears supplementary groups, then permanently drops to UID/GID 1000 before loading the HTTP server. `DB_PATH=/data/office/office.sqlite`. The running application never needs root privileges. Use one replica with this SQLite volume.

Health check: `/healthz`. Public origin is configured explicitly and Secure cookies remain enabled. The existing OpenAI API credential must be configured in this service's protected variables before live AI runs; no credential is embedded in source or the build.
