import {
  DesignedHeader,
  ExamProject,
  PageSettings,
  QuestionItem,
  SavedHeader,
  SubQuestionLabelStyle,
} from '../types/exam';
import { getTodayJalaliString, toPersianDigits } from './jalali';

export function createId(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export const DEFAULT_PAGE_SETTINGS: PageSettings = {
  paperSize: 'A4',
  orientation: 'portrait',
  marginTopMm: 12,
  marginBottomMm: 12,
  marginRightMm: 12,
  marginLeftMm: 12,
  fontSizePt: 11,
  persianFont: 'Vazirmatn',
  latinFont: 'DM Sans',
  questionSpacingMm: 3,
  showPageNumbers: true,
};

export function createEmptyQuestion(): QuestionItem {
  return {
    id: createId('q'),
    score: 1,
    contentHtml: '',
    direction: 'auto',
    align: 'right',
    images: [],
    tables: [],
    formulas: [],
    subQuestions: [],
    subLabelStyle: 'persian',
    subColumns: 1,
  };
}

export function createDefaultProject(
  title = 'امتحان جدید',
  defaultHeader?: SavedHeader
): ExamProject {
  const now = Date.now();
  return {
    id: createId('proj'),
    title,
    createdAt: now,
    updatedAt: now,
    examInfo: {
      examName: 'آزمون نوبت اول',
      schoolName: '',
      subject: '',
      grade: '',
      className: '',
      teacherName: '',
      examDate: getTodayJalaliString(),
      duration: '۶۰ دقیقه',
      totalScore: 20,
    },
    headerConfig: defaultHeader
      ? {
          savedHeaderId: defaultHeader.id,
          designed: JSON.parse(JSON.stringify(defaultHeader.header)),
          gapBelowHeaderMm: 3,
        }
      : {
          gapBelowHeaderMm: 3,
        },
    questions: [createEmptyQuestion()],
    pageSettings: { ...DEFAULT_PAGE_SETTINGS },
  };
}

function isValidDesignedHeader(candidate: unknown): candidate is DesignedHeader {
  if (!candidate || typeof candidate !== 'object') return false;
  const h = candidate as Partial<DesignedHeader>;
  return (
    Array.isArray(h.colWidthsPercent) &&
    h.colWidthsPercent.length > 0 &&
    Array.isArray(h.rowHeightsMm) &&
    h.rowHeightsMm.length > 0 &&
    Array.isArray(h.cells)
  );
}

/**
 * Safely normalizes any stored project from IndexedDB or imported .bargeh file,
 * gracefully stripping removed legacy uploaded/old header shapes.
 */
export function normalizeLoadedProject(raw: ExamProject): ExamProject {
  const rawHc = (raw.headerConfig ?? {}) as Partial<{
    savedHeaderId?: string;
    designed?: unknown;
    gapBelowHeaderMm?: number;
  }>;

  const designed = isValidDesignedHeader(rawHc.designed) ? rawHc.designed : undefined;
  const gapBelowHeaderMm =
    typeof rawHc.gapBelowHeaderMm === 'number' && Number.isFinite(rawHc.gapBelowHeaderMm)
      ? Math.max(0, Math.min(30, rawHc.gapBelowHeaderMm))
      : 3;

  return {
    ...raw,
    pageSettings: { ...DEFAULT_PAGE_SETTINGS, ...(raw.pageSettings || {}) },
    headerConfig: {
      savedHeaderId: designed ? rawHc.savedHeaderId : undefined,
      designed,
      gapBelowHeaderMm,
    },
  };
}

export function normalizeLoadedSavedHeaders(rawList: unknown[]): SavedHeader[] {
  const valid: SavedHeader[] = [];
  for (const item of rawList) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Partial<SavedHeader>;
    if (!rec.id || !rec.name) continue;
    if (isValidDesignedHeader(rec.header)) {
      valid.push({
        id: rec.id,
        name: rec.name,
        createdAt: rec.createdAt ?? Date.now(),
        updatedAt: rec.updatedAt ?? Date.now(),
        header: rec.header,
      });
    }
  }
  return valid;
}

export function getSubQuestionLabel(index: number, style: SubQuestionLabelStyle): string {
  const persianLetters = ['الف', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح', 'ط', 'ی', 'ک', 'ل'];
  const englishLetters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'];
  if (style === 'persian') {
    return `${persianLetters[index] ?? toPersianDigits(index + 1)})`;
  }
  if (style === 'english') {
    return `${englishLetters[index] ?? String(index + 1)})`;
  }
  return `${toPersianDigits(index + 1)})`;
}

export function getPaperDimensionsMm(
  paperSize: 'A4' | 'A5',
  orientation: 'portrait' | 'landscape'
): { widthMm: number; heightMm: number } {
  const base = paperSize === 'A4' ? { w: 210, h: 297 } : { w: 148, h: 210 };
  if (orientation === 'landscape') {
    return { widthMm: base.h, heightMm: base.w };
  }
  return { widthMm: base.w, heightMm: base.h };
}
