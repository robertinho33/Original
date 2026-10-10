"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const provider = require('./mercado-pago-provider');
const { resumeOrder } = require('./mercado-pago-resume');

test('retomada verifica pagamento existente e renova somente a mesma preferência', async () => {
  const config = { mode: 'test', collectorId: '123' };
  const order = { orderNumber: 'AUR-0000000000000001', totals: { total: 12.98 },
    payment: { mode: 'test', provider: 'mercado-pago', preferenceId: 'same-preference', status: 'pending' } };
  const preference = { collector_id: 123, external_reference: order.orderNumber,
    items: [{ unit_price: 12.98, quantity: 1, currency_id: 'BRL' }],
    init_point: 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=same-preference' };
  const basePayment = { collector_id: 123, external_reference: order.orderNumber,
    currency_id: 'BRL', transaction_amount: 12.98, live_mode: false };
  let results = [], pagingTotal = 0, putCount = 0, confirmed = 0, modifiedPreference = preference;
  const original = provider.request;
  provider.request = async (cfg, path, body, fetchImpl, method) => {
    if (path === '/users/me') return { id: 123, tags: ['test_user'] };
    if (path.startsWith('/v1/payments/search')) return { results, paging: { total: pagingTotal } };
    assert.equal(path, '/checkout/preferences/same-preference');
    if (method === 'PUT') {
      putCount++;
      assert.equal(body.expires, true);
      assert.ok(Date.parse(body.expiration_date_to) > Date.now());
    }
    return modifiedPreference;
  };
  const confirm = async () => { confirmed++; return 'paid'; };
  try {
    assert.match((await resumeOrder(config, order, confirm)).checkoutUrl, /same-preference/);
    assert.equal(putCount, 1);
    results = [{ ...basePayment, status: 'approved' }]; pagingTotal = 1;
    assert.deepEqual(await resumeOrder(config, order, confirm), { checkoutUrl: null, paymentStatus: 'paid' });
    assert.equal(confirmed, 1); assert.equal(putCount, 1);
    results = [{ ...basePayment, status: 'in_process' }];
    await assert.rejects(resumeOrder(config, order, confirm), /análise/);
    assert.equal(putCount, 1);
    results = [{ ...basePayment, status: 'approved', transaction_amount: 0.01 }];
    await assert.rejects(resumeOrder(config, order, confirm), /incompatível/);
    assert.equal(confirmed, 1);
    results = []; pagingTotal = 1;
    await assert.rejects(resumeOrder(config, order, confirm), /incompleta/);
    pagingTotal = 0; modifiedPreference = { ...preference, collector_id: 999 };
    await assert.rejects(resumeOrder(config, order, confirm), /incompatível/);
    assert.equal(putCount, 1);
    await assert.rejects(resumeOrder(config, { ...order, payment: { ...order.payment, status: 'paid' } }, confirm), /não pode/);
  } finally { provider.request = original; }
});
