'use strict';

const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const assert = require('node:assert/strict');

function validator(coupon) {
    const module = { exports: {} };
    const query = {
        collection: () => query,
        where: () => query,
        limit: () => query,
        get: async () => ({ docs: [{ id: 'id', data: () => coupon }] })
    };
    vm.runInNewContext(readFileSync(require.resolve('./coupon-service'), 'utf8'), {
        module, require: () => ({ getFirestore: () => query })
    });
    return module.exports.validateCoupon;
}

test('unlimited coupons support * and legacy zero even after prior uses', async () => {
    for (const usageLimit of ['*', 0, '0', null, undefined]) {
        const result = await validator({ active: true, discount: 10, uses: 99, usageLimit })('PARCEIRO');
        assert.equal(result.valid, true, String(usageLimit));
    }
});

test('unlimited use does not override disabled or expired coupons, and finite limits still apply', async () => {
    for (const coupon of [
        { active: false, usageLimit: '*' },
        { active: true, usageLimit: '*', expiresAt: '2000-01-01' },
        { active: true, usageLimit: 5, uses: 5 }
    ]) {
        assert.equal((await validator(coupon)('PARCEIRO')).valid, false);
    }
    assert.equal((await validator({ active: true, usageLimit: 5, uses: 4 })('PARCEIRO')).valid, true);
});
