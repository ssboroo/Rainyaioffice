import { randomBytes, createHash } from "node:crypto";
export const digest = (value) =>
  createHash("sha256").update(value).digest("hex");
const fail = (status, message) => Object.assign(new Error(message), { status });
export const mailConfigured = () =>
  !!(
    process.env.RESEND_API_KEY &&
    process.env.MAIL_FROM &&
    process.env.APP_ORIGIN
  );
export function accountMail(db, { password, throttle }) {
  db.exec(
    `CREATE TABLE IF NOT EXISTS account_tokens(token TEXT PRIMARY KEY,user TEXT NOT NULL,purpose TEXT NOT NULL,expires INTEGER NOT NULL);CREATE INDEX IF NOT EXISTS account_token_user ON account_tokens(user,purpose);`,
  );
  if (
    !db
      .prepare("PRAGMA table_info(users)")
      .all()
      .some((c) => c.name === "email_verified_at")
  )
    db.exec("ALTER TABLE users ADD COLUMN email_verified_at TEXT");
  const get = (s, ...p) => db.prepare(s).get(...p),
    run = (s, ...p) => db.prepare(s).run(...p);
  async function issue(user, purpose) {
    if (!mailConfigured())
      throw fail(503, "Имэйл үйлчилгээний тохиргоо хүлээгдэж байна");
    const token = randomBytes(32).toString("base64url");
    run(
      "DELETE FROM account_tokens WHERE user=? AND purpose=?",
      user.id,
      purpose,
    );
    run(
      "INSERT INTO account_tokens VALUES(?,?,?,?)",
      digest(token),
      user.id,
      purpose,
      Date.now() + (purpose === "verify" ? 86400000 : 1800000),
    );
    const link =
      process.env.APP_ORIGIN + "/#" + purpose + "=" + encodeURIComponent(token);
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        signal: AbortSignal.timeout(15000),
        headers: {
          Authorization: "Bearer " + process.env.RESEND_API_KEY,
          "Content-Type": "application/json",
          "Idempotency-Key": digest(token),
        },
        body: JSON.stringify({
          from: process.env.MAIL_FROM,
          to: [user.email],
          subject:
            purpose === "verify"
              ? "RAINY — И-мэйлээ баталгаажуулах"
              : "RAINY — Нууц үг сэргээх",
          text: `${purpose === "verify" ? "И-мэйлээ баталгаажуулах" : "Нууц үгээ сэргээх"} холбоос:\n${link}\n\n${purpose === "verify" ? "24 цаг" : "30 минут"} хүчинтэй, нэг удаа ашиглана. Та хүсэлт гаргаагүй бол үл тооно уу. Нууц үг сэргээх нь 2FA-г унтраахгүй.`,
        }),
      });
      if (!response.ok) throw Error("delivery failed");
    } catch {
      run("DELETE FROM account_tokens WHERE token=?", digest(token));
      throw fail(502, "Имэйл илгээж чадсангүй. Дараа дахин оролдоно уу.");
    }
  }
  async function publicRoute(path, req, b) {
    if (
      !["/api/auth/forgot", "/api/auth/reset", "/api/auth/verify"].includes(
        path,
      )
    )
      return null;
    if (req.method !== "POST") throw fail(405, "POST шаардлагатай");
    throttle("account-ip:" + req.socket.remoteAddress, 20);
    if (path === "/api/auth/forgot") {
      if (!mailConfigured())
        throw fail(503, "Имэйл үйлчилгээний тохиргоо хүлээгдэж байна");
      const email = String(b.email || "")
        .trim()
        .toLowerCase();
      throttle("forgot:" + digest(email), 3);
      const u = get("SELECT id,email FROM users WHERE email=?", email);
      if (u) {
        try {
          await issue(u, "reset");
        } catch {
          console.error("Password recovery delivery failed");
        }
      }
      return {
        ok: true,
        message: "Бүртгэлтэй хаяг бол сэргээх холбоос илгээгдэнэ.",
      };
    }
    const purpose = path.endsWith("/verify") ? "verify" : "reset",
      raw = String(b.token || "");
    if (raw.length < 32 || raw.length > 100)
      throw fail(400, "Холбоос хүчингүй эсвэл хугацаа дууссан");
    const t = get(
      "SELECT * FROM account_tokens WHERE token=? AND purpose=? AND expires>?",
      digest(raw),
      purpose,
      Date.now(),
    );
    if (!t) throw fail(400, "Холбоос хүчингүй эсвэл хугацаа дууссан");
    const pass = purpose === "reset" ? password(b.password) : null;
    db.exec("BEGIN IMMEDIATE");
    try {
      const consumed = run(
        "DELETE FROM account_tokens WHERE token=? AND expires>?",
        t.token,
        Date.now(),
      );
      if (consumed.changes !== 1) throw fail(400, "Холбоос хүчингүй");
      if (purpose === "verify")
        run(
          "UPDATE users SET email_verified_at=? WHERE id=?",
          new Date().toISOString(),
          t.user,
        );
      else {
        run("UPDATE users SET password=? WHERE id=?", pass, t.user);
        run("DELETE FROM sessions WHERE user=?", t.user);
        run("DELETE FROM account_tokens WHERE user=?", t.user);
      }
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
    return { ok: true };
  }
  return {
    issue,
    publicRoute,
    verified: (u) =>
      !!get("SELECT email_verified_at FROM users WHERE id=?", u.id)
        ?.email_verified_at,
    requireVerified(u) {
      if (
        process.env.EMAIL_VERIFICATION_REQUIRED === "true" &&
        !this.verified(u)
      )
        throw fail(403, "Эхлээд и-мэйлээ баталгаажуулна уу");
    },
  };
}
