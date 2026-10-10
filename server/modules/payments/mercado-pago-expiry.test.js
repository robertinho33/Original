"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const provider = require('./mercado-pago-provider');
const { verifyExpiredOrder } = require('./mercado-pago-expiry');
test('expiração só autoriza devolver reserva após fechar preferência e conferir pagamentos', async () => {
  const config = { mode: 'test', collectorId: '123' };
  const order = { orderNumber: 'AUR-0000000000000001', totals: { total: 12.98 },
    payment: { mode: 'test', provider: 'mercado-pago', status: 'pending', preferenceId: 'p1' } };
  const payment = { collector_id: 123, external_reference: order.orderNumber,
    currency_id: 'BRL', live_mode: false, transaction_amount: 12.98 };
  let expiry = Date.now() - 120000, results = [], searchFails = false, closed = false, confirmed = 0;
  const original = provider.request;
  provider.request = async (cfg, path, body, fetchImpl, method) => {
    if (path === '/users/me') return { id: 123, tags: ['test_user'] };
    if (path.startsWith('/v1/payments/search')) {
      assert.equal(closed, true);
      if (searchFails) throw new Error('Consulta indisponível');
      return { results, paging: { total: results.length } };
    }
    if (method === 'PUT') { closed = true; return {}; }
    return { collector_id: 123, external_reference: order.orderNumber, expires: true,
      expiration_date_to: new Date(expiry).toISOString() };
  };
  try {
    assert.deepEqual(await verifyExpiredOrder(config, order, async () => 'paid'), { release: true });
    expiry = Date.now() + 60000; closed = false;
    await assert.rejects(verifyExpiredOrder(config, order, async () => 'paid'), /prazo/);
    assert.equal(closed, false);
    expiry = Date.now() - 120000; results = [{ ...payment, status: 'in_process' }];
    await assert.rejects(verifyExpiredOrder(config, order, async () => 'paid'), /análise/);
    results = [{ ...payment, status: 'approved' }];
    assert.deepEqual(await verifyExpiredOrder(config, order, async () => { confirmed++; return 'paid'; }), { release: false, paymentStatus: 'paid' });
    assert.equal(confirmed, 1);
    searchFails = true;
    await assert.rejects(verifyExpiredOrder(config, order, async () => 'paid'), /indisponível/);
  } finally { provider.request = original; }
});
