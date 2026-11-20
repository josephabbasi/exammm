import React, { useMemo, useState } from 'react';
import { Check, Edit3, Plus, Search, Trash2, X } from 'lucide-react';
import { renderRichHtmlWithMath } from '../services/mathRender';
import { BankQuestion, QuestionItem } from '../types/exam';
import { createEmptyQuestion, createId } from '../utils/defaults';
import { formatScore, toPersianDigits } from '../utils/jalali';
import { QuestionEditorCard } from './QuestionEditorCard';

interface QuestionBankPanelProps {
  bankQuestions: BankQuestion[];
  onSaveBankQuestion: (item: BankQuestion) => Promise<void>;
  onDeleteBankQuestion: (id: string) => Promise<void>;
  // Optional picker mode when opened from inside an exam editor
  pickerMode?: boolean;
  onAddSelectedToExam?: (questions: QuestionItem[]) => void;
  onClosePicker?: () => void;
}

export const QuestionBankPanel: React.FC<QuestionBankPanelProps> = ({
  bankQuestions,
  onSaveBankQuestion,
  onDeleteBankQuestion,
  pickerMode = false,
  onAddSelectedToExam,
  onClosePicker,
}) => {
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [chapterFilter, setChapterFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modal / inline editor state for adding or editing a bank item
  const [editingItem, setEditingItem] = useState<BankQuestion | null>(null);

  const subjects = useMemo(
    () => Array.from(new Set(bankQuestions.map((b) => b.subject).filter(Boolean))),
    [bankQuestions]
  );
  const grades = useMemo(
    () => Array.from(new Set(bankQuestions.map((b) => b.grade).filter(Boolean))),
    [bankQuestions]
  );
  const chapters = useMemo(
    () => Array.from(new Set(bankQuestions.map((b) => b.chapter).filter(Boolean))),
    [bankQuestions]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bankQuestions.filter((item) => {
      if (subjectFilter !== 'all' && item.subject !== subjectFilter) return false;
      if (gradeFilter !== 'all' && item.grade !== gradeFilter) return false;
      if (chapterFilter !== 'all' && item.chapter !== chapterFilter) return false;
      if (!q) return true;
      const plain = item.question.contentHtml.replace(/<[^>]+>/g, ' ').toLowerCase();
      return (
        plain.includes(q) ||
        item.subject.toLowerCase().includes(q) ||
        item.grade.toLowerCase().includes(q) ||
        item.chapter.toLowerCase().includes(q)
      );
    });
  }, [bankQuestions, search, subjectFilter, gradeFilter, chapterFilter]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleConfirmAddToExam = () => {
    if (!onAddSelectedToExam) return;
    const chosen = bankQuestions.filter((b) => selectedIds.includes(b.id));
    // Deep-clone independent copies so editing inside the exam never modifies the bank
    const independentCopies: QuestionItem[] = chosen.map((b) => {
      const cloned: Omit<QuestionItem, 'id' | 'manualNumber'> = JSON.parse(
        JSON.stringify(b.question)
      );
      return {
        ...cloned,
        id: createId('q'),
        score: b.suggestedScore || cloned.score || 1,
        images: cloned.images.map((im) => ({ ...im, id: createId('img') })),
        tables: cloned.tables.map((t) => ({ ...t, id: createId('tbl') })),
        formulas: cloned.formulas.map((f) => ({ ...f, id: createId('f') })),
        subQuestions: cloned.subQuestions.map((sq) => ({ ...sq, id: createId('sq') })),
      };
    });
    onAddSelectedToExam(independentCopies);
    setSelectedIds([]);
  };

  const startNewBankQuestion = () => {
    const base = createEmptyQuestion();
    const { id: _ignoredId, manualNumber: _ignoredNum, ...rest } = base;
    setEditingItem({
      id: createId('bank'),
      subject: '',
      grade: '',
      chapter: '',
      suggestedScore: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      question: rest,
    });
  };

  const handleSaveEditing = async () => {
    if (!editingItem) return;
    await onSaveBankQuestion({
      ...editingItem,
      suggestedScore: editingItem.question.score,
      updatedAt: Date.now(),
    });
    setEditingItem(null);
  };

  if (editingItem) {
    const asQuestionItem: QuestionItem = {
      ...editingItem.question,
      id: editingItem.id,
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h3 className="text-base font-semibold text-slate-900">ویرایش سؤال بانک</h3>
          <button
            type="button"
            onClick={() => setEditingItem(null)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
          >
            بازگشت به لیست
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">درس</label>
            <input
              type="text"
              value={editingItem.subject}
              onChange={(e) => setEditingItem({ ...editingItem, subject: e.target.value })}
              placeholder="مثلاً ریاضی"
              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">پایه</label>
            <input
              type="text"
              value={editingItem.grade}
              onChange={(e) => setEditingItem({ ...editingItem, grade: e.target.value })}
              placeholder="مثلاً نهم"
              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">فصل و مبحث</label>
            <input
              type="text"
              value={editingItem.chapter}
              onChange={(e) => setEditingItem({ ...editingItem, chapter: e.target.value })}
              placeholder="مثلاً فصل اول - مجموعه‌ها"
              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
            />
          </div>
        </div>

        <QuestionEditorCard
          question={asQuestionItem}
          index={0}
          totalCount={1}
          onChange={(updated) => {
            const { id: _id, manualNumber: _mn, ...rest } = updated;
            setEditingItem({
              ...editingItem,
              suggestedScore: updated.score,
              question: rest,
            });
          }}
          onMoveUp={() => {}}
          onMoveDown={() => {}}
          onDuplicate={() => {}}
          onDelete={() => setEditingItem(null)}
          onSaveToBank={handleSaveEditing}
        />

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setEditingItem(null)}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            انصراف
          </button>
          <button
            type="button"
            onClick={handleSaveEditing}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Check className="h-4 w-4" />
            ذخیره در بانک سؤالات
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جست‌وجو در متن سؤال، درس یا مبحث..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-3 pr-9 text-sm focus:border-blue-500 focus:bg-white focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
          >
            <option value="all">همه درس‌ها</option>
            {subjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
          >
            <option value="all">همه پایه‌ها</option>
            {grades.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          <select
            value={chapterFilter}
            onChange={(e) => setChapterFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
          >
            <option value="all">همه مباحث</option>
            {chapters.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={startNewBankQuestion}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-700 whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            سؤال جدید در بانک
          </button>
        </div>
      </div>

      {/* Picker Action Bar */}
      {pickerMode && (
        <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-2.5">
          <span className="text-xs font-medium text-slate-800 tabular-nums">
            {selectedIds.length > 0
              ? `${toPersianDigits(selectedIds.length)} سؤال انتخاب شده است (نسخه مستقل به امتحان اضافه می‌شود)`
              : 'سؤالات مورد نظر را برای افزودن به امتحان تیک بزنید'}
          </span>
          <div className="flex items-center gap-2">
            {onClosePicker && (
              <button
                type="button"
                onClick={onClosePicker}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                بستن
              </button>
            )}
            <button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={handleConfirmAddToExam}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-45"
            >
              <Check className="h-3.5 w-3.5" />
              افزودن به امتحان
            </button>
          </div>
        </div>
      )}

      {/* Bank Questions List */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm font-medium text-slate-700">
            {bankQuestions.length === 0
              ? 'هنوز سؤالی در بانک سؤالات ذخیره نشده است.'
              : 'سؤالی با فیلترهای انتخاب‌شده پیدا نشد.'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            می‌توانید از دکمه «سؤال جدید در بانک» یا گزینه «ذخیره در بانک» کنار هر سؤال امتحان استفاده کنید.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((item) => {
            const isSelected = selectedIds.includes(item.id);
            const hydrated = renderRichHtmlWithMath(item.question.contentHtml);
            return (
              <div
                key={item.id}
                className={`flex items-start gap-3 rounded-xl border bg-white p-4 transition-colors ${
                  isSelected ? 'border-blue-500 bg-blue-50/30' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {pickerMode && (
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(item.id)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 accent-blue-600"
                  />
                )}

                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>{item.subject || 'بدون درس'}</span>
                    <span aria-hidden="true">·</span>
                    <span>{item.grade || 'بدون پایه'}</span>
                    {item.chapter && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{item.chapter}</span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span className="font-medium text-slate-700 tabular-nums">
                      بارم پیشنهادی: {formatScore(item.suggestedScore)}
                    </span>
                  </div>

                  <div
                    className="exam-rich-content text-sm text-slate-900"
                    dangerouslySetInnerHTML={{ __html: hydrated || '...' }}
                  />

                  {(item.question.images.length > 0 ||
                    item.question.tables.length > 0 ||
                    item.question.subQuestions.length > 0) && (
                    <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-500 tabular-nums">
                      {item.question.images.length > 0 && (
                        <span>{toPersianDigits(item.question.images.length)} تصویر</span>
                      )}
                      {item.question.tables.length > 0 && (
                        <span>{toPersianDigits(item.question.tables.length)} جدول</span>
                      )}
                      {item.question.subQuestions.length > 0 && (
                        <span>{toPersianDigits(item.question.subQuestions.length)} زیرسؤال</span>
                      )}
                    </div>
                  )}
                </div>

                {!pickerMode && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingItem(item)}
                      className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-blue-600"
                      title="ویرایش سؤال"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteBankQuestion(item.id)}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      title="حذف از بانک"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

interface QuestionBankModalProps {
  isOpen: boolean;
  bankQuestions: BankQuestion[];
  onSaveBankQuestion: (item: BankQuestion) => Promise<void>;
  onDeleteBankQuestion: (id: string) => Promise<void>;
  onAddSelected: (questions: QuestionItem[]) => void;
  onClose: () => void;
}

export const QuestionBankModal: React.FC<QuestionBankModalProps> = ({
  isOpen,
  bankQuestions,
  onSaveBankQuestion,
  onDeleteBankQuestion,
  onAddSelected,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[1px]">
      <div className="flex max-h-[88vh] w-full max-w-4xl flex-col rounded-xl border border-slate-200 bg-slate-50 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3.5 rounded-t-xl">
          <h3 className="text-base font-semibold text-slate-900">انتخاب سؤال از بانک سؤالات</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <QuestionBankPanel
            bankQuestions={bankQuestions}
            onSaveBankQuestion={onSaveBankQuestion}
            onDeleteBankQuestion={onDeleteBankQuestion}
            pickerMode
            onAddSelectedToExam={(qs) => {
              onAddSelected(qs);
              onClose();
            }}
            onClosePicker={onClose}
          />
        </div>
      </div>
    </div>
  );
};
