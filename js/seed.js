import { count, putAll } from './db.js';
export async function seedIfEmpty(db, seed) {
  if ((await count(db, 'cards')) > 0) return false;
  for (const s of ['settings', 'roadmap', 'cards', 'dailyLogs', 'accounts', 'questions']) if (seed[s]?.length) await putAll(db, s, seed[s]);
  return true;
}
