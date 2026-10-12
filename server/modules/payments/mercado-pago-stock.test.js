'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { aggregateItems, reserveInTransaction, validatePilot } = require('./mercado-pago-stock');

test('quantidades do mesmo SKU são somadas antes de validar disponibilidade', () => {
  assert.deepEqual(aggregateItems([{ sku: 'A', quantity: 1 }, { sku: 'A', quantity: 2 }]), [{ sku: 'A', quantity: 3 }]);
  for (const items of [[], [{ sku: 'A', quantity: -1 }], [{ sku: 'A', quantity: 0.5 }]]) assert.throws(() => aggregateItems(items));
});

test('reserva usa estoque atual e rejeita preço alterado sem escrever', async () => {
  const writes = [];
  let product = { sku: 'A', price: 100, stock: 2 };
  const tx = { get: async () => ({ exists: true, data: () => product }), update: (ref, patch) => writes.push(patch) };
  const plan = [{ ref: {}, documentId: 'a', sku: 'A', quantity: 1, unitPrice: 100 }];
  const stock = await reserveInTransaction(tx, plan);
  assert.equal(stock.status, 'reserved'); assert.deepEqual(writes, [{ stock: 1 }]);
  writes.length = 0; product = { ...product, price: 101 };
  await assert.rejects(reserveInTransaction(tx, plan), /preço/);
  assert.equal(writes.length, 0);
});

test('falha em um produto impede qualquer baixa nos demais', async () => {
  const writes = [];
  const plans = [{ ref: 'a', documentId: 'a', sku: 'A', quantity: 1, unitPrice: 10 },
    { ref: 'b', documentId: 'b', sku: 'B', quantity: 1, unitPrice: 10 }];
  const tx = { get: async ref => ({ exists: true, data: () => ({ sku: ref.toUpperCase(), price: 10, stock: ref === 'a' ? 1 : 0 }) }),
    update: () => writes.push(true) };
  await assert.rejects(reserveInTransaction(tx, plans), /Estoque insuficiente/);
  assert.equal(writes.length, 0);
});

test('duas transações serializadas não reservam a mesma última unidade', async () => {
  let remaining = 1;
  const tx = { get: async () => ({ exists: true, data: () => ({ sku: 'A', price: 10, stock: remaining }) }),
    update: (ref, patch) => { remaining = patch.stock; } };
  const plans = [{ ref: {}, documentId: 'a', sku: 'A', quantity: 1, unitPrice: 10 }];
  await reserveInTransaction(tx, plans);
  await assert.rejects(reserveInTransaction(tx, plans), /Estoque insuficiente/);
  assert.equal(remaining, 0);
});

test('primeira venda real exige SKU, uma unidade e teto de total explícitos', () => {
  const env = { MP_REAL_SALE_TEST_ONLY: 'true', MP_REAL_SALE_TEST_SKU: 'A', MP_REAL_SALE_TEST_MAX_TOTAL: '110' };
  const order = { items: [{ sku: 'A', quantity: 1 }], totals: { total: 109.90 } };
  assert.doesNotThrow(() => validatePilot(order, env));
  assert.throws(() => validatePilot({ ...order, totals: { total: 111 } }, env));
  assert.throws(() => validatePilot({ ...order, items: [{ sku: 'A', quantity: 2 }] }, env));
  assert.throws(() => validatePilot(order, {}));
});

const { releaseInTransaction } = require('./mercado-pago-stock');
test('new inventory reservations keep physical stock and release availability without adding units', async () => {
  const state = new Map([['product', { sku: 'A', price: 10, stock: 10 }], ['inventory', { sku: 'A', quantity: 10, reserved: 0, available: 10 }]]);
  let writing = false;
  const tx = { get: async ref => { assert.equal(writing, false); return { exists: state.has(ref), data: () => ({ ...state.get(ref) }) }; },
    set: (ref, patch) => { writing = true; state.set(ref, { ...state.get(ref), ...patch }); },
    update: () => { throw new Error('Physical stock must not change before payment.'); } };
  const plan = [{ ref: 'product', inventoryRef: 'inventory', publicRef: 'public', documentId: 'a', sku: 'A', quantity: 2, unitPrice: 10 }];
  const reservation = await reserveInTransaction(tx, plan);
  assert.equal(state.get('product').stock, 10);
  assert.equal(state.get('inventory').reserved, 2);
  assert.equal(state.get('inventory').available, 8);
  writing = false;
  await assert.rejects(reserveInTransaction(tx, [{ ...plan[0], quantity: 9 }]), /Estoque insuficiente/);
  const db = { collection: name => ({ doc: () => name === 'inventory' ? 'inventory' : 'public' }) };
  assert.equal(await releaseInTransaction(tx, db, reservation), true);
  assert.equal(state.get('inventory').quantity, 10);
  assert.equal(state.get('inventory').reserved, 0);
  assert.equal(state.get('inventory').available, 10);
});
test('devolução soma ao estoque atual e não devolve reserva já encerrada', async () => {
  let quantity = 4;
  const db = { collection: () => ({ doc: id => id }) };
  const tx = { get: async () => ({ exists: true, data: () => ({ sku: 'A', stock: quantity }) }),
    update: (ref, patch) => { quantity = patch.stock; } };
  const reservation = { status: 'reserved', reservations: [{ documentId: 'a', sku: 'A', field: 'stock', quantity: 2 }] };
  assert.equal(await releaseInTransaction(tx, db, reservation), true);
  assert.equal(quantity, 6);
  assert.equal(await releaseInTransaction(tx, db, { ...reservation, status: 'released' }), false);
  assert.equal(quantity, 6);
});
test('produto removido ou SKU alterado impede devolução parcial', async () => {
  const db = { collection: () => ({ doc: id => id }) }, writes = [];
  const tx = { get: async id => ({ exists: id !== 'b', data: () => ({ sku: 'A', stock: 1 }) }),
    update: (...args) => writes.push(args) };
  await assert.rejects(releaseInTransaction(tx, db, { status: 'reserved', reservations: [
    { documentId: 'a', sku: 'A', field: 'stock', quantity: 1 },
    { documentId: 'b', sku: 'B', field: 'stock', quantity: 1 }
  ] }));
  assert.equal(writes.length, 0);
});
