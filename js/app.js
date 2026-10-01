import { openDb, get } from './db.js';
import { seedIfEmpty } from './seed.js';
import { el, toast } from './ui.js';
const VIEWS = {
  home: () => import('./views/dashboard.js'), review: () => import('./views/review.js'), quiz: () => import('./views/quiz.js'),
  log: () => import('./views/dailylog.js'), manage: () => import('./views/settings.js'),
};
const TABS = [['home', 'ホーム'], ['review', '復習'], ['quiz', '演習'], ['log', '記録'], ['manage', '管理']];
const ctx = { db: null, settings: null, navigate: h => (location.hash = h), refreshSettings: async () => (ctx.settings = await get(ctx.db, 'settings', 'main')) };

async function boot() {
  const root = document.getElementById('view');
  try { ctx.db = await openDb(); } catch (e) { root.replaceChildren(el('div', { class: 'card ng' }, 'このブラウザではデータ保存（IndexedDB）が使えません。プライベートモードを解除してください。')); return; }
  navigator.storage?.persist?.().catch(() => {});
  try { const seed = await (await fetch('data/seed.json')).json(); if (await seedIfEmpty(ctx.db, seed)) toast('初期データを読み込みました'); } catch (e) { console.error(e); }
  await ctx.refreshSettings();
  document.getElementById('tabs').replaceChildren(...TABS.map(([k, label]) => el('a', { href: `#/${k}`, 'data-tab': k }, label)));
  window.addEventListener('hashchange', route); route();
  window.addEventListener('unhandledrejection', e => toast(`保存に失敗: ${e.reason?.message ?? e.reason}`, 4000));
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(console.error);
}
async function route() {
  const key = (location.hash.replace(/^#\//, '') || 'home').split('/')[0];
  const loader = VIEWS[key] ?? VIEWS.home;
  document.querySelectorAll('#tabs a').forEach(a => a.classList.toggle('active', a.dataset.tab === key));
  const root = document.getElementById('view'); root.replaceChildren(el('p', { class: 'muted' }, '…'));
  try { const m = await loader(); await m.render(root, ctx); } catch (e) { console.error(e); root.replaceChildren(el('div', { class: 'card ng' }, `画面の表示に失敗: ${e.message}`)); }
}
boot();
