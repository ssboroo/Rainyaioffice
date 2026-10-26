import { randomBytes, randomUUID } from "node:crypto";
import { digest } from "./mail.mjs";
const fail = (status, message) => Object.assign(new Error(message), { status });
export const qpayConfigured = () =>
  !!(
    process.env.QPAY_CLIENT_ID &&
    process.env.QPAY_CLIENT_SECRET &&
    process.env.QPAY_INVOICE_CODE &&
    process.env.APP_ORIGIN &&
    process.env.BILLING_PLANS_JSON
  );
export function plans() {
  try {
    const data = JSON.parse(process.env.BILLING_PLANS_JSON || "[]");
    if (!Array.isArray(data)) return [];
    return data
      .filter(
        (p) =>
          /^[a-z0-9-]{1,40}$/.test(p.id) &&
          typeof p.name === "string" &&
          Number.isSafeInteger(p.amount) &&
          p.amount > 0 &&
          p.amount <= 100000000 &&
          Number.isInteger(p.days) &&
          p.days > 0 &&
          p.days <= 366 &&
          Number.isInteger(p.dailyCalls) &&
          p.dailyCalls > 0 &&
          p.dailyCalls <= 10000,
      )
      .map(({ id, name, amount, days, dailyCalls }) => ({
        id,
        name,
        amount,
        days,
        dailyCalls,
        currency: "MNT",
      }));
  } catch {
    return [];
  }
}
export function billing(db) {
  db.exec(
    `CREATE TABLE IF NOT EXISTS billing_orders(id TEXT PRIMARY KEY,workspace TEXT NOT NULL,plan TEXT NOT NULL,amount INTEGER NOT NULL,days INTEGER NOT NULL,daily_calls INTEGER NOT NULL,status TEXT NOT NULL,invoice TEXT UNIQUE,callback_hash TEXT NOT NULL,qr TEXT,urls TEXT,created INTEGER NOT NULL,paid INTEGER,last_check INTEGER DEFAULT 0);CREATE TABLE IF NOT EXISTS subscriptions(workspace TEXT PRIMARY KEY,plan TEXT NOT NULL,expires INTEGER NOT NULL,daily_calls INTEGER NOT NULL);CREATE TABLE IF NOT EXISTS billing_payments(payment TEXT PRIMARY KEY,order_id TEXT NOT NULL);`,
  );
  const get = (s, ...p) => db.prepare(s).get(...p),
    run = (s, ...p) => db.prepare(s).run(...p);
  let token = null,
    tokenUntil = 0,
    tokenRequest;
  const base = () => {
    const x = process.env.QPAY_BASE_URL || "https://merchant.qpay.mn";
    if (
      ![
        "https://merchant.qpay.mn",
        "https://merchant-sandbox.qpay.mn",
      ].includes(x)
    )
      throw fail(503, "QPay endpoint буруу");
    return x;
  };
  async function access() {
    if (token && Date.now() < tokenUntil) return token;
    if (tokenRequest) return tokenRequest;
    tokenRequest = (async () => {
      const r = await fetch(base() + "/v2/auth/token", {
        method: "POST",
        signal: AbortSignal.timeout(15000),
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(
              process.env.QPAY_CLIENT_ID + ":" + process.env.QPAY_CLIENT_SECRET,
            ).toString("base64"),
        },
      });
      if (!r.ok) throw fail(502, "QPay нэвтрэлт амжилтгүй");
      const d = await r.json();
      if (!d.access_token) throw fail(502, "QPay token олдсонгүй");
      token = d.access_token;
      const expiry = Number(d.expires_in);
      tokenUntil =
        expiry > 1e9
          ? expiry * 1000 - 60000
          : Date.now() + Math.min(expiry || 300, 3600) * 1000 - 30000;
      return token;
    })();
    try {
      return await tokenRequest;
    } finally {
      tokenRequest = null;
    }
  }
  async function call(path, payload) {
    const r = await fetch(base() + path, {
      method: "POST",
      signal: AbortSignal.timeout(20000),
      headers: {
        Authorization: "Bearer " + (await access()),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      if (r.status === 401) {
        token = null;
        tokenUntil = 0;
      }
      throw fail(502, "QPay хүсэлт амжилтгүй. Дараа дахин оролдоно уу.");
    }
    return r.json();
  }
  function status(w) {
    const sub = get("SELECT * FROM subscriptions WHERE workspace=?", w);
    return {
      configured: qpayConfigured() && plans().length > 0,
      enforced: process.env.BILLING_ENFORCE === "true",
      sandbox: process.env.QPAY_BASE_URL === "https://merchant-sandbox.qpay.mn",
      plans: plans(),
      subscription: sub ? { ...sub, active: sub.expires > Date.now() } : null,
      orders: db
        .prepare(
          "SELECT id,plan,amount,days,status,created,paid FROM billing_orders WHERE workspace=? ORDER BY created DESC LIMIT 20",
        )
        .all(w),
    };
  }
  function entitlement(w) {
    const s = get(
      "SELECT * FROM subscriptions WHERE workspace=? AND expires>?",
      w,
      Date.now(),
    );
    return {
      active: !!s,
      limit: s?.daily_calls || Number(process.env.DAILY_AI_CALL_LIMIT || 30),
    };
  }
  function requireActive(w) {
    if (process.env.BILLING_ENFORCE === "true" && !entitlement(w).active)
      throw fail(402, "Багцын хугацаа дууссан. QPay-аар сунгана уу.");
  }
  function order(w, id) {
    const o = get(
      "SELECT * FROM billing_orders WHERE id=? AND workspace=?",
      id,
      w,
    );
    if (!o) throw fail(404, "Нэхэмжлэх олдсонгүй");
    return {
      id: o.id,
      status: o.status,
      amount: o.amount,
      plan: o.plan,
      qr: o.qr,
      urls: JSON.parse(o.urls || "[]"),
      created: o.created,
    };
  }
  async function create(w, plan) {
    if (!qpayConfigured())
      throw fail(503, "QPay merchant тохиргоо хүлээгдэж байна");
    const p = plans().find((p) => p.id === plan);
    if (!p) throw fail(400, "Багц олдсонгүй");
    const current = get(
      "SELECT plan FROM subscriptions WHERE workspace=? AND expires>?",
      w,
      Date.now(),
    );
    if (current && current.plan !== p.id)
      throw fail(
        409,
        "Идэвхтэй багцаа сунгана уу. Өөр багц руу шилжүүлэхийг админтай тохирно уу.",
      );
    const old = get(
      "SELECT id FROM billing_orders WHERE workspace=? AND status IN ('creating','pending','uncertain') AND created>?",
      w,
      Date.now() - 1800000,
    );
    if (old)
      throw fail(
        409,
        "Өмнөх нэхэмжлэх хүлээгдэж байна. Төлбөрийн түүхээс шалгана уу.",
      );
    const id = randomUUID(),
      secret = randomBytes(32).toString("base64url");
    run(
      "INSERT INTO billing_orders(id,workspace,plan,amount,days,daily_calls,status,callback_hash,created) VALUES(?,?,?,?,?,?,?,?,?)",
      id,
      w,
      p.id,
      p.amount,
      p.days,
      p.dailyCalls,
      "creating",
      digest(secret),
      Date.now(),
    );
    try {
      const d = await call("/v2/invoice", {
        invoice_code: process.env.QPAY_INVOICE_CODE,
        sender_invoice_no: id,
        invoice_receiver_code: w,
        invoice_description: `RAINY AI OFFICE — ${p.name} (${p.days} хоног)`,
        amount: p.amount,
        callback_url:
          process.env.APP_ORIGIN +
          "/api/billing/qpay/callback/" +
          id +
          "/" +
          secret,
      });
      if (typeof d.invoice_id !== "string" || !d.invoice_id)
        throw fail(502, "QPay нэхэмжлэх буруу");
      const qr =
        typeof d.qr_image === "string" && d.qr_image.length < 200000
          ? d.qr_image
          : null;
      const urls = (Array.isArray(d.urls) ? d.urls : [])
        .filter(
          (x) =>
            typeof x.link === "string" &&
            /^(https:\/\/|[a-z][a-z0-9+.-]*:\/\/)/i.test(x.link) &&
            !/^javascript:|^data:/i.test(x.link),
        )
        .slice(0, 40)
        .map((x) => ({
          name: String(x.name || x.description || "Банк").slice(0, 100),
          link: x.link,
        }));
      run(
        "UPDATE billing_orders SET status='pending',invoice=?,qr=?,urls=? WHERE id=?",
        d.invoice_id,
        qr,
        JSON.stringify(urls),
        id,
      );
      return order(w, id);
    } catch (e) {
      run("UPDATE billing_orders SET status='uncertain' WHERE id=?", id);
      throw e;
    }
  }
  const checking = new Map();
  async function check(id) {
    if (checking.has(id)) return checking.get(id);
    const promise = (async () => {
      const o = get("SELECT * FROM billing_orders WHERE id=?", id);
      if (!o?.invoice || o.status === "paid") return;
      if (Date.now() - o.last_check < 5000)
        throw fail(429, "Төлбөр шалгаж байна. Түр хүлээнэ үү.");
      run("UPDATE billing_orders SET last_check=? WHERE id=?", Date.now(), id);
      const d = await call("/v2/payment/check", {
        object_type: "INVOICE",
        object_id: o.invoice,
        offset: { page_number: 1, page_limit: 100 },
      });
      const rows = Array.isArray(d.rows) ? d.rows : [];
      const paid = rows.filter(
        (r) =>
          r.payment_status === "PAID" &&
          r.payment_currency === "MNT" &&
          Number.isFinite(Number(r.payment_amount)) &&
          Number(r.payment_amount) > 0 &&
          typeof r.payment_id === "string",
      );
      // Only settle a complete, exact MNT invoice. Never trust callback payload totals.
      if (
        new Set(paid.map((r) => r.payment_id)).size !== paid.length ||
        paid.reduce((n, r) => n + Number(r.payment_amount), 0) !== o.amount
      )
        return;
      db.exec("BEGIN IMMEDIATE");
      try {
        if (
          get("SELECT status FROM billing_orders WHERE id=?", id).status ===
          "paid"
        ) {
          db.exec("COMMIT");
          return;
        }
        for (const p of paid) {
          const old = get(
            "SELECT order_id FROM billing_payments WHERE payment=?",
            p.payment_id,
          );
          if (old && old.order_id !== id)
            throw fail(409, "Гүйлгээ өөр нэхэмжлэхэд бүртгэгдсэн");
          run(
            "INSERT OR IGNORE INTO billing_payments VALUES(?,?)",
            p.payment_id,
            id,
          );
        }
        const previous = get(
          "SELECT expires,plan FROM subscriptions WHERE workspace=?",
          o.workspace,
        );
        if (previous?.expires > Date.now() && previous.plan !== o.plan)
          throw fail(409, "Идэвхтэй багц өөр байна. Админтай холбогдоно уу.");
        const expiry =
          Math.max(Date.now(), previous?.expires || 0) + o.days * 86400000;
        run(
          "INSERT INTO subscriptions VALUES(?,?,?,?) ON CONFLICT(workspace) DO UPDATE SET plan=excluded.plan,expires=excluded.expires,daily_calls=excluded.daily_calls",
          o.workspace,
          o.plan,
          expiry,
          o.daily_calls,
        );
        run(
          "UPDATE billing_orders SET status='paid',paid=? WHERE id=?",
          Date.now(),
          id,
        );
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    })();
    checking.set(id, promise);
    try {
      return await promise;
    } finally {
      checking.delete(id);
    }
  }
  async function callback(id, secret) {
    const o = get(
      "SELECT callback_hash,invoice FROM billing_orders WHERE id=?",
      id,
    );
    if (!o || digest(secret) !== o.callback_hash) throw fail(404, "Олдсонгүй");
    if (!o.invoice)
      throw fail(503, "Нэхэмжлэх үүсгэж байна. Дахин мэдэгдэнэ үү.");
    await check(id);
    return { ok: true };
  }
  return { status, entitlement, requireActive, create, order, callback };
}
