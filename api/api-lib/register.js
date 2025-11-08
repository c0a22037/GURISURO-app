// /api-lib/register.js
import { query } from "./_db.js";

// 文字列でもオブジェクトでも安全に取り出す
function safeBody(req) {
  if (!req?.body) return {};
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}

export default async function handler(req, res) {
  // POST 以外は拒否
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    // テーブルが無い環境でも動くように最低限のマイグレーション
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGSERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user'
      )
    `);

    const { username, password, role = "user" } = safeBody(req);

    if (!username || !password) {
      return res.status(400).json({ error: "username と password は必須です" });
    }

    // 既存確認
    const dup = await query("SELECT 1 FROM users WHERE username = $1", [username]);
    if (dup.rows.length) {
      return res.status(409).json({ error: "このユーザー名は既に存在します" });
    }

    // 既存の login と互換のため平文で保存（※本番は bcrypt 推奨）
    await query(
      "INSERT INTO users (username, password, role) VALUES ($1, $2, $3)",
      [username, password, role]
    );

    return res.status(200).json({ ok: true, message: "登録成功", role });
  } catch (err) {
    console.error("[/api/register] error:", err);
    return res.status(500).json({ error: "サーバーエラー" });
  }
}