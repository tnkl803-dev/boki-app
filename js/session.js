import { getAll, put } from './db.js';
import { nextDailyLogId, weekOf, accuracy } from './scoring.js';
export function summarizeReview(results, elapsedSec) {
  const correct = results.filter(r => r.finalRating >= 3).length;
  return { q: results.length, correct, wrong: results.length - correct, actualMin: Math.round(elapsedSec / 60) };
}
export async function saveDailyLog(db, settings, p) {
  const ids = (await getAll(db, 'dailyLogs')).map(d => d.id);
  const row = { id: nextDailyLogId(p.date, p.code, ids), date: p.date, week: weekOf(p.date, settings.startDate), sessionType: p.sessionType,
    field: p.field ?? '', topic: p.topic ?? '', priority: p.priority ?? 'A', content: p.content, planMin: p.planMin ?? null, actualMin: p.actualMin ?? null,
    q: p.q ?? null, correct: p.correct ?? null, wrong: p.wrong ?? null, blank: p.blank ?? null, rate: accuracy(p.correct, p.wrong),
    understand: p.understand ?? null, focus: p.focus ?? null, confidence: p.confidence ?? null, cause: p.cause ?? '', comment: p.comment ?? '' };
  await put(db, 'dailyLogs', row); return row;
}
