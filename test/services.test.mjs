import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { randomBytes } from "node:crypto";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { accountMail, digest } from "../lib/mail.mjs";
import { billing } from "../lib/billing.mjs";
import { integrations } from "../lib/integrations.mjs";
import { encryptBackup, decryptBackup } from "../lib/offsite.mjs";
const originalFetch = globalThis.fetch;
const env = { ...process.env };
function restore() {
  globalThis.fetch = originalFetch;
  for (const k of Object.keys(process.env))
    if (!(k in env)) delete process.env[k];
  Object.assign(process.env, env);
}
function database() {
  const db = new DatabaseSync(":memory:");
  db.exec(
    "CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT,name TEXT,password TEXT);CREATE TABLE sessions(token TEXT PRIMARY KEY,user TEXT,expires INTEGER);CREATE TABLE members(workspace TEXT,user TEXT,role TEXT);",
  );
  return db;
}
test("email verification and recovery tokens expire, consume once, revoke sessions and keep MFA", async () => {
  const db = database();
  try {
    process.env.RESEND_API_KEY = "test";
    process.env.MAIL_FROM = "office@example.com";
    process.env.APP_ORIGIN = "https://office.example";
    let link;
    globalThis.fetch = async (url, options) => {
      assert.equal(url, "https://api.resend.com/emails");
      link = JSON.parse(options.body).text.match(/https:\/\/\S+/)[0];
      return Response.json({ id: "sent" });
    };
    db.prepare("INSERT INTO users VALUES(?,?,?,?)").run(
      "u",
      "u@example.com",
      "User",
      "old-hash",
    );
    db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
      "session",
      "u",
      Date.now() + 60000,
    );
    db.exec(
      "CREATE TABLE user_mfa(user TEXT,secret TEXT);INSERT INTO user_mfa VALUES('u','encrypted-secret')",
    );
    const mail = accountMail(db, {
      password: (p) => {
        if (p.length < 12) throw Error("weak");
        return "hash:" + p;
      },
      throttle() {},
    });
    const u = { id: "u", email: "u@example.com" };
    await mail.issue(u, "verify");
    let token = new URLSearchParams(new URL(link).hash.slice(1)).get("verify");
    assert.equal(
      JSON.stringify(db.prepare("SELECT * FROM account_tokens").all()).includes(
        token,
      ),
      false,
    );
    const req = { method: "POST", socket: { remoteAddress: "test" } };
    await mail.publicRoute("/api/auth/verify", req, { token });
    assert.equal(mail.verified(u), true);
    await assert.rejects(
      mail.publicRoute("/api/auth/verify", req, { token }),
      /хүчингүй/,
    );
    await mail.issue(u, "reset");
    token = new URLSearchParams(new URL(link).hash.slice(1)).get("reset");
    await assert.rejects(
      mail.publicRoute("/api/auth/verify", req, { token }),
      /хүчингүй/,
    );
    await mail.publicRoute("/api/auth/reset", req, {
      token,
      password: "new-password-123",
    });
    assert.equal(db.prepare("SELECT COUNT(*) n FROM sessions").get().n, 0);
    assert.equal(
      db.prepare("SELECT secret FROM user_mfa").get().secret,
      "encrypted-secret",
    );
    assert.equal(
      db.prepare("SELECT password FROM users").get().password,
      "hash:new-password-123",
    );
    await assert.rejects(
      mail.publicRoute("/api/auth/reset", req, {
        token,
        password: "another-password",
      }),
    );
    await mail.issue(u, "verify");
    token = new URLSearchParams(new URL(link).hash.slice(1)).get("verify");
    db.exec("UPDATE account_tokens SET expires=0");
    await assert.rejects(mail.publicRoute("/api/auth/verify", req, { token }));
    const unknown = await mail.publicRoute("/api/auth/forgot", req, {
      email: "unknown@example.com",
    });
    assert.equal(unknown.ok, true);
  } finally {
    db.close();
    restore();
  }
});
test("QPay settlement verifies exact MNT amount and consumes callbacks idempotently across workspaces", async () => {
  const db = database();
  try {
    Object.assign(process.env, {
      QPAY_CLIENT_ID: "merchant",
      QPAY_CLIENT_SECRET: "secret",
      QPAY_INVOICE_CODE: "INVOICE",
      APP_ORIGIN: "https://office.example",
      BILLING_PLANS_JSON: JSON.stringify([
        { id: "team", name: "Team", amount: 99000, days: 30, dailyCalls: 100 },
      ]),
      BILLING_ENFORCE: "true",
    });
    let callback,
      paidAmount = 1000,
      currency = "MNT",
      calls = 0;
    globalThis.fetch = async (url, options) => {
      calls++;
      if (url.endsWith("/auth/token"))
        return Response.json({ access_token: "access", expires_in: 3600 });
      if (url.endsWith("/v2/invoice")) {
        const b = JSON.parse(options.body);
        assert.equal(b.amount, 99000);
        callback = new URL(b.callback_url);
        return Response.json({
          invoice_id: "invoice-1",
          qr_image: "AA==",
          urls: [],
        });
      }
      if (url.endsWith("/payment/check")) {
        assert.equal(JSON.parse(options.body).object_id, "invoice-1");
        return Response.json({
          rows: [
            {
              payment_id: "payment-1",
              payment_status: "PAID",
              payment_currency: currency,
              payment_amount: String(paidAmount),
            },
          ],
        });
      }
      throw Error("Unexpected fetch");
    };
    const b = billing(db);
    assert.throws(
      () => b.requireActive("w"),
      (e) => e.status === 402,
    );
    const order = await b.create("w", "team");
    assert.throws(
      () => b.order("other", order.id),
      (e) => e.status === 404,
    );
    const parts = callback.pathname.split("/"),
      secret = parts.at(-1);
    const before = calls;
    await assert.rejects(
      b.callback(order.id, "forged"),
      (e) => e.status === 404,
    );
    assert.equal(calls, before);
    await b.callback(order.id, secret);
    assert.equal(b.entitlement("w").active, false);
    db.exec("UPDATE billing_orders SET last_check=0");
    paidAmount = 99000;
    currency = "USD";
    await b.callback(order.id, secret);
    assert.equal(b.entitlement("w").active, false);
    db.exec("UPDATE billing_orders SET last_check=0");
    currency = "MNT";
    await Promise.all([
      b.callback(order.id, secret),
      b.callback(order.id, secret),
    ]);
    assert.equal(b.entitlement("w").active, true);
    assert.equal(b.entitlement("w").limit, 100);
    const expiry = b.status("w").subscription.expires;
    await b.callback(order.id, secret);
    assert.equal(b.status("w").subscription.expires, expiry);
    db.exec("UPDATE subscriptions SET expires=0");
    assert.throws(() => b.requireActive("w"));
  } finally {
    db.close();
    restore();
  }
});
test("OAuth callback is browser/session/workspace bound, credentials encrypted and synced data stays user private", async () => {
  const db = database();
  try {
    Object.assign(process.env, {
      WORKSPACE_SECRET_KEY: randomBytes(32).toString("base64"),
      GOOGLE_CLIENT_ID: "id",
      GOOGLE_CLIENT_SECRET: "secret",
      APP_ORIGIN: "https://office.example",
    });
    db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
      "sid",
      "u",
      Date.now() + 60000,
    );
    db.prepare("INSERT INTO members VALUES(?,?,?)").run("w", "u", "member");
    const integration = integrations(db);
    let tokens = 0;
    globalThis.fetch = async (url, options) => {
      if (url === "https://oauth2.googleapis.com/token") {
        tokens++;
        return Response.json({
          access_token: "secret-access-token",
          refresh_token: "secret-refresh-token",
          expires_in: 3600,
          scope: "https://www.googleapis.com/auth/calendar.events.readonly",
        });
      }
      if (url.startsWith("https://www.googleapis.com/calendar/v3/"))
        return Response.json({
          items: [
            {
              id: "event",
              summary: "Private calendar",
              description: "Private text",
              start: { date: "2026-10-26" },
            },
          ],
        });
      if (url === "https://oauth2.googleapis.com/revoke")
        return new Response("", { status: 200 });
      throw Error("Unexpected fetch " + url);
    };
    const start = integration.start("u", "w", "calendar", "sid");
    assert.match(start.url, /code_challenge=/);
    await assert.rejects(
      integration.finish(
        "calendar",
        { state: start.state, code: "code" },
        "wrong",
      ),
      (e) => e.status === 400,
    );
    assert.equal(tokens, 0);
    await integration.finish(
      "calendar",
      { state: start.state, code: "code" },
      digest(start.state),
    );
    assert.equal(tokens, 1);
    assert.equal(
      db
        .prepare("SELECT secret FROM integrations")
        .get()
        .secret.includes("secret-access-token"),
      false,
    );
    assert.equal(
      JSON.stringify(integration.status("u", "w")).includes(
        "secret-access-token",
      ),
      false,
    );
    await assert.rejects(
      integration.finish(
        "calendar",
        { state: start.state, code: "code" },
        digest(start.state),
      ),
    );
    await integration.sync("u", "w", "calendar");
    assert.equal(
      integration.items("u", "w", "calendar")[0].title,
      "Private calendar",
    );
    assert.equal(integration.items("other", "w", "calendar").length, 0);
    assert.equal(integration.items("u", "other", "calendar").length, 0);
    assert.equal(
      (await integration.disconnect("u", "w", "calendar")).revoked,
      true,
    );
    assert.equal(integration.items("u", "w", "calendar").length, 0);
    const next = integration.start("u", "w", "calendar", "sid");
    db.exec("DELETE FROM sessions");
    await assert.rejects(
      integration.finish(
        "calendar",
        { state: next.state, code: "code" },
        digest(next.state),
      ),
      (e) => e.status === 403,
    );
  } finally {
    db.close();
    restore();
  }
});
test("offsite format authenticates restore bytes and never overwrites existing files", async () => {
  const dir = await mkdtemp(join(tmpdir(), "office-offsite-"));
  try {
    process.env.BACKUP_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    const source = join(dir, "source.sqlite"),
      enc = join(dir, "snapshot.enc"),
      target = join(dir, "restored.sqlite");
    const db = new DatabaseSync(source);
    db.exec(
      "CREATE TABLE proof(value TEXT);INSERT INTO proof VALUES('Монгол backup')",
    );
    db.close();
    await encryptBackup(source, enc);
    assert.notDeepEqual(await readFile(enc), await readFile(source));
    await decryptBackup(enc, target);
    const check = new DatabaseSync(target);
    assert.equal(
      check.prepare("SELECT value FROM proof").get().value,
      "Монгол backup",
    );
    check.close();
    await assert.rejects(decryptBackup(enc, target), /EEXIST/);
    const tampered = await readFile(enc);
    tampered[25] ^= 1;
    await writeFile(enc, tampered);
    await assert.rejects(decryptBackup(enc, join(dir, "bad.sqlite")));
    await assert.rejects(readFile(join(dir, "bad.sqlite")), /ENOENT/);
  } finally {
    await rm(dir, { recursive: true, force: true });
    restore();
  }
});
