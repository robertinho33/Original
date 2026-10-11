'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { prepareShipping } = require('./shipping-domain');
const address = { cep: '01310-100', street: 'Avenida Paulista', number: '100', neighborhood: 'Bela Vista', city: 'São Paulo', state: 'SP', salonName: 'Salão exemplo', phone: '(11) 99999-9999', recipient: 'Responsável exemplo' };
test('retirada preserva os dados do salão sem cobrar frete', () => {
  const result = prepareShipping({ method: 'pickup', address });
  assert.equal(result.cost, 0);
  assert.equal(result.address.salonName, address.salonName);
  assert.equal(result.address.recipient, address.recipient);
  assert.equal(result.address.phone, '11999999999');
  assert.equal(result.address.cep, '01310100');
});
test('dados de retirada incompletos são rejeitados', () => {
  for (const patch of [{ salonName: '' }, { recipient: '' }, { phone: '123' }, { cep: '0' }]) {
    assert.throws(() => prepareShipping({ method: 'pickup', address: { ...address, ...patch } }));
  }
});
test('pedidos antigos de retirada sem endereço continuam compatíveis', () => {
  assert.deepEqual(prepareShipping({ method: 'pickup' }), { method: 'pickup', cost: 0, address: null });
});
