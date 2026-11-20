import React, { useEffect, useRef, useState } from 'react';
import { X, Check } from 'lucide-react';
import { FORMULA_PRESETS, MATH_SYMBOLS, renderLatexToHtml } from '../services/mathRender';

interface MathFormulaModalProps {
  isOpen: boolean;
  initialLatex?: string;
  onClose: () => void;
  onConfirm: (latex: string) => void;
}

export const MathFormulaModal: React.FC<MathFormulaModalProps> = ({
  isOpen,
  initialLatex = '',
  onClose,
  onConfirm,
}) => {
  const [latex, setLatex] = useState(initialLatex);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setLatex(initialLatex || '\\frac{a}{b}');
      setTimeout(() => textareaRef.current?.focus(), 60);
    }
  }, [isOpen, initialLatex]);

  if (!isOpen) return null;

  const { html: previewHtml, error } = renderLatexToHtml(latex, true);

  const insertSnippet = (snippet: string) => {
    const el = textareaRef.current;
    if (!el) {
      setLatex((prev) => prev + snippet);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = latex.slice(0, start) + snippet + latex.slice(end);
    setLatex(next);
    setTimeout(() => {
      el.focus();
      const pos = start + snippet.length;
      el.setSelectionRange(pos, pos);
    }, 10);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!latex.trim()) return;
    onConfirm(latex.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[1px]">
      <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <h3 className="text-base font-semibold text-slate-900">فرمول‌نویس ریاضی</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="بستن"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {/* Quick Symbols Bar */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-600">نمادها و ساختارهای پرکاربرد:</p>
            <div className="flex flex-wrap gap-1.5">
              {MATH_SYMBOLS.map((sym) => (
                <button
                  key={sym.label + sym.title}
                  type="button"
                  title={sym.title}
                  onClick={() => insertSnippet(sym.insert)}
                  className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-xs font-medium text-slate-800 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                >
                  {sym.label}
                </button>
              ))}
            </div>
          </div>

          {/* Formula Templates */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-600">الگوهای آماده (با کلیک جایگزین یا اضافه کنید):</p>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {FORMULA_PRESETS.slice(0, 8).map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setLatex(preset.latex)}
                  className="truncate rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-right text-xs text-slate-700 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* LaTeX Editor */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">کد فرمول (LaTeX):</label>
            <textarea
              ref={textareaRef}
              dir="ltr"
              rows={3}
              value={latex}
              onChange={(e) => setLatex(e.target.value)}
              placeholder="مثال: \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Live KaTeX Preview */}
          <div>
            <p className="mb-1 text-xs font-medium text-slate-600">پیش‌نمایش زنده فرمول:</p>
            <div className="flex min-h-[76px] items-center justify-center rounded-lg border border-slate-200 bg-white p-4">
              {latex.trim() ? (
                <div
                  dir="ltr"
                  className="exam-rich-content text-lg text-slate-900"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              ) : (
                <span className="text-xs text-slate-400">فرمولی وارد نشده است</span>
              )}
            </div>
            {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={!latex.trim() || Boolean(error)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              درج فرمول در سؤال
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
