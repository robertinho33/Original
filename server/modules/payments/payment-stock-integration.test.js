'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const express = require('express');
const provider = require('./mercado-pago-provider');

test('production PIX approval deducts once; retries, pending and insufficient stock are handled', async () => {
  const env = { ...process.env }, originalRequest = provider.request;
  Object.assign(process.env, { MP_CHECKOUT_ENABLED: 'true', MP_PRODUCTION_VALIDATED: 'true', MP_MODE: 'production',
    MP_CATALOG_CARD_ENABLED: 'true', MP_PRODUCTION_ACCESS_TOKEN: 'mock', MP_PRODUCTION_COLLECTOR_ID: '123', MP_PRODUCTION_WEBHOOK_SECRET: 'mock',
    MP_ACCESS_TOKEN: 'mock', MP_COLLECTOR_ID: '123', MP_WEBHOOK_SECRET: 'mock',
    PUBLIC_STORE_URL: 'https://example.test', MP_NOTIFICATION_URL: 'https://example.test/webhook' });
  const token = 'a'.repeat(64), number = 'AUR-0000000000000001';
  const records = new Map([
    ['orders/' + number, { orderNumber: number, publicTrackingToken: token, totals: { total: 20 },
      items: [{ sku: 'A', quantity: 2 }], payment: { status: 'pending', method: 'pix' },
      stock: { status: 'reserved', reservations: [{ sku: 'A', quantity: 2, kind: 'inventory' }] } }],
    ['orderTracking/' + token, {}], ['products/p', { sku: 'A', stock: 10 }],
    ['inventory/A', { quantity: 10, reserved: 2, available: 8 }]
  ]);
  let counter = 0;
  const snapshot = key => ({ id: key.split('/')[1], ref: reference(key), exists: records.has(key), data: () => structuredClone(records.get(key)) });
  const reference = key => ({ key, get: async () => snapshot(key) });
  const db = { collection: name => ({ doc: id => reference(name + '/' + (id || 'move-' + ++counter)),
    where: (_, op, sku) => ({ limit: () => ({ query: sku }) }) }), runTransaction: async action => {
      let writing = false; const writes = [];
      const tx = { get: async ref => {
        assert.equal(writing, false);
        return ref.query ? { docs: [...records].filter(([key, data]) => key.startsWith('products/') && data.sku === ref.query).map(([key]) => snapshot(key)) } : snapshot(ref.key);
      }, set: (ref, data) => { writing = true; writes.push([ref, data]); }, update: (ref, data) => { writing = true; writes.push([ref, data]); } };
      const result = await action(tx);
      for (const [ref, data] of writes) {
        const entry = records.get(ref.key) || {};
        for (const [key, value] of Object.entries(data)) {
          const parts = key.split('.');
          if (parts.length === 2) { entry[parts[0]] ||= {}; entry[parts[0]][parts[1]] = value; }
          else entry[key] = value;
        }
        records.set(ref.key, entry);
      }
      return result;
  } };
  const originalLoad = Module._load;
  Module._load = function(name, parent, main) {
    if (parent?.filename.endsWith('mercado-pago-routes.js')) {
      if (name.endsWith('firebase-admin')) return { getFirestore: () => db };
      if (name.endsWith('complete-order-builder')) return {};
    }
    return originalLoad.call(this, name, parent, main);
  };
  let router;
  try { router = require('./mercado-pago-routes'); } finally { Module._load = originalLoad; }
  let payment = { id: 99, external_reference: number, collector_id: 123, currency_id: 'BRL',
    transaction_amount: 20, live_mode: true, status: 'pending', payment_method_id: 'pix', date_last_updated: '2026-10-12T10:00:00Z' };
  provider.request = async (config, endpoint) => endpoint === '/users/me' ? { id: 123, tags: [] } : payment;
  const app = express(); app.use(express.json()); app.use(router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const reconcile = async () => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/reconcile`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, paymentId: '99' }) });
    assert.equal(response.status, 200);
    return response.json();
  };
  try {
    await reconcile();
    assert.equal(records.get('products/p').stock, 10);
    payment = { ...payment, status: 'approved', date_last_updated: '2026-10-12T11:00:00Z' };
    await reconcile();
    assert.equal(records.get('orders/' + number).payment.status, 'paid');
    assert.equal(records.get('products/p').stock, 8);
    assert.equal(records.get('inventory/A').quantity, 8);
    assert.equal(records.get('inventory/A').reserved, 0);
    await reconcile();
    assert.equal(records.get('products/p').stock, 8);
    // Fresh real payment with no stock remains recorded as paid and visibly requires review.
    records.get('orders/' + number).stockCommitted = false;
    records.get('orders/' + number).payment = { status: 'pending', method: 'pix' };
    records.get('inventory/A').quantity = 0;
    payment = { ...payment, id: 99, date_last_updated: '2026-10-12T12:00:00Z' };
    await reconcile();
    assert.equal(records.get('orders/' + number).payment.status, 'paid');
    assert.equal(records.get('orders/' + number).stock.reviewRequired, true);
    assert.equal(records.get('products/p').stock, 8);
  } finally { await new Promise(resolve => server.close(resolve)); provider.request = originalRequest; process.env = env; }
});

test('PIX preference enables bank transfers and excludes cards', () => {
  const body = provider.preferenceBody({ orderNumber: 'AUR-1', publicTrackingToken: 'a'.repeat(64),
    payment: { method: 'pix' }, totals: { total: 20 } }, { mode: 'production', storeUrl: 'https://example.test', notificationUrl: 'https://example.test/webhook' });
  const excluded = body.payment_methods.excluded_payment_types.map(type => type.id);
  assert.equal(excluded.includes('bank_transfer'), false);
  assert.equal(excluded.includes('credit_card'), true);
});
