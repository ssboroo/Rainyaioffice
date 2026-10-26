import { randomBytes, createHash } from "node:crypto";
import { seal, unseal, canStoreSecrets } from "./secrets.mjs";
import { digest } from "./mail.mjs";
const fail = (status, message) => Object.assign(new Error(message), { status });
export const providers = {
  gmail: {
    name: "Gmail",
    group: "google",
    scope: "https://www.googleapis.com/auth/gmail.readonly",
    authorize: "https://accounts.google.com/o/oauth2/v2/auth",
    token: "https://oauth2.googleapis.com/token",
  },
  calendar: {
    name: "Google Calendar",
    group: "google",
    scope: "https://www.googleapis.com/auth/calendar.events.readonly",
    authorize: "https://accounts.google.com/o/oauth2/v2/auth",
    token: "https://oauth2.googleapis.com/token",
  },
  hubspot: {
    name: "HubSpot CRM",
    group: "hubspot",
    scope: "crm.objects.contacts.read",
    authorize: "https://app.hubspot.com/oauth/authorize",
    token: "https://api.hubapi.com/oauth/2026-03/token",
  },
};
const client = (p) => ({
  id: process.env[
    p.group === "google" ? "GOOGLE_CLIENT_ID" : "HUBSPOT_CLIENT_ID"
  ],
  secret:
    process.env[
      p.group === "google" ? "GOOGLE_CLIENT_SECRET" : "HUBSPOT_CLIENT_SECRET"
    ],
});
export function integrations(db) {
  db.exec(
    `CREATE TABLE IF NOT EXISTS oauth_states(state TEXT PRIMARY KEY,user TEXT,workspace TEXT,provider TEXT,session TEXT,verifier TEXT,expires INTEGER);CREATE TABLE IF NOT EXISTS integrations(user TEXT,workspace TEXT,provider TEXT,secret TEXT NOT NULL,connected TEXT,synced TEXT,error TEXT,PRIMARY KEY(user,workspace,provider));CREATE TABLE IF NOT EXISTS integration_items(user TEXT,workspace TEXT,provider TEXT,item TEXT,title TEXT,content TEXT,PRIMARY KEY(user,workspace,provider,item));`,
  );
  const get = (s, ...p) => db.prepare(s).get(...p),
    run = (s, ...p) => db.prepare(s).run(...p);
  const key = (u, w, p) => "oauth:" + w + ":" + u + ":" + p;
  const callback = (p) =>
    process.env.APP_ORIGIN + "/api/integrations/callback/" + p;
  function status(u, w) {
    return Object.entries(providers).map(([id, p]) => {
      const row = get(
          "SELECT connected,synced,error FROM integrations WHERE user=? AND workspace=? AND provider=?",
          u,
          w,
          id,
        ),
        c = client(p);
      return {
        id,
        name: p.name,
        configured: !!(
          c.id &&
          c.secret &&
          process.env.APP_ORIGIN &&
          canStoreSecrets()
        ),
        connected: !!row,
        ...row,
        scope: p.scope,
        readOnly: true,
      };
    });
  }
  function start(u, w, id, session) {
    const p = providers[id];
    if (!p) throw fail(404, "Интеграц олдсонгүй");
    const c = client(p);
    if (!c.id || !c.secret || !process.env.APP_ORIGIN || !canStoreSecrets())
      throw fail(503, "OAuth client тохиргоо хүлээгдэж байна");
    const state = randomBytes(32).toString("base64url"),
      verifier = randomBytes(48).toString("base64url");
    run(
      "DELETE FROM oauth_states WHERE expires<? OR (user=? AND provider=?)",
      Date.now(),
      u,
      id,
    );
    run(
      "INSERT INTO oauth_states VALUES(?,?,?,?,?,?,?)",
      digest(state),
      u,
      w,
      id,
      session,
      seal(verifier, key(u, w, id)),
      Date.now() + 600000,
    );
    const url = new URL(p.authorize);
    Object.entries({
      client_id: c.id,
      redirect_uri: callback(id),
      response_type: "code",
      scope: p.scope,
      state,
    }).forEach(([k, v]) => url.searchParams.set(k, v));
    if (p.group === "google") {
      url.searchParams.set("access_type", "offline");
      url.searchParams.set("prompt", "consent");
      url.searchParams.set(
        "code_challenge",
        createHash("sha256").update(verifier).digest("base64url"),
      );
      url.searchParams.set("code_challenge_method", "S256");
    }
    return { url: url.href, state };
  }
  async function tokenRequest(p, params) {
    const c = client(p);
    const r = await fetch(p.token, {
      method: "POST",
      signal: AbortSignal.timeout(15000),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        ...params,
        client_id: c.id,
        client_secret: c.secret,
      }),
    });
    if (!r.ok)
      throw fail(502, "OAuth эрхийг шинэчлэх боломжгүй. Дахин холбоно уу.");
    const d = await r.json();
    if (typeof d.access_token !== "string")
      throw fail(502, "OAuth token буруу");
    return {
      ...d,
      expiresAt:
        Date.now() + Math.min(Number(d.expires_in) || 3600, 86400) * 1000,
    };
  }
  async function finish(id, params, cookie) {
    const s = get(
      "SELECT * FROM oauth_states WHERE state=? AND provider=? AND expires>?",
      digest(params.state || ""),
      id,
      Date.now(),
    );
    if (!s || cookie !== digest(params.state || ""))
      throw fail(400, "OAuth state хүчингүй. Дахин холбоно уу.");
    const session = get(
        "SELECT user FROM sessions WHERE token=? AND expires>?",
        s.session,
        Date.now(),
      ),
      m = get(
        "SELECT role FROM members WHERE workspace=? AND user=?",
        s.workspace,
        s.user,
      );
    run("DELETE FROM oauth_states WHERE state=?", s.state);
    if (
      session?.user !== s.user ||
      !m ||
      !["owner", "admin", "member"].includes(m.role)
    )
      throw fail(403, "Нэвтрэх эрх өөрчлөгдсөн. Дахин холбоно уу.");
    if (params.error || !params.code)
      throw fail(400, "Холболтын зөвшөөрөл олгогдоогүй");
    const p = providers[id];
    const d = await tokenRequest(p, {
      grant_type: "authorization_code",
      code: params.code,
      redirect_uri: callback(id),
      ...(p.group === "google"
        ? { code_verifier: unseal(s.verifier, key(s.user, s.workspace, id)) }
        : {}),
    });
    if (p.group === "google" && !(d.scope || "").split(" ").includes(p.scope))
      throw fail(403, "Шаардлагатай унших эрх олгогдоогүй");
    const old = get(
      "SELECT secret FROM integrations WHERE user=? AND workspace=? AND provider=?",
      s.user,
      s.workspace,
      id,
    );
    if (!d.refresh_token && old)
      d.refresh_token = JSON.parse(
        unseal(old.secret, key(s.user, s.workspace, id)),
      ).refresh_token;
    run(
      "INSERT INTO integrations(user,workspace,provider,secret,connected) VALUES(?,?,?,?,?) ON CONFLICT(user,workspace,provider) DO UPDATE SET secret=excluded.secret,connected=excluded.connected,error=NULL",
      s.user,
      s.workspace,
      id,
      seal(JSON.stringify(d), key(s.user, s.workspace, id)),
      new Date().toISOString(),
    );
    return s.workspace;
  }
  const syncing = new Set(),
    refreshing = new Map();
  async function credential(u, w, id) {
    const row = get(
      "SELECT secret FROM integrations WHERE user=? AND workspace=? AND provider=?",
      u,
      w,
      id,
    );
    if (!row) throw fail(404, "Эхлээд холболт хийнэ үү");
    let d = JSON.parse(unseal(row.secret, key(u, w, id)));
    if (d.expiresAt > Date.now() + 60000) return d.access_token;
    const k = key(u, w, id);
    if (refreshing.has(k)) return refreshing.get(k);
    const pending = (async () => {
      if (!d.refresh_token)
        throw fail(401, "Холболтын хугацаа дууссан. Дахин холбоно уу.");
      const next = await tokenRequest(providers[id], {
        grant_type: "refresh_token",
        refresh_token: d.refresh_token,
      });
      d = {
        ...d,
        ...next,
        refresh_token: next.refresh_token || d.refresh_token,
      };
      run(
        "UPDATE integrations SET secret=? WHERE user=? AND workspace=? AND provider=?",
        seal(JSON.stringify(d), k),
        u,
        w,
        id,
      );
      return d.access_token;
    })();
    refreshing.set(k, pending);
    try {
      return await pending;
    } finally {
      refreshing.delete(k);
    }
  }
  async function sync(u, w, id) {
    if (!providers[id]) throw fail(404, "Интеграц олдсонгүй");
    const k = key(u, w, id);
    if (syncing.has(k)) throw fail(409, "Синк хийж байна");
    syncing.add(k);
    try {
      const access = await credential(u, w, id);
      async function read(url) {
        const r = await fetch(url, {
          headers: { Authorization: "Bearer " + access },
          signal: AbortSignal.timeout(15000),
          redirect: "error",
        });
        if (!r.ok)
          throw fail(
            502,
            "Интеграцийн өгөгдөл уншиж чадсангүй. Холболтоо шалгана уу.",
          );
        return r.json();
      }
      let rows = [];
      if (id === "gmail") {
        const list = await read(
          "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=15&labelIds=INBOX",
        );
        for (const m of list.messages || []) {
          const d = await read(
            "https://gmail.googleapis.com/gmail/v1/users/me/messages/" +
              encodeURIComponent(m.id) +
              "?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date",
          );
          const headers = d.payload?.headers || [];
          const header = (n) =>
            headers.find((h) => h.name.toLowerCase() === n)?.value || "";
          rows.push({
            id: m.id,
            title: header("subject") || "Гарчиггүй имэйл",
            content: `Илгээгч: ${header("from")}\nОгноо: ${header("date")}\n${d.snippet || ""}`,
          });
        }
      } else if (id === "calendar") {
        const d = await read(
          "https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&maxResults=50&timeMin=" +
            encodeURIComponent(new Date().toISOString()),
        );
        rows = (d.items || []).map((e) => ({
          id: e.id,
          title: e.summary || "Нэргүй арга хэмжээ",
          content: `Эхлэх: ${e.start?.dateTime || e.start?.date || ""}\nДуусах: ${e.end?.dateTime || e.end?.date || ""}\nБайршил: ${e.location || ""}\n${e.description || ""}`,
        }));
      } else {
        const d = await read(
          "https://api.hubapi.com/crm/v3/objects/contacts?limit=50&properties=firstname,lastname,email,company&archived=false",
        );
        rows = (d.results || []).map((c) => ({
          id: c.id,
          title:
            [c.properties?.firstname, c.properties?.lastname]
              .filter(Boolean)
              .join(" ") || "Нэргүй харилцагч",
          content: `И-мэйл: ${c.properties?.email || ""}\nБайгууллага: ${c.properties?.company || ""}`,
        }));
      }
      db.exec("BEGIN IMMEDIATE");
      try {
        run(
          "DELETE FROM integration_items WHERE user=? AND workspace=? AND provider=?",
          u,
          w,
          id,
        );
        for (const r of rows.slice(0, 50))
          run(
            "INSERT INTO integration_items VALUES(?,?,?,?,?,?)",
            u,
            w,
            id,
            String(r.id).slice(0, 300),
            String(r.title).slice(0, 300),
            String(r.content).slice(0, 20000),
          );
        run(
          "UPDATE integrations SET synced=?,error=NULL WHERE user=? AND workspace=? AND provider=?",
          new Date().toISOString(),
          u,
          w,
          id,
        );
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
      return { count: rows.length, partial: true };
    } catch (e) {
      run(
        "UPDATE integrations SET error=? WHERE user=? AND workspace=? AND provider=?",
        "Синк амжилтгүй. Холболтоо шалгана уу.",
        u,
        w,
        id,
      );
      throw e;
    } finally {
      syncing.delete(k);
    }
  }
  function items(u, w, id) {
    return db
      .prepare(
        "SELECT item,title,content FROM integration_items WHERE user=? AND workspace=? AND provider=?",
      )
      .all(u, w, id);
  }
  async function disconnect(u, w, id) {
    if (syncing.has(key(u, w, id)))
      throw fail(409, "Синк дууссаны дараа салгана уу");
    const row = get(
      "SELECT secret FROM integrations WHERE user=? AND workspace=? AND provider=?",
      u,
      w,
      id,
    );
    let revoked = false;
    if (row) {
      const d = JSON.parse(unseal(row.secret, key(u, w, id)));
      try {
        if (providers[id]?.group === "google") {
          const r = await fetch("https://oauth2.googleapis.com/revoke", {
            method: "POST",
            signal: AbortSignal.timeout(10000),
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              token: d.refresh_token || d.access_token,
            }),
          });
          revoked = r.ok;
        } else {
          const c = client(providers[id]);
          const r = await fetch(
            "https://api.hubapi.com/oauth/2026-03/token/revoke",
            {
              method: "POST",
              signal: AbortSignal.timeout(10000),
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({
                token: d.refresh_token || d.access_token,
                token_type_hint: "refresh_token",
                client_id: c.id,
                client_secret: c.secret,
              }),
            },
          );
          revoked = r.ok;
        }
      } catch {}
    }
    run(
      "DELETE FROM oauth_states WHERE user=? AND workspace=? AND provider=?",
      u,
      w,
      id,
    );
    run(
      "DELETE FROM integrations WHERE user=? AND workspace=? AND provider=?",
      u,
      w,
      id,
    );
    run(
      "DELETE FROM integration_items WHERE user=? AND workspace=? AND provider=?",
      u,
      w,
      id,
    );
    return {
      ok: true,
      revoked,
      message: revoked
        ? "Холболт салгасан"
        : "Локал холболт салгасан. Үйлчилгээний account settings дотроос зөвшөөрлийг цуцална уу.",
    };
  }
  return { status, start, finish, sync, items, disconnect };
}
