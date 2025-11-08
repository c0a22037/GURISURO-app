// src/components/PageContainer.js
import React from "react";

/**
 * スマホ用の安全余白（ノッチ対応）・横幅制限・内側パディングをまとめた共通ラッパ
 */
export default function PageContainer({ children, maxWidth = 960 }) {
  return (
    <div className="min-h-screen bg-gray-100 px-3 py-3 sm:px-6 sm:py-6"
         style={{
           paddingTop: "env(safe-area-inset-top)",
           paddingRight: "env(safe-area-inset-right)",
           paddingBottom: "env(safe-area-inset-bottom)",
           paddingLeft: "env(safe-area-inset-left)",
         }}>
      <div
        className="mx-auto w-full bg-white rounded-xl shadow"
        style={{ maxWidth }}
      >
        <div className="p-3 sm:p-6">{children}</div>
      </div>
    </div>
  );
} 