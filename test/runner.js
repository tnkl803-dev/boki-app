const tests = [];
export function test(name, fn) { tests.push({ name, fn }); }
function fail(msg) { throw new Error(msg); }
export const assert = {
  ok(v, msg = 'expected truthy') { if (!v) fail(msg); },
  equal(a, b, msg = '') { if (a !== b) fail(`${msg} expected ${JSON.stringify(b)} got ${JSON.stringify(a)}`); },
  deepEqual(a, b, msg = '') {
    const ja = JSON.stringify(a), jb = JSON.stringify(b);
    if (ja !== jb) fail(`${msg} expected ${jb} got ${ja}`);
  },
  async throws(fn, msg = 'expected throw') {
    try { await fn(); } catch { return; }
    fail(msg);
  },
};
export async function run() {
  const out = document.getElementById('out');
  let pass = 0, failCount = 0;
  for (const t of tests) {
    const li = document.createElement('li');
    try { await t.fn(); li.className = 'pass'; li.textContent = `✔ ${t.name}`; pass++; }
    catch (e) { li.className = 'fail'; li.textContent = `✘ ${t.name}: ${e.message}`; failCount++; }
    out.appendChild(li);
  }
  document.getElementById('summary').textContent = `pass ${pass} / fail ${failCount}`;
  document.title = failCount ? `FAIL ${failCount}` : 'ALL PASS';
}
