'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { commitPaidStock } = require('./payment-stock');

function fixture(stock = 10) {
  const writes = [];
  const records = new Map([['products/p', { sku: 'A', stock }], ['inventory/A', { quantity: stock, reserved: 0 }]]);
  let counter = 0, writing = false;
  const ref = key => ({ key });
  const db = { collection: name => ({ doc: id => ref(`${name}/${id || ++counter}`),
    where: (_, op, value) => ({ limit: () => ({ query: value }) }) }) };
  const tx = { get: async target => {
    assert.equal(writing, false, 'No reads after writes');
    if (target.query) return { docs: [...records].filter(([key, data]) => key.startsWith('products/') && data.sku === target.query)
      .map(([key, data]) => ({ id: key.split('/')[1], ref: ref(key), data: () => ({ ...data }) })) };
    return { exists: records.has(target.key), data: () => ({ ...records.get(target.key) }) };
  }, update: (target, data) => { writing = true; writes.push([target.key, data]); records.set(target.key, { ...records.get(target.key), ...data }); },
  set: (target, data) => { writing = true; writes.push([target.key, data]); records.set(target.key, { ...records.get(target.key), ...data }); } };
  return { db, tx, records, writes };
}
test('approval aggregates duplicate SKUs, synchronizes both stocks and records one sale', async () => {
  const f = fixture();
  const result = await commitPaidStock(f.db, f.tx, { orderNumber: 'ORDER', items: [{ sku: 'A', quantity: 2 }, { sku: 'A', quantity: 1 }] });
  assert.equal(result.stockCommitted, true);
  assert.equal(f.records.get('products/p').stock, 7);
  assert.equal(f.records.get('inventory/A').available, 7);
  assert.equal(f.writes.filter(([key]) => key.startsWith('inventoryMovements/')).length, 1);
});
test('duplicate approval and test purchases never deduct again', async () => {
  for (const options of [{ stockCommitted: true }, { testMode: true }]) {
    const f = fixture();
    await commitPaidStock(f.db, f.tx, { ...options, items: [{ sku: 'A', quantity: 2 }] }, options);
    assert.equal(f.writes.length, 0);
  }
});
test('insufficient stock flags a paid order for review without negative stock or partial writes', async () => {
  const f = fixture(1);
  const result = await commitPaidStock(f.db, f.tx, { items: [{ sku: 'A', quantity: 2 }] });
  assert.equal(result['stock.reviewRequired'], true);
  assert.equal(f.writes.length, 0);
});
test('missing product flags review and invalid items do not write', async () => {
  for (const item of [{ sku: 'MISSING', quantity: 1 }, { sku: 'A', quantity: -1 }]) {
    const f = fixture();
    assert.equal((await commitPaidStock(f.db, f.tx, { items: [item] }))['stock.reviewRequired'], true);
    assert.equal(f.writes.length, 0);
  }
});
test('approval consumes its own inventory reservation once and preserves other reservations', async () => {
  const f = fixture(10);
  f.records.get('inventory/A').reserved = 3;
  const result = await commitPaidStock(f.db, f.tx, { orderNumber: 'ORDER', items: [{ sku: 'A', quantity: 2 }],
    stock: { status: 'reserved', reservations: [{ sku: 'A', quantity: 2, kind: 'inventory' }] } });
  assert.equal(result.stockCommitted, true);
  assert.equal(f.records.get('products/p').stock, 8);
  assert.equal(f.records.get('inventory/A').quantity, 8);
  assert.equal(f.records.get('inventory/A').reserved, 1);
  assert.equal(f.records.get('inventory/A').available, 7);
  assert.equal(f.records.get('settings/publicStock').stockAvailability.A, 7);
});
