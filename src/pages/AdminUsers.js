// src/pages/AdminUsers.js
import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Toast from "../components/Toast.js";
import ConfirmDialog from "../components/ConfirmDialog.js";
import { useToast } from "../hooks/useToast.js";
import { useConfirmDialog } from "../hooks/useConfirmDialog.js";

// 500エラー時のHTMLにも耐える軽量fetch（ネットワークエラー検知付き）
async function apiFetch(url, options = {}, onNetworkError) {
  try {
    const res = await fetch(url, { credentials: "include", ...options });
    const text = await res.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch {}
    return { ok: res.ok, status: res.status, data, text };
  } catch (error) {
    // ネットワークエラーの場合
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      if (onNetworkError) {
        onNetworkError();
      }
      throw new Error('ネットワークエラーが発生しました。インターネット接続を確認してください。');
    }
    throw error;
  }
}

function FamBadge({ value }) {
  const map = {
    familiar: { label: "詳しい", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    unfamiliar: { label: "詳しくない", cls: "bg-orange-100 text-orange-700 border-orange-200" },
    unknown: { label: "不明", cls: "bg-gray-100 text-gray-700 border-gray-200" },
  };
  const v = map[value] || map.unknown;
  return (
    <span className={`px-2 py-0.5 text-xs border rounded ${v.cls}`}>
      {v.label}
    </span>
  );
}

export default function AdminUsers() {
  const nav = useNavigate();
  const { toast, showToast, hideToast } = useToast();
  const { dialog, showConfirm, hideConfirm } = useConfirmDialog();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState([]);

  // 表示強化用UI状態
  const [q, setQ] = useState("");                 // 検索
  const [famFilter, setFamFilter] = useState("all"); // familiar/unfamiliar/unknown/all
  const [showAll, setShowAll] = useState(false); // 全員表示フラグ

  // （任意）追加・削除が元々ある想定
  const [newName, setNewName] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newRole, setNewRole] = useState("user");
  const [newFam, setNewFam] = useState("unknown");

  // スクロール位置保持用
  const listContainerRef = useRef(null);
  const scrollPositionRef = useRef(0);

  const refresh = async () => {
    // スクロール位置を保存
    if (listContainerRef.current) {
      scrollPositionRef.current = listContainerRef.current.scrollTop;
    }
    setLoading(true);
    try {
      const r = await apiFetch("/api/users", {}, handleNetworkError);
      setList(Array.isArray(r.data) ? r.data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      // スクロール位置を復元
      requestAnimationFrame(() => {
        if (listContainerRef.current) {
          listContainerRef.current.scrollTop = scrollPositionRef.current;
        }
      });
    }
  };

  // 絞り込み＆検索
  const filtered = useMemo(() => {
    const needle = q.trim();
    return (list || []).filter((u) => {
      const fam = (u.familiar || u.familiarity || "unknown");
      if (famFilter !== "all" && fam !== famFilter) return false;
      if (!needle) return true;
      return String(u.username || "").includes(needle);
    });
  }, [list, q, famFilter]);

  // 件数サマリ
  const counts = useMemo(() => {
    const c = { total: list.length, familiar: 0, unfamiliar: 0, unknown: 0 };
    for (const u of list) {
      const fam = u.familiar || u.familiarity || "unknown";
      if (fam === "familiar") c.familiar++;
      else if (fam === "unfamiliar") c.unfamiliar++;
      else c.unknown++;
    }
    return c;
  }, [list]);

  // 追加（すでに存在するならそのUIのまま利用）
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newName || !newPw) {
      showToast("ユーザー名とパスワードを入力してください", 'warning');
      return;
    }
    try {
      const r = await apiFetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newName,
          password: newPw,
          role: newRole,
          familiarity: newFam,
        }),
      }, handleNetworkError);
      if (!r.ok) throw new Error(r.data?.error || `HTTP ${r.status}`);
      setNewName(""); setNewPw("");
      setNewRole("user"); setNewFam("unknown");
      showToast("ユーザーを追加しました", 'success');
      await refresh();
    } catch (e) {
      showToast(`追加に失敗しました: ${e.message}`, 'error');
    }
  };

  // 削除（既存のまま）
  const handleDelete = async (id) => {
    const confirmed = await showConfirm({
      title: 'ユーザーの削除',
      message: 'このユーザーを削除しますか？',
      confirmText: '削除する',
      cancelText: 'キャンセル',
      type: 'danger',
    });
    if (!confirmed) return;
    try {
      const r = await apiFetch(`/api/users?id=${encodeURIComponent(id)}`, { method: "DELETE" }, handleNetworkError);
      if (!r.ok) throw new Error(r.data?.error || `HTTP ${r.status}`);
      showToast("ユーザーを削除しました", 'success');
      await refresh();
    } catch (e) {
      showToast(`削除に失敗しました: ${e.message}`, 'error');
    }
  };

  // 通知を取得
  const [notifications, setNotifications] = useState([]);
  // 履歴モーダル
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyKind, setHistoryKind] = useState("all"); // all/driver/attendant
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");
  const [historyTarget, setHistoryTarget] = useState("");

  // ネットワーク状態の監視
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      showToast('インターネット接続が復旧しました', 'success');
    };
    const handleOffline = () => {
      setIsOnline(false);
      showToast('インターネット接続が切断されました', 'warning', 5000);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [showToast]);

  // ネットワークエラー時のハンドラー
  const handleNetworkError = useCallback(() => {
    if (!isOnline) {
      showToast('オフラインです。インターネット接続を確認してください。', 'error', 5000);
    }
  }, [isOnline, showToast]);

  const openHistory = async (username) => {
    try {
      const r = await apiFetch(`/api/applications?username=${encodeURIComponent(username)}`, {}, handleNetworkError);
      setHistory(Array.isArray(r.data) ? r.data : []);
      setHistoryOpen(true);
    } catch (e) {
      showToast("履歴の取得に失敗しました", 'error');
    }
  };
  
  useEffect(() => {
    // ログアウト直後の場合はログインページへ
    const justLoggedOut = sessionStorage.getItem("justLoggedOut");
    if (justLoggedOut === "true") {
      sessionStorage.removeItem("justLoggedOut");
      nav("/admin");
      return;
    }
    
    const role = localStorage.getItem("userRole");
    if (role !== "admin") {
      showToast("管理者のみアクセス可能です。", 'error');
      nav("/admin");
      return;
    }
    refresh();
    // 通知を取得
    (async () => {
      try {
        const notifs = await apiFetch("/api?path=notifications", {}, handleNetworkError);
        if (notifs.ok && Array.isArray(notifs.data)) {
          setNotifications(notifs.data);
        }
      } catch {}
    })();
  }, [nav]);

  // 通知の未読数
  const unreadCount = useMemo(() => {
    return notifications.filter(n => !n.read_at).length;
  }, [notifications]);

  if (loading) return <div className="p-6">読み込み中…</div>;

  return (
    <>
    <div 
      className="min-h-screen p-4 sm:p-6"
      style={{ 
        backgroundColor: '#f0fdf4',
        paddingBottom: 'calc(96px + env(safe-area-inset-bottom))',
        marginBottom: 0
      }}
    >
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow p-0 sm:p-0">
        {/* ヘッダー（検索を固定） */}
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold">👥 ユーザー管理</h1>
          <div className="flex gap-3">
            <button
              onClick={async () => {
                // ログアウトフラグを設定（自動ログインを防ぐ）
                sessionStorage.setItem("justLoggedOut", "true");
                
                // ログアウトAPIを呼び出してクッキーを削除
                try {
                  await apiFetch("/api?path=logout", { method: "POST" }, handleNetworkError);
                } catch (e) {
                  console.error("Logout API error:", e);
                }
                
                localStorage.clear();
                
                // クッキーが削除されるまで少し待ってからリロード
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // ログインページへ移動
                window.location.href = "/admin";
              }}
              className="text-gray-600 underline"
            >
              ログアウト
            </button>
          </div>
        </div>

        {/* サマリ＆フィルタ */}
        <div className="px-4 pt-3 pb-4 border-b">
          <div className="flex items-end gap-2">
            <input
              className="flex-1 border rounded p-2 text-sm"
              placeholder="名前で検索"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select
              className="border rounded p-2 text-sm"
              value={famFilter}
              onChange={(e) => setFamFilter(e.target.value)}
            >
              <option value="all">すべて</option>
              <option value="familiar">詳しい</option>
              <option value="unfamiliar">詳しくない</option>
              <option value="unknown">不明</option>
            </select>
            <button
              onClick={() => {
                if (q.trim() !== "") {
                  // 検索中の場合、検索をクリアして全員表示に切り替え
                  setQ("");
                  setShowAll(true);
                } else {
                  // 検索欄が空の場合、全員表示のオン/オフを切り替え
                  setShowAll(!showAll);
                }
              }}
              className={`px-4 py-2 rounded text-sm font-medium ${
                showAll && q.trim() === ""
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              {q.trim() !== "" ? "検索中" : showAll ? "全員表示中" : "全員表示"}
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs text-gray-600 mt-2">
            <div className="border rounded p-2">合計 <span className="font-semibold">{counts.total}</span></div>
            <div className="border rounded p-2">詳しい <span className="font-semibold text-emerald-700">{counts.familiar}</span></div>
            <div className="border rounded p-2">詳しくない <span className="font-semibold text-orange-700">{counts.unfamiliar}</span></div>
          </div>
        </div>

        {/* 一覧 */}
        {(showAll || q.trim() !== "") ? (
          filtered.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">該当するユーザーがいません。</p>
          ) : (
            <div 
              ref={listContainerRef}
              className="overflow-y-auto"
              style={{ maxHeight: 'calc(100vh - 400px)' }}
            >
              <ul className="space-y-3 p-4">
              {filtered.map((u) => (
                <li key={u.id} className="border rounded-lg p-3 bg-white shadow-sm">
                  <div className="grid grid-cols-1 gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-base truncate">{u.username}</div>
                      <div className="text-xs text-gray-500">役割: {u.role || "user"}</div>
                      {/* 表示名の編集 */}
                      <div className="mt-2 flex gap-2 items-center">
                        <input
                          className="border rounded p-2 text-sm w-full"
                          defaultValue={u.display_name || ""}
                          placeholder="表示名"
                          onBlur={async (e) => {
                            try {
                              const r = await apiFetch("/api/users", {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ username: u.username, display_name: e.target.value || null }),
                              }, handleNetworkError);
                              if (!r.ok) throw new Error(r.data?.error || `HTTP ${r.status}`);
                              showToast("表示名を更新しました", 'success');
                            } catch (err) {
                              showToast(`更新に失敗しました: ${err.message}`, 'error');
                            }
                          }}
                        />
                        {/* ヒントを省略してコンパクトに */}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {/* 役割変更 */}
                      <select
                        className="border rounded p-2 text-sm"
                        defaultValue={u.role || "user"}
                        onChange={async (e) => {
                          // スクロール位置を保存
                          if (listContainerRef.current) {
                            scrollPositionRef.current = listContainerRef.current.scrollTop;
                          }
                          try {
                            const r = await apiFetch("/api/users", {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ username: u.username, role: e.target.value }),
                            }, handleNetworkError);
                            if (!r.ok) throw new Error(r.data?.error || `HTTP ${r.status}`);
                            showToast("役割を更新しました", 'success');
                            await refresh();
                          } catch (err) {
                            showToast(`更新に失敗しました: ${err.message}`, 'error');
                          }
                        }}
                      >
                        <option value="user">一般</option>
                        <option value="admin">管理者</option>
                      </select>

                      {/* 応募適性（既存） */}
                      <div className="flex items-center gap-2">
                        <select
                          className="border rounded p-2 text-sm"
                          value={u.familiar || u.familiarity || "unknown"}
                          onChange={async (e) => {
                            // スクロール位置を保存
                            if (listContainerRef.current) {
                              scrollPositionRef.current = listContainerRef.current.scrollTop;
                            }
                            try {
                              const r = await apiFetch("/api/users", {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ username: u.username, familiar: e.target.value === "unknown" ? null : e.target.value }),
                              }, handleNetworkError);
                              if (!r.ok) throw new Error(r.data?.error || `HTTP ${r.status}`);
                              showToast("応募適性を更新しました", 'success');
                              await refresh();
                            } catch (err) {
                              showToast(`更新に失敗しました: ${err.message}`, 'error');
                            }
                          }}
                        >
                          <option value="unknown">不明</option>
                          <option value="familiar">詳しい</option>
                          <option value="unfamiliar">詳しくない</option>
                        </select>
                        <FamBadge value={u.familiar || u.familiarity || "unknown"} />
                      </div>

                      {/* 便利アクション */}
                      <div className="flex flex-wrap gap-2 col-span-2">
                        <button
                          className="px-3 py-1.5 rounded bg-indigo-600 text-white text-sm"
                          onClick={async () => {
                            // 履歴モーダルを開く（下で定義）
                            setHistoryTarget(u.username);
                            await openHistory(u.username);
                          }}
                        >
                          履歴
                        </button>
                        <button
                          className="px-3 py-1.5 rounded bg-amber-500 text-white text-sm"
                          onClick={async () => {
                            // 簡易的にpromptを利用（今後、専用の入力ダイアログに置き換え可能）
                            const newPw = prompt("一時パスワードを入力");
                            if (!newPw) return;
                            try {
                              const r = await apiFetch("/api/users", {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ username: u.username, password: newPw }),
                              }, handleNetworkError);
                              if (!r.ok) throw new Error(r.data?.error || `HTTP ${r.status}`);
                              showToast("一時パスワードを設定しました", 'success');
                            } catch (err) {
                              showToast(`設定に失敗しました: ${err.message}`, 'error');
                            }
                          }}
                        >
                          一時PW
                        </button>
                        <button
                          className="px-3 py-1.5 rounded bg-gray-200 text-gray-800 text-sm"
                          onClick={async () => {
                            const confirmed = await showConfirm({
                              title: '強制ログアウト',
                              message: 'このユーザーを強制ログアウトしますか？',
                              confirmText: 'ログアウトする',
                              cancelText: 'キャンセル',
                              type: 'warning',
                            });
                            if (!confirmed) return;
                            try {
                              const r = await apiFetch(`/api?path=logout_user&username=${encodeURIComponent(u.username)}`, { method: "POST" }, handleNetworkError);
                              if (!r.ok) throw new Error(r.data?.error || `HTTP ${r.status}`);
                              showToast("強制ログアウトしました", 'success');
                            } catch (err) {
                              showToast("対応していない環境です（管理者にAPI追加が必要）", 'error');
                            }
                          }}
                        >
                          強制ログアウト
                        </button>
                        <button
                          className="px-3 py-1.5 rounded bg-red-600 text-white text-sm"
                          onClick={() => handleDelete(u.id)}
                        >
                          削除
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
              </ul>
            </div>
          )
        ) : (
          <div className="p-4 text-center">
            <p className="text-sm text-gray-500 mb-3">「全員表示」ボタンをクリックしてユーザー一覧を表示します。</p>
          </div>
        )}

        {/* （任意）追加フォーム：既存がある場合はそのUIに合わせてOK */}
        <form onSubmit={handleAdd} className="mt-6 bg-gray-50 border rounded p-4">
          <h2 className="font-semibold mb-2 text-sm">新規ユーザー登録</h2>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <input
              className="border rounded p-2 text-sm"
              placeholder="ユーザー名"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <input
              className="border rounded p-2 text-sm"
              type="password"
              placeholder="パスワード"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
            />
            <select
              className="border rounded p-2 text-sm"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
            >
              <option value="user">一般</option>
              <option value="admin">管理者</option>
            </select>
            <select
              className="border rounded p-2 text-sm"
              value={newFam}
              onChange={(e) => setNewFam(e.target.value)}
            >
              <option value="unknown">不明</option>
              <option value="familiar">詳しい</option>
              <option value="unfamiliar">詳しくない</option>
            </select>
          </div>
          <div className="mt-3">
            <button className="px-4 py-2 rounded bg-blue-600 text-white text-sm">
              登録する
            </button>
          </div>
        </form>
      </div>
    </div>
    
    {/* 固定タブバー */}
    {/* 履歴モーダル */}
    {historyOpen && (
      <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50" style={{ paddingBottom: '80px' }}>
        <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-4 shadow-lg max-h-[calc(100vh-120px)] overflow-y-auto">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold">{historyTarget} の応募履歴</h3>
            <button onClick={() => setHistoryOpen(false)} className="text-gray-500">✕</button>
          </div>
          <div className="flex flex-wrap gap-2 mb-3 text-sm">
            <select className="border rounded p-1" value={historyKind} onChange={(e)=>setHistoryKind(e.target.value)}>
              <option value="all">すべて</option>
              <option value="driver">運転手</option>
              <option value="attendant">添乗員</option>
            </select>
            <input type="date" className="border rounded p-1" value={historyFrom} onChange={(e)=>setHistoryFrom(e.target.value)} />
            <input type="date" className="border rounded p-1" value={historyTo} onChange={(e)=>setHistoryTo(e.target.value)} />
          </div>
          <ul className="space-y-2 text-sm">
            {history
              .filter(h => historyKind === 'all' || h.kind === historyKind)
              .filter(h => !historyFrom || (h.date && h.date >= historyFrom))
              .filter(h => !historyTo || (h.date && h.date <= historyTo))
              .map((h, idx) => (
                <li key={idx} className="border rounded p-2">
                  <div className="flex justify-between"><span>{h.date || h.created_at?.slice(0,10) || '-'}</span><span className="text-gray-500">{h.kind}</span></div>
                  <div className="text-gray-600">{h.label || `イベントID:${h.event_id}`}</div>
                  {h.status && <div className="text-xs text-gray-500">{h.status}</div>}
                </li>
            ))}
            {history.length === 0 && (
              <li className="text-gray-500">履歴がありません。</li>
            )}
          </ul>
        </div>
      </div>
    )}
    <div 
      id="admin-users-tab-bar"
      style={{ 
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        width: '100%',
        minHeight: '72px',
        backgroundColor: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        borderTop: '1px solid #e5e7eb',
        boxShadow: '0 -6px 12px -6px rgba(0,0,0,0.12)',
        WebkitBoxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.1), 0 -2px 4px -1px rgba(0, 0, 0, 0.06)',
        zIndex: 99999,
        display: 'flex',
        WebkitDisplay: 'flex',
        alignItems: 'center',
        WebkitAlignItems: 'center',
        visibility: 'visible',
        opacity: 1,
        WebkitTransform: 'translateZ(0)',
        transform: 'translateZ(0)',
        willChange: 'transform',
        WebkitBackfaceVisibility: 'hidden',
        backfaceVisibility: 'hidden',
        paddingBottom: 'env(safe-area-inset-bottom)'
      }}
    >
      <div style={{ 
        maxWidth: '896px', 
        margin: '0 auto', 
        display: 'grid', 
        WebkitDisplay: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)', 
        WebkitGridTemplateColumns: 'repeat(4, 1fr)',
        width: '100%', 
        height: '100%', 
        minHeight: '72px' 
      }}>
        <button
          onClick={() => nav("/admin/dashboard?tab=calendar")}
          style={{
            display: 'flex',
            WebkitDisplay: 'flex',
            flexDirection: 'column',
            WebkitFlexDirection: 'column',
            alignItems: 'center',
            WebkitAlignItems: 'center',
            justifyContent: 'center',
            WebkitJustifyContent: 'center',
            marginBottom: '4px',
            padding: '12px 16px',
            backgroundColor: 'transparent',
            color: '#4b5563',
            fontWeight: '400',
            border: 'none',
            cursor: 'pointer',
            WebkitTransition: 'all 0.2s',
            transition: 'all 0.2s'
          }}
        >
          <svg style={{ width: '24px', height: '24px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span style={{ fontSize: '12px', fontWeight: '500' }}>カレンダー</span>
        </button>
        <button
          onClick={() => nav("/admin/dashboard?tab=apply")}
          style={{
            display: 'flex',
            WebkitDisplay: 'flex',
            flexDirection: 'column',
            WebkitFlexDirection: 'column',
            alignItems: 'center',
            WebkitAlignItems: 'center',
            justifyContent: 'center',
            WebkitJustifyContent: 'center',
            marginBottom: '4px',
            padding: '12px 16px',
            backgroundColor: 'transparent',
            color: '#4b5563',
            fontWeight: '400',
            border: 'none',
            cursor: 'pointer',
            WebkitTransition: 'all 0.2s',
            transition: 'all 0.2s'
          }}
        >
          <svg style={{ width: '24px', height: '24px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-6h6v6M9 21h6a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span style={{ fontSize: '12px', fontWeight: '500' }}>イベント一覧</span>
        </button>
        <button
          onClick={() => nav("/admin/dashboard?tab=notifications")}
          style={{
            display: 'flex',
            WebkitDisplay: 'flex',
            flexDirection: 'column',
            WebkitFlexDirection: 'column',
            alignItems: 'center',
            WebkitAlignItems: 'center',
            justifyContent: 'center',
            WebkitJustifyContent: 'center',
            marginBottom: '4px',
            padding: '12px 16px',
            backgroundColor: 'transparent',
            color: '#4b5563',
            fontWeight: '400',
            border: 'none',
            cursor: 'pointer',
            WebkitTransition: 'all 0.2s',
            transition: 'all 0.2s',
            position: 'relative'
          }}
        >
          <svg style={{ width: '24px', height: '24px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span style={{ fontSize: '12px', fontWeight: '500' }}>通知</span>
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute',
              top: '4px',
              right: '8px',
              backgroundColor: '#ef4444',
              color: '#ffffff',
              fontSize: '10px',
              borderRadius: '10px',
              width: '20px',
              height: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '600'
            }}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
        <button
          onClick={() => nav("/admin/users")}
          style={{
            display: 'flex',
            WebkitDisplay: 'flex',
            flexDirection: 'column',
            WebkitFlexDirection: 'column',
            alignItems: 'center',
            WebkitAlignItems: 'center',
            justifyContent: 'center',
            WebkitJustifyContent: 'center',
            marginBottom: '4px',
            padding: '12px 16px',
            backgroundColor: '#dbeafe',
            color: '#2563eb',
            fontWeight: '600',
            border: 'none',
            cursor: 'pointer',
            WebkitTransition: 'all 0.2s',
            transition: 'all 0.2s'
          }}
        >
          <svg style={{ width: '24px', height: '24px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <span style={{ fontSize: '12px', fontWeight: '500' }}>ユーザー管理</span>
        </button>
      </div>
    </div>
    
    {/* トースト通知 */}
    <Toast
      message={toast.message}
      type={toast.type}
      visible={toast.visible}
      onClose={hideToast}
      duration={toast.duration}
    />
    
    {/* 確認ダイアログ */}
    <ConfirmDialog
      visible={dialog.visible}
      title={dialog.title}
      message={dialog.message}
      confirmText={dialog.confirmText}
      cancelText={dialog.cancelText}
      type={dialog.type}
      onConfirm={dialog.onConfirm}
      onCancel={dialog.onCancel}
    />
    </>
  );
}