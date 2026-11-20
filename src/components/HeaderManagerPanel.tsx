import React, { useState } from 'react';
import {
  Check,
  Copy,
  Edit2,
  Edit3,
  LayoutGrid,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  DesignedHeader,
  ExamInfo,
  HeaderConfig,
  PageSettings,
  SavedHeader,
} from '../types/exam';
import { createId } from '../utils/defaults';
import {
  createBlankDesignedHeader,
  createStarterIranianHeader,
} from '../utils/headerGrid';
import { toPersianDigits } from '../utils/jalali';
import { ExamHeaderRenderer } from './ExamHeaderRenderer';
import { HeaderDesigner } from './HeaderDesigner';

interface HeaderManagerPanelProps {
  headerConfig: HeaderConfig;
  examInfo?: ExamInfo;
  pageSettings: PageSettings;
  savedHeaders: SavedHeader[];
  onChangeHeader: (next: HeaderConfig) => void;
  onSaveHeaderToLibrary: (header: SavedHeader) => Promise<void>;
  onDeleteSavedHeader: (id: string) => Promise<void>;
  /** True when rendered in the standalone Header Designer section outside an exam */
  libraryOnly?: boolean;
}

type DesignerMode =
  | { kind: 'closed' }
  | { kind: 'new-library'; draft: DesignedHeader }
  | { kind: 'edit-library'; savedId: string; draft: DesignedHeader }
  | { kind: 'edit-exam-snapshot'; draft: DesignedHeader };

export const HeaderManagerPanel: React.FC<HeaderManagerPanelProps> = ({
  headerConfig,
  examInfo,
  pageSettings,
  savedHeaders,
  onChangeHeader,
  onSaveHeaderToLibrary,
  onDeleteSavedHeader,
  libraryOnly = false,
}) => {
  const [designerMode, setDesignerMode] = useState<DesignerMode>({ kind: 'closed' });
  const [showNewGridForm, setShowNewGridForm] = useState(false);
  const [newRows, setNewRows] = useState(3);
  const [newCols, setNewCols] = useState(3);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');

  const activeDesigned = headerConfig.designed;

  const openBlankDesigner = () => {
    const draft = createBlankDesignedHeader(
      newRows,
      newCols,
      `سربرگ شماره ${toPersianDigits(savedHeaders.length + 1)}`
    );
    setShowNewGridForm(false);
    setDesignerMode({ kind: 'new-library', draft });
  };

  const openStarterDesigner = () => {
    const draft = createStarterIranianHeader(
      `سربرگ مدرسه ${toPersianDigits(savedHeaders.length + 1)}`
    );
    setShowNewGridForm(false);
    setDesignerMode({ kind: 'new-library', draft });
  };

  const handleSaveFromDesigner = async (designed: DesignedHeader) => {
    if (designerMode.kind === 'edit-exam-snapshot') {
      // Updates ONLY this exam's independent header snapshot
      onChangeHeader({
        ...headerConfig,
        designed: JSON.parse(JSON.stringify(designed)),
      });
      setDesignerMode({ kind: 'closed' });
      return;
    }

    if (designerMode.kind === 'edit-library') {
      const existing = savedHeaders.find((s) => s.id === designerMode.savedId);
      const updatedSaved: SavedHeader = {
        id: designerMode.savedId,
        name: designed.name,
        createdAt: existing?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
        header: JSON.parse(JSON.stringify(designed)),
      };
      await onSaveHeaderToLibrary(updatedSaved);
      setDesignerMode({ kind: 'closed' });
      return;
    }

    // New header saved to library
    const savedId = createId('saved_hdr');
    const newSaved: SavedHeader = {
      id: savedId,
      name: designed.name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      header: JSON.parse(JSON.stringify(designed)),
    };
    await onSaveHeaderToLibrary(newSaved);

    // If created from inside an exam, automatically apply an independent snapshot to this exam
    if (!libraryOnly) {
      onChangeHeader({
        savedHeaderId: savedId,
        designed: JSON.parse(JSON.stringify(designed)),
        gapBelowHeaderMm: headerConfig.gapBelowHeaderMm ?? 3,
      });
    }
    setDesignerMode({ kind: 'closed' });
  };

  const handleSelectSavedHeader = (sh: SavedHeader) => {
    // Store an independent deep-cloned snapshot in the examination project
    onChangeHeader({
      savedHeaderId: sh.id,
      designed: JSON.parse(JSON.stringify(sh.header)),
      gapBelowHeaderMm: headerConfig.gapBelowHeaderMm ?? 3,
    });
  };

  const handleDuplicateSaved = async (sh: SavedHeader) => {
    const clonedHeader: DesignedHeader = JSON.parse(JSON.stringify(sh.header));
    clonedHeader.id = createId('hdr');
    clonedHeader.name = `${sh.name} (کپی)`;
    await onSaveHeaderToLibrary({
      id: createId('saved_hdr'),
      name: clonedHeader.name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      header: clonedHeader,
    });
  };

  const handleCommitRename = async (sh: SavedHeader) => {
    const trimmed = renameText.trim();
    if (trimmed && trimmed !== sh.name) {
      await onSaveHeaderToLibrary({
        ...sh,
        name: trimmed,
        updatedAt: Date.now(),
        header: { ...sh.header, name: trimmed },
      });
    }
    setRenamingId(null);
  };

  // Full Visual Header Designer View when creating or editing
  if (designerMode.kind !== 'closed') {
    return (
      <HeaderDesigner
        initialHeader={designerMode.draft}
        pageSettings={pageSettings}
        examInfo={examInfo}
        onSave={handleSaveFromDesigner}
        onCancel={() => setDesignerMode({ kind: 'closed' })}
        saveButtonLabel={
          designerMode.kind === 'edit-exam-snapshot'
            ? 'اعمال تغییرات روی این امتحان'
            : 'ذخیره در سربرگ‌های من'
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Create New Header Action Area */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">طراح بصری سربرگ مدرسه</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              سربرگ اختصاصی مدرسه را با جدول قابل ادغام، لوگو و فیلدهای پویا طراحی و برای امتحانات آینده ذخیره کنید.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowNewGridForm((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              ساخت سربرگ جدید (جدول خالی)
            </button>
            <button
              type="button"
              onClick={openStarterDesigner}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              <LayoutGrid className="h-3.5 w-3.5 text-blue-600" />
              شروع با چیدمان پایه مدارس
            </button>
          </div>
        </div>

        {/* Simple Rows x Columns selector for creating a blank table from scratch */}
        {showNewGridForm && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-blue-200 bg-blue-50/50 p-3 text-xs">
            <span className="font-medium text-slate-800">ابعاد اولیه جدول سربرگ:</span>
            <label className="flex items-center gap-1.5">
              <span>تعداد سطر:</span>
              <input
                type="number"
                min={1}
                max={8}
                dir="ltr"
                value={newRows}
                onChange={(e) => setNewRows(Math.max(1, Math.min(8, Number(e.target.value) || 3)))}
                className="w-14 rounded border border-slate-300 bg-white px-2 py-1 text-center tabular-nums"
              />
            </label>
            <label className="flex items-center gap-1.5">
              <span>تعداد ستون:</span>
              <input
                type="number"
                min={1}
                max={8}
                dir="ltr"
                value={newCols}
                onChange={(e) => setNewCols(Math.max(1, Math.min(8, Number(e.target.value) || 3)))}
                className="w-14 rounded border border-slate-300 bg-white px-2 py-1 text-center tabular-nums"
              />
            </label>
            <button
              type="button"
              onClick={openBlankDesigner}
              className="rounded-md bg-blue-600 px-3.5 py-1.5 font-semibold text-white hover:bg-blue-700"
            >
              شروع طراحی
            </button>
            <button
              type="button"
              onClick={() => setShowNewGridForm(false)}
              className="text-slate-600 hover:text-slate-900"
            >
              انصراف
            </button>
          </div>
        )}
      </div>

      {/* Active Exam Header Card + Gap Control (Only inside Examination Workspace) */}
      {!libraryOnly && activeDesigned && (
        <div className="space-y-3 rounded-xl border border-blue-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2 text-xs">
              <Check className="h-4 w-4 text-emerald-600" />
              <span className="font-semibold text-slate-900">
                سربرگ فعال این امتحان: {activeDesigned.name}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setDesignerMode({
                    kind: 'edit-exam-snapshot',
                    draft: JSON.parse(JSON.stringify(activeDesigned)),
                  })
                }
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                <Edit3 className="h-3.5 w-3.5 text-blue-600" />
                ویرایش سربرگ همین امتحان
              </button>
              <button
                type="button"
                onClick={() =>
                  onChangeHeader({
                    gapBelowHeaderMm: headerConfig.gapBelowHeaderMm ?? 3,
                  })
                }
                className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                title="برداشتن سربرگ از این امتحان"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Header Preview */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
            <ExamHeaderRenderer
              header={activeDesigned}
              examInfo={examInfo}
              pageSettings={pageSettings}
            />
          </div>

          {/* Vertical spacing control between header and first question */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs">
            <span className="font-medium text-slate-700">
              فاصله عمودی بین سربرگ و جدول سؤالات:
            </span>
            <div className="flex items-center gap-2.5">
              <input
                type="range"
                min={0}
                max={20}
                step={1}
                value={headerConfig.gapBelowHeaderMm ?? 3}
                onChange={(e) =>
                  onChangeHeader({
                    ...headerConfig,
                    gapBelowHeaderMm: Number(e.target.value),
                  })
                }
                className="w-32 accent-blue-600"
              />
              <span className="w-16 text-left font-semibold text-slate-800 tabular-nums">
                {toPersianDigits(headerConfig.gapBelowHeaderMm ?? 3)} میلی‌متر
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Saved Headers Library */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-900">سربرگ‌های ذخیره‌شده</h4>
          <span className="text-xs text-slate-500 tabular-nums">
            {toPersianDigits(savedHeaders.length)} سربرگ
          </span>
        </div>

        {savedHeaders.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center">
            <p className="text-xs font-medium text-slate-700">
              هنوز سربرگی ذخیره نشده است.
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              از دکمه «ساخت سربرگ جدید» یا «شروع با چیدمان پایه مدارس» استفاده کنید تا اولین سربرگ مدرسه را طراحی و ذخیره کنید.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {savedHeaders.map((sh) => {
              const isSelected = !libraryOnly && headerConfig.savedHeaderId === sh.id;
              const isRenaming = renamingId === sh.id;

              return (
                <div
                  key={sh.id}
                  className={`flex flex-col justify-between rounded-xl border p-3.5 transition-colors ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50/20'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      {isRenaming ? (
                        <div className="flex flex-1 items-center gap-1.5">
                          <input
                            type="text"
                            autoFocus
                            value={renameText}
                            onChange={(e) => setRenameText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleCommitRename(sh);
                              if (e.key === 'Escape') setRenamingId(null);
                            }}
                            className="w-full rounded border border-blue-400 px-2 py-1 text-xs focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleCommitRename(sh)}
                            className="rounded bg-blue-600 px-2 py-1 text-[11px] font-medium text-white"
                          >
                            ثبت
                          </button>
                        </div>
                      ) : (
                        <div className="min-w-0">
                          <div className="truncate text-xs font-bold text-slate-900">{sh.name}</div>
                          <div className="text-[11px] text-slate-400 tabular-nums">
                            {toPersianDigits(sh.header.rowHeightsMm.length)} سطر ×{' '}
                            {toPersianDigits(sh.header.colWidthsPercent.length)} ستون
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Scaled Live Preview of Saved Header */}
                    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white p-2">
                      <div
                        dir="ltr"
                        className="overflow-hidden"
                        style={{ height: '94px' }}
                      >
                        <div
                          dir="rtl"
                          style={{
                            transform: 'scale(0.46)',
                            transformOrigin: 'top left',
                            width: '217%',
                          }}
                        >
                          <ExamHeaderRenderer
                            header={sh.header}
                            examInfo={examInfo}
                            pageSettings={pageSettings}
                            useSampleValues={!examInfo}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Saved Header Card Actions */}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
                    {!libraryOnly ? (
                      <button
                        type="button"
                        onClick={() => handleSelectSavedHeader(sh)}
                        className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                          isSelected
                            ? 'bg-emerald-600 text-white'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        {isSelected ? 'انتخاب‌شده' : 'انتخاب این سربرگ'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setDesignerMode({
                            kind: 'edit-library',
                            savedId: sh.id,
                            draft: JSON.parse(JSON.stringify(sh.header)),
                          })
                        }
                        className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        ویرایش در طراح
                      </button>
                    )}

                    <div className="flex items-center gap-1">
                      {!libraryOnly && (
                        <button
                          type="button"
                          onClick={() =>
                            setDesignerMode({
                              kind: 'edit-library',
                              savedId: sh.id,
                              draft: JSON.parse(JSON.stringify(sh.header)),
                            })
                          }
                          title="ویرایش این قالب در کتابخانه"
                          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-blue-600"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setRenamingId(sh.id);
                          setRenameText(sh.name);
                        }}
                        title="تغییر نام"
                        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDuplicateSaved(sh)}
                        title="کپی سربرگ"
                        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteSavedHeader(sh.id)}
                        title="حذف سربرگ"
                        className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
