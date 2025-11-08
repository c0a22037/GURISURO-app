// /api-lib/users.js
import { query } from "../api-lid/_db.js";

export default async function handler(req, res) {
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.status(204).end();

    // 一覧取得
    if (req.method === "GET") {
      const result = await query("SELECT id, username, role FROM users ORDER BY id ASC");
      return res.status(200).json(result.rows);
    }

    // 新規追加
    if (req.method === "POST") {
      let body = req.body;
      if (typeof body === "string") {
        try { body = JSON.parse(body || "{}"); } catch { body = {}; }
      }

      const { username, password, role } = body;
      if (!username || !password) {
        return res.status(400).json({ error: "username と password は必須です" });
      }

      await query(
        "INSERT INTO users (username, password, role) VALUES ($1, $2, $3)",
        [username, password, role || "user"]
      );

      return res.status(201).json({ ok: true });
    }

    // 削除
    if (req.method === "DELETE") {
      const id = req.query?.id || new URL(req.url, `http://${req.headers.host}`).searchParams.get("id");
      if (!id) return res.status(400).json({ error: "id が必要です" });

      await query("DELETE FROM users WHERE id = $1", [id]);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Method Not Allowed" });
  } catch (err) {
    console.error("[/api/users] Error:", err);
    return res.status(500).json({ error: "Server Error: " + err.message });
  }
}