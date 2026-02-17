import { HistoryItem } from '../types/history';

const DB_NAME = 'outfitlab-db';
const DB_VERSION = 1;
const STORE_NAME = 'app_state';
const HISTORY_KEY = 'history_items';
const MAX_HISTORY_ITEMS = 10;
const LEGACY_HISTORY_KEY = 'outfitlab_history';

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
  });

const runTransaction = async <T>(
  mode: IDBTransactionMode,
  handler: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void
): Promise<T> => {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    handler(store, resolve, reject);
    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
};

export const loadHistoryFromDb = async (): Promise<HistoryItem[]> => {
  try {
    const data = await runTransaction<HistoryItem[]>('readonly', (store, resolve) => {
      const request = store.get(HISTORY_KEY);
      request.onsuccess = () => {
        const value = request.result;
        resolve(Array.isArray(value) ? value : []);
      };
      request.onerror = () => resolve([]);
    });
    if (data.length > 0) return data;

    // One-time fallback migration from legacy localStorage key if present.
    const legacyRaw = localStorage.getItem(LEGACY_HISTORY_KEY);
    if (!legacyRaw) return [];
    const legacyData = JSON.parse(legacyRaw);
    const normalized = Array.isArray(legacyData) ? legacyData.slice(0, MAX_HISTORY_ITEMS) : [];
    if (normalized.length > 0) {
      await saveHistoryToDb(normalized);
    }
    localStorage.removeItem(LEGACY_HISTORY_KEY);
    return normalized;
  } catch (error) {
    console.warn('Failed to load history from IndexedDB:', error);
    return [];
  }
};

export const saveHistoryToDb = async (history: HistoryItem[]): Promise<void> => {
  const payload = history.slice(0, MAX_HISTORY_ITEMS);
  try {
    await runTransaction<void>('readwrite', (store, resolve, reject) => {
      const request = store.put(payload, HISTORY_KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn('Failed to save history to IndexedDB:', error);
  }
};
