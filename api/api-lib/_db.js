// /api/api-lib/_db.js
import pkg from "pg";
const { Pool } = pkg;

// データベース接続文字列の検証
if (!process.env.DATABASE_URL) {
  console.error("❌ エラー: DATABASE_URL環境変数が設定されていません。");
  console.error("📝 .envファイルを作成して、DATABASE_URLを設定してください。");
  console.error("📋 例: DATABASE_URL=postgresql://user:password@localhost:5432/dbname");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("localhost") 
    ? false 
    : { rejectUnauthorized: false },
});

// 接続エラーのハンドリング
pool.on("error", (err) => {
  console.error("データベース接続エラー:", err);
  if (err.message.includes("ENOTFOUND")) {
    console.error("❌ データベースホストが見つかりません。DATABASE_URLを確認してください。");
  }
});

export async function query(text, params) {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL環境変数が設定されていません。.envファイルを確認してください。");
  }
  try {
    const res = await pool.query(text, params);
    return res;
  } catch (err) {
    console.error("データベースクエリエラー:", err);
    if (err.message.includes("ENOTFOUND")) {
      throw new Error("データベース接続エラー: ホスト名を解決できません。DATABASE_URLを確認してください。");
    }
    throw err;
  }
}

export async function healthcheck() {
  if (!process.env.DATABASE_URL) {
    return null;
  }
  try {
    const r = await pool.query("SELECT 1");
    return r?.rows?.[0];
  } catch (err) {
    console.error("データベースヘルスチェックエラー:", err);
    return null;
  }
}