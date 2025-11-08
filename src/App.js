// src/App.js
import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import UserLogin from "./pages/UserLogin.js";
import AdminLogin from "./pages/AdminLogin.js";
import AdminDashboard from "./pages/AdminDashboard.js";
import AdminUsers from "./pages/AdminUsers.js";
import MainApp from "./pages/MainApp.js";

// クッキーからセッションを取得する関数
async function checkSession() {
  try {
    const res = await fetch("/api?path=me", { credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      if (data.username) {
        localStorage.setItem("userRole", data.role || "user");
        localStorage.setItem("userName", data.username);
        return data;
      }
    }
  } catch (err) {
    console.log("Session check failed:", err);
  }
  return null;
}

// 共通: ログイン必須
const ProtectedRoute = ({ children }) => {
  const [isChecking, setIsChecking] = useState(true);
  const localRole = localStorage.getItem("userRole");
  
  useEffect(() => {
    // ログアウト直後の場合は自動ログインをスキップ
    const justLoggedOut = sessionStorage.getItem("justLoggedOut");
    if (justLoggedOut === "true") {
      sessionStorage.removeItem("justLoggedOut");
      setIsChecking(false);
      return; // 自動ログインしない
    }
    
    // localStorageにroleがない場合、クッキーから復元を試みる
    if (!localRole) {
      checkSession().finally(() => {
        setIsChecking(false);
      });
    } else {
      setIsChecking(false);
    }
  }, [localRole]);
  
  if (isChecking) {
    return <div>読み込み中...</div>; // ロード中表示
  }
  
  // ログアウト直後の場合はログインページへ
  const justLoggedOut = sessionStorage.getItem("justLoggedOut");
  if (justLoggedOut === "true") {
    return <Navigate to="/" replace />;
  }
  
  const role = localStorage.getItem("userRole");
  if (!role) return <Navigate to="/" replace />;
  return children;
};

// 管理者のみ
const AdminOnlyRoute = ({ children }) => {
  // ログアウト直後の場合はログインページへ
  const justLoggedOut = sessionStorage.getItem("justLoggedOut");
  if (justLoggedOut === "true") {
    return <Navigate to="/admin" replace />;
  }
  
  const role = localStorage.getItem("userRole");
  if (!role || role !== "admin") {
    return <Navigate to="/admin" replace />;
  }
  return children;
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 一般ユーザー */}
        <Route path="/" element={<UserLogin />} />
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <MainApp />
            </ProtectedRoute>
          }
        />

        {/* 管理者ログイン */}
        <Route path="/admin" element={<AdminLogin />} />

        {/* 管理者用画面 */}
        <Route
          path="/admin/dashboard"
          element={
            <AdminOnlyRoute>
              <AdminDashboard />
            </AdminOnlyRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <AdminOnlyRoute>
              <AdminUsers />
            </AdminOnlyRoute>
          }
        />

        {/* フォールバック */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}