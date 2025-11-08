// src/pages/AdminLogin.js
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

// ✅ JSONでもHTMLでも落ちない安全fetch
async function apiFetchSafe(url, options = {}) {
  const res = await fetch(url, options);
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    let data = {};
    try { data = await res.json(); } catch {}
    return { ok: res.ok, status: res.status, data };
  }
  // 500のHTMLなど非JSONも安全に
  let text = "";
  try { text = await res.text(); } catch {}
  return { ok: res.ok, status: res.status, data: { error: text?.slice(0, 200) || "非JSONレスポンス" } };
}

export default function AdminLogin() {
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    console.log("[AdminLogin] mounted");
    
    // ログアウト直後の場合は自動ログインをスキップ
    const justLoggedOut = sessionStorage.getItem("justLoggedOut");
    if (justLoggedOut === "true") {
      sessionStorage.removeItem("justLoggedOut");
      return; // 自動ログインしない
    }
    
    // ページロード時にクッキーからセッションを復元
    (async () => {
      try {
        const { ok, data } = await apiFetchSafe("/api?path=me");
        if (ok && data.username && data.role === "admin") {
          // クッキーから管理者セッションが復元できた場合、localStorageに保存してリダイレクト
          localStorage.setItem("userRole", "admin");
          localStorage.setItem("userName", data.username);
          nav("/admin/dashboard");
        }
      } catch (err) {
        // セッションがない場合は通常のログイン画面を表示
        console.log("No valid admin session found");
      }
    })();
  }, [nav]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg("送信中…");
    try {
      // 🔁 ここだけ変更: /api/login -> /api?path=login
      const { ok, status, data } = await apiFetchSafe("/api?path=login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: name, password: pw }),
      });

      if (!ok) {
        setMsg(data?.error || `ユーザーが見つかりません（${status}）`);
        return;
      }

      localStorage.setItem("userRole", data.role || "admin");
      localStorage.setItem("userName", data.username || name);
      setMsg("ログイン成功。ダッシュボードへ移動します");
      nav("/admin/dashboard");
    } catch (err) {
      console.error(err);
      setMsg("通信エラー");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f0fdf4",
        padding: 16,
        maxWidth: 420,
        margin: "40px auto",
        fontFamily: "system-ui",
      }}
    >
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>
        管理者ログイン
      </h1>

      <form onSubmit={onSubmit} style={{ 
        display: "grid", 
        WebkitDisplay: "grid",
        gridTemplateColumns: "1fr",
        WebkitGridTemplateColumns: "1fr",
        rowGap: "12px",
        WebkitRowGap: "12px"
      }}>
        <label>
          <div>ユーザー名</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="admin"
            style={{
              width: "100%",
              padding: 8,
              border: "1px solid #ddd",
              borderRadius: 8,
              backgroundColor: "#f0fdf4",
            }}
          />
        </label>
        <label>
          <div>パスワード</div>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="admin123"
            style={{
              width: "100%",
              padding: 8,
              border: "1px solid #ddd",
              borderRadius: 8,
            }}
          />
        </label>

        <button
          type="submit"
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: 0,
            background: "#2563eb",
            color: "#fff",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          ログイン
        </button>
      </form>

      {msg && (
        <p style={{ marginTop: 12, color: msg.includes("成功") ? "green" : "red" }}>{msg}</p>
      )}

      {/* ✅ 一般ユーザーログインへのリンク */}
      <p style={{ marginTop: 20, fontSize: 14 }}>
        一般ユーザーログインは{" "}
        <span
          onClick={() => nav("/")}
          style={{
            color: "#2563eb",
            textDecoration: "underline",
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          こちら
        </span>
      </p>

      <p style={{ marginTop: 12, fontSize: 12, color: "#666" }}>
        ヒント: Vercel でも /admin が白くならず、このフォームが見えればOK
      </p>
    </div>
  );
}