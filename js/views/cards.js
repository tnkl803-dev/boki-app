import { el, toast, todayIso, option, confirmDialog } from '../ui.js';
import { getAll, put, del } from '../db.js';
import { newSrsState, cardStatus } from '../srs.js';
import { weekOf, nextCardId } from '../scoring.js';
const FIELDS = ['3級基礎', '商業簿記', '工業簿記'];
export async function render(root, ctx) {
  const cards = (await getAll(ctx.db, 'cards')).sort((a, b) => a.id.localeCompare(b.id));
  const filter = el('input', { placeholder: '検索（表面・論点）' });
  const list = el('div');
  const draw = () => { const k = filter.value.trim(); list.replaceChildren(...cards.filter(c => !k || (c.front + c.topic).includes(k)).map(c => el('div', { class: 'card compact', onclick: () => form(root, ctx, c) }, el('div', { class: 'muted small' }, `${c.id}　${c.field}・${c.topic}・${c.priority}　${c.status}　次回 ${c.due ?? '-'}`), el('div', {}, c.front)))); };
  filter.oninput = draw; draw();
  root.replaceChildren(el('div', { class: 'row' }, filter, el('button', { class: 'primary', onclick: () => form(root, ctx, null) }, '＋カード追加')), el('p', { class: 'muted small' }, `${cards.length}枚`), list);
}
async function nextId(ctx, week) { const ids = (await getAll(ctx.db, 'cards')).map(c => c.id); return nextCardId(week, ids); }
function form(root, ctx, c) {
  const isNew = !c;
  c = c ?? { field: '商業簿記', topic: '', priority: 'A', type: '処理ルール', front: '', back: '', example: '', pitfall: '', tags: '', status: '新規', ...newSrsState(), due: todayIso(), createdAt: todayIso() };
  const t = (label, key, multi = false) => { const inp = multi ? el('textarea', { rows: 2 }, c[key] ?? '') : el('input', { value: c[key] ?? '' }); return { node: el('label', { class: 'field' }, label, inp), key, inp }; };
  const s = (label, key, list) => { const inp = el('select', {}, ...option(list, c[key])); return { node: el('label', { class: 'field' }, label, inp), key, inp }; };
  const fs = [s('分野', 'field', FIELDS), t('論点', 'topic'), s('優先度', 'priority', ['A', 'B', 'C']), t('カード種類', 'type'), t('表面（問い）', 'front', true), t('裏面（答え）', 'back', true), t('具体例', 'example', true), t('間違えやすい点', 'pitfall', true), t('タグ', 'tags'), s('状態', 'status', ['新規', '学習中', '定着', '停止'])];
  const save = async () => {
    const o = { ...c }; for (const x of fs) o[x.key] = x.inp.value.trim();
    if (!o.front || !o.back) return toast('表面と裏面は必須');
    if (isNew) o.id = await nextId(ctx, Math.max(1, weekOf(todayIso(), ctx.settings.startDate)));
    await put(ctx.db, 'cards', o); toast(isNew ? `${o.id} を追加` : '保存'); render(root, ctx);
  };
  const remove = isNew ? null : el('button', { onclick: async () => { if (await confirmDialog(`${c.id} を削除しますか？（復習履歴は残ります）`)) { await del(ctx.db, 'cards', c.id); render(root, ctx); } } }, '削除');
  root.replaceChildren(el('div', { class: 'card' }, el('h3', {}, isNew ? 'カード追加' : `${c.id}（${cardStatus(c)}）`), ...fs.map(x => x.node), el('div', { class: 'row' }, el('button', { class: 'primary', onclick: save }, '保存'), el('button', { onclick: () => render(root, ctx) }, '戻る'), remove)));
}
