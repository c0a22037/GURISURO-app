// src/components/ParticipationCalendar.js
import React from "react";
import { toLocalYMD } from "../lib/date.js";

const monthNames = [
  "1月", "2月", "3月", "4月", "5月", "6月",
  "7月", "8月", "9月", "10月", "11月", "12月"
];

const weekDayNames = ["日", "月", "火", "水", "木", "金", "土"];

// YYYY-MM-DD
const toKey = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// 今日かどうか
const isToday = (date) => {
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
};

export default function ParticipationCalendar({
  currentMonth,
  currentYear,
  selectedDate,
  onMonthChange,
  onDateSelect,
  participationDates = new Set(), // 参加した日付のSet (YYYY-MM-DD形式)
}) {
  // 月の最初の日
  const firstDay = new Date(currentYear, currentMonth, 1);
  // 月の最後の日
  const lastDay = new Date(currentYear, currentMonth + 1, 0);
  // 月の最初の日の曜日（0=日曜日）
  const firstDayOfWeek = firstDay.getDay();
  // 月の日数
  const daysInMonth = lastDay.getDate();

  // カレンダーの日付配列を生成
  const days = [];
  // 前月の埋め合わせ
  for (let i = 0; i < firstDayOfWeek; i++) {
    days.push(null);
  }
  // 今月の日付
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const today = toLocalYMD(new Date());

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      {/* ヘッダー（月移動） */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => onMonthChange(-1)}
          className="px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium"
          style={{ fontSize: "16px", minHeight: "40px" }}
          aria-label="前の月"
        >
          ←
        </button>
        <h3 className="text-lg font-semibold text-gray-800" style={{ fontSize: "18px" }}>
          {currentYear}年{monthNames[currentMonth]}
        </h3>
        <button
          onClick={() => onMonthChange(1)}
          className="px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium"
          style={{ fontSize: "16px", minHeight: "40px" }}
          aria-label="次の月"
        >
          →
        </button>
      </div>

      {/* 曜日ヘッダー */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDayNames.map((dayName, idx) => (
          <div
            key={idx}
            className={`text-center text-sm font-semibold py-2 ${
              idx === 0 ? "text-red-600" : idx === 6 ? "text-blue-600" : "text-gray-700"
            }`}
            style={{ fontSize: "14px" }}
          >
            {dayName}
          </div>
        ))}
      </div>

      {/* カレンダーグリッド */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, idx) => {
          if (day === null) {
            return <div key={`empty-${idx}`} className="aspect-square"></div>;
          }

          const date = new Date(currentYear, currentMonth, day);
          const dateKey = toKey(date);
          const isParticipated = participationDates.has(dateKey);
          const isTodayDate = isToday(date);
          const isSelected =
            selectedDate &&
            selectedDate.getFullYear() === currentYear &&
            selectedDate.getMonth() === currentMonth &&
            selectedDate.getDate() === day;
          const isPast = dateKey <= today;

          // 背景色とテキスト色
          let bgColor = "bg-white";
          let textColor = "text-gray-800";
          let borderColor = "border-gray-200";

          if (isParticipated && isPast) {
            bgColor = "bg-emerald-500";
            textColor = "text-white";
            borderColor = "border-emerald-600";
          } else if (isTodayDate) {
            bgColor = "bg-blue-50";
            textColor = "text-blue-700";
            borderColor = "border-blue-300";
          } else if (!isPast) {
            bgColor = "bg-gray-50";
            textColor = "text-gray-400";
            borderColor = "border-gray-200";
          }

          // 選択中の場合はリングを追加
          const ringClass = isSelected ? "ring-2 ring-emerald-400 ring-offset-1" : "";

          // 土日の色
          const dayOfWeek = date.getDay();
          if (!isParticipated && isPast) {
            if (dayOfWeek === 0) textColor = "text-red-600";
            else if (dayOfWeek === 6) textColor = "text-blue-600";
          }

          return (
            <button
              key={`day-${day}`}
              onClick={() => onDateSelect?.(date)}
              className={`aspect-square border-2 ${borderColor} ${bgColor} ${textColor} rounded-lg flex flex-col items-center justify-center transition-all hover:scale-105 ${ringClass} ${
                isParticipated && isPast ? "font-bold shadow-sm" : "font-medium"
              }`}
              style={{ fontSize: "16px" }}
              disabled={!isPast}
              aria-label={`${currentYear}年${currentMonth + 1}月${day}日`}
            >
              <span>{day}</span>
              {isParticipated && isPast && (
                <span className="text-xs mt-0.5" style={{ fontSize: "10px" }}>
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 凡例 */}
      <div className="mt-4 flex items-center justify-center gap-4 text-sm text-gray-600" style={{ fontSize: "14px" }}>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded border-2 border-emerald-600 bg-emerald-500"></div>
          <span>参加した日</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded border-2 border-gray-200 bg-gray-50"></div>
          <span>未来の日</span>
        </div>
      </div>
    </div>
  );
}

