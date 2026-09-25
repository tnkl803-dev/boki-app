export const RATING = { AGAIN: 1, HARD: 2, GOOD: 3, EASY: 4 };
export const RATING_LABEL = { 1: 'できなかった', 2: '迷ったが正解', 3: 'できた', 4: '即答できた' };
export const RATING_HINT = '一部しか答えられなかったら「できなかった」';
const MAX_INTERVAL = 180, MIN_EASE = 1.3;
const round2 = x => Math.round(x * 100) / 100;

export function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function newSrsState() {
  return { due: null, interval: 0, ease: 2.5, reps: 0, streak: 0, lastResult: null, lastReviewed: null };
}
export function applyRating(state, rating, today) {
  let { interval, ease, streak } = state;
  if (rating === RATING.AGAIN) { interval = 0; ease = Math.max(MIN_EASE, round2(ease - 0.2)); streak = 0; }
  else if (rating === RATING.HARD) { interval = Math.max(1, Math.round(interval * 1.2)); ease = Math.max(MIN_EASE, round2(ease - 0.15)); streak++; }
  else if (rating === RATING.GOOD) { interval = interval === 0 ? 1 : interval === 1 ? 3 : Math.round(interval * ease); streak++; }
  else if (rating === RATING.EASY) { interval = interval === 0 ? 4 : Math.max(interval + 1, Math.round(interval * ease * 1.3)); ease = round2(ease + 0.15); streak++; }
  else throw new Error('invalid rating ' + rating);
  interval = Math.min(MAX_INTERVAL, interval);
  return { ...state, interval, ease, streak, reps: state.reps + 1, due: addDays(today, interval), lastResult: rating, lastReviewed: today };
}
export function cardStatus(s) { return s.reps === 0 ? '新規' : s.interval < 21 ? '学習中' : '定着'; }
export function isDue(s, today) { return !s.due || s.due <= today; }
const PRI = { A: 0, B: 1, C: 2 };
export function dueCards(cards, today) {
  return cards.filter(c => c.status !== '停止' && isDue(c, today))
    .sort((a, b) => (PRI[a.priority] ?? 9) - (PRI[b.priority] ?? 9) || String(a.due ?? '').localeCompare(String(b.due ?? '')));
}
