// src/pages/AdminLayout.js
import React from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";

export default function AdminLayout() {
  const location = useLocation();
  const nav = useNavigate();

  const logout = async () => {
    // ログアウトフラグを設定（自動ログインを防ぐ）
    sessionStorage.setItem("justLoggedOut", "true");
    
    // ログアウトAPIを呼び出してクッキーを削除
    try {
      const res = await fetch("/api?path=logout", { method: "POST", credentials: "include" });
      if (!res.ok) console.error("Logout API error");
    } catch (e) {
      console.error("Logout API error:", e);
    }
    
    localStorage.clear();
    
    // クッキーが削除されるまで少し待ってからリロード
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // ログインページへ移動
    window.location.href = "/admin";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 上部ナビゲーション */}
      <header className="bg-white shadow-sm p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">管理者ページ</h1>
        <nav className="flex gap-4">
          <Link
            to="/admin/dashboard"
            className={`${
              location.pathname.includes("dashboard")
                ? "text-blue-600 font-semibold border-b-2 border-blue-600"
                : "text-gray-600 hover:text-blue-600"
            }`}
          >
            カレンダー管理
          </Link>
          <Link
            to="/admin/users"
            className={`${
              location.pathname.includes("users")
                ? "text-blue-600 font-semibold border-b-2 border-blue-600"
                : "text-gray-600 hover:text-blue-600"
            }`}
          >
            ユーザー管理
          </Link>
          <button
            onClick={logout}
            className="text-red-500 hover:underline ml-4"
          >
            ログアウト
          </button>
        </nav>
      </header>

      {/* ページ本体（切り替え部分） */}
      <main className="p-4 max-w-5xl mx-auto">
        <Outlet />
      </main>
    </div>
  );
}