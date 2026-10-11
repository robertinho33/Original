'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
let calls = [];
const query = async (text, params = []) => {
  calls.push({ text, params });
  return { rows: [{ id: 1, sku: 'SAFE', name: 'Exemplo' }] };
};
const dbPath = require.resolve('./admin-db');
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { query, transaction: action => action({ query }) } };
const payloads = ["' OR 1=1 --", "'; DROP TABLE orders; --", "x' UNION SELECT password FROM users --", "Robert'); DELETE FROM products; --"];
function separated(payload) {
  assert.ok(calls.length);
  assert.ok(calls.some(call => call.params.some(value => typeof value === 'string' && value.includes(payload))), 'entrada deve permanecer no vetor de parâmetros');
  for (const call of calls) {
    assert.equal(call.text.includes(payload), false, 'entrada jamais deve ser incorporada ao comando SQL');
    if (call.params.length) assert.match(call.text, /\$\d+/);
  }
}
test('busca de clientes mantém entradas maliciosas como parâmetros', async () => {
  for (const payload of payloads) {
    calls = [];
    await require('./admin-customer-filter-repository').searchCustomers(payload);
    separated(payload);
  }
});
test('filtros de pedidos não interpolam status, cliente ou datas', async () => {
  for (const payload of payloads) {
    calls = [];
    await require('./admin-order-filter-repository').searchOrders({ status: payload, customer: payload, from: payload, to: payload });
    separated(payload);
  }
});
test('filtros de produtos não interpolam busca ou categoria', async () => {
  for (const payload of payloads) {
    calls = [];
    await require('./admin-product-filter-repository').searchProducts({ term: payload, category: payload, active: 'true' });
    separated(payload);
    calls = [];
    await require('./product-filter-repository').searchProducts({ search: payload, category_id: payload });
    separated(payload);
  }
});
test('busca global protege produtos, pedidos e clientes', async () => {
  for (const payload of payloads) {
    calls = [];
    await require('./final-admin-repository').globalSearch(payload);
    assert.equal(calls.length, 3);
    separated(payload);
  }
});
test('histórico de inventário trata identificador como valor', async () => {
  calls = [];
  await require('./admin-inventory-history-repository').getInventoryHistory(payloads[0]);
  separated(payloads[0]);
});
test('atualização de produto e auditoria preservam parâmetros', async () => {
  calls = [];
  const payload = payloads[1];
  await require('./admin-product-repository').updateProduct(payload, { name: payload, description: payload, sku: payload });
  separated(payload);
});
