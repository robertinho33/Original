'use strict';

const {
  normalizeDeliveryMethod
} = require('./delivery-method');

const {
  calculateShipping
} = require('./shipping-service');

const {
  normalizeAddress
} = require('../customers/address-validator');

function prepareShipping({
  method = 'delivery',
  address = null
}) {
  const normalizedMethod =
    normalizeDeliveryMethod(method);

  const normalizedAddress =
    normalizedMethod === 'delivery'
      ? normalizeAddress(address)
      : address ? normalizePickupAddress(address) : null;

  return calculateShipping({
    method: normalizedMethod,
    address: normalizedAddress
  });
}

function normalizePickupAddress(address) {
  const normalized = normalizeAddress(address);
  const salonName = String(address.salonName || '').trim();
  const phone = String(address.phone || '').replace(/\D/g, '');
  const recipient = String(address.recipient || '').trim();
  if (!salonName || salonName.length > 160 || !recipient || recipient.length > 160 ||
      !/^(?:55)?\d{10,11}$/.test(phone) || !normalized.number || !normalized.neighborhood) {
    const { AppError } = require('../../core/app-error');
    throw new AppError('Preencha os dados do salão e do responsável pela retirada.', { status: 400 });
  }
  return { ...normalized, salonName, phone, recipient };
}

module.exports = {
  prepareShipping
};
