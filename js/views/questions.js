import { el, toast, option, confirmDialog } from '../ui.js';
import { getAll, put, del } from '../db.js';
import { normalizeNumber } from '../scoring.js';
import { journalForm } from './journalForm.js';
const FORMATS = ['仕訳', '科目判断', '計算', '選択', '記述'];
export async function render(root, ctx) {
  const qs = (await getAll(ctx.db, 'questions')).sort((a, b) => a.id.localeCompare(b.id));
  root.replaceChildren(el('div', { class: 'row' }, el('button', { class: 'primary', onclick: () => form(root, ctx, null) }, '＋問題追加')), el('p', { class: 'muted small' }, `${qs.length}問`),
    ...qs.map(q => el('div', { class: 'card compact', onclick: () => form(root, ctx, q) }, el('div', { class: 'muted small' }, `${q.id}　${q.format}　${q.field}・${q.topic}・${q.priority}　標準${q.stdSec ?? '-'}秒`), el('div', {}, q.text))));
}
async function form(root, ctx, q) {
  const isNew = !q;
  q = q ?? { setId: '', field: '商業簿記', topic: '', priority: 'A', difficulty: '基本', format: '仕訳', text: '', choices: [], answer: '', explain: '', stdSec: 60, tags: '' };
  const accounts = (await getAll(ctx.db, 'accounts')).map(a => a.name).sort();
  const t = (label, key, multi = false, type = 'text') => { const inp = multi ? el('textarea', { rows: 2 }, q[key] ?? '') : el('input', { type, value: q[key] ?? '' }); return { node: el('label', { class: 'field' }, label, inp), key, inp }; };
  const s = (label, key, list) => { const inp = el('select', {}, ...option(list, q[key])); return { node: el('label', { class: 'field' }, label, inp), key, inp }; };
  const fmt = s('形式', 'format', FORMATS);
  const fs = [fmt, s('分野', 'field', ['3級基礎', '商業簿記', '工業簿記']), t('論点', 'topic'), s('優先度', 'priority', ['A', 'B', 'C']), t('問題セットID', 'setId'), t('問題文', 'text', true), t('解説', 'explain', true), t('標準解答秒', 'stdSec', false, 'number'), t('タグ', 'tags')];
  const ansBox = el('div'); let jf = null;
  const ansInp = el('input', { value: (typeof q.answer === 'string' || typeof q.answer === 'number') ? q.answer : '' });
  const choicesInp = el('input', { value: (q.choices ?? []).join(','), placeholder: '選択肢をカンマ区切り' });
  const drawAns = () => {
    if (fmt.inp.value === '仕訳') { jf = journalForm(accounts, (q.answer && typeof q.answer === 'object') ? q.answer : undefined); ansBox.replaceChildren(jf.node); }
    else { jf = null; ansBox.replaceChildren(el('label', { class: 'field' }, '正解', ansInp), (fmt.inp.value === '科目判断' || fmt.inp.value === '選択') ? el('label', { class: 'field' }, '選択肢', choicesInp) : null); }
  };
  fmt.inp.onchange = drawAns; drawAns();
  const save = async () => {
    const o = { ...q }; for (const x of fs) o[x.key] = x.inp.type === 'number' ? Number(x.inp.value) : x.inp.value.trim();
    if (!o.text) return toast('問題文は必須');
    if (jf) {
      const v = jf.value(); const conv = rs => rs.filter(r => r.acct).map(r => ({ acct: r.acct, amt: normalizeNumber(r.amt) }));
      o.answer = { debit: conv(v.debit), credit: conv(v.credit) }; o.choices = [];
      if (!o.answer.debit.length || !o.answer.credit.length || [...o.answer.debit, ...o.answer.credit].some(r => r.amt === null)) return toast('借方・貸方の科目と金額を入力');
    } else {
      o.answer = o.format === '計算' ? normalizeNumber(ansInp.value) : ansInp.value.trim();
      o.choices = choicesInp.value.split(/[,、]/).map(x => x.trim()).filter(Boolean);
      if (o.answer === '' || o.answer === null) return toast('正解は必須');
      if ((o.format === '科目判断' || o.format === '選択') && !o.choices.includes(o.answer)) return toast('正解が選択肢に含まれていません');
    }
    if (isNew) { const ids = (await getAll(ctx.db, 'questions')).map(x => Number(x.id.slice(2)) || 0); o.id = `Q-${String(Math.max(0, ...ids) + 1).padStart(4, '0')}`; }
    await put(ctx.db, 'questions', o); toast(isNew ? `${o.id} を追加` : '保存'); render(root, ctx);
  };
  const remove = isNew ? null : el('button', { onclick: async () => { if (await confirmDialog(`${q.id} を削除しますか？`)) { await del(ctx.db, 'questions', q.id); render(root, ctx); } } }, '削除');
  root.replaceChildren(el('div', { class: 'card' }, el('h3', {}, isNew ? '問題追加' : q.id), ...fs.map(x => x.node), ansBox, el('div', { class: 'row' }, el('button', { class: 'primary', onclick: save }, '保存'), el('button', { onclick: () => render(root, ctx) }, '戻る'), remove)));
}
