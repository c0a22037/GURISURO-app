import React from 'react';
import ReactDOM from 'react-dom/client'; // React 18からcreateRootを使用
import './index.css'; // Tailwind CSSを適用するためのCSSファイルをインポート
import App from './App.js'; // 作成したAppコンポーネントをインポート
const IS_DEV = process.env.NODE_ENV !== 'production';

// React 18の新しいAPIであるcreateRootを使用して、アプリケーションをレンダリング
const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('Root element not found!');
} else {
  const root = ReactDOM.createRoot(rootElement);
  try {
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    if (IS_DEV) console.log('App rendered successfully');
  } catch (error) {
    console.error('Error rendering app:', error);
    rootElement.innerHTML = `
      <div style="padding: 20px; color: red;">
        <h1>エラーが発生しました</h1>
        <pre>${error.toString()}</pre>
        <p>ブラウザのコンソールを確認してください。</p>
      </div>
    `;
  }
}

// Service Worker の登録（PWA）- 開発中は完全に無効化
// 本番環境のみで有効化（アプリのレンダリングを妨げない）
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { 
        updateViaCache: 'none',
        scope: '/' 
      })
      .then((registration) => {
        // 静かな本番運用のためログは出さない
        
        // 定期的に更新をチェック（60秒ごと）
        setInterval(() => {
          registration.update();
        }, 60000);
        
        // Service Workerからのメッセージを受信
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data && event.data.type === 'SW_UPDATED') {
            // 少し待ってからリロード（ユーザーの操作を妨げないように）
            setTimeout(() => {
              window.location.reload(true);
            }, 500);
          }
        });
        
        // バージョンアップデートを確認
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  // 新しいService Workerが利用可能になったら、ページをリロード
                  // 少し待ってからリロード
                  setTimeout(() => {
                    window.location.reload(true);
                  }, 500);
                } else {
                  // 初回インストール
                  // no-op
                }
              }
            });
          }
        });
      })
      .catch((error) => {
        if (IS_DEV) console.log('SW registration failed:', error);
      });
  });
}
