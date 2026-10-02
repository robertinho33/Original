'use strict';

const {
  getFirestore
} = require('../../infrastructure/firebase/firebase-admin');

function getDb() {
  return getFirestore();
}

function normalizeCode(value) {
  return String(value ?? '')
    .trim()
    .toUpperCase();
}

async function validateCoupon(code) {
  const normalizedCode = normalizeCode(code);

  if (!normalizedCode) {
    return {
      valid: false,
      message: 'Digite um cupom.'
    };
  }

  const snapshot = await getDb()
    .collection('coupons')
    .where('code', '==', normalizedCode)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return {
      valid: false,
      message: 'Cupom inválido ou expirado.'
    };
  }

  const document = snapshot.docs[0];
  const coupon = document.data() || {};

  const active =
    coupon.active !== undefined
      ? Boolean(coupon.active)
      : coupon.status !== 'inactive';

  if (!active) {
    return {
      valid: false,
      message: 'Cupom inválido ou expirado.'
    };
  }

  const uses = Number(coupon.uses || 0);

  const usageLimit =
    coupon.usageLimit === null ||
    coupon.usageLimit === undefined ||
    coupon.usageLimit === ''
      ? null
      : Number(coupon.usageLimit);

  if (
    usageLimit !== null &&
    Number.isFinite(usageLimit) &&
    uses >= usageLimit
  ) {
    return {
      valid: false,
      message: 'O limite de uso deste cupom foi atingido.'
    };
  }

  if (coupon.expiresAt) {
    const expiration = new Date(coupon.expiresAt);

    if (
      Number.isFinite(expiration.getTime()) &&
      expiration.getTime() < Date.now()
    ) {
      return {
        valid: false,
        message: 'Cupom inválido ou expirado.'
      };
    }
  }

  const discount = Number(coupon.discount || 0);

  if (!Number.isFinite(discount) || discount < 0) {
    return {
      valid: false,
      message: 'Cupom com configuração inválida.'
    };
  }

  const discountType =
    String(
      coupon.discountType ??
      'percentage'
    )
      .trim()
      .toLowerCase();

  return {
    valid: true,
    coupon: {
      id: document.id,
      code: normalizedCode,
      discount,
      discountType,
      affiliateName:
        String(coupon.affiliateName || '').trim(),
      commission: Number(coupon.commission || 0)
    }
  };
}

module.exports = {
  validateCoupon
};
