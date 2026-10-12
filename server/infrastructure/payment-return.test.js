const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../../js/orders/payment-return.js'), 'utf8').replace('export function', 'function');
const context = { URLSearchParams }; vm.createContext(context); vm.runInContext(source, context);
test('preserves private token and payment ID from the actual boleto return format', () => {
    const token = 'a'.repeat(64);
    const result = context.readPaymentReturn({ search: '', hash: '#token=' + token + '?collection_id=182753221077&payment_id=182753221077&status=rejected' });
    assert.equal(result.token, token); assert.equal(result.paymentId, '182753221077');
});
test('supports normal private links and query returns without granting access to malformed tokens', () => {
    const token = 'b'.repeat(64);
    assert.equal(context.readPaymentReturn({ hash: '#token=' + token }).token, token);
    const result = context.readPaymentReturn({ search: '?payment_id=123', hash: '#token=' + token });
    assert.equal(result.token, token); assert.equal(result.paymentId, '123');
    assert.equal(/^[a-f0-9]{64}$/i.test(context.readPaymentReturn({ hash: '#token=invalid?payment_id=123' }).token), false);
});
