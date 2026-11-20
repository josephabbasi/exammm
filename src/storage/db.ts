import { BankQuestion, ExamProject, SavedHeader } from '../types/exam';
import { normalizeLoadedProject, normalizeLoadedSavedHeaders } from '../utils/defaults';

const DB_NAME = 'bargesaz_offline_db';
const DB_VERSION = 1;
const STORE_PROJECTS = 'projects';
const STORE_HEADERS = 'headers';
const STORE_BANK = 'question_bank';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('مرورگر از پایگاه‌داده محلی پشتیبانی نمی‌کند.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_HEADERS)) {
        db.createObjectStore(STORE_HEADERS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_BANK)) {
        db.createObjectStore(STORE_BANK, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('خطا در باز کردن حافظه محلی.'));
  });
}

async function getAllFromStore<T>(storeName: string): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result as T[]) ?? []);
    req.onerror = () => reject(req.error ?? new Error('خطا در خواندن اطلاعات.'));
  });
}

async function putInStore<T>(storeName: string, item: T): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.put(item);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error('خطا در ذخیره اطلاعات.'));
  });
}

async function deleteFromStore(storeName: string, id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error('خطا در حذف اطلاعات.'));
  });
}

// Projects API
export async function listProjects(): Promise<ExamProject[]> {
  const list = await getAllFromStore<ExamProject>(STORE_PROJECTS);
  return list.map(normalizeLoadedProject).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getProject(id: string): Promise<ExamProject | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PROJECTS, 'readonly');
    const req = tx.objectStore(STORE_PROJECTS).get(id);
    req.onsuccess = () => {
      const res = req.result as ExamProject | undefined;
      resolve(res ? normalizeLoadedProject(res) : undefined);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveProject(project: ExamProject): Promise<ExamProject> {
  const updated: ExamProject = {
    ...project,
    updatedAt: Date.now(),
  };
  await putInStore(STORE_PROJECTS, updated);
  return updated;
}

export async function deleteProject(id: string): Promise<void> {
  await deleteFromStore(STORE_PROJECTS, id);
}

// Saved Headers API
export async function listSavedHeaders(): Promise<SavedHeader[]> {
  const list = await getAllFromStore<unknown>(STORE_HEADERS);
  return normalizeLoadedSavedHeaders(list).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveHeaderTemplate(header: SavedHeader): Promise<void> {
  await putInStore(STORE_HEADERS, { ...header, updatedAt: Date.now() });
}

export async function deleteSavedHeader(id: string): Promise<void> {
  await deleteFromStore(STORE_HEADERS, id);
}

// Question Bank API
export async function listBankQuestions(): Promise<BankQuestion[]> {
  const list = await getAllFromStore<BankQuestion>(STORE_BANK);
  return list.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveBankQuestion(item: BankQuestion): Promise<void> {
  await putInStore(STORE_BANK, { ...item, updatedAt: Date.now() });
}

export async function deleteBankQuestion(id: string): Promise<void> {
  await deleteFromStore(STORE_BANK, id);
}

// Proprietary .bargeh Project File Export / Import
export interface BargehFileEnvelope {
  format: 'bargeh-exam-project';
  version: 1;
  exportedAt: number;
  project: ExamProject;
}

export function exportProjectAsFile(project: ExamProject): void {
  const envelope: BargehFileEnvelope = {
    format: 'bargeh-exam-project',
    version: 1,
    exportedAt: Date.now(),
    project,
  };
  const json = JSON.stringify(envelope, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = (project.title || project.examInfo.examName || 'exam').replace(/[\\/:*?"<>|]/g, '_');
  a.href = url;
  a.download = `${safeName}.bargeh`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function parseProjectFile(file: File): Promise<ExamProject> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('فایل انتخاب‌شده معتبر نیست یا ساختار آن آسیب دیده است.');
  }
  const env = parsed as Partial<BargehFileEnvelope>;
  if (!env || env.format !== 'bargeh-exam-project' || !env.project || !env.project.examInfo) {
    throw new Error('این فایل یک پروژه معتبر نرم‌افزار برگه‌ساز (.bargeh) نیست.');
  }
  return normalizeLoadedProject(env.project);
}
