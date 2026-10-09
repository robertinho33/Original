'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const p = require('./mercado-pago-provider');

const config = { storeUrl: 'https://www.fiosperfeitos.com.br',
  notificationUrl: 'https://example.test/webhook', mode: 'test', collectorId: '123' };
const order = { orderNumber: 'AUR-0000000000000001', publicTrackingToken: 'a'.repeat(64), totals: { total: 99.91 } };
const payment = { external_reference: order.orderNumber, collector_id: 123,
  currency_id: 'BRL', live_mode: false, transaction_amount: 99.91, status: 'approved' };

test('sem configuração completa ou sem validação de produção, cartões ficam desativados', () => {
  assert.equal(p.configuration({}).enabled, false);
  const env = { MP_CHECKOUT_ENABLED: 'true', MP_MODE: 'test', MP_ACCESS_TOKEN: 'test-only',
    MP_WEBHOOK_SECRET: 'test-only', MP_COLLECTOR_ID: '123', PUBLIC_STORE_URL: config.storeUrl,
    MP_NOTIFICATION_URL: config.notificationUrl };
  assert.equal(p.configuration(env).enabled, true);
  assert.equal(p.configuration({ ...env, MP_MODE: 'production' }).enabled, false);
  assert.equal(p.configuration({ ...env, MP_NOTIFICATION_URL: 'http://example.test' }).enabled, false);
  assert.equal(p.configuration({ ...env, MP_MODE: 'production', MP_PRODUCTION_VALIDATED: 'true' }).enabled, false);
  const realEnv = { ...env, MP_MODE: 'production', MP_PRODUCTION_VALIDATED: 'true',
    MP_PRODUCTION_ACCESS_TOKEN: 'real-token-mock', MP_PRODUCTION_WEBHOOK_SECRET: 'real-secret-mock', MP_PRODUCTION_COLLECTOR_ID: '456' };
  assert.equal(p.configuration(realEnv).enabled, true);
  assert.equal(p.configuration(realEnv).collectorId, '456');
  assert.equal(p.configuration(realEnv).token, 'real-token-mock');
});
test('preferência usa somente total autorizado e mantém retorno de teste separado', () => {
  const body = p.preferenceBody(order, config);
  assert.equal(body.items[0].unit_price, 99.91);
  assert.equal(body.external_reference, order.orderNumber);
  assert.match(body.back_urls.success, /mp_test=1#token=/);
  assert.equal(body.payment_methods.installments, 1);
  assert.throws(() => p.preferenceBody({ ...order, totals: { total: -1 } }, config));
});
test('destinos de pagamento externos ou sem HTTPS são recusados', () => {
  assert.match(p.checkoutUrl('https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=123'), /mercadopago/);
  for (const url of ['https://evil.test', 'https://www.mercadopago.com.br.evil.test', 'javascript:alert(1)', 'http://www.mercadopago.com.br']) assert.throws(() => p.checkoutUrl(url));
});
test('assinatura legítima aceita; corpo ou assinatura adulterados não autorizam consulta', () => {
  const secret = 'mock-webhook-secret', ts = '1234567890', id = '99', requestId = 'request-1';
  const v1 = createHmac('sha256', secret).update(`id:${id};request-id:${requestId};ts:${ts};`).digest('hex');
  const req = { query: { 'data.id': id }, get: name => ({ 'x-request-id': requestId, 'x-signature': `ts=${ts},v1=${v1}` })[name] };
  assert.equal(p.verifySignature(req, secret), true);
  assert.equal(p.verifySignature(req, 'wrong'), false);
  assert.equal(p.verifySignature({ ...req, query: { 'data.id': '100' } }, secret), false);
  assert.equal(p.verifySignature({ ...req, get: () => '' }, secret), false);
});
test('aprovação só vale com referência, recebedor, moeda, ambiente e valor correspondentes', () => {
  assert.equal(p.paymentMatches(payment, order, config), true);
  for (const patch of [{ collector_id: 999 }, { currency_id: 'USD' }, { live_mode: true },
    { transaction_amount: 99.92 }, { external_reference: 'other' }]) assert.equal(p.paymentMatches({ ...payment, ...patch }, order, config), false);
  assert.equal(p.paymentStatus(payment), 'paid');
  assert.equal(p.paymentStatus({ status: 'in_process' }), 'pending');
  assert.equal(p.paymentStatus({ status: 'refunded' }), 'refunded');
  // APP_USR de uma conta de teste pode usar recursos live; a conta autenticada deve ser test_user.
  assert.equal(p.paymentMatches({ ...payment, live_mode: true }, order, { ...config, testAccountVerified: true }), true);
  assert.equal(p.paymentMatches({ ...payment, live_mode: true }, order, config), false);
});
test('erro da API não revela credenciais nem payload do provedor', async () => {
  await assert.rejects(p.request({ token: 'private-token' }, '/checkout/preferences', {}, async () => ({ ok: false, json: async () => ({ message: 'private-token' }) })), error => !error.message.includes('private-token'));
});
