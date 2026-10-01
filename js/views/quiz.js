import { el, toast, todayIso, pct, option } from '../ui.js';
import { getAll, put } from '../db.js';
import { gradeJournal, gradeExact, gradeNumeric, overSec, CAUSES, weekOf } from '../scoring.js';
import { saveDailyLog } from '../session.js';
import { journalForm } from './journalForm.js';
const MODES = [['仕訳', '仕訳入力'], ['科目判断', '勘定科目判断'], ['計算', '計算問題'], ['選択', '選択問題'], ['記述', '記述（自己採点）']];
const shuffle = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(x => x[1]);

export async function render(root, ctx) {
  const qs = await getAll(ctx.db, 'questions');
  root.replaceChildren(el('div', { class: 'card' }, el('h2', {}, '演習'),
    ...MODES.map(([fmt, label]) => { const pool = qs.filter(q => q.format === fmt); return el('button', { class: 'primary block', disabled: pool.length === 0, onclick: () => start(root, ctx, shuffle(pool).slice(0, 10), fmt) }, `${label}（${pool.length}問）`); }),
    el('p', { class: 'muted small' }, '1回10問まで。問題は「管理」タブで追加できます。')));
}

async function start(root, ctx, list, fmt) {
  const accounts = (await getAll(ctx.db, 'accounts')).map(a => a.name).sort();
  const today = todayIso(), startAt = Date.now(); let i = 0, correct = 0, wrong = 0, unsure = 0, currentTick = null;
  const show = () => {
    if (currentTick) { clearInterval(currentTick); currentTick = null; }
    if (i >= list.length) return finish();
    const q = list[i]; const qStart = Date.now();
    const form = fmt === '仕訳' ? journalForm(accounts) : (fmt === '科目判断' || fmt === '選択') ? choiceForm(q.choices) : fmt === '計算' ? numForm() : textForm();
    const timer = el('span', { class: 'muted' }, `0秒 / 標準${q.stdSec ?? '-'}秒`);
    const tick = setInterval(() => { if (!timer.isConnected) { clearInterval(tick); return; } timer.textContent = `${Math.round((Date.now() - qStart) / 1000)}秒 / 標準${q.stdSec ?? '-'}秒`; }, 1000);
    currentTick = tick;
    const submit = el('button', { class: 'primary block', onclick: () => { const my = form.value(); if (fmt === '仕訳' && gradeJournal(q.answer, my).kind === '未入力') return toast('科目と金額を入力してください'); if (fmt !== '仕訳' && fmt !== '記述' && String(my).trim() === '') return toast('回答を入力してください'); clearInterval(tick); currentTick = null; grade(q, my, Math.round((Date.now() - qStart) / 1000)); } }, '回答する');
    root.replaceChildren(el('div', { class: 'card' }, el('p', { class: 'muted' }, `${i + 1} / ${list.length}　${q.field}・${q.topic}・${q.priority}　`, timer), el('h3', {}, q.text), form.node, submit));
  };
  const grade = (q, my, sec) => {
    let result;
    if (fmt === '仕訳') { const g = gradeJournal(q.answer, my); result = { correct: g.correct, kind: g.kind }; }
    else if (fmt === '計算') result = { correct: gradeNumeric(q.answer, my), kind: '' };
    else if (fmt === '記述') result = null;
    else result = { correct: gradeExact(q.answer, my), kind: '' };
    const causeSel = el('select', {}, el('option', { value: '' }, '間違い原因を選ぶ'), ...option(CAUSES));
    const selfSel = result ? null : el('select', {}, ...option(['正解', '不正解', '要確認']));
    const save = async () => {
      const c = result ? result.correct : selfSel.value === '正解' ? true : selfSel.value === '不正解' ? false : '要確認';
      if (c === true) correct++; else if (c === false) wrong++; else unsure++;
      await put(ctx.db, 'answerLogs', { id: `AL-${Date.now()}`, questionId: q.id, at: new Date().toISOString(), week: weekOf(today, ctx.settings.startDate), myAnswer: my, correct: c, score: c === true ? 1 : 0, maxScore: 1, sec, stdSec: q.stdSec ?? null, overSec: overSec(sec, q.stdSec), cause: c === true ? '' : causeSel.value, needReview: c !== true, nextReview: c !== true ? today : null });
      i++; show();
    };
    const over = overSec(sec, q.stdSec);
    root.replaceChildren(el('div', { class: 'card' }, el('h3', {}, q.text),
      result ? el('p', { class: result.correct ? 'ok' : 'ng' }, result.correct ? '正解' : `不正解${result.kind ? `（${result.kind}）` : ''}`) : el('p', {}, '自己採点: ', selfSel),
      el('p', {}, '正解: ', fmtAnswer(q)), el('p', { class: 'muted' }, q.explain),
      el('p', { class: 'muted small' }, `解答 ${sec}秒 / 標準 ${q.stdSec ?? '-'}秒${over ? `（${over}秒超過）` : ''}`),
      (!result || !result.correct) ? el('p', {}, causeSel) : null, el('button', { class: 'primary block', onclick: save }, '次へ')));
  };
  const finish = async () => {
    const actualMin = Math.round((Date.now() - startAt) / 60000);
    const row = await saveDailyLog(ctx.db, ctx.settings, { date: today, code: 'QUIZ', sessionType: '問題演習', field: list[0]?.field, topic: fmt, priority: 'A', content: `${fmt} ${list.length}問`, q: list.length, correct, wrong, blank: unsure, actualMin });
    toast(`日次記録 ${row.id} を保存`);
    root.replaceChildren(el('div', { class: 'card' }, el('h2', {}, '演習完了'), el('p', {}, `${list.length}問　正解 ${correct}　不正解 ${wrong}　要確認 ${unsure}　正答率 ${pct(row.rate)}　${actualMin}分`), el('a', { href: '#/quiz' }, el('button', { class: 'primary' }, '演習へ戻る'))));
  };
  show();
}
function fmtAnswer(q) {
  if (q.format !== '仕訳') return String(q.answer);
  const side = rs => rs.map(r => `${r.acct} ${Number(r.amt).toLocaleString()}`).join(' / ');
  return `借方: ${side(q.answer.debit)}　貸方: ${side(q.answer.credit)}`;
}
function choiceForm(choices) { let v = ''; const btns = choices.map(ch => el('button', { class: 'choice', onclick: e => { v = ch; btns.forEach(b => b.classList.remove('selected')); e.currentTarget.classList.add('selected'); } }, ch)); return { node: el('div', { class: 'row' }, ...btns), value: () => v }; }
function numForm() { const inp = el('input', { type: 'text', inputmode: 'numeric', placeholder: '数値' }); return { node: inp, value: () => inp.value }; }
function textForm() { const ta = el('textarea', { rows: 3, placeholder: '回答をメモ（採点は自己判定）' }); return { node: ta, value: () => ta.value }; }
