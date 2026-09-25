import { test, assert } from './runner.js';
import { STORES, openDb, put, get, getAll, putAll, del, clear, count, exportAll, validateBackup, importAll, deleteDb } from '../js/db.js';
const NAME = 'boki-test';
export async function fresh() { await deleteDb(NAME); return openDb(NAME); }

test('stores created', async () => { const db = await fresh(); for (const s of STORES) assert.ok(db.objectStoreNames.contains(s), s); db.close(); });
test('put/get/getAll/del/count with updatedAt', async () => {
  const db = await fresh();
  await put(db, 'cards', { id: 'FC-1', front: 'a' });
  const c = await get(db, 'cards', 'FC-1'); assert.equal(c.front, 'a'); assert.ok(c.updatedAt);
  await putAll(db, 'cards', [{ id: 'FC-2' }, { id: 'FC-3' }]);
  assert.equal((await getAll(db, 'cards')).length, 3); assert.equal(await count(db, 'cards'), 3);
  await del(db, 'cards', 'FC-2'); assert.equal(await count(db, 'cards'), 2);
  await clear(db, 'cards'); assert.equal(await count(db, 'cards'), 0); db.close();
});
test('accounts keyed by name', async () => { const db = await fresh(); await put(db, 'accounts', { name: '現金', category: '資産' }); assert.equal((await get(db, 'accounts', '現金')).category, '資産'); db.close(); });
test('validateBackup', () => {
  assert.ok(!validateBackup(null).ok); assert.ok(!validateBackup({ version: 2, stores: {} }).ok);
  assert.ok(!validateBackup({ version: 1, stores: { cards: [] } }).ok);
  const full = { version: 1, exportedAt: 'x', stores: Object.fromEntries(STORES.map(s => [s, []])) };
  assert.ok(validateBackup(full).ok);
});
test('export -> import roundtrip (overwrite)', async () => {
  const db = await fresh();
  await put(db, 'cards', { id: 'FC-1', front: 'a' }); await put(db, 'settings', { id: 'main', examDate: '2027-03-06' });
  const dump = await exportAll(db);
  assert.equal(dump.version, 1); assert.equal(dump.stores.cards.length, 1);
  await clear(db, 'cards'); await put(db, 'cards', { id: 'FC-9' });
  await importAll(db, dump, 'overwrite');
  assert.deepEqual((await getAll(db, 'cards')).map(c => c.id), ['FC-1']); db.close();
});
test('import merge keeps newer updatedAt', async () => {
  const db = await fresh();
  await put(db, 'cards', { id: 'FC-1', front: 'local-new', updatedAt: '2026-09-25T10:00:00Z' }, { keepUpdatedAt: true });
  const dump = { version: 1, exportedAt: 'x', stores: Object.fromEntries(STORES.map(s => [s, []])) };
  dump.stores.cards = [{ id: 'FC-1', front: 'remote-old', updatedAt: '2026-09-20T00:00:00Z' }, { id: 'FC-2', front: 'remote', updatedAt: '2026-09-20T00:00:00Z' }];
  await importAll(db, dump, 'merge');
  assert.equal((await get(db, 'cards', 'FC-1')).front, 'local-new'); assert.equal((await get(db, 'cards', 'FC-2')).front, 'remote'); db.close();
});
