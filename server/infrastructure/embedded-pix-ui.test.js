const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../../js/orders/embedded-pix.js'), 'utf8').replace(/^import .*\n/, '');
function fixture(results, token = 'a'.repeat(64)) {
  const nodes = {}, timers = [], calls = [], redirects = [];
  const node = id => nodes[id] ||= {hidden: true, listeners: {}, addEventListener(name, fn) {this.listeners[name] = fn;}, focus() {}, select() {}};
  const context = {URLSearchParams, AbortSignal, document: {hidden: false, getElementById: node, addEventListener() {}},
    location: {hostname: 'www.fiosperfeitos.com.br', replace: url => redirects.push(url)}, window: {addEventListener() {}},
    navigator: {clipboard: {writeText: async () => {}}}, readPaymentReturn: () => ({token, query: new URLSearchParams('status=approved')}),
    clearTimeout() {}, setTimeout: fn => {timers.push(fn); return timers.length;},
    fetch: async (url, options) => {calls.push({url, body: JSON.parse(options.body)}); const next = results.shift(); if (next instanceof Error) throw next;
      return {ok: true, json: async () => next};}
  };
  vm.runInNewContext(source, context);
  return {nodes, timers, calls, redirects};
}
const pending = {success: true, data: {paymentStatus: 'pending', orderNumber: 'AUR-1234567812345678', total: 32.97,
  pix: {qrCode: '000201-test', qrCodeBase64: 'aW1hZ2U=', expiresAt: '2030-01-01T00:00:00Z'}}};
const flush = () => new Promise(resolve => setImmediate(resolve));
test('pending PIX renders a local QR and never trusts an approved return parameter', async () => {
  const f = fixture([pending]); await flush();
  assert.equal(f.redirects.length, 0); assert.equal(f.nodes.pixCode.value, '000201-test');
  assert.equal(f.nodes.pixCodePanel.hidden, false); assert.match(f.nodes.pixImage.src, /^data:image\/png;base64,/);
  assert.equal(f.calls[0].body.token, 'a'.repeat(64)); assert.equal(f.timers.length, 1);
});
test('confirmed server status automatically navigates to the private delivery tracking and stops polling', async () => {
  const f = fixture([pending, {success: true, data: {paymentStatus: 'paid'}}]); await flush();
  await f.timers.shift()(); await flush();
  assert.equal(f.redirects.length, 1); assert.match(f.redirects[0], /^\.\/rastrear-pedido.html#token=[a-f0-9]{64}$/);
  assert.equal(f.nodes.pixCodePanel.hidden, true); assert.equal(f.timers.length, 0);
});
test('network failure does not confirm or recreate a PIX and preserves automatic retry', async () => {
  const f = fixture([Error('network')]); await flush();
  assert.equal(f.redirects.length, 0); assert.equal(f.calls.length, 1); assert.equal(f.timers.length, 1);
});
test('malformed private link sends no request', async () => {
  const f = fixture([], 'invalid'); await flush(); assert.equal(f.calls.length, 0); assert.equal(f.redirects.length, 0);
});
