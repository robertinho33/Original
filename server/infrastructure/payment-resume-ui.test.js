const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');

function fixture() {
  const listeners = {}, calls = []; let mounted, redirected;
  class Element {
    constructor(tag) { this.tag = tag; this.children = []; this.listeners = {}; }
    setAttribute() {}
    append(...nodes) { this.children.push(...nodes); }
    after(node) { mounted = node; }
    addEventListener(name, fn) { this.listeners[name] = fn; }
  }
  const payment = new Element('div');
  const document = { createElement: tag => new Element(tag), getElementById: id => id === 'trackingPayment' ? payment : null,
    addEventListener: (name, fn) => { listeners[name] = fn; }, querySelector: () => null };
  const source = fs.readFileSync(path.join(__dirname, '../../js/orders/mercado-pago-resume.js'), 'utf8').replace(/^import .*\n/, '');
  const context = { document, URL, AbortSignal, readPaymentReturn: () => ({token: ''}),
    location: { hostname: 'www.fiosperfeitos.com.br', assign: value => { redirected = value; } },
    fetch: async (url, options) => { calls.push({url, body: JSON.parse(options.body)}); return {
      ok: true, json: async () => ({success: true, data: {checkoutUrl: 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=existing'}})
    }; } };
  vm.runInNewContext(source, context);
  return {section: mounted, calls, redirected: () => redirected,
    emit: (name, detail) => listeners[name]({detail}),
    button: () => mounted.children.find(node => node.textContent === 'Voltar às formas de pagamento')};
}

test('number lookup without a token in the page URL displays payment navigation only after authenticated tracking loads', () => {
  const f = fixture(); assert.equal(f.section.hidden, true);
  f.emit('nefer:tracking-loaded', {trackingToken: 'a'.repeat(64), paymentProvider: 'mercado-pago', paymentStatus: 'pending'});
  assert.equal(f.section.hidden, false); assert.equal(f.button().hidden, false);
});

test('resume uses the currently loaded order token rather than the initial or previous order', async () => {
  const f = fixture();
  for (const char of ['a', 'b']) f.emit('nefer:tracking-loaded', {trackingToken: char.repeat(64), paymentProvider: 'mercado-pago', paymentStatus: 'pending'});
  await f.button().listeners.click();
  assert.equal(f.calls.length, 1); assert.equal(f.calls[0].body.token, 'b'.repeat(64));
  assert.match(f.calls[0].url, /\/resume$/); assert.match(f.redirected(), /^https:\/\/www.mercadopago.com.br\//);
});

test('paid orders, other providers and missing private tokens never expose payment navigation', () => {
  const f = fixture();
  for (const detail of [
    {trackingToken: 'a'.repeat(64), paymentProvider: 'mercado-pago', paymentStatus: 'paid'},
    {trackingToken: 'a'.repeat(64), paymentProvider: 'other', paymentStatus: 'pending'},
    {trackingToken: '', paymentProvider: 'mercado-pago', paymentStatus: 'pending'}
  ]) { f.emit('nefer:tracking-loaded', detail); assert.equal(f.section.hidden, true); }
  assert.equal(f.calls.length, 0);
});

test('loading another order hides the previous order payment controls', () => {
  const f = fixture();
  f.emit('nefer:tracking-loaded', {trackingToken: 'a'.repeat(64), paymentProvider: 'mercado-pago', paymentStatus: 'failed'});
  assert.equal(f.section.hidden, false); f.emit('nefer:tracking-loading'); assert.equal(f.section.hidden, true);
});
