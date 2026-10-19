const test = require('node:test'), assert = require('node:assert/strict');
const provider = require('./mercado-pago-provider');
const {verifyExpiredPix} = require('./embedded-pix-expiry');
const config = {mode: 'test', collectorId: '123'};
const order = {orderNumber: 'AUR-1234567812345678', totals: {total: 32.97}, payment: {
  provider: 'mercado-pago', mode: 'test', experience: 'embedded_pix', status: 'pending', pix: {paymentId: '1234'}}};
const original = provider.request;
test('expired PIX is cancelled and re-read before any stock release', async () => {
  const calls = []; let cancelled = false;
  const payment = {id: 1234, external_reference: order.orderNumber, collector_id: 123, currency_id: 'BRL', live_mode: false,
    transaction_amount: 32.97, payment_method_id: 'pix', status: 'pending', date_of_expiration: '2000-01-01T00:00:00Z'};
  provider.request = async (config, path, body, fetchImpl, method) => {
    calls.push({path, method}); if (path === '/users/me') return {id: 123, tags: ['test_user']};
    if (method === 'PUT') {cancelled = true; return {};}
    if (path.includes('/search')) return {paging: {total: 1}, results: [{...payment, status: 'cancelled'}]};
    return {...payment, status: cancelled ? 'cancelled' : 'pending'};
  };
  try {assert.equal((await verifyExpiredPix(config, order, async () => {throw Error('not paid');})).release, true);
    assert.equal(calls.filter(c => c.method === 'PUT').length, 1); assert.equal(calls.filter(c => c.path === '/v1/payments/1234').length, 3);
  } finally {provider.request = original;}
});
test('approved PIX confirms payment and never cancels or releases stock', async () => {
  let confirmed = 0, mutations = 0;
  provider.request = async (config, path, body) => {
    if (body) mutations++;
    if (path === '/users/me') return {id: 123, tags: ['test_user']};
    return {id: 1234, external_reference: order.orderNumber, collector_id: 123, currency_id: 'BRL', live_mode: false,
      transaction_amount: 32.97, payment_method_id: 'pix', status: 'approved'};
  };
  try {const result = await verifyExpiredPix(config, order, async () => {confirmed++; return 'paid';});
    assert.equal(result.release, false); assert.equal(confirmed, 1); assert.equal(mutations, 0);
  } finally {provider.request = original;}
});
