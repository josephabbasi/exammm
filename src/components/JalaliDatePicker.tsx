import React, { useEffect, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  JALALI_MONTHS,
  JALALI_WEEKDAYS_SHORT,
  getJalaliMonthLength,
  getTodayJalaliString,
  gregorianToJalali,
  jalaliToGregorian,
  toEnglishDigits,
  toPersianDigits,
} from '../utils/jalali';

interface JalaliDatePickerProps {
  value: string;
  onChange: (val: string) => void;
  id?: string;
}

export const JalaliDatePicker: React.FC<JalaliDatePickerProps> = ({ value, onChange, id }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const parseDate = (str: string): [number, number, number] => {
    const clean = toEnglishDigits(str || '');
    const match = clean.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (match) {
      const y = Number(match[1]);
      const m = Math.min(12, Math.max(1, Number(match[2])));
      const d = Math.min(31, Math.max(1, Number(match[3])));
      return [y, m, d];
    }
    const now = new Date();
    return gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  };

  const [selY, selM, selD] = parseDate(value);
  const [viewYear, setViewYear] = useState(selY);
  const [viewMonth, setViewMonth] = useState(selM);

  useEffect(() => {
    if (open) {
      const [y, m] = parseDate(value);
      setViewYear(y);
      setViewMonth(m);
    }
  }, [open, value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const daysInMonth = getJalaliMonthLength(viewYear, viewMonth);
  const [gy, gm, gd] = jalaliToGregorian(viewYear, viewMonth, 1);
  // JS getDay(): 0=Sun..6=Sat -> Persian week starts Sat(0), Sun(1), Mon(2), Tue(3), Wed(4), Thu(5), Fri(6)
  const firstJsDay = new Date(gy, gm - 1, gd).getDay();
  const startOffset = (firstJsDay + 1) % 7;

  const handlePrevMonth = () => {
    if (viewMonth === 1) {
      setViewYear((y) => y - 1);
      setViewMonth(12);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 12) {
      setViewYear((y) => y + 1);
      setViewMonth(1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const selectDay = (day: number) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    onChange(`${viewYear}/${pad(viewMonth)}/${pad(day)}`);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative flex items-center">
        <input
          id={id}
          type="text"
          value={toPersianDigits(value)}
          onChange={(e) => onChange(toEnglishDigits(e.target.value))}
          placeholder="۱۴۰۵/۰۹/۱۵"
          dir="ltr"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pl-9 text-right text-sm text-slate-900 tabular-nums focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label="باز کردن تقویم شمسی"
          className="absolute left-2 rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-blue-600 transition-colors"
        >
          <Calendar className="h-4 w-4" />
        </button>
      </div>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100"
              aria-label="ماه قبل"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold text-slate-800 tabular-nums">
              {JALALI_MONTHS[viewMonth - 1]} {toPersianDigits(viewYear)}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100"
              aria-label="ماه بعد"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 text-center text-xs font-medium text-slate-500">
            {JALALI_WEEKDAYS_SHORT.map((w) => (
              <div key={w} className="py-1">
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-center text-xs">
            {Array.from({ length: startOffset }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const day = idx + 1;
              const isSelected = viewYear === selY && viewMonth === selM && day === selD;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={`rounded-md py-1.5 tabular-nums transition-colors ${
                    isSelected
                      ? 'bg-blue-600 font-semibold text-white'
                      : 'text-slate-700 hover:bg-blue-50 hover:text-blue-700'
                  }`}
                >
                  {toPersianDigits(day)}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
            <button
              type="button"
              onClick={() => {
                onChange(getTodayJalaliString());
                setOpen(false);
              }}
              className="text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              انتخاب امروز
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              بستن
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
