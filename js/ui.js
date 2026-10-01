export function el(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined && v !== false) n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) n.append(c.nodeType ? c : String(c));
  return n;
}
export function toast(msg, ms = 2500) { const t = document.getElementById('toast'); t.textContent = msg; t.hidden = false; clearTimeout(t._h); t._h = setTimeout(() => (t.hidden = true), ms); }
export function todayIso() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
export function fmtDate(iso) { return iso ? iso.slice(5).replace('-', '/') : ''; }
export function confirmDialog(msg) { return Promise.resolve(window.confirm(msg)); }
export function pct(x) { return x === null || x === undefined ? 'データ不足' : `${Math.round(x * 100)}%`; }
export function option(list, selected) { return list.map(v => el('option', { value: v, selected: v === selected }, v)); }
export const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
