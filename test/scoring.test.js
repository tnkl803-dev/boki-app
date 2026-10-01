import { test, assert } from './runner.js';
import { CAUSES, normalizeNumber, gradeJournal, gradeExact, gradeNumeric, accuracy, weekOf, nextDailyLogId, nextCardId, nextQuestionId, overSec } from '../js/scoring.js';
import { summarizeReview } from '../js/session.js';

test('CAUSES has 7', () => assert.equal(CAUSES.length, 7));
test('normalizeNumber', () => {
  assert.equal(normalizeNumber('1,200'), 1200); assert.equal(normalizeNumber('１２３４'), 1234);
  assert.equal(normalizeNumber(' 50 '), 50); assert.equal(normalizeNumber(''), null); assert.equal(normalizeNumber('abc'), null);
});
const ans = { debit: [{ acct: '仕入', amt: 50000 }], credit: [{ acct: '現金', amt: 50000 }] };
test('journal correct (order/blank rows ignored)', () => {
  const my = { debit: [{ acct: '仕入', amt: '50,000' }, { acct: '', amt: '' }], credit: [{ acct: '現金', amt: '50000' }] };
  assert.deepEqual(gradeJournal(ans, my), { correct: true, kind: '正解' });
});
test('journal unbalanced', () => { assert.equal(gradeJournal(ans, { debit: [{ acct: '仕入', amt: 50000 }], credit: [{ acct: '現金', amt: 40000 }] }).kind, '貸借不一致'); });
test('journal amount miss', () => { assert.equal(gradeJournal(ans, { debit: [{ acct: '仕入', amt: 40000 }], credit: [{ acct: '現金', amt: 40000 }] }).kind, '金額ミス'); });
test('journal account miss', () => { assert.equal(gradeJournal(ans, { debit: [{ acct: '買掛金', amt: 50000 }], credit: [{ acct: '現金', amt: 50000 }] }).kind, '科目ミス'); });
test('journal empty', () => { assert.equal(gradeJournal(ans, { debit: [], credit: [] }).kind, '未入力'); });
test('multi-line journal', () => {
  const a = { debit: [{ acct: '現金', amt: 30000 }, { acct: '売掛金', amt: 70000 }], credit: [{ acct: '売上', amt: 100000 }] };
  const m = { debit: [{ acct: '売掛金', amt: '70000' }, { acct: '現金', amt: '30000' }], credit: [{ acct: '売上', amt: '100000' }] };
  assert.ok(gradeJournal(a, m).correct);
});
test('gradeExact', () => { assert.ok(gradeExact('売掛金', ' 売掛金　')); assert.ok(!gradeExact('売掛金', '未収入金')); });
test('gradeNumeric', () => { assert.ok(gradeNumeric(1200, '1,200')); assert.ok(!gradeNumeric(1200, '1300')); assert.ok(!gradeNumeric(1200, '')); });
test('accuracy', () => { assert.equal(accuracy(18, 2), 0.9); assert.equal(accuracy(0, 0), null); assert.equal(accuracy(0, 20), 0); assert.equal(accuracy(null, null), null); });
test('weekOf', () => {
  assert.equal(weekOf('2026-09-18', '2026-09-18'), 1); assert.equal(weekOf('2026-09-24', '2026-09-18'), 1);
  assert.equal(weekOf('2026-09-25', '2026-09-18'), 2); assert.equal(weekOf('2027-03-06', '2026-09-18'), 25);
});
test('nextDailyLogId', () => {
  assert.equal(nextDailyLogId('2026-09-25', 'ANKI', []), 'DL-20260925-ANKI01');
  assert.equal(nextDailyLogId('2026-09-25', 'ANKI', ['DL-20260925-ANKI01', 'DL-20260925-QUIZ01', 'DL-20260924-ANKI01']), 'DL-20260925-ANKI02');
  assert.equal(nextDailyLogId('2026-09-25', 'ANKI', ['DL-20260925-ANKI201', 'DL-20260925-ANKI01']), 'DL-20260925-ANKI02');
});
test('nextDailyLogId reuses max suffix, not count, after a delete', () => {
  // only ANKI02 remains (ANKI01 was deleted) -> next must be 03, not 02 (which would overwrite ANKI02)
  assert.equal(nextDailyLogId('2026-09-25', 'ANKI', ['DL-20260925-ANKI02']), 'DL-20260925-ANKI03');
});
test('nextCardId reuses max suffix after a delete', () => {
  assert.equal(nextCardId(1, []), 'FC-W01-0001');
  assert.equal(nextCardId(1, ['FC-W01-0001', 'FC-W01-0002']), 'FC-W01-0003');
  // FC-W01-0001 was deleted, only 0002 remains -> next must be 0003, not 0002
  assert.equal(nextCardId(1, ['FC-W01-0002']), 'FC-W01-0003');
  assert.equal(nextCardId(10, ['FC-W01-0005']), 'FC-W10-0001');
});
test('nextQuestionId reuses max suffix after a delete', () => {
  assert.equal(nextQuestionId([]), 'Q-0001');
  assert.equal(nextQuestionId(['Q-0001', 'Q-0002']), 'Q-0003');
  // Q-0001 was deleted, only 0002 remains -> next must be 0003, not 0002
  assert.equal(nextQuestionId(['Q-0002']), 'Q-0003');
});
test('overSec', () => { assert.equal(overSec(70, 60), 10); assert.equal(overSec(50, 60), 0); assert.equal(overSec(50, null), 0); assert.equal(overSec(10, 0), 10); });
test('summarizeReview', () => {
  const r = summarizeReview([{ cardId: 'a', finalRating: 1 }, { cardId: 'b', finalRating: 3 }, { cardId: 'c', finalRating: 4 }], 605);
  assert.deepEqual(r, { q: 3, correct: 2, wrong: 1, actualMin: 10 });
});
