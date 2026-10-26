# RAINY AI OFFICE 0.4 — service activation

The code and settings screens are implemented. A configured flag is not proof of successful delivery, OAuth approval or a real payment. Do not enable enforcement until each provider is tested with your own authorized accounts. Never send secret values in chat or commit them to git; enter them in Railway Variables.

## Email verification and password recovery

1. Create a Resend sending domain, publish its required DNS records, and verify it.
2. Set `RESEND_API_KEY`, `MAIL_FROM` (e.g. your verified-domain sender), and the existing exact HTTPS `APP_ORIGIN`.
3. Register a test account you control. Settings → email verification sends a 24-hour link. Login → “Нууц үгээ мартсан уу?” sends a 30-minute password-reset link. Both tokens are hashed in SQLite and single-use. Reset invalidates sessions and other recovery tokens and preserves MFA.
4. Verify actual delivery, expiry, replay rejection, and a fresh login. Then set `EMAIL_VERIFICATION_REQUIRED=true`. This gates AI execution, invitations, invoice creation and OAuth connection/sync, while allowing login and verification. Existing accounts are unverified until they complete verification.

Recovery responses are generic; delivery errors are not exposed as account-existence errors. Sender API failures are logged without addresses or tokens. There is no automatic email queue/retry in this version; the user can request another link subject to throttling.

## QPay prepaid subscription

Only QPay is implemented by owner choice. This is a prepaid entitlement with an expiry timestamp; it never automatically debits an account. AI provider API charges are separate.

1. Obtain QPay merchant credentials and `invoice_code` under your own merchant agreement. Configure sandbox credentials in `QPAY_CLIENT_ID`, `QPAY_CLIENT_SECRET`, `QPAY_INVOICE_CODE`; set `QPAY_BASE_URL=https://merchant-sandbox.qpay.mn`.
2. Set `BILLING_PLANS_JSON` to an array of your approved plans. Each object has `id` (lowercase slug), `name`, `amount` (positive integer MNT), `days` (1–366), and `dailyCalls` (1–10000). No prices have been invented or enabled in the shipped configuration.
3. Workspace owner/admin opens Settings → QPay plan → creates an invoice. The server sets amount/plan/duration; the browser cannot supply an amount. Existing pending/uncertain invoice creation is blocked for 30 minutes to limit accidental duplication. An ambiguous invoice creation failure must be reconciled with the merchant before another payment.
4. Invoice creation includes a unique callback URL at `/api/billing/qpay/callback/<order>/<nonce>`. The callback nonce is hashed at rest. It is only a notification: the app calls `POST /v2/payment/check` and verifies exact aggregate amount, PAID status and MNT currency against the stored invoice. Transaction IDs are unique. Repeated/concurrent callbacks cannot extend the subscription twice. There is no scheduled provider polling; the UI status button reads the local order only.
5. Test underpayment, wrong currency, callback replay, session/tenant isolation, provider outages, payment delays and entitlement expiry in sandbox. Then configure actual production merchant credentials with `QPAY_BASE_URL=https://merchant.qpay.mn` and test an authorized production transaction yourself.
6. Set `BILLING_ENFORCE=true` only after the activation checks pass. Otherwise existing trial usage remains available with the default daily limit. The prepaid plan's daily call limit applies server-side. Expired subscriptions cannot enqueue/continue new provider stages when enforcement is enabled.

The same active plan can be renewed from its expiry. Switching an active plan is blocked before invoice creation and needs merchant/operator handling. Refunds, eBarimt, automated reminder emails, proration and recurring debits are not implemented. The order history provides the invoice identifier for support. An uncertain invoice or missed callback requires merchant reconciliation; there is no fake “mark paid” control.

## Gmail, Google Calendar and HubSpot CRM

These connections are read-only. Creating the OAuth application and provider consent/verification cannot be completed without the account owner's provider access.

Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and enable Gmail/Calendar APIs. Configure exact Google redirects:

- `https://rainy-ai-office-production.up.railway.app/api/integrations/callback/gmail`
- `https://rainy-ai-office-production.up.railway.app/api/integrations/callback/calendar`

Set `HUBSPOT_CLIENT_ID`, `HUBSPOT_CLIENT_SECRET` and configure:

- `https://rainy-ai-office-production.up.railway.app/api/integrations/callback/hubspot`

If you change the domain, update APP_ORIGIN and all provider redirects together. Google may require consent verification for the requested Gmail scope before broader production use. HubSpot uses the 2026-03 OAuth token endpoints.

The user connects from Settings and grants consent directly at the provider. OAuth state is one-time, 10-minute, browser-cookie/session/user/workspace-bound; Google also uses PKCE. Membership/session validity is rechecked on callback. Tokens are AES-256-GCM encrypted and refresh automatically on demand. No tokens appear in state/export/UI.

Manual sync is rate-limited and bounded: Gmail latest 15 Inbox message headers/snippets (no attachments/full message bodies), Calendar next 50 primary-calendar events, HubSpot first 50 contacts. This is a snapshot, not a complete bidirectional sync. The raw sync snapshot is visible only to the connecting user in that workspace. Choosing an item and importing it into a private room explicitly shares it with that room's authorized members and owner/admin; it does not invoke AI until an authorized user attaches it to a task.

Disconnect deletes local credentials/snapshots and attempts provider revocation. If revocation fails, the UI tells the user to revoke access in provider account settings. Google revocation can affect other connections using the same Google app/account; reconnect those if needed. No email send, event write or CRM mutation tools are exposed to agents.

## Encrypted offsite backup and restore

Production has a separate `office-backups` Railway S3 bucket. The app uses reference variables so bucket credentials are not copied into code. `DATABASE_BACKUPS=true` creates a consistent daily SQLite snapshot with local quick-check, retains three local days, and uploads an AES-256-GCM encrypted copy to `BACKUP_S3_PREFIX/office-YYYY-MM-DD.sqlite.enc`. Upload uses HTTPS, verifies object length/metadata, downloads the actual remote object, authenticates/decrypts it into a temporary file and opens SQLite with `PRAGMA quick_check` before reporting success. Hourly checks retry failures; successful snapshots are skipped for the rest of the process/day.

Remote retention is indefinite in this release. Set an approved bucket lifecycle policy if needed; the app does not delete old remote objects. This storage is outside the app server/volume but is still within the Railway account, not a second independent cloud provider. S3-compatible storage can be changed through the same variables.

Preserve `BACKUP_ENCRYPTION_KEY` AND `WORKSPACE_SECRET_KEY` in an independent secure credential store. Losing the first prevents snapshot decryption; losing the second prevents decrypting stored workspace/OAuth/MFA secrets after restoration. Do not rotate either key without a migration plan.

The runtime image includes a restore tool. From an authorized environment with backup variables configured:

```
node scripts/restore-backup.mjs rainy-office/office-YYYY-MM-DD.sqlite.enc /new/path/validated-office.sqlite
```

It refuses the current DB path, refuses existing output files, authenticates the backup and runs full SQLite integrity_check. It never switches or overwrites the live DB. To restore production, an operator stops the app, preserves the current database and WAL/SHM files, installs the validated snapshot at DB_PATH and restarts with the original workspace secret key. Check account/tenant access and review interrupted tasks before reopening service. OAuth/integration tokens in a historical snapshot may need reconnecting.

The Settings backup status shows only a completed upload/restore verification. A restart briefly shows “waiting” until the first scheduled backup runs (~30 seconds). Failure messages remain visible and runtime logs contain no credentials.
