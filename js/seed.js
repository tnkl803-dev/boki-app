import { count, putAll } from './db.js';
const EPOCH = '1970-01-01T00:00:00.000Z';
export async function seedIfEmpty(db, seed) {
  if ((await count(db, 'cards')) > 0) return false;
  for (const s of ['settings', 'roadmap', 'cards', 'dailyLogs', 'accounts', 'questions']) {
    if (seed[s]?.length) await putAll(db, s, seed[s].map(o => ({ ...o, updatedAt: o.updatedAt ?? EPOCH })), { keepUpdatedAt: true });
  }
  return true;
}
