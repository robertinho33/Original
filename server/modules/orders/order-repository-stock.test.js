'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
let products, records, invalidations, transactionQueue = Promise.resolve();
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
    const previous = transactionQueue;
    let release;
    transactionQueue = new Promise(resolve => { release = resolve; });
    await previous;
    try {
    const writes = [];
    await action({
      async get(ref) { const data = ref.name === 'products' ? products.get(ref.id) : records.find(item => item.ref.name === ref.name && item.ref.id === ref.id)?.data; return { exists: Boolean(data), data: () => data }; },
      update(ref, patch) { writes.push(() => products.set(ref.id, { ...products.get(ref.id), ...patch })); },
      create(ref, data) { writes.push(() => records.push({ ref, data })); },
      set(ref, data) { writes.push(() => {
        const existing = records.find(item => item.ref.name === ref.name && item.ref.id === ref.id);
        if (existing) existing.data = { ...existing.data, ...data }; else records.push({ ref, data });
      }); }
    });
    writes.forEach(write => write());
    } finally { release(); }
  }
};
const firebasePath = require.resolve('../../infrastructure/firebase/firebase-admin');
require.cache[firebasePath] = { id: firebasePath, filename: firebasePath, loaded: true, exports: { getFirestore: () => db } };
const cachePath = require.resolve('../catalog/catalog-storefront-service');
require.cache[cachePath] = { id: cachePath, filename: cachePath, loaded: true, exports: { invalidate: () => invalidations++ } };
const repository = require('./order-repository');
const order = { orderNumber: 'AUR-TEST1234', items: [{ sku: 'A', quantity: 1, unitPrice: 10 }], totals: { total: 10 }, payment: { method: 'pix', status: 'pending' }, publicTrackingToken: 'a'.repeat(64) };
function reset(stock = 3) { products = new Map([['a', { sku: 'A', price: 10, stock }]]); records = []; invalidations = 0; }
function availableStock() { return records.find(item => item.ref.name === 'inventory' && item.ref.id === 'A')?.data.available ?? products.get('a').stock; }
test('pedido Pix reserva estoque persistido e salva rastreio na mesma transação', async () => {
  reset(); const saved = await repository.create(order);
  assert.equal(availableStock(), 2);
  assert.equal(saved.stock.status, 'reserved');
  assert.equal(products.get('a').stock, 3);
  assert.equal(saved.stock.reservations[0].kind, 'inventory');
  assert.equal(saved.stock.reservations[0].documentId, 'a');
  assert.deepEqual(records.filter(item => ['orders', 'orderTracking'].includes(item.ref.name)).map(item => item.ref.name), ['orders', 'orderTracking']);
  assert.equal(invalidations, 1);
});
test('SKU repetido tem uma única baixa pela quantidade total', async () => {
  reset(); await repository.create({ ...order, items: [order.items[0], { ...order.items[0], quantity: 2 }] });
  assert.equal(availableStock(), 0);
});
test('estoque insuficiente não salva pedido nem faz baixa parcial', async () => {
  reset(1); await assert.rejects(repository.create({ ...order, items: [{ ...order.items[0], quantity: 2 }] }), /Estoque insuficiente/);
  assert.equal(availableStock(), 1); assert.equal(records.length, 0); assert.equal(invalidations, 0);
});
test('duas compras não consomem a mesma última unidade', async () => {
  reset(1); await repository.create(order); await assert.rejects(repository.create(order), /Estoque insuficiente/);
  assert.equal(availableStock(), 0); assert.equal(records.filter(item => item.ref.name === 'orders').length, 1);
});
test('duas solicitações simultâneas da mesma tentativa salvam um pedido e uma baixa', async () => {
  reset(1);
  const attempt = { documentId: 'pix-attempt', fingerprint: 'original' };
  const [first, repeated] = await Promise.all([repository.create(order, attempt), repository.create({ ...order, orderNumber: 'AUR-OTHER123' }, attempt)]);
  assert.equal(first.orderNumber, repeated.orderNumber);
  assert.equal(first.publicTrackingToken, repeated.publicTrackingToken);
  assert.equal(availableStock(), 0);
  assert.equal(records.filter(item => item.ref.name === 'orders').length, 1);
});
test('mesma tentativa com dados diferentes não altera estoque nem pedido', async () => {
  reset();
  await repository.create(order, { documentId: 'pix-attempt', fingerprint: 'original' });
  await assert.rejects(repository.create(order, { documentId: 'pix-attempt', fingerprint: 'changed' }), /dados desta tentativa mudaram/);
  assert.equal(availableStock(), 2);
  assert.equal(records.filter(item => item.ref.name === 'orders').length, 1);
});
