import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { ExamProject } from '../types/exam';
import { getPaperDimensionsMm } from '../utils/defaults';
import { toPersianDigits } from '../utils/jalali';
import { ExamHeaderRenderer } from './ExamHeaderRenderer';
import {
  ExamTableColGroup,
  ExamTableHeaderRow,
  ExamTableSummaryRow,
  QuestionSlice,
  QuestionTableRowRenderer,
} from './QuestionSheetRenderer';

const MM_TO_PX = 3.7795275591; // 96 DPI CSS mm

export interface PaginatedPreviewHandle {
  getPrintSheetElements: () => HTMLElement[];
}

interface PaginatedExamPreviewProps {
  project: ExamProject;
}

interface PagePlan {
  pageNumber: number;
  hasHeader: boolean;
  slices: QuestionSlice[];
  showSummaryRow: boolean;
}

export const PaginatedExamPreview = forwardRef<PaginatedPreviewHandle, PaginatedExamPreviewProps>(
  ({ project }, ref) => {
    const {
      paperSize,
      orientation,
      marginTopMm,
      marginBottomMm,
      marginRightMm,
      marginLeftMm,
      showPageNumbers,
    } = project.pageSettings;

    const designedHeader = project.headerConfig.designed;
    const gapBelowHeaderPx = (project.headerConfig.gapBelowHeaderMm ?? 3) * MM_TO_PX;

    const dims = useMemo(
      () => getPaperDimensionsMm(paperSize, orientation),
      [paperSize, orientation]
    );
    const pageWidthPx = dims.widthMm * MM_TO_PX;
    const pageHeightPx = dims.heightMm * MM_TO_PX;
    const contentWidthPx = Math.max(
      160,
      (dims.widthMm - marginLeftMm - marginRightMm) * MM_TO_PX
    );
    const footerHeightPx = showPageNumbers ? 24 : 0;
    const fullContentHeightPx = Math.max(
      140,
      pageHeightPx - marginTopMm * MM_TO_PX - marginBottomMm * MM_TO_PX - footerHeightPx
    );

    const measureHeaderRef = useRef<HTMLDivElement>(null);
    const measureHeaderRowRef = useRef<HTMLTableRowElement>(null);
    const measureSummaryRowRef = useRef<HTMLTableRowElement>(null);
    const measureWholeRowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
    const measureStemRowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
    const measureSubRowRefs = useRef<Record<string, (HTMLTableRowElement | null)[]>>({});
    const printSheetRefs = useRef<(HTMLDivElement | null)[]>([]);

    const [pages, setPages] = useState<PagePlan[]>([
      { pageNumber: 1, hasHeader: true, slices: [], showSummaryRow: true },
    ]);
    const [zoom, setZoom] = useState<number>(0.72);
    const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
    const [viewMode, setViewMode] = useState<'all' | 'single'>('all');

    const totalQuestionsScore = useMemo(
      () =>
        Math.round(
          project.questions.reduce((acc, q) => acc + (q.score || 0), 0) * 100
        ) / 100,
      [project.questions]
    );

    useImperativeHandle(ref, () => ({
      getPrintSheetElements: () =>
        printSheetRefs.current.filter(
          (el): el is HTMLDivElement => el !== null && el.isConnected
        ),
    }));

    // Dynamic @page stylesheet for native vector Print-to-PDF
    useEffect(() => {
      const styleId = 'dynamic-exam-print-page-style';
      let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = styleId;
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = `@media print { @page { size: ${paperSize} ${orientation}; margin: 0; } }`;
    }, [paperSize, orientation]);

    // Real DOM measurement-based pagination engine:
    // Measures the ACTUAL rendered header height + gap + exact 3-column table rows.
    const computePagination = () => {
      const actualHeaderH = designedHeader
        ? (measureHeaderRef.current?.offsetHeight ?? 0) + gapBelowHeaderPx
        : 0;
      const tableHeaderH = measureHeaderRowRef.current?.offsetHeight ?? 32;
      const summaryRowH = measureSummaryRowRef.current?.offsetHeight ?? 32;

      const page1BodyCap = Math.max(70, fullContentHeightPx - actualHeaderH - tableHeaderH - 4);
      const nextPageBodyCap = Math.max(100, fullContentHeightPx - tableHeaderH - 4);

      const builtPages: PagePlan[] = [
        { pageNumber: 1, hasHeader: true, slices: [], showSummaryRow: false },
      ];
      let activePageIdx = 0;
      let usedHeight = 0;

      const activeCap = () => (activePageIdx === 0 ? page1BodyCap : nextPageBodyCap);
      const startNewPage = () => {
        builtPages.push({
          pageNumber: builtPages.length + 1,
          hasHeader: false,
          slices: [],
          showSummaryRow: false,
        });
        activePageIdx = builtPages.length - 1;
        usedHeight = 0;
      };

      project.questions.forEach((q, qIdx) => {
        const wholeH = measureWholeRowRefs.current[q.id]?.offsetHeight ?? 52;

        // 1. Fits cleanly intact on current page
        if (usedHeight + wholeH <= activeCap()) {
          builtPages[activePageIdx].slices.push({
            question: q,
            questionIndex: qIdx,
            showStem: true,
          });
          usedHeight += wholeH;
          return;
        }

        // 2. Doesn't fit on current page, but fits intact on a fresh page -> move whole question intact
        if (wholeH <= nextPageBodyCap) {
          if (builtPages[activePageIdx].slices.length > 0 || activePageIdx === 0) {
            startNewPage();
          }
          builtPages[activePageIdx].slices.push({
            question: q,
            questionIndex: qIdx,
            showStem: true,
          });
          usedHeight += wholeH;
          return;
        }

        // 3. Exceptionally long question (taller than an entire page body):
        // split cleanly across pages along sub-question boundaries so the question number
        // is never left orphaned at the bottom of a page.
        const stemH = measureStemRowRefs.current[q.id]?.offsetHeight ?? 68;
        const firstSubH =
          q.subQuestions.length > 0
            ? (measureSubRowRefs.current[q.id]?.[0]?.offsetHeight ?? 28)
            : 0;

        if (
          usedHeight + stemH + firstSubH > activeCap() &&
          (builtPages[activePageIdx].slices.length > 0 || activePageIdx === 0)
        ) {
          startNewPage();
        }

        if (q.subQuestions.length === 0) {
          builtPages[activePageIdx].slices.push({
            question: q,
            questionIndex: qIdx,
            showStem: true,
          });
          usedHeight += stemH;
          return;
        }

        const subEls = measureSubRowRefs.current[q.id] ?? [];
        let batchStart = 0;
        let needStem = true;
        let batchHeight = stemH;

        for (let sIdx = 0; sIdx < q.subQuestions.length; sIdx++) {
          const rawSubH = subEls[sIdx]?.offsetHeight ?? 32;
          const incrementalSubH =
            sIdx === batchStart && !needStem ? rawSubH : Math.max(20, rawSubH - 10);

          if (
            usedHeight + batchHeight + incrementalSubH > activeCap() &&
            sIdx > batchStart
          ) {
            builtPages[activePageIdx].slices.push({
              question: q,
              questionIndex: qIdx,
              showStem: needStem,
              isContinuation: !needStem,
              subQuestionRange: [batchStart, sIdx],
            });
            startNewPage();
            batchStart = sIdx;
            needStem = false;
            batchHeight = rawSubH;
          } else {
            batchHeight += incrementalSubH;
          }
        }

        builtPages[activePageIdx].slices.push({
          question: q,
          questionIndex: qIdx,
          showStem: needStem,
          isContinuation: !needStem,
          subQuestionRange: [batchStart, q.subQuestions.length],
        });
        usedHeight += batchHeight;
      });

      if (usedHeight + summaryRowH > activeCap() && builtPages[activePageIdx].slices.length > 0) {
        startNewPage();
      }
      builtPages[builtPages.length - 1].showSummaryRow = true;

      setPages(builtPages);
      setCurrentPageIndex((prev) => Math.min(prev, Math.max(0, builtPages.length - 1)));
    };

    useLayoutEffect(() => {
      computePagination();
      const measureRoot = measureHeaderRef.current?.parentElement;
      if (!measureRoot) return;
      const imgs = Array.from(measureRoot.querySelectorAll('img'));
      const onLoad = () => computePagination();
      imgs.forEach((img) => {
        if (!img.complete) img.addEventListener('load', onLoad, { once: true });
      });
      const timer = setTimeout(computePagination, 80);
      return () => {
        clearTimeout(timer);
        imgs.forEach((img) => img.removeEventListener('load', onLoad));
      };
    }, [project, contentWidthPx, fullContentHeightPx, gapBelowHeaderPx]);

    const visiblePages = viewMode === 'single' ? [pages[currentPageIndex] ?? pages[0]] : pages;

    const renderSheet = (page: PagePlan, isPrintContainer: boolean, idx: number) => (
      <div
        key={`${isPrintContainer ? 'print' : 'view'}-${page.pageNumber}`}
        ref={
          isPrintContainer
            ? (el) => {
                printSheetRefs.current[idx] = el;
              }
            : undefined
        }
        data-page-number={page.pageNumber}
        className="exam-paper-sheet relative bg-white text-slate-900"
        style={{
          width: `${pageWidthPx}px`,
          height: `${pageHeightPx}px`,
          paddingTop: `${marginTopMm * MM_TO_PX}px`,
          paddingBottom: `${marginBottomMm * MM_TO_PX + footerHeightPx}px`,
          paddingRight: `${marginRightMm * MM_TO_PX}px`,
          paddingLeft: `${marginLeftMm * MM_TO_PX}px`,
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        {/* Continuous Page 1 Flow: Designed Header -> Controlled Gap -> Questions Table */}
        {page.hasHeader && (
          <div style={{ marginBottom: designedHeader ? `${gapBelowHeaderPx}px` : undefined }}>
            <ExamHeaderRenderer
              header={designedHeader}
              examInfo={project.examInfo}
              pageSettings={project.pageSettings}
              showEmptyPlaceholder={!isPrintContainer}
            />
          </div>
        )}

        {/* Authentic Iranian 3-Column RTL Exam Table (ردیف | سؤالات | بارم) */}
        <table
          dir="rtl"
          className="w-full table-fixed border-collapse bg-white"
          style={{
            border: '1.5px solid #1e293b',
          }}
        >
          <ExamTableColGroup />
          <thead>
            <ExamTableHeaderRow pageSettings={project.pageSettings} />
          </thead>
          <tbody>
            {page.slices.map((slice, sIdx) => (
              <QuestionTableRowRenderer
                key={`${slice.question.id}-${slice.subQuestionRange?.[0] ?? 'all'}-${sIdx}`}
                slice={slice}
                pageSettings={project.pageSettings}
              />
            ))}
            {page.showSummaryRow && (
              <ExamTableSummaryRow
                totalScore={totalQuestionsScore}
                pageSettings={project.pageSettings}
              />
            )}
          </tbody>
        </table>

        {/* Automatic Page Numbering Footer */}
        {showPageNumbers && (
          <div
            className="absolute bottom-0 left-0 right-0 flex items-center justify-center text-xs font-medium text-slate-600 tabular-nums"
            style={{
              height: `${marginBottomMm * MM_TO_PX}px`,
              fontFamily: `${project.pageSettings.persianFont}, sans-serif`,
            }}
          >
            صفحه {toPersianDigits(page.pageNumber)} از {toPersianDigits(pages.length)}
          </div>
        )}
      </div>
    );

    return (
      <div className="flex h-full flex-col bg-slate-100/80">
        {/* Preview Controls Bar */}
        <div className="no-print flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-700 tabular-nums">
              تعداد صفحات: {toPersianDigits(pages.length)}
            </span>
            <span className="text-slate-300">|</span>
            <div className="flex items-center rounded-lg bg-slate-100 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('all')}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors whitespace-nowrap ${
                  viewMode === 'all'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                همه صفحات
              </button>
              <button
                type="button"
                onClick={() => setViewMode('single')}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors whitespace-nowrap ${
                  viewMode === 'single'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                تک‌صفحه‌ای
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Page Navigation */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPageIndex <= 0}
                onClick={() => {
                  setViewMode('single');
                  setCurrentPageIndex((p) => Math.max(0, p - 1));
                }}
                className="rounded-md border border-slate-200 p-1 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                title="صفحه قبل"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <span className="px-2 text-xs text-slate-700 tabular-nums whitespace-nowrap">
                صفحه {toPersianDigits(currentPageIndex + 1)} از {toPersianDigits(pages.length)}
              </span>
              <button
                type="button"
                disabled={currentPageIndex >= pages.length - 1}
                onClick={() => {
                  setViewMode('single');
                  setCurrentPageIndex((p) => Math.min(pages.length - 1, p + 1));
                }}
                className="rounded-md border border-slate-200 p-1 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                title="صفحه بعد"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 border-r border-slate-200 pr-3">
              <button
                type="button"
                onClick={() =>
                  setZoom((z) => Math.max(0.45, Math.round((z - 0.1) * 100) / 100))
                }
                className="rounded-md border border-slate-200 p-1 text-slate-600 hover:bg-slate-50"
                title="کوچک‌نمایی"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <span className="w-11 text-center text-xs font-medium text-slate-700 tabular-nums">
                {toPersianDigits(Math.round(zoom * 100))}٪
              </span>
              <button
                type="button"
                onClick={() =>
                  setZoom((z) => Math.min(1.4, Math.round((z + 0.1) * 100) / 100))
                }
                className="rounded-md border border-slate-200 p-1 text-slate-600 hover:bg-slate-50"
                title="بزرگ‌نمایی"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Scaled Sheets Viewport */}
        <div className="no-print flex-1 overflow-auto p-6">
          <div className="flex flex-col items-center gap-6">
            {visiblePages.map((page, idx) => (
              <div
                key={`scaled-${page.pageNumber}`}
                dir="ltr"
                className="shadow-md ring-1 ring-slate-300/80"
                style={{
                  width: `${pageWidthPx * zoom}px`,
                  height: `${pageHeightPx * zoom}px`,
                  overflow: 'hidden',
                }}
              >
                <div
                  dir="rtl"
                  style={{
                    transform: `scale(${zoom})`,
                    transformOrigin: 'top left',
                    width: `${pageWidthPx}px`,
                    height: `${pageHeightPx}px`,
                  }}
                >
                  {renderSheet(page, false, idx)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Hidden Offscreen Measurement Layer (exact printable content width) */}
        <div
          aria-hidden="true"
          className="no-print pointer-events-none fixed -left-[9999px] top-0 opacity-0"
          style={{ width: `${contentWidthPx}px` }}
        >
          {/* Measure actual designed header height */}
          <div ref={measureHeaderRef}>
            {designedHeader && (
              <ExamHeaderRenderer
                header={designedHeader}
                examInfo={project.examInfo}
                pageSettings={project.pageSettings}
              />
            )}
          </div>

          <table dir="rtl" className="w-full table-fixed border-collapse">
            <ExamTableColGroup />
            <tbody>
              <tr ref={measureHeaderRowRef}>
                <td colSpan={3} className="p-0">
                  <table dir="rtl" className="w-full table-fixed border-collapse">
                    <ExamTableColGroup />
                    <thead>
                      <ExamTableHeaderRow pageSettings={project.pageSettings} />
                    </thead>
                  </table>
                </td>
              </tr>

              <tr ref={measureSummaryRowRef}>
                <td colSpan={3} className="p-0">
                  <table dir="rtl" className="w-full table-fixed border-collapse">
                    <ExamTableColGroup />
                    <tbody>
                      <ExamTableSummaryRow
                        totalScore={totalQuestionsScore}
                        pageSettings={project.pageSettings}
                      />
                    </tbody>
                  </table>
                </td>
              </tr>

              {project.questions.map((q, qIdx) => (
                <React.Fragment key={`measure-${q.id}`}>
                  <tr
                    ref={(el) => {
                      measureWholeRowRefs.current[q.id] = el;
                    }}
                  >
                    <td colSpan={3} className="p-0">
                      <table dir="rtl" className="w-full table-fixed border-collapse">
                        <ExamTableColGroup />
                        <tbody>
                          <QuestionTableRowRenderer
                            slice={{ question: q, questionIndex: qIdx, showStem: true }}
                            pageSettings={project.pageSettings}
                          />
                        </tbody>
                      </table>
                    </td>
                  </tr>

                  <tr
                    ref={(el) => {
                      measureStemRowRefs.current[q.id] = el;
                    }}
                  >
                    <td colSpan={3} className="p-0">
                      <table dir="rtl" className="w-full table-fixed border-collapse">
                        <ExamTableColGroup />
                        <tbody>
                          <QuestionTableRowRenderer
                            slice={{
                              question: q,
                              questionIndex: qIdx,
                              showStem: true,
                              subQuestionRange: [0, 0],
                            }}
                            pageSettings={project.pageSettings}
                          />
                        </tbody>
                      </table>
                    </td>
                  </tr>

                  {q.subQuestions.map((sq, sIdx) => (
                    <tr
                      key={`measure-sq-${sq.id}`}
                      ref={(el) => {
                        if (!measureSubRowRefs.current[q.id]) measureSubRowRefs.current[q.id] = [];
                        measureSubRowRefs.current[q.id][sIdx] = el;
                      }}
                    >
                      <td colSpan={3} className="p-0">
                        <table dir="rtl" className="w-full table-fixed border-collapse">
                          <ExamTableColGroup />
                          <tbody>
                            <QuestionTableRowRenderer
                              slice={{
                                question: q,
                                questionIndex: qIdx,
                                showStem: false,
                                isContinuation: true,
                                subQuestionRange: [sIdx, sIdx + 1],
                              }}
                              pageSettings={project.pageSettings}
                            />
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Unscaled Full-Resolution Print & PDF Capture Layer */}
        <div className="print-only-container pointer-events-none fixed -left-[99999px] top-0">
          {pages.map((page, idx) => renderSheet(page, true, idx))}
        </div>
      </div>
    );
  }
);

PaginatedExamPreview.displayName = 'PaginatedExamPreview';
