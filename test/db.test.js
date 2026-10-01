import { test, assert } from './runner.js';
import { STORES, openDb, put, get, getAll, putAll, del, clear, count, exportAll, validateBackup, importAll, deleteDb } from '../js/db.js';
import { seedIfEmpty } from '../js/seed.js';
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
test('seedIfEmpty loads once', async () => {
  const db = await fresh();
  const seed = await (await fetch('../data/seed.json')).json();
  assert.ok(await seedIfEmpty(db, seed)); assert.equal(await count(db, 'cards'), 20); assert.equal(await count(db, 'roadmap'), 24); assert.equal(await count(db, 'questions'), 16);
  assert.equal((await get(db, 'settings', 'main')).startDate, '2026-09-18');
  assert.ok(!(await seedIfEmpty(db, seed))); db.close();
});
test('seedIfEmpty stamps epoch updatedAt so a PC backup always wins on merge', async () => {
  const db = await fresh();
  const seed = await (await fetch('../data/seed.json')).json();
  await seedIfEmpty(db, seed);
  const seeded = (await getAll(db, 'cards'))[0];
  assert.equal(seeded.updatedAt, '1970-01-01T00:00:00.000Z');
  const dump = { version: 1, exportedAt: 'x', stores: Object.fromEntries(STORES.map(s => [s, []])) };
  dump.stores.cards = [{ ...seeded, front: 'from-pc-backup', updatedAt: '2026-09-20T00:00:00Z' }];
  await importAll(db, dump, 'merge');
  assert.equal((await get(db, 'cards', seeded.id)).front, 'from-pc-backup'); db.close();
});
test('put stamps createdAt once on create and preserves it on update', async () => {
  const db = await fresh();
  const r1 = await put(db, 'cards', { id: 'FC-1', front: 'a' });
  assert.ok(r1.createdAt);
  const r2 = await put(db, 'cards', { ...r1, front: 'b' });
  assert.equal(r2.createdAt, r1.createdAt); db.close();
});
test('import merge: same id but different createdAt is a different record -> incoming gets a fresh card id', async () => {
  const db = await fresh();
  await put(db, 'cards', { id: 'FC-W01-0001', front: 'local', createdAt: '2026-09-20T00:00:00.000Z' }, { keepUpdatedAt: true });
  const dump = { version: 1, exportedAt: 'x', stores: Object.fromEntries(STORES.map(s => [s, []])) };
  dump.stores.cards = [{ id: 'FC-W01-0001', front: 'remote-different-card', createdAt: '2026-09-21T00:00:00.000Z', updatedAt: '2026-09-21T00:00:00.000Z' }];
  await importAll(db, dump, 'merge');
  const all = await getAll(db, 'cards');
  assert.equal(all.length, 2);
  assert.ok(all.find(c => c.id === 'FC-W01-0001' && c.front === 'local'));
  assert.ok(all.find(c => c.id === 'FC-W01-0002' && c.front === 'remote-different-card')); db.close();
});
test('import merge: same id and same createdAt keeps newer-wins (no reassignment)', async () => {
  const db = await fresh();
  await put(db, 'cards', { id: 'FC-W01-0001', front: 'local-new', createdAt: '2026-09-20T00:00:00.000Z', updatedAt: '2026-09-25T00:00:00.000Z' }, { keepUpdatedAt: true });
  const dump = { version: 1, exportedAt: 'x', stores: Object.fromEntries(STORES.map(s => [s, []])) };
  dump.stores.cards = [{ id: 'FC-W01-0001', front: 'remote-old', createdAt: '2026-09-20T00:00:00.000Z', updatedAt: '2026-09-20T00:00:00Z' }];
  await importAll(db, dump, 'merge');
  const all = await getAll(db, 'cards');
  assert.equal(all.length, 1); assert.equal(all[0].front, 'local-new'); db.close();
});
