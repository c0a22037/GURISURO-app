// /api/api-lib/index.js
import { query, healthcheck } from "./_db.js";
import crypto from "crypto";

// ===== CORS 共通ヘッダ =====oo
function withCORS(req, res) {
  // 本番URLを明示指定
  res.setHeader("Access-Control-Allow-Origin", "https://gurisuro-schedule-app.vercel.app");
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, PATCH, OPTIONS");
  // 認証付きfetchでcookie/認証情報を許可
  res.setHeader("Access-Control-Allow-Credentials", "true");
  // 必要なヘッダーは網羅
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Cookie, X-Requested-With");
}

// ===== Cookie ユーティリティ =====
const SESSION_COOKIE_NAME = "gsession";
const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-secret-change-me";

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function sign(data) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(data).digest("base64url");
}

function serializeCookie(name, value, { maxAge, path = "/", httpOnly = true, sameSite = "Lax", secure } = {}) {
  const parts = [`${name}=${value}`];
  if (maxAge) parts.push(`Max-Age=${maxAge}`);
  if (path) parts.push(`Path=${path}`);
  if (httpOnly) parts.push("HttpOnly");
  if (sameSite) parts.push(`SameSite=${sameSite}`);
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

function setSessionCookie(res, payload, req) {
  const json = JSON.stringify(payload);
  const b64 = base64url(json);
  const sig = sign(b64);
  const value = `${b64}.${sig}`;
  const secure = (req.headers["x-forwarded-proto"] || "http") === "https";
  res.setHeader(
    "Set-Cookie",
    serializeCookie(SESSION_COOKIE_NAME, value, {
      maxAge: SESSION_MAX_AGE_SEC,
      httpOnly: true,
      sameSite: "Lax",
      secure,
      path: "/",
    })
  );
}

function clearSessionCookie(res, req) {
  const secure = (req.headers["x-forwarded-proto"] || "http") === "https";
  res.setHeader(
    "Set-Cookie",
    serializeCookie(SESSION_COOKIE_NAME, "", {
      maxAge: 0,
      httpOnly: true,
      sameSite: "Lax",
      secure,
      path: "/",
    })
  );
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return header.split(/;\s*/).reduce((acc, v) => {
    if (!v) return acc;
    const idx = v.indexOf("=");
    if (idx === -1) return acc;
    const k = decodeURIComponent(v.slice(0, idx).trim());
    const val = decodeURIComponent(v.slice(idx + 1).trim());
    acc[k] = val;
    return acc;
  }, {});
}

function getSession(req) {
  const cookies = parseCookies(req);
  const raw = cookies[SESSION_COOKIE_NAME];
  if (!raw) return null;
  const [b64, sig] = raw.split(".");
  if (!b64 || !sig) return null;
  const expected = sign(b64);
  if (sig !== expected) return null;
  try {
    const json = Buffer.from(b64.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const data = JSON.parse(json);
    if (!data || typeof data !== "object") return null;
    return data;
  } catch {
    return null;
  }
}

// ===== JSONボディパーサ =====
async function parseJSONBody(req) {
  if (req.method === "GET" || req.method === "DELETE") return {};
  try {
    if (typeof req.body === "object" && req.body !== null) return req.body;
    const text = await new Promise((resolve) => {
      let s = "";
      req.on("data", (c) => (s += c));
      req.on("end", () => resolve(s || ""));
    });
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

// ===== ルート解決 =====
function resolveRoute(req) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const q = url.searchParams;
  const trim = (s) => (s || "").replace(/^\/+|\/+$/g, "");

  // vercel.json の rewrite で ?path=xxx が付く想定
  let sub = trim(q.get("path"));

  // 保険: forwarded header / 実パスから推測
  if (!sub) {
    const forwarded = [
      req.headers["x-forwarded-uri"],
      req.headers["x-invoke-path"],
      req.headers["x-vercel-path"],
    ].find(Boolean);
    if (typeof forwarded === "string") {
      const p = trim(forwarded);
      sub = p.startsWith("api/") ? trim(p.slice(4)) : p;
    } else {
      const p = trim(url.pathname);
      sub = p.startsWith("api/") ? trim(p.slice(4)) : p;
    }
  }
  return { url, q, sub };
}

// ===== メインハンドラ =====
export default async function handler(req, res) {
  try {
    withCORS(req, res);
    if (req.method === "OPTIONS") return res.status(204).end();

    const { q, sub } = resolveRoute(req);
    const body = await parseJSONBody(req);

    // ---- /api/health ----
    if (sub === "health") {
      const dbOK = await healthcheck().catch(() => 0);
      return res.status(200).json({ ok: true, db: dbOK ? 1 : 0 });
    }

    // ---- /api/login ----
    if (sub === "login") {
      if (req.method !== "POST" && req.method !== "GET") {
        return res.status(405).json({ error: "Method Not Allowed" });
      }

      const username =
        (req.method === "GET" ? q.get("username") : (body || {}).username) || "";
      const password =
        (req.method === "GET" ? q.get("password") : (body || {}).password) || "";

      if (!username || !password) {
        return res.status(400).json({ error: "username と password が必要です" });
      }

      const r = await query(
        "SELECT id, username, password, role FROM users WHERE username = $1 LIMIT 1",
        [username]
      );
      const u = r.rows?.[0];
      if (!u) return res.status(404).json({ error: "ユーザーが見つかりません" });
      if (u.password !== password)
        return res.status(401).json({ error: "パスワードが違います" });

      // セッション cookie 設定
      setSessionCookie(res, { id: u.id, username: u.username, role: u.role || "user" }, req);

      return res.status(200).json({ message: "OK", role: u.role, username: u.username });
    }

    // ---- /api/me ----
    if (sub === "me") {
      const sess = getSession(req);
      if (!sess) return res.status(401).json({ error: "Not authenticated" });
      return res.status(200).json({ ok: true, ...sess });
    }

    // ---- /api/logout ----
    if (sub === "logout") {
      clearSessionCookie(res, req);
      return res.status(200).json({ ok: true });
    }

    // ---- /api/register ----
    if (sub === "register") {
      if (req.method !== "POST")
        return res.status(405).json({ error: "Method Not Allowed" });

      const { username, password, role = "user" } = body || {};
      if (!username || !password)
        return res.status(400).json({ error: "username と password が必要です" });

      try {
        await query(
          "INSERT INTO users (username, password, role) VALUES ($1,$2,$3)",
          [username, password, role]
        );
        return res.status(201).json({ ok: true });
      } catch (e) {
        if (String(e?.message || "").includes("duplicate key"))
          return res
            .status(409)
            .json({ error: "このユーザー名は既に存在します" });
        throw e;
      }
    }

    // ---- /api/users ----
    if (sub === "users") {
      if (req.method === "GET") {
        const r = await query(
          "SELECT id, username, role, familiar FROM users ORDER BY id ASC"
        );
        return res.status(200).json(r.rows);
      }
      if (req.method === "POST") {
        const { username, password, role = "user", familiar = null } = body || {};
        if (!username || !password)
          return res.status(400).json({ error: "必須項目不足" });
        await query(
          "INSERT INTO users (username, password, role, familiar) VALUES ($1,$2,$3,$4)",
          [username, password, role, familiar]
        );
        return res.status(201).json({ ok: true });
      }
      if (req.method === "DELETE") {
        const id = q.get("id");
        if (!id) return res.status(400).json({ error: "id が必要です" });
        await query("DELETE FROM users WHERE id = $1", [id]);
        return res.status(200).json({ ok: true });
      }
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    // ---- /api/events ----
    if (sub === "events") {
      if (req.method === "GET") {
        const r = await query(
          "SELECT id, date, label, icon, start_time, end_time, capacity_driver, capacity_attendant FROM events ORDER BY date ASC"
        );
        return res.status(200).json(r.rows);
      }
      if (req.method === "POST") {
        const {
          date,
          label,
          icon = "",
          start_time = null,
          end_time = null,
          capacity_driver = null,
          capacity_attendant = null,
        } = body || {};
        if (!date || !label)
          return res.status(400).json({ error: "date と label は必須です" });
        await query(
          `INSERT INTO events (date, label, icon, start_time, end_time, capacity_driver, capacity_attendant)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [date, label, icon, start_time, end_time, capacity_driver, capacity_attendant]
        );
        return res.status(201).json({ ok: true });
      }
      if (req.method === "DELETE") {
        const id = q.get("id");
        if (!id) return res.status(400).json({ error: "id が必要です" });
        await query("DELETE FROM events WHERE id = $1", [id]);
        return res.status(200).json({ ok: true });
      }
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    // ---- /api/applications ----
    if (sub === "applications") {
      if (req.method === "GET") {
        const eventId = q.get("event_id");
        const username = q.get("username");
        if (eventId) {
          const r = await query(
            "SELECT id, event_id, username, kind, created_at FROM applications WHERE event_id = $1 ORDER BY created_at ASC",
            [eventId]
          );
          return res.status(200).json(r.rows);
        }
        if (username) {
          const r = await query(
            "SELECT id, event_id, username, kind, created_at FROM applications WHERE username = $1 ORDER BY created_at DESC",
            [username]
          );
          return res.status(200).json(r.rows);
        }
        return res
          .status(400)
          .json({ error: "event_id または username を指定してください" });
      }

      if (req.method === "POST") {
        const { event_id, username, kind } = body || {};
        if (!event_id || !username || !kind)
          return res
            .status(400)
            .json({ error: "event_id, username, kind が必要です" });

        await query(
          `INSERT INTO applications (event_id, username, kind)
           VALUES ($1,$2,$3)
           ON CONFLICT (event_id, username, kind) DO NOTHING`,
          [event_id, username, kind]
        );
        return res.status(201).json({ ok: true });
      }

      if (req.method === "DELETE") {
        // 応募取消（id または event_id + username + kind）
        const id = q.get("id");
        const eventId = q.get("event_id");
        const username = q.get("username");
        const kind = q.get("kind");

        if (id) {
          await query("DELETE FROM applications WHERE id = $1", [id]);
          return res.status(200).json({ ok: true });
        }
        if (eventId && username && kind) {
          await query(
            "DELETE FROM applications WHERE event_id = $1 AND username = $2 AND kind = $3",
            [eventId, username, kind]
          );
          return res.status(200).json({ ok: true });
        }
        return res
          .status(400)
          .json({ error: "id または (event_id, username, kind) が必要です" });
      }

      return res.status(405).json({ error: "Method Not Allowed" });
    }

    // ---- /api/fairness ----
    if (sub === "fairness") {
      if (req.method !== "GET")
        return res.status(405).json({ error: "Method Not Allowed" });

      const eventId = q.get("event_id");
      if (!eventId)
        return res.status(400).json({ error: "event_id が必要です" });

      const sql = `
        WITH appl AS (
          SELECT a.id, a.event_id, a.username, a.kind, a.created_at,
                 COALESCE(v.times, 0) AS times,
                 v.last_at
          FROM applications a
          LEFT JOIN v_participation v
            ON v.username = a.username AND v.kind = a.kind
          WHERE a.event_id = $1
        ),
        ranked AS (
          SELECT *,
                 ROW_NUMBER() OVER (
                   PARTITION BY kind
                   ORDER BY times ASC,
                            COALESCE(last_at, 'epoch') ASC,
                            created_at ASC
                 ) AS rnk
          FROM appl
        )
        SELECT * FROM ranked ORDER BY kind, rnk;
      `;
      const r = await query(sql, [eventId]);

      const driver = [], attendant = [];
      for (const row of r.rows) {
        const item = {
          username: row.username,
          kind: row.kind,
          times: Number(row.times) || 0,
          last_at: row.last_at,
          applied_at: row.created_at,
          rank: Number(row.rnk),
        };
        (row.kind === "driver" ? driver : attendant).push(item);
      }

      return res.status(200).json({ event_id: Number(eventId), driver, attendant });
    }

    // ---- /api/decide ---- 選出の保存/取得/取消
    if (sub === "decide") {
      // テーブルを保証
      await query(
        `CREATE TABLE IF NOT EXISTS selections (
           event_id BIGINT NOT NULL,
           username TEXT NOT NULL,
           kind TEXT NOT NULL CHECK (kind IN ('driver','attendant')),
           decided_at TIMESTAMPTZ DEFAULT now(),
           PRIMARY KEY (event_id, username, kind)
         )`
      );

      if (req.method === "GET") {
        const eventId = Number(q.get("event_id"));
        if (!eventId) return res.status(400).json({ error: "event_id が必要です" });
        const r = await query(
          `SELECT username, kind FROM selections WHERE event_id = $1 ORDER BY decided_at ASC`,
          [eventId]
        );
        const driver = r.rows.filter((x) => x.kind === "driver").map((x) => x.username);
        const attendant = r.rows.filter((x) => x.kind === "attendant").map((x) => x.username);
        return res.status(200).json({ event_id: eventId, driver, attendant });
      }

      if (req.method === "DELETE") {
        const eventId = Number(q.get("event_id"));
        if (!eventId) return res.status(400).json({ error: "event_id が必要です" });
        await query(`DELETE FROM selections WHERE event_id = $1`, [eventId]);
        return res.status(200).json({ ok: true });
      }

      if (req.method === "POST") {
        const { event_id, driver = [], attendant = [] } = body || {};
        const eventId = Number(event_id);
        if (!eventId) return res.status(400).json({ error: "event_id が必要です" });

        // 定員チェック（存在すれば）
        let capD = null, capA = null;
        try {
          const er = await query(
            `SELECT capacity_driver, capacity_attendant FROM events WHERE id = $1`,
            [eventId]
          );
          if (er.rows?.[0]) {
            capD = er.rows[0].capacity_driver != null ? Number(er.rows[0].capacity_driver) : null;
            capA = er.rows[0].capacity_attendant != null ? Number(er.rows[0].capacity_attendant) : null;
          }
        } catch {}

        if (capD != null && driver.length > capD) {
          return res.status(400).json({ error: `運転手の選出が定員(${capD})を超えています` });
        }
        if (capA != null && attendant.length > capA) {
          return res.status(400).json({ error: `添乗員の選出が定員(${capA})を超えています` });
        }

        await query(`DELETE FROM selections WHERE event_id = $1`, [eventId]);
        const values = [];
        for (const u of Array.from(new Set(driver))) {
          values.push([eventId, u, "driver"]);
        }
        for (const u of Array.from(new Set(attendant))) {
          values.push([eventId, u, "attendant"]);
        }
        if (values.length) {
          const params = values.flatMap((v) => v);
          const tuples = values.map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`).join(",");
          await query(
            `INSERT INTO selections (event_id, username, kind) VALUES ${tuples}
             ON CONFLICT (event_id, username, kind) DO NOTHING`,
            params
          );
        }
        return res.status(200).json({ ok: true });
      }

      return res.status(405).json({ error: "Method Not Allowed" });
    }

    // ---- その他 404 ----
    return res.status(404).json({ error: "Not Found" });
  } catch (err) {
    console.error("[/api/api-lib/index] Error:", err);
    return res
      .status(500)
      .json({ error: "Server Error: " + (err?.message || String(err)) });
  }
}