export const CAUSES = ['知識不足', '科目判断ミス', '読み違い', '計算ミス', '桁ミス', '時間切れ', '回答範囲不足'];

export function normalizeNumber(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/[,\s　円]/g, '');
  if (s === '' || !/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}
const clean = s => String(s ?? '').replace(/[\s　]/g, '');
function lines(side) {
  return (side ?? []).map(r => ({ acct: clean(r.acct), amt: normalizeNumber(r.amt) })).filter(r => r.acct || r.amt !== null);
}
const key = rs => rs.map(r => `${r.acct}:${r.amt}`).sort().join('|');
const accts = rs => rs.map(r => r.acct).sort().join('|');
const sum = rs => rs.reduce((a, r) => a + (r.amt ?? 0), 0);

export function gradeJournal(answer, my) {
  const ad = lines(answer.debit), ac = lines(answer.credit), md = lines(my.debit), mc = lines(my.credit);
  if (md.length === 0 && mc.length === 0) return { correct: false, kind: '未入力' };
  if (key(ad) === key(md) && key(ac) === key(mc)) return { correct: true, kind: '正解' };
  if (sum(md) !== sum(mc)) return { correct: false, kind: '貸借不一致' };
  if (accts(ad) === accts(md) && accts(ac) === accts(mc)) return { correct: false, kind: '金額ミス' };
  return { correct: false, kind: '科目ミス' };
}
export function gradeExact(answer, my) { return clean(answer) === clean(my); }
export function gradeNumeric(answer, my) { const m = normalizeNumber(my); return m !== null && m === normalizeNumber(answer); }
export function accuracy(correct, wrong) { const d = (correct ?? 0) + (wrong ?? 0); return d === 0 ? null : Math.round(((correct ?? 0) / d) * 1000) / 1000; }
export function weekOf(dateIso, startIso) {
  const ms = Date.parse(dateIso + 'T00:00:00Z') - Date.parse(startIso + 'T00:00:00Z');
  return Math.floor(ms / 86400000 / 7) + 1;
}
export function nextDailyLogId(dateIso, code, existingIds) {
  const prefix = `DL-${dateIso.replace(/-/g, '')}-${code}`;
  const re = new RegExp('^' + prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\d{2}$');
  const n = existingIds.filter(id => re.test(id)).length + 1;
  return `${prefix}${String(n).padStart(2, '0')}`;
}
export function overSec(sec, stdSec) { return stdSec == null ? 0 : Math.max(0, sec - stdSec); }
