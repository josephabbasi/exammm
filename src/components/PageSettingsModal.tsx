import React from 'react';
import { RotateCcw, X } from 'lucide-react';
import { PageOrientation, PageSettings, PaperSize } from '../types/exam';
import { DEFAULT_PAGE_SETTINGS } from '../utils/defaults';

interface PageSettingsModalProps {
  isOpen: boolean;
  settings: PageSettings;
  onChange: (next: PageSettings) => void;
  onClose: () => void;
}

export const PageSettingsModal: React.FC<PageSettingsModalProps> = ({
  isOpen,
  settings,
  onChange,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[1px]">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <h3 className="text-base font-semibold text-slate-900">تنظیمات صفحه و چاپ</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">اندازه کاغذ</label>
              <select
                value={settings.paperSize}
                onChange={(e) => onChange({ ...settings, paperSize: e.target.value as PaperSize })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="A4">A4 (استاندارد)</option>
                <option value="A5">A5 (نصف A4)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">جهت صفحه</label>
              <select
                value={settings.orientation}
                onChange={(e) =>
                  onChange({ ...settings, orientation: e.target.value as PageOrientation })
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="portrait">عمودی</option>
                <option value="landscape">افقی</option>
              </select>
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-600">حاشیه صفحات (میلی‌متر)</p>
            <div className="grid grid-cols-4 gap-2">
              {(
                [
                  ['marginTopMm', 'بالا'],
                  ['marginBottomMm', 'پایین'],
                  ['marginRightMm', 'راست'],
                  ['marginLeftMm', 'چپ'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block">
                  <span className="mb-1 block text-[11px] text-slate-500">{label}</span>
                  <input
                    type="number"
                    min={5}
                    max={40}
                    dir="ltr"
                    value={settings[key]}
                    onChange={(e) =>
                      onChange({
                        ...settings,
                        [key]: Math.min(40, Math.max(5, Number(e.target.value) || 10)),
                      })
                    }
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-center text-sm tabular-nums"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">فونت فارسی</label>
              <select
                value={settings.persianFont}
                onChange={(e) =>
                  onChange({
                    ...settings,
                    persianFont: e.target.value as PageSettings['persianFont'],
                  })
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="Vazirmatn">وزیرمتن (Vazirmatn)</option>
                <option value="Tahoma">تاهوما (Tahoma)</option>
                <option value="Segoe UI">Segoe UI</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">فونت انگلیسی</label>
              <select
                value={settings.latinFont}
                onChange={(e) =>
                  onChange({
                    ...settings,
                    latinFont: e.target.value as PageSettings['latinFont'],
                  })
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="DM Sans">DM Sans</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Arial">Arial</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                اندازه فونت سؤالات (pt)
              </label>
              <input
                type="number"
                min={8}
                max={16}
                step={0.5}
                dir="ltr"
                value={settings.fontSizePt}
                onChange={(e) =>
                  onChange({
                    ...settings,
                    fontSizePt: Math.min(16, Math.max(8, Number(e.target.value) || 11)),
                  })
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-center text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                فاصله بین سؤالات (mm)
              </label>
              <input
                type="number"
                min={1}
                max={20}
                dir="ltr"
                value={settings.questionSpacingMm}
                onChange={(e) =>
                  onChange({
                    ...settings,
                    questionSpacingMm: Math.min(20, Math.max(1, Number(e.target.value) || 5)),
                  })
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-center text-sm tabular-nums"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 pt-1 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={settings.showPageNumbers}
              onChange={(e) => onChange({ ...settings, showPageNumbers: e.target.checked })}
              className="rounded border-slate-300 accent-blue-600"
            />
            نمایش شماره صفحات در پایین برگه
          </label>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3.5">
          <button
            type="button"
            onClick={() => onChange({ ...DEFAULT_PAGE_SETTINGS })}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            بازگردانی تنظیمات استاندارد
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            تأیید
          </button>
        </div>
      </div>
    </div>
  );
};
