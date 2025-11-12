// /api/api-lib/index.js
import { query } from "./_db.js"
const { getSession } = require("./utils") // Assuming utils is a module that exports getSession
const url = require("url")

function withCORS(req, res) {
  // Implement CORS logic here
}

function resolveRoute(req) {
  // Implement route resolution logic here
}

async function parseJSONBody(req) {
  // Implement JSON body parsing logic here
}

export default async function handler(req, res) {
  try {
    withCORS(req, res)
    if (req.method === "OPTIONS") return res.status(204).end()

    const { q, sub } = resolveRoute(req)
    const body = await parseJSONBody(req)

    // ---- /api/user-settings ---- ユーザー設定（通知ON/OFF、Googleカレンダー同期）
    if (sub === "user-settings") {
      const session = await getSession(req)
      if (!session?.username) return res.status(401).json({ error: "認証が必要です" })

      return res.status(405).json({ error: "Method Not Allowed" })
    }

    // ---- /api/selections ---- 参加履歴の取得
    if (sub === "selections") {
      const session = await getSession(req)
      if (!session?.username) return res.status(401).json({ error: "認証が必要です" })

      if (req.method === "GET") {
        const username = q.get("username")
        if (!username) return res.status(400).json({ error: "username が必要です" })

        // セキュリティチェック: 自分の履歴のみ取得可能
        if (username !== session.username) {
          const userRes = await query(`SELECT role FROM users WHERE username = $1`, [session.username])
          if (!userRes.rows?.[0] || userRes.rows[0].role !== "admin") {
            return res.status(403).json({ error: "他のユーザーの履歴は閲覧できません" })
          }
        }

        // selectionsテーブルから確定済みイベントを取得
        const selectionsRes = await query(
          `SELECT s.event_id, s.username, s.kind AS role, s.decided_at AS created_at,
                  e.date, e.label, e.icon, e.start_time, e.end_time
           FROM selections s
           INNER JOIN events e ON e.id = s.event_id
           WHERE s.username = $1
           ORDER BY e.date DESC, e.start_time DESC`,
          [username],
        )

        return res.status(200).json(selectionsRes.rows || [])
      }

      return res.status(405).json({ error: "Method Not Allowed" })
    }

    // ---- /api/reminders ---- リマインド通知の生成（定期実行用）
    if (sub === "reminders") {
      // 管理者のみ実行可能（または内部cronジョブから）
      const session = await getSession(req)
      const authHeader = req.headers.authorization

      // 認証チェック: セッションまたはAuthorizationヘッダー
      if (!session && authHeader !== `Bearer ${process.env.CRON_SECRET || "dev-secret"}`) {
        return res.status(401).json({ error: "認証が必要です" })
      }

      if (req.method === "POST") {
        try {
          // 通知テーブルを保証
          await query(`
            CREATE TABLE IF NOT EXISTS notifications (
              id BIGSERIAL PRIMARY KEY,
              username TEXT NOT NULL,
              event_id BIGINT NOT NULL,
              kind TEXT NOT NULL,
              message TEXT NOT NULL,
              created_at TIMESTAMPTZ DEFAULT now(),
              read_at TIMESTAMPTZ
            )
          `)

          // 今日から3日後と1日後の日付を計算
          const today = new Date()
          const threeDaysLater = new Date(today)
          threeDaysLater.setDate(today.getDate() + 3)
          const oneDayLater = new Date(today)
          oneDayLater.setDate(today.getDate() + 1)

          const formatDate = (date) => {
            const y = date.getFullYear()
            const m = String(date.getMonth() + 1).padStart(2, "0")
            const d = String(date.getDate()).padStart(2, "0")
            return `${y}-${m}-${d}`
          }

          const threeDaysDate = formatDate(threeDaysLater)
          const oneDayDate = formatDate(oneDayLater)

          // 3日後と1日後の確定済みイベントを取得
          const upcomingEvents = await query(
            `SELECT DISTINCT s.username, s.event_id, s.kind, e.date, e.label, e.start_time, e.end_time
             FROM selections s
             INNER JOIN events e ON e.id = s.event_id
             WHERE e.date IN ($1, $2)
             ORDER BY e.date ASC`,
            [threeDaysDate, oneDayDate],
          )

          let notificationCount = 0

          // 各確定済みユーザーに通知を生成
          for (const event of upcomingEvents.rows) {
            const daysUntil = event.date === threeDaysDate ? 3 : 1
            const kindLabel = event.kind === "driver" ? "運転手" : "添乗員"

            // 既に同じ通知が存在するかチェック（重複防止）
            const existingNotif = await query(
              `SELECT id FROM notifications
               WHERE username = $1 AND event_id = $2 AND kind = $3
                 AND message LIKE $4 AND created_at > now() - interval '1 day'
               LIMIT 1`,
              [event.username, event.event_id, `reminder_${daysUntil}d_${event.kind}`, `%${daysUntil}日後%`],
            )

            if (existingNotif.rows.length === 0) {
              const message = `【リマインド】${event.label}（${event.date} ${event.start_time || ""}〜）の${kindLabel}として参加予定です（${daysUntil}日後）`

              await query(
                `INSERT INTO notifications (username, event_id, kind, message)
                 VALUES ($1, $2, $3, $4)`,
                [event.username, event.event_id, `reminder_${daysUntil}d_${event.kind}`, message],
              )

              notificationCount++
            }
          }

          return res.status(200).json({
            ok: true,
            message: `${notificationCount}件のリマインド通知を生成しました`,
            count: notificationCount,
          })
        } catch (error) {
          console.error("[reminders] Error:", error)
          return res.status(500).json({ error: `リマインド通知の生成に失敗しました: ${error.message}` })
        }
      }

      return res.status(405).json({ error: "Method Not Allowed" })
    }

    // ---- /api/google-oauth ---- Google OAuth認証
    if (sub === "google-oauth") {
    }

    // ---- その他 404 ----
    return res.status(404).json({ error: "Not Found" })
  } catch (err) {
    console.error("[/api/api-lib/index] Error:", err)
    return res.status(500).json({ error: "Server Error: " + (err?.message || String(err)) })
  }
}

