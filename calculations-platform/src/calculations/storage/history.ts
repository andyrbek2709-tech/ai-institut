import {
  HISTORY_SCHEMA_VERSION,
  HISTORY_STORAGE_KEY,
  HistoryEntry,
} from '../types';

interface HistoryFile {
  schemaVersion: number;
  entries: HistoryEntry[];
}

const emptyFile = (): HistoryFile => ({
  schemaVersion: HISTORY_SCHEMA_VERSION,
  entries: [],
});

const readFile = (): HistoryFile => {
  if (typeof window === 'undefined') return emptyFile();
  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return emptyFile();
    const parsed = JSON.parse(raw) as HistoryFile;
    if (parsed.schemaVersion !== HISTORY_SCHEMA_VERSION || !Array.isArray(parsed.entries)) {
      return emptyFile();
    }
    return parsed;
  } catch {
    return emptyFile();
  }
};

const writeFile = (file: HistoryFile): void => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(file));
};

const newId = (): string =>
  `hist_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export const getHistory = (): HistoryEntry[] => {
  const file = readFile();
  return [...file.entries].sort((a, b) =>
    b.timestampISO.localeCompare(a.timestampISO),
  );
};

export const saveToHistory = (
  entry: Omit<HistoryEntry, 'id' | 'timestampISO'>,
): HistoryEntry => {
  const file = readFile();
  const fullEntry: HistoryEntry = {
    ...entry,
    id: newId(),
    timestampISO: new Date().toISOString(),
  };
  file.entries.push(fullEntry);
  if (file.entries.length > 500) {
    file.entries = file.entries.slice(-500);
  }
  writeFile(file);
  return fullEntry;
};

export const deleteHistoryEntry = (id: string): void => {
  const file = readFile();
  file.entries = file.entries.filter((e) => e.id !== id);
  writeFile(file);
};

export const clearHistory = (): void => {
  writeFile(emptyFile());
};

export const getHistoryEntry = (id: string): HistoryEntry | undefined => {
  const file = readFile();
  return file.entries.find((e) => e.id === id);
};
