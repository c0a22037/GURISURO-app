// src/components/Calendar.js
import React from "react";

// フリー運行・循環運行のアイコンを取得するヘルパー関数
const getEventIcon = (label, icon) => {
  if (!label) return icon || "";
  
  // フリー運行または循環運行の場合、専用アイコンを返す
  if (label.includes("フリー運行") || label.includes("循環運行")) {
    return "/icons/app-icon-180.png";
  }
  
  // それ以外の場合は既存のiconを返す
  return icon || "";
};

// 時間を分に変換（例: "14:30" -> 870）
const timeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
};

// 分を時間文字列に変換（例: 870 -> "14:30"）
const minutesToTime = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

// 週表示コンポーネント（Googleカレンダー風）
const WeekView = ({
  selectedDate,
  currentMonth,
  currentYear,
  events,
  eventsByDate,
  decidedDates,
  cancelledDates,
  decidedMembersByDate,
  myAppliedEventIds,
  onDateSelect,
  todayDate,
  onSwipeTouchStart,
  onSwipeTouchMove,
  onSwipeTouchEnd,
  getEventIcon
}) => {
  // 画面幅に応じて時間軸の幅を調整（スマホでは小さく、デスクトップでは大きく）
  const [timeAxisWidth, setTimeAxisWidth] = React.useState(() => {
    if (typeof window === 'undefined') return '70px';
    return window.innerWidth < 640 ? '50px' : '70px';
  });

  React.useEffect(() => {
    const updateWidth = () => {
      setTimeAxisWidth(window.innerWidth < 640 ? '50px' : '70px');
    };
    window.addEventListener('resize', updateWidth);
    updateWidth();
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // 週の開始日（日曜日）を計算
  const weekStart = new Date(selectedDate);
  const dayOfWeek = weekStart.getDay();
  weekStart.setDate(weekStart.getDate() - dayOfWeek);
  weekStart.setHours(0, 0, 0, 0);

  // 週の7日間を生成
  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(weekStart);
    dayDate.setDate(dayDate.getDate() + i);
    weekDays.push(dayDate);
  }

  // 時間軸（6:00 〜 22:00、30分間隔）
  const timeSlots = [];
  for (let hour = 6; hour <= 22; hour++) {
    timeSlots.push({ hour, minutes: 0 });
    if (hour < 22) {
      timeSlots.push({ hour, minutes: 30 });
    }
  }

  // イベントを時間帯で配置する関数
  const getEventPosition = (event) => {
    const startMinutes = timeToMinutes(event.start_time);
    const endMinutes = timeToMinutes(event.end_time) || startMinutes + 60; // 終了時間がない場合は1時間として扱う
    
    // 6:00を基準（0分）とした相対位置
    const baseMinutes = 6 * 60; // 6:00 = 360分
    const topMinutes = Math.max(0, startMinutes - baseMinutes);
    const durationMinutes = Math.max(30, endMinutes - startMinutes); // 最小30分
    
    // 1時間 = 60px として計算（30分 = 30px）
    const topPercent = (topMinutes / (16 * 60)) * 100; // 6:00-22:00 = 16時間
    const heightPercent = (durationMinutes / (16 * 60)) * 100;
    
    return { topPercent, heightPercent, startMinutes, endMinutes };
  };

  const toKey = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const isToday = (date) => {
    return (
      date.getFullYear() === todayDate.getFullYear() &&
      date.getMonth() === todayDate.getMonth() &&
      date.getDate() === todayDate.getDate()
    );
  };

  // グリッドの列定義（時間軸 + 7日）
  const gridColsStyle = { gridTemplateColumns: `${timeAxisWidth} repeat(7, minmax(0, 1fr))` };

  return (
    <div 
      className="flex flex-col w-full"
      style={{ 
        minHeight: '600px', 
        width: '100%',
        maxWidth: '100%',
        overflowX: 'hidden'
      }}
      onTouchStart={onSwipeTouchStart}
      onTouchMove={onSwipeTouchMove}
      onTouchEnd={onSwipeTouchEnd}
    >
      {/* 曜日ヘッダー - より大きく見やすく */}
      <div 
        className="grid border-b-2 border-gray-400 bg-gradient-to-b from-gray-50 to-gray-100 sticky top-0 z-20" 
        style={{ ...gridColsStyle, width: '100%', maxWidth: '100%' }}
      >
        <div className="border-r-2 border-gray-400 flex-shrink-0"></div>
        {weekDays.map((day, idx) => {
          const key = toKey(day);
          const isTodayDay = isToday(day);
          const dayColor = idx === 0 ? "text-red-600" : idx === 6 ? "text-blue-600" : "text-gray-800";
          return (
            <div 
              key={key}
              className={`text-center py-2 sm:py-3 px-0.5 sm:px-1 border-r-2 border-gray-300 cursor-pointer transition-colors flex-shrink-0 min-w-0 ${isTodayDay ? 'bg-blue-200 font-bold' : 'hover:bg-gray-200'}`}
              onClick={() => onDateSelect?.(day)}
              style={{ overflow: 'hidden' }}
            >
              <div className="text-xs sm:text-sm font-semibold text-gray-600 mb-0.5 sm:mb-1 truncate">
                {["日","月","火","水","木","金","土"][day.getDay()]}
              </div>
              <div className={`text-lg sm:text-2xl font-extrabold ${dayColor} mb-0.5 sm:mb-1 truncate`}>
                {day.getDate()}
              </div>
              <div className="text-[10px] sm:text-xs text-gray-500 font-medium truncate">
                {day.getMonth() + 1}月
              </div>
            </div>
          );
        })}
      </div>

      {/* 時間軸とイベント表示 */}
      <div 
        className="flex-1 overflow-y-auto" 
        style={{ 
          maxHeight: 'calc(100vh - 250px)',
          overflowX: 'hidden',
          width: '100%',
          maxWidth: '100%'
        }}
      >
        <div 
          className="grid relative" 
          style={{ 
            ...gridColsStyle, 
            minHeight: '960px',
            width: '100%',
            maxWidth: '100%'
          }}
        >
          {/* 時間軸 - より大きく見やすく */}
          <div 
            className="border-r-2 border-gray-300 bg-gray-50 sticky left-0 z-10 flex-shrink-0"
            style={{ width: timeAxisWidth }}
          >
            {timeSlots.map((slot, idx) => (
              <div 
                key={`time-${idx}`}
                className={`border-b border-gray-200 text-xs sm:text-sm font-medium text-gray-700 pr-1 sm:pr-2 text-right ${slot.minutes === 0 ? 'border-gray-300' : ''}`}
                style={{ height: '30px', lineHeight: '30px', overflow: 'hidden' }}
              >
                {slot.minutes === 0 ? `${slot.hour}:00` : ''}
              </div>
            ))}
          </div>

          {/* 各日の列 - より大きく */}
          {weekDays.map((day, dayIdx) => {
            const key = toKey(day);
            const dayEvents = eventsByDate[key] || [];
            const isTodayDay = isToday(day);
            const isDecided = decidedDates.has(key);
            const isCancelled = cancelledDates.has(key);
            
            return (
              <div 
                key={key}
                className={`relative border-r-2 border-gray-200 cursor-pointer flex-shrink-0 min-w-0 ${isTodayDay ? 'bg-blue-50' : 'bg-white hover:bg-gray-50'}`}
                onClick={() => onDateSelect?.(day)}
                style={{ overflow: 'hidden' }}
              >
                {/* 時間グリッド */}
                {timeSlots.map((slot, slotIdx) => (
                  <div 
                    key={`grid-${dayIdx}-${slotIdx}`}
                    className={`border-b ${slot.minutes === 0 ? 'border-gray-300' : 'border-gray-100'}`}
                    style={{ height: '30px' }}
                  />
                ))}
                
                {/* イベント - より大きく見やすく */}
                {dayEvents.map((event) => {
                  const pos = getEventPosition(event);
                  const eventIcon = getEventIcon(event.label, event.icon);
                  const isDecidedEvent = decidedMembersByDate?._byEventId?.[event.id];
                  const hasDriver = isDecidedEvent?.driver?.length > 0;
                  const hasAttendant = isDecidedEvent?.attendant?.length > 0;
                  const isFullyDecided = hasDriver && hasAttendant;
                  
                  return (
                    <div
                      key={event.id}
                      className={`absolute left-0.5 right-0.5 sm:left-1 sm:right-1 rounded-md px-1.5 sm:px-2.5 py-1 sm:py-1.5 text-xs cursor-pointer shadow-md z-10 transition-all hover:shadow-lg overflow-hidden ${
                        isFullyDecided ? 'bg-emerald-500 text-white border-2 border-emerald-600' :
                        isDecided || isCancelled ? 'bg-rose-200 border-2 border-rose-400' :
                        'bg-amber-100 border-2 border-amber-400 text-gray-800'
                      }`}
                      style={{
                        top: `${pos.topPercent}%`,
                        height: `${Math.max(pos.heightPercent, 2)}%`,
                        minHeight: '28px',
                        maxWidth: '100%'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDateSelect?.(day);
                      }}
                      title={`${event.label || 'イベント'} ${event.start_time || ''}〜${event.end_time || ''}`}
                    >
                      <div className="flex items-center gap-1 sm:gap-1.5 truncate mb-0.5">
                        {eventIcon && (
                          <img 
                            src={eventIcon} 
                            alt="" 
                            className="w-4 h-4 sm:w-5 sm:h-5 object-contain flex-shrink-0"
                          />
                        )}
                        <span className="font-bold text-xs sm:text-sm truncate">{event.label || 'イベント'}</span>
                      </div>
                      {(event.start_time || event.end_time) && (
                        <div className={`text-[10px] sm:text-[11px] font-medium truncate ${isFullyDecided ? 'text-white' : 'text-gray-600'}`}>
                          {event.start_time || ''}{event.end_time ? `〜${event.end_time}` : ''}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const monthNames = [
  "1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"
];

// YYYY-MM-DD
const toKey = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export default function Calendar({
  currentMonth,
  currentYear,
  selectedDate,
  onMonthChange,
  onDateSelect,
  events = [],
  availability = {},
  assignedSchedule = {},
  unfilledDates = new Set(),
  eventTagsByDate = {},
  decidedDates = new Set(), // 確定済みの日付のSet (YYYY-MM-DD形式) 一般ユーザー: 自分が確定済みの日付、管理者: すべての確定済み日付
  decidedMembersByDate = {}, // 管理者用: { "YYYY-MM-DD": { driver: string[], attendant: string[] } }
  cancelledDates = new Set(), // キャンセルされた日付のSet (YYYY-MM-DD形式)
  myAppliedEventIds = new Set(), // ユーザー側用: 自分が応募しているイベントIDのSet（管理者側では空のSet）
  compact = false, // モバイルで見やすくするための簡易表示
  participationRolesByDate = {}, // 参加履歴カレンダー用: { "YYYY-MM-DD": { driver: boolean, attendant: boolean } }
}) {
  // 追加: 月/週 表示トグル
  const [viewMode, setViewMode] = React.useState("month");

  // 画面幅による自動コンパクト判定（初期）
  const [isCompact, setIsCompact] = React.useState(() => {
    if (typeof window === "undefined") return !!compact;
    try { return compact || window.matchMedia('(max-width: 420px)').matches; } catch { return !!compact; }
  });
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia('(max-width: 420px)');
    const handler = () => setIsCompact(compact || mq.matches);
    try { mq.addEventListener('change', handler); } catch { mq.addListener(handler); }
    handler();
    return () => {
      try { mq.removeEventListener('change', handler); } catch { mq.removeListener(handler); }
    };
  }, [compact]);
  // events を日付キーにまとめる
  const eventsByDate = React.useMemo(() => {
    const map = {};
    const list = Array.isArray(events) ? events : [];
    for (const ev of list) {
      if (!ev?.date) continue;
      (map[ev.date] ||= []).push(ev);
    }
    return map;
  }, [events]);

  // 今日の日付をメモ化（1日の間は同じ値を返す）
  const todayDate = React.useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, [currentYear, currentMonth]); // 月が変わるたびに更新

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay(); // 0:日〜6:土

  const isToday = (date) => {
    const t = new Date();
    return (
      date.getFullYear() === t.getFullYear() &&
      date.getMonth() === t.getMonth() &&
      date.getDate() === t.getDate()
    );
  };

  const renderBadges = (dayEvents, tags) => {
    const maxBadges = isCompact ? 1 : 4;

    // コンパクト時はイベント優先、タグは省略
    const eventBadges = (dayEvents || []).map((ev) =>
      (() => {
        const eventIcon = getEventIcon(ev?.label, ev?.icon);
        return eventIcon
          ? { type: "icon", icon: eventIcon, label: ev?.label || "", start: ev?.start_time }
          : { type: "text", label: ev?.label || "" };
      })()
    );

    const tagBadges = isCompact ? [] : (tags || []).map((t) => ({
      type: "text",
      label: t?.label || t?.key || "",
    }));

    const allBadges = [...eventBadges, ...tagBadges];
    const visible = allBadges.slice(0, maxBadges);
    const overflow = Math.max(allBadges.length - maxBadges, 0);

    return (
      <div className="mt-1.5 flex flex-wrap items-center" style={{ marginTop: isCompact ? '4px' : '6px', display: 'flex', WebkitDisplay: 'flex', flexWrap: 'wrap', WebkitFlexWrap: 'wrap', alignItems: 'center', WebkitAlignItems: 'center' }}>
        {visible.map((b, idx) => {
          if (b.type === "icon" && b.icon) {
            return (
              <img
                key={`b-${idx}`}
                src={b.icon}
                alt={b.label || "event"}
                title={b.label ? `${b.label}${b.start ? ` ${b.start}` : ""}` : ""}
                className={"object-contain rounded-sm shadow-sm " + (isCompact ? "h-5 w-5" : "h-6 w-6")}
                style={{ marginRight: isCompact ? '4px' : '6px', marginBottom: '4px', border: '1px solid rgba(0,0,0,0.1)' }}
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            );
          }
          return (
            <span
              key={`b-${idx}`}
              className={"rounded-md bg-white/95 font-medium border border-gray-300 shadow-sm " + (isCompact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]")}
              style={{ marginRight: '4px', marginBottom: '4px' }}
              title={b.label}
            >
              {isCompact ? (b.label.startsWith("フリー運行") ? "フリー" : b.label.slice(0, 4)) : b.label.slice(0, 8)}
            </span>
          );
        })}
        {overflow > 0 && (
          <span
            className={"rounded-md font-medium border border-amber-300 shadow-sm " + (isCompact ? "px-1.5 py-0.5 text-[10px] bg-amber-100/90" : "px-2 py-0.5 text-[11px] bg-amber-100/90")}
            style={{ marginRight: '4px', marginBottom: '4px' }}
            title={`他 ${overflow} 件`}
          >
            +{overflow}
          </span>
        )}
      </div>
    );
  };

  const renderDayCell = (i) => {
    // iがnullの場合は空セルを返す（週表示で月をまたぐ場合）
    if (i === null) {
      return <div key={`empty-week-${Math.random()}`} className="border rounded-lg min-h-[80px] sm:min-h-[88px] bg-gray-50"></div>;
    }
    
    const date = new Date(currentYear, currentMonth, i);
    const key = toKey(date);
    const isSel =
      selectedDate && selectedDate.toDateString() === date.toDateString();

    const userAvail = availability[key];
    const assigned = assignedSchedule?.[key]?.length > 0;
    const unfilled = unfilledDates.has(key);
    const tags = eventTagsByDate?.[key] || [];
    const hasTags = tags.length > 0;
    const dayEvents = eventsByDate[key] || [];
    const isDecided = decidedDates.has(key);
    const isCancelled = cancelledDates.has(key);
    const decidedMembers = decidedMembersByDate?.[key] || null; // 管理者用: 確定済みメンバー情報（日付単位のまとめ）
    const decidedMembersByEventId = decidedMembersByDate?._byEventId || {}; // 管理者用: イベントIDごとの確定済みメンバー情報
    const participationRoles = participationRolesByDate?.[key]; // 参加履歴カレンダー用: その日付での参加役割
    const isDriver = participationRoles?.driver;
    const isAttendant = participationRoles?.attendant;

    // 1週間前以内かどうかを判定（イベントがある場合のみ）
    const eventDate = new Date(date);
    eventDate.setHours(0, 0, 0, 0);
    const daysDiff = Math.floor((eventDate - todayDate) / (1000 * 60 * 60 * 24));
    const isWithinOneWeek = daysDiff >= 0 && daysDiff <= 7;
    
    // 管理者用/ユーザー用: 運転手と添乗員が確定済みか、定員不足かチェック
    const isAdmin = Object.keys(decidedMembersByEventId).length > 0; // 管理者かどうかの判定（decidedMembersByEventIdがある場合）
    let allConfirmed = false; // 運転手と添乗員が確定済み
    let insufficientCapacity = false; // 1週間以内で定員不足
    
    if (dayEvents.length > 0) {
      if (isAdmin) {
        // 管理者用: 全てのイベントをチェックして、確定済み/未確定を分類
        let hasConfirmed = false;
        let hasUnconfirmed = false;
        
        for (const ev of dayEvents) {
          const evDecided = decidedMembersByEventId[ev.id] || null;
          // 確定済みかどうかを確認（evDecidedが存在し、driverまたはattendantが存在する）
          const isEventDecided = evDecided && (evDecided.driver?.length > 0 || evDecided.attendant?.length > 0);
          
          if (isEventDecided) {
            hasConfirmed = true;
          } else {
            hasUnconfirmed = true;
          }
        }
        
        // 確定済みのイベントがある場合は緑色にする（確定済みが優先）
        if (hasConfirmed) {
          allConfirmed = true;
          insufficientCapacity = false; // 確定済みがある場合は赤色にしない
        } else if (hasUnconfirmed && isWithinOneWeek) {
          // 未確定のイベントがあり、1週間以内の場合のみ赤色
          insufficientCapacity = true;
        }
      } else {
        // ユーザー用: 自分の応募があるイベントで、定員が埋まっているか、1週間以内で定員が埋まっていないかをチェック
        let hasInsufficientCapacity = false;
        let hasAllCapacityFilled = false; // 自分の応募があるイベントで定員が埋まっている
        
        for (const ev of dayEvents) {
          // 自分の応募があるイベントのみチェック
          const isMyEvent = myAppliedEventIds && myAppliedEventIds.size > 0 && myAppliedEventIds.has(ev.id);
          if (!isMyEvent) continue;
          
          const evDecided = decidedMembersByEventId[ev.id] || null;
          const capacityDriver = ev.capacity_driver ?? 1;
          const capacityAttendant = ev.capacity_attendant ?? 1;
          const confirmedDriverCount = evDecided?.driver?.length || 0;
          const confirmedAttendantCount = evDecided?.attendant?.length || 0;
          
          // 定員が埋まっているかチェック（運転手と添乗員が揃っている）
          const isCapacityFilled = confirmedDriverCount >= capacityDriver && confirmedAttendantCount >= capacityAttendant;
          
          if (isCapacityFilled) {
            // 定員が埋まっている場合は緑色にする
            hasAllCapacityFilled = true;
          } else if (isWithinOneWeek) {
            // 1週間以内で定員が埋まっていない場合は赤色にする
            hasInsufficientCapacity = true;
          }
        }
        
        // 定員が埋まっている場合は緑色を優先
        if (hasAllCapacityFilled) {
          allConfirmed = true;
          insufficientCapacity = false; // 定員が埋まっている場合は赤色にしない
        } else if (hasInsufficientCapacity) {
          insufficientCapacity = true;
        }
      }
    }
    
    // ユーザー側でも管理者側でも、確定済み（isDecided）の場合は緑色（自分の応募が確定済み）
    if (isDecided) {
      allConfirmed = true;
      insufficientCapacity = false; // 確定済みがある場合は赤色にしない
    }

    // 背景色の優先度：
    // 1. キャンセル（定員が埋まっていない場合のみ）
    // 2. 1週間以内で定員不足（赤）
    // 3. 確定済みまたは定員が埋まった（緑）
    // 4. イベントあり（オレンジ）
    // 注意: キャンセルがあっても定員が埋まった（allConfirmed）場合は緑色を優先
    let base =
      "relative border cursor-pointer select-none transition-all duration-200 min-h-[80px] sm:min-h-[88px] p-2.5 rounded-lg shadow-sm";
    if (allConfirmed || isDecided) {
      // 確定済みまたは定員が埋まった場合は鮮やかなグリーン
      base += " bg-emerald-500 hover:bg-emerald-600 border-emerald-600 text-white shadow-md";
    } else if (isCancelled) {
      // キャンセルがあり、定員が埋まっていない場合
      base += " bg-rose-200 hover:bg-rose-300 border-rose-400 shadow-md";
    } else if (insufficientCapacity) {
      // 1週間以内で定員が埋まっていない場合
      base += " bg-rose-100 hover:bg-rose-200 border-rose-300";
    } else if (dayEvents.length > 0 || hasTags) {
      // イベントがある場合
      base += " bg-amber-50 hover:bg-amber-100 border-amber-200 shadow-sm";
    } else if (unfilled) base += " bg-red-50 hover:bg-red-100 border-red-200";
    else if (assigned) base += " bg-blue-50 hover:bg-blue-100 border-blue-200";
    else if (userAvail) base += " bg-green-50 hover:bg-green-100 border-green-200";
    else base += " bg-white hover:bg-green-50/50 border-gray-200";

    // 選択中はリング・今日アウトライン（より目立つように）
    if (isSel) base += " ring-3 ring-emerald-400 ring-offset-2 shadow-lg transform scale-105";

    // 土日色（確定済みの場合は白色テキスト）
    const wd = date.getDay();
    const isConfirmedDay = allConfirmed || isDecided;
    const dayColor = isConfirmedDay 
      ? "text-white" 
      : (wd === 0 ? "text-red-600" : wd === 6 ? "text-blue-600" : "text-gray-800");
    
    // 今日の日付には特別なバッジ
    const isTodayDate = isToday(date);

    return (
      <div
        key={`day-${i}`}
        role="button"
        tabIndex={0}
        aria-label={`${currentYear}年${currentMonth + 1}月${i}日`}
        aria-pressed={isSel ? "true" : "false"}
        className={base}
        style={{
          WebkitTransition: 'all 0.2s ease',
          transition: 'all 0.2s ease',
          WebkitTransform: 'translateZ(0)',
          transform: 'translateZ(0)'
        }}
        onTouchStart={(e) => {
          e.currentTarget.style.WebkitTransform = 'scale(0.97)';
          e.currentTarget.style.transform = 'scale(0.97)';
        }}
        onTouchEnd={(e) => {
          e.currentTarget.style.WebkitTransform = 'scale(1)';
          e.currentTarget.style.transform = 'scale(1)';
        }}
        onClick={() => onDateSelect?.(date)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onDateSelect?.(date);
        }}
      >
        {/* 上段：日付 */}
        <div className="flex items-start justify-between mb-1 relative">
          <span className={`text-[17px] sm:text-[18px] font-extrabold ${dayColor}`}>
            {i}
          </span>
          {/* 参加役割アイコン（参加履歴カレンダー用）- 右上に配置 */}
          {isDecided && (isDriver || isAttendant) && (
            <div className="absolute top-0 right-0 flex items-center gap-0.5" style={{ lineHeight: '1' }}>
              {isDriver && (
                <span className="text-[10px] sm:text-xs" title="運転手で参加" aria-label="運転手で参加" style={{ display: 'inline-block' }}>
                  🚗
                </span>
              )}
              {isAttendant && (
                <span className="text-[10px] sm:text-xs" title="添乗員で参加" aria-label="添乗員で参加" style={{ display: 'inline-block' }}>
                  🗣️
                </span>
              )}
            </div>
          )}
          {/* 右上に小さなイベントマーク（コンパクト時のみ、アイコンがない場合のみ表示） */}
          {isCompact && (dayEvents.length > 0 || hasTags) && !(isDecided && (isDriver || isAttendant)) && (
            <span
              aria-label="イベントあり"
              title="イベントあり"
              className="inline-block rounded-full bg-amber-500"
              style={{ width: '6px', height: '6px', marginTop: '2px' }}
            />
          )}
        </div>

        {/* コンパクト時: アイコンのみを1つ表示（なければマークのみ）。通常時: バッジ表示 */}
        {isCompact ? (
          (() => {
            const iconEvents = (dayEvents || [])
              .map(ev => {
                const eventIcon = getEventIcon(ev?.label, ev?.icon);
                return eventIcon ? { ...ev, icon: eventIcon } : null;
              })
              .filter(ev => ev !== null);
            if (iconEvents.length > 0) {
              const first = iconEvents[0];
              const overflow = Math.max(iconEvents.length - 1, 0);
              return (
                <div className="mt-1.5 flex items-center" style={{ gap: '4px' }}>
                  <img
                    src={first.icon}
                    alt={first.label || "event"}
                    title={first.label || ""}
                    className="h-5 w-5 object-contain rounded-sm shadow-sm"
                    style={{ border: '1px solid rgba(0,0,0,0.1)' }}
                    loading="lazy"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                  {overflow > 0 && (
                    <span className="text-[10px] px-1 py-0.5 rounded bg-amber-100/90 border border-amber-300">
                      +{overflow}
                    </span>
                  )}
                </div>
              );
            }
            // アイコンがない場合はマークのみ
            return null;
          })()
        ) : (
          (dayEvents.length > 0 || hasTags) && renderBadges(dayEvents, tags)
        )}
      </div>
    );
  };

  // 空白 + 当月日セル
  const cells = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    cells.push(
      <div
        key={`empty-${i}`}
        className="border border-gray-100 bg-green-50/30 min-h-[72px] sm:min-h-[80px] rounded-lg"
        aria-hidden="true"
      />
    );
  }
  for (let i = 1; i <= daysInMonth; i++) {
    cells.push(renderDayCell(i));
  }

  // カレンダーグリッド作成
  const totalDays = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    totalDays.push(null); // 空白セル
  }
  for (let i = 1; i <= daysInMonth; i++) {
    totalDays.push(i);
  }
  // 週移動の関数
  const handleWeekChange = (delta) => {
    if (!selectedDate) return;
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + (delta * 7));
    onDateSelect?.(newDate);
    // 月が変わった場合は親に通知
    if (newDate.getMonth() !== currentMonth || newDate.getFullYear() !== currentYear) {
      onMonthChange?.(newDate.getMonth() - currentMonth);
    }
  };

  // 横スワイプ処理（スクロール可能なコンテナとの競合を避けるため、カレンダーグリッド部分のみに適用）
  const minSwipeDistance = 50;
  const swipeTouchStart = React.useRef(null);
  const swipeTouchEnd = React.useRef(null);
  const swipeTouchStartY = React.useRef(null);
  const swipeTouchEndY = React.useRef(null);
  
  const onSwipeTouchStart = (e) => {
    swipeTouchStart.current = e.touches[0].clientX;
    swipeTouchEnd.current = null;
    swipeTouchStartY.current = e.touches[0].clientY;
    swipeTouchEndY.current = null;
  };
  const onSwipeTouchMove = (e) => {
    swipeTouchEnd.current = e.touches[0].clientX;
    swipeTouchEndY.current = e.touches[0].clientY;
  };
  const onSwipeTouchEnd = () => {
    if (!swipeTouchStart.current || !swipeTouchEnd.current) return;
    
    const deltaX = swipeTouchStart.current - swipeTouchEnd.current;
    const deltaY = swipeTouchStartY.current && swipeTouchEndY.current 
      ? Math.abs(swipeTouchStartY.current - swipeTouchEndY.current) 
      : 0;
    
    // 垂直方向のスクロールが主な場合は横スワイプを無効化
    if (deltaY > Math.abs(deltaX)) return;
    
    const isLeftSwipe = deltaX > minSwipeDistance;
    const isRightSwipe = deltaX < -minSwipeDistance;
    
    if (isLeftSwipe) {
      // 左スワイプ（次の月/週へ）
      if (viewMode === "week") {
        handleWeekChange(1);
      } else {
        onMonthChange?.(1);
      }
    }
    if (isRightSwipe) {
      // 右スワイプ（前の月/週へ）
      if (viewMode === "week") {
        handleWeekChange(-1);
      } else {
        onMonthChange?.(-1);
      }
    }
    
    // リセット
    swipeTouchStart.current = null;
    swipeTouchEnd.current = null;
    swipeTouchStartY.current = null;
    swipeTouchEndY.current = null;
  };

  // weekMode時、選択中日が含まれる週だけ抜き出す（月をまたぐ場合も対応）
  let visibleCells = [];
  if (viewMode === "week" && selectedDate) {
    // 選択された日の週の開始日（日曜日）を計算
    const weekStart = new Date(selectedDate);
    const dayOfWeek = weekStart.getDay();
    weekStart.setDate(weekStart.getDate() - dayOfWeek);
    weekStart.setHours(0, 0, 0, 0);
    
    // 週の7日間を生成（月をまたぐ場合も含む）
    visibleCells = [];
    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(weekStart);
      dayDate.setDate(dayDate.getDate() + i);
      
      // 現在表示中の月と同じ月かどうかで判定
      if (dayDate.getMonth() === currentMonth && dayDate.getFullYear() === currentYear) {
        visibleCells.push(dayDate.getDate());
      } else {
        // 別の月の日付は null として扱う（表示は空セル）
        visibleCells.push(null);
      }
    }
  } else {
    visibleCells = totalDays;
  }

  // 週表示の場合は全幅、月表示の場合は通常幅
  const containerClass = viewMode === "week" 
    ? "mb-0 w-full bg-white" 
    : "mb-0 w-full bg-white";

  return (
    <div 
      className={containerClass}
      style={{ 
        boxShadow: 'none', 
        border: 'none', 
        borderRadius: 0, 
        maxWidth: '100%',
        margin: 0,
        width: '100%',
        overflowX: 'hidden',
        boxSizing: 'border-box'
      }}
    >
      {/* ヘッダー（デカめ・押しやすい） */}
      <div className="flex items-center justify-between px-0 py-2 border-b border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 sticky top-0 z-10" style={{margin:0}}>
        <button
          className="p-2 sm:p-2.5 rounded-lg hover:bg-gray-100"
          style={{
            WebkitTransition: 'all 0.15s ease',
            transition: 'all 0.15s ease',
            WebkitTransform: 'translateZ(0)',
            transform: 'translateZ(0)'
          }}
          onClick={() => {
            if (viewMode === "week") {
              handleWeekChange(-1);
            } else {
              onMonthChange?.(-1);
            }
          }}
          onTouchStart={(e) => {
            e.currentTarget.style.WebkitTransform = 'scale(0.98) translateZ(0)';
            e.currentTarget.style.transform = 'scale(0.98) translateZ(0)';
          }}
          onTouchEnd={(e) => {
            e.currentTarget.style.WebkitTransform = 'scale(1) translateZ(0)';
            e.currentTarget.style.transform = 'scale(1) translateZ(0)';
          }}
          aria-label="前の月へ"
        >
          <svg className="w-6 h-6 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
          </svg>
        </button>

        <h2 className="text-lg sm:text-xl font-extrabold tracking-wide text-gray-800">
          {viewMode === "week" && selectedDate ? (() => {
            // 週表示の場合は週の範囲を表示
            const weekStart = new Date(selectedDate);
            const dayOfWeek = weekStart.getDay();
            weekStart.setDate(weekStart.getDate() - dayOfWeek);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            
            // 同じ月の場合は "X月 Y日〜Z日"
            // 月をまたぐ場合は "X月 Y日〜Z月 W日"
            if (weekStart.getMonth() === weekEnd.getMonth()) {
              return `${weekStart.getFullYear()}年 ${weekStart.getMonth() + 1}月 ${weekStart.getDate()}日〜${weekEnd.getDate()}日`;
            } else {
              return `${weekStart.getFullYear()}年 ${weekStart.getMonth() + 1}月 ${weekStart.getDate()}日〜${weekEnd.getMonth() + 1}月 ${weekEnd.getDate()}日`;
            }
          })() : `${currentYear}年 ${monthNames[currentMonth]}`}
        </h2>

        <button
          className="p-2 sm:p-2.5 rounded-lg hover:bg-gray-100"
          style={{
            WebkitTransition: 'all 0.15s ease',
            transition: 'all 0.15s ease',
            WebkitTransform: 'translateZ(0)',
            transform: 'translateZ(0)'
          }}
          onClick={() => {
            if (viewMode === "week") {
              handleWeekChange(1);
            } else {
              onMonthChange?.(1);
            }
          }}
          onTouchStart={(e) => {
            e.currentTarget.style.WebkitTransform = 'scale(0.98) translateZ(0)';
            e.currentTarget.style.transform = 'scale(0.98) translateZ(0)';
          }}
          onTouchEnd={(e) => {
            e.currentTarget.style.WebkitTransform = 'scale(1) translateZ(0)';
            e.currentTarget.style.transform = 'scale(1) translateZ(0)';
          }}
          aria-label="次の月へ"
        >
          <svg className="w-6 h-6 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
          </svg>
        </button>
        {/* 右端に表示切替 - より目立つように */}
        <div className="ml-2 sm:ml-3 flex gap-1 sm:gap-2">
          <button 
            onClick={()=>setViewMode("month")} 
            style={{
              fontWeight: viewMode==="month"?'bold':'normal',
              background: viewMode==="month"?'#e0ffe9':'transparent',
              border: viewMode==="month"?'2px solid #10b981':'1px solid #d1d5db'
            }} 
            className="px-2 sm:px-3 py-1 rounded text-sm sm:text-base hover:bg-green-50 transition-colors"
            title="月表示"
          >
            月
          </button>
          <button 
            onClick={()=>setViewMode("week")}  
            style={{
              fontWeight: viewMode==="week"?'bold':'normal',
              background: viewMode==="week"?'#e0ffe9':'transparent',
              border: viewMode==="week"?'2px solid #10b981':'1px solid #d1d5db'
            }} 
            className="px-2 sm:px-3 py-1 rounded text-sm sm:text-base hover:bg-green-50 transition-colors"
            title="週表示（時間軸付き）"
          >
            週
          </button>
        </div>
      </div>

      {/* 週表示の場合は時間軸付きのレイアウト、月表示の場合は通常レイアウト */}
      {viewMode === "week" && selectedDate ? (
        <WeekView 
          selectedDate={selectedDate}
          currentMonth={currentMonth}
          currentYear={currentYear}
          events={events}
          eventsByDate={eventsByDate}
          decidedDates={decidedDates}
          cancelledDates={cancelledDates}
          decidedMembersByDate={decidedMembersByDate}
          myAppliedEventIds={myAppliedEventIds}
          onDateSelect={onDateSelect}
          todayDate={todayDate}
          onSwipeTouchStart={onSwipeTouchStart}
          onSwipeTouchMove={onSwipeTouchMove}
          onSwipeTouchEnd={onSwipeTouchEnd}
          getEventIcon={getEventIcon}
        />
      ) : (
        <>
          {/* 曜日行（固定＆大きめ） */}
          <div className="grid grid-cols-7 text-center text-[12px] sm:text-sm font-bold text-gray-700 border-b border-green-200 bg-gradient-to-r from-green-50/80 to-emerald-50/80 sticky top-[44px] sm:top-[52px] z-10" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', margin:0, padding:0 }}>
            {["日","月","火","水","木","金","土"].map((d, idx) => (
              <div key={d} className={"py-2 "+(idx===0?"text-red-600":idx===6?"text-blue-600":"")} style={{margin:0}}>{d}</div>
            ))}
          </div>

          {/* カレンダー本体（タップ幅UP・余白広め） - 横スワイプ対応 */}
          <div 
            className="grid grid-cols-7 bg-white" 
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
              gap: '3px',
              padding: 0,
              margin: 0
            }}
            onTouchStart={onSwipeTouchStart}
            onTouchMove={onSwipeTouchMove}
            onTouchEnd={onSwipeTouchEnd}
          >
            {visibleCells.map((cell, i) =>
              cell===null ? <div key={`empty-${i}`}></div> : renderDayCell(cell)
            )}
          </div>
        </>
      )}
    </div>
  );
}