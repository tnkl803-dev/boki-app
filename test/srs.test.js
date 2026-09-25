import { test, assert } from './runner.js';
import { RATING, RATING_LABEL, newSrsState, applyRating, cardStatus, isDue, dueCards, addDays } from '../js/srs.js';
const T = '2026-09-25';

test('addDays', () => { assert.equal(addDays('2026-09-30', 1), '2026-10-01'); assert.equal(addDays(T, 0), T); });
test('labels', () => { assert.equal(RATING_LABEL[RATING.AGAIN], 'できなかった'); assert.equal(RATING_LABEL[4], '即答できた'); });
test('new state', () => { assert.deepEqual(newSrsState(), { due: null, interval: 0, ease: 2.5, reps: 0, streak: 0, lastResult: null, lastReviewed: null }); });
test('AGAIN resets, due today, ease -0.2 floor 1.3', () => {
  const s = applyRating({ ...newSrsState(), interval: 10, ease: 1.4, streak: 3 }, 1, T);
  assert.equal(s.interval, 0); assert.equal(s.due, T); assert.equal(s.ease, 1.3); assert.equal(s.streak, 0); assert.equal(s.reps, 1); assert.equal(s.lastResult, 1);
});
test('HARD x1.2 min 1, ease -0.15', () => {
  const s = applyRating({ ...newSrsState(), interval: 10 }, 2, T);
  assert.equal(s.interval, 12); assert.equal(s.ease, 2.35); assert.equal(s.due, addDays(T, 12)); assert.equal(s.streak, 1);
  assert.equal(applyRating(newSrsState(), 2, T).interval, 1);
});
test('GOOD: 0->1->3->x ease', () => {
  let s = applyRating(newSrsState(), 3, T); assert.equal(s.interval, 1);
  s = applyRating(s, 3, T); assert.equal(s.interval, 3);
  s = applyRating(s, 3, T); assert.equal(s.interval, 8);
  assert.equal(s.ease, 2.5); assert.equal(s.streak, 3);
});
test('EASY: new->4, else x ease x1.3, ease +0.15', () => {
  let s = applyRating(newSrsState(), 4, T); assert.equal(s.interval, 4); assert.equal(s.ease, 2.65);
  s = applyRating({ ...newSrsState(), interval: 10, ease: 2.5 }, 4, T); assert.equal(s.interval, 33);
});
test('interval cap 180', () => { assert.equal(applyRating({ ...newSrsState(), interval: 150, ease: 2.5 }, 3, T).interval, 180); });
test('non-destructive', () => { const a = newSrsState(); applyRating(a, 3, T); assert.equal(a.interval, 0); });
test('status', () => {
  assert.equal(cardStatus(newSrsState()), '新規');
  assert.equal(cardStatus({ ...newSrsState(), reps: 1, interval: 5 }), '学習中');
  assert.equal(cardStatus({ ...newSrsState(), reps: 5, interval: 21 }), '定着');
});
test('isDue', () => {
  assert.ok(isDue(newSrsState(), T)); assert.ok(isDue({ due: T }, T)); assert.ok(isDue({ due: '2026-09-01' }, T)); assert.ok(!isDue({ due: '2026-09-26' }, T));
});
test('dueCards order and filter', () => {
  const cs = [
    { id: 'b', priority: 'B', due: '2026-09-20' },
    { id: 'a2', priority: 'A', due: '2026-09-24' },
    { id: 'a1', priority: 'A', due: '2026-09-20' },
    { id: 'x', priority: 'A', due: '2026-09-30' },
    { id: 'stop', priority: 'A', due: '2026-09-01', status: '停止' },
  ];
  assert.deepEqual(dueCards(cs, T).map(c => c.id), ['a1', 'a2', 'b']);
});
