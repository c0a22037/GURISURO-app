// src/components/ConfirmDialog.js
import React from 'react';

/**
 * 確認ダイアログコンポーネント
 * @param {Object} props
 * @param {boolean} props.visible - 表示/非表示
 * @param {string} props.title - タイトル
 * @param {string} props.message - メッセージ
 * @param {string} props.confirmText - 確認ボタンのテキスト（デフォルト: "確認"）
 * @param {string} props.cancelText - キャンセルボタンのテキスト（デフォルト: "キャンセル"）
 * @param {string} props.type - 種類 ('danger', 'warning', 'info')
 * @param {Function} props.onConfirm - 確認時のコールバック
 * @param {Function} props.onCancel - キャンセル時のコールバック
 */
export default function ConfirmDialog({
  visible,
  title = '確認',
  message,
  confirmText = '確認',
  cancelText = 'キャンセル',
  type = 'info',
  onConfirm,
  onCancel,
}) {
  if (!visible) return null;

  const confirmButtonColors = {
    danger: 'bg-red-600 hover:bg-red-700',
    warning: 'bg-yellow-600 hover:bg-yellow-700',
    info: 'bg-blue-600 hover:bg-blue-700',
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100000]"
      style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onCancel?.();
        }
      }}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 animate-scale-in">
        <div className="p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
          <p className="text-sm text-gray-600 mb-6 whitespace-pre-wrap">{message}</p>
          <div className="flex gap-3 justify-end">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded bg-gray-200 text-gray-800 text-sm font-medium hover:bg-gray-300 transition-colors"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className={`px-4 py-2 rounded text-white text-sm font-medium transition-colors ${confirmButtonColors[type]}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes scale-in {
          from {
            transform: scale(0.9);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        .animate-scale-in {
          animation: scale-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}

