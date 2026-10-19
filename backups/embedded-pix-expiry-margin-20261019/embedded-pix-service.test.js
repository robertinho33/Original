const test = require('node:test'), assert = require('node:assert/strict');
const {paymentBody, payerFor, publicPix, validCpf, prepareEmbeddedPix} = require('./embedded-pix-service');
const config = {mode: 'test', collectorId: '123', notificationUrl: 'https://example.test/webhook'};
const order = {orderNumber: 'AUR-1234567812345678', publicTrackingToken: 'a'.repeat(64), totals: {total: 28.18},
  customer: {name: 'Comprador Teste', email: 'buyer@example.test'}, payment: {method: 'pix', status: 'pending', mode: 'test'}};
const response = {id: 987, external_reference: order.orderNumber, collector_id: 123, currency_id: 'BRL', live_mode: false,
  transaction_amount: 28.18, payment_method_id: 'pix', status: 'pending', date_of_expiration: '2030-01-01T00:00:00.000Z',
  point_of_interaction: {transaction_data: {qr_code: '000201-test-only', qr_code_base64: 'aW1hZ2U='}}};
function fixture() {
  const records = new Map([['order', structuredClone(order)], ['attempt', {lease: 'owner'}]]);
  let queue = Promise.resolve();
  const ref = key => ({key});
  const db = {runTransaction(fn) {const task = queue.then(() => fn({
    get: async r => ({data: () => structuredClone(records.get(r.key))}),
    update(r, patch) {const data = records.get(r.key); for (const [field,value] of Object.entries(patch)) { const keys = field.split('.'); if (keys.length === 2) data[keys[0]][keys[1]] = structuredClone(value); else data[field] = structuredClone(value); }},
    set(r, value, options) {records.set(r.key, options?.merge ? {...records.get(r.key), ...structuredClone(value)} : structuredClone(value));}
  })); queue = task.catch(() => {}); return task;}};
  return {records, db, orderRef: ref('order'), attemptRef: ref('attempt'), lease: 'owner', config, order: structuredClone(order), now: () => 1000000};
}
test('PIX amount is the persisted total, with fixed expiry and buyer data; malformed payer is rejected', () => {
  const body = paymentBody(order, {expiresAt: '2030-01-01T00:00:00Z', notificationUrl: config.notificationUrl});
  assert.equal(body.transaction_amount, 28.18); assert.equal(body.payment_method_id, 'pix');
  assert.equal(body.external_reference, order.orderNumber); assert.equal(body.payer.email, order.customer.email);
  assert.throws(() => payerFor({email: 'bad'})); assert.equal(validCpf('11111111111'), false);
  assert.equal(validCpf('52998224725'), true);
  assert.throws(() => payerFor(order.customer, {type: 'CPF', number: '123'}));
});
test('PIX retries after a network timeout reuse the exact persisted key and body', async () => {
  const f = fixture(), calls = []; let confirmed = 0;
  const request = async (...args) => {calls.push(args); if (calls.length === 1) throw Error('timeout'); return response;};
  const options = {...f, request, confirmPayment: async () => {confirmed++;}};
  await assert.rejects(prepareEmbeddedPix(options));
  assert.ok(f.records.get('order').payment.pixRequest);
  const result = await prepareEmbeddedPix({...options, now: () => 1100000});
  assert.equal(result.data.kind, 'embedded_pix'); assert.equal(result.data.pix.paymentId, '987');
  assert.deepEqual(calls[0][2], calls[1][2]);
  assert.equal(calls[0][5]['X-Idempotency-Key'], calls[1][5]['X-Idempotency-Key']);
  assert.equal(f.records.get('attempt').lockedUntil, 0); assert.equal(confirmed, 1);
});
test('wrong amount, seller, currency, method, mode and reference cannot become a PIX response', async () => {
  for (const patch of [{transaction_amount: 1}, {collector_id: 999}, {currency_id: 'USD'}, {payment_method_id: 'visa'}, {live_mode: true}, {external_reference: 'OTHER'}]) {
    const f = fixture(); let confirmed = 0;
    await assert.rejects(prepareEmbeddedPix({...f, request: async () => ({...response, ...patch}), confirmPayment: async () => {confirmed++;}}));
    assert.equal(confirmed, 0); assert.equal(f.records.get('attempt').response, undefined);
  }
});
test('hosted payment or mismatched lease cannot generate another PIX', async () => {
  for (const modify of [f => {f.records.get('order').payment.preferenceId = 'existing';}, f => {f.records.get('attempt').lease = 'other';}]) {
    const f = fixture(); modify(f); let calls = 0;
    await assert.rejects(prepareEmbeddedPix({...f, request: async () => {calls++; return response;}, confirmPayment: async () => {}}));
    assert.equal(calls, 0);
  }
});
test('public PIX projection excludes payer data and rejects unsafe image responses', () => {
  const result = publicPix({...response, payer: {email: 'private@example.test'}}, response.date_of_expiration);
  assert.doesNotMatch(JSON.stringify(result), /private|payer/);
  assert.throws(() => publicPix({...response, point_of_interaction: {transaction_data: {qr_code: '000201', qr_code_base64: 'https://evil.test/img'}}}));
});
