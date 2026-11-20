import React, { useEffect, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  List,
  ListOrdered,
  Sigma,
  Underline,
} from 'lucide-react';
import { renderLatexToHtml, renderRichHtmlWithMath } from '../services/mathRender';
import { TextAlignment, TextDirection } from '../types/exam';
import { detectTextDirection } from '../utils/jalali';
import { MathFormulaModal } from './MathFormulaModal';

interface RichTextEditorProps {
  html: string;
  onChange: (nextHtml: string) => void;
  direction: TextDirection;
  onDirectionChange: (dir: TextDirection) => void;
  align?: TextAlignment;
  onAlignChange?: (align: TextAlignment) => void;
  placeholder?: string;
  compact?: boolean;
}

const FONT_COLORS = [
  { label: 'مشکی', value: '#0f172a' },
  { label: 'سرمه‌ای', value: '#1e3a8a' },
  { label: 'آبی', value: '#2563eb' },
  { label: 'سبز تیره', value: '#166534' },
  { label: 'قرمز تیره', value: '#b91c1c' },
];

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  html,
  onChange,
  direction,
  onDirectionChange,
  align = 'right',
  onAlignChange,
  placeholder = 'متن سؤال را اینجا بنویسید...',
  compact = false,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const [mathModalOpen, setMathModalOpen] = useState(false);
  const [editingMathEl, setEditingMathEl] = useState<HTMLElement | null>(null);
  const [editingLatex, setEditingLatex] = useState('');
  const lastExternalHtmlRef = useRef<string>(html);

  const resolvedDirection = direction === 'auto' ? detectTextDirection(html) : direction;

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (html !== lastExternalHtmlRef.current || el.innerHTML === '') {
      const hydrated = renderRichHtmlWithMath(html);
      if (el.innerHTML !== hydrated) {
        el.innerHTML = hydrated;
      }
      lastExternalHtmlRef.current = html;
    }
  }, [html]);

  const emitCleanedHtml = () => {
    const el = editorRef.current;
    if (!el) return;
    // Clone to strip KaTeX internal markup inside data-latex spans for clean storage,
    // wait: keeping hydrated HTML is fine as long as mathRender re-hydrates, OR strip innerHTML of data-latex to keep storage small!
    const clone = el.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('[data-latex]').forEach((node) => {
      node.innerHTML = node.getAttribute('data-latex') ?? '';
    });
    const cleaned = clone.innerHTML;
    lastExternalHtmlRef.current = cleaned;
    onChange(cleaned);
  };

  const execCmd = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    emitCleanedHtml();
  };

  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    } else {
      savedRangeRef.current = null;
    }
  };

  const openNewFormula = () => {
    saveSelection();
    setEditingMathEl(null);
    setEditingLatex('');
    setMathModalOpen(true);
  };

  const handleEditorClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = (e.target as HTMLElement).closest('[data-latex]') as HTMLElement | null;
    if (target) {
      setEditingMathEl(target);
      setEditingLatex(target.getAttribute('data-latex') ?? '');
      setMathModalOpen(true);
    }
  };

  const handleConfirmFormula = (latex: string) => {
    const { html: renderedKatex } = renderLatexToHtml(latex, false);

    if (editingMathEl && editorRef.current?.contains(editingMathEl)) {
      editingMathEl.setAttribute('data-latex', latex);
      editingMathEl.innerHTML = renderedKatex;
      emitCleanedHtml();
    } else if (editorRef.current) {
      editorRef.current.focus();
      const sel = window.getSelection();
      if (savedRangeRef.current && sel) {
        sel.removeAllRanges();
        sel.addRange(savedRangeRef.current);
      }

      const span = document.createElement('span');
      span.setAttribute('data-latex', latex);
      span.setAttribute('contenteditable', 'false');
      span.setAttribute('dir', 'ltr');
      span.className = 'math-inline-node';
      span.innerHTML = renderedKatex;

      if (sel && sel.rangeCount > 0 && editorRef.current.contains(sel.anchorNode)) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(span);
        const space = document.createTextNode('\u00A0');
        span.after(space);
        range.setStartAfter(space);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      } else {
        editorRef.current.appendChild(span);
        editorRef.current.appendChild(document.createTextNode('\u00A0'));
      }
      emitCleanedHtml();
    }

    setMathModalOpen(false);
    setEditingMathEl(null);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
    emitCleanedHtml();
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/15">
      {/* Focused Simple Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50/70 px-2 py-1.5">
        <button
          type="button"
          title="پررنگ (Bold)"
          onMouseDown={(e) => {
            e.preventDefault();
            execCmd('bold');
          }}
          className="rounded p-1.5 text-slate-700 hover:bg-white hover:text-blue-600"
        >
          <Bold className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="مورب (Italic)"
          onMouseDown={(e) => {
            e.preventDefault();
            execCmd('italic');
          }}
          className="rounded p-1.5 text-slate-700 hover:bg-white hover:text-blue-600"
        >
          <Italic className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="زیرخط (Underline)"
          onMouseDown={(e) => {
            e.preventDefault();
            execCmd('underline');
          }}
          className="rounded p-1.5 text-slate-700 hover:bg-white hover:text-blue-600"
        >
          <Underline className="h-3.5 w-3.5" />
        </button>

        {!compact && (
          <>
            <span className="mx-0.5 h-4 w-px bg-slate-200" />
            <select
              aria-label="اندازه متن"
              defaultValue="3"
              onChange={(e) => execCmd('fontSize', e.target.value)}
              className="rounded border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-700 focus:outline-none"
            >
              <option value="2">کوچک</option>
              <option value="3">عادی</option>
              <option value="4">بزرگ</option>
              <option value="5">خیلی بزرگ</option>
            </select>

            <div className="flex items-center gap-0.5 px-1" title="رنگ متن">
              {FONT_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    execCmd('foreColor', c.value);
                  }}
                  className="h-4 w-4 rounded border border-slate-300 transition-transform hover:scale-110"
                  style={{ backgroundColor: c.value }}
                />
              ))}
            </div>

            <span className="mx-0.5 h-4 w-px bg-slate-200" />
            <button
              type="button"
              title="فهرست نشانه‌دار"
              onMouseDown={(e) => {
                e.preventDefault();
                execCmd('insertUnorderedList');
              }}
              className="rounded p-1.5 text-slate-700 hover:bg-white hover:text-blue-600"
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="فهرست شماره‌دار"
              onMouseDown={(e) => {
                e.preventDefault();
                execCmd('insertOrderedList');
              }}
              className="rounded p-1.5 text-slate-700 hover:bg-white hover:text-blue-600"
            >
              <ListOrdered className="h-3.5 w-3.5" />
            </button>
          </>
        )}

        {onAlignChange && (
          <>
            <span className="mx-0.5 h-4 w-px bg-slate-200" />
            <button
              type="button"
              title="راست‌چین"
              onClick={() => onAlignChange('right')}
              className={`rounded p-1.5 ${align === 'right' ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-white'}`}
            >
              <AlignRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="وسط‌چین"
              onClick={() => onAlignChange('center')}
              className={`rounded p-1.5 ${align === 'center' ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-white'}`}
            >
              <AlignCenter className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="چپ‌چین"
              onClick={() => onAlignChange('left')}
              className={`rounded p-1.5 ${align === 'left' ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-white'}`}
            >
              <AlignLeft className="h-3.5 w-3.5" />
            </button>
          </>
        )}

        <span className="mx-0.5 h-4 w-px bg-slate-200" />
        {/* Direction toggle */}
        <select
          aria-label="جهت متن"
          value={direction}
          onChange={(e) => onDirectionChange(e.target.value as TextDirection)}
          className="rounded border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-700 focus:outline-none"
        >
          <option value="auto">جهت: خودکار</option>
          <option value="rtl">راست‌به‌چپ (فارسی)</option>
          <option value="ltr">چپ‌به‌چپ (انگلیسی)</option>
        </select>

        <button
          type="button"
          onClick={openNewFormula}
          className="mr-auto inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors whitespace-nowrap shrink-0"
        >
          <Sigma className="h-3.5 w-3.5" />
          درج فرمول
        </button>
      </div>

      {/* Editable Surface */}
      <div className="relative">
        {!html.replace(/<[^>]+>/g, '').trim() && !html.includes('data-latex') && (
          <div className="pointer-events-none absolute right-3 top-2.5 text-sm text-slate-400">
            {placeholder}
          </div>
        )}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          dir={resolvedDirection}
          onInput={emitCleanedHtml}
          onBlur={emitCleanedHtml}
          onPaste={handlePaste}
          onClick={handleEditorClick}
          style={{ textAlign: align }}
          className={`editor-editable exam-rich-content w-full px-3 py-2.5 text-sm leading-relaxed text-slate-900 focus:outline-none ${
            compact ? 'min-h-[48px]' : 'min-h-[84px]'
          }`}
        />
      </div>

      <MathFormulaModal
        isOpen={mathModalOpen}
        initialLatex={editingLatex}
        onClose={() => {
          setMathModalOpen(false);
          setEditingMathEl(null);
        }}
        onConfirm={handleConfirmFormula}
      />
    </div>
  );
};
