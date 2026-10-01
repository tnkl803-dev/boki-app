import { el, todayIso, pct } from '../ui.js';
import { getAll } from '../db.js';
import { dueCards } from '../srs.js';
import { weekOf, accuracy } from '../scoring.js';
const daysBetween = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);

export async function render(root, ctx) {
  const s = ctx.settings, today = todayIso();
  const week = weekOf(today, s.startDate);
  const [cards, logs, rm, ans] = await Promise.all(['cards', 'dailyLogs', 'roadmap', 'answerLogs'].map(st => getAll(ctx.db, st)));
  const due = dueCards(cards, today).length;
  const overdue = cards.filter(c => c.status !== '停止' && c.due && c.due < today).length;
  const wk = logs.filter(l => l.week === week);
  const planWeek = rm.find(r => r.week === week);
  const sumOf = (ls, k) => ls.reduce((a, l) => a + (l[k] ?? 0), 0);
  const recent = ans.filter(a => a.correct !== '要確認').sort((a, b) => a.at.localeCompare(b.at)).slice(-50);
  const recentRate = accuracy(recent.filter(a => a.correct === true).length, recent.filter(a => a.correct === false).length);
  const tile = (label, value, cls = '') => el('div', { class: `tile ${cls}` }, el('div', { class: 'muted small' }, label), el('div', { class: 'big' }, value));
  root.replaceChildren(
    el('h2', {}, `Week ${week}　受験まで ${daysBetween(today, s.examDate)} 日`),
    el('div', { class: 'tiles' },
      tile('今日の期限カード', `${due}枚`, due ? 'warn' : ''), tile('期限超過', `${overdue}枚`, overdue ? 'ng' : ''),
      tile('今週の学習', `${sumOf(wk, 'actualMin')} / ${planWeek?.planMin ?? '-'}分`), tile('今週の正答率', pct(accuracy(sumOf(wk, 'correct'), sumOf(wk, 'wrong')))),
      tile('直近50問 正答率', pct(recentRate)), tile('累計学習', `${Math.round(sumOf(logs, 'actualMin') / 6) / 10}時間`)),
    el('div', { class: 'row' }, el('a', { href: '#/review', class: 'grow' }, el('button', { class: 'primary block' }, `復習開始（${due}枚）`)), el('a', { href: '#/quiz', class: 'grow' }, el('button', { class: 'block' }, '演習開始'))),
    planWeek ? el('div', { class: 'card' }, el('h3', {}, `今週のロードマップ：${planWeek.topic}`),
      el('p', {}, `優先度 ${planWeek.priority}　目標正答率 ${pct(planWeek.targetRate)}　予定 ${planWeek.planQ}問`),
      el('ul', {}, el('li', {}, '通勤: ', planWeek.commuteTask), el('li', {}, '夜: ', planWeek.nightTask), el('li', {}, '休日: ', planWeek.weekendTask)),
      el('p', { class: 'muted small' }, '完了条件: ', planWeek.doneCond)) : el('p', { class: 'muted' }, 'ロードマップ範囲外の Week です'));
}
