const test = require('node:test'), assert = require('node:assert/strict');
const {DISPATCH_PHONE, paidOrderDetails, notifyPaidOrder} = require('./paid-order-notification');
const order = {orderNumber: 'AUR-1234567812345678', publicTrackingToken: 'a'.repeat(64),
  customer: {name: 'Cliente Teste', phone: '11999999999'}, address: {street: 'Rua Teste', number: '10'},
  items: [{sku: 'SKU-1', name: 'Produto', quantity: 2}], totals: {total: 100, shipping: 10, discount: 5},
  payment: {mode: 'production', status: 'paid', method: 'pix'}, stock: {status: 'committed'}};
function fixture(configured = true) {
  let saved; let queue = Promise.resolve(); const sent = [];
  const ref = {update: async value => {saved = {...saved, ...value};}};
  const db = {collection: name => ({doc: id => {assert.equal(name, 'orderNotifications'); assert.equal(id, order.orderNumber + '_admin_paid'); return ref;}}),
    runTransaction(fn) {const task = queue.then(() => fn({get: async () => ({exists: !!saved, data: () => saved}), set: (r, data) => {saved = data;}})); queue = task.catch(() => {}); return task;}};
  return {db, configuration: () => configured ? {} : null, send: async (o, options) => {sent.push(options); return {sent: true, status: 'accepted', messageId: 'mock'};}, sent, saved: () => saved};
}
test('paid notification includes dispatch details and only targets the authorized phone', async () => {
  const f = fixture(); await notifyPaidOrder(order, f);
  assert.equal(f.sent.length, 1); assert.equal(f.sent[0].phone, '5511986215473'); assert.equal(DISPATCH_PHONE, f.sent[0].phone);
  assert.match(f.sent[0].details, /PAGAMENTO CONFIRMADO/); assert.match(f.sent[0].details, /2x SKU-1/);
  assert.match(f.sent[0].details, /Rua Teste/); assert.match(f.sent[0].details, /Iniciar separação/);
  assert.doesNotMatch(f.sent[0].details, /aguardando confirmação|token=/i); assert.equal(f.saved().status, 'accepted');
});
test('duplicate and concurrent confirmed events send exactly one notification', async () => {
  const f = fixture(); await Promise.all([notifyPaidOrder(order, f), notifyPaidOrder(order, f), notifyPaidOrder(order, f)]);
  assert.equal(f.sent.length, 1);
});
test('test, unpaid and stock-review orders cannot trigger dispatch', async () => {
  const f = fixture();
  for (const modified of [{...order, payment: {...order.payment, mode: 'test'}}, {...order, payment: {...order.payment, status: 'pending'}}, {...order, payment: {...order.payment, reviewRequired: true}}, {...order, stock: {status: 'released'}}]) await notifyPaidOrder(modified, f);
  assert.equal(f.sent.length, 0);
});
test('missing configuration is recorded and may be retried only before any send was attempted', async () => {
  const f = fixture(false); assert.equal((await notifyPaidOrder(order, f)).reason, 'not_configured');
  assert.equal(f.saved().status, 'not_configured'); f.configuration = () => ({});
  await notifyPaidOrder(order, f); await notifyPaidOrder(order, f); assert.equal(f.sent.length, 1);
});
test('uncertain delivery is never resent automatically', async () => {
  const f = fixture(); let calls = 0; f.send = async () => {calls++; throw Error('timeout');};
  await notifyPaidOrder(order, f); await notifyPaidOrder(order, f);
  assert.equal(calls, 1); assert.equal(f.saved().status, 'needs_review');
  assert.ok(paidOrderDetails(order).length <= 1024);
});
