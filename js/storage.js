// 作品儲存在瀏覽器 IndexedDB：資料庫 "rainbow-coloring"，資料表 "works"
// 每筆作品：{ id, drawingId, name, lineArt(Blob 原始線稿), colorLayer(Blob 上色圖層 PNG),
//            background(背景色), thumbnail(Blob 縮圖), createdAt, updatedAt }

const DB_NAME = 'rainbow-coloring';
const DB_VERSION = 1;
const STORE = 'works';
let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) { reject(new Error('此瀏覽器不支援 IndexedDB')); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  dbPromise.catch(() => { dbPromise = null; });
  return dbPromise;
}

function tx(mode, fn) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    let result;
    Promise.resolve(fn(store, r => { result = r; })).catch(reject);
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('交易中止'));
  }));
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function listWorks() {
  const all = await tx('readonly', (store, set) => reqToPromise(store.getAll()).then(set));
  return (all || []).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getWork(id) {
  return tx('readonly', (store, set) => reqToPromise(store.get(id)).then(set));
}

export function putWork(work) {
  return tx('readwrite', store => { store.put(work); });
}

export function deleteWork(id) {
  return tx('readwrite', store => { store.delete(id); });
}

export function newId() {
  return 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// 小設定（例如動畫開關）放 localStorage，失敗時不影響使用
export const settings = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem('rcp:' + key);
      return v === null ? fallback : JSON.parse(v);
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem('rcp:' + key, JSON.stringify(value)); } catch { /* 忽略 */ }
  },
};
