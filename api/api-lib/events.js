// /api-lib/events.js
import { query } from "./_db.js";

/** UTC -> JST の YYYY-MM-DD 文字列に正規化 */
function toJSTYmd(anyDateLike) {
  if (!anyDateLike) return null;

  // すでに 'YYYY-MM-DD' のテキストならそのまま返す
  if (typeof anyDateLike === "string" && /^\d{4}-\d{2}-\d{2}$/.test(anyDateLike)) {
    return anyDateLike;
  }

  const d = new Date(anyDateLike);
  if (isNaN(d)) return null;

  // JST(+9h) に補正
  const j = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const y = j.getFullYear();
  const m = String(j.getMonth() + 1).padStart(2, "0");
  const day = String(j.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** リクエストURLから :id っぽいもの or ?id= を取得（両対応） */
function extractId(req) {
  try {
    // 例: /api/events/123 も /api/events?id=123 もOKにする
    const u = new URL(req.url, `http://${req.headers.host}`);
    const qp = u.searchParams.get("id");
    if (qp) return qp;

    const m = u.pathname.match(/\/api\/events\/(\d+)$/);
    if (m) return m[1];

    // Vercel の req.query に入っていればそれも使う
    // （環境によっては undefined）
    // eslint-disable-next-line no-unused-expressions
    return req.query?.id;
  } catch {
    return undefined;
  }
}

export default async function handler(req, res) {
  try {
    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.status(204).end();

    // ===== GET: 一覧（JSTで日付を返す） =====
    if (req.method === "GET") {
      // event_date(date型) がある場合はそれを基準に、なければ text の date を date 化して並べ替え
      const sql = `
        SELECT
          id,
          date,
          event_date,
          label,
          icon,
          start_time,
          end_time
        FROM events
        ORDER BY COALESCE(event_date, NULLIF(date, '')::date) ASC, start_time NULLS FIRST;
      `;
      const result = await query(sql);

      const rows = (result.rows || []).map((r) => ({
        id: r.id,
        // 優先順: event_date -> date を JST YYYY-MM-DD へ
        date: toJSTYmd(r.event_date ?? r.date),
        label: r.label,
        icon: r.icon,
        start_time: r.start_time,
        end_time: r.end_time,
      }));

      return res.status(200).json(rows);
    }

    // ===== POST: 追加（event_date も更新） =====
    if (req.method === "POST") {
      let body = req.body;
      if (typeof body === "string") {
        try {
          body = JSON.parse(body || "{}");
        } catch {
          body = {};
        }
      }
      const { date, label, icon, start_time, end_time } = body || {};
      if (!date || !label) {
        return res.status(400).json({ error: "date と label は必須です。" });
      }

      // 受け取った日付を JST の YYYY-MM-DD に正規化して保存
      const ymd = toJSTYmd(date);
      if (!ymd) return res.status(400).json({ error: "不正な日付です。" });

      // event_date は date 型カラム前提（既に追加済み）
      // UNIQUE 制約がある/ないどちらでも動くように、まず単純INSERTを試し、
      // 失敗したら重複扱いで無視してOKにする実装でも良いですが、
      // ここではON CONFLICTがある前提のUPSERT（なければ普通のINSERTに置き換えてください）
      // 例: UNIQUE(date, label, start_time, end_time)
      const sql = `
        INSERT INTO events (date, event_date, label, icon, start_time, end_time)
        VALUES ($1, $2::date, $3, $4, $5, $6)
        ON CONFLICT (date, label, start_time, end_time) DO NOTHING;
      `;
      await query(sql, [ymd, ymd, label, icon || "", start_time || null, end_time || null]);

      return res.status(201).json({ ok: true });
    }

    // ===== DELETE: /api/events/:id でも /api/events?id= でも削除可能 =====
    if (req.method === "DELETE") {
      const id = extractId(req);
      if (!id) return res.status(400).json({ error: "id が必要です" });

      await query("DELETE FROM events WHERE id = $1", [id]);
      return res.status(200).json({ ok: true });
    }

    // それ以外
    return res.status(405).json({ error: "Method Not Allowed" });
  } catch (err) {
    console.error("[/api/events] Error:", err);
    return res.status(500).json({ error: "Server Error: " + err.message });
  }
}