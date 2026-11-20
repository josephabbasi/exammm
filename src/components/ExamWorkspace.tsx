import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Download,
  FileDown,
  FileText,
  Plus,
  Printer,
  Save,
  Settings,
} from 'lucide-react';
import { exportExamSheetsToPdf, exportExamToDocx } from '../services/exportService';
import {
  BankQuestion,
  ExamProject,
  QuestionItem,
  SaveStatus,
  SavedHeader,
} from '../types/exam';
import { createEmptyQuestion, createId } from '../utils/defaults';
import { formatScore } from '../utils/jalali';
import { ExamInfoPanel } from './ExamInfoPanel';
import { HeaderManagerPanel } from './HeaderManagerPanel';
import { PageSettingsModal } from './PageSettingsModal';
import { PaginatedExamPreview, PaginatedPreviewHandle } from './PaginatedExamPreview';
import { QuestionBankModal } from './QuestionBankPanel';
import { QuestionEditorCard } from './QuestionEditorCard';

interface ExamWorkspaceProps {
  initialProject: ExamProject;
  savedHeaders: SavedHeader[];
  bankQuestions: BankQuestion[];
  onSaveProject: (project: ExamProject) => Promise<ExamProject>;
  onExportProjectFile: (project: ExamProject) => void;
  onSaveHeaderToLibrary: (header: SavedHeader) => Promise<void>;
  onDeleteSavedHeader: (id: string) => Promise<void>;
  onSaveBankQuestion: (item: BankQuestion) => Promise<void>;
  onDeleteBankQuestion: (id: string) => Promise<void>;
  onBackToDashboard: () => void;
}

type EditorStep = 'info' | 'header' | 'questions';

export const ExamWorkspace: React.FC<ExamWorkspaceProps> = ({
  initialProject,
  savedHeaders,
  bankQuestions,
  onSaveProject,
  onExportProjectFile,
  onSaveHeaderToLibrary,
  onDeleteSavedHeader,
  onSaveBankQuestion,
  onDeleteBankQuestion,
  onBackToDashboard,
}) => {
  const [project, setProject] = useState<ExamProject>(initialProject);
  const [step, setStep] = useState<EditorStep>(
    initialProject.headerConfig.designed ? 'questions' : 'header'
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [isDirty, setIsDirty] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [bankModalOpen, setBankModalOpen] = useState(false);
  const [mobilePane, setMobilePane] = useState<'editor' | 'preview'>('editor');
  const [exportingType, setExportingType] = useState<'pdf' | 'docx' | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const previewRef = useRef<PaginatedPreviewHandle>(null);
  const projectRef = useRef<ExamProject>(project);
  const dirtyRef = useRef<boolean>(isDirty);

  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  useEffect(() => {
    dirtyRef.current = isDirty;
  }, [isDirty]);

  const updateProject = (updater: (prev: ExamProject) => ExamProject) => {
    setProject((prev) => updater(prev));
    setIsDirty(true);
    setSaveStatus('idle');
  };

  const performSave = async (silent = false) => {
    if (!silent) setSaveStatus('saving');
    else if (dirtyRef.current) setSaveStatus('saving');
    try {
      const saved = await onSaveProject(projectRef.current);
      setProject((prev) => ({ ...prev, updatedAt: saved.updatedAt }));
      setIsDirty(false);
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  };

  // Auto-save every 10 seconds when changes exist
  useEffect(() => {
    const timer = setInterval(() => {
      if (dirtyRef.current) {
        performSave(true);
      }
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Warn before closing tab if unsaved changes remain
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const handleBack = async () => {
    if (dirtyRef.current) {
      await performSave(false);
    }
    onBackToDashboard();
  };

  const handleExportPdf = async () => {
    setExportError(null);
    setExportingType('pdf');
    try {
      const sheets = previewRef.current?.getPrintSheetElements() ?? [];
      await exportExamSheetsToPdf(sheets, project);
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : 'خطا در تولید فایل PDF. لطفاً از گزینه چاپ استفاده کنید.'
      );
    } finally {
      setExportingType(null);
    }
  };

  const handleExportDocx = async () => {
    setExportError(null);
    setExportingType('docx');
    try {
      await exportExamToDocx(project);
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : 'خطا در تولید فایل Word قابل ویرایش.'
      );
    } finally {
      setExportingType(null);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Question CRUD
  const addNewQuestion = () => {
    updateProject((prev) => ({
      ...prev,
      questions: [...prev.questions, createEmptyQuestion()],
    }));
  };

  const updateQuestion = (qId: string, updated: QuestionItem) => {
    updateProject((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => (q.id === qId ? updated : q)),
    }));
  };

  const moveQuestion = (index: number, delta: -1 | 1) => {
    updateProject((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.questions.length) return prev;
      const copy = [...prev.questions];
      const [item] = copy.splice(index, 1);
      copy.splice(target, 0, item);
      return { ...prev, questions: copy };
    });
  };

  const duplicateQuestion = (q: QuestionItem) => {
    const cloned: QuestionItem = JSON.parse(JSON.stringify(q));
    cloned.id = createId('q');
    cloned.images = cloned.images.map((im) => ({ ...im, id: createId('img') }));
    cloned.tables = cloned.tables.map((t) => ({ ...t, id: createId('tbl') }));
    cloned.formulas = cloned.formulas.map((f) => ({ ...f, id: createId('f') }));
    cloned.subQuestions = cloned.subQuestions.map((sq) => ({ ...sq, id: createId('sq') }));
    updateProject((prev) => ({
      ...prev,
      questions: [...prev.questions, cloned],
    }));
  };

  const deleteQuestion = (qId: string) => {
    updateProject((prev) => {
      const remaining = prev.questions.filter((q) => q.id !== qId);
      return {
        ...prev,
        questions: remaining.length > 0 ? remaining : [createEmptyQuestion()],
      };
    });
  };

  const saveQuestionToBank = async (q: QuestionItem) => {
    const { id: _id, manualNumber: _mn, ...rest } = JSON.parse(JSON.stringify(q)) as QuestionItem;
    const bankItem: BankQuestion = {
      id: createId('bank'),
      subject: project.examInfo.subject || 'عمومی',
      grade: project.examInfo.grade || 'همه پایه‌ها',
      chapter: project.examInfo.examName || '',
      suggestedScore: q.score,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      question: rest,
    };
    await onSaveBankQuestion(bankItem);
  };

  const addQuestionsFromBank = (questions: QuestionItem[]) => {
    updateProject((prev) => {
      // If only 1 empty placeholder question exists, replace it cleanly
      const hasOnlyBlank =
        prev.questions.length === 1 &&
        !prev.questions[0].contentHtml.replace(/<[^>]+>/g, '').trim() &&
        prev.questions[0].images.length === 0 &&
        prev.questions[0].subQuestions.length === 0;
      return {
        ...prev,
        questions: hasOnlyBlank ? questions : [...prev.questions, ...questions],
      };
    });
  };

  // Score calculation
  const sumOfQuestionScores =
    Math.round(project.questions.reduce((sum, q) => sum + (q.score || 0), 0) * 100) / 100;
  const targetTotalScore = Math.round((project.examInfo.totalScore || 0) * 100) / 100;
  const scoreDiff = Math.round((sumOfQuestionScores - targetTotalScore) * 100) / 100;
  const scoreMatches = Math.abs(scoreDiff) < 0.001;

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      {/* Top Studio Bar (Clean & Focused) */}
      <header className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
        {/* Right: Back + Project Title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            داشبورد
          </button>

          <input
            type="text"
            value={project.title}
            onChange={(e) =>
              updateProject((prev) => ({ ...prev, title: e.target.value }))
            }
            placeholder="نام پروژه امتحان..."
            className="w-40 sm:w-56 truncate rounded-md border border-transparent px-2 py-1 text-sm font-semibold text-slate-900 hover:border-slate-200 focus:border-blue-500 focus:bg-white focus:outline-none"
          />

          <span className="hidden md:inline-block text-xs text-slate-500 whitespace-nowrap">
            {saveStatus === 'saving'
              ? 'در حال ذخیره...'
              : saveStatus === 'error'
                ? 'خطا در ذخیرهسازی'
                : isDirty
                  ? 'تغییرات ذخیره نشده'
                  : 'ذخیره شد'}
          </span>
        </div>

        {/* Center: 3-Step Tabs */}
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          {(
            [
              ['header', '۱. طراح سربرگ'],
              ['questions', '۲. سؤالات'],
              ['info', '۳. مشخصات امتحان'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setStep(key)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                step === key
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Left: Essential Actions */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            title="تنظیمات صفحه (کاغذ، حاشیه، فونت)"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <Settings className="h-3.5 w-3.5 text-slate-500" />
            <span className="hidden lg:inline">تنظیمات صفحه</span>
          </button>

          <button
            type="button"
            onClick={() => performSave(false)}
            title="ذخیره دستی در حافظه"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <Save className="h-3.5 w-3.5 text-slate-500" />
            <span className="hidden sm:inline">ذخیره</span>
          </button>

          <button
            type="button"
            onClick={() => onExportProjectFile(project)}
            title="دانلود فایل پروژه (.bargeh)"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            <span className="hidden xl:inline">فایل پروژه</span>
          </button>

          <button
            type="button"
            disabled={exportingType !== null}
            onClick={handleExportDocx}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
          >
            <FileText className="h-3.5 w-3.5 text-blue-600" />
            {exportingType === 'docx' ? 'در حال ساخت Word...' : 'خروجی Word'}
          </button>

          <button
            type="button"
            disabled={exportingType !== null}
            onClick={handleExportPdf}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
          >
            <FileDown className="h-3.5 w-3.5" />
            {exportingType === 'pdf' ? 'در حال ساخت PDF...' : 'خروجی PDF'}
          </button>

          <button
            type="button"
            onClick={handlePrint}
            title="چاپ مستقیم یا ذخیره PDF برداری سیستم"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <Printer className="h-3.5 w-3.5 text-slate-600" />
          </button>
        </div>
      </header>

      {exportError && (
        <div className="no-print border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
          {exportError}
        </div>
      )}

      {/* Mobile Pane Switcher */}
      <div className="no-print flex border-b border-slate-200 bg-white lg:hidden">
        <button
          type="button"
          onClick={() => setMobilePane('editor')}
          className={`flex-1 py-2 text-xs font-semibold ${
            mobilePane === 'editor' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-slate-600'
          }`}
        >
          بخش طراحی و ورود سؤالات
        </button>
        <button
          type="button"
          onClick={() => setMobilePane('preview')}
          className={`flex-1 py-2 text-xs font-semibold ${
            mobilePane === 'preview'
              ? 'border-b-2 border-blue-600 text-blue-700'
              : 'text-slate-600'
          }`}
        >
          پیش‌نمایش زنده برگه
        </button>
      </div>

      {/* Main Split Workspace */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Right Pane (RTL): Step Editor */}
        <section
          className={`no-print flex w-full flex-col border-l border-slate-200 bg-slate-50 lg:w-[50%] xl:w-[48%] ${
            mobilePane === 'preview' ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {/* Score Verification Bar */}
          <div
            className={`flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 text-xs ${
              scoreMatches
                ? 'border-slate-200 bg-white text-slate-700'
                : 'border-amber-200 bg-amber-50 text-amber-900'
            }`}
          >
            <div className="flex items-center gap-3 tabular-nums">
              <span>
                نمره کل امتحان: <strong>{formatScore(targetTotalScore)}</strong>
              </span>
              <span className="text-slate-300">|</span>
              <span>
                مجموع بارم سؤالات: <strong>{formatScore(sumOfQuestionScores)}</strong>
              </span>
            </div>

            <div className="flex items-center gap-1.5 font-medium">
              {scoreMatches ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span className="text-emerald-700">مجموع بارم‌ها دقیقاً مطابق نمره کل است.</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span>
                    مجموع بارم‌ها با نمره کل مطابقت ندارد (
                    {scoreDiff > 0
                      ? `${formatScore(scoreDiff)} نمره اضافه`
                      : `${formatScore(Math.abs(scoreDiff))} نمره کم`}
                    )
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Scrollable Step Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5">
            {step === 'info' && (
              <ExamInfoPanel
                examInfo={project.examInfo}
                onChange={(examInfo) => updateProject((prev) => ({ ...prev, examInfo }))}
                onNextStep={() => setStep('header')}
              />
            )}

            {step === 'header' && (
              <div className="space-y-4">
                <HeaderManagerPanel
                  headerConfig={project.headerConfig}
                  pageSettings={project.pageSettings}
                  examInfo={project.examInfo}
                  savedHeaders={savedHeaders}
                  onChangeHeader={(headerConfig) =>
                    updateProject((prev) => ({ ...prev, headerConfig }))
                  }
                  onSaveHeaderToLibrary={onSaveHeaderToLibrary}
                  onDeleteSavedHeader={onDeleteSavedHeader}
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setStep('questions')}
                    className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                  >
                    ادامه و نوشتن سؤالات
                  </button>
                </div>
              </div>
            )}

            {step === 'questions' && (
              <div className="space-y-4">
                {project.questions.map((q, idx) => (
                  <QuestionEditorCard
                    key={q.id}
                    question={q}
                    index={idx}
                    totalCount={project.questions.length}
                    onChange={(updated) => updateQuestion(q.id, updated)}
                    onMoveUp={() => moveQuestion(idx, -1)}
                    onMoveDown={() => moveQuestion(idx, 1)}
                    onDuplicate={() => duplicateQuestion(q)}
                    onDelete={() => deleteQuestion(q.id)}
                    onSaveToBank={() => saveQuestionToBank(q)}
                  />
                ))}

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={addNewQuestion}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-blue-300 bg-blue-50/50 px-4 py-3 text-sm font-semibold text-blue-700 hover:border-blue-400 hover:bg-blue-50 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    افزودن سؤال جدید
                  </button>

                  <button
                    type="button"
                    onClick={() => setBankModalOpen(true)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <BookOpen className="h-4 w-4 text-blue-600" />
                    انتخاب از بانک سؤالات
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Left Pane (RTL): Synchronized Live Paginated Exam Preview */}
        <section
          className={`w-full flex-col lg:flex lg:w-[50%] xl:w-[52%] ${
            mobilePane === 'editor' ? 'hidden lg:flex' : 'flex'
          }`}
        >
          <PaginatedExamPreview ref={previewRef} project={project} />
        </section>
      </div>

      {/* Separate Page Settings Modal */}
      <PageSettingsModal
        isOpen={settingsOpen}
        settings={project.pageSettings}
        onChange={(pageSettings) => updateProject((prev) => ({ ...prev, pageSettings }))}
        onClose={() => setSettingsOpen(false)}
      />

      {/* Question Bank Picker Modal */}
      <QuestionBankModal
        isOpen={bankModalOpen}
        bankQuestions={bankQuestions}
        onSaveBankQuestion={onSaveBankQuestion}
        onDeleteBankQuestion={onDeleteBankQuestion}
        onAddSelected={addQuestionsFromBank}
        onClose={() => setBankModalOpen(false)}
      />
    </div>
  );
};
