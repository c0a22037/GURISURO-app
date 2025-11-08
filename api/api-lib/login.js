// /api-lib/login.js
import { query } from "./_db.js";

// リクエストボディを安全に JSON 化
function safeJson(body) {
  if (body && typeof body === "object") return body;
  if (typeof body === "string") {
    try { return JSON.parse(body); } catch { return {}; }
  }
  return {};
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    const { username, password } = safeJson(req.body);
    if (!username || !password) {
      return res.status(400).json({ error: "username と password は必須です" });
    }

    // 文字列比較（今回の仕様どおり平文）
    const r = await query(
      "SELECT id, username, role FROM users WHERE username = $1 AND password = $2 LIMIT 1",
      [username, password]
    );

    if (!r.rows?.length) {
      // 401 を返す（500にしない）
      return res.status(401).json({ error: "ユーザーが見つかりません" });
    }

    const row = r.rows[0];
    return res.status(200).json({
      ok: true,
      id: row.id,
      username: row.username,
      role: row.role || "user",
    });
  } catch (err) {
    console.error("[/api/login] error:", err);
    return res.status(500).json({ error: "Server Error: " + (err?.message || String(err)) });
  }
}