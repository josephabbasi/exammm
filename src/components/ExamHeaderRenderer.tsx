import React, { useMemo } from 'react';
import { DesignedHeader, ExamInfo, HeaderCell, PageSettings } from '../types/exam';
import { resolveHeaderDynamicText } from '../utils/headerDynamicFields';
import { buildGridMap } from '../utils/headerGrid';
import { detectTextDirection } from '../utils/jalali';

const MM_TO_PX = 3.7795275591;

interface ExamHeaderRendererProps {
  header?: DesignedHeader;
  examInfo?: ExamInfo;
  pageSettings: PageSettings;
  /** When true (e.g. inside Header Designer preview), empty examInfo fields show realistic Persian samples */
  useSampleValues?: boolean;
  /** Shows a subtle non-printing hint on Page 1 if no header has been selected yet */
  showEmptyPlaceholder?: boolean;
}

function getBorderCss(widthPx: number, style: string, color: string): string {
  if (widthPx <= 0 || style === 'none') return 'none';
  return `${widthPx}px ${style} ${color}`;
}

/**
 * Shared formal renderer for a teacher-designed table header.
 * Reused identically in the Header Designer live preview, Examination live preview,
 * pagination measurement layer, and final PDF/Print output.
 */
export const ExamHeaderRenderer: React.FC<ExamHeaderRendererProps> = ({
  header,
  examInfo,
  pageSettings,
  useSampleValues = false,
  showEmptyPlaceholder = false,
}) => {
  const grid = useMemo(() => (header ? buildGridMap(header) : []), [header]);

  if (!header) {
    if (!showEmptyPlaceholder) return null;
    return (
      <div className="no-print mb-2 flex items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50/80 px-4 py-4 text-center text-xs text-slate-500">
        سربرگ امتحان هنوز انتخاب نشده است — از تب «سربرگ» یکی از سربرگ‌های ذخیره‌شده را انتخاب کنید یا در طراح سربرگ یک سربرگ بسازید.
      </div>
    );
  }

  const outerBorderCss =
    header.outerBorderStyle === 'none' || header.outerBorderWidthPx <= 0
      ? 'none'
      : `${header.outerBorderWidthPx}px ${header.outerBorderStyle} ${header.outerBorderColor}`;

  const renderCellBody = (cell: HeaderCell) => {
    const resolvedText = resolveHeaderDynamicText(cell.text, examInfo, useSampleValues);
    const lines = resolvedText ? resolvedText.split('\n') : [];
    const dir =
      cell.style.direction === 'auto'
        ? detectTextDirection(resolvedText)
        : cell.style.direction;

    const imageEl = cell.image ? (
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
          alt="لوگوی سربرگ"
          style={{
            width: `${Math.max(6, cell.image.widthMm) * MM_TO_PX}px`,
            maxWidth: '100%',
            height: 'auto',
            objectFit: 'contain',
            display: 'block',
          }}
        />
      </div>
    ) : null;

    const textEl =
      lines.length > 0 ? (
        <div
          dir={dir}
          style={{
            textAlign: cell.style.align,
            fontSize: `${cell.style.fontSizePt}pt`,
            fontWeight: cell.style.bold ? 700 : 400,
            color: cell.style.textColor || '#0f172a',
            lineHeight: 1.5,
            wordBreak: 'break-word',
          }}
        >
          {lines.map((line, idx) => (
            <div key={idx}>{line || '\u00A0'}</div>
          ))}
        </div>
      ) : null;

    return (
      <div className="flex flex-col gap-1">
        {cell.imagePosition === 'top' && imageEl}
        {textEl}
        {cell.imagePosition === 'bottom' && imageEl}
      </div>
    );
  };

  return (
    <div
      className="w-full text-slate-900"
      style={{
        fontFamily: `${pageSettings.persianFont}, ${pageSettings.latinFont}, sans-serif`,
      }}
    >
      {header.bismillahText.trim() && (
        <div
          className="mb-1 text-center font-semibold text-slate-900"
          style={{ fontSize: `${Math.max(9.5, pageSettings.fontSizePt - 0.5)}pt` }}
        >
          {header.bismillahText.trim()}
        </div>
      )}

      <table
        dir="rtl"
        className="w-full table-fixed border-collapse"
        style={{
          border: outerBorderCss,
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
                return (
                  <td
                    key={cell.id}
                    rowSpan={cell.rowSpan}
                    colSpan={cell.colSpan}
                    style={{
                      verticalAlign: cell.style.verticalAlign,
                      backgroundColor: cell.style.backgroundColor || '#ffffff',
                      paddingTop: `${cell.style.paddingYpx}px`,
                      paddingBottom: `${cell.style.paddingYpx}px`,
                      paddingRight: `${cell.style.paddingXpx}px`,
                      paddingLeft: `${cell.style.paddingXpx}px`,
                      borderTop: getBorderCss(
                        cell.style.borderTop,
                        cell.style.borderStyle,
                        cell.style.borderColor
                      ),
                      borderRight: getBorderCss(
                        cell.style.borderRight,
                        cell.style.borderStyle,
                        cell.style.borderColor
                      ),
                      borderBottom: getBorderCss(
                        cell.style.borderBottom,
                        cell.style.borderStyle,
                        cell.style.borderColor
                      ),
                      borderLeft: getBorderCss(
                        cell.style.borderLeft,
                        cell.style.borderStyle,
                        cell.style.borderColor
                      ),
                      overflow: 'hidden',
                    }}
                  >
                    {renderCellBody(cell)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
