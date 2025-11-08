// src/lib/date.js
// ローカル日付 (YYYY-MM-DD) を返す
export function toLocalYMD(input) {
  const d = input instanceof Date ? input : new Date(input);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// 'YYYY-MM-DD' をローカルの Date に安全に変換
// （Safari対応のため new Date('YYYY-MM-DD') は使わない）
export function parseYMD(ymd) {
  if (!ymd || typeof ymd !== "string") return new Date();
  const [y, m, d] = ymd.split("-").map((v) => parseInt(v, 10));
  return new Date(y, (m || 1) - 1, d || 1);
}

// 今日の YYYY-MM-DD（ローカル）
export function todayYMD() {
  return toLocalYMD(new Date());
}