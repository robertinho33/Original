const test = require('node:test');
const assert = require('node:assert/strict');
const { idempotencyMiddleware } = require('./idempotency');
const store = require('../infrastructure/idempotency-store');
test('chave de cache não desvia autorização nem retorna resposta de outra rota', () => {
  store.set('shared-key', { status: 200, body: { private: true } });
  const req = { method: 'POST', get: () => 'shared-key' };
  let passed = false;
  idempotencyMiddleware(req, { status: () => assert.fail('não deve recuperar resposta global') }, error => { assert.equal(error, undefined); passed = true; });
  assert.equal(passed, true); assert.equal(req.idempotencyKey, 'shared-key');
  store.remove('shared-key');
});
