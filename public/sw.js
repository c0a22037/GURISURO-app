// service-worker.js (PWA)
// バージョンを更新するたびに新しいキャッシュが作成される
const CACHE_NAME = 'gurisuro-app-v3';
const FORCE_UPDATE = false; // デバッグ用: trueにすると即座に更新を強制

// インストール時にキャッシュ
self.addEventListener('install', (event) => {
  console.log('SW: Installing new version:', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // 空のキャッシュで開始（プリキャッシュしない）
      console.log('SW: Cache opened:', CACHE_NAME);
      return Promise.resolve();
    })
  );
  // すぐに新しいService Workerをアクティブにする
  self.skipWaiting();
});

// アクティベート時に古いキャッシュを削除
self.addEventListener('activate', (event) => {
  console.log('SW: Activating:', CACHE_NAME);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('SW: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // すべてのクライアントにコントロールを要求（すぐに適用）
      console.log('SW: Claiming clients');
      return self.clients.claim().then(() => {
        // すべてのクライアントに更新通知を送信
        return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
          clients.forEach((client) => {
            client.postMessage({
              type: 'SW_UPDATED',
              cacheName: CACHE_NAME
            });
          });
        });
      });
    })
  );
});

// フェッチ時にネットワーク優先（最新版を取得）、フォールバックでキャッシュ
self.addEventListener('fetch', (event) => {
  // APIリクエストは常にネットワーク優先（キャッシュしない）
  if (event.request.url.includes('/api')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // オフライン時はエラー
        return new Response(JSON.stringify({ error: 'オフラインです' }), {
          headers: { 'Content-Type': 'application/json' },
        });
      })
    );
    return;
  }

  // HTMLファイルはネットワーク優先、フォールバックでキャッシュ
  if (event.request.destination === 'document' || event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then((response) => {
        // ネットワークから取得できた場合、キャッシュを更新
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      }).catch(() => {
        // ネットワークエラー時はキャッシュから取得
        return caches.match(event.request).then((cachedResponse) => {
          return cachedResponse || caches.match('/index.html');
        });
      })
    );
    return;
  }

  // その他のリソース（JS、CSS、画像など）はネットワーク優先、フォールバックでキャッシュ
  event.respondWith(
    fetch(event.request).then((response) => {
      // ネットワークから取得できた場合、キャッシュを更新
      if (response && response.status === 200) {
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
      }
      return response;
    }).catch(() => {
      // ネットワークエラー時はキャッシュから取得
      return caches.match(event.request);
    })
  );
});
