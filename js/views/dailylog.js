import { el, toast, todayIso, pct, option, confirmDialog, fmtDate, WEEKDAYS } from '../ui.js';
import { getAll, put, del } from '../db.js';
import { CAUSES, accuracy, weekOf } from '../scoring.js';
import { saveDailyLog } from '../session.js';
const TYPES = ['単語帳', '問題演習', '平日夜', '休日', '通勤', '模試', 'その他'];
const CODE = { 単語帳: 'CARD', 問題演習: 'QUIZ', 平日夜: 'NIGHT', 休日: 'WEEKEND', 通勤: 'COMMUTE', 模試: 'MOCK', その他: 'OTHER' };

export async function render(root, ctx) {
  const logs = (await getAll(ctx.db, 'dailyLogs')).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const byWeek = new Map();
  for (const l of logs) { const w = l.week ?? weekOf(l.date, ctx.settings.startDate); if (!byWeek.has(w)) byWeek.set(w, []); byWeek.get(w).push(l); }
  const weeks = [...byWeek.keys()].sort((a, b) => b - a);
  const sumOf = (ls, k) => ls.reduce((a, l) => a + (l[k] ?? 0), 0);
  const summary = el('table', {}, el('tr', {}, ...['Week', '日数', '実績分', '問題', '正答率'].map(h => el('th', {}, h))),
    ...weeks.map(w => { const ls = byWeek.get(w); return el('tr', {}, el('td', {}, `W${w}`), el('td', {}, new Set(ls.map(l => l.date)).size), el('td', {}, sumOf(ls, 'actualMin')), el('td', {}, sumOf(ls, 'q')), el('td', {}, pct(accuracy(sumOf(ls, 'correct'), sumOf(ls, 'wrong'))))); }));
  root.replaceChildren(el('div', { class: 'row' }, el('h2', {}, '記録'), el('button', { class: 'primary', onclick: () => form(root, ctx, null) }, '＋手動追加')), el('div', { class: 'card' }, summary),
    ...weeks.map(w => el('details', { open: w === weeks[0] ? true : null }, el('summary', {}, `Week ${w}（${byWeek.get(w).length}件）`),
      ...byWeek.get(w).map(l => el('div', { class: 'card compact', onclick: () => form(root, ctx, l) },
        el('div', { class: 'muted small' }, `${fmtDate(l.date)}(${WEEKDAYS[new Date(l.date + 'T00:00:00').getDay()]})　${l.sessionType}　${l.topic ?? ''}　${l.actualMin ?? '-'}分`),
        el('div', {}, l.content),
        el('div', { class: 'small' }, l.q != null ? `${l.q}問 正${l.correct ?? '-'} 誤${l.wrong ?? '-'} ${pct(l.rate)}` : '', l.cause ? `　原因: ${l.cause}` : ''))))));
}
function form(root, ctx, l) {
  const isNew = !l;
  l = l ?? { date: todayIso(), sessionType: '平日夜', field: '商業簿記', topic: '', priority: 'A', content: '', planMin: null, actualMin: null, q: null, correct: null, wrong: null, blank: null, understand: null, focus: null, confidence: null, cause: '', comment: '' };
  const num = (label, key) => { const inp = el('input', { type: 'number', value: l[key] ?? '' }); return { node: el('label', { class: 'field' }, label, inp), key, inp, num: true }; };
  const txt = (label, key, multi = false, type = 'text') => { const inp = multi ? el('textarea', { rows: 2 }, l[key] ?? '') : el('input', { type, value: l[key] ?? '' }); return { node: el('label', { class: 'field' }, label, inp), key, inp }; };
  const sel = (label, key, list) => { const inp = el('select', {}, ...option(list, l[key])); return { node: el('label', { class: 'field' }, label, inp), key, inp }; };
  const fs = [txt('日付', 'date', false, 'date'), sel('区分', 'sessionType', TYPES), sel('分野', 'field', ['3級基礎', '商業簿記', '工業簿記']), txt('論点', 'topic'), sel('優先度', 'priority', ['A', 'B', 'C']), txt('学習内容', 'content', true), num('予定分', 'planMin'), num('実績分', 'actualMin'), num('問題数', 'q'), num('正解', 'correct'), num('不正解', 'wrong'), num('未回答', 'blank'), num('理解度1-5', 'understand'), num('集中度1-5', 'focus'), num('自信度1-5', 'confidence'), sel('間違い主原因', 'cause', ['', ...CAUSES]), txt('コメント', 'comment', true)];
  const save = async () => {
    const o = { ...l }; for (const x of fs) o[x.key] = x.num ? (x.inp.value === '' ? null : Number(x.inp.value)) : x.inp.value.trim();
    if (!o.date || !o.content) return toast('日付と学習内容は必須');
    if (isNew) await saveDailyLog(ctx.db, ctx.settings, { ...o, code: CODE[o.sessionType] ?? 'OTHER' });
    else { o.week = weekOf(o.date, ctx.settings.startDate); o.rate = accuracy(o.correct, o.wrong); await put(ctx.db, 'dailyLogs', o); }
    toast('保存'); render(root, ctx);
  };
  const remove = isNew ? null : el('button', { onclick: async () => { if (await confirmDialog(`${l.id} を削除しますか？`)) { await del(ctx.db, 'dailyLogs', l.id); render(root, ctx); } } }, '削除');
  root.replaceChildren(el('div', { class: 'card' }, el('h3', {}, isNew ? '日次記録 追加' : l.id), ...fs.map(x => x.node), el('div', { class: 'row' }, el('button', { class: 'primary', onclick: save }, '保存'), el('button', { onclick: () => render(root, ctx) }, '戻る'), remove)));
}
