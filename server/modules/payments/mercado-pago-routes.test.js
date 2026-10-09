'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const { createHmac } = require('node:crypto');
const express = require('express');
const provider = require('./mercado-pago-provider');

test('fluxo HTTP: tentativa repetida, falha, webhook adulterado e eventos fora de ordem', async () => {
  const savedEnv = { ...process.env };
  Object.assign(process.env, { MP_CHECKOUT_ENABLED: 'true', MP_MODE: 'test', MP_ACCESS_TOKEN: 'mock',
    MP_COLLECTOR_ID: '123', MP_WEBHOOK_SECRET: 'mock-secret', PUBLIC_STORE_URL: 'https://www.fiosperfeitos.com.br',
    MP_NOTIFICATION_URL: 'https://example.test/api/payments/mercado-pago/webhook' });
  const records = new Map();
  const reference = key => ({ key, get: async () => snapshot(key) });
  const snapshot = key => ({ exists: records.has(key), data: () => structuredClone(records.get(key)) });
  const set = (ref, value, options = {}) => records.set(ref.key,
    options.merge ? { ...records.get(ref.key), ...structuredClone(value) } : structuredClone(value));
  const update = (ref, value) => {
    const entry = records.get(ref.key);
    for (const [key, item] of Object.entries(value)) {
      const parts = key.split('.');
      if (parts.length === 2) entry[parts[0]][parts[1]] = item;
      else entry[key] = item;
    }
  };
  const db = { collection: name => ({ doc: id => reference(`${name}/${id}`) }),
    runTransaction: async action => action({ get: ref => ref.get(), set, update,
      create: (ref, value) => { assert.equal(records.has(ref.key), false); set(ref, value); } }) };
  const originalLoad = Module._load;
  Module._load = function(name, parent, main) {
    if (parent?.filename.endsWith('mercado-pago-routes.js')) {
      if (name.endsWith('firebase-admin')) return { getFirestore: () => db };
      if (name.endsWith('complete-order-builder')) return { buildCompleteOrder: async () => ({
        totals: { total: 79.90 }, customer: {}, items: [{ sku: 'REAL', quantity: 1 }],
        createdAt: new Date().toISOString(), logistics: { status: 'pending' }
      }) };
    }
    return originalLoad.call(this, name, parent, main);
  };
  let router;
  try { router = require('./mercado-pago-routes'); } finally { Module._load = originalLoad; }
  let calls = 0, payment;
  const originalRequest = provider.request;
  provider.request = async (config, path, body) => {
    if (path === '/users/me') return { id: 123, tags: ['test_user'] };
    calls++;
    if (path === '/checkout/preferences') {
      assert.equal(body.items[0].unit_price, 79.90);
      return { id: 'pref-test', init_point: 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=test' };
    }
    return payment;
  };
  const noSockets = process.env.MP_TEST_NO_SOCKETS === 'true';
  let server, base = 'http://127.0.0.1';
  if (!noSockets) {
    const app = express(); app.use(express.json()); app.use(router);
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  }
  const post = async (path, body, headers = {}) => {
    if (!noSockets) return fetch(base + path, { method: 'POST', headers: {
      'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
    // Executar os handlers reais quando o ambiente de revisão proíbe sockets locais.
    const url = new URL(path, base);
    const layer = router.stack.find(item => item.route?.path === url.pathname && item.route.methods.post);
    let status = 200, data = null;
    const req = { body, query: Object.fromEntries(url.searchParams), ip: '127.0.0.1', get: name => headers[name] };
    const res = { status: value => { status = value; return res; }, set: () => res,
      json: value => { data = value; return res; }, sendStatus: value => { status = value; return res; } };
    await layer.route.stack[0].handle(req, res);
    return { status, json: async () => data };
  };
  try {
    const payload = { checkoutAttemptId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
      items: [{ sku: 'REAL', quantity: 1 }], customer: {}, total: 0.01, discount: 99999 };
    const first = await (await post('/checkout', payload)).json();
    assert.equal(first.success, true); assert.equal(first.data.total, 79.90);
    assert.deepEqual(await (await post('/checkout', payload)).json(), first);
    assert.equal(calls, 1);
    assert.equal([...records.keys()].some(key => key.startsWith('orders/')), false);
    assert.equal((await post('/checkout', { ...payload, items: [{ sku: 'OTHER', quantity: 1 }] })).status, 409);
    assert.equal((await post('/webhook?data.id=99&type=payment', { type: 'payment' })).status, 401);
    assert.equal(calls, 1);
    const reqId = 'event-test', ts = '1234567890';
    const signature = createHmac('sha256', 'mock-secret').update(`id:99;request-id:${reqId};ts:${ts};`).digest('hex');
    const headers = { 'x-request-id': reqId, 'x-signature': `ts=${ts},v1=${signature}` };
    payment = { id: 99, external_reference: first.data.orderNumber, collector_id: 123,
      currency_id: 'BRL', transaction_amount: 79.90, live_mode: false, status: 'approved',
      date_last_updated: '2026-10-09T12:00:00Z', date_approved: '2026-10-09T12:00:00Z' };
    assert.equal((await post('/webhook?data.id=99&type=payment', { type: 'payment', status: 'rejected' }, headers)).status, 200);
    const orderKey = `mpTestOrders/${first.data.orderNumber}`;
    assert.equal(records.get(orderKey).payment.status, 'paid');
    payment = { ...payment, status: 'approved', transaction_amount: 79.90, date_last_updated: '2026-10-09T14:00:00Z' };
    assert.equal((await post('/reconcile', { token: 'a'.repeat(64), paymentId: '99', status: 'approved' })).status, 404);
    const reconciled = await (await post('/reconcile', { token: first.data.trackingToken, paymentId: '99', status: 'rejected' })).json();
    assert.equal(reconciled.paymentStatus, 'paid');
    payment = { ...payment, external_reference: 'AUR-0000000000000000' };
    assert.equal((await post('/reconcile', { token: first.data.trackingToken, paymentId: '99' })).status, 503);
    payment = { ...payment, external_reference: first.data.orderNumber, status: 'pending', date_last_updated: '2026-10-09T11:00:00Z' };
    assert.equal((await post('/webhook?data.id=99&type=payment', { type: 'payment' }, headers)).status, 200);
    assert.equal(records.get(orderKey).payment.status, 'paid');
    payment = { ...payment, status: 'refunded', transaction_amount: 1, date_last_updated: '2026-10-09T13:00:00Z' };
    assert.equal((await post('/webhook?data.id=99&type=payment', { type: 'payment' }, headers)).status, 503);
    assert.equal(records.get(orderKey).payment.status, 'paid');
  } finally {
    provider.request = originalRequest;
    for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key];
    Object.assign(process.env, savedEnv);
    if (server) await new Promise(resolve => server.close(resolve));
  }
});
