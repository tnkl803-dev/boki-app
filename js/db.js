import { nextDailyLogId, nextCardId, nextQuestionId } from './scoring.js';
export const STORES = ['settings', 'roadmap', 'cards', 'reviewLogs', 'questions', 'answerLogs', 'dailyLogs', 'accounts'];
const KEYS = { accounts: 'name' };
const keyOf = s => KEYS[s] ?? 'id';
const VERSION = 1;
const FRESH_ID_STORES = ['dailyLogs', 'cards', 'questions'];

const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const done = tx => new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); });

export function openDb(name = 'boki') {
  if (!('indexedDB' in globalThis)) return Promise.reject(new Error('IndexedDB unavailable'));
  const r = indexedDB.open(name, VERSION);
  r.onupgradeneeded = () => { const db = r.result; for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: keyOf(s) }); };
  return req(r);
}
export function deleteDb(name) { return req(indexedDB.deleteDatabase(name)); }

export async function put(db, store, obj, opts = {}) {
  const now = new Date().toISOString();
  const o = opts.keepUpdatedAt && obj.updatedAt ? obj : { ...obj, updatedAt: now, createdAt: obj.createdAt ?? now };
  const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).put(o); await done(tx); return o;
}
export async function putAll(db, store, arr, opts = {}) {
  const now = new Date().toISOString(); const tx = db.transaction(store, 'readwrite'); const os = tx.objectStore(store);
  for (const obj of arr) os.put(opts.keepUpdatedAt && obj.updatedAt ? obj : { ...obj, updatedAt: now, createdAt: obj.createdAt ?? now });
  await done(tx);
}
export function get(db, store, key) { return req(db.transaction(store).objectStore(store).get(key)); }
export function getAll(db, store) { return req(db.transaction(store).objectStore(store).getAll()); }
export function count(db, store) { return req(db.transaction(store).objectStore(store).count()); }
export async function del(db, store, key) { const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).delete(key); await done(tx); }
export async function clear(db, store) { const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).clear(); await done(tx); }

export async function exportAll(db) {
  const stores = {}; for (const s of STORES) stores[s] = await getAll(db, s);
  return { version: VERSION, exportedAt: new Date().toISOString(), stores };
}
export function validateBackup(d) {
  if (!d || typeof d !== 'object') return { ok: false, error: 'JSONではありません' };
  if (d.version !== VERSION) return { ok: false, error: `version不一致（期待${VERSION}、実際${d.version}）` };
  if (!d.stores || typeof d.stores !== 'object') return { ok: false, error: 'storesがありません' };
  for (const s of STORES) if (!Array.isArray(d.stores[s])) return { ok: false, error: `ストア「${s}」がありません` };
  return { ok: true };
}
function freshIdFor(store, r, idsPool) {
  if (store === 'dailyLogs') {
    const m = /^DL-(\d{4})(\d{2})(\d{2})-([^\d]+)\d{2}$/.exec(r.id);
    if (m) return nextDailyLogId(`${m[1]}-${m[2]}-${m[3]}`, m[4], idsPool);
  }
  if (store === 'cards') {
    const m = /^FC-W(\d{2})-\d{4}$/.exec(r.id);
    if (m) return nextCardId(Number(m[1]), idsPool);
  }
  if (store === 'questions') return nextQuestionId(idsPool);
  return null;
}
export async function importAll(db, data, mode) {
  const v = validateBackup(data); if (!v.ok) throw new Error(v.error);
  for (const s of STORES) {
    if (mode === 'overwrite') { await clear(db, s); await putAll(db, s, data.stores[s], { keepUpdatedAt: true }); continue; }
    const k = keyOf(s); const localArr = await getAll(db, s); const local = new Map(localArr.map(o => [o[k], o]));
    const idsPool = localArr.map(o => o[k]);
    const toPut = [];
    for (const r of data.stores[s]) {
      const l = local.get(r[k]);
      if (l && FRESH_ID_STORES.includes(s) && r.createdAt && l.createdAt && r.createdAt !== l.createdAt) {
        const fresh = freshIdFor(s, r, idsPool);
        if (fresh) { idsPool.push(fresh); toPut.push({ ...r, [k]: fresh }); continue; }
      }
      if (!l || String(r.updatedAt ?? '') > String(l.updatedAt ?? '')) toPut.push(r);
    }
    await putAll(db, s, toPut, { keepUpdatedAt: true });
  }
}
