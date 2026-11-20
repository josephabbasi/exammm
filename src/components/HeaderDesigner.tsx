import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownToLine,
  ArrowUpToLine,
  Bold,
  Check,
  Columns,
  Combine,
  Eye,
  ImagePlus,
  LayoutGrid,
  MoveVertical,
  Plus,
  Rows,
  SlidersHorizontal,
  Split,
  Trash2,
  X,
} from 'lucide-react';
import {
  CellBorderStyle,
  DesignedHeader,
  ExamInfo,
  HeaderCell,
  HeaderCellImage,
  HeaderCellStyle,
  PageSettings,
  TextAlignment,
  TextDirection,
  VerticalAlignment,
} from '../types/exam';
import { DYNAMIC_FIELDS } from '../utils/headerDynamicFields';
import {
  SelectionBounds,
  buildGridMap,
  canMergeBounds,
  deleteColumnAt,
  deleteRowAt,
  expandSelectionBounds,
  insertColumnAt,
  insertRowAt,
  mergeCellsInBounds,
  splitMergedCell,
  updateColumnWidth,
} from '../utils/headerGrid';
import { toPersianDigits } from '../utils/jalali';
import { ExamHeaderRenderer } from './ExamHeaderRenderer';
import { ExamTableColGroup, ExamTableHeaderRow } from './QuestionSheetRenderer';

const MM_TO_PX = 3.7795275591;

const CELL_BG_PRESETS = [
  { label: 'سفید', value: '#ffffff' },
  { label: 'خاکستری روشن', value: '#f8fafc' },
  { label: 'خاکستری ملایم', value: '#f1f5f9' },
  { label: 'آبی بسیار روشن', value: '#eff6ff' },
];

const TEXT_COLOR_PRESETS = [
  { label: 'مشکی', value: '#0f172a' },
  { label: 'خاکستری تیره', value: '#334155' },
  { label: 'سرمه‌ای', value: '#1e3a8a' },
  { label: 'قرمز تیره', value: '#991b1b' },
];

interface HeaderDesignerProps {
  initialHeader: DesignedHeader;
  pageSettings: PageSettings;
  examInfo?: ExamInfo;
  onSave: (header: DesignedHeader) => Promise<void> | void;
  onCancel: () => void;
  saveButtonLabel?: string;
}

export const HeaderDesigner: React.FC<HeaderDesignerProps> = ({
  initialHeader,
  pageSettings,
  examInfo,
  onSave,
  onCancel,
  saveButtonLabel = 'ذخیره سربرگ',
}) => {
  const [header, setHeader] = useState<DesignedHeader>(() =>
    JSON.parse(JSON.stringify(initialHeader))
  );
  const [viewTab, setViewTab] = useState<'design' | 'preview'>('design');
  const [selectedBounds, setSelectedBounds] = useState<SelectionBounds | null>(null);
  const [dragAnchor, setDragAnchor] = useState<{ r: number; c: number } | null>(null);
  const [isSelectingRange, setIsSelectingRange] = useState(false);
  const [editingCellId, setEditingCellId] = useState<string | null>(null);
  const [fieldMenuOpen, setFieldMenuOpen] = useState(false);
  const [tableSettingsOpen, setTableSettingsOpen] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const tableRef = useRef<HTMLTableElement>(null);
  const cellImageInputRef = useRef<HTMLInputElement>(null);
  const cellTextareaRef = useRef<HTMLTextAreaElement>(null);
  const fieldMenuRef = useRef<HTMLDivElement>(null);

  const grid = useMemo(() => buildGridMap(header), [header]);

  // Close dynamic fields popover on outside click
  useEffect(() => {
    const onDocDown = (e: MouseEvent) => {
      if (fieldMenuRef.current && !fieldMenuRef.current.contains(e.target as Node)) {
        setFieldMenuOpen(false);
      }
    };
    if (fieldMenuOpen) document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [fieldMenuOpen]);

  // End mouse range selection globally
  useEffect(() => {
    const onMouseUp = () => setIsSelectingRange(false);
    window.addEventListener('mouseup', onMouseUp);
    return () => window.removeEventListener('mouseup', onMouseUp);
  }, []);

  const expandedSelection = useMemo(() => {
    if (!selectedBounds) return null;
    return expandSelectionBounds(header, selectedBounds);
  }, [header, selectedBounds]);

  // Primary selected cell (anchor at selection start)
  const activeCell: HeaderCell | null = useMemo(() => {
    if (!expandedSelection) return null;
    const slot = grid[expandedSelection.r1]?.[expandedSelection.c1];
    return slot?.cell ?? null;
  }, [expandedSelection, grid]);

  const selectedCellsCount = useMemo(() => {
    if (!expandedSelection) return 0;
    return header.cells.filter(
      (cell) =>
        cell.row >= expandedSelection.r1 &&
        cell.row <= expandedSelection.r2 &&
        cell.col >= expandedSelection.c1 &&
        cell.col <= expandedSelection.c2
    ).length;
  }, [header.cells, expandedSelection]);

  const canMerge = useMemo(
    () => (expandedSelection ? canMergeBounds(header, expandedSelection) : false),
    [header, expandedSelection]
  );

  const canSplit = Boolean(activeCell && (activeCell.rowSpan > 1 || activeCell.colSpan > 1));

  const isCellInSelection = (cell: HeaderCell): boolean => {
    if (!expandedSelection) return false;
    return (
      cell.row >= expandedSelection.r1 &&
      cell.row <= expandedSelection.r2 &&
      cell.col >= expandedSelection.c1 &&
      cell.col <= expandedSelection.c2
    );
  };

  const updateSelectedCells = (updater: (cell: HeaderCell) => HeaderCell) => {
    if (!expandedSelection) return;
    setHeader((prev) => ({
      ...prev,
      cells: prev.cells.map((c) => {
        const inside =
          c.row >= expandedSelection.r1 &&
          c.row <= expandedSelection.r2 &&
          c.col >= expandedSelection.c1 &&
          c.col <= expandedSelection.c2;
        return inside ? updater(c) : c;
      }),
    }));
  };

  const updateSelectedStyle = (patch: Partial<HeaderCellStyle>) => {
    updateSelectedCells((c) => ({
      ...c,
      style: { ...c.style, ...patch },
    }));
  };

  const updateActiveCell = (patch: Partial<HeaderCell>) => {
    if (!activeCell) return;
    setHeader((prev) => ({
      ...prev,
      cells: prev.cells.map((c) => (c.id === activeCell.id ? { ...c, ...patch } : c)),
    }));
  };

  // Cell mouse selection (single click, Shift+Click range, or click-drag range)
  const handleCellMouseDown = (cell: HeaderCell, e: React.MouseEvent) => {
    if (editingCellId === cell.id) return;
    setEditingCellId(null);

    if (e.shiftKey && dragAnchor) {
      setSelectedBounds({
        r1: dragAnchor.r,
        r2: cell.row + cell.rowSpan - 1,
        c1: dragAnchor.c,
        c2: cell.col + cell.colSpan - 1,
      });
      return;
    }

    setDragAnchor({ r: cell.row, c: cell.col });
    setSelectedBounds({
      r1: cell.row,
      r2: cell.row + cell.rowSpan - 1,
      c1: cell.col,
      c2: cell.col + cell.colSpan - 1,
    });
    setIsSelectingRange(true);
  };

  const handleCellMouseEnter = (cell: HeaderCell) => {
    if (!isSelectingRange || !dragAnchor) return;
    setSelectedBounds({
      r1: Math.min(dragAnchor.r, cell.row),
      r2: Math.max(dragAnchor.r, cell.row + cell.rowSpan - 1),
      c1: Math.min(dragAnchor.c, cell.col),
      c2: Math.max(dragAnchor.c, cell.col + cell.colSpan - 1),
    });
  };

  // Structure actions
  const handleAddRow = (position: 'above' | 'below') => {
    const idx = expandedSelection
      ? position === 'above'
        ? expandedSelection.r1
        : expandedSelection.r2 + 1
      : header.rowHeightsMm.length;
    setHeader((prev) => insertRowAt(prev, idx));
    setSelectedBounds({ r1: idx, r2: idx, c1: 0, c2: 0 });
  };

  const handleDeleteRow = () => {
    if (!expandedSelection || header.rowHeightsMm.length <= 1) return;
    const targetRow = expandedSelection.r1;
    setHeader((prev) => deleteRowAt(prev, targetRow));
    setSelectedBounds(null);
  };

  const handleAddCol = (side: 'right' | 'left') => {
    // In RTL, col 0 is rightmost; adding to 'right' inserts at c1, adding to 'left' inserts at c2 + 1
    const idx = expandedSelection
      ? side === 'right'
        ? expandedSelection.c1
        : expandedSelection.c2 + 1
      : header.colWidthsPercent.length;
    setHeader((prev) => insertColumnAt(prev, idx));
    setSelectedBounds({ r1: 0, r2: 0, c1: idx, c2: idx });
  };

  const handleDeleteCol = () => {
    if (!expandedSelection || header.colWidthsPercent.length <= 1) return;
    const targetCol = expandedSelection.c1;
    setHeader((prev) => deleteColumnAt(prev, targetCol));
    setSelectedBounds(null);
  };

  const handleMerge = () => {
    if (!expandedSelection || !canMerge) return;
    const { header: next } = mergeCellsInBounds(header, expandedSelection);
    setHeader(next);
    setSelectedBounds({
      r1: expandedSelection.r1,
      r2: expandedSelection.r2,
      c1: expandedSelection.c1,
      c2: expandedSelection.c2,
    });
  };

  const handleSplit = () => {
    if (!activeCell || !canSplit) return;
    setHeader((prev) => splitMergedCell(prev, activeCell.id));
    setSelectedBounds({
      r1: activeCell.row,
      r2: activeCell.row,
      c1: activeCell.col,
      c2: activeCell.col,
    });
  };

  // Interactive column drag-resizer (RTL-aware: dragging left increases right-column width)
  const startColumnResize = (colIdx: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const tableWidth = tableRef.current?.getBoundingClientRect().width || 680;
    const startX = e.clientX;
    const startW = header.colWidthsPercent[colIdx];
    const startNextW = header.colWidthsPercent[colIdx + 1];
    if (startNextW === undefined) return;
    const pairTotal = startW + startNextW;

    const onMove = (moveEvent: MouseEvent) => {
      // In RTL, colIdx is to the RIGHT of colIdx+1. Moving pointer LEFT (negative dx) widens colIdx.
      const dx = startX - moveEvent.clientX;
      const deltaPercent = (dx / tableWidth) * 100;
      const nextW = Math.max(6, Math.min(pairTotal - 6, startW + deltaPercent));
      const nextRightW = pairTotal - nextW;

      setHeader((prev) => {
        const nextCols = [...prev.colWidthsPercent];
        nextCols[colIdx] = Math.round(nextW * 10) / 10;
        nextCols[colIdx + 1] = Math.round(nextRightW * 10) / 10;
        return { ...prev, colWidthsPercent: nextCols };
      });
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Interactive row height drag-resizer
  const startRowResize = (rowIdx: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startMm = header.rowHeightsMm[rowIdx] || 10;

    const onMove = (moveEvent: MouseEvent) => {
      const dyMm = (moveEvent.clientY - startY) / MM_TO_PX;
      const nextMm = Math.max(6, Math.min(65, Math.round(startMm + dyMm)));
      setHeader((prev) => {
        const nextRows = [...prev.rowHeightsMm];
        nextRows[rowIdx] = nextMm;
        return { ...prev, rowHeightsMm: nextRows };
      });
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Insert dynamic field token into active cell
  const insertDynamicToken = (token: string) => {
    if (!activeCell) return;
    const ta = cellTextareaRef.current;
    if (ta) {
      const start = ta.selectionStart ?? activeCell.text.length;
      const end = ta.selectionEnd ?? activeCell.text.length;
      const nextText = activeCell.text.slice(0, start) + token + activeCell.text.slice(end);
      updateActiveCell({ text: nextText });
      setTimeout(() => {
        ta.focus();
        const pos = start + token.length;
        ta.setSelectionRange(pos, pos);
      }, 15);
    } else {
      const sep = activeCell.text && !activeCell.text.endsWith(' ') ? ' ' : '';
      updateActiveCell({ text: activeCell.text + sep + token });
    }
    setFieldMenuOpen(false);
  };

  // Insert logo/image directly into active cell (PNG, JPG, JPEG preserving aspect ratio)
  const handleCellImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !activeCell) return;
    setImageError(null);

    const lower = file.name.toLowerCase();
    const valid =
      lower.endsWith('.png') ||
      lower.endsWith('.jpg') ||
      lower.endsWith('.jpeg') ||
      file.type === 'image/png' ||
      file.type === 'image/jpeg';

    if (!valid) {
      setImageError('فقط تصاویر با فرمت PNG، JPG و JPEG برای درج در سلول مجاز هستند.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      const dataUrl = reader.result;
      const img = new Image();
      img.onload = () => {
        const newImg: HeaderCellImage = {
          dataUrl,
          widthMm: 18,
          naturalWidth: img.naturalWidth || 200,
          naturalHeight: img.naturalHeight || 200,
          align: 'center',
        };
        updateActiveCell({ image: newImg });
      };
      img.onerror = () => {
        setImageError('تصویر انتخاب‌شده قابل خواندن نیست.');
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveClick = async () => {
    setSaving(true);
    try {
      await onSave({
        ...header,
        name: header.name.trim() || 'سربرگ بدون نام',
      });
    } finally {
      setSaving(false);
    }
  };

  const outerBorderCss =
    header.outerBorderStyle === 'none' || header.outerBorderWidthPx <= 0
      ? '1px dashed #cbd5e1'
      : `${header.outerBorderWidthPx}px ${header.outerBorderStyle} ${header.outerBorderColor}`;

  const getCellBorderCss = (w: number, style: CellBorderStyle, color: string) =>
    w <= 0 || style === 'none' ? '1px dashed #e2e8f0' : `${w}px ${style} ${color}`;

  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-xs">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-bold text-slate-900">طراح سربرگ</span>
          </div>
          <input
            type="text"
            value={header.name}
            onChange={(e) => setHeader((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="نام سربرگ (مثلاً سربرگ دبیرستان)"
            className="w-52 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
          />

          {/* Editor vs A4 Preview Toggle */}
          <div className="flex items-center rounded-lg bg-slate-100 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setViewTab('design')}
              className={`inline-flex items-center gap-1 rounded-md px-3 py-1 font-medium transition-colors whitespace-nowrap ${
                viewTab === 'design'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              بوم طراحی
            </button>
            <button
              type="button"
              onClick={() => setViewTab('preview')}
              className={`inline-flex items-center gap-1 rounded-md px-3 py-1 font-medium transition-colors whitespace-nowrap ${
                viewTab === 'preview'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              پیش‌نمایش واقعی A4
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <X className="h-3.5 w-3.5" />
            انصراف
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSaveClick}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60 whitespace-nowrap"
          >
            <Check className="h-3.5 w-3.5" />
            {saving ? 'در حال ذخیره...' : saveButtonLabel}
          </button>
        </div>
      </div>

      {/* Compact Structure & Insert Toolbar (visible in Design mode) */}
      {viewTab === 'design' && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 bg-slate-50/80 px-4 py-2 text-xs">
          {/* Row controls */}
          <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
            <button
              type="button"
              onClick={() => handleAddRow('above')}
              title="افزودن سطر در بالا"
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <Rows className="h-3.5 w-3.5 text-slate-500" />
              + سطر بالا
            </button>
            <button
              type="button"
              onClick={() => handleAddRow('below')}
              title="افزودن سطر در پایین"
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              + سطر پایین
            </button>
            <button
              type="button"
              disabled={!expandedSelection || header.rowHeightsMm.length <= 1}
              onClick={handleDeleteRow}
              title="حذف سطر انتخاب‌شده"
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-red-600 hover:bg-red-50 disabled:opacity-40 whitespace-nowrap"
            >
              حذف سطر
            </button>
          </div>

          {/* Column controls */}
          <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
            <button
              type="button"
              onClick={() => handleAddCol('right')}
              title="افزودن ستون در راست"
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <Columns className="h-3.5 w-3.5 text-slate-500" />
              + ستون راست
            </button>
            <button
              type="button"
              onClick={() => handleAddCol('left')}
              title="افزودن ستون در چپ"
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              + ستون چپ
            </button>
            <button
              type="button"
              disabled={!expandedSelection || header.colWidthsPercent.length <= 1}
              onClick={handleDeleteCol}
              title="حذف ستون انتخاب‌شده"
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-red-600 hover:bg-red-50 disabled:opacity-40 whitespace-nowrap"
            >
              حذف ستون
            </button>
          </div>

          {/* Merge / Split controls */}
          <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
            <button
              type="button"
              disabled={!canMerge}
              onClick={handleMerge}
              title="برای ادغام، چند سلول را با کشیدن ماوس یا کلید Shift انتخاب کنید"
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-800 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-40 whitespace-nowrap"
            >
              <Combine className="h-3.5 w-3.5" />
              ادغام سلول‌ها
            </button>
            <button
              type="button"
              disabled={!canSplit}
              onClick={handleSplit}
              title="جداسازی سلول ادغام‌شده"
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-800 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-40 whitespace-nowrap"
            >
              <Split className="h-3.5 w-3.5" />
              جدا کردن سلول
            </button>
          </div>

          {/* Insert Dynamic Field */}
          <div ref={fieldMenuRef} className="relative">
            <button
              type="button"
              disabled={!activeCell}
              onClick={() => setFieldMenuOpen((o) => !o)}
              className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-40 whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" />
              درج فیلد پویا
            </button>

            {fieldMenuOpen && activeCell && (
              <div className="absolute right-0 top-full z-40 mt-1.5 w-60 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                <p className="px-2 py-1 text-[11px] font-medium text-slate-500">
                  مقدار این فیلدها از مشخصات امتحان پر می‌شود:
                </p>
                <div className="max-h-64 overflow-y-auto">
                  {DYNAMIC_FIELDS.map((f) => (
                    <button
                      key={f.token}
                      type="button"
                      onClick={() => insertDynamicToken(f.token)}
                      className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-right text-xs text-slate-800 hover:bg-blue-50 hover:text-blue-700"
                    >
                      <span>{f.label}</span>
                      <span dir="ltr" className="font-mono text-[10px] text-slate-400">
                        {f.token}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Insert Logo/Image into active cell */}
          <input
            ref={cellImageInputRef}
            type="file"
            accept=".png,.jpg,.jpeg,image/png,image/jpeg"
            onChange={handleCellImageUpload}
            className="hidden"
          />
          <button
            type="button"
            disabled={!activeCell}
            onClick={() => cellImageInputRef.current?.click()}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 whitespace-nowrap"
          >
            <ImagePlus className="h-3.5 w-3.5 text-blue-600" />
            درج لوگو در سلول
          </button>

          {/* Table Outer Frame Settings */}
          <button
            type="button"
            onClick={() => setTableSettingsOpen((o) => !o)}
            className={`mr-auto inline-flex items-center gap-1 rounded-md border px-2.5 py-1 font-medium whitespace-nowrap ${
              tableSettingsOpen
                ? 'border-blue-300 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            کادر بیرونی و عنوان بالا
          </button>
        </div>
      )}

      {/* Optional Table-Wide Settings Strip */}
      {viewTab === 'design' && tableSettingsOpen && (
        <div className="flex flex-wrap items-center gap-4 border-b border-slate-200 bg-blue-50/40 px-4 py-2.5 text-xs">
          <label className="flex items-center gap-2">
            <span className="font-medium text-slate-700">عبارت بالای سربرگ:</span>
            <input
              type="text"
              value={header.bismillahText}
              onChange={(e) => setHeader((prev) => ({ ...prev, bismillahText: e.target.value }))}
              placeholder="مثلاً به نام خدا (خالی = عدم نمایش)"
              className="w-44 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs"
            />
          </label>
          <label className="flex items-center gap-2">
            <span className="font-medium text-slate-700">کادر دور جدول:</span>
            <select
              value={header.outerBorderStyle}
              onChange={(e) =>
                setHeader((prev) => ({
                  ...prev,
                  outerBorderStyle: e.target.value as DesignedHeader['outerBorderStyle'],
                }))
              }
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
            >
              <option value="solid">خط ساده</option>
              <option value="double">خط دوگانه رسمی</option>
              <option value="none">بدون کادر بیرونی</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="font-medium text-slate-700">ضخامت کادر:</span>
            <select
              value={header.outerBorderWidthPx}
              onChange={(e) =>
                setHeader((prev) => ({
                  ...prev,
                  outerBorderWidthPx: Number(e.target.value),
                }))
              }
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs tabular-nums"
            >
              <option value={1}>۱ پیکسل</option>
              <option value={1.5}>۱٫۵ پیکسل</option>
              <option value={2}>۲ پیکسل</option>
              <option value={3}>۳ پیکسل (مناسب دوخطی)</option>
            </select>
          </label>
        </div>
      )}

      {imageError && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
          {imageError}
        </div>
      )}

      {/* Main Content Area: Design Canvas + Contextual Cell Properties OR Live A4 Preview */}
      {viewTab === 'design' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12">
          {/* Center Visual A4 Canvas */}
          <div className="overflow-x-auto bg-slate-100/70 p-5 lg:col-span-8">
            <div className="mb-2 flex items-center justify-between text-[11px] text-slate-500">
              <span>
                روی هر سلول کلیک کنید تا ویرایش شود. برای ادغام، چند سلول را با کشیدن ماوس یا نگه داشتن Shift انتخاب کنید.
              </span>
              <span className="tabular-nums whitespace-nowrap">
                {toPersianDigits(header.rowHeightsMm.length)} سطر ×{' '}
                {toPersianDigits(header.colWidthsPercent.length)} ستون
              </span>
            </div>

            {/* Simulated A4 Paper Top Sheet */}
            <div className="mx-auto min-w-[540px] max-w-[740px] rounded-md bg-white p-6 shadow-sm ring-1 ring-slate-300/80">
              {header.bismillahText.trim() && (
                <div className="mb-1.5 text-center text-xs font-semibold text-slate-800">
                  {header.bismillahText}
                </div>
              )}

              {/* Column Width Guides + Drag Resize Handles */}
              <div className="relative mb-1 flex w-full select-none" dir="rtl">
                {header.colWidthsPercent.map((w, cIdx) => (
                  <div
                    key={cIdx}
                    style={{ width: `${w}%` }}
                    className="relative flex items-center justify-center border-x border-slate-200 bg-slate-50 py-0.5 text-[10px] text-slate-500 tabular-nums"
                  >
                    <span>{toPersianDigits(Math.round(w))}٪</span>
                    {cIdx < header.colWidthsPercent.length - 1 && (
                      <div
                        onMouseDown={(e) => startColumnResize(cIdx, e)}
                        title="برای تغییر عرض ستون بکشید"
                        className="absolute -left-1.5 top-0 bottom-0 z-20 w-3 cursor-col-resize hover:bg-blue-400/30"
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* Editable Header Table */}
              <div className="relative select-none">
                <table
                  ref={tableRef}
                  dir="rtl"
                  className="w-full table-fixed border-collapse"
                  style={{
                    border: outerBorderCss,
                    fontFamily: `${pageSettings.persianFont}, ${pageSettings.latinFont}, sans-serif`,
                  }}
                >
                  <colgroup>
                    {header.colWidthsPercent.map((w, idx) => (
                      <col key={idx} style={{ width: `${w}%` }} />
                    ))}
                  </colgroup>
                  <tbody>
                    {header.rowHeightsMm.map((rowH, rIdx) => (
                      <tr
                        key={rIdx}
                        style={{
                          height: rowH > 0 ? `${rowH * MM_TO_PX}px` : undefined,
                        }}
                      >
                        {header.colWidthsPercent.map((_, cIdx) => {
                          const slot = grid[rIdx]?.[cIdx];
                          if (!slot || !slot.isAnchor) return null;
                          const cell = slot.cell;
                          const selected = isCellInSelection(cell);
                          const isPrimary = activeCell?.id === cell.id;
                          const isEditingInline = editingCellId === cell.id;

                          return (
                            <td
                              key={cell.id}
                              rowSpan={cell.rowSpan}
                              colSpan={cell.colSpan}
                              onMouseDown={(e) => handleCellMouseDown(cell, e)}
                              onMouseEnter={() => handleCellMouseEnter(cell)}
                              onDoubleClick={() => setEditingCellId(cell.id)}
                              style={{
                                verticalAlign: cell.style.verticalAlign,
                                backgroundColor: selected
                                  ? '#eff6ff'
                                  : cell.style.backgroundColor || '#ffffff',
                                paddingTop: `${cell.style.paddingYpx}px`,
                                paddingBottom: `${cell.style.paddingYpx}px`,
                                paddingRight: `${cell.style.paddingXpx}px`,
                                paddingLeft: `${cell.style.paddingXpx}px`,
                                borderTop: getCellBorderCss(
                                  cell.style.borderTop,
                                  cell.style.borderStyle,
                                  cell.style.borderColor
                                ),
                                borderRight: getCellBorderCss(
                                  cell.style.borderRight,
                                  cell.style.borderStyle,
                                  cell.style.borderColor
                                ),
                                borderBottom: getCellBorderCss(
                                  cell.style.borderBottom,
                                  cell.style.borderStyle,
                                  cell.style.borderColor
                                ),
                                borderLeft: getCellBorderCss(
                                  cell.style.borderLeft,
                                  cell.style.borderStyle,
                                  cell.style.borderColor
                                ),
                                outline: isPrimary
                                  ? '2px solid #2563eb'
                                  : selected
                                    ? '1.5px solid #60a5fa'
                                    : undefined,
                                outlineOffset: '-2px',
                                position: 'relative',
                                cursor: 'pointer',
                              }}
                            >
                              <div className="flex flex-col gap-1">
                                {cell.image && cell.imagePosition === 'top' && (
                                  <div
                                    className={`flex w-full ${
                                      cell.image.align === 'center'
                                        ? 'justify-center'
                                        : cell.image.align === 'left'
                                          ? 'justify-end'
                                          : 'justify-start'
                                    }`}
                                  >
                                    <img
                                      src={cell.image.dataUrl}
                                      alt="لوگو"
                                      draggable={false}
                                      style={{
                                        width: `${Math.max(6, cell.image.widthMm) * MM_TO_PX}px`,
                                        maxWidth: '100%',
                                        height: 'auto',
                                        objectFit: 'contain',
                                      }}
                                    />
                                  </div>
                                )}

                                {isEditingInline ? (
                                  <textarea
                                    autoFocus
                                    rows={2}
                                    value={cell.text}
                                    onChange={(e) => updateActiveCell({ text: e.target.value })}
                                    onBlur={() => setEditingCellId(null)}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    className="w-full resize-none rounded border border-blue-400 bg-white p-1 text-xs text-slate-900 focus:outline-none"
                                    style={{
                                      textAlign: cell.style.align,
                                      fontSize: `${cell.style.fontSizePt}pt`,
                                      fontWeight: cell.style.bold ? 700 : 400,
                                    }}
                                  />
                                ) : (
                                  <div
                                    dir={cell.style.direction === 'auto' ? 'rtl' : cell.style.direction}
                                    style={{
                                      textAlign: cell.style.align,
                                      fontSize: `${cell.style.fontSizePt}pt`,
                                      fontWeight: cell.style.bold ? 700 : 400,
                                      color: cell.style.textColor || '#0f172a',
                                      lineHeight: 1.5,
                                      minHeight: '1.3em',
                                      whiteSpace: 'pre-wrap',
                                      wordBreak: 'break-word',
                                    }}
                                  >
                                    {cell.text || (
                                      <span className="text-[11px] font-normal text-slate-300">
                                        {cell.image ? '' : 'خالی'}
                                      </span>
                                    )}
                                  </div>
                                )}

                                {cell.image && cell.imagePosition === 'bottom' && (
                                  <div
                                    className={`flex w-full ${
                                      cell.image.align === 'center'
                                        ? 'justify-center'
                                        : cell.image.align === 'left'
                                          ? 'justify-end'
                                          : 'justify-start'
                                    }`}
                                  >
                                    <img
                                      src={cell.image.dataUrl}
                                      alt="لوگو"
                                      draggable={false}
                                      style={{
                                        width: `${Math.max(6, cell.image.widthMm) * MM_TO_PX}px`,
                                        maxWidth: '100%',
                                        height: 'auto',
                                        objectFit: 'contain',
                                      }}
                                    />
                                  </div>
                                )}
                              </div>

                              {/* Bottom Row Height Drag Handle on the leftmost cell of each row */}
                              {cell.col + cell.colSpan === header.colWidthsPercent.length && (
                                <div
                                  onMouseDown={(e) =>
                                    startRowResize(cell.row + cell.rowSpan - 1, e)
                                  }
                                  title="برای تغییر ارتفاع سطر بکشید"
                                  className="absolute -bottom-1 left-0 right-0 z-20 h-2 cursor-row-resize hover:bg-blue-400/35"
                                />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Compact Inline Real Preview Below Canvas */}
              <div className="mt-6 border-t border-slate-200 pt-4">
                <div className="mb-2 flex items-center justify-between text-[11px] font-medium text-slate-500">
                  <span>پیش‌نمایش زنده خروجی نهایی (با مقادیر جایگزین‌شده فیلدهای پویا):</span>
                </div>
                <ExamHeaderRenderer
                  header={header}
                  examInfo={examInfo}
                  pageSettings={pageSettings}
                  useSampleValues={!examInfo}
                />
              </div>
            </div>
          </div>

          {/* Contextual Cell Properties Panel (Side Panel) */}
          <div className="border-t border-slate-200 bg-white p-4 lg:col-span-4 lg:border-r lg:border-t-0">
            {!activeCell ? (
              <div className="flex h-full min-h-[260px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center">
                <LayoutGrid className="mb-2 h-6 w-6 text-slate-400" />
                <p className="text-xs font-semibold text-slate-700">یک سلول را انتخاب کنید</p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                  برای ویرایش متن، درج فیلد پویا، افزودن لوگو، تنظیم کادر، فونت یا ادغام سلول‌ها روی یکی از سلول‌های جدول کلیک کنید.
                </p>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="font-bold text-slate-900">
                    تنظیمات سلول
                    {selectedCellsCount > 1 &&
                      ` (${toPersianDigits(selectedCellsCount)} سلول انتخاب‌شده)`}
                  </span>
                  <span className="text-[11px] text-slate-400 tabular-nums">
                    سطر {toPersianDigits(activeCell.row + 1)}، ستون{' '}
                    {toPersianDigits(activeCell.col + 1)}
                  </span>
                </div>

                {/* 1. Text & Dynamic Fields */}
                <div>
                  <label className="mb-1 block font-medium text-slate-700">متن سلول</label>
                  <textarea
                    ref={cellTextareaRef}
                    rows={3}
                    value={activeCell.text}
                    onChange={(e) => updateActiveCell({ text: e.target.value })}
                    placeholder="متن ثابت یا فیلد پویا را بنویسید..."
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                  />
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {DYNAMIC_FIELDS.slice(0, 8).map((f) => (
                      <button
                        key={f.token}
                        type="button"
                        onClick={() => insertDynamicToken(f.token)}
                        className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                      >
                        + {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Cell Logo / Image */}
                <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-700">لوگو / تصویر داخل سلول</span>
                    <button
                      type="button"
                      onClick={() => cellImageInputRef.current?.click()}
                      className="inline-flex items-center gap-1 rounded bg-white px-2 py-1 text-[11px] font-medium text-blue-700 ring-1 ring-slate-200 hover:bg-blue-50"
                    >
                      <ImagePlus className="h-3 w-3" />
                      {activeCell.image ? 'تغییر تصویر' : 'افزودن لوگو'}
                    </button>
                  </div>

                  {activeCell.image && (
                    <div className="mt-2.5 space-y-2 border-t border-slate-200 pt-2">
                      <label className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-600">
                          عرض ({toPersianDigits(activeCell.image.widthMm)} mm):
                        </span>
                        <input
                          type="range"
                          min={8}
                          max={60}
                          value={activeCell.image.widthMm}
                          onChange={(e) =>
                            updateActiveCell({
                              image: { ...activeCell.image!, widthMm: Number(e.target.value) },
                            })
                          }
                          className="w-32 accent-blue-600"
                        />
                      </label>
                      <div className="flex items-center justify-between gap-2">
                        <select
                          value={activeCell.image.align}
                          onChange={(e) =>
                            updateActiveCell({
                              image: {
                                ...activeCell.image!,
                                align: e.target.value as TextAlignment,
                              },
                            })
                          }
                          className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px]"
                        >
                          <option value="center">تراز: وسط</option>
                          <option value="right">تراز: راست</option>
                          <option value="left">تراز: چپ</option>
                        </select>
                        <select
                          value={activeCell.imagePosition}
                          onChange={(e) =>
                            updateActiveCell({
                              imagePosition: e.target.value as 'top' | 'bottom',
                            })
                          }
                          className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px]"
                        >
                          <option value="top">بالای متن</option>
                          <option value="bottom">پایین متن</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => updateActiveCell({ image: undefined })}
                          className="rounded p-1 text-red-600 hover:bg-red-50"
                          title="حذف تصویر سلول"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Typography & Alignment */}
                <div className="space-y-2.5 border-t border-slate-100 pt-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => updateSelectedStyle({ bold: !activeCell.style.bold })}
                      title="پررنگ"
                      className={`rounded border px-2 py-1 ${
                        activeCell.style.bold
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Bold className="h-3.5 w-3.5" />
                    </button>

                    <div className="flex items-center rounded border border-slate-200">
                      {(
                        [
                          ['right', AlignRight, 'راست‌چین'],
                          ['center', AlignCenter, 'وسط‌چین'],
                          ['left', AlignLeft, 'چپ‌چین'],
                        ] as const
                      ).map(([val, Icon, title]) => (
                        <button
                          key={val}
                          type="button"
                          title={title}
                          onClick={() => updateSelectedStyle({ align: val })}
                          className={`p-1 ${
                            activeCell.style.align === val
                              ? 'bg-blue-100 text-blue-700'
                              : 'text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center rounded border border-slate-200">
                      {(
                        [
                          ['top', ArrowUpToLine, 'تراز عمودی بالا'],
                          ['middle', MoveVertical, 'تراز عمودی وسط'],
                          ['bottom', ArrowDownToLine, 'تراز عمودی پایین'],
                        ] as const
                      ).map(([val, Icon, title]) => (
                        <button
                          key={val}
                          type="button"
                          title={title}
                          onClick={() =>
                            updateSelectedStyle({ verticalAlign: val as VerticalAlignment })
                          }
                          className={`p-1 ${
                            activeCell.style.verticalAlign === val
                              ? 'bg-blue-100 text-blue-700'
                              : 'text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="mb-0.5 block text-[11px] text-slate-500">اندازه فونت (pt)</span>
                      <input
                        type="number"
                        min={7}
                        max={20}
                        step={0.5}
                        dir="ltr"
                        value={activeCell.style.fontSizePt}
                        onChange={(e) =>
                          updateSelectedStyle({
                            fontSizePt: Math.max(7, Math.min(20, Number(e.target.value) || 10)),
                          })
                        }
                        className="w-full rounded border border-slate-200 px-2 py-1 text-center tabular-nums"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-0.5 block text-[11px] text-slate-500">جهت متن</span>
                      <select
                        value={activeCell.style.direction}
                        onChange={(e) =>
                          updateSelectedStyle({ direction: e.target.value as TextDirection })
                        }
                        className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-[11px]"
                      >
                        <option value="auto">خودکار</option>
                        <option value="rtl">راست‌به‌چپ (فارسی)</option>
                        <option value="ltr">چپ‌به‌راست (انگلیسی)</option>
                      </select>
                    </label>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">رنگ متن:</span>
                    <div className="flex items-center gap-1.5">
                      {TEXT_COLOR_PRESETS.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          title={c.label}
                          onClick={() => updateSelectedStyle({ textColor: c.value })}
                          className={`h-5 w-5 rounded-full border ${
                            activeCell.style.textColor === c.value
                              ? 'ring-2 ring-blue-500 ring-offset-1'
                              : 'border-slate-300'
                          }`}
                          style={{ backgroundColor: c.value }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* 4. Dimensions & Padding */}
                <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                  <label className="block">
                    <span className="mb-0.5 block text-[11px] text-slate-500">عرض ستون (٪)</span>
                    <input
                      type="number"
                      min={6}
                      max={88}
                      dir="ltr"
                      value={Math.round(header.colWidthsPercent[activeCell.col] ?? 25)}
                      onChange={(e) =>
                        setHeader((prev) =>
                          updateColumnWidth(
                            prev,
                            activeCell.col,
                            Number(e.target.value) || 20
                          )
                        )
                      }
                      className="w-full rounded border border-slate-200 px-2 py-1 text-center tabular-nums"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-0.5 block text-[11px] text-slate-500">حداقل ارتفاع سطر (mm)</span>
                    <input
                      type="number"
                      min={6}
                      max={65}
                      dir="ltr"
                      value={header.rowHeightsMm[activeCell.row] ?? 10}
                      onChange={(e) => {
                        const v = Math.max(6, Math.min(65, Number(e.target.value) || 10));
                        setHeader((prev) => {
                          const nextRows = [...prev.rowHeightsMm];
                          nextRows[activeCell.row] = v;
                          return { ...prev, rowHeightsMm: nextRows };
                        });
                      }}
                      className="w-full rounded border border-slate-200 px-2 py-1 text-center tabular-nums"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-0.5 block text-[11px] text-slate-500">فاصله افقی داخلی (px)</span>
                    <input
                      type="number"
                      min={2}
                      max={24}
                      dir="ltr"
                      value={activeCell.style.paddingXpx}
                      onChange={(e) =>
                        updateSelectedStyle({
                          paddingXpx: Math.max(2, Math.min(24, Number(e.target.value) || 6)),
                        })
                      }
                      className="w-full rounded border border-slate-200 px-2 py-1 text-center tabular-nums"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-0.5 block text-[11px] text-slate-500">فاصله عمودی داخلی (px)</span>
                    <input
                      type="number"
                      min={2}
                      max={24}
                      dir="ltr"
                      value={activeCell.style.paddingYpx}
                      onChange={(e) =>
                        updateSelectedStyle({
                          paddingYpx: Math.max(2, Math.min(24, Number(e.target.value) || 5)),
                        })
                      }
                      className="w-full rounded border border-slate-200 px-2 py-1 text-center tabular-nums"
                    />
                  </label>
                </div>

                {/* 5. Borders & Background */}
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">پس‌زمینه سلول:</span>
                    <div className="flex items-center gap-1.5">
                      {CELL_BG_PRESETS.map((bg) => (
                        <button
                          key={bg.value}
                          type="button"
                          title={bg.label}
                          onClick={() => updateSelectedStyle({ backgroundColor: bg.value })}
                          className={`h-5 w-5 rounded border ${
                            activeCell.style.backgroundColor === bg.value
                              ? 'ring-2 ring-blue-500 ring-offset-1'
                              : 'border-slate-300'
                          }`}
                          style={{ backgroundColor: bg.value }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="mb-0.5 block text-[11px] text-slate-500">نوع خطوط کادر</span>
                      <select
                        value={activeCell.style.borderStyle}
                        onChange={(e) =>
                          updateSelectedStyle({ borderStyle: e.target.value as CellBorderStyle })
                        }
                        className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-[11px]"
                      >
                        <option value="solid">ساده</option>
                        <option value="double">دوخطی</option>
                        <option value="dashed">خط‌چین</option>
                        <option value="none">بدون خط</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-0.5 block text-[11px] text-slate-500">ضخامت خطوط (px)</span>
                      <select
                        value={Math.max(
                          activeCell.style.borderTop,
                          activeCell.style.borderRight,
                          activeCell.style.borderBottom,
                          activeCell.style.borderLeft
                        )}
                        onChange={(e) => {
                          const w = Number(e.target.value);
                          updateSelectedStyle({
                            borderTop: activeCell.style.borderTop > 0 ? w : 0,
                            borderRight: activeCell.style.borderRight > 0 ? w : 0,
                            borderBottom: activeCell.style.borderBottom > 0 ? w : 0,
                            borderLeft: activeCell.style.borderLeft > 0 ? w : 0,
                          });
                        }}
                        className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-[11px] tabular-nums"
                      >
                        <option value={0}>بدون خط</option>
                        <option value={1}>۱ پیکسل (نازک)</option>
                        <option value={1.5}>۱٫۵ پیکسل (متوسط)</option>
                        <option value={2}>۲ پیکسل (ضخیم)</option>
                      </select>
                    </label>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-700">
                    {(
                      [
                        ['borderTop', 'بالا'],
                        ['borderRight', 'راست'],
                        ['borderBottom', 'پایین'],
                        ['borderLeft', 'چپ'],
                      ] as const
                    ).map(([edge, label]) => (
                      <label key={edge} className="flex cursor-pointer items-center gap-1">
                        <input
                          type="checkbox"
                          checked={activeCell.style[edge] > 0}
                          onChange={(e) =>
                            updateSelectedStyle({ [edge]: e.target.checked ? 1 : 0 })
                          }
                          className="rounded border-slate-300 accent-blue-600"
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Full Realistic A4 Live Preview Tab */
        <div className="overflow-auto bg-slate-100/80 p-6">
          <div
            className="mx-auto bg-white shadow-md ring-1 ring-slate-300"
            style={{
              width: `${210 * MM_TO_PX * 0.85}px`,
              minHeight: '420px',
              padding: `${pageSettings.marginTopMm * MM_TO_PX * 0.85}px ${
                pageSettings.marginRightMm * MM_TO_PX * 0.85
              }px`,
            }}
          >
            <ExamHeaderRenderer
              header={header}
              examInfo={examInfo}
              pageSettings={pageSettings}
              useSampleValues={!examInfo}
            />

            {/* Sample connection to the Iranian 3-column questions table */}
            <div className="mt-2.5">
              <table
                dir="rtl"
                className="w-full table-fixed border-collapse text-xs text-slate-700"
                style={{
                  border: '1.5px solid #1e293b',
                  fontFamily: `${pageSettings.persianFont}, sans-serif`,
                }}
              >
                <ExamTableColGroup />
                <thead>
                  <ExamTableHeaderRow pageSettings={pageSettings} />
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-slate-700 py-2.5 text-center font-bold">۱</td>
                    <td className="border border-slate-700 px-3 py-2.5 text-slate-500">
                      نمونه محل قرارگیری سؤالات امتحان بلافاصله زیر سربرگ طراحی‌شده...
                    </td>
                    <td className="border border-slate-700 py-2.5 text-center font-semibold">۲</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
