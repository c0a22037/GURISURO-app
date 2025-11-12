// calendar-app/api/api-lib/selections.js
// 選出結果（参加確定履歴）を取得するAPI
import { query } from "./_db.js"

export default async function selectionsHandler(req, res) {
  const { username } = req.query

  if (!username) {
    return res.status(400).json({ error: "username is required" })
  }

  try {
    // ユーザーが確定された選出結果を取得（過去のイベントも含む）
    const sql = `
      SELECT s.*, e.date, e.label, e.start_time, e.end_time, e.icon
      FROM selections s
      LEFT JOIN events e ON s.event_id = e.id
      WHERE s.user_id = (SELECT id FROM users WHERE username = $1)
      ORDER BY e.date DESC, s.created_at DESC
    `
    const result = await query(sql, [username])
    res.json(result.rows)
  } catch (err) {
    console.error("Error fetching selections:", err)
    res.status(500).json({ error: err.message })
  }
}
