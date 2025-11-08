// src/hooks/useConfirmDialog.js
import { useState, useCallback } from 'react';

/**
 * 確認ダイアログを管理するカスタムフック
 * @returns {Object} { dialog, showConfirm, hideConfirm }
 */
export function useConfirmDialog() {
  const [dialog, setDialog] = useState({
    visible: false,
    title: '確認',
    message: '',
    confirmText: '確認',
    cancelText: 'キャンセル',
    type: 'info',
    onConfirm: null,
    onCancel: null,
  });

  const showConfirm = useCallback(
    ({
      title = '確認',
      message,
      confirmText = '確認',
      cancelText = 'キャンセル',
      type = 'info',
      onConfirm,
      onCancel,
    }) => {
      return new Promise((resolve) => {
        setDialog({
          visible: true,
          title,
          message,
          confirmText,
          cancelText,
          type,
          onConfirm: () => {
            hideConfirm();
            if (onConfirm) onConfirm();
            resolve(true);
          },
          onCancel: () => {
            hideConfirm();
            if (onCancel) onCancel();
            resolve(false);
          },
        });
      });
    },
    []
  );

  const hideConfirm = useCallback(() => {
    setDialog((prev) => ({ ...prev, visible: false }));
  }, []);

  return {
    dialog,
    showConfirm,
    hideConfirm,
  };
}

