import { el, option } from '../ui.js';
export function journalForm(accounts, initial = { debit: [], credit: [] }) {
  const line = (init = {}) => {
    const acct = el('select', {}, el('option', { value: '' }, '科目'), ...option(accounts, init.acct));
    const amt = el('input', { type: 'text', inputmode: 'numeric', placeholder: '金額', value: init.amt ?? '' });
    return { node: el('div', { class: 'row jline' }, acct, amt), get: () => ({ acct: acct.value, amt: amt.value }) };
  };
  const d = [line(initial.debit[0]), line(initial.debit[1])], c = [line(initial.credit[0]), line(initial.credit[1])];
  return { node: el('div', {}, el('h4', {}, '借方'), ...d.map(l => l.node), el('h4', {}, '貸方'), ...c.map(l => l.node)), value: () => ({ debit: d.map(l => l.get()), credit: c.map(l => l.get()) }) };
}
