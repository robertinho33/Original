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
