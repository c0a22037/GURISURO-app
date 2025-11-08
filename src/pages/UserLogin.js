// src/pages/UserLogin.js
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

/**
 * シンプルな API 呼び出しユーティリティ（500時のHTMLにも耐える）
 */
async function apiFetch(url, options = {}) {
  const res = await fetch(url, { credentials: "include", ...options });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (_) {}
  return { ok: res.ok, status: res.status, data, text };
}

export default function UserLogin() {
  const nav = useNavigate();
  
  // ページロード時にクッキーからセッションを復元
  useEffect(() => {
    // ログアウト直後の場合は自動ログインをスキップ
    const justLoggedOut = sessionStorage.getItem("justLoggedOut");
    if (justLoggedOut === "true") {
      sessionStorage.removeItem("justLoggedOut");
      return; // 自動ログインしない
    }
    
    (async () => {
      try {
        const { ok, data } = await apiFetch("/api?path=me");
        if (ok && data.username) {
          // クッキーからセッションが復元できた場合、localStorageに保存してリダイレクト
          localStorage.setItem("userRole", data.role || "user");
          localStorage.setItem("userName", data.username);
          nav(data.role === "admin" ? "/admin/dashboard" : "/app");
        }
      } catch (err) {
        // セッションがない場合は通常のログイン画面を表示
        console.log("No valid session found");
      }
    })();
  }, [nav]);

  // ログイン用
  const [name, setName] = useState("");
  const [pw, setPw] = useState("");
  const [loginMsg, setLoginMsg] = useState("");
  const [logLoading, setLogLoading] = useState(false);

  // 登録用
  const [showRegister, setShowRegister] = useState(true);
  const [regName, setRegName] = useState("");
  const [regPw, setRegPw] = useState("");
  const [regPw2, setRegPw2] = useState("");
  const [regMsg, setRegMsg] = useState("");
  const [regLoading, setRegLoading] = useState(false);

  // ★ 幕張ベイタウンの熟知度
  const [familiarity, setFamiliarity] = useState("unfamiliar");

  // ---- ログイン ----
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginMsg("");
    const username = name.trim();
    if (!username || !pw) {
      setLoginMsg("お名前とパスワードを入力してください。");
      return;
    }
    setLogLoading(true);
    try {
      // 🔁 /api/login → /api?path=login
      const { ok, data, status } = await apiFetch("/api?path=login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: name, password: pw }),
      });

      if (!ok) {
        setLoginMsg(data?.error || `ログインに失敗しました（${status}）`);
        return;
      }

      localStorage.setItem("userRole", data.role || "user");
      localStorage.setItem("userName", username);
      setLoginMsg("ログイン成功！");
      nav(data.role === "admin" ? "/admin/dashboard" : "/app");
    } catch (err) {
      console.error(err);
      setLoginMsg("通信エラーが発生しました。ネットワークを確認してください。");
    } finally {
      setLogLoading(false);
    }
  };

  // ---- 新規登録 ----
  const handleRegister = async (e) => {
    e.preventDefault();
    setRegMsg("");
    const username = regName.trim();

    if (!username || !regPw || !regPw2) {
      setRegMsg("お名前・パスワードをすべて入力してください。");
      return;
    }
    if (username.length < 2) {
      setRegMsg("お名前は2文字以上で入力してください。");
      return;
    }
    if (regPw.length < 4) {
      setRegMsg("パスワードは4文字以上で入力してください。");
      return;
    }
    if (regPw !== regPw2) {
      setRegMsg("パスワードが一致しません。");
      return;
    }

    setRegLoading(true);
    try {
      // 🔁 /api/register → /api?path=register
      const { ok, data, status } = await apiFetch("/api?path=register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password: regPw,
          role: "user",
          familiarity,
          familiar: familiarity, // ← 同じ値を保険で重複送信
        }),
      });

      if (!ok) {
        setRegMsg(data?.error || `登録に失敗しました（${status}）`);
        return;
      }

      // 登録成功 → ログイン
      setRegMsg("登録が完了しました。ログインしています…");
      const login = await apiFetch("/api?path=login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password: regPw }),
      });

      if (!login.ok) {
        setRegMsg("登録は成功しましたが、ログインに失敗しました。ログイン欄からお試しください。");
        return;
      }

      localStorage.setItem("userRole", login.data.role || "user");
      localStorage.setItem("userName", username);
      nav("/app");
    } catch (err) {
      console.error(err);
      setRegMsg("通信エラーが発生しました。");
    } finally {
      setRegLoading(false);
    }
  };

  // --- 以降はUI（変更なし） ---
  const card = {
    width: "100%",
    maxWidth: 420,
    margin: "40px auto",
    background: "#fff",
    borderRadius: 12,
    padding: 24,
    boxShadow: "0 6px 24px rgba(0,0,0,.06)",
    fontFamily:
      "system-ui, -apple-system, Segoe UI, Roboto, 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', sans-serif",
  };
  const input = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    outline: "none",
    background: "#fff",
  };
  const btn = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: 0,
    background: "#2563eb",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
  };
  const divider = {
    height: 1,
    background: "#e5e7eb",
    margin: "18px 0",
  };
  const small = { fontSize: 12, color: "#6b7280" };

  return (
    <div style={{ minHeight: "100vh", background: "#f0fdf4", padding: 16 }}>
      <div style={card}>
        <h1 style={{ textAlign: "center", fontSize: 20, fontWeight: 800, marginBottom: 12 }}>
          一般ユーザーログイン
        </h1>

        {/* ログイン */}
        <form onSubmit={handleLogin} style={{ 
          display: "grid", 
          WebkitDisplay: "grid",
          gridTemplateColumns: "1fr",
          WebkitGridTemplateColumns: "1fr",
          rowGap: "12px",
          WebkitRowGap: "12px"
        }}>
          <label>
            <div style={{ marginBottom: 6, fontSize: 14 }}>お名前</div>
            <input
              style={input}
              placeholder="山田 太郎"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="username"
            />
          </label>

          <label>
            <div style={{ marginBottom: 6, fontSize: 14 }}>パスワード</div>
            <input
              style={input}
              type="password"
              placeholder="********"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoComplete="current-password"
            />
          </label>

          <button type="submit" style={btn} disabled={logLoading}>
            {logLoading ? "ログイン中…" : "ログイン"}
          </button>

          {loginMsg && (
            <div style={{ color: loginMsg.includes("成功") ? "green" : "#dc2626", fontSize: 14 }}>
              {loginMsg}
            </div>
          )}
        </form>

        {/* 登録フォームのトグル */}
        <div style={{ ...divider, marginTop: 16 }} />
        <button
          type="button"
          onClick={() => setShowRegister((v) => !v)}
          style={{
            ...btn,
            background: "透明",
            color: "#2563eb",
            border: "1px solid #bfdbfe",
          }}
        >
          {showRegister ? "登録フォームを閉じる" : "新規ユーザー登録を開く"}
        </button>

        {/* 新規登録 */}
        {showRegister && (
          <form onSubmit={handleRegister} style={{ 
            display: "grid", 
            WebkitDisplay: "grid",
            gridTemplateColumns: "1fr",
            WebkitGridTemplateColumns: "1fr",
            rowGap: "12px",
            WebkitRowGap: "12px",
            marginTop: 12 
          }}>
            <p style={small}>入力した お名前 と パスワード で登録します。</p>

            <label>
              <div style={{ marginBottom: 6, fontSize: 14 }}>お名前（2文字以上）</div>
              <input
                style={input}
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="例：佐藤 花子"
                autoComplete="off"
              />
            </label>

            <label>
              <div style={{ marginBottom: 6, fontSize: 14 }}>パスワード（4文字以上）</div>
              <input
                style={input}
                type="password"
                value={regPw}
                onChange={(e) => setRegPw(e.target.value)}
                placeholder="********"
                autoComplete="new-password"
              />
            </label>

            <label>
              <div style={{ marginBottom: 6, fontSize: 14 }}>パスワード（再入力）</div>
              <input
                style={input}
                type="password"
                value={regPw2}
                onChange={(e) => setRegPw2(e.target.value)}
                placeholder="********"
                autoComplete="new-password"
              />
            </label>

            {/* ★ 幕張ベイタウンに詳しい/詳しくない */}
            <label>
              <div style={{ marginBottom: 6, fontSize: 14 }}>幕張ベイタウンの土地勘</div>
              <select
                value={familiarity}
                onChange={(e) => setFamiliarity(e.target.value)}
                style={{ ...input, background: "#fff" }}
              >
                <option value="familiar">詳しい</option>
                <option value="unfamiliar">詳しくない</option>
              </select>
              <div style={{ ...small, marginTop: 6 }}>
                ※将来のペア組み合わせ（例：詳しくない人同士を避ける 等）で活用します
              </div>
            </label>

            <button type="submit" style={{ ...btn, background: "#2f855a" }} disabled={regLoading}>
              {regLoading ? "登録中…" : "登録する"}
            </button>

            {regMsg && (
              <div style={{ color: regMsg.includes("完了") ? "green" : "#dc2626", fontSize: 14 }}>
                {regMsg}
              </div>
            )}
          </form>
        )}

        {/* 管理者リンク */}
        <div style={{ ...divider, marginTop: 18 }} />
        <p style={{ textAlign: "center", ...small }}>
          <span
            onClick={() => nav("/admin")}
            style={{ color: "#2563eb", textDecoration: "underline", cursor: "pointer" }}
          >
            管理者ログインはこちら
          </span>
        </p>
      </div>
    </div>
  );
}