// src/components/Toast.js
import React, { useEffect } from 'react';

/**
 * トースト通知コンポーネント
 * @param {Object} props
 * @param {string} props.message - 表示メッセージ
 * @param {string} props.type - 種類 ('success', 'error', 'warning', 'info')
 * @param {boolean} props.visible - 表示/非表示
 * @param {Function} props.onClose - 閉じるコールバック
 * @param {number} props.duration - 自動で閉じるまでの時間（ミリ秒、0で自動で閉じない）
 */
export default function Toast({ message, type = 'info', visible, onClose, duration = 3000 }) {
  useEffect(() => {
    if (visible && duration > 0) {
      const timer = setTimeout(() => {
        onClose?.();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [visible, duration, onClose]);

  if (!visible || !message) return null;

  const bgColors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-yellow-500',
    info: 'bg-blue-500',
  };

  const icons = {
    success: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
      </svg>
    ),
    error: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    warning: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    info: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  return (
    <div
      className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-[100000] ${
        visible ? 'animate-slide-down' : 'opacity-0'
      }`}
      style={{
        animation: visible ? 'slideDown 0.3s ease-out' : undefined,
        maxWidth: 'calc(100vw - 2rem)',
        width: 'auto',
        minWidth: '280px',
      }}
    >
      <div
        className={`${bgColors[type]} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 ${
          visible ? 'opacity-100' : 'opacity-0'
        } transition-opacity duration-300`}
      >
        <div className="flex-shrink-0">{icons[type]}</div>
        <div className="flex-1 text-sm font-medium">{message}</div>
        <button
          onClick={onClose}
          className="flex-shrink-0 ml-2 hover:bg-white/20 rounded p-1 transition-colors"
          aria-label="閉じる"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <style>{`
        @keyframes slideDown {
          from {
            transform: translate(-50%, -100%);
            opacity: 0;
          }
          to {
            transform: translate(-50%, 0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

