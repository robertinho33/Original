const test = require('node:test');
const assert = require('node:assert/strict');
const firebasePath = require.resolve('../../infrastructure/firebase/firebase-admin');
require.cache[firebasePath] = { id: firebasePath, filename: firebasePath, loaded: true, exports: {} };
const { attemptFor, responseFor } = require('./pix-attempt');
const payload = { checkoutAttemptId: '11111111-1111-4111-8111-111111111111', items: [{ sku: 'A', quantity: 1 }], customer: { name: 'Exemplo', phone: '11999999999' }, delivery: { method: 'pickup' } };
test('valores não confiáveis e ID temporário não alteram tentativa; mudança de quantidade altera', () => {
  assert.equal(attemptFor(payload).fingerprint, attemptFor({ ...payload, id: 'other', total: 0 }).fingerprint);
  assert.notEqual(attemptFor(payload).fingerprint, attemptFor({ ...payload, items: [{ sku: 'A', quantity: 2 }] }).fingerprint);
  assert.notEqual(attemptFor(payload).fingerprint, attemptFor({ ...payload, delivery: { method: 'delivery' } }).fingerprint);
  assert.throws(() => attemptFor({ ...payload, checkoutAttemptId: 'invalid' }));
});
test('recupera QR salvo e não reabre pedido confirmado', () => {
  const order = { orderNumber: 'AUR-12345678', publicTrackingToken: 'a'.repeat(64), totals: { total: 10 }, payment: { status: 'pending', pixResponse: { success: true, pix_code: 'original', qr_code: 'image' } } };
  assert.equal(responseFor(order).pix_code, 'original');
  assert.equal(responseFor(order).order.orderNumber, order.orderNumber);
  assert.throws(() => responseFor({ ...order, payment: { ...order.payment, status: 'paid' } }), /atualização/);
});
