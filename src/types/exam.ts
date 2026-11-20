export type PaperSize = 'A4' | 'A5';
export type PageOrientation = 'portrait' | 'landscape';
export type TextDirection = 'auto' | 'rtl' | 'ltr';
export type TextAlignment = 'right' | 'center' | 'left';
export type VerticalAlignment = 'top' | 'middle' | 'bottom';
export type CellBorderStyle = 'solid' | 'double' | 'dashed' | 'none';
export type SubQuestionLabelStyle = 'persian' | 'english' | 'numeric';

export interface ExamInfo {
  examName: string;
  schoolName: string;
  subject: string;
  grade: string;
  className: string;
  teacherName: string;
  examDate: string; // Jalali date e.g. 1405/08/26
  duration: string; // e.g. ۶۰ دقیقه
  totalScore: number;
}

export interface HeaderCellImage {
  dataUrl: string;
  widthMm: number; // Controls displayed width while preserving natural aspect ratio
  naturalWidth: number;
  naturalHeight: number;
  align: TextAlignment;
}

export interface HeaderCellStyle {
  align: TextAlignment;
  verticalAlign: VerticalAlignment;
  fontSizePt: number;
  bold: boolean;
  direction: TextDirection;
  textColor: string;
  backgroundColor: string;
  paddingYpx: number;
  paddingXpx: number;
  borderTop: number; // px: 0, 1, 1.5, 2
  borderRight: number;
  borderBottom: number;
  borderLeft: number;
  borderColor: string;
  borderStyle: CellBorderStyle;
}

export interface HeaderCell {
  id: string;
  row: number; // 0-based anchor row
  col: number; // 0-based anchor col (in RTL, col 0 is rightmost)
  rowSpan: number;
  colSpan: number;
  text: string; // Static text + optional {{DynamicField}} tokens
  image?: HeaderCellImage;
  imagePosition: 'top' | 'bottom';
  style: HeaderCellStyle;
}

export interface DesignedHeader {
  id: string;
  name: string;
  colWidthsPercent: number[]; // length === numCols, sums to 100
  rowHeightsMm: number[]; // length === numRows, 0 means auto height
  outerBorderWidthPx: number;
  outerBorderColor: string;
  outerBorderStyle: 'solid' | 'double' | 'none';
  bismillahText: string; // Optional centered top line above header table (empty = hidden)
  cells: HeaderCell[]; // Only non-covered anchor cells
}

export interface HeaderConfig {
  savedHeaderId?: string;
  /** Independent snapshot of the designed header stored inside the exam project */
  designed?: DesignedHeader;
  /** Vertical spacing in mm between the designed header and the questions table */
  gapBelowHeaderMm: number;
}

export interface SavedHeader {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  header: DesignedHeader;
}

export interface QuestionImage {
  id: string;
  dataUrl: string;
  widthPercent: number; // 15 to 100
  align: TextAlignment;
  caption?: string;
}

export interface QuestionTable {
  id: string;
  rows: string[][];
  hasHeaderRow: boolean;
  align: TextAlignment;
}

export interface QuestionFormula {
  id: string;
  latex: string;
  align: TextAlignment;
}

export interface SubQuestion {
  id: string;
  textHtml: string;
  score: number;
  direction: TextDirection;
}

export interface QuestionItem {
  id: string;
  manualNumber?: string;
  score: number;
  contentHtml: string;
  direction: TextDirection;
  align: TextAlignment;
  images: QuestionImage[];
  tables: QuestionTable[];
  formulas: QuestionFormula[];
  subQuestions: SubQuestion[];
  subLabelStyle: SubQuestionLabelStyle;
  subColumns: 1 | 2;
}

export interface PageSettings {
  paperSize: PaperSize;
  orientation: PageOrientation;
  marginTopMm: number;
  marginBottomMm: number;
  marginRightMm: number;
  marginLeftMm: number;
  fontSizePt: number;
  persianFont: 'Vazirmatn' | 'Tahoma' | 'Segoe UI';
  latinFont: 'DM Sans' | 'Times New Roman' | 'Arial';
  questionSpacingMm: number;
  showPageNumbers: boolean;
}

export interface ExamProject {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  examInfo: ExamInfo;
  headerConfig: HeaderConfig;
  questions: QuestionItem[];
  pageSettings: PageSettings;
}

export interface BankQuestion {
  id: string;
  subject: string;
  grade: string;
  chapter: string;
  suggestedScore: number;
  createdAt: number;
  updatedAt: number;
  question: Omit<QuestionItem, 'id' | 'manualNumber'>;
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export type AppView = 'dashboard' | 'editor' | 'bank' | 'headers';
