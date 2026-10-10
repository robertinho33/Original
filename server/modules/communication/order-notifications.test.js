'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { messageDetails, notifyOrder } = require('./order-notifications');
const order = { orderNumber: 'AUR-12345678', customer: { name: 'Comprador', phone: '11999999999' }, address: { street: 'Rua Privada', number: '42', city: 'São Paulo' }, items: [{ name: 'Óleo', quantity: 2 }], totals: { total: 25, discount: 5, shipping: 0 }, coupon: { code: 'PARCEIRO' }, deliveryMethod: 'delivery', payment: { method: 'card' }, publicTrackingToken: 'a'.repeat(64) };
test('administrador recebe itens, contato e entrega sem afirmar pagamento aprovado', () => {
  const text = messageDetails(order, 'admin');
  assert.match(text, /2x Óleo/);
  assert.match(text, /Rua Privada, 42/);
  assert.match(text, /11999999999/);
  assert.match(text, /aguardando confirmação/);
});
test('aviso de cupom não expõe dados pessoais nem link privado', () => {
  const text = messageDetails(order, 'influencer');
  assert.match(text, /PARCEIRO/);
  for (const privateValue of ['Comprador', '11999999999', 'Rua Privada', order.publicTrackingToken]) assert.equal(text.includes(privateValue), false);
});
test('retirada informa ausência de frete', () => assert.match(messageDetails({ ...order, deliveryMethod: 'pickup' }, 'admin'), /Retirada, sem frete/));
test('compras de teste não enviam mensagens reais', async () => assert.deepEqual(await notifyOrder({ ...order, payment: { mode: 'test' } }), { skipped: 'test_order' }));
