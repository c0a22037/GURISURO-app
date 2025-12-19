// src/pages/MainApp.js
"use client"

// src/pages/MainApp.js
import { useEffect, useMemo, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import Calendar from "../components/Calendar.js"
import Toast from "../components/Toast.js"
import ConfirmDialog from "../components/ConfirmDialog.js"
import { useToast } from "../hooks/useToast.js"
import { useConfirmDialog } from "../hooks/useConfirmDialog.js"
import { toLocalYMD, parseYMD } from "../lib/date.js"

// JSON/text どちらも耐える fetch（ネットワークエラー検知付き）
async function apiFetch(url, options = {}, onNetworkError) {
  try {
    const res = await fetch(url, {
      credentials: "include",
      cache: "no-store",
      headers: { "Cache-Control": "no-cache", ...(options.headers || {}) },
      ...options,
    })
    const text = await res.text()
    let data = {}
    try {
      data = text ? JSON.parse(text) : {}
    } catch {}
    return { ok: res.ok, status: res.status, data, text }
  } catch (error) {
    // ネットワークエラーの場合
    if (error.name === "TypeError" && error.message.includes("fetch")) {
      if (onNetworkError) {
        onNetworkError()
      }
      throw new Error("ネットワークエラーが発生しました。インターネット接続を確認してください。")
    }
    throw error
  }
}

export default function MainApp() {
  const nav = useNavigate()
  const { toast, showToast, hideToast } = useToast()
  const { dialog, showConfirm, hideConfirm } = useConfirmDialog()
  const [userName, setUserName] = useState("")
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const userRolePref = localStorage.getItem("userRolePref") || "両方" // 任意（運転手/添乗員/両方）

  // ページロード時にクッキーからセッションを復元
  useEffect(() => {
    // ログアウト直後の場合は自動ログインをスキップ
    const justLoggedOut = sessionStorage.getItem("justLoggedOut")
    if (justLoggedOut === "true") {
      sessionStorage.removeItem("justLoggedOut")
      nav("/")
      return // 自動ログインしない
    }
    ;(async () => {
      // localStorageから取得を試みる
      const storedName = localStorage.getItem("userName")
      if (storedName) {
        setUserName(storedName)
        return
      }

      // localStorageにない場合、クッキーから復元
      try {
        const { ok, data } = await apiFetch("/api?path=me", {}, handleNetworkError)
        if (ok && data.username) {
          localStorage.setItem("userRole", data.role || "user")
          localStorage.setItem("userName", data.username)
          setUserName(data.username)
        } else {
          // セッションがない場合、ログイン画面へ
          nav("/")
        }
      } catch (err) {
        console.log("Session restore failed:", err)
        nav("/")
      }
    })()
  }, [nav])

  const [events, setEvents] = useState([])
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [applying, setApplying] = useState(false)
  const [activeTab, setActiveTab] = useState("calendar") // "calendar" | "apply" | "notifications" | "mypage" | "participation"
  const [myApps, setMyApps] = useState([]) // 自分の応募
  const [notifications, setNotifications] = useState([]) // 通知一覧
  const MAX_NOTIFS = 30 // 表示・保持の上限（古いものは自動的に非表示）
  const [applicationHistory, setApplicationHistory] = useState([]) // 応募履歴（イベント情報込み）
  const [showHistory, setShowHistory] = useState(false) // 折り畳み（既定は非表示）
  const [showUnearnedBadges, setShowUnearnedBadges] = useState(false) // 未獲得バッジ一覧の折り畳み（既定は非表示）
  const [showAllBadges, setShowAllBadges] = useState(false) // 獲得済みバッジ一覧の折り畳み（既定は非表示）
  const [userSettings, setUserSettings] = useState({
    notifications_enabled: true,
    monthly_goal: 3,
  })
  const [editingMonthlyGoal, setEditingMonthlyGoal] = useState(false)
  const [tempMonthlyGoal, setTempMonthlyGoal] = useState("") // 文字列型で空文字列も許可

  const [participationHistory, setParticipationHistory] = useState([]) // 確定された参加履歴（自分のみ）
  const [allUsersParticipationHistory, setAllUsersParticipationHistory] = useState([]) // 全ユーザーの参加履歴
  const [participationCount, setParticipationCount] = useState(0) // 累計活動日数
  const [participationDates, setParticipationDates] = useState(new Set()) // 参加した日付のSet
  const [participationStats, setParticipationStats] = useState({
    totalDays: 0,
    totalByRole: { driver: 0, attendant: 0 },
    currentStreak: 0,
    longestStreak: 0,
    thisMonthDays: 0,
    lastMonthDays: 0,
    bestMonthDays: 0,
  })
  const [participationMonthlyStats, setParticipationMonthlyStats] = useState([]) // [{ month: 'YYYY-MM', days: number }]
  const [participationRolesByDate, setParticipationRolesByDate] = useState({}) // { "YYYY-MM-DD": { driver: boolean, attendant: boolean } }
  const [interactionNotes, setInteractionNotes] = useState({}) // { [event_id]: { template_key, free_text } }
  const [editingNote, setEditingNote] = useState(null) // { event_id, template_key, free_text } または null

  // ネットワーク状態の監視
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      showToast("インターネット接続が復旧しました", "success")
    }
    const handleOffline = () => {
      setIsOnline(false)
      showToast("インターネット接続が切断されました", "warning", 5000)
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [showToast])

  // ネットワークエラー時のハンドラー
  const handleNetworkError = useCallback(() => {
    if (!isOnline) {
      showToast("オフラインです。インターネット接続を確認してください。", "error", 5000)
    }
  }, [isOnline, showToast])

  // ---- ログアウト ----
  const handleLogout = async () => {
    const confirmed = await showConfirm({
      title: "ログアウト",
      message: "ログアウトしますか？",
      confirmText: "ログアウト",
      cancelText: "キャンセル",
      type: "info",
    })
    if (!confirmed) return

    // ログアウトフラグを設定（自動ログインを防ぐ）
    sessionStorage.setItem("justLoggedOut", "true")

    // ログアウトAPIを呼び出してクッキーを削除
    try {
      await fetch("/api?path=logout", { method: "POST", credentials: "include" })
    } catch (e) {
      console.error("Logout API error:", e)
    }

    // localStorageをクリア
    localStorage.clear()

    // クッキーが削除されるまで少し待ってからリロード
    await new Promise((resolve) => setTimeout(resolve, 100))

    // ログインページへ移動（リロードは不要）
    window.location.href = "/"
  }

  // ---- イベント一覧 + 自分の応募一覧取得 ----
  const refresh = useCallback(async () => {
    const ev = await apiFetch("/api/events", {}, handleNetworkError)
    setEvents(Array.isArray(ev.data) ? ev.data : [])

    if (userName) {
      const me = await apiFetch(`/api/applications?username=${encodeURIComponent(userName)}`, {}, handleNetworkError)
      setMyApps(Array.isArray(me.data) ? me.data : [])
    } else {
      setMyApps([])
    }
  }, [userName, handleNetworkError])

  useEffect(() => {
    refresh()
  }, [refresh])

  // リアルタイム性向上: フォアグラウンド復帰/一定間隔で再取得
  useEffect(() => {
    const handleWake = () => {
      if (!document.hidden) refresh()
    }
    document.addEventListener("visibilitychange", handleWake)
    window.addEventListener("focus", handleWake)
    const timer = setInterval(() => {
      refresh()
    }, 20000) // 20秒ごとに更新
    return () => {
      document.removeEventListener("visibilitychange", handleWake)
      window.removeEventListener("focus", handleWake)
      clearInterval(timer)
    }
  }, [refresh])

  // ---- 通知一覧取得 ----
  const refreshNotifications = useCallback(async () => {
    if (!userName) return
    const r = await apiFetch(`/api?path=notifications`, {}, handleNetworkError)
    if (r.ok && Array.isArray(r.data)) {
      // 新しい順にソートして最新MAX_NOTIFS件のみ保持
      const sorted = [...r.data].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      const latest = sorted.slice(0, MAX_NOTIFS)
      setNotifications(latest)
      // 古い未読が大量にある場合は自動で既読化（サーバ対応があれば最適化可）
      const older = sorted.slice(MAX_NOTIFS).filter((n) => !n.read_at)
      older.slice(0, 20).forEach((n) => markAsRead(n.id)) // 一度に叩きすぎない
    }
  }, [userName, handleNetworkError])

  useEffect(() => {
    if (activeTab === "notifications") {
      ;(async () => {
        const r = await apiFetch(`/api?path=notifications`, {}, handleNetworkError)
        if (r.ok && Array.isArray(r.data)) {
          const sorted = [...r.data].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          setNotifications(sorted.slice(0, MAX_NOTIFS))
        }
      })()
    }
  }, [activeTab, handleNetworkError])

  // ---- ユーザー設定取得 ----
  const refreshUserSettings = useCallback(async () => {
    if (!userName) return
    const r = await apiFetch(`/api?path=user-settings`, {}, handleNetworkError)
    if (r.ok && r.data) {
      const monthlyGoal = r.data.monthly_goal || 3
      setUserSettings({
        notifications_enabled: r.data.notifications_enabled !== false,
        monthly_goal: monthlyGoal,
      })
      setTempMonthlyGoal(monthlyGoal === 0 ? "" : String(monthlyGoal))
    }
  }, [userName, handleNetworkError])

  // ---- 応募履歴取得 ----
  const refreshApplicationHistory = useCallback(async () => {
    if (!userName) {
      setApplicationHistory([])
      return
    }
    try {
      // 応募一覧を取得
      const appsRes = await apiFetch(
        `/api/applications?username=${encodeURIComponent(userName)}`,
        {},
        handleNetworkError,
      )
      if (!appsRes.ok || !Array.isArray(appsRes.data)) {
        setApplicationHistory([])
        return
      }

      // イベント情報を取得
      const eventsRes = await apiFetch("/api/events", {}, handleNetworkError)
      const allEvents = Array.isArray(eventsRes.data) ? eventsRes.data : []
      const eventsMap = {}
      for (const ev of allEvents) {
        eventsMap[ev.id] = ev
      }

      // 確定情報を取得
      const historyWithDetails = await Promise.all(
        appsRes.data.map(async (app) => {
          const ev = eventsMap[app.event_id]
          let isDecided = false
          try {
            const decRes = await apiFetch(`/api?path=decide&event_id=${app.event_id}`, {}, handleNetworkError)
            if (decRes.ok && decRes.data) {
              const decidedList = decRes.data[app.kind] || []
              isDecided = decidedList.includes(userName)
            }
          } catch {}

          return {
            ...app,
            event: ev || null,
            isDecided,
          }
        }),
      )

      // 日付でソート（新しい順）
      historyWithDetails.sort((a, b) => {
        if (!a.event || !b.event) return 0
        if (a.event.date !== b.event.date) {
          return b.event.date.localeCompare(a.event.date)
        }
        return new Date(b.created_at) - new Date(a.created_at)
      })

      setApplicationHistory(historyWithDetails)
    } catch (e) {
      console.error("application history fetch error:", e)
      setApplicationHistory([])
    }
  }, [userName, handleNetworkError])

  const refreshParticipationHistory = useCallback(async () => {
    if (!userName) {
      setParticipationHistory([])
      setParticipationCount(0)
      setParticipationDates(new Set())
      setParticipationStats({
        totalDays: 0,
        totalByRole: { driver: 0, attendant: 0 },
        currentStreak: 0,
        longestStreak: 0,
        thisMonthDays: 0,
        lastMonthDays: 0,
        bestMonthDays: 0,
      })
      setParticipationMonthlyStats([])
      return
    }
    try {
      const res = await apiFetch(`/api?path=selections&username=${encodeURIComponent(userName)}`, {}, handleNetworkError)
      console.log("Participation history response:", res) // デバッグ用
      
      // APIレスポンスの形式を確認してデータを取得
      let data = null
      if (res.ok) {
        // res.dataが直接配列の場合
        if (Array.isArray(res.data)) {
          data = res.data
        }
        // res.data.dataが配列の場合（APIの形式による）
        else if (res.data && Array.isArray(res.data.data)) {
          data = res.data.data
        }
      }
      
      if (data && Array.isArray(data)) {
        setParticipationHistory(data)

        // 今日の日付を取得（YYYY-MM-DD形式）
        const today = toLocalYMD(new Date())
        
        // 日付ごとにグループ化して重複を除外（同じ日に運転手と添乗員両方で参加した場合は1日としてカウント）
        // かつ、今日以前の日付のみをカウント（未来の日付は除外）
        const dates = data
          .map((item) => item.date)
          .filter((date) => {
            // 日付が存在し、空文字でない
            if (!date || date.trim() === "") return false
            // 今日以前の日付のみ（未来の日付は除外）
            return date <= today
          })
        
        const uniqueDates = new Set(dates)
        const count = uniqueDates.size
        
        console.log("Today:", today) // デバッグ用
        console.log("Participation dates (past and today only):", Array.from(uniqueDates).sort()) // デバッグ用
        console.log("Participation count:", count) // デバッグ用
        
        setParticipationCount(count)
        setParticipationDates(uniqueDates)

        // 日付ごとの参加役割情報を計算
        const participationRolesByDate = {}
        for (const item of data) {
          if (!item.date || item.date.trim() === "" || item.date > today) continue
          if (!participationRolesByDate[item.date]) {
            participationRolesByDate[item.date] = { driver: false, attendant: false }
          }
          if (item.role === "driver" || item.kind === "driver") {
            participationRolesByDate[item.date].driver = true
          }
          if (item.role === "attendant" || item.kind === "attendant") {
            participationRolesByDate[item.date].attendant = true
          }
        }
        setParticipationRolesByDate(participationRolesByDate)

        // 役割別参加回数（イベント単位のシンプルなカウント、今日以前の日付のみ）
        const driverCount = data.filter((item) => {
          if (!item.date || item.date.trim() === "" || item.date > today) return false
          return item.role === "driver" || item.kind === "driver"
        }).length
        const attendantCount = data.filter((item) => {
          if (!item.date || item.date.trim() === "" || item.date > today) return false
          return item.role === "attendant" || item.kind === "attendant"
        }).length

        // 月ごとの参加日数（ユニーク日付ベース）
        const monthlyMap = new Map() // monthKey -> Set of dates
        for (const date of uniqueDates) {
          const monthKey = date.slice(0, 7) // YYYY-MM
          if (!monthlyMap.has(monthKey)) {
            monthlyMap.set(monthKey, new Set())
          }
          monthlyMap.get(monthKey).add(date)
        }
        const monthlyArray = Array.from(monthlyMap.entries()).map(([month, daySet]) => ({
          month,
          days: daySet.size,
        }))
        // 新しい順（降順）
        monthlyArray.sort((a, b) => b.month.localeCompare(a.month))

        const todayDate = parseYMD(today)
        const thisMonthKey = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, "0")}`
        const lastMonthDate = new Date(todayDate.getFullYear(), todayDate.getMonth() - 1, 1)
        const lastMonthKey = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}`

        const thisMonthDays = monthlyMap.get(thisMonthKey)?.size || 0
        const lastMonthDays = monthlyMap.get(lastMonthKey)?.size || 0
        const bestMonthDays = monthlyArray.reduce((max, m) => (m.days > max ? m.days : max), 0)

        // 連続参加ストリークを計算
        // 現在のストリーク: 最新の参加日から過去に向かって連続している日数（活動日のみでカウント）
        // 活動日と活動日の間に活動日がない場合は連続と判断
        const sortedDatesDesc = Array.from(uniqueDates).sort().reverse() // 降順（新しい日付から古い日付へ）
        let currentStreak = 0
        let prevDateObjForCurrent = null

        // 活動日（イベント）の日付をSetに変換（高速検索用）
        const eventDatesSet = new Set(events.map(ev => ev.date).filter(Boolean))

        for (const d of sortedDatesDesc) {
          const currentDateObj = parseYMD(d)
          if (!prevDateObjForCurrent) {
            // 最初の日付（最新の参加日）からカウント開始
            currentStreak = 1
            prevDateObjForCurrent = currentDateObj
          } else {
            // 前の日付との差を計算
            const diffMs = prevDateObjForCurrent.getTime() - currentDateObj.getTime()
            const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
            
            if (diffDays === 1) {
              // 1日違いの場合は連続
              currentStreak += 1
              prevDateObjForCurrent = currentDateObj
            } else if (diffDays > 1) {
              // 2日以上離れている場合、その間に活動日があるかチェック
              let hasEventBetween = false
              for (let i = 1; i < diffDays; i++) {
                const checkDate = new Date(prevDateObjForCurrent)
                checkDate.setDate(checkDate.getDate() - i)
                const checkDateStr = toLocalYMD(checkDate)
                if (eventDatesSet.has(checkDateStr)) {
                  hasEventBetween = true
                  break
                }
              }
              
              if (!hasEventBetween) {
                // 間に活動日がない場合は連続と判断
                currentStreak += 1
                prevDateObjForCurrent = currentDateObj
              } else {
                // 間に活動日がある場合は連続が途切れた
                break
              }
            } else {
              // diffDays <= 0 の場合は異常（未来の日付など）
              break
            }
          }
        }

        // 最長ストリーク: 全期間を通じての最長連続日数（昇順で計算）
        // 活動日と活動日の間に活動日がない場合は連続と判断
        const sortedDatesAsc = Array.from(uniqueDates).sort() // 昇順（古い日付から新しい日付へ）
        let longestStreak = 0
        let streakCount = 0
        let prevDateObjForLongest = null
        for (const d of sortedDatesAsc) {
          const currentDateObj = parseYMD(d)
          if (!prevDateObjForLongest) {
            streakCount = 1
          } else {
            const diffMs = currentDateObj.getTime() - prevDateObjForLongest.getTime()
            const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
            
            if (diffDays === 1) {
              // 1日違いの場合は連続
              streakCount += 1
            } else if (diffDays > 1) {
              // 2日以上離れている場合、その間に活動日があるかチェック
              let hasEventBetween = false
              for (let i = 1; i < diffDays; i++) {
                const checkDate = new Date(prevDateObjForLongest)
                checkDate.setDate(checkDate.getDate() + i)
                const checkDateStr = toLocalYMD(checkDate)
                if (eventDatesSet.has(checkDateStr)) {
                  hasEventBetween = true
                  break
                }
              }
              
              if (!hasEventBetween) {
                // 間に活動日がない場合は連続と判断
                streakCount += 1
              } else {
                // 間に活動日がある場合は連続が途切れた
                streakCount = 1
              }
            } else {
              // diffDays <= 0 の場合は異常（未来の日付など）
              streakCount = 1
            }
          }
          if (streakCount > longestStreak) {
            longestStreak = streakCount
          }
          prevDateObjForLongest = currentDateObj
        }

        setParticipationStats({
          totalDays: count,
          totalByRole: { driver: driverCount, attendant: attendantCount },
          currentStreak,
          longestStreak,
          thisMonthDays,
          lastMonthDays,
          bestMonthDays,
        })
        setParticipationMonthlyStats(monthlyArray)
      } else {
        console.warn("Invalid data format:", res.data)
        setParticipationHistory([])
        setParticipationCount(0)
        setParticipationDates(new Set())
        setParticipationRolesByDate({})
        setParticipationStats({
          totalDays: 0,
          totalByRole: { driver: 0, attendant: 0 },
          currentStreak: 0,
          longestStreak: 0,
          thisMonthDays: 0,
          lastMonthDays: 0,
          bestMonthDays: 0,
        })
        setParticipationMonthlyStats([])
      }
    } catch (e) {
      console.error("participation history fetch error:", e)
      setParticipationHistory([])
      setParticipationCount(0)
      setParticipationDates(new Set())
      setParticipationRolesByDate({})
    }
  }, [userName, handleNetworkError, events])

  // ---- 全ユーザーの運行履歴取得 ----
  const refreshAllUsersParticipationHistory = useCallback(async () => {
    try {
      const res = await apiFetch(`/api?path=selections`, {}, handleNetworkError)
      if (res.ok && Array.isArray(res.data)) {
        setAllUsersParticipationHistory(res.data)
      } else {
        setAllUsersParticipationHistory([])
      }
    } catch (e) {
      console.error("all users participation history fetch error:", e)
      setAllUsersParticipationHistory([])
    }
  }, [handleNetworkError])

  // ---- メモ一覧取得 ----
  const refreshInteractionNotes = useCallback(async () => {
    if (!userName) {
      setInteractionNotes({})
      return
    }
    try {
      const res = await apiFetch(`/api?path=interaction-notes&username=${encodeURIComponent(userName)}`, {}, handleNetworkError)
      if (res.ok && Array.isArray(res.data)) {
        const notesMap = {}
        for (const note of res.data) {
          notesMap[note.event_id] = {
            template_key: note.template_key,
            free_text: note.free_text,
            updated_at: note.updated_at,
          }
        }
        setInteractionNotes(notesMap)
      }
    } catch (e) {
      console.error("interaction notes fetch error:", e)
      setInteractionNotes({})
    }
  }, [userName, handleNetworkError])

  useEffect(() => {
    if (activeTab === "mypage") {
      refreshUserSettings()
      refreshApplicationHistory()
    }
    if (activeTab === "participation") {
      refreshUserSettings()
      refreshParticipationHistory()
      refreshInteractionNotes()
      refreshAllUsersParticipationHistory()
    }
  }, [activeTab, refreshUserSettings, refreshApplicationHistory, refreshParticipationHistory, refreshInteractionNotes, refreshAllUsersParticipationHistory])

  // ---- 通知を既読にする ----
  const markAsRead = async (id) => {
    try {
      await apiFetch(
        `/api?path=notifications`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        },
        handleNetworkError,
      )
      await refreshNotifications()
    } catch (e) {
      console.error("既読処理エラー:", e)
    }
  }

  // ---- ユーザー設定を保存 ----
  const saveUserSettings = async () => {
    try {
      await apiFetch(
        `/api?path=user-settings`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(userSettings),
        },
        handleNetworkError,
      )
      showToast("設定を保存しました", "success")
    } catch (e) {
      showToast(`設定の保存に失敗しました: ${e.message}`, "error")
    }
  }

  // ---- メモを保存 ----
  const saveInteractionNote = async (eventId, templateKey, freeText) => {
    if (!userName) return
    try {
      const res = await apiFetch(
        `/api?path=interaction-notes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: userName,
            event_id: eventId,
            template_key: templateKey || null,
            free_text: freeText || null,
          }),
        },
        handleNetworkError,
      )
      if (res.ok) {
        // メモ一覧を更新
        await refreshInteractionNotes()
        setEditingNote(null)
        showToast("メモを保存しました", "success")
      } else {
        throw new Error(res.data?.error || "保存に失敗しました")
      }
    } catch (e) {
      showToast(`メモの保存に失敗しました: ${e.message}`, "error")
    }
  }

  const listOfSelected = useMemo(() => {
    const ymd = toLocalYMD(selectedDate)
    return events.filter((e) => e.date === ymd)
  }, [events, selectedDate])

  // 残枠表示用にイベント別の応募数 + 確定済みメンバーをGET
  const [counts, setCounts] = useState({})
  const [decided, setDecided] = useState({}) // { eventId: { driver: string[], attendant: string[] } }
  const [decidedDates, setDecidedDates] = useState(new Set()) // 確定済みの日付のSet
  const [cancelledDates, setCancelledDates] = useState(new Set()) // ユーザーが応募したがキャンセルが出た日付
  const [decidedMembersByEventId, setDecidedMembersByEventId] = useState({}) // { eventId: { driver: string[], attendant: string[] } } イベントごとの確定状況
  // すべてのイベントについて確定状況を取得（カレンダーの色分けとイベント一覧用）
  useEffect(() => {
    let aborted = false
    ;(async () => {
      if (!Array.isArray(events) || events.length === 0) {
        if (!aborted) {
          setDecidedMembersByEventId({})
          setDecided({})
          setDecidedDates(new Set())
          setCancelledDates(new Set())
          setCounts({})
        }
        return
      }

      if (!userName) {
        if (!aborted) {
          setCounts({})
          setDecided({})
          setDecidedDates(new Set())
          setCancelledDates(new Set())
          setDecidedMembersByEventId({})
        }
        return
      }

      // 1. すべてのイベントの確定状況を取得
      const allDecidedByEventId = {}
      const tasks = events.map(async (ev) => {
        try {
          const dec = await apiFetch(`/api?path=decide&event_id=${ev.id}`, {}, handleNetworkError)
          if (dec.ok && dec.data) {
            allDecidedByEventId[ev.id] = {
              driver: Array.isArray(dec.data.driver) ? dec.data.driver : [],
              attendant: Array.isArray(dec.data.attendant) ? dec.data.attendant : [],
            }
          } else {
            allDecidedByEventId[ev.id] = { driver: [], attendant: [] }
          }
        } catch {
          allDecidedByEventId[ev.id] = { driver: [], attendant: [] }
        }
      })
      await Promise.all(tasks)
      if (aborted) return

      // 2. 当日のイベントの応募数を取得
      const ymd = toLocalYMD(selectedDate)
      const todays = events.filter((e) => e.date === ymd)
      const out = {}

      for (const ev of todays) {
        try {
          const appsRes = await apiFetch(`/api/applications?event_id=${ev.id}`, {}, handleNetworkError).catch(() => ({
            ok: false,
            data: [],
          }))
          const arr = Array.isArray(appsRes.data) ? appsRes.data : []
          out[ev.id] = {
            driver: arr.filter((a) => a.kind === "driver").length,
            attendant: arr.filter((a) => a.kind === "attendant").length,
            raw: arr,
          }
        } catch {}
      }
      if (aborted) return

      // 3. 自分が確定済みの日付を計算
      const decDateSet = new Set()
      if (myApps.length > 0) {
        const myEventIds = [...new Set(myApps.map((a) => a.event_id))]
        for (const eventId of myEventIds) {
          const ev = events.find((e) => e.id === eventId)
          if (!ev) continue

          const evDecided = allDecidedByEventId[eventId]
          if (evDecided) {
            const isMyDecided =
              (Array.isArray(evDecided.driver) && evDecided.driver.includes(userName)) ||
              (Array.isArray(evDecided.attendant) && evDecided.attendant.includes(userName))

            if (isMyDecided) {
              decDateSet.add(ev.date)
            }
          }
        }
      }

      // 4. キャンセル通知をチェック
      const userCancelledDateSet = new Set()
      try {
        const notifsRes = await apiFetch(`/api?path=notifications`, {}, handleNetworkError)
        if (notifsRes.ok && Array.isArray(notifsRes.data)) {
          for (const notif of notifsRes.data) {
            if (notif.kind?.startsWith("cancel_") && myApps.some((a) => a.event_id === notif.event_id)) {
              const ev = events.find((e) => e.id === notif.event_id)
              if (ev && ev.date) {
                const evDecided = allDecidedByEventId[notif.event_id]
                const capacityDriver = ev.capacity_driver ?? 1
                const capacityAttendant = ev.capacity_attendant ?? 1
                const confirmedDriverCount = evDecided?.driver?.length || 0
                const confirmedAttendantCount = evDecided?.attendant?.length || 0
                // 定員が埋まっている場合はキャンセルフラグを付けない
                if (confirmedDriverCount < capacityDriver || confirmedAttendantCount < capacityAttendant) {
                  userCancelledDateSet.add(ev.date)
                }
              }
            }
          }
        }
      } catch {}

      if (!aborted) {
        // すべての状態を一度に更新（競合を防ぐ）
        setCounts(out)
        setDecided(allDecidedByEventId)
        setDecidedDates(decDateSet)
        setCancelledDates(userCancelledDateSet)
        setDecidedMembersByEventId(allDecidedByEventId)
      }
    })()
    return () => {
      aborted = true
    }
  }, [events, selectedDate, userName, myApps, handleNetworkError])

  const hasApplied = (eventId, kind) => myApps.some((a) => a.event_id === eventId && a.kind === kind)

  // カレンダーに渡すpropsをメモ化（再レンダリングを防ぐ）
  const calendarDecidedMembersByDate = useMemo(() => {
    return { _byEventId: decidedMembersByEventId }
  }, [decidedMembersByEventId])

  // decidedDatesとcancelledDatesをメモ化（内容が同じ場合は同じインスタンスを返す）
  const decidedDatesKey = useMemo(() => {
    return Array.from(decidedDates).sort().join(",")
  }, [decidedDates])

  const cancelledDatesKey = useMemo(() => {
    return Array.from(cancelledDates).sort().join(",")
  }, [cancelledDates])

  const memoizedDecidedDates = useMemo(() => {
    return decidedDates
  }, [decidedDatesKey])

  const memoizedCancelledDates = useMemo(() => {
    return cancelledDates
  }, [cancelledDatesKey])

  // myAppliedEventIdsをメモ化
  const myAppsKey = useMemo(() => {
    return myApps
      .map((a) => `${a.event_id}`)
      .sort()
      .join(",")
  }, [myApps])

  const memoizedMyAppliedEventIds = useMemo(() => {
    return new Set(myApps.map((a) => a.event_id))
  }, [myAppsKey])

  const apply = async (ev, kind) => {
    if (!userName) {
      showToast("先にログインしてください。", "error")
      return
    }

    // 確定済みチェック（自分がその役割で確定済みの場合は応募変更不可）
    const dec = decided[ev.id] || { driver: [], attendant: [] }
    const isDecided = (kind === "driver" ? dec.driver : dec.attendant).includes(userName)
    if (isDecided) {
      const kindLabel = kind === "driver" ? "運転手" : "添乗員"
      showToast(`このイベントの${kindLabel}として既に確定済みです。確定済みの役割の応募は変更できません。`, "warning")
      return
    }

    // 同じイベントで既に別の役割に応募しているかチェック
    const hasAppliedOtherKind = myApps.some((a) => a.event_id === ev.id && a.kind !== kind)
    if (hasAppliedOtherKind) {
      const otherKind = myApps.find((a) => a.event_id === ev.id && a.kind !== kind)?.kind
      const otherKindLabel = otherKind === "driver" ? "運転手" : "添乗員"
      showToast(
        `このイベントには既に${otherKindLabel}として応募しています。同じイベントで運転手と添乗員の両方に応募することはできません。`,
        "warning",
      )
      return
    }

    setApplying(true)
    try {
      const { ok, status, data } = await apiFetch(
        "/api/applications",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event_id: ev.id, username: userName, kind }),
        },
        handleNetworkError,
      )
      if (!ok) {
        throw new Error(data?.error || `HTTP ${status}`)
      }
      await refresh()
      if (data?.auto_switched && data?.switched_to === "attendant") {
        showToast("運転手で応募されましたが運転手が満杯のため、添乗員として登録されました。", "info")
      } else {
        showToast("応募しました！", "success")
      }
    } catch (e) {
      showToast(`応募に失敗しました: ${e.message}`, "error")
    } finally {
      setApplying(false)
    }
  }

  // 確定後のキャンセル
  const cancelDecided = async (ev, kind) => {
    if (!userName) return
    const confirmed = await showConfirm({
      title: "確定済みシフトのキャンセル",
      message: "確定済みのシフトをキャンセルしますか？通常の応募者から自動で繰り上げで確定される可能性があります。",
      confirmText: "キャンセルする",
      cancelText: "戻る",
      type: "warning",
    })
    if (!confirmed) return
    setApplying(true)
    try {
      const { ok, status, data } = await apiFetch(
        "/api?path=cancel",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event_id: ev.id, kind }),
        },
        handleNetworkError,
      )
      if (!ok) {
        throw new Error(data?.error || `HTTP ${status}`)
      }
      await refresh()
      // 確定済み日付も再取得
      const ymd = toLocalYMD(selectedDate)
      const todays = events.filter((e) => e.date === ymd)
      if (todays.some((e) => e.id === ev.id)) {
        // キャンセル後に状態を更新
        setTimeout(() => {
          refresh()
        }, 100)
      }
      showToast("キャンセルが完了しました。", "success")
    } catch (e) {
      showToast(`キャンセルに失敗しました: ${e.message}`, "error")
    } finally {
      setApplying(false)
    }
  }

  const cancel = async (ev, kind) => {
    if (!userName) return
    const confirmed = await showConfirm({
      title: "応募の取り消し",
      message: "応募を取り消しますか？",
      confirmText: "取り消す",
      cancelText: "キャンセル",
      type: "info",
    })
    if (!confirmed) return
    setApplying(true)
    try {
      const url = `/api/applications?event_id=${encodeURIComponent(ev.id)}&username=${encodeURIComponent(userName)}&kind=${encodeURIComponent(kind)}`
      const { ok, status, data } = await apiFetch(url, { method: "DELETE" }, handleNetworkError)
      if (!ok) throw new Error(data?.error || `HTTP ${status}`)
      await refresh()
      showToast("応募を取り消しました。", "success")
    } catch (e) {
      showToast(`取り消しに失敗しました: ${e.message}`, "error")
    } finally {
      setApplying(false)
    }
  }

  // 未読通知数
  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read_at).length
  }, [notifications])

  // 通知タブの内容
  const renderNotificationsTab = () => (
    <div>
      <h2 className="font-semibold mb-4">通知一覧</h2>
      {notifications.length === 0 ? (
        <p className="text-sm text-gray-500">通知はありません。</p>
      ) : (
        <ul className="space-y-2">
          {notifications.map((n) => {
            // 通知からイベントの日付を取得
            const eventForNotification = events.find((e) => e.id === n.event_id)
            const handleNotificationClick = () => {
              if (eventForNotification && eventForNotification.date) {
                const dateParts = eventForNotification.date.split("-")
                if (dateParts.length === 3) {
                  const eventDate = new Date(
                    Number.parseInt(dateParts[0]),
                    Number.parseInt(dateParts[1]) - 1,
                    Number.parseInt(dateParts[2]),
                  )
                  setSelectedDate(eventDate)
                  setActiveTab("calendar")
                }
              }
            }

            return (
              <li
                key={n.id}
                className={`border rounded p-3 ${!n.read_at ? "bg-blue-50 border-blue-200" : "bg-white"} ${eventForNotification ? "cursor-pointer hover:bg-gray-50" : ""}`}
                onClick={handleNotificationClick}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="text-sm font-medium">{n.message}</div>
                    <div className="text-xs text-gray-500 mt-1">{new Date(n.created_at).toLocaleString("ja-JP")}</div>
                  </div>
                  {!n.read_at && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        markAsRead(n.id)
                      }}
                      className="ml-2 px-2 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700"
                    >
                      既読
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )

  // マイページタブの内容
  const renderMypageTab = () => (
    <div>
      <h2 className="font-semibold mb-4">マイページ</h2>

      {/* アカウント情報 */}
      <div className="mb-6">
        <h3 className="font-semibold mb-2">アカウント情報</h3>
        <div className="border rounded p-3 bg-gray-50">
          <div className="text-sm">
            <div className="mb-2">
              <span className="font-medium">ユーザー名:</span> {userName}
            </div>
            <div>
              <span className="font-medium">役割設定:</span> {userRolePref}
            </div>
          </div>
        </div>
      </div>

      {/* 通知設定 */}
      <div className="mb-6">
        <h3 className="font-semibold mb-2">通知設定</h3>
        <div className="border rounded p-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={userSettings.notifications_enabled}
              onChange={(e) => setUserSettings({ ...userSettings, notifications_enabled: e.target.checked })}
              className="w-4 h-4"
            />
            <span className="text-sm">確定通知を有効にする</span>
          </label>
        </div>
      </div>

      {/* 応募履歴 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">応募履歴</h3>
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="px-2 py-1 text-xs rounded border bg-white hover:bg-gray-50"
          >
            {showHistory ? "閉じる" : "表示"}
          </button>
        </div>
        {!showHistory ? (
          <p className="text-xs text-gray-500">必要な時だけ表示できます。</p>
        ) : applicationHistory.length === 0 ? (
          <p className="text-sm text-gray-500 border rounded p-3">応募履歴はありません。</p>
        ) : (
          <div className="space-y-2">
            {applicationHistory.map((app) => {
              if (!app.event) return null
              const kindLabel = app.kind === "driver" ? "運転手" : "添乗員"
              const kindEmoji = app.kind === "driver" ? "🚗" : "👤"

              return (
                <div
                  key={`${app.id}-${app.kind}`}
                  className={`border rounded p-3 ${app.isDecided ? "bg-green-50 border-green-200" : "bg-white"}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {app.event.icon && (
                          <img src={app.event.icon || "/placeholder.svg"} alt="" className="w-5 h-5 object-contain" />
                        )}
                        <span className="font-medium text-sm">{app.event.label}</span>
                      </div>
                      <div className="text-xs text-gray-600 mb-1">
                        {app.event.date} {app.event.start_time}〜{app.event.end_time}
                      </div>
                      <div className="text-xs">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ${
                            app.isDecided ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {kindEmoji} {kindLabel}
                          {app.isDecided && " ✓ 確定済み"}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        応募日: {new Date(app.created_at).toLocaleString("ja-JP")}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <button onClick={saveUserSettings} className="w-full px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">
        設定を保存
      </button>
    </div>
  )

  // バッジ定義（全バッジ）
  const allBadges = useMemo(
    () => [
      {
        id: "first",
        label: "初参加バッジ",
        description: "初めて活動に参加しました。",
        minTotalDays: 1,
      },
      {
        id: "go5",
        label: "がんばり隊",
        description: "5日以上活動に参加しています。",
        minTotalDays: 5,
      },
      {
        id: "leader10",
        label: "頼れるサポーター",
        description: "10日以上活動に参加しています。",
        minTotalDays: 10,
      },
      {
        id: "steady20",
        label: "継続サポーター",
        description: "20日以上活動に参加しています。",
        minTotalDays: 20,
      },
      {
        id: "gold30",
        label: "ゴールドサポーター",
        description: "30日以上活動に参加しています。",
        minTotalDays: 30,
      },
      {
        id: "driver1",
        label: "運転サポーター",
        description: "運転手として活動に参加したことがある。",
        role: "driver",
        minRoleCount: 1,
      },
      {
        id: "driver5",
        label: "ベテラン運転サポーター",
        description: "運転手として5回以上活動に参加しています。",
        role: "driver",
        minRoleCount: 5,
      },
      {
        id: "attendant1",
        label: "添乗サポーター",
        description: "添乗員として活動に参加したことがある。",
        role: "attendant",
        minRoleCount: 1,
      },
      {
        id: "attendant5",
        label: "ベテラン添乗サポーター",
        description: "添乗員として5回以上活動に参加しています。",
        role: "attendant",
        minRoleCount: 5,
      },
    ],
    [],
  )

  // 獲得済みバッジ判定
  const badges = useMemo(() => {
    const total = participationStats.totalDays
    const { driver, attendant } = participationStats.totalByRole

    return allBadges.filter((badge) => {
      if (badge.minTotalDays != null && total < badge.minTotalDays) return false
      if (badge.role === "driver" && (badge.minRoleCount || 0) > driver) return false
      if (badge.role === "attendant" && (badge.minRoleCount || 0) > attendant) return false
      return true
    })
  }, [participationStats, allBadges])

  // 最近獲得したバッジを判定（最後に獲得したバッジを時系列で追跡、今日以前の日付のみ）
  const recentBadges = useMemo(() => {
    if (participationHistory.length === 0) return []
    
    // 今日の日付を取得（YYYY-MM-DD形式）
    const today = toLocalYMD(new Date())
    
    // 今日以前の日付のみをフィルタリング
    const pastHistory = participationHistory.filter(
      (item) => item.date && item.date.trim() !== "" && item.date <= today
    )
    
    if (pastHistory.length === 0) return []
    
    // 日付ごとにグループ化（同じ日付の参加履歴をまとめる）
    const historyByDate = new Map()
    for (const item of pastHistory) {
      const date = item.date
      if (!historyByDate.has(date)) {
        historyByDate.set(date, [])
      }
      historyByDate.get(date).push(item)
    }
    
    // 日付を昇順にソート（古い順）
    const sortedDates = Array.from(historyByDate.keys()).sort()
    
    // 各日付で獲得されたバッジを追跡
    const earnedBadgesByDate = []
    let previousDates = new Set()
    let previousDriver = 0
    let previousAttendant = 0
    
    for (const date of sortedDates) {
      const dateHistory = historyByDate.get(date)
      
      // この日付までの統計を計算
      const currentDates = new Set([...Array.from(previousDates), date])
      const currentDriver = pastHistory.filter(
        (item) => item.date && item.date <= date && (item.role === "driver" || item.kind === "driver")
      ).length
      const currentAttendant = pastHistory.filter(
        (item) => item.date && item.date <= date && (item.role === "attendant" || item.kind === "attendant")
      ).length
      
      // 前の状態でのバッジ
      const beforeBadges = allBadges.filter((badge) => {
        if (badge.minTotalDays != null && previousDates.size < badge.minTotalDays) return false
        if (badge.role === "driver" && (badge.minRoleCount || 0) > previousDriver) return false
        if (badge.role === "attendant" && (badge.minRoleCount || 0) > previousAttendant) return false
        return true
      })
      
      // この日付を含めた状態でのバッジ
      const afterBadges = allBadges.filter((badge) => {
        if (badge.minTotalDays != null && currentDates.size < badge.minTotalDays) return false
        if (badge.role === "driver" && (badge.minRoleCount || 0) > currentDriver) return false
        if (badge.role === "attendant" && (badge.minRoleCount || 0) > currentAttendant) return false
        return true
      })
      
      // この日付で新しく獲得されたバッジ
      const newlyEarned = afterBadges.filter(
        (badge) => !beforeBadges.some((b) => b.id === badge.id)
      )
      
      if (newlyEarned.length > 0) {
        earnedBadgesByDate.push({
          date,
          badges: newlyEarned,
        })
      }
      
      // 次のループのために更新
      previousDates = currentDates
      previousDriver = currentDriver
      previousAttendant = currentAttendant
    }
    
    // 最後に獲得されたバッジを取得（最新の日付から）
    if (earnedBadgesByDate.length === 0) return []
    
    // 最新の日付で獲得されたバッジを取得
    const latestEarned = earnedBadgesByDate[earnedBadgesByDate.length - 1]
    
    // 最新の2個を返す
    return latestEarned.badges.slice(0, 2)
  }, [participationHistory, badges, allBadges, participationStats])

  // 未獲得バッジ一覧
  const unearnedBadges = useMemo(
    () => allBadges.filter((badge) => !badges.some((b) => b.id === badge.id)),
    [allBadges, badges],
  )

  // 励ましメッセージ判定
  const encouragement = useMemo(() => {
    const { totalDays, currentStreak, thisMonthDays, lastMonthDays } = participationStats
    const MONTHLY_GOAL = 3

    if (totalDays === 0) {
      return {
        title: "はじめの一歩を踏み出してみませんか？",
        body: "まだ活動参加の記録はありません。ご都合の良い日から、無理のないペースで参加してみてください。",
      }
    }

    if (thisMonthDays === 0) {
      return {
        title: "今月の最初の活動を計画してみましょう",
        body: "これまでのご協力ありがとうございます。今月も1日から、少しずつ活動に参加していただけると嬉しいです。",
      }
    }

    if (thisMonthDays >= MONTHLY_GOAL) {
      return {
        title: "今月の目標を達成しました！",
        body: "今月も安定したご活動ありがとうございます。無理のない範囲で、これからもよろしくお願いします。",
      }
    }

    if (currentStreak >= 3) {
      return {
        title: "連続参加、ありがとうございます！",
        body: `${currentStreak}日連続で活動に参加しています。この調子で、休みつつ長く続けていけると素晴らしいですね。`,
      }
    }

    if (thisMonthDays > lastMonthDays && lastMonthDays > 0) {
      return {
        title: "先月よりも活動日数が増えています！",
        body: `先月よりも今月の活動日数が増えています。少しずつの積み重ねが、大きな支えになっています。`,
      }
    }

    return {
      title: "いつもありがとうございます",
      body: "ご都合のつく範囲で活動に参加していただき、ありがとうございます。無理なく、長く続けていただけると嬉しいです。",
    }
  }, [participationStats])

  // 定型文の定義
  const templateOptions = [
    { key: "conversation", text: "往復とも会話がはずみました。" },
    { key: "first_time", text: "初めての方とお話しできました。" },
    { key: "reunion", text: "久しぶりの利用者さんと近況を話しました。" },
  ]

  // カレンダーの日付選択時に、その日の参加履歴があれば定型文編集ダイアログを開く
  const handleParticipationCalendarDateSelect = useCallback((date) => {
    setSelectedDate(date)
    const dateStr = toLocalYMD(date)
    const today = toLocalYMD(new Date())
    
    // 今日以前の日付のみチェック
    if (dateStr > today) return
    
    // その日の参加履歴を取得
    const dayHistory = participationHistory.filter(
      (item) => item.date && item.date.trim() !== "" && item.date === dateStr
    )
    
    if (dayHistory.length > 0) {
      // 最初の参加履歴のイベントIDを使用（同じ日に複数の参加がある場合は最初のもの）
      const firstItem = dayHistory[0]
      const note = interactionNotes[firstItem.event_id]
      setEditingNote({
        event_id: firstItem.event_id,
        template_key: note?.template_key || null,
        free_text: note?.free_text || "",
      })
    }
  }, [participationHistory, interactionNotes])

  // 参加状況タブの内容を追加
  const renderParticipationTab = () => (
    <div>
      <div className="mb-6">
        <div className="border rounded-lg p-4 bg-white">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">累計活動日数</h3>
          <div className="text-center">
            <div className="text-2xl font-extrabold text-emerald-600 mb-1">{participationCount}</div>
            <div className="text-sm text-gray-600">日間</div>
          </div>
        </div>
      </div>

      {/* 今月の目標 */}
      <div className="mb-6">
        <div className="border rounded-lg p-4 bg-white">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-700">今月の目標</h3>
            <button
              onClick={() => {
                const currentGoal = userSettings.monthly_goal || 3
                setTempMonthlyGoal(currentGoal === 0 ? "" : String(currentGoal))
                setEditingMonthlyGoal(true)
              }}
              className="text-xs text-blue-600 hover:text-blue-800 underline"
            >
              目標設定
            </button>
          </div>
          {(() => {
            const MONTHLY_GOAL = userSettings.monthly_goal || 3
            const done = participationStats.thisMonthDays
            const ratio = Math.min(1, MONTHLY_GOAL === 0 ? 0 : done / MONTHLY_GOAL)
            const percent = Math.round(ratio * 100)
            return (
              <>
                <p className="text-sm text-gray-600 mb-1">
                  今月 {done}/{MONTHLY_GOAL} 日
                </p>
                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">達成度: {percent}%</p>
              </>
            )
          })()}
        </div>
      </div>

      {/* 今月の目標編集ダイアログ */}
      {editingMonthlyGoal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">今月の目標を設定</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                目標日数
              </label>
              <input
                type="number"
                min="0"
                max="31"
                value={tempMonthlyGoal}
                onChange={(e) => {
                  let inputValue = e.target.value
                  // 空の場合は空文字列を保持
                  if (inputValue === "") {
                    setTempMonthlyGoal("")
                    return
                  }
                  // 先頭の0を削除（ただし「0」だけの場合は0として扱う）
                  if (inputValue.length > 1 && inputValue.startsWith("0")) {
                    inputValue = inputValue.replace(/^0+/, "")
                    if (inputValue === "") {
                      inputValue = "0"
                    }
                  }
                  const val = parseInt(inputValue, 10)
                  if (!isNaN(val) && val >= 0 && val <= 31) {
                    setTempMonthlyGoal(String(val))
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="目標日数を入力"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  // 空欄の場合は自動的に0として扱う
                  let goalValue = 0
                  if (tempMonthlyGoal !== "" && tempMonthlyGoal !== null && tempMonthlyGoal !== undefined) {
                    goalValue = parseInt(tempMonthlyGoal, 10)
                    if (isNaN(goalValue) || goalValue < 0 || goalValue > 31) {
                      showToast("0から31の間で入力してください", "error")
                      return
                    }
                  }
                  const newSettings = { ...userSettings, monthly_goal: goalValue }
                  setUserSettings(newSettings)
                  try {
                    await apiFetch(
                      `/api?path=user-settings`,
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(newSettings),
                      },
                      handleNetworkError,
                    )
                    showToast("目標を保存しました", "success")
                  } catch (e) {
                    showToast(`目標の保存に失敗しました: ${e.message}`, "error")
                  }
                  setEditingMonthlyGoal(false)
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                保存
              </button>
              <button
                onClick={() => {
                  setEditingMonthlyGoal(false)
                  const currentGoal = userSettings.monthly_goal || 3
                  setTempMonthlyGoal(currentGoal === 0 ? "" : String(currentGoal))
                }}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 最近獲得したバッジ */}
      <div className="mb-6">
        <h2 className="font-semibold mb-2">最近獲得したバッジ</h2>
        {recentBadges.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {recentBadges.map((badge) => (
              <div
                key={badge.id}
                className="border border-amber-200 rounded-lg p-3 bg-amber-50 flex items-start gap-2"
              >
                <div className="text-xl">🏅</div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-amber-800">{badge.label}</div>
                  <div className="text-xs text-amber-700 mt-1">{badge.description}</div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* 獲得済みバッジ一覧（折り畳み式） */}
      {badges.length > 0 && (
        <div className="mb-6">
          <button
            onClick={() => setShowAllBadges((v) => !v)}
            className="w-full flex items-center justify-between p-3 border rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <h2 className="font-semibold text-gray-800">獲得済みのバッジ</h2>
            <span className="text-sm text-gray-600">
              {showAllBadges ? "閉じる" : "タップして表示"}
            </span>
          </button>
          {showAllBadges && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {badges.map((badge) => (
                <div
                  key={badge.id}
                  className="border border-amber-200 rounded-lg p-3 bg-amber-50 flex items-start gap-2"
                >
                  <div className="text-xl">🏅</div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-amber-800">{badge.label}</div>
                    <div className="text-xs text-amber-700 mt-1">{badge.description}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 未獲得バッジ（折り畳み式） */}
      {unearnedBadges.length > 0 && (
        <div className="mb-6">
          <button
            onClick={() => setShowUnearnedBadges((v) => !v)}
            className="w-full flex items-center justify-between p-3 border rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <h2 className="font-semibold text-gray-800">未獲得のバッジ</h2>
            <span className="text-sm text-gray-600">
              {showUnearnedBadges ? "閉じる" : "タップして表示"}
            </span>
          </button>
          {showUnearnedBadges && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {unearnedBadges.map((badge) => (
                <div
                  key={badge.id}
                  className="border border-dashed border-gray-300 rounded-lg p-3 bg-gray-50 flex items-start gap-2"
                >
                  <div className="text-xl">🎯</div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-gray-800">{badge.label}</div>
                    <div className="text-xs text-gray-600 mt-1">{badge.description}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mb-6">
        <h2 className="font-semibold mb-4">参加履歴カレンダー</h2>
        <Calendar
          currentMonth={selectedDate.getMonth()}
          currentYear={selectedDate.getFullYear()}
          selectedDate={selectedDate}
          onMonthChange={(d) => {
            const nd = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + d, 1)
            setSelectedDate(nd)
          }}
          onDateSelect={handleParticipationCalendarDateSelect}
          events={[]}
          decidedDates={participationDates}
          cancelledDates={new Set()}
          decidedMembersByDate={{}}
          myAppliedEventIds={new Set()}
          compact={true}
        />
      </div>

      <div>
        <h2 className="font-semibold mb-4">運行履歴詳細</h2>
        {(() => {
          // 今日の日付を取得（YYYY-MM-DD形式）
          const today = toLocalYMD(new Date())
          // 全ユーザーの履歴から今日以前の日付のみをフィルタリング
          const pastHistory = allUsersParticipationHistory.filter(
            (item) => item.date && item.date.trim() !== "" && item.date <= today
          )
          
          if (pastHistory.length === 0) {
            return <p className="text-base text-gray-500 border rounded p-4" style={{ fontSize: "16px" }}>運行履歴はありません。</p>
          }
          
          return (
            <div className="space-y-3">
              {pastHistory.map((item) => {
                const kindLabel = item.role === "driver" || item.kind === "driver" ? "運転手" : "添乗員"
                const kindEmoji = item.role === "driver" || item.kind === "driver" ? "🚗" : "👤"
                const isMyHistory = item.username === userName
                const note = isMyHistory ? interactionNotes[item.event_id] : null
                const hasNote = note && (note.template_key || note.free_text)

                return (
                  <div key={`${item.id}-${item.username}`} className={`border-2 rounded-lg p-4 ${isMyHistory ? "bg-emerald-50 border-emerald-200" : "bg-white border-gray-200"}`}>
                    <div className="flex items-start justify-between mb-2 gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          {item.icon && (
                            <img src={item.icon || "/placeholder.svg"} alt="" className="w-6 h-6 object-contain" />
                          )}
                          <span className="font-semibold text-base" style={{ fontSize: "17px" }}>{item.label}</span>
                        </div>
                        <div className="text-sm text-gray-700 mb-2" style={{ fontSize: "15px" }}>
                          {item.date} {item.start_time}〜{item.end_time}
                        </div>
                        <div className="mb-2 flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg font-medium ${isMyHistory ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-700"}`} style={{ fontSize: "15px" }}>
                            {kindEmoji} {kindLabel} で参加
                          </span>
                          <span className="text-sm text-gray-600" style={{ fontSize: "14px" }}>
                            {item.username}さん
                          </span>
                        </div>
                        <div className="text-sm text-gray-600" style={{ fontSize: "14px" }}>
                          確定日: {item.decided_at ? new Date(item.decided_at).toLocaleString("ja-JP") : "不明"}
                        </div>
                      </div>
                      {isMyHistory && (
                        <button
                          onClick={() => {
                            setEditingNote({
                              event_id: item.event_id,
                              template_key: note?.template_key || null,
                              free_text: note?.free_text || "",
                            })
                          }}
                          className="px-4 py-2.5 rounded-lg border-2 bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-300 font-semibold whitespace-nowrap flex-shrink-0"
                          style={{ fontSize: "16px", minHeight: "44px", minWidth: "120px" }}
                        >
                          {hasNote ? "定型文を編集" : "定型文を追加"}
                        </button>
                      )}
                    </div>
                    {hasNote && (
                      <div className="mt-3 pt-3 border-t-2 border-gray-200 bg-amber-50 rounded-lg p-3">
                        <div className="flex items-start gap-3">
                          <span className="text-xl flex-shrink-0">💬</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-amber-800 mb-2" style={{ fontSize: "15px" }}>この日のひとこと</div>
                            {note.template_key && (
                              <div className="text-base text-amber-900 mb-2" style={{ fontSize: "16px", lineHeight: "1.6" }}>
                                {templateOptions.find((t) => t.key === note.template_key)?.text || note.template_key}
                              </div>
                            )}
                            {note.free_text && (
                              <div className="text-base text-amber-800 mt-2" style={{ fontSize: "16px", lineHeight: "1.6" }}>
                                {note.template_key && <span className="font-medium">一言：</span>}
                                {note.free_text}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })()}
      </div>
    </div>
  )

  // --- 応募状況リスト ---
  const todayYMD = toLocalYMD(new Date())
  const renderApplyTab = () => {
    const sortedEvents = [...events]
      .filter((ev) => ev.date && ev.date >= todayYMD)
      .sort((a, b) => a.date.localeCompare(b.date) || (a.start_time || "").localeCompare(b.start_time || ""))
    return (
      <div>
        <h2 className="font-semibold mb-4">今後のイベント一覧（募集中）</h2>
        <ul className="space-y-2">
          {sortedEvents.length === 0 && <li className="text-gray-500 text-sm">現時点でイベントはありません。</li>}
          {sortedEvents.map((ev) => {
            const appliedDriver = hasApplied(ev.id, "driver")
            const appliedAtt = hasApplied(ev.id, "attendant")
            const c = counts?.[ev.id] || { driver: 0, attendant: 0 }
            const dec = decided?.[ev.id] || { driver: [], attendant: [] }
            // 自分がどちらかで“確定”済みか調べる
            const isConfirmed = dec.driver.includes(userName) || dec.attendant.includes(userName)
            const isDecidedDriver = dec.driver.includes(userName)
            const isDecidedAttendant = dec.attendant.includes(userName)
            return (
              <li
                key={ev.id}
                className={
                  "border rounded p-3 bg-white flex items-center gap-3 " +
                  (isConfirmed ? "bg-green-50 border-green-300" : "")
                }
              >
                {ev.icon && <img src={ev.icon || "/placeholder.svg"} alt="" className="w-7 h-7" />}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{ev.label}</div>
                  <div className="text-xs text-gray-600 truncate">
                    {ev.date} {ev.start_time}〜{ev.end_time}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    運転手: {c.driver}人 / 添乗員: {c.attendant}人
                  </div>
                  {isDecidedDriver && <div className="text-xs text-green-600 mt-1">✓ あなたが運転手として確定済み</div>}
                  {isDecidedAttendant && (
                    <div className="text-xs text-green-600 mt-1">✓ あなたが添乗員として確定済み</div>
                  )}
                </div>
                <div className="flex flex-col gap-2 items-end text-xs min-w-[128px]">
                  {isDecidedDriver ? (
                    <button
                      style={{ fontSize: "1.1rem", fontWeight: 600, padding: "10px 0" }}
                      className="w-full bg-red-600 text-white px-4 py-2 rounded text-base hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={applying}
                      onClick={() => cancelDecided(ev, "driver")}
                    >
                      {applying ? "処理中..." : "キャンセル（運転手）"}
                    </button>
                  ) : (
                    <button
                      style={{ fontSize: "1.1rem", fontWeight: 600, padding: "10px 0" }}
                      className={
                        appliedDriver
                          ? "w-full bg-gray-300 text-gray-700 px-4 py-2 rounded text-base disabled:opacity-50 disabled:cursor-not-allowed"
                          : "w-full bg-blue-600 text-white px-4 py-2 rounded text-base hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      }
                      disabled={applying}
                      onClick={() => (appliedDriver ? cancel(ev, "driver") : apply(ev, "driver"))}
                    >
                      {applying ? "処理中..." : appliedDriver ? "運転手 応募取消" : "運転手で応募"}
                    </button>
                  )}
                  {isDecidedAttendant ? (
                    <button
                      style={{ fontSize: "1.1rem", fontWeight: 600, padding: "10px 0" }}
                      className="w-full bg-red-600 text-white px-4 py-2 rounded text-base hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={applying}
                      onClick={() => cancelDecided(ev, "attendant")}
                    >
                      {applying ? "処理中..." : "キャンセル（添乗員）"}
                    </button>
                  ) : (
                    <button
                      style={{ fontSize: "1.1rem", fontWeight: 600, padding: "10px 0" }}
                      className={
                        appliedAtt
                          ? "w-full bg-gray-300 text-gray-700 px-4 py-2 rounded text-base disabled:opacity-50 disabled:cursor-not-allowed"
                          : "w-full bg-emerald-600 text-white px-4 py-2 rounded text-base hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      }
                      disabled={applying}
                      onClick={() => (appliedAtt ? cancel(ev, "attendant") : apply(ev, "attendant"))}
                    >
                      {applying ? "処理中..." : appliedAtt ? "添乗員 応募取消" : "添乗員で応募"}
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  return (
    <>
      <div
        className="min-h-screen"
        style={{
          backgroundColor: "#f0fdf4",
          paddingBottom: "calc(80px + env(safe-area-inset-bottom))",
          marginBottom: 0,
        }}
      >
        <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg border border-green-100 p-4 sm:p-6">
          {/* ヘッダー（ログアウト追加） */}
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-xl font-bold">グリスロ予定調整アプリ</h1>
            <div className="flex items-center gap-3 flex-wrap">
              {userName && <span className="text-sm text-gray-600">ログイン中：{userName}</span>}
              <button
                onClick={handleLogout}
                className="px-3 py-1 rounded bg-red-500 text-white text-sm hover:bg-red-600"
              >
                ログアウト
              </button>
            </div>
          </div>

          {/* タブコンテンツ */}
          {activeTab === "calendar" && (
            <>
              <Calendar
                currentMonth={selectedDate.getMonth()}
                currentYear={selectedDate.getFullYear()}
                selectedDate={selectedDate}
                onMonthChange={(d) => {
                  const nd = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + d, 1)
                  setSelectedDate(nd)
                }}
                onDateSelect={setSelectedDate}
                events={events}
                decidedDates={memoizedDecidedDates}
                cancelledDates={memoizedCancelledDates}
                decidedMembersByDate={calendarDecidedMembersByDate}
                myAppliedEventIds={memoizedMyAppliedEventIds}
                compact={true}
              />

              <div className="mt-4">
                <h2 className="font-semibold mb-2">{toLocalYMD(selectedDate)} の募集</h2>
                {listOfSelected.length === 0 ? (
                  <p className="text-sm text-gray-500">この日には募集がありません。</p>
                ) : (
                  <ul className="space-y-2">
                    {listOfSelected.map((ev) => {
                      const c = counts[ev.id] || { driver: 0, attendant: 0 }
                      const dec = decided[ev.id] || { driver: [], attendant: [] }
                      const remainDriver =
                        ev.capacity_driver != null ? Math.max(0, ev.capacity_driver - c.driver) : null
                      const remainAtt =
                        ev.capacity_attendant != null ? Math.max(0, ev.capacity_attendant - c.attendant) : null

                      const appliedDriver = hasApplied(ev.id, "driver")
                      const appliedAtt = hasApplied(ev.id, "attendant")

                      // 同じイベントで既に別の役割に応募しているかチェック
                      const hasAppliedOtherKindDriver = appliedAtt // 添乗員に応募している場合、運転手は無効
                      const hasAppliedOtherKindAttendant = appliedDriver // 運転手に応募している場合、添乗員は無効

                      const hasDecidedDriver = dec.driver.length > 0
                      const hasDecidedAttendant = dec.attendant.length > 0
                      const isDecidedDriver = dec.driver.includes(userName)
                      const isDecidedAttendant = dec.attendant.includes(userName)

                      return (
                        <li key={ev.id} className="border rounded p-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {(() => {
                              // フリー運行・循環運行のアイコンを取得
                              let eventIcon = ev.icon || ""
                              if (ev.label && (ev.label.includes("フリー運行") || ev.label.includes("循環運行"))) {
                                eventIcon = "/icons/app-icon-180.png"
                              }
                              return eventIcon ? (
                                <img src={eventIcon || "/placeholder.svg"} alt="" className="w-6 h-6" />
                              ) : null
                            })()}
                            <div>
                              <div className="font-medium">{ev.label}</div>
                              <div className="text-xs text-gray-500">
                                {ev.start_time}〜{ev.end_time}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                運転手: {c.driver}人
                                {hasDecidedDriver && (
                                  <span className="text-blue-600 font-semibold">【確定: {dec.driver.join(", ")}】</span>
                                )}
                                {isDecidedDriver && (
                                  <span className="text-green-600 font-semibold ml-1">✓ あなたが確定済み</span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                添乗員: {c.attendant}人
                                {hasDecidedAttendant && (
                                  <span className="text-blue-600 font-semibold">
                                    【確定: {dec.attendant.join(", ")}】
                                  </span>
                                )}
                                {isDecidedAttendant && (
                                  <span className="text-green-600 font-semibold ml-1">✓ あなたが確定済み</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            {["運転手", "両方"].includes(userRolePref) &&
                              (isDecidedDriver ? (
                                <button
                                  className="px-3 py-1 rounded bg-red-600 text-white text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                  disabled={applying}
                                  onClick={() => cancelDecided(ev, "driver")}
                                >
                                  {applying ? "処理中..." : "キャンセル（運転手）"}
                                </button>
                              ) : appliedDriver ? (
                                <button
                                  className="px-3 py-1 rounded bg-gray-200 text-gray-700 text-sm hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                  disabled={applying}
                                  onClick={() => cancel(ev, "driver")}
                                >
                                  {applying ? "処理中..." : "応募取消（運転手）"}
                                </button>
                              ) : (
                                <button
                                  className="px-3 py-1 rounded bg-blue-600 text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                  disabled={applying || hasDecidedDriver || hasAppliedOtherKindDriver}
                                  onClick={() => apply(ev, "driver")}
                                  title={
                                    hasAppliedOtherKindDriver ? "このイベントには既に添乗員として応募しています" : ""
                                  }
                                >
                                  {applying ? "処理中..." : "運転手で応募"}
                                </button>
                              ))}
                            {["添乘員", "両方"].includes(userRolePref) &&
                              (isDecidedAttendant ? (
                                <button
                                  className="px-3 py-1 rounded bg-red-600 text-white text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                  disabled={applying}
                                  onClick={() => cancelDecided(ev, "attendant")}
                                >
                                  {applying ? "処理中..." : "キャンセル（添乗員）"}
                                </button>
                              ) : appliedAtt ? (
                                <button
                                  className="px-3 py-1 rounded bg-gray-200 text-gray-700 text-sm hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                  disabled={applying}
                                  onClick={() => cancel(ev, "attendant")}
                                >
                                  {applying ? "処理中..." : "応募取消（添乗員）"}
                                </button>
                              ) : (
                                <button
                                  className="px-3 py-1 rounded bg-emerald-600 text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                  disabled={applying || hasDecidedAttendant || hasAppliedOtherKindAttendant}
                                  onClick={() => apply(ev, "attendant")}
                                  title={
                                    hasAppliedOtherKindAttendant ? "このイベントには既に運転手として応募しています" : ""
                                  }
                                >
                                  {applying ? "処理中..." : "添乗員で応募"}
                                </button>
                              ))}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </>
          )}
          {activeTab === "apply" && renderApplyTab()}
          {activeTab === "notifications" && renderNotificationsTab()}
          {activeTab === "participation" && renderParticipationTab()}
          {activeTab === "mypage" && renderMypageTab()}
        </div>
      </div>

      {/* 固定タブバー */}
      <div
        id="main-tab-bar"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          width: "100%",
          minHeight: "72px",
          backgroundColor: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          borderTop: "1px solid #e5e7eb",
          boxShadow: "0 -6px 12px -6px rgba(0,0,0,0.12)",
          WebkitBoxShadow: "0 -4px 6px -1px rgba(0, 0, 0, 0.1), 0 -2px 4px -1px rgba(0, 0, 0, 0.06)",
          zIndex: 99999,
          display: "flex",
          WebkitDisplay: "flex",
          alignItems: "center",
          WebkitAlignItems: "center",
          visibility: "visible",
          opacity: 1,
          WebkitTransform: "translateZ(0)",
          transform: "translateZ(0)",
          willChange: "transform",
          WebkitBackfaceVisibility: "hidden",
          backfaceVisibility: "hidden",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div
          style={{
            maxWidth: "896px",
            margin: "0 auto",
            display: "grid",
            WebkitDisplay: "grid",
            gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr",
            WebkitGridTemplateColumns: "1fr 1fr 1fr 1fr 1fr",
            width: "100%",
            height: "100%",
            minHeight: "72px",
          }}
        >
          {/* カレンダータブ */}
          <button
            onClick={() => setActiveTab("calendar")}
            style={{
              display: "flex",
              WebkitDisplay: "flex",
              flexDirection: "column",
              WebkitFlexDirection: "column",
              alignItems: "center",
              WebkitAlignItems: "center",
              justifyContent: "center",
              WebkitJustifyContent: "center",
              marginBottom: "4px",
              padding: "12px 8px",
              backgroundColor: activeTab === "calendar" ? "#dbeafe" : "transparent",
              color: activeTab === "calendar" ? "#2563eb" : "#4b5563",
              fontWeight: activeTab === "calendar" ? "600" : "400",
              border: "none",
              cursor: "pointer",
              WebkitTransition: "all 0.2s",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              if (activeTab !== "calendar") {
                e.currentTarget.style.backgroundColor = "#f9fafb"
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== "calendar") {
                e.currentTarget.style.backgroundColor = "transparent"
              }
            }}
          >
            <svg style={{ width: "20px", height: "20px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span style={{ fontSize: "11px", fontWeight: "500" }}>カレンダー</span>
          </button>

          {/* 応募状況タブ */}
          <button
            onClick={() => setActiveTab("apply")}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "4px",
              padding: "12px 8px",
              backgroundColor: activeTab === "apply" ? "#dbeafe" : "transparent",
              color: activeTab === "apply" ? "#2563eb" : "#4b5563",
              fontWeight: activeTab === "apply" ? "600" : "400",
              border: "none",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            <svg style={{ width: "20px", height: "20px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 17v-6h6v6M9 21h6a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span style={{ fontSize: "11px", fontWeight: "500" }}>応募状況</span>
          </button>

          <button
            onClick={() => setActiveTab("participation")}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "4px",
              padding: "12px 8px",
              backgroundColor: activeTab === "participation" ? "#dbeafe" : "transparent",
              color: activeTab === "participation" ? "#2563eb" : "#4b5563",
              fontWeight: activeTab === "participation" ? "600" : "400",
              border: "none",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            <svg style={{ width: "20px", height: "20px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
              />
            </svg>
            <span style={{ fontSize: "11px", fontWeight: "500" }}>活動記録</span>
          </button>

          {/* 通知タブ */}
          <button
            onClick={() => setActiveTab("notifications")}
            style={{
              display: "flex",
              WebkitDisplay: "flex",
              flexDirection: "column",
              WebkitFlexDirection: "column",
              alignItems: "center",
              WebkitAlignItems: "center",
              justifyContent: "center",
              WebkitJustifyContent: "center",
              marginBottom: "4px",
              padding: "12px 8px",
              backgroundColor: activeTab === "notifications" ? "#dbeafe" : "transparent",
              color: activeTab === "notifications" ? "#2563eb" : "#4b5563",
              fontWeight: activeTab === "notifications" ? "600" : "400",
              border: "none",
              cursor: "pointer",
              WebkitTransition: "all 0.2s",
              transition: "all 0.2s",
              position: "relative",
            }}
            onMouseEnter={(e) => {
              if (activeTab !== "notifications") {
                e.currentTarget.style.backgroundColor = "#f9fafb"
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== "notifications") {
                e.currentTarget.style.backgroundColor = "transparent"
              }
            }}
          >
            <svg style={{ width: "20px", height: "20px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            <span style={{ fontSize: "11px", fontWeight: "500" }}>通知</span>
            {unreadCount > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: "4px",
                  right: "4px",
                  backgroundColor: "#ef4444",
                  color: "#ffffff",
                  fontSize: "9px",
                  borderRadius: "10px",
                  width: "18px",
                  height: "18px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "600",
                }}
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {/* マイページタブ */}
          <button
            onClick={() => setActiveTab("mypage")}
            style={{
              display: "flex",
              WebkitDisplay: "flex",
              flexDirection: "column",
              WebkitFlexDirection: "column",
              alignItems: "center",
              WebkitAlignItems: "center",
              justifyContent: "center",
              WebkitJustifyContent: "center",
              marginBottom: "4px",
              padding: "12px 8px",
              backgroundColor: activeTab === "mypage" ? "#dbeafe" : "transparent",
              color: activeTab === "mypage" ? "#2563eb" : "#4b5563",
              fontWeight: activeTab === "mypage" ? "600" : "400",
              border: "none",
              cursor: "pointer",
              WebkitTransition: "all 0.2s",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              if (activeTab !== "mypage") {
                e.currentTarget.style.backgroundColor = "#f9fafb"
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== "mypage") {
                e.currentTarget.style.backgroundColor = "transparent"
              }
            }}
          >
            <svg style={{ width: "20px", height: "20px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            <span style={{ fontSize: "11px", fontWeight: "500" }}>マイページ</span>
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

      {/* メモ編集ダイアログ */}
      {editingNote && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setEditingNote(null)}
        >
          <div
            className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-semibold mb-5 text-gray-800" style={{ fontSize: "20px" }}>定型文を追加</h3>
            
            <div className="space-y-3 mb-5">
              <div className="text-base font-semibold text-gray-700 mb-3" style={{ fontSize: "17px" }}>定型文を選んでください</div>
              {templateOptions.map((template) => (
                <button
                  key={template.key}
                  onClick={() => {
                    setEditingNote({
                      ...editingNote,
                      template_key: editingNote.template_key === template.key ? null : template.key,
                    })
                  }}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    editingNote.template_key === template.key
                      ? "border-blue-500 bg-blue-50 text-blue-900"
                      : "border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50"
                  }`}
                  style={{ fontSize: "17px", minHeight: "60px", lineHeight: "1.5" }}
                >
                  {template.text}
                </button>
              ))}
            </div>

            <div className="mb-5">
              <label className="block text-base font-semibold text-gray-700 mb-3" style={{ fontSize: "17px" }}>
                ＋一言メモ（任意）
              </label>
              <textarea
                value={editingNote.free_text || ""}
                onChange={(e) => {
                  setEditingNote({ ...editingNote, free_text: e.target.value })
                }}
                placeholder="自由にメモを入力できます"
                className="w-full p-4 border-2 border-gray-300 rounded-lg resize-none"
                rows={4}
                style={{ fontSize: "17px", lineHeight: "1.6" }}
                maxLength={200}
              />
              <div className="text-sm text-gray-500 mt-2 text-right" style={{ fontSize: "14px" }}>
                {(editingNote.free_text || "").length}/200文字
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setEditingNote(null)}
                className="flex-1 px-5 py-4 rounded-lg border-2 border-gray-300 bg-white text-gray-700 hover:bg-gray-50 font-semibold"
                style={{ fontSize: "18px", minHeight: "56px" }}
              >
                キャンセル
              </button>
              <button
                onClick={() => {
                  saveInteractionNote(
                    editingNote.event_id,
                    editingNote.template_key,
                    editingNote.free_text
                  )
                }}
                className="flex-1 px-5 py-4 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-semibold"
                style={{ fontSize: "18px", minHeight: "56px" }}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
