// calendar-app/api/api-lib/reminders.js
// リマインド通知を生成するバックグラウンドジョブ
import { query } from "./_db.js"

// 3日前と1日前にリマインド通知を作成
export async function createReminders() {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // 3日後の日付
    const threeDaysLater = new Date(today)
    threeDaysLater.setDate(threeDaysLater.getDate() + 3)
    const threeDaysLaterStr = threeDaysLater.toISOString().split("T")[0]

    // 1日後の日付
    const oneDayLater = new Date(today)
    oneDayLater.setDate(oneDayLater.getDate() + 1)
    const oneDayLaterStr = oneDayLater.toISOString().split("T")[0]

    // 3日後のイベントの確定者に通知
    const threeDayEvents = await query(
      `SELECT DISTINCT e.id, e.label, e.date, e.start_time, s.user_id, s.role, u.username
       FROM events e
       INNER JOIN selections s ON e.id = s.event_id
       INNER JOIN users u ON s.user_id = u.id
       WHERE e.date = $1`,
      [threeDaysLaterStr],
    )

    for (const row of threeDayEvents.rows) {
      // 既に同じ通知が存在するかチェック
      const existing = await query(
        `SELECT id FROM notifications 
         WHERE user_id = $1 AND event_id = $2 AND kind = 'reminder_3days'`,
        [row.user_id, row.id],
      )

      if (existing.rows.length === 0) {
        const roleLabel = row.role === "driver" ? "運転手" : "添乗員"
        await query(
          `INSERT INTO notifications (user_id, event_id, kind, message, created_at)
           VALUES ($1, $2, 'reminder_3days', $3, NOW())`,
          [
            row.user_id,
            row.id,
            `【3日後】${row.label}（${row.date} ${row.start_time}〜）の${roleLabel}として参加予定です`,
          ],
        )
        console.log(`[Reminder] Created 3-day reminder for ${row.username} on event ${row.label}`)
      }
    }

    // 1日後のイベントの確定者に通知
    const oneDayEvents = await query(
      `SELECT DISTINCT e.id, e.label, e.date, e.start_time, s.user_id, s.role, u.username
       FROM events e
       INNER JOIN selections s ON e.id = s.event_id
       INNER JOIN users u ON s.user_id = u.id
       WHERE e.date = $1`,
      [oneDayLaterStr],
    )

    for (const row of oneDayEvents.rows) {
      // 既に同じ通知が存在するかチェック
      const existing = await query(
        `SELECT id FROM notifications 
         WHERE user_id = $1 AND event_id = $2 AND kind = 'reminder_1day'`,
        [row.user_id, row.id],
      )

      if (existing.rows.length === 0) {
        const roleLabel = row.role === "driver" ? "運転手" : "添乗員"
        await query(
          `INSERT INTO notifications (user_id, event_id, kind, message, created_at)
           VALUES ($1, $2, 'reminder_1day', $3, NOW())`,
          [
            row.user_id,
            row.id,
            `【明日】${row.label}（${row.date} ${row.start_time}〜）の${roleLabel}として参加予定です。お忘れなく！`,
          ],
        )
        console.log(`[Reminder] Created 1-day reminder for ${row.username} on event ${row.label}`)
      }
    }

    console.log(
      `[Reminder] Processed ${threeDayEvents.rows.length} 3-day and ${oneDayEvents.rows.length} 1-day reminders`,
    )
  } catch (err) {
    console.error("[Reminder] Error creating reminders:", err)
  }
}

// 定期実行用（1日1回実行を推奨）
export function startReminderScheduler() {
  // 初回実行
  createReminders()

  // 毎日午前9時に実行（ミリ秒）
  const now = new Date()
  const next9AM = new Date(now)
  next9AM.setHours(9, 0, 0, 0)
  if (next9AM <= now) {
    next9AM.setDate(next9AM.getDate() + 1)
  }
  const timeUntilNext9AM = next9AM - now

  setTimeout(() => {
    createReminders()
    // その後24時間ごとに実行
    setInterval(createReminders, 24 * 60 * 60 * 1000)
  }, timeUntilNext9AM)

  console.log(`[Reminder] Scheduler started. Next run at ${next9AM.toLocaleString("ja-JP")}`)
}
