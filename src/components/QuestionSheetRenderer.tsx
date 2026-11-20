import React, { useMemo } from 'react';
import { renderLatexToHtml, renderRichHtmlWithMath } from '../services/mathRender';
import { PageSettings, QuestionItem } from '../types/exam';
import { getSubQuestionLabel } from '../utils/defaults';
import { detectTextDirection, formatScore, toPersianDigits } from '../utils/jalali';

export const ROW_NUM_COL_PX = 40;
export const SCORE_COL_PX = 52;

export interface QuestionSlice {
  question: QuestionItem;
  questionIndex: number;
  showStem: boolean;
  isContinuation?: boolean;
  subQuestionRange?: [number, number]; // inclusive start, exclusive end
}

/**
 * Shared 3-column Iranian school examination table column group:
 * RTL visual order (right -> center -> left): ردیف | سؤالات | بارم
 */
export const ExamTableColGroup: React.FC = () => (
  <colgroup>
    <col style={{ width: `${ROW_NUM_COL_PX}px` }} />
    <col />
    <col style={{ width: `${SCORE_COL_PX}px` }} />
  </colgroup>
);

export const ExamTableHeaderRow: React.FC<{ pageSettings: PageSettings }> = ({ pageSettings }) => (
  <tr
    className="bg-slate-100 text-slate-900"
    style={{
      fontFamily: `${pageSettings.persianFont}, ${pageSettings.latinFont}, sans-serif`,
      fontSize: `${Math.max(9.5, pageSettings.fontSizePt - 0.5)}pt`,
    }}
  >
    <th className="border border-slate-700 px-1 py-1.5 text-center font-bold">ردیف</th>
    <th className="border border-slate-700 px-3 py-1.5 text-center font-bold">سؤالات</th>
    <th className="border border-slate-700 px-1 py-1.5 text-center font-bold">بارم</th>
  </tr>
);

export const ExamTableSummaryRow: React.FC<{
  totalScore: number;
  pageSettings: PageSettings;
}> = ({ totalScore, pageSettings }) => (
  <tr
    className="bg-slate-50 text-slate-900"
    style={{
      fontFamily: `${pageSettings.persianFont}, ${pageSettings.latinFont}, sans-serif`,
      fontSize: `${Math.max(9.5, pageSettings.fontSizePt - 0.5)}pt`,
    }}
  >
    <td colSpan={2} className="border border-slate-700 px-3 py-1.5 font-semibold">
      <div className="flex items-center justify-between">
        <span>جمع بارم</span>
        <span className="text-[0.92em] font-medium text-slate-700">موفق و پیروز باشید</span>
      </div>
    </td>
    <td className="border border-slate-700 px-1 py-1.5 text-center font-bold tabular-nums">
      {formatScore(totalScore)}
    </td>
  </tr>
);

interface QuestionTableRowRendererProps {
  slice: QuestionSlice;
  pageSettings: PageSettings;
}

/**
 * Renders a single question (or continuation slice) as a clean, print-ready Iranian school
 * examination table row: [ ردیف | سؤالات | بارم ]
 */
export const QuestionTableRowRenderer: React.FC<QuestionTableRowRendererProps> = ({
  slice,
  pageSettings,
}) => {
  const { question, questionIndex, showStem, isContinuation, subQuestionRange } = slice;
  const qNum = question.manualNumber?.trim() || toPersianDigits(questionIndex + 1);

  const resolvedDir = useMemo(() => {
    if (question.direction !== 'auto') return question.direction;
    return detectTextDirection(question.contentHtml);
  }, [question.direction, question.contentHtml]);

  const hydratedStem = useMemo(
    () => renderRichHtmlWithMath(question.contentHtml),
    [question.contentHtml]
  );

  const subSlice = useMemo(() => {
    if (!subQuestionRange) return question.subQuestions.map((sq, idx) => ({ sq, idx }));
    const [start, end] = subQuestionRange;
    return question.subQuestions
      .slice(start, end)
      .map((sq, offset) => ({ sq, idx: start + offset }));
  }, [question.subQuestions, subQuestionRange]);

  const verticalPadPx = Math.max(5, Math.round(pageSettings.questionSpacingMm * 1.5 + 3));

  return (
    <tr
      className="align-top text-slate-900"
      style={{
        fontFamily: `${pageSettings.persianFont}, ${pageSettings.latinFont}, sans-serif`,
        fontSize: `${pageSettings.fontSizePt}pt`,
        lineHeight: 1.65,
      }}
    >
      {/* Column 1 (Rightmost in RTL): ردیف */}
      <td
        className="border border-slate-600 px-1 text-center font-bold text-slate-900 tabular-nums"
        style={{ paddingTop: `${verticalPadPx}px`, paddingBottom: `${verticalPadPx}px` }}
      >
        {isContinuation ? (
          <span className="text-[0.74em] font-medium leading-tight text-slate-500">
            ادامه {qNum}
          </span>
        ) : (
          qNum
        )}
      </td>

      {/* Column 2 (Center wide): سؤالات */}
      <td
        className="border border-slate-600 px-2.5"
        style={{
          paddingTop: `${verticalPadPx}px`,
          paddingBottom: `${verticalPadPx}px`,
          maxWidth: 0,
          overflowWrap: 'break-word',
          wordBreak: 'break-word',
        }}
      >
        {showStem && (
          <>
            <div
              dir={resolvedDir}
              style={{
                textAlign:
                  question.direction === 'ltr' && question.align === 'right'
                    ? 'left'
                    : question.align,
              }}
              className="exam-rich-content"
              dangerouslySetInnerHTML={{
                __html: hydratedStem || '<span class="text-slate-400">...</span>',
              }}
            />

            {/* Standalone Display Formulas */}
            {question.formulas.length > 0 && (
              <div className="mt-1.5 space-y-1">
                {question.formulas.map((f) => {
                  const { html } = renderLatexToHtml(f.latex, true);
                  return (
                    <div
                      key={f.id}
                      dir="ltr"
                      style={{ textAlign: f.align }}
                      className="exam-rich-content max-w-full overflow-hidden py-0.5"
                      dangerouslySetInnerHTML={{ __html: html }}
                    />
                  );
                })}
              </div>
            )}

            {/* Question Images (constrained within printable cell and vertical safety cap) */}
            {question.images.length > 0 && (
              <div className="mt-2 space-y-2">
                {question.images.map((img) => {
                  const justifyClass =
                    img.align === 'center'
                      ? 'justify-center'
                      : img.align === 'left'
                        ? 'justify-end'
                        : 'justify-start';
                  return (
                    <div key={img.id} className={`flex w-full ${justifyClass}`}>
                      <div
                        style={{
                          width: `${Math.min(100, Math.max(15, img.widthPercent))}%`,
                          maxWidth: '100%',
                        }}
                      >
                        <img
                          src={img.dataUrl}
                          alt={img.caption || `تصویر سؤال ${qNum}`}
                          className="mx-auto block h-auto max-h-[115mm] max-w-full rounded-xs border border-slate-300 object-contain"
                        />
                        {img.caption && (
                          <div className="mt-0.5 text-center text-[0.82em] text-slate-600">
                            {img.caption}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Question Embedded Tables */}
            {question.tables.length > 0 && (
              <div className="mt-2 space-y-2">
                {question.tables.map((tbl) => {
                  const justifyClass =
                    tbl.align === 'center'
                      ? 'justify-center'
                      : tbl.align === 'left'
                        ? 'justify-end'
                        : 'justify-start';
                  return (
                    <div key={tbl.id} className={`flex w-full overflow-hidden ${justifyClass}`}>
                      <table className="w-auto min-w-[48%] max-w-full border-collapse text-[0.9em]">
                        <tbody>
                          {tbl.rows.map((row, rIdx) => (
                            <tr
                              key={rIdx}
                              className={
                                tbl.hasHeaderRow && rIdx === 0
                                  ? 'bg-slate-100 font-semibold'
                                  : ''
                              }
                            >
                              {row.map((cell, cIdx) => (
                                <td
                                  key={cIdx}
                                  className="border border-slate-500 px-2 py-1 text-center text-slate-900 break-words"
                                >
                                  {cell || '\u00A0'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Sub-questions visually connected to parent question */}
        {subSlice.length > 0 && (
          <div
            className={`${showStem ? 'mt-2' : ''} pr-1.5 ${
              question.subColumns === 2 ? 'grid grid-cols-2 gap-x-5 gap-y-1.5' : 'space-y-1.5'
            }`}
          >
            {subSlice.map(({ sq, idx }) => {
              const label = getSubQuestionLabel(idx, question.subLabelStyle);
              const subDir =
                sq.direction === 'auto' ? detectTextDirection(sq.textHtml) : sq.direction;
              const hydratedSub = renderRichHtmlWithMath(sq.textHtml);
              return (
                <div key={sq.id} className="flex items-start justify-between gap-2">
                  <div
                    dir={subDir}
                    className="exam-rich-content min-w-0 flex-1"
                    style={{ textAlign: subDir === 'ltr' ? 'left' : 'right' }}
                  >
                    <span
                      dir={question.subLabelStyle === 'english' ? 'ltr' : 'rtl'}
                      className="ml-1.5 mr-0.5 inline-block font-semibold text-slate-900"
                    >
                      {label}
                    </span>
                    <span
                      className="inline"
                      dangerouslySetInnerHTML={{ __html: hydratedSub || '...' }}
                    />
                  </div>
                  {sq.score > 0 && (
                    <span className="shrink-0 text-[0.82em] text-slate-600 tabular-nums whitespace-nowrap">
                      ({formatScore(sq.score)})
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </td>

      {/* Column 3 (Leftmost in RTL): بارم */}
      <td
        className="border border-slate-600 px-1 text-center font-semibold text-slate-900 tabular-nums"
        style={{ paddingTop: `${verticalPadPx}px`, paddingBottom: `${verticalPadPx}px` }}
      >
        {isContinuation ? '' : formatScore(question.score)}
      </td>
    </tr>
  );
};
