import { el, toast, confirmDialog, todayIso, pct } from '../ui.js';
import { exportAll, importAll, validateBackup, getAll, put, clear, STORES } from '../db.js';
import { seedIfEmpty } from '../seed.js';
const SUB = [['cards', 'カード', () => import('./cards.js')], ['questions', '問題', () => import('./questions.js')], ['roadmap', 'ロードマップ', null], ['data', '設定・データ', null]];

export async function render(root, ctx) {
  const sub = location.hash.split('/')[2] || 'cards';
  const body = el('div');
  root.replaceChildren(el('div', { class: 'row subtabs' }, ...SUB.map(([k, l]) => el('a', { href: `#/manage/${k}`, class: k === sub ? 'active' : '' }, l))), body);
  const def = SUB.find(s => s[0] === sub) ?? SUB[0];
  if (def[2]) { const m = await def[2](); await m.render(body, ctx); } else if (sub === 'roadmap') await roadmap(body, ctx); else await data(body, ctx);
}
async function roadmap(body, ctx) {
  const rows = (await getAll(ctx.db, 'roadmap')).sort((a, b) => a.week - b.week);
  body.replaceChildren(el('div', { class: 'card' }, el('table', {}, el('tr', {}, ...['W', 'フェーズ', '論点', '優', '予定分', '目標', '完了条件'].map(h => el('th', {}, h))),
    ...rows.map(r => el('tr', {}, el('td', {}, r.week), el('td', {}, r.phase), el('td', {}, r.topic), el('td', {}, r.priority), el('td', {}, r.planMin), el('td', {}, pct(r.targetRate)), el('td', {}, r.doneCond))))));
}
async function data(body, ctx) {
  const s = ctx.settings;
  const f = (label, key, type = 'text') => { const inp = el('input', { type, value: s[key] ?? '' }); return { node: el('label', { class: 'field' }, label, inp), key, inp }; };
  const fields = [f('学習開始日', 'startDate', 'date'), f('目標受験日', 'examDate', 'date'), f('平日学習分', 'weekdayMin', 'number'), f('休日学習分', 'weekendMin', 'number'), f('合格基準点', 'passScore', 'number'), f('安全圏基準点', 'safeScore', 'number')];
  const saveBtn = el('button', { class: 'primary', onclick: async () => { const o = { ...s }; for (const x of fields) o[x.key] = x.inp.type === 'number' ? Number(x.inp.value) : x.inp.value; if (!o.startDate || !o.examDate) return toast('開始日と受験日は必須'); await put(ctx.db, 'settings', o); await ctx.refreshSettings(); toast('設定を保存'); } }, '設定を保存');
  const exp = el('button', { class: 'block', onclick: () => download(ctx) }, 'エクスポート（JSONダウンロード）');
  const file = el('input', { type: 'file', accept: 'application/json' });
  const mode = el('select', {}, el('option', { value: 'merge' }, 'マージ（新しい方優先）'), el('option', { value: 'overwrite' }, '上書き（全置換）'));
  const imp = el('button', { class: 'block', onclick: async () => {
    if (!file.files[0]) return toast('ファイルを選んでください');
    let data; try { data = JSON.parse(await file.files[0].text()); } catch { return toast('JSONの読み取りに失敗'); }
    const v = validateBackup(data); if (!v.ok) return toast(`取込拒否: ${v.error}`, 4000);
    if (!(await confirmDialog(`${mode.value === 'overwrite' ? '上書き' : 'マージ'}で取り込みます。実行前に現在のデータを自動保存（ダウンロード）します。よろしいですか？`))) return;
    await download(ctx); await importAll(ctx.db, data, mode.value); await ctx.refreshSettings(); toast('取込完了'); ctx.navigate('#/home');
  } }, 'インポート');
  const reseed = el('button', { onclick: async () => {
    if (!(await confirmDialog('カードを初期データで再読込します（記録・問題・設定は残ります。カードの復習状態はリセット）。よろしいですか？'))) return;
    const seed = await (await fetch('data/seed.json')).json(); await clear(ctx.db, 'cards'); await seedIfEmpty(ctx.db, { cards: seed.cards }); toast('カードを再読込');
  } }, 'カード初期データ再読込');
  const counts = el('p', { class: 'muted small' });
  (async () => { const parts = []; for (const st of STORES) parts.push(`${st}:${(await getAll(ctx.db, st)).length}`); counts.textContent = parts.join('　'); })();
  body.replaceChildren(el('div', { class: 'card' }, el('h3', {}, '設定'), ...fields.map(x => x.node), saveBtn),
    el('div', { class: 'card' }, el('h3', {}, 'データ同期'), el('p', { class: 'muted small' }, '使い終わった端末でエクスポート → もう一方の端末でインポート。'), exp, el('div', { class: 'row' }, file, mode), imp, counts),
    el('div', { class: 'card' }, el('h3', {}, 'メンテナンス'), reseed));
}
async function download(ctx) {
  const dump = await exportAll(ctx.db); const blob = new Blob([JSON.stringify(dump)], { type: 'application/json' });
  const hhmm = new Date().toTimeString().slice(0, 5).replace(':', '');
  const a = el('a', { href: URL.createObjectURL(blob), download: `boki-backup-${todayIso().replace(/-/g, '')}-${hhmm}.json` }); document.body.append(a); a.click(); a.remove();
}
