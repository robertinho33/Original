'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const provider = require('./infinitepay-provider');
const { createRouter } = require('./infinitepay-routes');

const configuration = () => ({ enabled: true, handle: 'loja-teste', key: 'secret-test',
  store: 'https://store.test', webhook: 'https://api.test/api/payments/infinitepay/webhook' });
function fixture() {
  const records = new Map();
  const ref = key => ({ key, get: async () => snapshot(key), update: async patch => update({ key }, patch) });
  const snapshot = key => ({ exists: records.has(key), data: () => structuredClone(records.get(key)) });
  function set(reference, data, options = {}) { records.set(reference.key, { ...(options.merge ? records.get(reference.key) : {}), ...structuredClone(data) }); }
  function update(reference, patch) {
    const data = records.get(reference.key);
    for (const [path, value] of Object.entries(patch)) {
      const parts = path.split('.');
      if (parts.length === 2) data[parts[0]][parts[1]] = structuredClone(value);
      else data[path] = structuredClone(value);
    }
  }
  const db = { collection: name => ({ doc: id => ref(`${name}/${id}`) }), runTransaction: async fn => fn({
    get: reference => reference.get(), set, update, create: (reference, data) => {
      assert.equal(records.has(reference.key), false); set(reference, data);
    } }) };
  let links = 0, commits = 0, reserves = 0, uncertain = false;
  let payment = { success: true, paid: true, amount: 7990, paid_amount: 7990, capture_method: 'pix' };
  const router = createRouter({ configuration, getDb: () => db,
    buildOrder: async payload => ({ customer: payload.customer, items: [{ sku: 'REAL', quantity: 1, unitPrice: 79.9 }],
      totals: { total: 79.9 }, status: 'pending', createdAt: new Date().toISOString() }),
    stock: { aggregateItems: items => items, prepareReservation: async () => [], reserveInTransaction: async () => { reserves++; return { status: 'reserved' }; } },
    commitStock: async () => { commits++; return { stockCommitted: true, 'stock.status': 'committed' }; },
    notify: async () => {}, invalidate: () => {},
    request: async (cfg, path, body) => {
      if (path === '/links') {
        links++; assert.equal(body.items[0].price, 7990); assert.equal(body.options.single_payment, true);
        assert.deepEqual(body.webhook, { url: configuration().webhook, events: ['paid'] });
        assert.ok(Date.parse(body.options.valid_until) > Date.now());
        if (uncertain) throw Error('network timeout');
        return { url: 'https://checkout.infinitepay.io/loja-teste/invoice' };
      }
      assert.equal(path, '/payment_check'); assert.equal(body.handle, 'loja-teste');
      return payment;
    } });
  async function post(path, body) {
    const handler = router.stack.find(layer => layer.route?.path === path && layer.route.methods.post).route.stack[0].handle;
    let status = 200, data;
    const res = { status: value => { status = value; return res; }, set: () => res, json: value => { data = value; return res; } };
    await handler({ body }, res);
    return { status, data };
  }
  const payload = { checkoutAttemptId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', items: [{ sku: 'REAL', quantity: 1 }],
    customer: { name: 'Teste' }, total: 0.01, discount: 9999 };
  return { records, post, payload, stats: () => ({ links, commits, reserves }),
    payment: value => { payment = value; }, uncertain: () => { uncertain = true; } };
}
test('provider: disabled by default, HTTPS, cents, secret only in request header', async () => {
  assert.equal(provider.configuration({}).enabled, false);
  const env = { INFINITEPAY_ENABLED: 'true', INFINITEPAY_HANDLE: 'store', PUBLIC_STORE_URL: 'https://store.test', INFINITEPAY_WEBHOOK_URL: 'https://api.test/webhook' };
  assert.equal(provider.configuration(env, () => 'file-secret').enabled, true);
  assert.equal(provider.configuration({ ...env, INFINITEPAY_API_KEY: 'env-secret' }, () => 'file-secret').key, 'env-secret');
  assert.equal(provider.configuration(env, () => '').enabled, false);
  assert.equal(provider.configuration({ PUBLIC_STORE_URL: 'http://store.test', INFINITEPAY_WEBHOOK_URL: 'https://api.test' }).enabled, false);
  for (const url of ['https://checkout.infinitepay.io.evil.test', 'javascript:alert(1)', 'http://checkout.infinitepay.io', 'https://x:pass@checkout.infinitepay.io']) assert.throws(() => provider.checkoutUrl(url));
  assert.equal(provider.cents(79.9), 7990);
  assert.throws(() => provider.cents(NaN));
  await provider.request(configuration(), '/links', { order_nsu: 'test' }, async (url, options) => {
    assert.equal(url, 'https://api.checkout.infinitepay.io/links');
    assert.equal(options.headers['X-Api-Key'], 'secret-test'); assert.ok(!options.body.includes('secret-test'));
    return { ok: true, json: async () => ({ url: 'ok' }) };
  });
});
test('checkout uses authoritative total, reserves once and reuses the same link', async () => {
  const f = fixture();
  const first = await f.post('/checkout', f.payload);
  assert.equal(first.status, 200);
  assert.deepEqual(await f.post('/checkout', f.payload), first);
  assert.deepEqual(f.stats(), { links: 1, commits: 0, reserves: 1 });
  assert.equal((await f.post('/checkout', { ...f.payload, notes: 'changed' })).status, 409);
  assert.ok(!JSON.stringify(first).includes('secret-test'));
});
test('uncertain creation is not retried and retains order for review', async () => {
  const f = fixture(); f.uncertain();
  const first = await f.post('/checkout', f.payload);
  assert.equal(first.status, 503); assert.ok(first.data.data.trackingToken);
  assert.equal((await f.post('/checkout', f.payload)).status, 409);
  assert.equal(f.stats().links, 1);
});
test('recovery closes an unused attempt so a delayed checkout cannot create a duplicate', async () => {
  const f = fixture();
  const body = { checkoutAttemptId: f.payload.checkoutAttemptId };
  assert.equal((await f.post('/attempt/recover', body)).data.data.state, 'empty');
  assert.equal((await f.post('/attempt/recover', body)).data.data.state, 'empty');
  assert.equal((await f.post('/checkout', f.payload)).status, 409);
  assert.deepEqual(f.stats(), { links: 0, commits: 0, reserves: 0 });
  assert.equal((await f.post('/attempt/recover', { checkoutAttemptId: 'invalid' })).status, 400);
});
test('recovery finds an uncertain persisted order without creating or replacing its payment', async () => {
  const f = fixture(); f.uncertain();
  const first = await f.post('/checkout', f.payload);
  const recovered = await f.post('/attempt/recover', { checkoutAttemptId: f.payload.checkoutAttemptId });
  assert.equal(recovered.status, 200);
  assert.equal(recovered.data.data.state, 'order');
  assert.equal(recovered.data.data.orderNumber, first.data.data.orderNumber);
  assert.equal(recovered.data.data.trackingToken, first.data.data.trackingToken);
  assert.equal(f.stats().links, 1);
});
test('forged webhook cannot mark paid; mismatched amounts and missing tokens are rejected', async () => {
  const f = fixture();
  const order = (await f.post('/checkout', f.payload)).data.data;
  const event = { order_nsu: order.orderNumber, transaction_nsu: 'tx-1', invoice_slug: 'invoice', paid: true, amount: 7990 };
  f.payment({ success: true, paid: false });
  assert.equal((await f.post('/webhook', event)).status, 200);
  assert.equal(f.stats().commits, 0);
  f.payment({ success: true, paid: true, amount: 1, paid_amount: 1, capture_method: 'pix' });
  assert.equal((await f.post('/webhook', event)).status, 409);
  assert.equal((await f.post('/confirm', event)).status, 404);
  assert.equal(f.stats().commits, 0);
});
test('verified repeated events commit stock once; resume requires private token', async () => {
  const f = fixture();
  const order = (await f.post('/checkout', f.payload)).data.data;
  const event = { order_nsu: order.orderNumber, transaction_nsu: 'tx-1', slug: 'invoice', token: order.trackingToken };
  assert.equal((await f.post('/confirm', event)).data.data.paymentStatus, 'paid');
  assert.equal((await f.post('/webhook', event)).status, 200);
  assert.equal(f.stats().commits, 1);
  assert.equal((await f.post('/resume', { orderNumber: order.orderNumber, token: 'a'.repeat(64) })).status, 404);
  const resumed = await f.post('/resume', { orderNumber: order.orderNumber, token: order.trackingToken });
  assert.equal(resumed.data.data.paymentStatus, 'paid'); assert.equal(resumed.data.data.checkoutUrl, undefined);
  assert.equal((await f.post('/webhook', { ...event, transaction_nsu: 'different' })).status, 409);
});
test('expired links are not offered again and paid checks require matching amount', async () => {
  const f = fixture();
  const order = (await f.post('/checkout', f.payload)).data.data;
  f.records.get('orders/' + order.orderNumber).payment.expiresAt = new Date(0).toISOString();
  assert.equal((await f.post('/checkout', f.payload)).status, 409);
  const resumed = await f.post('/resume', { orderNumber: order.orderNumber, token: order.trackingToken });
  assert.equal(resumed.data.data.checkoutUrl, undefined);
});
test('browser redirects only to InfinitePay, preserves cart and stores no customer details in attempts', async () => {
  const vm = require('node:vm');
  const fs = require('node:fs');
  const path = require('node:path');
  const values = new Map(), calls = [], redirects = [];
  const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const data = { checkoutUrl: 'https://checkout.infinitepay.io/loja/test', orderNumber: 'AUR-AAAAAAAAAAAAAAAA', trackingToken: 'a'.repeat(64) };
  const context = { location: { hostname: 'localhost', assign: url => redirects.push(url) },
    sessionStorage: storage, document: { querySelector: () => null },
    crypto: require('node:crypto').webcrypto, TextEncoder, Uint8Array, URL, AbortSignal,
    fetch: async (url, options) => {
      calls.push({ url, body: JSON.parse(options.body) });
      return { ok: true, json: async () => ({ success: true, data: url.endsWith('/resume') ? { paymentStatus: 'pending', checkoutUrl: data.checkoutUrl } : data }) };
    } };
  const source = fs.readFileSync(path.join(__dirname, '../../..', 'js/checkout/infinitepay-checkout.js'), 'utf8').replace(/export /g, '');
  vm.runInNewContext(source + '\nglobalThis.start = startInfinitePay;', context);
  const order = { items: [{ sku: 'REAL', quantity: 1, unitPrice: 0.01 }], customer: { name: 'Private Customer', email: 'private@example.test' },
    delivery: { method: 'pickup' }, payment: { method: 'infinitepay' } };
  await context.start(order);
  assert.equal(redirects[0], data.checkoutUrl);
  assert.ok(!JSON.stringify([...values.values()]).includes('Private Customer'));
  assert.ok(!JSON.stringify([...values.values()]).includes('private@example.test'));
  assert.equal(calls[0].body.items[0].unitPrice, undefined);
  await context.start(order);
  assert.ok(calls[1].url.endsWith('/resume'));
  assert.equal(calls.filter(call => call.url.endsWith('/checkout')).length, 1);
});
test('sole payment option stays disabled on configuration failure and can recover on retry', async () => {
  const vm = require('node:vm'), fs = require('node:fs'), path = require('node:path');
  let enabled = false, retry;
  const description = { textContent: '' };
  const label = { querySelector: () => description, after: element => { retry = element; } };
  const input = { disabled: true, checked: true, closest: () => label };
  const context = { location: { hostname: 'localhost' }, sessionStorage: { getItem: () => null }, AbortSignal,
    document: { querySelector: selector => selector.includes('paymentMethod') ? input : null,
      getElementById: () => retry, createElement: () => ({ addEventListener: () => {} }) },
    fetch: async () => ({ ok: true, json: async () => ({ enabled }) }) };
  const source = fs.readFileSync(path.join(__dirname, '../../../js/checkout/infinitepay-checkout.js'), 'utf8').replace(/export /g, '');
  vm.runInNewContext(source + '\nglobalThis.configure = configureInfinitePay;', context);
  await context.configure();
  assert.equal(input.disabled, true); assert.equal(retry.hidden, false);
  assert.match(description.textContent, /indisponível/);
  enabled = true;
  await context.configure();
  assert.equal(input.disabled, false); assert.equal(retry.hidden, true);
  assert.match(description.textContent, /InfinitePay/);
});
test('changed form recovers stale attempts, but never rotates an existing or unverified payment', async () => {
  const vm = require('node:vm'), fs = require('node:fs'), path = require('node:path');
  const source = fs.readFileSync(path.join(__dirname, '../../../js/checkout/infinitepay-checkout.js'), 'utf8').replace(/export /g, '');
  for (const state of ['empty', 'order', 'offline']) {
    const oldId = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
    const values = new Map([['fios-infinitepay-attempt', JSON.stringify({ id: oldId, fingerprint: 'stale' })]]);
    const calls = [], redirects = [];
    const data = { orderNumber: 'AUR-AAAAAAAAAAAAAAAA', trackingToken: 'a'.repeat(64), checkoutUrl: 'https://checkout.infinitepay.io/store/test' };
    const context = { location: { hostname: 'localhost', assign: value => redirects.push(value) },
      sessionStorage: { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) },
      document: { querySelector: () => null }, crypto: require('node:crypto').webcrypto, TextEncoder, Uint8Array, URL, AbortSignal,
      fetch: async (url, options) => {
        const body = JSON.parse(options.body); calls.push({ url, body });
        if (url.endsWith('/attempt/recover')) {
          assert.equal(body.checkoutAttemptId, oldId);
          if (state === 'offline') throw Error('offline');
          return { ok: true, json: async () => ({ success: true, data: state === 'order' ? { ...data, state, paymentStatus: 'pending' } : { state } }) };
        }
        assert.ok(url.endsWith('/checkout')); assert.notEqual(body.checkoutAttemptId, oldId);
        return { ok: true, json: async () => ({ success: true, data }) };
      } };
    vm.runInNewContext(source + '\nglobalThis.start = startInfinitePay;', context);
    const operation = () => context.start({ items: [{ sku: 'REAL', quantity: 1 }], customer: { name: 'Changed' }, delivery: { method: 'pickup' } });
    if (state === 'empty') {
      await operation(); assert.equal(redirects[0], data.checkoutUrl); assert.equal(calls.length, 2);
    } else {
      await assert.rejects(operation()); assert.equal(calls.length, 1); assert.equal(redirects.length, 0);
      assert.equal(JSON.parse(values.get('fios-infinitepay-attempt')).id, oldId);
    }
  }
});
