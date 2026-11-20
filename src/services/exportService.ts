import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeightRule,
  ImageRun,
  Packer,
  PageNumber,
  PageOrientation,
  Paragraph,
  ParagraphChild,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  VerticalMergeType,
  WidthType,
  convertMillimetersToTwip,
} from 'docx';
import { Math as DocxMath, latexToMath } from 'docx/math';
import { toPng } from 'html-to-image';
import { PDFDocument } from 'pdf-lib';
import {
  CellBorderStyle,
  DesignedHeader,
  ExamProject,
  HeaderCell,
  QuestionItem,
  TextAlignment,
  VerticalAlignment,
} from '../types/exam';
import { getPaperDimensionsMm, getSubQuestionLabel } from '../utils/defaults';
import { resolveHeaderDynamicText } from '../utils/headerDynamicFields';
import { buildGridMap } from '../utils/headerGrid';
import { detectTextDirection, formatScore, toPersianDigits } from '../utils/jalali';

function mapAlignment(
  align: TextAlignment,
  defaultRtl: boolean
): (typeof AlignmentType)[keyof typeof AlignmentType] {
  if (align === 'center') return AlignmentType.CENTER;
  if (align === 'left') return AlignmentType.LEFT;
  if (align === 'right') return AlignmentType.RIGHT;
  return defaultRtl ? AlignmentType.RIGHT : AlignmentType.LEFT;
}

function mapVerticalAlign(
  vAlign: VerticalAlignment
): typeof VerticalAlign.TOP | typeof VerticalAlign.CENTER | typeof VerticalAlign.BOTTOM {
  if (vAlign === 'top') return VerticalAlign.TOP;
  if (vAlign === 'bottom') return VerticalAlign.BOTTOM;
  return VerticalAlign.CENTER;
}

function mapDocxBorderStyle(
  style: CellBorderStyle | 'solid' | 'double' | 'none',
  widthPx: number
): (typeof BorderStyle)[keyof typeof BorderStyle] {
  if (widthPx <= 0 || style === 'none') return BorderStyle.NONE;
  if (style === 'double') return BorderStyle.DOUBLE;
  if (style === 'dashed') return BorderStyle.DASHED;
  return BorderStyle.SINGLE;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function dataUrlToUint8Array(dataUrl: string): {
  bytes: Uint8Array;
  type: 'png' | 'jpg' | 'gif' | 'bmp';
} {
  const [header, base64] = dataUrl.split(',');
  const bytes = base64ToUint8Array(base64 || '');
  let type: 'png' | 'jpg' | 'gif' | 'bmp' = 'png';
  if (header?.includes('image/jpeg') || header?.includes('image/jpg')) type = 'jpg';
  else if (header?.includes('image/gif')) type = 'gif';
  else if (header?.includes('image/bmp')) type = 'bmp';
  return { bytes, type };
}

function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () =>
      resolve({ width: img.naturalWidth || 400, height: img.naturalHeight || 200 });
    img.onerror = () => resolve({ width: 400, height: 200 });
    img.src = dataUrl;
  });
}

function containsPersianOrArabic(text: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}

function splitMixedBidiRuns(
  text: string,
  opts: {
    bold?: boolean;
    italics?: boolean;
    underline?: boolean;
    color?: string;
    sizeHalfPt?: number;
    persianFont: string;
    latinFont: string;
  }
): TextRun[] {
  const segments =
    text.match(
      /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF\s]+|[^\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]+/g
    ) || [text];
  return segments.map((seg) => {
    const isRtlSeg = containsPersianOrArabic(seg);
    return new TextRun({
      text: seg,
      bold: opts.bold,
      italics: opts.italics,
      underline: opts.underline ? {} : undefined,
      color: opts.color,
      size: opts.sizeHalfPt,
      rightToLeft: isRtlSeg,
      font: isRtlSeg ? opts.persianFont : opts.latinFont,
    });
  });
}

function parseColorHex(cssColor: string | null | undefined): string | undefined {
  if (!cssColor) return undefined;
  const trimmed = cssColor.trim();
  if (trimmed.startsWith('#')) {
    const hex = trimmed.slice(1);
    if (hex.length === 6) return hex.toUpperCase();
    if (hex.length === 3) {
      return hex
        .split('')
        .map((c) => c + c)
        .join('')
        .toUpperCase();
    }
  }
  const rgbMatch = trimmed.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/i);
  if (rgbMatch) {
    return [rgbMatch[1], rgbMatch[2], rgbMatch[3]]
      .map((n) => Number(n).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  }
  return undefined;
}

function buildInlineRunsFromDom(
  node: Node,
  inherited: {
    bold?: boolean;
    italics?: boolean;
    underline?: boolean;
    color?: string;
    sizeHalfPt?: number;
    persianFont: string;
    latinFont: string;
  }
): ParagraphChild[] {
  const children: ParagraphChild[] = [];

  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? '';
    if (text) {
      children.push(...splitMixedBidiRuns(text, inherited));
    }
    return children;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return children;
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();

  if (tag === 'br') {
    children.push(new TextRun({ break: 1 }));
    return children;
  }

  const latexAttr = el.getAttribute('data-latex');
  if (latexAttr) {
    try {
      const mathComponents = latexToMath(latexAttr);
      children.push(new DocxMath({ children: [...mathComponents] }));
      return children;
    } catch {
      children.push(
        new TextRun({ text: ` ${latexAttr} `, font: inherited.latinFont, rightToLeft: false })
      );
      return children;
    }
  }

  const nextStyle = {
    ...inherited,
    bold:
      inherited.bold ||
      tag === 'b' ||
      tag === 'strong' ||
      el.style.fontWeight === 'bold' ||
      Number(el.style.fontWeight) >= 600,
    italics: inherited.italics || tag === 'i' || tag === 'em' || el.style.fontStyle === 'italic',
    underline:
      inherited.underline || tag === 'u' || el.style.textDecoration.includes('underline'),
    color: parseColorHex(el.style.color || el.getAttribute('color')) || inherited.color,
  };

  el.childNodes.forEach((child) => {
    children.push(...buildInlineRunsFromDom(child, nextStyle));
  });

  return children;
}

function htmlToDocxParagraphs(
  html: string,
  options: {
    prefixChildren?: ParagraphChild[];
    suffixChildren?: ParagraphChild[];
    rtl: boolean;
    align: TextAlignment;
    fontSizePt: number;
    persianFont: string;
    latinFont: string;
    spacingAfterTwips?: number;
  }
): Paragraph[] {
  const sizeHalfPt = options.fontSizePt * 2;
  const baseStyle = {
    sizeHalfPt,
    persianFont: options.persianFont,
    latinFont: options.latinFont,
  };

  const doc = new DOMParser().parseFromString(`<div>${html || ''}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  if (!root) {
    return [
      new Paragraph({
        bidirectional: options.rtl,
        alignment: mapAlignment(options.align, options.rtl),
        spacing: { after: options.spacingAfterTwips ?? 50 },
        children: [...(options.prefixChildren ?? []), ...(options.suffixChildren ?? [])],
      }),
    ];
  }

  const paragraphs: Paragraph[] = [];
  let inlineBuffer: ParagraphChild[] = [...(options.prefixChildren ?? [])];
  let prefixUsed = false;

  const flushBuffer = (extraSuffix?: ParagraphChild[], isBullet = false, isNumbered = false) => {
    if (inlineBuffer.length === 0 && !extraSuffix?.length) return;
    const allChildren = [...inlineBuffer, ...(extraSuffix ?? [])];
    paragraphs.push(
      new Paragraph({
        bidirectional: options.rtl,
        alignment: mapAlignment(options.align, options.rtl),
        bullet: isBullet ? { level: 0 } : undefined,
        numbering: isNumbered ? { reference: 'exam-numbered-list', level: 0 } : undefined,
        spacing: { after: options.spacingAfterTwips ?? 50 },
        children: allChildren,
      })
    );
    inlineBuffer = [];
    prefixUsed = true;
  };

  const processBlockElement = (el: HTMLElement) => {
    const tag = el.tagName.toLowerCase();
    if (tag === 'ul' || tag === 'ol') {
      flushBuffer();
      Array.from(el.children).forEach((li) => {
        if (li.tagName.toLowerCase() === 'li') {
          const runs = buildInlineRunsFromDom(li, baseStyle);
          paragraphs.push(
            new Paragraph({
              bidirectional: options.rtl,
              alignment: mapAlignment(options.align, options.rtl),
              bullet: tag === 'ul' ? { level: 0 } : undefined,
              numbering: tag === 'ol' ? { reference: 'exam-numbered-list', level: 0 } : undefined,
              spacing: { after: 40 },
              children: prefixUsed ? runs : [...(options.prefixChildren ?? []), ...runs],
            })
          );
          prefixUsed = true;
          inlineBuffer = [];
        }
      });
    } else if (tag === 'p' || tag === 'div') {
      if (inlineBuffer.length > 0 && prefixUsed) {
        flushBuffer();
      }
      const runs = buildInlineRunsFromDom(el, baseStyle);
      const startRuns = !prefixUsed ? [...inlineBuffer, ...runs] : runs;
      inlineBuffer = [];
      prefixUsed = true;
      paragraphs.push(
        new Paragraph({
          bidirectional: options.rtl,
          alignment: mapAlignment(options.align, options.rtl),
          spacing: { after: options.spacingAfterTwips ?? 50 },
          children: startRuns,
        })
      );
    } else {
      inlineBuffer.push(...buildInlineRunsFromDom(el, baseStyle));
    }
  };

  root.childNodes.forEach((child) => {
    if (child.nodeType === Node.ELEMENT_NODE) {
      processBlockElement(child as HTMLElement);
    } else if (child.nodeType === Node.TEXT_NODE) {
      inlineBuffer.push(...buildInlineRunsFromDom(child, baseStyle));
    }
  });

  if (inlineBuffer.length > 0 || paragraphs.length === 0) {
    flushBuffer(options.suffixChildren);
  }

  return paragraphs;
}

async function buildDesignedHeaderCellParagraphs(
  cell: HeaderCell,
  project: ExamProject
): Promise<Paragraph[]> {
  const { examInfo, pageSettings } = project;
  const paragraphs: Paragraph[] = [];

  const buildImageParagraph = async (): Promise<Paragraph | null> => {
    if (!cell.image?.dataUrl) return null;
    try {
      const { bytes, type } = dataUrlToUint8Array(cell.image.dataUrl);
      const dims = await getImageDimensions(cell.image.dataUrl);
      const widthPx = Math.max(24, Math.round((cell.image.widthMm / 25.4) * 96));
      const heightPx = Math.max(16, Math.round(widthPx * (dims.height / Math.max(1, dims.width))));
      return new Paragraph({
        alignment: mapAlignment(cell.image.align, true),
        spacing: { before: 20, after: 20 },
        children: [
          new ImageRun({
            data: bytes,
            type,
            transformation: { width: widthPx, height: heightPx },
          }),
        ],
      });
    } catch {
      return null;
    }
  };

  const buildTextParagraphs = (): Paragraph[] => {
    const resolved = resolveHeaderDynamicText(cell.text, examInfo, false);
    if (!resolved) return [];
    const lines = resolved.split('\n');
    const dir =
      cell.style.direction === 'auto' ? detectTextDirection(resolved) : cell.style.direction;
    const isRtl = dir === 'rtl';
    const textColor = parseColorHex(cell.style.textColor) || '0F172A';

    return lines.map(
      (line) =>
        new Paragraph({
          bidirectional: isRtl,
          alignment: mapAlignment(cell.style.align, isRtl),
          spacing: { before: 15, after: 15 },
          children: splitMixedBidiRuns(line, {
            bold: cell.style.bold,
            color: textColor,
            sizeHalfPt: Math.round(cell.style.fontSizePt * 2),
            persianFont: pageSettings.persianFont,
            latinFont: pageSettings.latinFont,
          }),
        })
    );
  };

  const imgP = await buildImageParagraph();
  const txtPs = buildTextParagraphs();

  if (cell.imagePosition === 'top' && imgP) paragraphs.push(imgP);
  paragraphs.push(...txtPs);
  if (cell.imagePosition === 'bottom' && imgP) paragraphs.push(imgP);

  return paragraphs.length > 0 ? paragraphs : [new Paragraph('')];
}

/**
 * Builds a genuine, fully editable Word table representing the teacher's DesignedHeader,
 * preserving merged cells (colSpan + VerticalMerge rowSpan), column widths, row heights,
 * individual cell borders, shading, padding, typography, dynamic fields, and cell logos.
 */
async function buildDesignedHeaderDocxElements(
  header: DesignedHeader,
  project: ExamProject,
  contentWidthMm: number
): Promise<(Paragraph | Table)[]> {
  const elements: (Paragraph | Table)[] = [];
  const { pageSettings } = project;
  const grid = buildGridMap(header);

  if (header.bismillahText.trim()) {
    elements.push(
      new Paragraph({
        bidirectional: true,
        alignment: AlignmentType.CENTER,
        spacing: { after: 50 },
        children: [
          new TextRun({
            text: header.bismillahText.trim(),
            bold: true,
            size: Math.max(18, (pageSettings.fontSizePt - 0.5) * 2),
            rightToLeft: true,
            font: pageSettings.persianFont,
          }),
        ],
      })
    );
  }

  const totalWidthTwips = convertMillimetersToTwip(contentWidthMm);
  const colWidthsTwips = header.colWidthsPercent.map((pct) =>
    Math.max(400, Math.round((pct / 100) * totalWidthTwips))
  );

  const numRows = header.rowHeightsMm.length;
  const numCols = header.colWidthsPercent.length;
  const docxRows: TableRow[] = [];

  for (let r = 0; r < numRows; r++) {
    const rowCells: TableCell[] = [];
    for (let c = 0; c < numCols; c++) {
      const slot = grid[r]?.[c];
      if (!slot) {
        rowCells.push(new TableCell({ children: [new Paragraph('')] }));
        continue;
      }

      const cell = slot.cell;
      // Skip horizontally covered slots (handled by columnSpan on cell.col)
      if (c > cell.col) continue;

      const isVerticalStart = r === cell.row;
      const cellBorderColor = parseColorHex(cell.style.borderColor) || '334155';
      const fillHex = parseColorHex(cell.style.backgroundColor);

      const cellBorders = {
        top: {
          style: mapDocxBorderStyle(cell.style.borderStyle, cell.style.borderTop),
          size: Math.max(0, Math.round(cell.style.borderTop * 6)),
          color: cellBorderColor,
        },
        bottom: {
          style: mapDocxBorderStyle(cell.style.borderStyle, cell.style.borderBottom),
          size: Math.max(0, Math.round(cell.style.borderBottom * 6)),
          color: cellBorderColor,
        },
        right: {
          style: mapDocxBorderStyle(cell.style.borderStyle, cell.style.borderRight),
          size: Math.max(0, Math.round(cell.style.borderRight * 6)),
          color: cellBorderColor,
        },
        left: {
          style: mapDocxBorderStyle(cell.style.borderStyle, cell.style.borderLeft),
          size: Math.max(0, Math.round(cell.style.borderLeft * 6)),
          color: cellBorderColor,
        },
      };

      const spanWidthTwips = colWidthsTwips
        .slice(cell.col, cell.col + cell.colSpan)
        .reduce((a, b) => a + b, 0);

      const padYTwips = Math.round(cell.style.paddingYpx * 15);
      const padXTwips = Math.round(cell.style.paddingXpx * 15);

      if (isVerticalStart) {
        const content = await buildDesignedHeaderCellParagraphs(cell, project);
        rowCells.push(
          new TableCell({
            columnSpan: cell.colSpan > 1 ? cell.colSpan : undefined,
            verticalMerge: cell.rowSpan > 1 ? VerticalMergeType.RESTART : undefined,
            width: { size: spanWidthTwips, type: WidthType.DXA },
            verticalAlign: mapVerticalAlign(cell.style.verticalAlign),
            shading:
              fillHex && fillHex !== 'FFFFFF'
                ? { type: ShadingType.CLEAR, fill: fillHex }
                : undefined,
            margins: {
              top: padYTwips,
              bottom: padYTwips,
              right: padXTwips,
              left: padXTwips,
            },
            borders: cellBorders,
            children: content,
          })
        );
      } else {
        // Vertically merged continuation cell
        rowCells.push(
          new TableCell({
            columnSpan: cell.colSpan > 1 ? cell.colSpan : undefined,
            verticalMerge: VerticalMergeType.CONTINUE,
            width: { size: spanWidthTwips, type: WidthType.DXA },
            shading:
              fillHex && fillHex !== 'FFFFFF'
                ? { type: ShadingType.CLEAR, fill: fillHex }
                : undefined,
            borders: cellBorders,
            children: [new Paragraph('')],
          })
        );
      }
    }

    const rowHeightMm = header.rowHeightsMm[r];
    docxRows.push(
      new TableRow({
        cantSplit: true,
        height:
          rowHeightMm > 0
            ? { value: convertMillimetersToTwip(rowHeightMm), rule: HeightRule.ATLEAST }
            : undefined,
        children: rowCells,
      })
    );
  }

  const outerColor = parseColorHex(header.outerBorderColor) || '1E293B';
  const outerBorder = {
    style: mapDocxBorderStyle(header.outerBorderStyle, header.outerBorderWidthPx),
    size: Math.max(0, Math.round(header.outerBorderWidthPx * 6)),
    color: outerColor,
  };

  elements.push(
    new Table({
      width: { size: totalWidthTwips, type: WidthType.DXA },
      columnWidths: colWidthsTwips,
      visuallyRightToLeft: true,
      layout: TableLayoutType.FIXED,
      borders: {
        top: outerBorder,
        bottom: outerBorder,
        right: outerBorder,
        left: outerBorder,
      },
      rows: docxRows,
    })
  );

  // Respect the configured spacing between header and questions table
  const gapTwips = Math.max(40, convertMillimetersToTwip(project.headerConfig.gapBelowHeaderMm ?? 3));
  elements.push(new Paragraph({ spacing: { after: gapTwips }, children: [] }));

  return elements;
}

async function buildQuestionCellContent(
  q: QuestionItem,
  project: ExamProject,
  questionColWidthMm: number
): Promise<(Paragraph | Table)[]> {
  const elements: (Paragraph | Table)[] = [];
  const { pageSettings } = project;
  const persianFont = pageSettings.persianFont;
  const latinFont = pageSettings.latinFont;
  const fontSizePt = pageSettings.fontSizePt;
  const resolvedDir = q.direction === 'auto' ? detectTextDirection(q.contentHtml) : q.direction;
  const isRtl = resolvedDir === 'rtl';

  elements.push(
    ...htmlToDocxParagraphs(q.contentHtml, {
      rtl: isRtl,
      align: q.direction === 'ltr' && q.align === 'right' ? 'left' : q.align,
      fontSizePt,
      persianFont,
      latinFont,
      spacingAfterTwips: 50,
    })
  );

  for (const formula of q.formulas) {
    try {
      const mathComponents = latexToMath(formula.latex);
      elements.push(
        new Paragraph({
          alignment: mapAlignment(formula.align, false),
          spacing: { before: 40, after: 50 },
          children: [new DocxMath({ children: [...mathComponents] })],
        })
      );
    } catch {
      elements.push(
        new Paragraph({
          alignment: mapAlignment(formula.align, false),
          spacing: { before: 40, after: 50 },
          children: [new TextRun({ text: formula.latex, font: latinFont, size: fontSizePt * 2 })],
        })
      );
    }
  }

  for (const img of q.images) {
    try {
      const { bytes, type } = dataUrlToUint8Array(img.dataUrl);
      const dims = await getImageDimensions(img.dataUrl);
      const maxWidthPx = Math.round(
        ((questionColWidthMm * (Math.min(95, img.widthPercent) / 100)) / 25.4) * 96
      );
      const widthPx = Math.max(50, maxWidthPx);
      const heightPx = Math.round(widthPx * (dims.height / Math.max(1, dims.width)));
      elements.push(
        new Paragraph({
          alignment: mapAlignment(img.align, true),
          spacing: { before: 40, after: 50 },
          children: [
            new ImageRun({
              data: bytes,
              type,
              transformation: { width: widthPx, height: heightPx },
            }),
          ],
        })
      );
    } catch {
      // Skip malformed image
    }
  }

  for (const table of q.tables) {
    const tableRows = table.rows.map(
      (row, rIdx) =>
        new TableRow({
          children: row.map(
            (cellText) =>
              new TableCell({
                verticalAlign: VerticalAlign.CENTER,
                shading:
                  table.hasHeaderRow && rIdx === 0
                    ? { type: ShadingType.CLEAR, fill: 'F1F5F9' }
                    : undefined,
                children: [
                  new Paragraph({
                    bidirectional: true,
                    alignment: AlignmentType.CENTER,
                    children: splitMixedBidiRuns(cellText, {
                      bold: table.hasHeaderRow && rIdx === 0,
                      sizeHalfPt: Math.max(18, (fontSizePt - 0.5) * 2),
                      persianFont,
                      latinFont,
                    }),
                  }),
                ],
              })
          ),
        })
    );
    if (tableRows.length > 0) {
      elements.push(
        new Table({
          width: { size: 95, type: WidthType.PERCENTAGE },
          visuallyRightToLeft: true,
          alignment: mapAlignment(table.align, true),
          rows: tableRows,
        })
      );
      elements.push(new Paragraph({ spacing: { after: 40 }, children: [] }));
    }
  }

  for (let sIdx = 0; sIdx < q.subQuestions.length; sIdx++) {
    const sub = q.subQuestions[sIdx];
    const subLabel = getSubQuestionLabel(sIdx, q.subLabelStyle);
    const subDir = sub.direction === 'auto' ? detectTextDirection(sub.textHtml) : sub.direction;
    const subIsRtl = subDir === 'rtl';

    const subPrefix: ParagraphChild[] = [
      new TextRun({
        text: `  ${subLabel} `,
        bold: true,
        size: fontSizePt * 2,
        rightToLeft: q.subLabelStyle !== 'english',
        font: q.subLabelStyle === 'english' ? latinFont : persianFont,
      }),
    ];

    const subSuffix: ParagraphChild[] =
      sub.score > 0
        ? [
            new TextRun({
              text: `  (${formatScore(sub.score)})`,
              size: Math.max(16, (fontSizePt - 1.5) * 2),
              color: '475569',
              rightToLeft: true,
              font: persianFont,
            }),
          ]
        : [];

    elements.push(
      ...htmlToDocxParagraphs(sub.textHtml, {
        prefixChildren: subPrefix,
        suffixChildren: subSuffix,
        rtl: subIsRtl,
        align: subIsRtl ? 'right' : 'left',
        fontSizePt,
        persianFont,
        latinFont,
        spacingAfterTwips: 35,
      })
    );
  }

  return elements.length > 0 ? elements : [new Paragraph('')];
}

/**
 * Exports a genuinely editable Microsoft Word (.docx) document containing:
 * 1. Editable Word Table matching the teacher's designed school header on Page 1
 * 2. Editable 3-column RTL Iranian exam questions table (ردیف | سؤالات | بارم)
 */
export async function exportExamToDocx(project: ExamProject): Promise<void> {
  const { pageSettings } = project;
  const dims = getPaperDimensionsMm(pageSettings.paperSize, pageSettings.orientation);
  const contentWidthMm = Math.max(
    80,
    dims.widthMm - pageSettings.marginLeftMm - pageSettings.marginRightMm
  );
  const questionColWidthMm = Math.max(50, contentWidthMm - 26);

  const children: (Paragraph | Table)[] = [];

  // Part 1: Genuine editable Word header table on Page 1 ONLY
  if (project.headerConfig.designed) {
    const headerElements = await buildDesignedHeaderDocxElements(
      project.headerConfig.designed,
      project,
      contentWidthMm
    );
    children.push(...headerElements);
  }

  // Part 2: 3-column RTL Iranian Exam Table: ردیف | سؤالات | بارم
  const tableBorder = { style: BorderStyle.SINGLE, size: 6, color: '334155' };
  const rows: TableRow[] = [];

  rows.push(
    new TableRow({
      tableHeader: true,
      cantSplit: true,
      children: [
        new TableCell({
          width: { size: 7, type: WidthType.PERCENTAGE },
          verticalAlign: VerticalAlign.CENTER,
          shading: { type: ShadingType.CLEAR, fill: 'F1F5F9' },
          children: [
            new Paragraph({
              bidirectional: true,
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: 'ردیف',
                  bold: true,
                  size: Math.max(18, (pageSettings.fontSizePt - 0.5) * 2),
                  rightToLeft: true,
                  font: pageSettings.persianFont,
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: 84, type: WidthType.PERCENTAGE },
          verticalAlign: VerticalAlign.CENTER,
          shading: { type: ShadingType.CLEAR, fill: 'F1F5F9' },
          children: [
            new Paragraph({
              bidirectional: true,
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: 'سؤالات',
                  bold: true,
                  size: Math.max(18, (pageSettings.fontSizePt - 0.5) * 2),
                  rightToLeft: true,
                  font: pageSettings.persianFont,
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: 9, type: WidthType.PERCENTAGE },
          verticalAlign: VerticalAlign.CENTER,
          shading: { type: ShadingType.CLEAR, fill: 'F1F5F9' },
          children: [
            new Paragraph({
              bidirectional: true,
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: 'بارم',
                  bold: true,
                  size: Math.max(18, (pageSettings.fontSizePt - 0.5) * 2),
                  rightToLeft: true,
                  font: pageSettings.persianFont,
                }),
              ],
            }),
          ],
        }),
      ],
    })
  );

  for (let i = 0; i < project.questions.length; i++) {
    const q = project.questions[i];
    const qNum = q.manualNumber?.trim() || toPersianDigits(i + 1);
    const cellContent = await buildQuestionCellContent(q, project, questionColWidthMm);

    rows.push(
      new TableRow({
        cantSplit: q.subQuestions.length <= 5,
        children: [
          new TableCell({
            width: { size: 7, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.TOP,
            children: [
              new Paragraph({
                bidirectional: true,
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: qNum,
                    bold: true,
                    size: pageSettings.fontSizePt * 2,
                    rightToLeft: true,
                    font: pageSettings.persianFont,
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 84, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.TOP,
            children: cellContent,
          }),
          new TableCell({
            width: { size: 9, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.TOP,
            children: [
              new Paragraph({
                bidirectional: true,
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: formatScore(q.score),
                    bold: true,
                    size: pageSettings.fontSizePt * 2,
                    rightToLeft: true,
                    font: pageSettings.persianFont,
                  }),
                ],
              }),
            ],
          }),
        ],
      })
    );
  }

  const totalQScore =
    Math.round(project.questions.reduce((s, q) => s + (q.score || 0), 0) * 100) / 100;
  rows.push(
    new TableRow({
      cantSplit: true,
      children: [
        new TableCell({
          columnSpan: 2,
          verticalAlign: VerticalAlign.CENTER,
          shading: { type: ShadingType.CLEAR, fill: 'F8FAFC' },
          children: [
            new Paragraph({
              bidirectional: true,
              alignment: AlignmentType.RIGHT,
              children: [
                new TextRun({
                  text: 'جمع بارم        —        موفق و پیروز باشید',
                  bold: true,
                  size: Math.max(18, (pageSettings.fontSizePt - 0.5) * 2),
                  rightToLeft: true,
                  font: pageSettings.persianFont,
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: 9, type: WidthType.PERCENTAGE },
          verticalAlign: VerticalAlign.CENTER,
          shading: { type: ShadingType.CLEAR, fill: 'F8FAFC' },
          children: [
            new Paragraph({
              bidirectional: true,
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: formatScore(totalQScore),
                  bold: true,
                  size: pageSettings.fontSizePt * 2,
                  rightToLeft: true,
                  font: pageSettings.persianFont,
                }),
              ],
            }),
          ],
        }),
      ],
    })
  );

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      visuallyRightToLeft: true,
      layout: TableLayoutType.FIXED,
      borders: {
        top: tableBorder,
        bottom: tableBorder,
        left: tableBorder,
        right: tableBorder,
        insideHorizontal: tableBorder,
        insideVertical: tableBorder,
      },
      rows,
    })
  );

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: 'exam-numbered-list',
          levels: [
            {
              level: 0,
              format: 'decimal',
              text: '%1.',
              alignment: AlignmentType.RIGHT,
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: convertMillimetersToTwip(pageSettings.paperSize === 'A4' ? 210 : 148),
              height: convertMillimetersToTwip(pageSettings.paperSize === 'A4' ? 297 : 210),
              orientation:
                pageSettings.orientation === 'landscape'
                  ? PageOrientation.LANDSCAPE
                  : PageOrientation.PORTRAIT,
            },
            margin: {
              top: convertMillimetersToTwip(pageSettings.marginTopMm),
              bottom: convertMillimetersToTwip(pageSettings.marginBottomMm),
              right: convertMillimetersToTwip(pageSettings.marginRightMm),
              left: convertMillimetersToTwip(pageSettings.marginLeftMm),
            },
          },
        },
        footers: pageSettings.showPageNumbers
          ? {
              default: new Footer({
                children: [
                  new Paragraph({
                    bidirectional: true,
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({
                        text: 'صفحه ',
                        size: 18,
                        rightToLeft: true,
                        font: pageSettings.persianFont,
                        color: '64748B',
                      }),
                      new TextRun({
                        children: [PageNumber.CURRENT],
                        size: 18,
                        font: pageSettings.persianFont,
                        color: '64748B',
                      }),
                      new TextRun({
                        text: ' از ',
                        size: 18,
                        rightToLeft: true,
                        font: pageSettings.persianFont,
                        color: '64748B',
                      }),
                      new TextRun({
                        children: [PageNumber.TOTAL_PAGES],
                        size: 18,
                        font: pageSettings.persianFont,
                        color: '64748B',
                      }),
                    ],
                  }),
                ],
              }),
            }
          : undefined,
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = (project.title || project.examInfo.examName || 'exam').replace(
    /[\\/:*?"<>|]/g,
    '_'
  );
  a.href = url;
  a.download = `${safeName}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function hasInaccessibleStyleSheet(): boolean {
  try {
    for (const sheet of Array.from(document.styleSheets)) {
      void sheet.cssRules;
    }
    return false;
  } catch {
    return true;
  }
}

/**
 * Exports all paginated exam sheets into a print-ready multi-page PDF matching the live preview.
 */
export async function exportExamSheetsToPdf(
  sheetElements: HTMLElement[],
  project: ExamProject
): Promise<void> {
  if (sheetElements.length === 0) {
    throw new Error('هیچ صفحه‌ای برای تولید خروجی PDF وجود ندارد.');
  }

  const dims = getPaperDimensionsMm(
    project.pageSettings.paperSize,
    project.pageSettings.orientation
  );
  const mmToPt = 2.834645669;
  const pageWidthPt = dims.widthMm * mmToPt;
  const pageHeightPt = dims.heightMm * mmToPt;

  const pdfDoc = await PDFDocument.create();
  const skipFonts = hasInaccessibleStyleSheet();

  for (const el of sheetElements) {
    const pngDataUrl = await toPng(el, {
      pixelRatio: 2.5,
      backgroundColor: '#ffffff',
      cacheBust: true,
      skipFonts,
    });
    const pngImage = await pdfDoc.embedPng(pngDataUrl);
    const page = pdfDoc.addPage([pageWidthPt, pageHeightPt]);
    page.drawImage(pngImage, {
      x: 0,
      y: 0,
      width: pageWidthPt,
      height: pageHeightPt,
    });
  }

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = (project.title || project.examInfo.examName || 'exam').replace(
    /[\\/:*?"<>|]/g,
    '_'
  );
  a.href = url;
  a.download = `${safeName}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
