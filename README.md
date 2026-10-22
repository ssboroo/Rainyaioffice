# RAINY AI OFFICE

**Every team. Every workflow. AI-powered.**

Монгол хэлтэй Universal AI Workforce-ийн эхний ажиллах хувилбар. Хүн болон AI ажилтнуудыг байгууллага тус бүрийн ажлын орчинд нэгтгэнэ. This repository contains a runnable foundation, not a fully audited enterprise SaaS release.

## Implemented

- Email/password registration and login; scrypt password hashes, hashed server-side sessions, HttpOnly cookies, logout/revocation.
- Isolated workspaces with owner/admin/member/viewer roles enforced on the server.
- One-time, 24-hour invitations. Users share the code themselves; no email delivery is claimed.
- Rooms, 11 reusable AI employee templates, custom AI employees and instructions.
- Interactive vector isometric office with selectable employees; responsive layout. This is SVG, not a WebGL 3D scene.
- Durable task, document, output, session and audit records in SQLite/WAL.
- Text knowledge documents explicitly attached to tasks. This is context attachment, not vector retrieval or arbitrary file parsing.
- Single employee or sequential Project Manager → Specialist → Quality Reviewer → human review workflow.
- OpenAI Agents API through the official SDK, using `environment: none` because these workers only produce text drafts. No sandbox, external tools, code execution or external writes.
- Tasks run on the application server independently of the browser. Review results, approve or return with comments, download text outputs.
- Per-workspace daily AI call cap and global concurrency cap of 3. This is a request cap, not a dollar-spend guarantee.
- Interrupted tasks are marked on server restart. Ambiguous failures never auto-retry; session IDs are retained for investigation.
- CSRF origin checks, request size limits, authentication throttling, static allowlist and security headers.

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
```

13 integration tests cover tenant isolation, session revocation, CSRF, malformed input, role enforcement, single-use invitations, document isolation, approval state transitions, missing keys, and a successful three-stage/failing agent workflow through the real SDK against a local mock HTTP transport. No live paid API test has been run. Browser visual QA was blocked by the available browser environment.

## Before a public production release

The current deliverable is **v0.1 functional core**, not a claim that all five product phases are finished. Complete these based on actual hosting and operating requirements:

- Configure the existing API credential in the selected hosting environment, verify account access and run a bounded live end-to-end job.
- Verify desktop/mobile appearance in a browser and replace/extend the office vector scene if actual 3D assets are required.
- Add verified-email onboarding, password recovery, MFA/SSO where needed, membership management/removal, account recovery and retention/deletion workflows.
- Add request/registration quotas at the reverse proxy and shared distributed rate limiting before multi-instance deployment; current throttling is per process/IP.
- Introduce a durable job queue and PostgreSQL before horizontal scaling. Process shutdown/restarts currently mark work interrupted; they do not reconcile or cancel remote turns automatically. Inspect recorded sessions before manually retrying an ambiguous failure to avoid duplicate charges.
- Add monitoring, alerts, backup/restore drills, security review and load tests on the actual deployment.
- Add reliable usage reconciliation and financial budget enforcement; request caps do not measure token spend. Configure provider-side financial controls separately.
- Billing/subscriptions, CRM/email/calendar/webhook integration, scheduled jobs, industry packs, arbitrary file upload/parser, full-text/vector retrieval and secure per-tenant BYOK are not yet implemented.
- Current audit rows are append-only through the application API, but are not tamper-evident against database administrators. Choose compliance controls according to the organization's requirements.

Approving a draft only changes its status inside this application. It does not send emails, execute payments, publish content or make legal/financial decisions.
