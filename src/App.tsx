import React, { useEffect, useState } from 'react';
import { ExamWorkspace } from './components/ExamWorkspace';
import { DashboardView } from './components/DashboardView';
import { HeaderManagerPanel } from './components/HeaderManagerPanel';
import { QuestionBankPanel } from './components/QuestionBankPanel';
import {
  deleteBankQuestion,
  deleteProject,
  deleteSavedHeader,
  exportProjectAsFile,
  listBankQuestions,
  listProjects,
  listSavedHeaders,
  parseProjectFile,
  saveBankQuestion,
  saveHeaderTemplate,
  saveProject,
} from './storage/db';
import { AppView, BankQuestion, ExamProject, HeaderConfig, SavedHeader } from './types/exam';
import { DEFAULT_PAGE_SETTINGS, createDefaultProject } from './utils/defaults';

export default function App() {
  const [view, setView] = useState<AppView>('dashboard');
  const [loading, setLoading] = useState(true);
  const [storageError, setStorageError] = useState<string | null>(null);

  const [projects, setProjects] = useState<ExamProject[]>([]);
  const [savedHeaders, setSavedHeaders] = useState<SavedHeader[]>([]);
  const [bankQuestions, setBankQuestions] = useState<BankQuestion[]>([]);
  const [activeProject, setActiveProject] = useState<ExamProject | null>(null);

  const [standaloneHeader, setStandaloneHeader] = useState<HeaderConfig>({
    gapBelowHeaderMm: 3,
  });

  const loadAllData = async () => {
    setLoading(true);
    setStorageError(null);
    try {
      const [projs, hdrs, bank] = await Promise.all([
        listProjects(),
        listSavedHeaders(),
        listBankQuestions(),
      ]);
      setProjects(projs);
      setSavedHeaders(hdrs);
      setBankQuestions(bank);
    } catch (err) {
      setStorageError(
        err instanceof Error ? err.message : 'خطا در بارگذاری اطلاعات ذخیره‌شده محلی.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const handleCreateNewProject = async () => {
    const fresh = createDefaultProject(
      `امتحان شماره ${projects.length + 1}`,
      savedHeaders[0]
    );
    const saved = await saveProject(fresh);
    setProjects((prev) => [saved, ...prev]);
    setActiveProject(saved);
    setView('editor');
  };

  const handleOpenProject = (project: ExamProject) => {
    setActiveProject(project);
    setView('editor');
  };

  const handleSaveProject = async (project: ExamProject): Promise<ExamProject> => {
    const saved = await saveProject(project);
    setProjects((prev) => {
      const exists = prev.some((p) => p.id === saved.id);
      const next = exists ? prev.map((p) => (p.id === saved.id ? saved : p)) : [saved, ...prev];
      return next.sort((a, b) => b.updatedAt - a.updatedAt);
    });
    return saved;
  };

  const handleRenameProject = async (id: string, newTitle: string) => {
    const target = projects.find((p) => p.id === id);
    if (!target) return;
    await handleSaveProject({ ...target, title: newTitle });
  };

  const handleDeleteProject = async (id: string) => {
    await deleteProject(id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  const handleImportProjectFile = async (file: File) => {
    const parsed = await parseProjectFile(file);
    const saved = await handleSaveProject(parsed);
    setActiveProject(saved);
    setView('editor');
  };

  const handleSaveHeaderToLibrary = async (header: SavedHeader) => {
    await saveHeaderTemplate(header);
    const next = await listSavedHeaders();
    setSavedHeaders(next);
  };

  const handleDeleteSavedHeader = async (id: string) => {
    await deleteSavedHeader(id);
    setSavedHeaders((prev) => prev.filter((h) => h.id !== id));
  };

  const handleSaveBankQuestion = async (item: BankQuestion) => {
    await saveBankQuestion(item);
    const next = await listBankQuestions();
    setBankQuestions(next);
  };

  const handleDeleteBankQuestion = async (id: string) => {
    await deleteBankQuestion(id);
    setBankQuestions((prev) => prev.filter((b) => b.id !== id));
  };

  if (view === 'editor' && activeProject) {
    return (
      <ExamWorkspace
        key={activeProject.id}
        initialProject={activeProject}
        savedHeaders={savedHeaders}
        bankQuestions={bankQuestions}
        onSaveProject={handleSaveProject}
        onExportProjectFile={exportProjectAsFile}
        onSaveHeaderToLibrary={handleSaveHeaderToLibrary}
        onDeleteSavedHeader={handleDeleteSavedHeader}
        onSaveBankQuestion={handleSaveBankQuestion}
        onDeleteBankQuestion={handleDeleteBankQuestion}
        onBackToDashboard={() => {
          setActiveProject(null);
          setView('dashboard');
          loadAllData();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Clean 3-Zone Top Navigation Bar */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-6 py-3.5">
          <button
            type="button"
            onClick={() => setView('dashboard')}
            className="text-lg font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            برگه‌ساز
          </button>

          <nav className="flex items-center gap-6 text-sm font-medium text-slate-600">
            <button
              type="button"
              onClick={() => setView('dashboard')}
              className={`transition-colors whitespace-nowrap shrink-0 ${
                view === 'dashboard'
                  ? 'text-blue-600 font-semibold'
                  : 'hover:text-slate-900'
              }`}
            >
              داشبورد
            </button>
            <button
              type="button"
              onClick={() => setView('bank')}
              className={`transition-colors whitespace-nowrap shrink-0 ${
                view === 'bank' ? 'text-blue-600 font-semibold' : 'hover:text-slate-900'
              }`}
            >
              بانک سؤالات
            </button>
            <button
              type="button"
              onClick={() => setView('headers')}
              className={`transition-colors whitespace-nowrap shrink-0 ${
                view === 'headers'
                  ? 'text-blue-600 font-semibold'
                  : 'hover:text-slate-900'
              }`}
            >
              طراح سربرگ
            </button>
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={handleCreateNewProject}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
            >
              ایجاد امتحان جدید
            </button>
          </div>
        </div>
      </header>

      {storageError && (
        <div className="mx-auto mt-4 max-w-6xl px-6">
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {storageError}
          </div>
        </div>
      )}

      {loading ? (
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="space-y-4">
            <div className="h-24 animate-pulse rounded-xl bg-slate-200/70" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="h-36 animate-pulse rounded-xl bg-slate-200/70" />
              <div className="h-36 animate-pulse rounded-xl bg-slate-200/70" />
              <div className="h-36 animate-pulse rounded-xl bg-slate-200/70" />
            </div>
          </div>
        </div>
      ) : (
        <>
          {view === 'dashboard' && (
            <DashboardView
              projects={projects}
              onCreateNew={handleCreateNewProject}
              onOpenProject={handleOpenProject}
              onRenameProject={handleRenameProject}
              onDeleteProject={handleDeleteProject}
              onExportProjectFile={exportProjectAsFile}
              onImportProjectFile={handleImportProjectFile}
              onOpenBank={() => setView('bank')}
              onOpenHeaders={() => setView('headers')}
            />
          )}

          {view === 'bank' && (
            <div className="mx-auto max-w-6xl px-6 py-8">
              <div className="mb-5">
                <h1 className="text-xl font-bold text-slate-900">بانک سؤالات</h1>
                <p className="mt-1 text-xs text-slate-500">
                  سؤالات ذخیره‌شده در این بخش برای استفاده مجدد در تمام امتحانات در دسترس هستند.
                </p>
              </div>
              <QuestionBankPanel
                bankQuestions={bankQuestions}
                onSaveBankQuestion={handleSaveBankQuestion}
                onDeleteBankQuestion={handleDeleteBankQuestion}
              />
            </div>
          )}

          {view === 'headers' && (
            <div className="mx-auto max-w-6xl px-6 py-8">
              <div className="mb-5">
                <h1 className="text-xl font-bold text-slate-900">طراح سربرگ</h1>
                <p className="mt-1 text-xs text-slate-500">
                  سربرگ رسمی مدرسه را به‌صورت جدولی و تصویری طراحی کنید، لوگوی مدرسه و فیلدهای خودکار قرار دهید و برای استفاده سریع در امتحانات آینده ذخیره کنید.
                </p>
              </div>
              <HeaderManagerPanel
                headerConfig={standaloneHeader}
                pageSettings={DEFAULT_PAGE_SETTINGS}
                savedHeaders={savedHeaders}
                onChangeHeader={setStandaloneHeader}
                onSaveHeaderToLibrary={handleSaveHeaderToLibrary}
                onDeleteSavedHeader={handleDeleteSavedHeader}
                libraryOnly
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
