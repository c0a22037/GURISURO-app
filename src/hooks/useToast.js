// src/hooks/useToast.js
import { useState, useCallback } from 'react';

/**
 * トースト通知を管理するカスタムフック
 * @returns {Object} { toast, showToast, hideToast }
 */
export function useToast() {
  const [toast, setToast] = useState({
    visible: false,
    message: '',
    type: 'info',
  });

  const showToast = useCallback((message, type = 'info', duration = 3000) => {
    setToast({
      visible: true,
      message,
      type,
      duration,
    });
  }, []);

  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

  return {
    toast,
    showToast,
    hideToast,
  };
}

