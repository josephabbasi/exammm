import React, { useRef, useState } from 'react';
import {
  BookOpen,
  Download,
  Edit2,
  FilePlus2,
  FolderOpen,
  LayoutTemplate,
  Trash2,
} from 'lucide-react';
import { ExamProject } from '../types/exam';
import { formatJalaliTimestamp, formatScore, toPersianDigits } from '../utils/jalali';

interface DashboardViewProps {
  projects: ExamProject[];
  onCreateNew: () => void;
  onOpenProject: (project: ExamProject) => void;
  onRenameProject: (id: string, newTitle: string) => Promise<void>;
  onDeleteProject: (id: string) => Promise<void>;
  onExportProjectFile: (project: ExamProject) => void;
  onImportProjectFile: (file: File) => Promise<void>;
  onOpenBank: () => void;
  onOpenHeaders: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  projects,
  onCreateNew,
  onOpenProject,
  onRenameProject,
  onDeleteProject,
  onExportProjectFile,
  onImportProjectFile,
  onOpenBank,
  onOpenHeaders,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    try {
      await onImportProjectFile(file);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'خطا در باز کردن فایل پروژه.');
    } finally {
      e.target.value = '';
    }
  };

  const commitRename = async (id: string) => {
    if (renameText.trim()) {
      await onRenameProject(id, renameText.trim());
    }
    setRenamingId(null);
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      {/* Simple Clean Primary Hero Action */}
      <div className="mb-8 flex flex-col justify-between gap-6 rounded-xl border border-slate-200 bg-white p-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">طراحی ساده برگه امتحانی</h1>
          <p className="mt-1.5 text-sm text-slate-600">
            سؤالات را وارد کنید؛ صفحه‌بندی، سربرگ مدرسه، فرمول‌ها و خروجی PDF و Word به‌صورت خودکار انجام می‌شود.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept=".bargeh,.json"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            <FolderOpen className="h-4 w-4 text-slate-500" />
            باز کردن فایل پروژه
          </button>

          <button
            type="button"
            onClick={onCreateNew}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap"
          >
            <FilePlus2 className="h-5 w-5" />
            ایجاد امتحان جدید
          </button>
        </div>
      </div>

      {importError && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {importError}
        </div>
      )}

      {/* Quick Access Cards: Question Bank & Headers */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={onOpenBank}
          className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5 text-right hover:border-blue-300 hover:bg-blue-50/20 transition-colors"
        >
          <div>
            <h2 className="text-base font-semibold text-slate-900">بانک سؤالات</h2>
            <p className="mt-1 text-xs text-slate-500">
              ذخیره و دسته‌بندی سؤالات پرتکرار برای استفاده در امتحانات آینده
            </p>
          </div>
          <BookOpen className="h-6 w-6 shrink-0 text-blue-600" />
        </button>

        <button
          type="button"
          onClick={onOpenHeaders}
          className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5 text-right hover:border-blue-300 hover:bg-blue-50/20 transition-colors"
        >
          <div>
            <h2 className="text-base font-semibold text-slate-900">طراح سربرگ</h2>
            <p className="mt-1 text-xs text-slate-500">
              طراحی تصویری سربرگ رسمی مدرسه با جدول، ادغام سلول، لوگو و فیلدهای خودکار برای استفاده مجدد
            </p>
          </div>
          <LayoutTemplate className="h-6 w-6 shrink-0 text-blue-600" />
        </button>
      </div>

      {/* Recent Projects Section */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">پروژه‌های اخیر</h2>
          <span className="text-xs text-slate-500 tabular-nums">
            {toPersianDigits(projects.length)} امتحان ذخیره‌شده
          </span>
        </div>

        {projects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <p className="text-sm font-medium text-slate-700">
              هنوز هیچ امتحانی ایجاد نشده است.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              برای شروع، روی دکمه «ایجاد امتحان جدید» کلیک کنید یا یک فایل پروژه (.bargeh) را باز کنید.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((proj) => {
              const totalQScore = proj.questions.reduce((s, q) => s + (q.score || 0), 0);
              const isRenaming = renamingId === proj.id;
              const isConfirmingDelete = confirmDeleteId === proj.id;

              return (
                <div
                  key={proj.id}
                  className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300"
                >
                  <div>
                    {isRenaming ? (
                      <div className="mb-2 flex items-center gap-1.5">
                        <input
                          type="text"
                          autoFocus
                          value={renameText}
                          onChange={(e) => setRenameText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitRename(proj.id);
                            if (e.key === 'Escape') setRenamingId(null);
                          }}
                          className="w-full rounded-md border border-blue-400 px-2.5 py-1 text-sm focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => commitRename(proj.id)}
                          className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white"
                        >
                          ثبت
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onOpenProject(proj)}
                        className="mb-1 block w-full truncate text-right text-base font-semibold text-slate-900 hover:text-blue-600"
                      >
                        {proj.title || proj.examInfo.examName || 'امتحان بدون نام'}
                      </button>
                    )}

                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                      <span>{proj.examInfo.subject || 'بدون درس'}</span>
                      {proj.examInfo.grade && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>پایه {proj.examInfo.grade}</span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">
                        {toPersianDigits(proj.questions.length)} سؤال
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">
                        بارم: {formatScore(totalQScore)} از {formatScore(proj.examInfo.totalScore)}
                      </span>
                    </div>

                    <div className="mt-2 text-[11px] text-slate-400 tabular-nums">
                      آخرین ویرایش: {formatJalaliTimestamp(proj.updatedAt)}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                    <button
                      type="button"
                      onClick={() => onOpenProject(proj)}
                      className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                    >
                      باز کردن و ویرایش
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setRenamingId(proj.id);
                          setRenameText(proj.title || proj.examInfo.examName);
                        }}
                        title="تغییر نام پروژه"
                        className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onExportProjectFile(proj)}
                        title="ذخیره فایل پروژه (.bargeh)"
                        className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>

                      {isConfirmingDelete ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteProject(proj.id);
                              setConfirmDeleteId(null);
                            }}
                            className="rounded bg-red-600 px-2 py-1 text-[11px] font-medium text-white"
                          >
                            حذف شود؟
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="rounded px-1.5 py-1 text-[11px] text-slate-500 hover:bg-slate-100"
                          >
                            خیر
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(proj.id)}
                          title="حذف پروژه"
                          className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
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
