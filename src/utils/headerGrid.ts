import { DesignedHeader, HeaderCell, HeaderCellStyle } from '../types/exam';
import { createId } from './defaults';

export const DEFAULT_CELL_STYLE: HeaderCellStyle = {
  align: 'right',
  verticalAlign: 'middle',
  fontSizePt: 10,
  bold: false,
  direction: 'auto',
  textColor: '#0f172a',
  backgroundColor: '#ffffff',
  paddingYpx: 5,
  paddingXpx: 8,
  borderTop: 1,
  borderRight: 1,
  borderBottom: 1,
  borderLeft: 1,
  borderColor: '#334155',
  borderStyle: 'solid',
};

export interface GridSlot {
  cell: HeaderCell;
  isAnchor: boolean;
}

export interface SelectionBounds {
  r1: number;
  r2: number;
  c1: number;
  c2: number;
}

export function createCell(
  row: number,
  col: number,
  overrides?: Partial<Omit<HeaderCell, 'style'>> & { style?: Partial<HeaderCellStyle> }
): HeaderCell {
  const { style, ...rest } = overrides ?? {};
  return {
    id: createId('hcell'),
    row,
    col,
    rowSpan: 1,
    colSpan: 1,
    text: '',
    imagePosition: 'top',
    ...rest,
    style: {
      ...DEFAULT_CELL_STYLE,
      ...(style ?? {}),
    },
  };
}

export function normalizePercentWidths(widths: number[]): number[] {
  const safe = widths.map((w) => Math.max(5, Number.isFinite(w) ? w : 10));
  const sum = safe.reduce((acc, n) => acc + n, 0) || 100;
  const scaled = safe.map((w) => Math.round(((w / sum) * 100) * 10) / 10);
  const diff = Math.round((100 - scaled.reduce((a, b) => a + b, 0)) * 10) / 10;
  if (scaled.length > 0) {
    scaled[scaled.length - 1] = Math.max(5, Math.round((scaled[scaled.length - 1] + diff) * 10) / 10);
  }
  return scaled;
}

/**
 * Builds a complete [numRows][numCols] occupancy matrix mapping every coordinate
 * to its covering HeaderCell and whether (r, c) is the cell's top-right (RTL) anchor.
 */
export function buildGridMap(header: DesignedHeader): (GridSlot | null)[][] {
  const numRows = header.rowHeightsMm.length;
  const numCols = header.colWidthsPercent.length;
  const grid: (GridSlot | null)[][] = Array.from({ length: numRows }, () =>
    Array.from({ length: numCols }, () => null)
  );

  for (const cell of header.cells) {
    for (let r = cell.row; r < Math.min(numRows, cell.row + cell.rowSpan); r++) {
      for (let c = cell.col; c < Math.min(numCols, cell.col + cell.colSpan); c++) {
        grid[r][c] = {
          cell,
          isAnchor: r === cell.row && c === cell.col,
        };
      }
    }
  }
  return grid;
}

/**
 * Expands a rectangular selection so it never partially cuts through an existing merged cell.
 */
export function expandSelectionBounds(
  header: DesignedHeader,
  raw: SelectionBounds
): SelectionBounds {
  let r1 = Math.min(raw.r1, raw.r2);
  let r2 = Math.max(raw.r1, raw.r2);
  let c1 = Math.min(raw.c1, raw.c2);
  let c2 = Math.max(raw.c1, raw.c2);

  let changed = true;
  while (changed) {
    changed = false;
    for (const cell of header.cells) {
      const cr1 = cell.row;
      const cr2 = cell.row + cell.rowSpan - 1;
      const cc1 = cell.col;
      const cc2 = cell.col + cell.colSpan - 1;

      const intersects = !(cr2 < r1 || cr1 > r2 || cc2 < c1 || cc1 > c2);
      if (intersects) {
        if (cr1 < r1) {
          r1 = cr1;
          changed = true;
        }
        if (cr2 > r2) {
          r2 = cr2;
          changed = true;
        }
        if (cc1 < c1) {
          c1 = cc1;
          changed = true;
        }
        if (cc2 > c2) {
          c2 = cc2;
          changed = true;
        }
      }
    }
  }

  return { r1, r2, c1, c2 };
}

export function canMergeBounds(header: DesignedHeader, bounds: SelectionBounds): boolean {
  const expanded = expandSelectionBounds(header, bounds);
  const coveredCells = header.cells.filter(
    (cell) =>
      cell.row >= expanded.r1 &&
      cell.row <= expanded.r2 &&
      cell.col >= expanded.c1 &&
      cell.col <= expanded.c2
  );
  return coveredCells.length > 1;
}

export function mergeCellsInBounds(
  header: DesignedHeader,
  rawBounds: SelectionBounds
): { header: DesignedHeader; mergedCellId: string } {
  const bounds = expandSelectionBounds(header, rawBounds);
  const inside: HeaderCell[] = [];
  const outside: HeaderCell[] = [];

  for (const cell of header.cells) {
    if (
      cell.row >= bounds.r1 &&
      cell.row <= bounds.r2 &&
      cell.col >= bounds.c1 &&
      cell.col <= bounds.c2
    ) {
      inside.push(cell);
    } else {
      outside.push(cell);
    }
  }

  if (inside.length <= 1) {
    return { header, mergedCellId: inside[0]?.id ?? '' };
  }

  inside.sort((a, b) => (a.row !== b.row ? a.row - b.row : a.col - b.col));
  const primary = inside[0];
  const combinedText = inside
    .map((c) => c.text.trim())
    .filter(Boolean)
    .join('\n');
  const firstImage = inside.find((c) => c.image)?.image;

  const merged: HeaderCell = {
    ...primary,
    row: bounds.r1,
    col: bounds.c1,
    rowSpan: bounds.r2 - bounds.r1 + 1,
    colSpan: bounds.c2 - bounds.c1 + 1,
    text: combinedText,
    image: firstImage,
  };

  return {
    header: {
      ...header,
      cells: [...outside, merged],
    },
    mergedCellId: merged.id,
  };
}

export function splitMergedCell(header: DesignedHeader, cellId: string): DesignedHeader {
  const target = header.cells.find((c) => c.id === cellId);
  if (!target || (target.rowSpan === 1 && target.colSpan === 1)) {
    return header;
  }

  const others = header.cells.filter((c) => c.id !== cellId);
  const spawned: HeaderCell[] = [];

  for (let r = target.row; r < target.row + target.rowSpan; r++) {
    for (let c = target.col; c < target.col + target.colSpan; c++) {
      if (r === target.row && c === target.col) {
        spawned.push({
          ...target,
          rowSpan: 1,
          colSpan: 1,
        });
      } else {
        spawned.push(
          createCell(r, c, {
            style: { ...target.style },
          })
        );
      }
    }
  }

  return {
    ...header,
    cells: [...others, ...spawned],
  };
}

export function insertRowAt(header: DesignedHeader, atIndex: number): DesignedHeader {
  const numRows = header.rowHeightsMm.length;
  const numCols = header.colWidthsPercent.length;
  const clampedIdx = Math.max(0, Math.min(numRows, atIndex));

  const coveredCols = new Set<number>();
  const updatedCells: HeaderCell[] = header.cells.map((cell) => {
    if (cell.row >= clampedIdx) {
      return { ...cell, row: cell.row + 1 };
    }
    if (cell.row < clampedIdx && cell.row + cell.rowSpan > clampedIdx) {
      for (let c = cell.col; c < cell.col + cell.colSpan; c++) {
        coveredCols.add(c);
      }
      return { ...cell, rowSpan: cell.rowSpan + 1 };
    }
    return cell;
  });

  for (let c = 0; c < numCols; c++) {
    if (!coveredCols.has(c)) {
      updatedCells.push(createCell(clampedIdx, c));
    }
  }

  const nextHeights = [...header.rowHeightsMm];
  nextHeights.splice(clampedIdx, 0, 10);

  return {
    ...header,
    rowHeightsMm: nextHeights,
    cells: updatedCells,
  };
}

export function deleteRowAt(header: DesignedHeader, rowIndex: number): DesignedHeader {
  const numRows = header.rowHeightsMm.length;
  if (numRows <= 1 || rowIndex < 0 || rowIndex >= numRows) return header;

  const updatedCells: HeaderCell[] = [];
  for (const cell of header.cells) {
    if (cell.row > rowIndex) {
      updatedCells.push({ ...cell, row: cell.row - 1 });
    } else if (cell.row === rowIndex) {
      if (cell.rowSpan > 1) {
        // Keep the merged cell anchored at the same index with reduced span
        updatedCells.push({ ...cell, rowSpan: cell.rowSpan - 1 });
      }
      // 1-row cells on deleted row are dropped
    } else if (cell.row + cell.rowSpan > rowIndex) {
      updatedCells.push({ ...cell, rowSpan: cell.rowSpan - 1 });
    } else {
      updatedCells.push(cell);
    }
  }

  const nextHeights = [...header.rowHeightsMm];
  nextHeights.splice(rowIndex, 1);

  return {
    ...header,
    rowHeightsMm: nextHeights,
    cells: updatedCells,
  };
}

export function insertColumnAt(header: DesignedHeader, atIndex: number): DesignedHeader {
  const numRows = header.rowHeightsMm.length;
  const numCols = header.colWidthsPercent.length;
  const clampedIdx = Math.max(0, Math.min(numCols, atIndex));

  const coveredRows = new Set<number>();
  const updatedCells: HeaderCell[] = header.cells.map((cell) => {
    if (cell.col >= clampedIdx) {
      return { ...cell, col: cell.col + 1 };
    }
    if (cell.col < clampedIdx && cell.col + cell.colSpan > clampedIdx) {
      for (let r = cell.row; r < cell.row + cell.rowSpan; r++) {
        coveredRows.add(r);
      }
      return { ...cell, colSpan: cell.colSpan + 1 };
    }
    return cell;
  });

  for (let r = 0; r < numRows; r++) {
    if (!coveredRows.has(r)) {
      updatedCells.push(createCell(r, clampedIdx));
    }
  }

  const newColWidth = Math.max(10, Math.round(100 / (numCols + 1)));
  const nextWidths = [...header.colWidthsPercent];
  nextWidths.splice(clampedIdx, 0, newColWidth);

  return {
    ...header,
    colWidthsPercent: normalizePercentWidths(nextWidths),
    cells: updatedCells,
  };
}

export function deleteColumnAt(header: DesignedHeader, colIndex: number): DesignedHeader {
  const numCols = header.colWidthsPercent.length;
  if (numCols <= 1 || colIndex < 0 || colIndex >= numCols) return header;

  const updatedCells: HeaderCell[] = [];
  for (const cell of header.cells) {
    if (cell.col > colIndex) {
      updatedCells.push({ ...cell, col: cell.col - 1 });
    } else if (cell.col === colIndex) {
      if (cell.colSpan > 1) {
        updatedCells.push({ ...cell, colSpan: cell.colSpan - 1 });
      }
    } else if (cell.col + cell.colSpan > colIndex) {
      updatedCells.push({ ...cell, colSpan: cell.colSpan - 1 });
    } else {
      updatedCells.push(cell);
    }
  }

  const nextWidths = [...header.colWidthsPercent];
  nextWidths.splice(colIndex, 1);

  return {
    ...header,
    colWidthsPercent: normalizePercentWidths(nextWidths),
    cells: updatedCells,
  };
}

export function updateColumnWidth(
  header: DesignedHeader,
  colIndex: number,
  targetPercent: number
): DesignedHeader {
  const numCols = header.colWidthsPercent.length;
  if (numCols <= 1 || colIndex < 0 || colIndex >= numCols) return header;

  const clamped = Math.max(6, Math.min(88, targetPercent));
  const next = [...header.colWidthsPercent];
  const neighborIdx = colIndex < numCols - 1 ? colIndex + 1 : colIndex - 1;
  const pairTotal = next[colIndex] + next[neighborIdx];

  if (clamped <= pairTotal - 6) {
    next[colIndex] = Math.round(clamped * 10) / 10;
    next[neighborIdx] = Math.round((pairTotal - clamped) * 10) / 10;
    return { ...header, colWidthsPercent: normalizePercentWidths(next) };
  }

  // Distribute remaining width proportionally across all other columns
  const remaining = 100 - clamped;
  const otherSum = next.reduce((acc, w, idx) => (idx === colIndex ? acc : acc + w), 0) || 1;
  const redistributed = next.map((w, idx) =>
    idx === colIndex ? clamped : Math.max(6, (w / otherSum) * remaining)
  );
  return { ...header, colWidthsPercent: normalizePercentWidths(redistributed) };
}

/**
 * Creates a clean blank table header from scratch with any desired rows & columns.
 */
export function createBlankDesignedHeader(
  rows = 3,
  cols = 3,
  name = 'سربرگ جدید'
): DesignedHeader {
  const rCount = Math.max(1, Math.min(10, rows));
  const cCount = Math.max(1, Math.min(10, cols));
  const cells: HeaderCell[] = [];
  for (let r = 0; r < rCount; r++) {
    for (let c = 0; c < cCount; c++) {
      cells.push(createCell(r, c));
    }
  }
  return {
    id: createId('hdr'),
    name,
    colWidthsPercent: normalizePercentWidths(Array.from({ length: cCount }, () => 100 / cCount)),
    rowHeightsMm: Array.from({ length: rCount }, () => 10),
    outerBorderWidthPx: 1.5,
    outerBorderColor: '#1e293b',
    outerBorderStyle: 'solid',
    bismillahText: 'به نام خدا',
    cells,
  };
}

/**
 * Creates a fully editable Iranian school examination header layout as a helpful starting point
 * demonstrating merged cells, dynamic fields, and classic RTL exam structure.
 */
export function createStarterIranianHeader(name = 'سربرگ استاندارد مدرسه'): DesignedHeader {
  return {
    id: createId('hdr'),
    name,
    // 4 columns (RTL right -> left):
    // Col 0 (18%): Logo/emblem area (merged across rows 0..2)
    // Col 1 (32%): Student & Subject info
    // Col 2 (28%): Exam title & Grade/Class
    // Col 3 (22%): Date, Duration, Score
    colWidthsPercent: [18, 32, 28, 22],
    rowHeightsMm: [11, 10, 10, 10],
    outerBorderWidthPx: 1.5,
    outerBorderColor: '#1e293b',
    outerBorderStyle: 'solid',
    bismillahText: 'به نام خدا',
    cells: [
      // Merged school logo/identity cell on the right
      createCell(0, 0, {
        rowSpan: 3,
        colSpan: 1,
        text: '{{SchoolName}}',
        style: {
          align: 'center',
          verticalAlign: 'middle',
          fontSizePt: 10,
          bold: true,
          backgroundColor: '#f8fafc',
        },
      }),
      // Top merged title bar across cols 1..2
      createCell(0, 1, {
        rowSpan: 1,
        colSpan: 2,
        text: '{{ExamTitle}} — درس {{Subject}}',
        style: {
          align: 'center',
          verticalAlign: 'middle',
          fontSizePt: 11,
          bold: true,
          backgroundColor: '#f8fafc',
        },
      }),
      // Top-left: Date
      createCell(0, 3, {
        text: 'تاریخ: {{ExamDate}}',
        style: { fontSizePt: 9.5 },
      }),
      // Row 1: Student name (merged across cols 1..2) + Duration
      createCell(1, 1, {
        rowSpan: 1,
        colSpan: 2,
        text: 'نام و نام خانوادگی: {{StudentName}}',
        style: { fontSizePt: 10 },
      }),
      createCell(1, 3, {
        text: 'مدت زمان: {{ExamDuration}}',
        style: { fontSizePt: 9.5 },
      }),
      // Row 2: Grade & Class, Teacher, Total Score
      createCell(2, 1, {
        text: 'پایه: {{Grade}}   |   کلاس: {{Class}}',
        style: { fontSizePt: 9.5 },
      }),
      createCell(2, 2, {
        text: 'نام دبیر: {{TeacherName}}',
        style: { fontSizePt: 9.5 },
      }),
      createCell(2, 3, {
        text: 'نمره کل: {{TotalScore}}',
        style: { fontSizePt: 9.5, bold: true },
      }),
      // Row 3: Student ID, Score box, Teacher Signature
      createCell(3, 0, {
        rowSpan: 1,
        colSpan: 2,
        text: 'شماره دانش‌آموزی: {{StudentNumber}}',
        style: { fontSizePt: 9.5 },
      }),
      createCell(3, 2, {
        text: 'نمره به عدد و حروف:',
        style: { fontSizePt: 9.5 },
      }),
      createCell(3, 3, {
        text: 'امضای دبیر:',
        style: { fontSizePt: 9.5 },
      }),
    ],
  };
}
