import { el, toast, todayIso, pct } from '../ui.js';
import { getAll, put } from '../db.js';
import { dueCards, applyRating, RATING_LABEL, RATING_HINT, cardStatus } from '../srs.js';
import { summarizeReview, saveDailyLog } from '../session.js';

export async function render(root, ctx) {
  const today = todayIso();
  const all = await getAll(ctx.db, 'cards');
  const queue = dueCards(all, today);
  if (queue.length === 0) {
    const extra = all.filter(c => c.status !== '停止').sort((a, b) => String(a.due).localeCompare(String(b.due))).slice(0, 20);
    root.replaceChildren(el('div', { class: 'card' }, el('h2', {}, '復習'), el('p', { class: 'ok' }, '今日の期限カードはありません。'),
      extra.length ? el('button', { onclick: () => start(root, ctx, extra, today) }, `期限前でも${extra.length}枚復習する`) : null));
    return;
  }
  root.replaceChildren(el('div', { class: 'card' }, el('h2', {}, '復習'), el('p', {}, `期限カード ${queue.length} 枚`), el('button', { class: 'primary', onclick: () => start(root, ctx, queue, today) }, '復習開始')));
}

function start(root, ctx, queue, today) {
  const startAt = Date.now(); const pending = [...queue]; const firstRating = new Map(); const total = queue.length; let cardStart = Date.now();
  const next = () => {
    if (pending.length === 0) return finish();
    const c = pending[0]; cardStart = Date.now();
    const back = el('div', { hidden: true },
      el('p', { class: 'answer' }, c.back), c.example ? el('p', { class: 'muted' }, '例: ', c.example) : null, c.pitfall ? el('p', { class: 'ng' }, '注意: ', c.pitfall) : null,
      el('div', { class: 'row rating' }, ...[1, 2, 3, 4].map(r => el('button', { class: `rate r${r}`, onclick: () => rate(c, r) }, RATING_LABEL[r]))),
      el('p', { class: 'muted small' }, RATING_HINT));
    root.replaceChildren(el('div', { class: 'card' },
      el('p', { class: 'muted' }, `${firstRating.size + 1} / ${total}　${c.field}・${c.topic}・${c.priority}　${cardStatus(c)}`),
      el('h3', {}, c.front),
      el('button', { class: 'primary block', onclick: e => { back.hidden = false; e.target.hidden = true; } }, '答えを見る'), back));
  };
  const rate = async (c, r) => {
    const s = applyRating(c, r, today);
    const updated = { ...c, ...s, status: c.status === '停止' ? c.status : cardStatus(s) };
    await put(ctx.db, 'cards', updated);
    await put(ctx.db, 'reviewLogs', { id: `RL-${Date.now()}-${c.id}`, cardId: c.id, at: new Date().toISOString(), rating: r, prevInterval: c.interval, newInterval: s.interval, elapsedSec: Math.round((Date.now() - cardStart) / 1000) });
    pending.shift();
    if (!firstRating.has(c.id)) firstRating.set(c.id, r);
    if (r === 1) pending.push(updated);
    next();
  };
  const finish = async () => {
    const results = [...firstRating].map(([cardId, fr]) => ({ cardId, finalRating: fr }));
    const sum = summarizeReview(results, (Date.now() - startAt) / 1000);
    const row = await saveDailyLog(ctx.db, ctx.settings, { date: today, code: 'CARD', sessionType: '単語帳', field: queue[0]?.field, topic: 'カード復習', priority: 'A', content: `カード復習 ${sum.q}枚`, ...sum, cause: sum.wrong ? '知識不足' : '' });
    toast(`日次記録 ${row.id} を保存`);
    root.replaceChildren(el('div', { class: 'card' }, el('h2', {}, '復習完了'),
      el('p', {}, `${sum.q}枚　できた ${sum.correct}　できなかった ${sum.wrong}　正答率 ${pct(row.rate)}　${sum.actualMin}分`),
      el('a', { href: '#/home' }, el('button', { class: 'primary' }, 'ホームへ'))));
  };
  next();
}
