'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
let products, records, invalidations;
const db = {
  collection(name) {
    const snapshot = (id, data) => ({ id, ref: { name, id }, exists: Boolean(data), data: () => data });
    return {
      doc(id = 'new-order') { return { name, id }; },
      where(field, op, value) { return { limit() { return { get: async () => ({ docs: [...products].filter(([id, item]) => item[field] === value).map(([id, item]) => snapshot(id, item)) }) }; } }; },
      async get() { return { docs: [...products].map(([id, item]) => snapshot(id, item)) }; }
    };
  },
  async runTransaction(action) {
    const writes = [];
    await action({
      async get(ref) { const data = products.get(ref.id); return { exists: Boolean(data), data: () => data }; },
      update(ref, patch) { writes.push(() => products.set(ref.id, { ...products.get(ref.id), ...patch })); },
      create(ref, data) { writes.push(() => records.push({ ref, data })); },
      set(ref, data) { writes.push(() => records.push({ ref, data })); }
    });
    writes.forEach(write => write());
  }
};
const firebasePath = require.resolve('../../infrastructure/firebase/firebase-admin');
require.cache[firebasePath] = { id: firebasePath, filename: firebasePath, loaded: true, exports: { getFirestore: () => db } };
const cachePath = require.resolve('../catalog/catalog-storefront-service');
require.cache[cachePath] = { id: cachePath, filename: cachePath, loaded: true, exports: { invalidate: () => invalidations++ } };
const repository = require('./order-repository');
const order = { orderNumber: 'AUR-TEST1234', items: [{ sku: 'A', quantity: 1, unitPrice: 10 }], totals: { total: 10 }, payment: { method: 'pix', status: 'pending' }, publicTrackingToken: 'a'.repeat(64) };
function reset(stock = 3) { products = new Map([['a', { sku: 'A', price: 10, stock }]]); records = []; invalidations = 0; }
test('pedido Pix reserva estoque persistido e salva rastreio na mesma transação', async () => {
  reset(); const saved = await repository.create(order);
  assert.equal(products.get('a').stock, 2);
  assert.equal(saved.stock.status, 'reserved');
  assert.equal(saved.stock.reservations[0].documentId, 'a');
  assert.deepEqual(records.map(item => item.ref.name), ['orders', 'orderTracking']);
  assert.equal(invalidations, 1);
});
test('SKU repetido tem uma única baixa pela quantidade total', async () => {
  reset(); await repository.create({ ...order, items: [order.items[0], { ...order.items[0], quantity: 2 }] });
  assert.equal(products.get('a').stock, 0);
});
test('estoque insuficiente não salva pedido nem faz baixa parcial', async () => {
  reset(1); await assert.rejects(repository.create({ ...order, items: [{ ...order.items[0], quantity: 2 }] }), /Estoque insuficiente/);
  assert.equal(products.get('a').stock, 1); assert.equal(records.length, 0); assert.equal(invalidations, 0);
});
test('duas compras não consomem a mesma última unidade', async () => {
  reset(1); await repository.create(order); await assert.rejects(repository.create(order), /Estoque insuficiente/);
  assert.equal(products.get('a').stock, 0); assert.equal(records.filter(item => item.ref.name === 'orders').length, 1);
});
