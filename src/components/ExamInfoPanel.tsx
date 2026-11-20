import React from 'react';
import { ExamInfo } from '../types/exam';
import { toEnglishDigits } from '../utils/jalali';
import { JalaliDatePicker } from './JalaliDatePicker';

interface ExamInfoPanelProps {
  examInfo: ExamInfo;
  onChange: (next: ExamInfo) => void;
  onNextStep?: () => void;
}

export const ExamInfoPanel: React.FC<ExamInfoPanelProps> = ({
  examInfo,
  onChange,
  onNextStep,
}) => {
  const updateField = <K extends keyof ExamInfo>(key: K, value: ExamInfo[K]) => {
    onChange({ ...examInfo, [key]: value });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-slate-900">مشخصات امتحان</h3>
          <p className="mt-1 text-xs text-slate-500">
            این مقادیر به‌صورت خودکار در فیلدهای پویا (مانند نام مدرسه، نام درس، پایه، تاریخ و بارم کل) درون سربرگ طراحی‌شده جایگذاری می‌شوند و برای کنترل مجموع بارم و دسته‌بندی بانک سؤالات به کار می‌روند.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              نام امتحان
            </label>
            <input
              type="text"
              value={examInfo.examName}
              onChange={(e) => updateField('examName', e.target.value)}
              placeholder="مثلاً امتحان نوبت اول"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              نمره کل امتحان
            </label>
            <input
              type="number"
              step="0.25"
              min="1"
              dir="ltr"
              value={examInfo.totalScore}
              onChange={(e) => {
                const v = parseFloat(toEnglishDigits(e.target.value));
                updateField('totalScore', Number.isNaN(v) ? 20 : Math.max(0.5, v));
              }}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-center text-sm font-semibold text-slate-900 tabular-nums focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              نام درس
            </label>
            <input
              type="text"
              value={examInfo.subject}
              onChange={(e) => updateField('subject', e.target.value)}
              placeholder="مثلاً ریاضی، فارسی، زبان انگلیسی"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                پایه تحصیلی
              </label>
              <input
                type="text"
                value={examInfo.grade}
                onChange={(e) => updateField('grade', e.target.value)}
                placeholder="مثلاً نهم"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                کلاس
              </label>
              <input
                type="text"
                value={examInfo.className}
                onChange={(e) => updateField('className', e.target.value)}
                placeholder="مثلاً ۹۰۲"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              نام مدرسه (اختیاری)
            </label>
            <input
              type="text"
              value={examInfo.schoolName}
              onChange={(e) => updateField('schoolName', e.target.value)}
              placeholder="مثلاً دبیرستان شهید بهشتی"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              نام دبیر (اختیاری)
            </label>
            <input
              type="text"
              value={examInfo.teacherName}
              onChange={(e) => updateField('teacherName', e.target.value)}
              placeholder="نام و نام خانوادگی دبیر"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              تاریخ امتحان (شمسی)
            </label>
            <JalaliDatePicker
              value={examInfo.examDate}
              onChange={(val) => updateField('examDate', val)}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              مدت زمان امتحان
            </label>
            <input
              type="text"
              value={examInfo.duration}
              onChange={(e) => updateField('duration', e.target.value)}
              placeholder="مثلاً ۶۰ دقیقه"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>
      </div>

      {onNextStep && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onNextStep}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            ادامه به طراح سربرگ
          </button>
        </div>
      )}
    </div>
  );
};
