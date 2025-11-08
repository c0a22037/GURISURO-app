// /api/api-lib/_db.js
import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export async function query(text, params) {
  const res = await pool.query(text, params);
  return res;
}

export async function healthcheck() {
  const r = await pool.query("SELECT 1");
  return r?.rows?.[0];
}