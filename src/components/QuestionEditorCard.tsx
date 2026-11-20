import React, { useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BookmarkPlus,
  Copy,
  ImagePlus,
  Plus,
  Sigma,
  Table as TableIcon,
  Trash2,
} from 'lucide-react';
import { renderLatexToHtml } from '../services/mathRender';
import {
  QuestionImage,
  QuestionItem,
  QuestionTable,
  SubQuestionLabelStyle,
  TextAlignment,
} from '../types/exam';
import { createId, getSubQuestionLabel } from '../utils/defaults';
import { formatScore, toEnglishDigits, toPersianDigits } from '../utils/jalali';
import { MathFormulaModal } from './MathFormulaModal';
import { RichTextEditor } from './RichTextEditor';

interface QuestionEditorCardProps {
  question: QuestionItem;
  index: number;
  totalCount: number;
  onChange: (updated: QuestionItem) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onSaveToBank: () => void;
}

export const QuestionEditorCard: React.FC<QuestionEditorCardProps> = ({
  question,
  index,
  totalCount,
  onChange,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
  onSaveToBank,
}) => {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [formulaModalOpen, setFormulaModalOpen] = useState(false);
  const [tableModalOpen, setTableModalOpen] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [scoreInput, setScoreInput] = useState(String(question.score));
  const [savedNotice, setSavedNotice] = useState(false);

  const handleScoreChange = (raw: string) => {
    setScoreInput(raw);
    const normalized = toEnglishDigits(raw).replace('٫', '.').replace(',', '.');
    const parsed = parseFloat(normalized);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      onChange({ ...question, score: Math.round(parsed * 100) / 100 });
    } else if (normalized === '') {
      onChange({ ...question, score: 0 });
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const newImg: QuestionImage = {
          id: createId('img'),
          dataUrl: reader.result,
          widthPercent: 45,
          align: 'center',
        };
        onChange({ ...question, images: [...question.images, newImg] });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const updateImage = (imgId: string, patch: Partial<QuestionImage>) => {
    onChange({
      ...question,
      images: question.images.map((img) => (img.id === imgId ? { ...img, ...patch } : img)),
    });
  };

  const removeImage = (imgId: string) => {
    onChange({
      ...question,
      images: question.images.filter((img) => img.id !== imgId),
    });
  };

  const handleCreateTable = () => {
    const rCount = Math.min(10, Math.max(1, tableRows));
    const cCount = Math.min(8, Math.max(1, tableCols));
    const rows = Array.from({ length: rCount }, () => Array.from({ length: cCount }, () => ''));
    const newTbl: QuestionTable = {
      id: createId('tbl'),
      rows,
      hasHeaderRow: true,
      align: 'center',
    };
    onChange({ ...question, tables: [...question.tables, newTbl] });
    setTableModalOpen(false);
  };

  const updateTableCell = (tblId: string, rIdx: number, cIdx: number, value: string) => {
    onChange({
      ...question,
      tables: question.tables.map((t) => {
        if (t.id !== tblId) return t;
        const nextRows = t.rows.map((row, ri) =>
          ri === rIdx ? row.map((cell, ci) => (ci === cIdx ? value : cell)) : row
        );
        return { ...t, rows: nextRows };
      }),
    });
  };

  const removeTable = (tblId: string) => {
    onChange({
      ...question,
      tables: question.tables.filter((t) => t.id !== tblId),
    });
  };

  const handleAddDisplayFormula = (latex: string) => {
    onChange({
      ...question,
      formulas: [...question.formulas, { id: createId('f'), latex, align: 'center' }],
    });
    setFormulaModalOpen(false);
  };

  const removeDisplayFormula = (fId: string) => {
    onChange({
      ...question,
      formulas: question.formulas.filter((f) => f.id !== fId),
    });
  };

  const handleAddSubQuestion = () => {
    onChange({
      ...question,
      subQuestions: [
        ...question.subQuestions,
        { id: createId('sq'), textHtml: '', score: 0.5, direction: 'auto' },
      ],
    });
  };

  const updateSubQuestion = (sqId: string, patch: Partial<QuestionItem['subQuestions'][number]>) => {
    onChange({
      ...question,
      subQuestions: question.subQuestions.map((sq) => (sq.id === sqId ? { ...sq, ...patch } : sq)),
    });
  };

  const removeSubQuestion = (sqId: string) => {
    onChange({
      ...question,
      subQuestions: question.subQuestions.filter((sq) => sq.id !== sqId),
    });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition-colors hover:border-slate-300">
      {/* Question Header Bar */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-bold text-slate-900 tabular-nums">
            سؤال {toPersianDigits(index + 1)}
          </span>
          <input
            type="text"
            value={question.manualNumber ?? ''}
            onChange={(e) => onChange({ ...question, manualNumber: e.target.value })}
            placeholder="شماره دلخواه"
            title="در صورت خالی بودن، شماره‌گذاری خودکار انجام می‌شود"
            className="w-24 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 focus:border-blue-500 focus:bg-white focus:outline-none"
          />
          <div className="flex items-center gap-1.5 border-r border-slate-200 pr-2.5">
            <label className="text-xs font-medium text-slate-600">بارم:</label>
            <input
              type="text"
              dir="ltr"
              value={scoreInput}
              onChange={(e) => handleScoreChange(e.target.value)}
              onBlur={() => setScoreInput(String(question.score))}
              className="w-16 rounded-md border border-slate-200 bg-white px-2 py-1 text-center text-xs font-semibold text-slate-900 tabular-nums focus:border-blue-500 focus:outline-none"
            />
            <span className="text-xs text-slate-500">نمره</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={index === 0}
            onClick={onMoveUp}
            title="انتقال به بالا"
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-35"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={index === totalCount - 1}
            onClick={onMoveDown}
            title="انتقال به پایین"
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-35"
          >
            <ArrowDown className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDuplicate}
            title="کپی سؤال"
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <Copy className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              onSaveToBank();
              setSavedNotice(true);
              setTimeout(() => setSavedNotice(false), 1800);
            }}
            title="ذخیره در بانک سؤالات"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-blue-50 hover:text-blue-700"
          >
            <BookmarkPlus className="h-4 w-4" />
            <span className="hidden sm:inline">{savedNotice ? 'ذخیره شد' : 'ذخیره در بانک'}</span>
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="حذف سؤال"
            className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Rich Text Editor */}
      <RichTextEditor
        html={question.contentHtml}
        onChange={(contentHtml) => onChange({ ...question, contentHtml })}
        direction={question.direction}
        onDirectionChange={(direction) => onChange({ ...question, direction })}
        align={question.align}
        onAlignChange={(align) => onChange({ ...question, align })}
      />

      {/* Display Formulas List */}
      {question.formulas.length > 0 && (
        <div className="mt-3 space-y-2">
          {question.formulas.map((f) => {
            const { html } = renderLatexToHtml(f.latex, true);
            return (
              <div
                key={f.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
              >
                <div
                  dir="ltr"
                  className="exam-rich-content flex-1 overflow-x-auto text-center text-slate-900"
                  dangerouslySetInnerHTML={{ __html: html }}
                />
                <div className="flex items-center gap-1.5">
                  <select
                    value={f.align}
                    onChange={(e) =>
                      onChange({
                        ...question,
                        formulas: question.formulas.map((x) =>
                          x.id === f.id ? { ...x, align: e.target.value as TextAlignment } : x
                        ),
                      })
                    }
                    className="rounded border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-700"
                  >
                    <option value="center">وسط</option>
                    <option value="right">راست</option>
                    <option value="left">چپ</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => removeDisplayFormula(f.id)}
                    className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    title="حذف فرمول"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Images List */}
      {question.images.length > 0 && (
        <div className="mt-3 space-y-2.5">
          {question.images.map((img) => (
            <div
              key={img.id}
              className="flex flex-col gap-2.5 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center"
            >
              <img
                src={img.dataUrl}
                alt="تصویر سؤال"
                className="h-20 w-24 shrink-0 rounded border border-slate-200 bg-white object-contain"
              />
              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-xs text-slate-700">
                    <span>عرض تصویر: {toPersianDigits(img.widthPercent)}٪</span>
                    <input
                      type="range"
                      min={15}
                      max={100}
                      step={5}
                      value={img.widthPercent}
                      onChange={(e) =>
                        updateImage(img.id, { widthPercent: Number(e.target.value) })
                      }
                      className="w-28 accent-blue-600"
                    />
                  </label>
                  <select
                    value={img.align}
                    onChange={(e) =>
                      updateImage(img.id, { align: e.target.value as TextAlignment })
                    }
                    className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
                  >
                    <option value="center">وسط‌چین</option>
                    <option value="right">راست‌چین</option>
                    <option value="left">چپ‌چین</option>
                  </select>
                </div>
                <input
                  type="text"
                  value={img.caption ?? ''}
                  onChange={(e) => updateImage(img.id, { caption: e.target.value })}
                  placeholder="توضیح زیر تصویر (اختیاری)"
                  className="w-full rounded border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => removeImage(img.id)}
                className="self-start rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                title="حذف تصویر"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Tables List */}
      {question.tables.length > 0 && (
        <div className="mt-3 space-y-2.5">
          {question.tables.map((tbl) => (
            <div key={tbl.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-1.5 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={tbl.hasHeaderRow}
                    onChange={(e) =>
                      onChange({
                        ...question,
                        tables: question.tables.map((t) =>
                          t.id === tbl.id ? { ...t, hasHeaderRow: e.target.checked } : t
                        ),
                      })
                    }
                    className="rounded border-slate-300 accent-blue-600"
                  />
                  ردیف اول به عنوان سرستون
                </label>
                <button
                  type="button"
                  onClick={() => removeTable(tbl.id)}
                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  حذف جدول
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse bg-white text-xs">
                  <tbody>
                    {tbl.rows.map((row, rIdx) => (
                      <tr key={rIdx} className={tbl.hasHeaderRow && rIdx === 0 ? 'bg-slate-100' : ''}>
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="border border-slate-300 p-0">
                            <input
                              type="text"
                              value={cell}
                              onChange={(e) => updateTableCell(tbl.id, rIdx, cIdx, e.target.value)}
                              className="w-full min-w-[60px] bg-transparent px-2 py-1.5 text-center text-slate-900 focus:bg-blue-50/40 focus:outline-none"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sub-Questions */}
      {question.subQuestions.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-700">زیرسؤال‌ها</span>
            <div className="flex items-center gap-2 text-xs">
              <select
                value={question.subLabelStyle}
                onChange={(e) =>
                  onChange({ ...question, subLabelStyle: e.target.value as SubQuestionLabelStyle })
                }
                className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
              >
                <option value="persian">شماره: الف، ب، ج</option>
                <option value="english">شماره: a, b, c</option>
                <option value="numeric">شماره: ۱، ۲، ۳</option>
              </select>
              <select
                value={question.subColumns}
                onChange={(e) =>
                  onChange({ ...question, subColumns: Number(e.target.value) as 1 | 2 })
                }
                className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
              >
                <option value={1}>تک‌ستونه</option>
                <option value={2}>دوستونه</option>
              </select>
            </div>
          </div>

          {question.subQuestions.map((sq, sIdx) => (
            <div
              key={sq.id}
              className="rounded-lg border border-slate-200 bg-slate-50/60 p-2.5"
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-800">
                  {getSubQuestionLabel(sIdx, question.subLabelStyle)}
                </span>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1 text-xs text-slate-600">
                    <span>بارم:</span>
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      dir="ltr"
                      value={sq.score}
                      onChange={(e) =>
                        updateSubQuestion(sq.id, {
                          score: Math.max(0, parseFloat(e.target.value) || 0),
                        })
                      }
                      className="w-16 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-center text-xs tabular-nums"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => removeSubQuestion(sq.id)}
                    className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    title="حذف زیرسؤال"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <RichTextEditor
                compact
                html={sq.textHtml}
                onChange={(textHtml) => updateSubQuestion(sq.id, { textHtml })}
                direction={sq.direction}
                onDirectionChange={(direction) => updateSubQuestion(sq.id, { direction })}
                placeholder={`متن ${getSubQuestionLabel(sIdx, question.subLabelStyle)} را بنویسید...`}
              />
            </div>
          ))}
        </div>
      )}

      {/* Question Attachment Action Bar */}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2.5">
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => imageInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <ImagePlus className="h-3.5 w-3.5 text-slate-500" />
          افزودن تصویر
        </button>

        <button
          type="button"
          onClick={() => setTableModalOpen((o) => !o)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <TableIcon className="h-3.5 w-3.5 text-slate-500" />
          درج جدول
        </button>

        <button
          type="button"
          onClick={() => setFormulaModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <Sigma className="h-3.5 w-3.5 text-slate-500" />
          فرمول مجزا
        </button>

        <button
          type="button"
          onClick={handleAddSubQuestion}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <Plus className="h-3.5 w-3.5 text-slate-500" />
          افزودن زیرسؤال
        </button>

        {question.subQuestions.length > 0 && (
          <span className="mr-auto text-xs text-slate-500 tabular-nums">
            جمع بارم زیرسؤال‌ها:{' '}
            {formatScore(question.subQuestions.reduce((sum, s) => sum + (s.score || 0), 0))}
          </span>
        )}
      </div>

      {/* Inline Table Dimension Picker */}
      {tableModalOpen && (
        <div className="mt-2.5 flex flex-wrap items-center gap-3 rounded-lg border border-blue-200 bg-blue-50/50 p-3 text-xs">
          <label className="flex items-center gap-1.5">
            <span>تعداد ردیف:</span>
            <input
              type="number"
              min={1}
              max={10}
              value={tableRows}
              onChange={(e) => setTableRows(Number(e.target.value))}
              className="w-14 rounded border border-slate-300 bg-white px-2 py-1 text-center tabular-nums"
            />
          </label>
          <label className="flex items-center gap-1.5">
            <span>تعداد ستون:</span>
            <input
              type="number"
              min={1}
              max={8}
              value={tableCols}
              onChange={(e) => setTableCols(Number(e.target.value))}
              className="w-14 rounded border border-slate-300 bg-white px-2 py-1 text-center tabular-nums"
            />
          </label>
          <button
            type="button"
            onClick={handleCreateTable}
            className="rounded-md bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-700"
          >
            ساخت جدول
          </button>
          <button
            type="button"
            onClick={() => setTableModalOpen(false)}
            className="text-slate-600 hover:text-slate-900"
          >
            بستن
          </button>
        </div>
      )}

      <MathFormulaModal
        isOpen={formulaModalOpen}
        onClose={() => setFormulaModalOpen(false)}
        onConfirm={handleAddDisplayFormula}
      />
    </div>
  );
};
