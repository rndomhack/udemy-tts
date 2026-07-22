import type { CacheRecord, CacheSummary } from '../lib/cache-schema';
import { toSummary } from '../lib/cache-schema';
import { createLogger } from '../lib/logger';

// 翻訳キャッシュを保存する IndexedDB。
// コンテンツスクリプト側の DB は udemy.com オリジンになりオプションページから読めないため、必ずここを経由する。

const log = createLogger('cache-db');

const DB_NAME = 'udemy-tts';
const DB_VERSION = 1;
const STORE = 'translations';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'key' });
        store.createIndex('courseId', 'courseId', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('indexedDB.open failed'));
  });
}

function requestToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IDBRequest failed'));
  });
}

// ストアへの 1 操作を接続の開閉ごとに行う。バックグラウンドの休止明けは接続が無効なことがあるため 1 度だけやり直す
async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => Promise<T>,
): Promise<T> {
  const attempt = async (): Promise<T> => {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE, mode);
      const result = await fn(tx.objectStore(STORE));
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('transaction failed'));
        tx.onabort = () => reject(tx.error ?? new Error('transaction aborted'));
      });
      return result;
    } finally {
      db.close();
    }
  };
  try {
    return await attempt();
  } catch (e) {
    if (e instanceof DOMException && e.name === 'InvalidStateError') {
      log.warn('InvalidStateError, retrying once');
      return attempt();
    }
    throw e;
  }
}

export function cacheGet(key: string): Promise<CacheRecord | undefined> {
  return withStore('readonly', (store) =>
    requestToPromise(store.get(key) as IDBRequest<CacheRecord | undefined>),
  );
}

export function cachePut(record: CacheRecord): Promise<void> {
  return withStore('readwrite', async (store) => {
    await requestToPromise(store.put(record));
  });
}

export function cacheList(): Promise<CacheSummary[]> {
  return withStore('readonly', async (store) => {
    const records = await requestToPromise(store.getAll() as IDBRequest<CacheRecord[]>);
    return records.map(toSummary);
  });
}

export function cacheStatusForLecture(
  courseId: string,
  lectureId: string,
): Promise<CacheSummary[]> {
  return withStore('readonly', async (store) => {
    const index = store.index('courseId');
    const records = await requestToPromise(
      index.getAll(courseId) as IDBRequest<CacheRecord[]>,
    );
    return records.filter((r) => r.lectureId === lectureId).map(toSummary);
  });
}

export function cacheDelete(keys: string[]): Promise<void> {
  return withStore('readwrite', async (store) => {
    await Promise.all(keys.map((key) => requestToPromise(store.delete(key))));
  });
}

export function cacheClear(): Promise<void> {
  return withStore('readwrite', async (store) => {
    await requestToPromise(store.clear());
  });
}
